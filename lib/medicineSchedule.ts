/**
 * medicineSchedule.ts — pure tray/dose math for the medicine feature (2026-07-27).
 *
 * Medicine is organised as four **trays** — morning / midday / evening / night —
 * deliberately NOT as exact per-medicine clock times. A tray is a *window*, not a
 * deadline: a dose taken at 11:40 because you woke late is still a morning dose, and
 * an untaken tray reads "still due", never "missed". This is the physical
 * weekly-pill-organiser model, which is the mental model most people already have,
 * and it's the one that doesn't manufacture a visible failure out of an ADHD morning.
 *
 * Each tray has ONE reminder time (settings.medicineTrayTimes) shared by every
 * medicine in it — one notification per tray, not one per pill. As-needed (PRN)
 * medicines sit outside the trays entirely and are governed by a minimum interval
 * and an optional per-day cap instead (`asNeededState`).
 *
 * Everything here is pure (plain arrays/values in, values out — no store, no DB, no
 * Date.now()) so it's trivially unit-testable and reusable by both the card and the
 * notification coordinator. Same contract as lib/energy.ts / lib/habitRecurrence.ts.
 *
 * Connections:
 *   Imports → lib/date (parseTimeToMinutes)
 *   Used by → store/useMedicineStore.ts, lib/medicineNotifications.ts,
 *             components/MedicineTrayCard.tsx, app/medicine-form.tsx,
 *             lib/__tests__/medicineSchedule.test.ts
 *   Data    → none (pure functions)
 *
 * Edit notes:
 *   - `currentTray`/`nextTray` are a plain "last tray at-or-before now" / "first tray
 *     after now" split — before the earliest tray's time both answer null/morning
 *     rather than reaching back into yesterday's night tray. A forgotten earlier dose
 *     is surfaced by `pendingTrays` (every past tray that still has something untaken),
 *     which is what the card's "still due" line reads from — not by stretching a tray's
 *     window across midnight.
 *   - `person` filtering follows the People/family convention used by tasks/habits:
 *     `undefined`/`null` = don't filter at all (People mode off), `''` = me,
 *     a name = that profile. Never default it to `''`, or turning People mode off
 *     would hide every profile's medicine.
 *   - A tray dose's identity is (medicineId, date, tray) — that's what `isDoseTaken`
 *     matches on, and why store/useMedicineStore.ts's `takeDose` upserts rather than
 *     appending. As-needed doses carry `tray: ''` and are intentionally repeatable, so
 *     they're counted, never de-duplicated.
 */
import { parseTimeToMinutes } from '@/lib/date';

export const TRAY_IDS = ['morning', 'midday', 'evening', 'night'] as const;
export type TrayId = (typeof TRAY_IDS)[number];

/** Reminder time (HH:MM) for each tray — one per tray, shared by its medicines. */
export type TrayTimes = Record<TrayId, string>;

export const DEFAULT_TRAY_TIMES: TrayTimes = {
  morning: '08:00',
  midday: '12:00',
  evening: '18:00',
  night: '21:00',
};

/** The medicine fields the scheduling math needs (structural subset of Medicine). */
export type SchedulableMedicine = {
  id: string;
  trays: TrayId[];
  asNeeded: boolean;
  /** Minimum gap between as-needed doses, in minutes. 0 = no guard. */
  minIntervalMin: number;
  /** Max as-needed doses per day. 0 = no cap. */
  maxPerDay: number;
  childName: string;
  active: boolean;
};

/** The dose fields the scheduling math needs (structural subset of MedicineDose). */
export type LoggedDose = {
  medicineId: string;
  date: string;
  /** A TrayId for a scheduled dose, '' for an as-needed one. */
  tray: string;
  /** HH:MM the dose was actually taken. */
  takenAt: string;
};

export function isTrayId(value: string): value is TrayId {
  return (TRAY_IDS as readonly string[]).includes(value);
}

