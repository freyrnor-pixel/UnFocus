/**
 * useGoalStore.ts — user Goals that tasks and habits can be connected to.
 *
 * A Goal is deliberately light: a name plus a "living glow" strength (lib/goalStrength.ts).
 * There is no dedicated Goals screen — goals are created, selected, renamed and deleted
 * entirely from the picker embedded in the task form and habit form (components/GoalPicker.tsx).
 * Completing a linked task (useTaskStore) or logging a linked habit (useHabitStore) calls
 * registerProgress(), which nudges that goal's strength up; the strength decays back to a
 * neutral baseline over time (computed lazily on read — see lib/goalStrength.ts).
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/goalStrength
 *   Used by → store/useTaskStore.ts + store/useHabitStore.ts (registerProgress on progress;
 *             they carry a nullable goalId column), components/GoalPicker.tsx (CRUD + select),
 *             components/GoalGlowDot.tsx (glow badge on linked cards), app/_layout.tsx (boot load)
 *   Data    → defines a Zustand store; owns SQLite table `goals`
 *
 * Edit notes:
 *   - One goal per task/habit: the link is a nullable `goal_id` pointer column on `tasks`
 *     and `habits` (app-enforced, like `tasks.follows_task_id` — SQLite can't ALTER TABLE
 *     to add a real FK). remove() nulls both columns in the SAME transaction as the delete,
 *     then clears the id in the task/habit stores' in-memory state (getState().clearGoal).
 *   - `strength`/`strengthUpdatedAt` are the RAW stored pair; effective strength shown
 *     anywhere is decayedStrength(strength, strengthUpdatedAt, Date.now()). Only positive
 *     events (registerProgress) persist a new value — un-completing does nothing (no
 *     punishment; decay handles the fade). See lib/goalStrength.ts.
 *   - `color` is auto-assigned from GOAL_PALETTE at creation (no user picker — goals are
 *     "name only" to author) purely so multiple goals' glows are visually distinguishable.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, updateRow, rowValues, readStr, readReal, tx } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { bumpedStrength } from '@/lib/goalStrength';
// Cross-store link cleanup only (used inside remove(), never at module-eval time). These stores
// import THIS one at top-level for registerProgress; the cycle is safe because every use here is
// call-time, so the live ESM bindings are resolved by the time remove() runs.
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';

/** Distinct glow hues auto-rotated across goals so multiple goals read apart at a glance. */
export const GOAL_PALETTE = ['#6C8CFF', '#57C4A5', '#E8A13A', '#E06C9F', '#9B7BE0', '#4FB0E0'];

export type Goal = {
  id: string;
  title: string;
  /** Auto-assigned glow hue (hex). Not user-editable. */
  color: string;
  /** Raw strength in [0, 1]; effective value is decayed from strengthUpdatedAt (lib/goalStrength.ts). */
  strength: number;
  /** ISO timestamp of the last strength change, for lazy decay. Null before any progress. */
  strengthUpdatedAt: string | null;
  createdAt: string;
};

type GoalStore = {
  goals: Goal[];
  load: () => void;
  /** Create a goal by name; auto-assigns a palette colour and returns it (for immediate select). */
  add: (title: string) => Goal;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  /** Nudge a goal's strength up (a linked task/habit was worked); decays-then-adds, clamped. */
  registerProgress: (goalId: string) => void;
};

function rowToGoal(row: Row): Goal {
  return {
    id: readStr(row, 'id'),
    title: readStr(row, 'title'),
    color: readStr(row, 'color') || GOAL_PALETTE[0],
    strength: readReal(row, 'strength'),
    strengthUpdatedAt: readStr(row, 'strength_updated_at') || null,
    createdAt: readStr(row, 'created_at'),
  };
}

const GOAL_COLUMNS: FieldMap<Goal> = {
  id: { col: 'id' },
  title: { col: 'title' },
  color: { col: 'color' },
  strength: { col: 'strength', to: (v) => v ?? 0 },
  strengthUpdatedAt: { col: 'strength_updated_at', to: (v) => v ?? null },
  createdAt: { col: 'created_at' },
};

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],

  load() {
    set({ goals: loadAll('goals', rowToGoal, { orderBy: 'created_at' }) });
  },

  add(title) {
    const goal: Goal = {
      id: generateId(),
      title: title.trim(),
      color: GOAL_PALETTE[get().goals.length % GOAL_PALETTE.length],
      strength: 0,
      strengthUpdatedAt: null,
      createdAt: new Date().toISOString(),
    };
    insertRow('goals', rowValues(goal, GOAL_COLUMNS));
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  rename(id, title) {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    const next = { ...goal, title: title.trim() };
    updateRow('goals', { title: next.title }, 'id = ?', [id]);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? next : g)) }));
  },

  remove(id) {
    tx(() => {
      db.runSync('DELETE FROM goals WHERE id = ?', [id]);
      // App-enforced ON DELETE SET NULL: any task/habit that pointed at this goal is unlinked
      // (SQLite can't add a real FK via ALTER TABLE — see lib/db.ts's header).
      db.runSync('UPDATE tasks SET goal_id = NULL WHERE goal_id = ?', [id]);
      db.runSync('UPDATE habits SET goal_id = NULL WHERE goal_id = ?', [id]);
    });
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    // Clear the now-dangling id from the task/habit stores' in-memory state (the DB columns
    // were nulled in the tx above). Call-time use — see the import note at the top of the file.
    useTaskStore.getState().clearGoal(id);
    useHabitStore.getState().clearGoal(id);
  },

  registerProgress(goalId) {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const now = new Date();
    const strength = bumpedStrength(goal.strength, goal.strengthUpdatedAt, now.getTime());
    const strengthUpdatedAt = now.toISOString();
    updateRow('goals', { strength, strength_updated_at: strengthUpdatedAt }, 'id = ?', [goalId]);
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, strength, strengthUpdatedAt } : g)) }));
  },
}));
