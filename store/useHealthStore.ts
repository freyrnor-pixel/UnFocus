/**
 * useHealthStore.ts — symptom / ailment health log + symptom catalog
 *
 * Zustand store for dated health entries (symptom, 1-5 severity, notes) plus a
 * symptom catalog (predefined + custom, mirroring useCatalogStore/store_items).
 * Every log links to a stable symptom id so trend review groups by symptom rather
 * than drifting free text. Log is ordered newest-first.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/storeCrud (the guarded by-id update/delete —
 *             this store had no in-memory guard on update() until 2026-08-12), lib/id,
 *             lib/symptomSeed, lib/typeahead
 *             (byPrefixThenName — the suggestion ordering, shared with useCatalogStore),
 *             lib/episodes (EpisodeState +
 *             toEpisodeState — the ongoing-episode state column), lib/widgets/sync (scheduleWidgetSync
 *             — debounced widget/notification refresh on add/update/remove, so live widgets don't
 *             wait for foreground/background)
 *   Used by → app/(tabs)/health.tsx, app/health-form.tsx, app/health-log.tsx, app/health-detail.tsx,
 *             components/HealthIssuesPreviewList.tsx + components/HealthIssuesSheet.tsx
 *             (2026-08-11 — the "Health issues" drawer/popup, the Goals-shaped standing list)
 *   Data    → defines a Zustand store; owns SQLite tables health_logs and symptoms
 *
 * Edit notes:
 *   - DB column is log_date but the in-memory field is `date`; map both directions in load()/add()/update().
 *   - `date`/`startTime` are when the issue started; `endDate`/`endTime` are when it finished.
 *     Added for the dedicated health-form.tsx (Issue/Severity/When started/When finished/Note)
 *     that replaced the old inline "+" log button.
 *   - **`endDate === ''` is NOT "still ongoing" any more (2026-08-01).** It means only "no end
 *     recorded", which is also what a quick log with no duration writes. `episodeState` is the
 *     single source of truth for openness — ask `isOpen()`/`openEpisodes()` from lib/episodes.ts,
 *     never the end pair. Every pre-existing row migrated to 'point' regardless of its end date
 *     (lib/db.ts, 2026-08-01), deliberately: back-filling 'ongoing' from `end_date = ''` would
 *     have opened an episode for every headache ever logged. After the migration
 *     `episodeState === 'ongoing'` implies `endDate === ''`, but the converse is NOT true.
 *   - `reliefNote`/`reliefMedicineId` are written once, when an episode is closed, and are
 *     always optional. They are DISPLAYED and never interpreted — no correlation, no ranking,
 *     no "this usually helps". See lib/episodes.ts's header for the full limit.
 *   - `closeEpisode()` exists so the state and the end pair are written in ONE patch; never
 *     set `episodeState: 'closed'` from a screen without the end pair in the same call.
 *   - `ailment` stays the display name (free text); `symptomId` links to a `symptoms` row when the
 *     user picks/creates a catalog symptom. Legacy rows have symptomId = '' (null) — grouping falls
 *     back to the ailment string for those.
 *   - seedSymptoms() runs on every load() with stable ids ('sym_<name>') + INSERT OR IGNORE — safe to
 *     re-run; renaming a seed entry orphans old rows (mirrors useCatalogStore.seedCatalog()).
 *   - **`symptoms.tracked` (2026-08-11) is the standing "Health issues" list, and it is NOT the
 *     catalog.** The catalog is 36 seeded names that exist to power the typeahead; `tracked` is
 *     the subset the user has actually logged or added by hand. Read it, not `symptoms.length`,
 *     for anything a user would call "my issues". `setSymptomTracked(id, false)` is the ONLY
 *     removal gesture and it touches no `health_logs` row — untracking is a list edit, never a
 *     data loss, which is why the copy says "Stop tracking". There is deliberately no
 *     `removeSymptom`: a hard DELETE would be re-seeded on the next load() anyway (INSERT OR
 *     IGNORE with stable ids), the same trap store/useCatalogStore.ts solved with a tombstone.
 *   - suggest(query) is the health-log typeahead over the catalog (mirrors useCatalogStore.suggest()).
 *   - health_logs is dated history and is pruned past RETENTION_DAYS in lib/db.ts; symptoms is a config
 *     table and is left untouched by pruning.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - `medicineId` (2026-07-27) optionally attributes an entry to a `medicines` row — the
 *     symptom↔medicine correlation ("this ADHD med gives me stomach issues"). It is a plain
 *     nullable pointer with no FOREIGN KEY (SQLite can't ALTER one in); store/useMedicineStore.ts's
 *     remove() deliberately does NOT clear it, so deleting a medicine leaves the symptom entry
 *     intact and merely un-attributed in the UI — losing the symptom history would be worse
 *     than a dangling id. app/medicine-form.tsx sets it; app/health-form.tsx offers the picker.
 *   - add() returns the created log (not void) so app/health.tsx can seed its lifted edit state.
 *   - app/(tabs)/health.tsx's Quick log card also calls add()/ensureSymptom() directly (essentials-
 *     only instant entry: name + severity, dated today, no notes/times) alongside health-form.tsx's
 *     full multi-field usage.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, readStr, readInt } from '@/lib/dataAccess';
import { deleteById, replaceById, updateById, withoutId } from '@/lib/storeCrud';
import { generateId } from '@/lib/id';
import { byPrefixThenName } from '@/lib/typeahead';
import { currentCollationLocale } from '@/lib/collate';
import { SYMPTOM_SEED } from '@/lib/symptomSeed';
import { EpisodeState, closePatch, toEpisodeState } from '@/lib/episodes';
import { scheduleWidgetSync } from '@/lib/widgets/sync';

export type HealthLog = {
  id: string;
  date: string; // YYYY-MM-DD — when the issue started
  startTime: string; // HH:MM, optional — '' = no specific time recorded
  endDate: string; // YYYY-MM-DD, optional — '' = no end recorded (NOT "ongoing", see below)
  endTime: string; // HH:MM, optional
  ailment: string;
  symptomId: string; // links to a `symptoms` row; '' for legacy/free-text-only entries
  severity: number; // 1-5
  notes: string;
  /** Optional attribution to a `medicines` row (2026-07-27) — "possibly from this medicine".
   *  '' for every entry not tied to one, which is most of them. See app/medicine-form.tsx. */
  medicineId: string;
  /** Whether this entry is still happening (2026-08-01). THE source of truth — never derive
   *  openness from `endDate`. See lib/episodes.ts. */
  episodeState: EpisodeState;
  /** Free-text answer to "Did anything help?", asked once when an episode is closed.
   *  '' = not answered, which is the common case and fine. Displayed, never interpreted. */
  reliefNote: string;
  /** Optional pointer to the `medicines` row taken during the episode. '' for most entries.
   *  A dangling id (deleted medicine) is accepted, same as `medicineId`. */
  reliefMedicineId: string;
  /**
   * READ-ONLY. The `health_logs.created_at` column, which has carried a wall clock since
   * the original CREATE TABLE via its `datetime('now')` default but was never surfaced.
   * Exposed 2026-08-02 so the day log can place an entry whose `startTime` is blank —
   * which is most of them, since Quick log writes no time and the field is hand-typed.
   *
   * **It is UTC**, unlike every other date in this app. Read it through
   * lib/date.ts's `utcStampToLocalMinutes`, never directly.
   *
   * Deliberately absent from HEALTH_LOG_FIELDS: the SQLite default owns this column, so
   * nothing here can overwrite it, and no new timestamp about being unwell is being
   * stored (see EPISODES.md — "storing 'I asked at 14:02' is a timestamp about being
   * unwell"). This surfaces one that already existed; it does not create one.
   */
  createdAt: string;
};

