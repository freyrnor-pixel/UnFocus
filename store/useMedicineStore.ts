/**
 * useMedicineStore.ts — medicines (tray schedule) + the log of doses actually taken
 *
 * Zustand store behind the Health tab's medicine card. A medicine belongs to zero or
 * more **trays** (morning/midday/evening/night — a window, not a clock time; see
 * lib/medicineSchedule.ts for why) or is **as-needed**, in which case it belongs to no
 * tray and is governed by a minimum interval / per-day cap instead. Reminders are
 * per-tray, not per-medicine, and are re-synced from here on every mutation.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/date (todayStr + current HH:MM),
 *             lib/medicineSchedule (TrayId/tray helpers), lib/medicineNotifications
 *             (syncTrayReminders), store/useSettingsStore (reminder + People-mode settings),
 *             lib/widgets/sync (scheduleWidgetSync — same debounced refresh every other
 *             mutating store calls)
 *   Used by → app/_layout.tsx (boot load + reminder re-arm + notification "Taken" action),
 *             app/(tabs)/health.tsx (via components/MedicineTrayCard.tsx),
 *             components/MedicineTrayCard.tsx, app/medicine-form.tsx, app/settings.tsx
 *             (re-syncs reminders when tray times / the master switch / language change)
 *   Data    → defines a Zustand store; owns SQLite tables medicines and medicine_doses;
 *             schedules the four per-tray daily notifications
 *
 * Edit notes:
 *   - DB column is log_date but the in-memory field is `date` (same convention as
 *     useHealthStore) — map both directions in load()/logDose().
 *   - **A scheduled dose's identity is (medicineId, date, tray)**: `takeDose` is an UPSERT
 *     on that triple, so a double-tap (or tapping Taken in the app after already tapping it
 *     on the notification) can never double-log. As-needed doses use tray '' and ARE
 *     repeatable — every one appends a row, which is what makes the interval guard work.
 *   - load() fetches the last DOSE_WINDOW_DAYS of doses, not full history (mirrors
 *     useHabitStore's 35-day log window). Anything needing more reads the table directly.
 *   - `takeTray()` exists for the notification action: it logs every not-yet-taken medicine
 *     in that tray for every person at once, which is what "Taken" on a tray notification
 *     means. In-app taps go through `takeDose` per medicine.
 *   - Reminders are re-synced from `syncTrayReminders()` after every mutation. It reads
 *     settings via getState() at call time (never a captured value) so a tray-time change
 *     made in Settings takes effect on the next mutation without a reload.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - **Deliberately NOT exposed to the AI setup guide** (lib/aiSetupGuide.ts): medicine
 *     names and doses are the most sensitive rows in the database, and the guide already
 *     refuses health-log data. Don't add a medicine domain to it.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import {
  Row,
  FieldMap,
  loadAll,
  insertRow,
  updateRow,
  rowValues,
  readStr,
  readInt,
  readBool,
  readJson,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { dateStr, todayStr } from '@/lib/date';
import { TrayId, toTrayIds, isDoseTaken, medicinesForTray } from '@/lib/medicineSchedule';
import { syncTrayReminders } from '@/lib/medicineNotifications';
import { useSettingsStore } from '@/store/useSettingsStore';
import { scheduleWidgetSync } from '@/lib/widgets/sync';

/** How much dose history load() pulls into memory (the card's week strip needs ~7). */
export const DOSE_WINDOW_DAYS = 60;

