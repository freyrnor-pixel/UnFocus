/**
 * useFeedbackStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal notes/add()/clearAll() contract Phase 3e's DebugOverlay
 * needs so it can typecheck ahead of Phase 5's real debug-notes store (SQLite
 * table `feedback_notes`, per the old app's useFeedbackStore.ts). Every action
 * throws to make accidental real usage fail loudly instead of silently
 * no-op'ing. Reading `notes` is always safe — it just returns an empty array.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/DebugOverlay.tsx
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store (table `feedback_notes`)
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy FeedbackNote/add()/clearAll()
 *     exactly as declared here (Decision 015). The old app's `load()` and the
 *     legacy `screen`/`x`/`y` placeholder columns are a real-store implementation
 *     detail (see the old repo's useFeedbackStore.ts edit notes), not part of
 *     this component-facing contract.
 */
export type FeedbackNote = {
  id: string;
  title: string;
  note: string;
  createdAt: string;
};

type FeedbackStoreState = {
  notes: FeedbackNote[];
  add: (title: string, note: string) => FeedbackNote;
  clearAll: () => void;
};

function notImplemented(): never {
  throw new Error('useFeedbackStore is a Phase 5 stub (Decision 015) — not implemented yet');
}

const state: FeedbackStoreState = {
  notes: [],
  add: notImplemented,
  clearAll: notImplemented,
};

export function useFeedbackStore<T>(selector: (s: FeedbackStoreState) => T): T {
  return selector(state);
}
