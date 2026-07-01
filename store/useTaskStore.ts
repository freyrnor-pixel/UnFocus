/**
 * useTaskStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal add() contract Phase 3b's QuickAddSheet needs so it can
 * typecheck ahead of Phase 5's real task store. Never call in a mounted app —
 * throws to make accidental real usage fail loudly instead of silently no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/QuickAddSheet.tsx
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy TaskInput exactly as declared
 *     here (Decision 015). If the real store's needs differ, fix the contract
 *     there and re-typecheck this sheet — don't diverge silently.
 */
export type TaskInput = {
  title: string;
  date: string;
  time?: string;
  taskType: string;
  durationMinutes?: number;
  done: boolean;
  recurring: string;
  recurringDays: number[];
  importance: string;
  sortOrder: number;
};

type TaskStoreState = {
  add: (task: TaskInput) => void;
};

export function useTaskStore<T>(selector: (s: TaskStoreState) => T): T {
  return selector({
    add: () => {
      throw new Error('useTaskStore is a Phase 5 stub (Decision 015) — not implemented yet');
    },
  });
}