export type Medicine = {
  id: string;
  name: string;
  /** Free text, e.g. "30 mg", "2 tablets" — never parsed, only displayed. */
  dose: string;
  /** Trays this medicine sits in. Always empty when asNeeded. */
  trays: TrayId[];
  /** As-needed (PRN): no tray, no reminder, guarded by minIntervalMin/maxPerDay instead. */
  asNeeded: boolean;
  minIntervalMin: number;
  maxPerDay: number;
  /** People/family mode: '' = me, otherwise a childProfiles entry. */
  childName: string;
  notes: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

export type MedicineDose = {
  id: string;
  medicineId: string;
  date: string;
  /** A TrayId for a scheduled dose, '' for an as-needed one. */
  tray: string;
  /** HH:MM the dose was taken. */
  takenAt: string;
  note: string;
};

type MedicineStore = {
  medicines: Medicine[];
  doses: MedicineDose[];
  load: () => void;
  add: (entry: Partial<Omit<Medicine, 'id'>> & { name: string }) => Medicine;
  update: (id: string, patch: Partial<Omit<Medicine, 'id'>>) => void;
  remove: (id: string) => void;
  /** Log a dose. Scheduled doses (a real tray) upsert; as-needed doses append. */
  takeDose: (medicineId: string, tray: TrayId | '', date?: string, note?: string) => void;
  /** Un-log a dose — the undo for a mis-tap, not a "skip". */
  untakeDose: (medicineId: string, tray: TrayId | '', date?: string) => void;
  /** Log every not-yet-taken medicine in a tray (the notification's "Taken" button). */
  takeTray: (tray: TrayId, date?: string) => void;
  /** (Re)schedule the four per-tray daily reminders from current medicines + settings. */
  syncTrayReminders: () => void;
};

function rowToMedicine(row: Row): Medicine {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    dose: readStr(row, 'dose'),
    trays: toTrayIds(readJson<unknown>(row, 'trays', [])),
    asNeeded: readBool(row, 'as_needed'),
    minIntervalMin: readInt(row, 'min_interval_min'),
    maxPerDay: readInt(row, 'max_per_day'),
    childName: readStr(row, 'child_name'),
    notes: readStr(row, 'notes'),
    active: row.active == null ? true : readBool(row, 'active'),
    sortOrder: readInt(row, 'sort_order'),
    createdAt: readStr(row, 'created_at'),
  };
}

function rowToDose(row: Row): MedicineDose {
  return {
    id: readStr(row, 'id'),
    medicineId: readStr(row, 'medicine_id'),
    date: readStr(row, 'log_date'),
    tray: readStr(row, 'tray'),
    takenAt: readStr(row, 'taken_at'),
    note: readStr(row, 'note'),
  };
}

const MEDICINE_FIELDS: FieldMap<Medicine> = {
  name: { col: 'name' },
  dose: { col: 'dose' },
  trays: { col: 'trays', to: (v) => JSON.stringify(v ?? []) },
  asNeeded: { col: 'as_needed', to: (v) => (v ? 1 : 0) },
  minIntervalMin: { col: 'min_interval_min', to: (v) => v ?? 0 },
  maxPerDay: { col: 'max_per_day', to: (v) => v ?? 0 },
  childName: { col: 'child_name' },
  notes: { col: 'notes' },
  active: { col: 'active', to: (v) => (v ? 1 : 0) },
  sortOrder: { col: 'sort_order', to: (v) => v ?? 0 },
};

