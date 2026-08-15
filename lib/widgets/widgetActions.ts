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
 *   Imports → lib/db (shared SQLite handle), lib/date (todayStr), lib/id (generateId)
 *   Used by → lib/widgets/handler.tsx (WIDGET_CLICK dispatch)
 *   Data    → writes tasks / task_steps / shopping_items / notes / habit_logs / medicine_doses;
 *             checkpoints WAL after
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
import { todayStr } from '@/lib/date';
import { generateId } from '@/lib/id';

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

/**
 * Toggle a habit's "met today" state. Done = today's log count reaches the habit's daily goal
 * (a rest day also counts as met). Marking done sets count = goal; clearing zeroes count and
 * rest_day. Mirrors useHabitStore's habit_logs upsert (increment/markRestDay) closely enough
 * that the app reconciles on next foreground. Returns the resulting done state.
 */
export function toggleHabitDone(id: string): { done: boolean } | null {
  try {
    const habit = db.getFirstSync<{ daily_goal: number }>('SELECT daily_goal FROM habits WHERE id = ?', [id]);
    if (!habit) return null;
    const goal = Math.max(1, habit.daily_goal || 1);
    const today = todayStr();
    const log = db.getFirstSync<{ id: string; count: number; rest_day: number }>(
      'SELECT id, count, rest_day FROM habit_logs WHERE habit_id = ? AND log_date = ?',
      [id, today]
    );
    const currentlyDone = !!log && (!!log.rest_day || log.count >= goal);
    const nextCount = currentlyDone ? 0 : goal;
    if (log) {
      // Clearing also drops a rest-day flag so a re-tap starts from a clean "not met".
      db.runSync('UPDATE habit_logs SET count = ?, rest_day = 0 WHERE id = ?', [nextCount, log.id]);
    } else {
      db.runSync('INSERT INTO habit_logs (id, habit_id, log_date, count, rest_day) VALUES (?, ?, ?, ?, 0)', [
        generateId(),
        id,
        today,
        nextCount,
      ]);
    }
    checkpoint();
    return { done: !currentlyDone };
  } catch {
    return null;
  }
}

/**
 * Log every not-yet-taken medicine in a tray for today — the widget's copy of
 * useMedicineStore.takeTray(), which is itself what the tray notification's "Taken" button
 * calls. A tray is a WINDOW, so it is logged as a whole; there is no per-medicine row to tap
 * on a widget and there should not be one.
 *
 * Idempotent by the same rule the store uses: a scheduled dose's identity is
 * (medicine_id, log_date, tray), so an already-logged medicine is skipped rather than
 * duplicated. That matters more here than in the app — a widget tap can land while the
 * notification's Taken button is being pressed on the same tray, from two processes.
 *
 * Deliberately NOT taking as-needed medicines: they belong to no tray (`trays` is empty and
 * `as_needed` is 1), and nothing in this app ever nudges someone into a PRN dose.
 */
export function takeTray(tray: string): { taken: number; total: number } | null {
  try {
    const today = todayStr();
    // `trays` is a JSON array column ('["morning","evening"]'), so membership is matched in JS
    // rather than SQL — LIKE '%morning%' would also match a tray named "morning-after".
    const meds = db.getAllSync<{ id: string; trays: string }>(
      'SELECT id, trays FROM medicines WHERE active = 1 AND as_needed = 0'
    );
    const inTray = meds.filter((m) => {
      try {
        const list = JSON.parse(m.trays || '[]');
        return Array.isArray(list) && list.includes(tray);
      } catch {
        return false;
      }
    });
    if (inTray.length === 0) return null;

    const now = new Date();
    const at = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const med of inTray) {
      const existing = db.getFirstSync<{ id: string }>(
        'SELECT id FROM medicine_doses WHERE medicine_id = ? AND log_date = ? AND tray = ?',
        [med.id, today, tray]
      );
      if (existing) continue;
      db.runSync(
        'INSERT INTO medicine_doses (id, medicine_id, log_date, tray, taken_at, note) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), med.id, today, tray, at, '']
      );
    }
    checkpoint();
    return { taken: inTray.length, total: inTray.length };
  } catch {
    return null;
  }
}
