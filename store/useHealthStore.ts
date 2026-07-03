/**
 * useHealthStore.ts — symptom / ailment health log
 *
 * Zustand store for dated health entries (ailment, 1-5 severity, notes). Simple
 * append/remove/update log surfaced on the health screen, ordered newest-first.
 * Real Phase 5/6 port (there was no Decision 015 stub — this store had no
 * prior existence in this repo).
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id
 *   Used by → app/health.tsx
 *   Data    → defines a Zustand store; owns SQLite table health_logs
 *
 * Edit notes:
 *   - DB column is log_date but the in-memory field is `date`; map both directions in load()/add()/update().
 *   - health_logs is dated history and is pruned past RETENTION_DAYS in lib/db.ts.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - add() returns the created log (not void) so app/health.tsx can seed its lifted edit
 *     state directly from the result, matching useTaskStore.add()'s pattern.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, updateRow, rowValues, readStr, readInt } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

export type HealthLog = {
  id: string;
  date: string; // YYYY-MM-DD
  ailment: string;
  severity: number; // 1-5
  notes: string;
};

type HealthStore = {
  logs: HealthLog[];
  load: () => void;
  add: (entry: Omit<HealthLog, 'id'>) => HealthLog;
  update: (id: string, patch: Partial<Omit<HealthLog, 'id'>>) => void;
  remove: (id: string) => void;
};

function rowToHealthLog(row: Row): HealthLog {
  return {
    id: readStr(row, 'id'),
    date: readStr(row, 'log_date'),
    ailment: readStr(row, 'ailment'),
    severity: readInt(row, 'severity', 3),
    notes: readStr(row, 'notes'),
  };
}

const HEALTH_LOG_FIELDS: FieldMap<HealthLog> = {
  date: { col: 'log_date' },
  ailment: { col: 'ailment' },
  severity: { col: 'severity' },
  notes: { col: 'notes' },
};

export const useHealthStore = create<HealthStore>((set) => ({
  logs: [],

  load() {
    set({ logs: loadAll('health_logs', rowToHealthLog, { orderBy: 'log_date DESC' }) });
  },

  add(entry) {
    const id = generateId();
    insertRow('health_logs', {
      id,
      log_date: entry.date,
      ailment: entry.ailment,
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
}));