export type Symptom = {
  id: string;
  name: string;
  category: string;
  /**
   * Is this one of "the things you keep an eye on" (2026-08-11)? The `symptoms` table is
   * mostly seed vocabulary — 36 names from lib/symptomSeed.ts that exist to power the
   * typeahead — so it is NOT the list a user would recognise as theirs. This flag is.
   *
   * Set on first log (via `ensureSymptom`, which every log path goes through) or by hand in
   * components/HealthIssuesSheet.tsx. Cleared by untracking there, which **deletes nothing** —
   * every `health_logs` row survives and stays readable in /health-log and on the symptom's
   * own page. See the migration in lib/db.ts for why that asymmetry is deliberate.
   */
  tracked: boolean;
};

type HealthStore = {
  logs: HealthLog[];
  symptoms: Symptom[];
  load: () => void;
  /** `createdAt` is excluded because SQLite's `datetime('now')` default owns it — see the type. */
  add: (entry: Omit<HealthLog, 'id' | 'createdAt'>) => HealthLog;
  update: (id: string, patch: Partial<Omit<HealthLog, 'id'>>) => void;
  remove: (id: string) => void;
  /** Typeahead over the symptom catalog (name-contains, prefix-ranked). */
  suggest: (query: string, limit?: number) => Symptom[];
  /**
   * Find or create a catalog symptom by name; returns the row (id reusable for a log).
   *
   * Marks it `tracked` by default — creating or naming a symptom is the act that puts it on
   * "the things you keep an eye on". Pass `track: false` for a lookup that must not change
   * the standing list (nothing does today; the parameter exists so a future typeahead-only
   * caller can't quietly add rows to the drawer just by resolving a name).
   */
  ensureSymptom: (name: string, category?: string, track?: boolean) => Symptom;
  /**
   * Add/remove a symptom from the standing "Health issues" list. Never touches `health_logs`
   * — see the `tracked` field's doc and the migration in lib/db.ts.
   */
  setSymptomTracked: (id: string, tracked: boolean) => void;
  /** All logs for a symptom (by id when present, else by matching ailment name), newest-first. */
  logsForSymptom: (symptomId: string, ailment: string) => HealthLog[];
  /** add() forced to an open episode — no end pair, whatever the caller passed. */
  startEpisode: (entry: Omit<HealthLog, 'id' | 'episodeState' | 'endDate' | 'endTime'>) => HealthLog;
  /** Closes an open episode in ONE update: state + end pair (+ optional relief) together, so
   *  no intermediate row exists that is closed without an end, or ended without being closed. */
  closeEpisode: (
    id: string,
    input: { stop: { date: string; time: string }; reliefNote?: string; reliefMedicineId?: string }
  ) => void;
};

