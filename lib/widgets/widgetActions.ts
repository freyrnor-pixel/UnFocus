/**
 * widgetActions.ts — headless SQLite write-back for home-screen widget taps.
 *
 * When a widget row is tapped, react-native-android-widget invokes the headless task
 * handler (lib/widgets/handler.tsx) with widgetAction 'WIDGET_CLICK' — possibly while
 * the app process is dead. Like snapshot.ts, this module talks ONLY to SQLite: it
 * imports no Zustand stores and no i18n, so it is safe in a bare JS context. Each helper
 * mirrors the DB write its store counterpart performs (useTaskStore.toggle /
 * useShoppingStore / useNotesStore.toggleChecked) closely enough that the app reconciles
 * cleanly the next time it foregrounds and reloads its stores from the DB
 * (app/_layout.tsx). It deliberately does NOT re-run store side-effects (task_completed
 * automation, notification rescheduling, LAN broadcast) — those live in the stores and
 * fire on the in-app path only; a widget toggle is a plain DB state change.
 *
 * Connections:
 *   Imports → lib/db (shared SQLite handle)
 *   Used by → lib/widgets/handler.tsx (WIDGET_CLICK dispatch)
 *   Data    → writes tasks / task_steps / shopping_items / notes; checkpoints WAL after
 *
 * Edit notes:
 *   - Every write runs `PRAGMA wal_checkpoint(TRUNCATE)` after committing — same reason as
 *     saveWidgetSnapshot: the headless writer and the app are separate processes on a
 *     WAL-mode DB, and an un-checkpointed write can be missed by the other side.
 *   - `updated_at` is stamped (ISO, matching the stores' convention) on the synced tables
 *     (tasks, shopping_items) so a later LAN merge doesn't resurrect the pre-tap value;
 *     `notes` has no updated_at column (not a synced table).
 *   - All helpers are best-effort: a missing row / closed DB degrades to a no-op rather
 *     than crashing a headless task.
 */
import db from '@/lib/db';

function checkpoint() {
  try {
    db.execSync('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    /* checkpoint is best-effort */
  }
}

/** Flip a task's done flag and cascade it to every step (task↔steps invariant). */
export function toggleTaskDone(id: string): { done: boolean } | null {
  try {
    const row = db.getFirstSync<{ done: number }>('SELECT done FROM tasks WHERE id = ?', [id]);
    if (!row) return null;
    const done = row.done ? 0 : 1;
    const now = new Date().toISOString();
    db.runSync('UPDATE tasks SET done = ?, updated_at = ? WHERE id = ?', [done, now, id]);
    db.runSync('UPDATE task_steps SET done = ? WHERE task_id = ?', [done, id]);
    checkpoint();
    return { done: !!done };
  } catch {
    return null;
  }
}

/**
 * Cycle a shopping row list → cart → purchased. `checked` marks "in cart / got it" — the same
 * flag the app's list cross-off (useShoppingStore.toggleCheck) uses, so the two stay in sync.
 * Setting status='purchased' takes it out of the trip (it drops off the widget list). Returns
 * the resulting state, or `purchased` when the item left the list.
 */
export function cycleShoppingItem(id: string): { state: 'list' | 'cart' | 'purchased' } | null {
  try {
    const row = db.getFirstSync<{ checked: number; status: string }>(
      'SELECT checked, status FROM shopping_items WHERE id = ?',
      [id]
    );
    if (!row) return null;
    const now = new Date().toISOString();
    if (!row.checked) {
      db.runSync('UPDATE shopping_items SET checked = 1, updated_at = ? WHERE id = ?', [now, id]);
      checkpoint();
      return { state: 'cart' };
    }
    db.runSync(
      "UPDATE shopping_items SET status = 'purchased', purchased_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id]
    );
    checkpoint();
    return { state: 'purchased' };
  } catch {
    return null;
  }
}

/** Flip a note's checked flag. Checked notes leave the (active-only) Notes widget. */
export function toggleNoteChecked(id: string): { checked: boolean } | null {
  try {
    const row = db.getFirstSync<{ checked: number }>('SELECT checked FROM notes WHERE id = ?', [id]);
    if (!row) return null;
    const checked = row.checked ? 0 : 1;
    db.runSync('UPDATE notes SET checked = ? WHERE id = ?', [checked, id]);
    checkpoint();
    return { checked: !!checked };
  } catch {
    return null;
  }
}
