/**
 * useSharedStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal contract components/SharedRequestsSection.tsx needs to
 * list incoming shared shopping-items/tasks and accept/dismiss them, ahead of
 * Phase 5's real shared-inbox store. Every action throws to make accidental
 * real usage fail loudly instead of silently no-op'ing. Reading
 * shoppingItems/tasks is always safe — returns [], so SharedRequestsSection
 * renders nothing (its own `pending.length === 0` early-return) until Phase 5.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/SharedRequestsSection.tsx
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - New file (2026-07-02, Session A2·2, expanded scope — see PROGRESS_LOG). Not part
 *     of Session A2·1's staged surface; this store didn't exist anywhere in this repo
 *     before app/shopping.tsx needed SharedRequestsSection ported. Signatures mirror the
 *     old app's useSharedStore.ts 1:1 for the fields/actions SharedRequestsSection reads
 *     — same minimal-contract precedent as every other Decision 015 stub.
 *   - direction: 'in' rows are incoming shares (from a partner); 'out' rows (sent by this
 *     device) exist in the old app's full history screen but aren't read by
 *     SharedRequestsSection, which only ever filters direction==='in' && !done.
 */
export type SharedShoppingItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  direction: 'in' | 'out';
  done: boolean;
  sharedBy: string;
};

export type SharedTask = {
  id: string;
  title: string;
  direction: 'in' | 'out';
  done: boolean;
  sharedBy: string;
};

type SharedStoreState = {
  shoppingItems: SharedShoppingItem[];
  tasks: SharedTask[];
  toggleShopping: (id: string) => void;
  toggleTask: (id: string) => void;
  removeShopping: (id: string) => void;
  removeTask: (id: string) => void;
};

function notImplemented(): never {
  throw new Error('useSharedStore is a Phase 5 stub (Decision 015) — not implemented yet');
}

export function useSharedStore<T>(selector: (s: SharedStoreState) => T): T {
  return selector({
    shoppingItems: [],
    tasks: [],
    toggleShopping: notImplemented,
    toggleTask: notImplemented,
    removeShopping: notImplemented,
    removeTask: notImplemented,
  });
}