function rowToHealthLog(row: Row): HealthLog {
  return {
    id: readStr(row, 'id'),
    date: readStr(row, 'log_date'),
    startTime: readStr(row, 'start_time'),
    endDate: readStr(row, 'end_date'),
    endTime: readStr(row, 'end_time'),
    ailment: readStr(row, 'ailment'),
    symptomId: readStr(row, 'symptom_id'),
    severity: readInt(row, 'severity', 3),
    notes: readStr(row, 'notes'),
    medicineId: readStr(row, 'medicine_id'),
    // Normalised, so an unknown/legacy value degrades to 'point' rather than rendering an
    // empty status — and never to 'ongoing'.
    episodeState: toEpisodeState(readStr(row, 'episode_state')),
    reliefNote: readStr(row, 'relief_note'),
    reliefMedicineId: readStr(row, 'relief_medicine_id'),
    // Read-only — see the type. No matching HEALTH_LOG_FIELDS entry, on purpose.
    createdAt: readStr(row, 'created_at'),
  };
}

function rowToSymptom(row: Row): Symptom {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    category: readStr(row, 'category') || 'other',
    tracked: readInt(row, 'tracked', 0) === 1,
  };
}

const HEALTH_LOG_FIELDS: FieldMap<HealthLog> = {
  date: { col: 'log_date' },
  startTime: { col: 'start_time' },
  endDate: { col: 'end_date' },
  endTime: { col: 'end_time' },
  ailment: { col: 'ailment' },
  symptomId: { col: 'symptom_id' },
  severity: { col: 'severity' },
  notes: { col: 'notes' },
  medicineId: { col: 'medicine_id', to: (v) => v || null },
  episodeState: { col: 'episode_state' },
  reliefNote: { col: 'relief_note' },
  reliefMedicineId: { col: 'relief_medicine_id', to: (v) => v || null },
};

/** Stable id derived from name so seeding is safe to run on every load. */
function symptomId(name: string): string {
  return 'sym_' + name.toLowerCase().replace(/\s+/g, '_');
}

function seedSymptoms(): void {
  for (const s of SYMPTOM_SEED) {
    try {
      db.runSync(
        `INSERT OR IGNORE INTO symptoms (id, name, category) VALUES (?, ?, ?)`,
        [symptomId(s.name), s.name, s.category]
      );
    } catch (err) {
      console.error(`Failed to seed symptom ${s.name}:`, err);
    }
  }
}

