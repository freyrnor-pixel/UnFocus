/**
 * energyDayState.ts — what already happened between the user and today's energy pause.
 *
 * One `app_meta` row per day holding three small facts: whether the pause sheet has already
 * offered itself (`autoShown`), whether the user said "I'm good" and switched the energy UI
 * off for the rest of the day (`paused`), and which single card they picked with "I'll
 * decide" (`pinnedTaskId`). That is the whole record — no counts, no timestamps, no history.
 *
 * **It is deliberately device-local and never synced.** A pause is a private moment, and a
 * pin is "this is the one thing I'm doing right now"; neither belongs on a partner's phone
 * in People/family mode. `app_meta` is not in lib/syncService.ts's `SyncTable` union and
 * must never be added to it (lib/__tests__/liveSync.test.ts guards that).
 *
 * **The app never looks back at any of this.** Nothing counts how often "I'm good" was
 * pressed, nothing adapts a default from it, and nothing summarises it. The row exists only
 * so the same day doesn't re-ask, and it is pruned with the rest of the dated history.
 *
 * Shares its storage layer with lib/viewSnapshot.ts — both build a lib/metaJson.ts accessor,
 * which owns the discipline that matters most here: every operation swallows its DB errors
 * and returns a safe default, because these reads run inside a render pass
 * (lib/useEnergyPause.ts) and must never throw a screen away. The two files used to be
 * structurally identical with a different payload type; only the payload differs now.
 *
 * Connections:
 *   Imports → lib/metaJson (the shared app_meta JSON accessor)
 *   Used by → store/useEnergyStore.ts, lib/__tests__/energyPause.test.ts
 *   Data    → SQLite `app_meta` rows keyed `energy:day:<YYYY-MM-DD>` (the same key-value
 *             table lib/viewSnapshot.ts and store/useCatalogStore.ts use). No new table.
 *
 * Edit notes:
 *   - **Do not add `app_meta` to lib/syncService.ts's `SyncTable`.** See above — two people
 *     on two phones would pause and pin each other's days.
 *   - A missing/corrupt row means DEFAULT_DAY_STATE: not shown yet, not paused, nothing
 *     pinned. Failing that way round is what makes a bad read harmless — the worst case is
 *     the sheet offering itself once more, never a day silently locked into a pause.
 *   - Never schedule anything from here. The pause is the opposite of a nudge, and
 *     lib/__tests__/energyPause.test.ts source-scans this file to keep that true.
 */
import { metaJson } from '@/lib/metaJson';

const KEY_PREFIX = 'energy:day:';

/** The three facts one day carries about its energy pause. Nothing else is ever stored. */
export type EnergyDayState = {
  /** The pause sheet has already offered itself today, so it doesn't re-open on every focus. */
  autoShown: boolean;
  /** "I'm good" — energy UI stays out of the way for the rest of the day. */
  paused: boolean;
  /** "I'll decide" — the one task the user picked, or null. */
  pinnedTaskId: string | null;
};

/** A day nothing has happened on yet. Also what any unreadable row degrades to. */
export const DEFAULT_DAY_STATE: EnergyDayState = {
  autoShown: false,
  paused: false,
  pinnedTaskId: null,
};

/** Coerce an untrusted parsed blob into a usable state. Total — never returns null. */
export function normalizeDayState(raw: unknown): EnergyDayState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_DAY_STATE;
  const obj = raw as Record<string, unknown>;
  return {
    autoShown: obj.autoShown === true,
    paused: obj.paused === true,
    pinnedTaskId: typeof obj.pinnedTaskId === 'string' && obj.pinnedTaskId ? obj.pinnedTaskId : null,
  };
}

/**
 * The `app_meta` rows this module owns. A corrupt blob degrades to DEFAULT_DAY_STATE rather
 * than crashing Home — see lib/metaJson.ts, which owns that discipline and the four
 * operations below (this file and lib/viewSnapshot.ts each wrote them out by hand until
 * 2026-08-12; this file's header already said it "mirrors lib/viewSnapshot.ts exactly").
 */
const store = metaJson<EnergyDayState>(KEY_PREFIX, normalizeDayState, DEFAULT_DAY_STATE, 'energyDayState');

/** Read one day's pause state, or DEFAULT_DAY_STATE when there is nothing (readable) stored. */
export function readDayState(date: string): EnergyDayState {
  return store.read(date);
}

/** Overwrite one day's pause state. */
export function writeDayState(date: string, state: EnergyDayState): void {
  store.write(date, state);
}

/**
 * Every stored day state, keyed by date — how store/useEnergyStore.ts hydrates its
 * in-memory mirror on boot so that `dayState(date)` can stay a synchronous map read, the
 * same shape as `overrides`. Returns `{}` on any failure.
 */
export function readAllDayStates(): Record<string, EnergyDayState> {
  return store.readAll();
}

/** Test/reset seam — drops one day's stored state. */
export function clearDayState(date: string): void {
  store.clear(date);
}