/** Current wall-clock time as HH:MM — when a dose was taken. */
function nowHHMM(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The settings slice the tray reminders need, read fresh at call time. */
function reminderSettings() {
  const s = useSettingsStore.getState();
  return {
    featureMedicine: s.featureMedicine,
    medicineRemindersEnabled: s.medicineRemindersEnabled,
    medicineTrayTimes: s.medicineTrayTimes,
    language: s.language,
    quietHoursEnabled: s.quietHoursEnabled,
    quietHoursStart: s.quietHoursStart,
    quietHoursEnd: s.quietHoursEnd,
  };
}

export const useMedicineStore = create<MedicineStore>((set, get) => ({
  medicines: [],
  doses: [],

  load() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DOSE_WINDOW_DAYS);
    set({
      medicines: loadAll('medicines', rowToMedicine, { orderBy: 'sort_order, created_at' }),
      doses: loadAll('medicine_doses', rowToDose, {
        where: 'log_date >= ?',
        params: [dateStr(cutoff)],
        orderBy: 'log_date DESC, taken_at DESC',
      }),
    });
    get().syncTrayReminders();
  },

  add(entry) {
    const id = generateId();
    const asNeeded = entry.asNeeded ?? false;
    const med: Medicine = {
      id,
      name: entry.name.trim(),
      dose: entry.dose ?? '',
      // An as-needed medicine has no tray by definition — enforced here so a form
      // that flips the switch after picking trays can't persist a contradiction.
      trays: asNeeded ? [] : (entry.trays ?? []),
      asNeeded,
      minIntervalMin: entry.minIntervalMin ?? 0,
      maxPerDay: entry.maxPerDay ?? 0,
      childName: entry.childName ?? '',
      notes: entry.notes ?? '',
      active: entry.active ?? true,
      sortOrder: entry.sortOrder ?? get().medicines.length,
      createdAt: new Date().toISOString(),
    };
    insertRow('medicines', {
      id,
      created_at: med.createdAt,
      ...rowValues(med, MEDICINE_FIELDS),
    });
    set((s) => ({ medicines: [...s.medicines, med] }));
    get().syncTrayReminders();
    scheduleWidgetSync();
    return med;
  },

  update(id, patch) {
    // Same invariant as add(): switching a medicine to as-needed clears its trays.
    const effective = patch.asNeeded === true ? { ...patch, trays: [] as TrayId[] } : patch;
    updateRow('medicines', rowValues(effective, MEDICINE_FIELDS), 'id = ?', [id]);
    set((s) => ({ medicines: s.medicines.map((m) => (m.id === id ? { ...m, ...effective } : m)) }));
    get().syncTrayReminders();
    scheduleWidgetSync();
  },

  remove(id) {
    // No FOREIGN KEY on medicine_doses.medicine_id (SQLite can't ALTER one in), so the
    // dose rows are cleaned up here — same application-enforced cascade as
    // useTaskStore's follows_task_id.
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM medicine_doses WHERE medicine_id = ?', [id]);
      db.runSync('DELETE FROM medicines WHERE id = ?', [id]);
    });
    set((s) => ({
      medicines: s.medicines.filter((m) => m.id !== id),
      doses: s.doses.filter((d) => d.medicineId !== id),
    }));
    get().syncTrayReminders();
    scheduleWidgetSync();
  },

  takeDose(medicineId, tray, date = todayStr(), note = '') {
    // Scheduled doses are unique per (medicine, date, tray) — a repeat tap is a no-op
    // rather than a second row. As-needed doses fall through and append every time.
    if (tray !== '' && isDoseTaken(get().doses, medicineId, tray, date)) return;
    const id = generateId();
    const dose: MedicineDose = { id, medicineId, date, tray, takenAt: nowHHMM(), note };
    insertRow('medicine_doses', {
      id,
      medicine_id: medicineId,
      log_date: date,
      tray,
      taken_at: dose.takenAt,
      note,
    });
    set((s) => ({ doses: [dose, ...s.doses] }));
    scheduleWidgetSync();
  },

  untakeDose(medicineId, tray, date = todayStr()) {
    // For an as-needed medicine (tray ''), drop only the most recent dose of that day —
    // undoing one mis-tap, not the whole day's history.
    const match = get().doses
      .filter((d) => d.medicineId === medicineId && d.date === date && d.tray === tray)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
    if (!match) return;
    db.runSync('DELETE FROM medicine_doses WHERE id = ?', [match.id]);
    set((s) => ({ doses: s.doses.filter((d) => d.id !== match.id) }));
    scheduleWidgetSync();
  },

  takeTray(tray, date = todayStr()) {
    // Every person's medicine in that tray — a tray notification covers the whole window.
    for (const med of medicinesForTray(get().medicines, tray)) {
      get().takeDose(med.id, tray, date);
    }
  },

  syncTrayReminders() {
    syncTrayReminders(get().medicines, reminderSettings());
  },
}));
