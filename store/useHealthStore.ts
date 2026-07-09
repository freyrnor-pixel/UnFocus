/**
 * useHealthStore.ts — symptom / ailment health log + symptom catalog
 *
 * Zustand store for dated health entries (symptom, 1-5 severity, notes) plus a
 * symptom catalog (predefined + custom, mirroring useCatalogStore/store_items).
 * Every log links to a stable symptom id so trend review groups by symptom rather
 * than drifting free text. Log is ordered newest-first.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/symptomSeed
 *   Used by → app/(tabs)/health.tsx, app/health-form.tsx, app/health-log.tsx, app/health-detail.tsx
 *   Data    → defines a Zustand store; owns SQLite tables health_logs and symptoms
 *
 * Edit notes:
 *   - DB column is log_date but the in-memory field is `date`; map both directions in load()/add()/update().
 *   - `date`/`startTime` are when the issue started; `endDate`/`endTime` are when it finished
 *     (`endDate === ''` means still ongoing). Added for the dedicated health-form.tsx (Issue/
 *     Severity/When started/When finished/Note) that replaced the old inline "+" log button.
 *   - `ailment` stays the display name (free text); `symptomId` links to a `symptoms` row when the
 *     user picks/creates a catalog symptom. Legacy rows have symptomId = '' (null) — grouping falls
 *     back to the ailment string for those.
 *   - seedSymptoms() runs on every load() with stable ids ('sym_<name>') + INSERT OR IGNORE — safe to
 *     re-run; renaming a seed entry orphans old rows (mirrors useCatalogStore.seedCatalog()).
 *   - suggest(query) is the health-log typeahead over the catalog (mirrors useCatalogStore.suggest()).
 *   - health_logs is dated history and is pruned past RETENTION_DAYS in lib/db.ts; symptoms is a config
 *     table and is left untouched by pruning.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - add() returns the created log (not void) so app/health.tsx can seed its lifted edit state.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, updateRow, rowValues, readStr, readInt } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { SYMPTOM_SEED } from '@/lib/symptomSeed';

export type HealthLog = {
  id: string;
  date: string; // YYYY-MM-DD — when the issue started
  startTime: string; // HH:MM, optional — '' = no specific time recorded
  endDate: string; // YYYY-MM-DD, optional — '' = still ongoing
  endTime: string; // HH:MM, optional
  ailment: string;
  symptomId: string; // links to a `symptoms` row; '' for legacy/free-text-only entries
  severity: number; // 1-5
  notes: string;
};

export type Symptom = {
  id: string;
  name: string;
  category: string;
};

type HealthStore = {
  logs: HealthLog[];
  symptoms: Symptom[];
  load: () => void;
  add: (entry: Omit<HealthLog, 'id'>) => HealthLog;
  update: (id: string, patch: Partial<Omit<HealthLog, 'id'>>) => void;
  remove: (id: string) => void;
  /** Typeahead over the symptom catalog (name-contains, prefix-ranked). */
  suggest: (query: string, limit?: number) => Symptom[];
  /** Find or create a catalog symptom by name; returns the row (id reusable for a log). */
  ensureSymptom: (name: string, category?: string) => Symptom;
  /** All logs for a symptom (by id when present, else by matching ailment name), newest-first. */
  logsForSymptom: (symptomId: string, ailment: string) => HealthLog[];
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
  };
}

function rowToSymptom(row: Row): Symptom {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    category: readStr(row, 'category') || 'other',
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
    });
    const log = { ...entry, id };
    set((s) => ({ logs: [log, ...s.logs] }));
    return log;
  },

  update(id, patch) {
    updateRow('health_logs', rowValues(patch, HEALTH_LOG_FIELDS), 'id = ?', [id]);
    set((s) => ({ logs: s.logs.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  },

  remove(id) {
    db.runSync('DELETE FROM health_logs WHERE id = ?', [id]);
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
  },

  suggest(query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = get().symptoms.filter((s) => s.name.toLowerCase().includes(q));
    matches.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name, 'no');
    });
    return matches.slice(0, limit);
  },

  ensureSymptom(name, category = 'other') {
    const trimmed = name.trim();
    const existing = get().symptoms.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const id = symptomId(trimmed);
    // Stable id may already exist even if not in memory (seed) — INSERT OR IGNORE, then adopt it.
    try {
      db.runSync('INSERT OR IGNORE INTO symptoms (id, name, category) VALUES (?, ?, ?)', [id, trimmed, category]);
    } catch (err) {
      console.error(`Failed to create symptom ${trimmed}:`, err);
    }
    const created: Symptom = { id, name: trimmed, category };
    set((s) =>
      s.symptoms.some((x) => x.id === id)
        ? s
        : { symptoms: [...s.symptoms, created].sort((a, b) => a.name.localeCompare(b.name, 'no')) }
    );
    return created;
  },

  logsForSymptom(symptomId, ailment) {
    const a = ailment.trim().toLowerCase();
    return get().logs.filter((l) =>
      symptomId ? l.symptomId === symptomId : l.ailment.trim().toLowerCase() === a
    );
  },
}));
