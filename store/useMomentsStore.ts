/**
 * useMomentsStore.ts — manually captured "what just happened" lines for the day log.
 *
 * The one thing in the day log the user writes themselves. Everything else on that
 * surface is DERIVED from something they already did — a task ticked, a dose taken, a
 * symptom logged (see lib/dayLog.ts). A moment exists for the rest: the steps between the
 * big things, the ones that vanish out of a chaotic stretch precisely because they felt
 * significant at the time.
 *
 * Connections:
 *   Imports → lib/dataAccess, lib/storeCrud (the guarded by-id delete — the DELETE this
 *             store used to run through the raw db handle), lib/id, lib/date (todayStr, nowHHMM)
 *   Used by → lib/useDayLog.ts (reads `moments` for the day log), components/PlanTaskCard.tsx
 *             (captures via the pad type-line; deletes via a row long-press),
 *             app/day-log.tsx (earlier days)
 *   Data    → defines a Zustand store; owns SQLite table `moments`
 *
 * Edit notes:
 *   - **Capture must stay free.** One field, one submit — no category, no required field,
 *     no confirmation dialog, no edit flow on creation. `add(text)` takes a string and
 *     nothing else, and that signature is the guardrail: a second required argument is how
 *     this quietly becomes a form. The caller stamps nothing; the day and time are read
 *     here, at the moment of the write, because a moment IS its timestamp.
 *   - **Deliberately NOT a SyncTable.** These are private notes-to-self about a personal
 *     day. Adding `moments` to lib/liveSync's SyncTable would push them to a paired
 *     household device, which is not what "what just happened" means. Deleting is
 *     therefore a hard DELETE, not the tombstone shape tasks/shopping_items use — there is
 *     no peer that needs to learn the row is gone.
 *   - **Delete is the only mutation after creation.** There is no update(): a log you can
 *     edit after the fact is not evidence. The handoff's out-of-scope list allows deleting
 *     a moment and nothing else, and that is the whole surface area here.
 *   - No widget sync. Moments are not on any widget, and scheduleWidgetSync() on every
 *     capture would rebuild five widget snapshots to change nothing.
 *   - Ordering is `log_date, at_time` — chronological, oldest first, matching the day log's
 *     own order. There is no manual sort_order and there must not be one: the log is
 *     ordered by the clock, so it is deliberately not drag-reorderable
 *     (lib/useDragReorder.ts's "a list gets a manual order only if it has no natural one").
 */
import { create } from 'zustand';
import { Row, FieldMap, loadAll, insertRow, rowValues, readStr } from '@/lib/dataAccess';
import { deleteById, withoutId } from '@/lib/storeCrud';
import { generateId } from '@/lib/id';
import { nowHHMM, todayStr } from '@/lib/date';

export type Moment = {
  id: string;
  /** Local 'YYYY-MM-DD' — the day key every dated table in this schema uses. */
  logDate: string;
  /** Local 'HH:MM' the line was captured. Same shape as medicine_doses.taken_at. */
  atTime: string;
  text: string;
};

type MomentsStore = {
  moments: Moment[];
  loaded: boolean;
  load: () => void;
  /** Capture a line. Trims; a blank submit is a no-op and returns null. */
  add: (text: string) => Moment | null;
  /** Hard delete — see the store header for why there's no tombstone. */
  remove: (id: string) => void;
};

function rowToMoment(row: Row): Moment {
  return {
    id: readStr(row, 'id'),
    logDate: readStr(row, 'log_date'),
    atTime: readStr(row, 'at_time'),
    text: readStr(row, 'text'),
  };
}

const MOMENT_COLUMNS: FieldMap<Moment> = {
  id: { col: 'id' },
  logDate: { col: 'log_date' },
  atTime: { col: 'at_time' },
  text: { col: 'text' },
};

export const useMomentsStore = create<MomentsStore>((set, get) => ({
  moments: [],
  loaded: false,

  load() {
    set({
      moments: loadAll('moments', rowToMoment, { orderBy: 'log_date, at_time' }),
      loaded: true,
    });
  },

  add(text) {
    const trimmed = text.trim();
    // A blank submit is how the pad type-line behaves when it blurs empty — silently
    // ignore it rather than writing an empty line into the record.
    if (!trimmed) return null;
    const moment: Moment = {
      id: generateId(),
      logDate: todayStr(),
      atTime: nowHHMM(),
      text: trimmed,
    };
    insertRow('moments', rowValues(moment, MOMENT_COLUMNS));
    set((s) => ({ moments: [...s.moments, moment] }));
    return moment;
  },

  remove(id) {
    if (!deleteById('moments', get().moments, id)) return;
    set((s) => ({ moments: withoutId(s.moments, id) }));
  },
}));
