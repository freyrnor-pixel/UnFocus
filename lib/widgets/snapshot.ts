/**
 * snapshot.ts — persisted, fully-localised data snapshot for the Android home-screen widgets.
 *
 * The widget task handler (lib/widgets/handler.tsx) runs headless — potentially in a
 * fresh JS context while the app process is dead — so it cannot re-run the Zustand
 * stores' recurring-task / shopping-list logic. Instead the app computes everything
 * once (lib/widgets/sync.ts), bakes the display strings in the user's language, and
 * writes it here as one JSON row in SQLite. The handler just reads that row back and
 * renders it. Keeping the strings pre-localised means the handler never imports lib/i18n
 * or touches the settings store.
 *
 * Connections:
 *   Imports → lib/db (shared SQLite handle)
 *   Used by → lib/widgets/sync.ts (saveWidgetSnapshot), lib/widgets/handler.tsx (readWidgetSnapshot)
 *   Data    → owns the single-row `widget_snapshot` table (created in lib/db.ts's initDb;
 *             ensureTable() re-creates it defensively for the headless-first-read case)
 *
 * Edit notes:
 *   - All strings in WidgetSnapshot are already localised — do NOT localise again in the
 *     handler or the widget views. Add new display text here (baked by sync.ts), not there.
 *   - Every read/write is wrapped so a missing table / parse error degrades to null rather
 *     than crashing a headless task.
 */
import db from '@/lib/db';

/** One task row shown in the Tasks widget. */
export type WidgetTaskLine = { title: string; done: boolean };

/** Fully-localised snapshot rendered by all three widgets. */
export type WidgetSnapshot = {
  /** Epoch ms the snapshot was built — lets a widget show a relative "updated" hint if wanted. */
  updatedAt: number;
  shopping: {
    title: string;
    /** e.g. "3 items left" / "All done 🎉" */
    subtitle: string;
    items: string[];
    /** localised "+N more" footer, or '' when nothing is hidden */
    more: string;
    /** localised text shown when the list is empty */
    empty: string;
    accent: string;
    hasContent: boolean;
  };
  tasks: {
    title: string;
    subtitle: string;
    items: WidgetTaskLine[];
    more: string;
    empty: string;
    accent: string;
    hasContent: boolean;
  };
  overview: {
    title: string;
    lines: string[];
    empty: string;
    accent: string;
    hasContent: boolean;
  };
};

let ensured = false;
function ensureTable() {
  if (ensured) return;
  try {
    db.execSync('CREATE TABLE IF NOT EXISTS widget_snapshot (id INTEGER PRIMARY KEY, payload TEXT)');
    ensured = true;
  } catch {
    /* headless read before the app ever created the DB — read/write will simply no-op */
  }
}

export function saveWidgetSnapshot(snapshot: WidgetSnapshot) {
  ensureTable();
  try {
    db.runSync(
      'INSERT INTO widget_snapshot (id, payload) VALUES (1, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      [JSON.stringify(snapshot)]
    );
  } catch {
    /* never crash the app over a widget cache write */
  }
}

export function readWidgetSnapshot(): WidgetSnapshot | null {
  ensureTable();
  try {
    const row = db.getFirstSync<{ payload: string }>('SELECT payload FROM widget_snapshot WHERE id = 1');
    if (!row?.payload) return null;
    return JSON.parse(row.payload) as WidgetSnapshot;
  } catch {
    return null;
  }
}
