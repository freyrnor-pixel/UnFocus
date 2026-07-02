/**
 * id.ts — generateId(): short, time-ordered unique string IDs.
 *
 * Returns a base-36 timestamp + random suffix, used as the TEXT primary key for
 * rows the app creates (tasks, habits, shopping items, etc.). Roughly sortable
 * by creation time; not a cryptographically strong UUID.
 *
 * Connections:
 *   Imports → —
 *   Used by → store/useTaskStore.ts (Phase 5's first real store to need ID
 *             generation; other stores will add themselves here as they're
 *             implemented for real, replacing their Decision 015 stubs)
 *   Data    → none (generates PK strings for SQLite rows)
 *
 * Edit notes:
 *   - IDs are used as SQLite TEXT primary keys; keep them collision-resistant and
 *     stable. Do not shorten the random segment.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
