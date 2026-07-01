/**
 * useNotesStore.ts — Decision 015 stub: type-only, no store logic.
 *
 * Declares the minimal Note shape Phase 3c's NoteRow needs for its props, ahead
 * of Phase 5's real notes store. NoteRow is a dumb presentational row (app/notes.tsx
 * owns the data and every callback) so this file exports only the Note type —
 * no hook, unlike useTaskStore.ts/useShoppingStore.ts, since nothing here calls
 * a store function directly.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/NoteRow.tsx (type only)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy Note exactly as declared here
 *     (Decision 015). If the real store's needs differ, fix the contract there
 *     and re-typecheck NoteRow — don't diverge silently.
 */
export type Note = {
  id: string;
  header: string;
  body: string;
  checked: boolean;
};