export const useHealthStore = create<HealthStore>((set, get) => ({
  logs: [],
  symptoms: [],

  load() {
    seedSymptoms();
    set({
      logs: loadAll('health_logs', rowToHealthLog, { orderBy: 'log_date DESC' }),
      symptoms: loadAll('symptoms', rowToSymptom, { orderBy: 'name' }),
    });
  },

  add(entry) {
    const id = generateId();
    insertRow('health_logs', {
      id,
      log_date: entry.date,
      start_time: entry.startTime,
      end_date: entry.endDate,
      end_time: entry.endTime,
      ailment: entry.ailment,
      symptom_id: entry.symptomId || null,
      severity: entry.severity,
      notes: entry.notes,
      medicine_id: entry.medicineId || null,
      episode_state: entry.episodeState || 'point',
      relief_note: entry.reliefNote,
      relief_medicine_id: entry.reliefMedicineId || null,
    });
    // The row's own created_at came from SQLite's `datetime('now')` default (UTC). Mirror
    // the same instant into the in-memory copy so the day log can place a just-added entry
    // without a reload — ISO and `YYYY-MM-DD HH:MM:SS` are both UTC and both parse in
    // lib/date.ts's utcStampToLocalMinutes, so the two forms are interchangeable here.
    const log: HealthLog = { ...entry, id, createdAt: new Date().toISOString() };
    set((s) => ({ logs: [log, ...s.logs] }));
    scheduleWidgetSync();
    return log;
  },

  update(id, patch) {
    const next = updateById('health_logs', HEALTH_LOG_FIELDS, get().logs, id, patch);
    if (!next) return;
    set((s) => ({ logs: replaceById(s.logs, next) }));
    scheduleWidgetSync();
  },

  remove(id) {
    if (!deleteById('health_logs', get().logs, id)) return;
    set((s) => ({ logs: withoutId(s.logs, id) }));
    scheduleWidgetSync();
  },

  suggest(query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = get().symptoms.filter((s) => s.name.toLowerCase().includes(q));
    matches.sort(byPrefixThenName(q, currentCollationLocale()));
    return matches.slice(0, limit);
  },

  ensureSymptom(name, category = 'other', track = true) {
    const trimmed = name.trim();
    const existing = get().symptoms.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      // A seeded symptom's first log is what promotes it out of the typeahead vocabulary and
      // onto the standing list. Only ever set — this never untracks something.
      if (track && !existing.tracked) get().setSymptomTracked(existing.id, true);
      return track ? { ...existing, tracked: true } : existing;
    }
    const id = symptomId(trimmed);
    // Stable id may already exist even if not in memory (seed) — INSERT OR IGNORE, then adopt it.
    try {
      db.runSync('INSERT OR IGNORE INTO symptoms (id, name, category, tracked) VALUES (?, ?, ?, ?)', [
        id,
        trimmed,
        category,
        track ? 1 : 0,
      ]);
      // INSERT OR IGNORE is a no-op when the stable id is already in the table but was not in
      // memory, which would silently drop the tracking. The UPDATE is what makes this path
      // idempotent either way.
      if (track) db.runSync('UPDATE symptoms SET tracked = 1 WHERE id = ?', [id]);
    } catch (err) {
      console.error(`Failed to create symptom ${trimmed}:`, err);
    }
    const created: Symptom = { id, name: trimmed, category, tracked: track };
    set((s) =>
      s.symptoms.some((x) => x.id === id)
        ? s
        : { symptoms: [...s.symptoms, created].sort((a, b) => a.name.localeCompare(b.name, currentCollationLocale())) }
    );
    return created;
  },

  setSymptomTracked(id, tracked) {
    try {
      db.runSync('UPDATE symptoms SET tracked = ? WHERE id = ?', [tracked ? 1 : 0, id]);
    } catch (err) {
      console.error(`Failed to set tracked on symptom ${id}:`, err);
    }
    set((s) => ({ symptoms: s.symptoms.map((x) => (x.id === id ? { ...x, tracked } : x)) }));
  },

  logsForSymptom(symptomId, ailment) {
    const a = ailment.trim().toLowerCase();
    return get().logs.filter((l) =>
      symptomId ? l.symptomId === symptomId : l.ailment.trim().toLowerCase() === a
    );
  },

  startEpisode(entry) {
    return get().add({ ...entry, episodeState: 'ongoing', endDate: '', endTime: '' });
  },

  closeEpisode(id, input) {
    // One patch, built by lib/episodes.ts so the state and the end pair can never be
    // written apart. Goes through update(), so the widget sync fires as usual.
    get().update(id, closePatch(input));
  },
}));