/** Keep only real TrayIds from an untrusted list (a JSON column, a route param). */
export function toTrayIds(values: unknown): TrayId[] {
  if (!Array.isArray(values)) return [];
  const out: TrayId[] = [];
  for (const v of values) {
    if (typeof v === 'string' && isTrayId(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Coerce a parsed JSON column into a complete TrayTimes, filling gaps from the defaults. */
export function normalizeTrayTimes(raw: unknown): TrayTimes {
  const out = { ...DEFAULT_TRAY_TIMES };
  if (raw && typeof raw === 'object') {
    for (const tray of TRAY_IDS) {
      const v = (raw as Record<string, unknown>)[tray];
      if (typeof v === 'string' && parseTimeToMinutes(v) !== null) out[tray] = v;
    }
  }
  return out;
}

/** A tray's reminder time as minutes since midnight (falls back to the default on garbage). */
export function trayMinutes(times: TrayTimes, tray: TrayId): number {
  return parseTimeToMinutes(times[tray]) ?? parseTimeToMinutes(DEFAULT_TRAY_TIMES[tray]) ?? 0;
}

/** A tray's reminder time as [hour, minute] — what the scheduling primitives take. */
export function parseTrayTime(times: TrayTimes, tray: TrayId): [number, number] {
  const m = trayMinutes(times, tray);
  return [Math.floor(m / 60), m % 60];
}

/** Every tray, ordered by its reminder time (ties keep the canonical TRAY_IDS order). */
export function sortedTrays(times: TrayTimes): TrayId[] {
  return [...TRAY_IDS].sort((a, b) => {
    const d = trayMinutes(times, a) - trayMinutes(times, b);
    return d !== 0 ? d : TRAY_IDS.indexOf(a) - TRAY_IDS.indexOf(b);
  });
}

/** The tray whose window contains `nowMinutes` — the last one at or before now. */
export function currentTray(times: TrayTimes, nowMinutes: number): TrayId | null {
  let found: TrayId | null = null;
  for (const tray of sortedTrays(times)) {
    if (trayMinutes(times, tray) <= nowMinutes) found = tray;
  }
  return found;
}

/** The next tray still ahead of `nowMinutes` today, or null once the last one has passed. */
export function nextTray(times: TrayTimes, nowMinutes: number): TrayId | null {
  for (const tray of sortedTrays(times)) {
    if (trayMinutes(times, tray) > nowMinutes) return tray;
  }
  return null;
}

/** True when `med` belongs to the person being viewed (see the header's person note). */
export function matchesPerson(med: { childName: string }, person?: string | null): boolean {
  return person == null || med.childName === person;
}

/** Active, scheduled (non-as-needed) medicines sitting in `tray`. */
export function medicinesForTray<T extends SchedulableMedicine>(
  meds: T[],
  tray: TrayId,
  person?: string | null
): T[] {
  return meds.filter((m) => m.active && !m.asNeeded && m.trays.includes(tray) && matchesPerson(m, person));
}

/** Active as-needed medicines (they belong to no tray). */
export function asNeededMedicines<T extends SchedulableMedicine>(meds: T[], person?: string | null): T[] {
  return meds.filter((m) => m.active && m.asNeeded && matchesPerson(m, person));
}

/** Every tray that holds at least one active medicine, in time order. */
export function traysInUse<T extends SchedulableMedicine>(
  meds: T[],
  times: TrayTimes,
  person?: string | null
): TrayId[] {
  return sortedTrays(times).filter((tray) => medicinesForTray(meds, tray, person).length > 0);
}

/** Has this scheduled dose (medicine + date + tray) already been logged? */
export function isDoseTaken(doses: LoggedDose[], medicineId: string, tray: TrayId, date: string): boolean {
  return doses.some((d) => d.medicineId === medicineId && d.date === date && d.tray === tray);
}

/** How much of a tray is done on `date` — `total` counts its scheduled medicines. */
export function trayProgress<T extends SchedulableMedicine>(
  meds: T[],
  doses: LoggedDose[],
  tray: TrayId,
  date: string,
  person?: string | null
): { total: number; taken: number } {
  const inTray = medicinesForTray(meds, tray, person);
  return {
    total: inTray.length,
    taken: inTray.filter((m) => isDoseTaken(doses, m.id, tray, date)).length,
  };
}

/**
 * Trays whose time has already passed on `date` and that still have something untaken —
 * "still due", in time order. This is what keeps a forgotten 08:00 dose visible at 14:00
 * without ever labelling it missed.
 */
export function pendingTrays<T extends SchedulableMedicine>(
  meds: T[],
  doses: LoggedDose[],
  times: TrayTimes,
  date: string,
  nowMinutes: number,
  person?: string | null
): TrayId[] {
  return traysInUse(meds, times, person).filter((tray) => {
    if (trayMinutes(times, tray) > nowMinutes) return false;
    const { total, taken } = trayProgress(meds, doses, tray, date, person);
    return taken < total;
  });
}

export type AsNeededState = {
  /** Doses of this medicine already logged on `date`. */
  takenToday: number;
  /** Minutes-since-midnight the next dose becomes allowed, or null when it already is. */
  nextAllowedMinutes: number | null;
  /** True once `maxPerDay` is reached (0 = no cap, never true). */
  atDailyLimit: boolean;
  /** The one thing the UI gates on: may another dose be taken right now? */
  canTake: boolean;
};

/**
 * Interval/limit guard for an as-needed medicine — the "earliest again 14:20" answer.
 * `nextAllowedMinutes` can exceed 1440 when the gap crosses midnight; format it with
 * `formatMinutes`, which wraps.
 */
export function asNeededState(
  med: SchedulableMedicine,
  doses: LoggedDose[],
  date: string,
  nowMinutes: number
): AsNeededState {
  const today = doses.filter((d) => d.medicineId === med.id && d.date === date);
  const takenMinutes = today
    .map((d) => parseTimeToMinutes(d.takenAt))
    .filter((m): m is number => m !== null);
  const lastMin = takenMinutes.length > 0 ? Math.max(...takenMinutes) : null;
  const atDailyLimit = med.maxPerDay > 0 && today.length >= med.maxPerDay;
  const gapEnd = med.minIntervalMin > 0 && lastMin !== null ? lastMin + med.minIntervalMin : null;
  const blockedByGap = gapEnd !== null && nowMinutes < gapEnd;
  return {
    takenToday: today.length,
    nextAllowedMinutes: blockedByGap ? gapEnd : null,
    atDailyLimit,
    canTake: !atDailyLimit && !blockedByGap,
  };
}

/** Minutes-since-midnight → 'HH:MM', wrapping past midnight (1500 → '01:00'). */
export function formatMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
