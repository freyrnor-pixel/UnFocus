/**
 * useInboxStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal items/promoteToTask()/remove() contract Phase 3e's
 * InboxSection needs so it can typecheck ahead of Phase 5's real quick-capture
 * store (SQLite table `inbox_items`, per the old app's useInboxStore.ts).
 * Every action throws to make accidental real usage fail loudly instead of
 * silently no-op'ing — consumers must only call actions from user-triggered
 * handlers, never unconditionally on mount. Reading `items` is always safe —
 * it just returns an empty array, which is also what makes InboxSection
 * correctly render nothing (its empty-state contract) until Phase 5 lands.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/InboxSection.tsx
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store (table `inbox_items`)
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy InboxItem/promoteToTask exactly
 *     as declared here (Decision 015). `promoteToTask`'s second argument type
 *     matches `TaskInput` from useTaskStore.ts field-for-field (old app's
 *     `Omit<Task, 'id' | 'steps'>` — this repo's Task stub has no `steps` field
 *     yet, so `TaskInput` is used directly instead of re-deriving an Omit).
 */
import type { TaskInput } from '@/store/useTaskStore';

export type InboxItem = {
  id: string;
  text: string;
  createdAt: string;
};

type InboxStoreState = {
  items: InboxItem[];
  add: (text: string) => InboxItem;
  update: (id: string, text: string) => void;
  remove: (id: string) => void;
  promoteToTask: (id: string, taskFields: TaskInput) => void;
};

function notImplemented(): never {
  throw new Error('useInboxStore is a Phase 5 stub (Decision 015) — not implemented yet');
}

const state: InboxStoreState = {
  items: [],
  add: notImplemented,
  update: notImplemented,
  remove: notImplemented,
  promoteToTask: notImplemented,
};

export function useInboxStore<T>(selector: (s: InboxStoreState) => T): T {
  return selector(state);
}
