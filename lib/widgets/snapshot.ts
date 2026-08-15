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
 *   - saveWidgetSnapshot() runs `PRAGMA wal_checkpoint(TRUNCATE)` after the write: the DB is
 *     in WAL mode and the headless handler reads this row from a separate process (app closed),
 *     which can otherwise miss a write still in the -wal and render a stale/empty snapshot.
 *   - Each list row carries its `id` so a widget tap (WIDGET_CLICK) can write the toggle back
 *     via lib/widgets/widgetActions.ts. The handler patches the matching row in this snapshot
 *     in place after the DB write, so the widget reflects the change without a full rebuild.
 */
import db from '@/lib/db';

/**
 * The identity hue each widget wears — ONE map, shared by every producer of a snapshot
 * (lib/widgets/sync.ts, lib/widgets/headlessSnapshot.ts, handler.tsx's placeholder).
 *
 * ⚠️ **Hand-mirrored from `IDENTITY_HUES` in constants/colors.ts, deliberately not imported.**
 * Everything downstream of a snapshot runs headless — a bare JS context with the app process
 * dead — and constants/colors.ts pulls in constants/theme.ts, which is a react-native module
 * graph this context has no business evaluating. The copy is what keeps the widget layer
 * dependency-free; `lib/widgets/__tests__/widgetPalette.test.ts` is what keeps it honest, by
 * importing both and asserting they agree. Don't "tidy" this into an import.
 *
 * These were six invented hexes (`#0891B2`/`#2563EB`/`#F4A261`/`#8B5CF6`/`#16A34A`/`#E11D48`)
 * until 2026-08-15 — pre-dating the categorical system entirely, so a widget's dot was a
 * colour that appeared nowhere in the app it belonged to. `overview` has no identity hue to
 * borrow (Home is the one neutral surface), so it takes the palette's own `accent`.
 */
export const WIDGET_ACCENT = {
  shop: '#0DB34A', // IDENTITY_HUES.shopping
  task: '#FFD700', // IDENTITY_HUES.todo
  overview: '#1E88FF', // DARK.accent — Home/overview is IDENTITY_NEUTRAL, which is a drab grey
  notes: '#B45CFF', // IDENTITY_HUES.notes
  habits: '#05D9E8', // IDENTITY_HUES.habits
  health: '#FF8CB2', // IDENTITY_HUES.health
} as const;

/** One task row shown in the Tasks widget. `id` lets a widget tap toggle it (WIDGET_CLICK). */
export type WidgetTaskLine = { id: string; title: string; done: boolean };

/** One shopping row. `state` drives the cycle list → cart → purchased; purchased rows drop out. */
export type WidgetShopLine = { id: string; name: string; state: 'list' | 'cart' };

/** One note row shown in the Notes widget; tap toggles `checked`. */
export type WidgetNoteLine = { id: string; header: string; checked: boolean };

/** One habit row shown in the Habits widget. `done` = today's count met the goal; tap toggles it. */
export type WidgetHabitLine = { id: string; title: string; done: boolean };

/** One health row shown in the Health widget (read-only). `ongoing` = no end date yet. */
export type WidgetHealthLine = { id: string; label: string; severity: number; ongoing: boolean };

/**
 * One medicine tray row, rendered above the entries in the Health widget (2026-08-15).
 *
 * Medicine has no widget of its own — a sixth receiver means an app.json change and a native
 * rebuild, and folding it in here ships over OTA instead. It sits on Health because that is
 * where the medicine card lives in the app, and it is why the Health widget stopped being
 * read-only: `id` is the TrayId, and a tap fires TAKE_TRAY (lib/widgets/widgetActions.ts),
 * logging every not-yet-taken medicine in the window exactly as the notification's Taken
 * button does.
 *
 * `due` is the tray's own no-shame framing carried outward: a tray whose time has passed with
 * something untaken is STILL DUE, never missed, and it stays visible rather than escalating.
 * A tray still ahead of now is neither due nor taken — it simply reads as upcoming.
 */
export type WidgetTrayLine = {
  /** TrayId ('morning' | 'midday' | 'evening' | 'night'), and the TAKE_TRAY click payload. */
  id: string;
  /** Localised tray name, e.g. "Morning" / "Morgen". */
  label: string;
  /** Localised progress, e.g. "2 of 3". */
  detail: string;
  /** Every medicine in the tray is logged for today. */
  taken: boolean;
  /** The tray's time has passed and something in it is still untaken. */
  due: boolean;
};

/** Fully-localised snapshot rendered by every widget. */
export type WidgetSnapshot = {
  /** Epoch ms the snapshot was built — lets a widget show a relative "updated" hint if wanted. */
  updatedAt: number;
  shopping: {
    title: string;
    /** e.g. "3 items left" / "All done 🎉" */
    subtitle: string;
    items: WidgetShopLine[];
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
    /**
     * The lock-screen-safe subset of `lines`, and the ONLY thing the persistent notification
     * ever posts (lib/widgets/sync.ts). The overview's channel is PUBLIC, so its body is
     * readable by anyone who picks up a locked phone: this variant drops health entirely and
     * collapses medicine to a bare count, where `lines` names the trays that are still due.
     *
     * Optional because a snapshot is persisted JSON — a row written by an older build has no
     * such key, and the handler renders it verbatim. Read it as `safeLines ?? lines`.
     */
    safeLines?: string[];
    empty: string;
    accent: string;
    hasContent: boolean;
  };
  notes: {
    title: string;
    items: WidgetNoteLine[];
    more: string;
    empty: string;
    /** localised label for the "record a voice note" button */
    voiceLabel: string;
    accent: string;
    hasContent: boolean;
  };
  habits: {
    title: string;
    /** e.g. "2 habits left" / '' when all met */
    subtitle: string;
    items: WidgetHabitLine[];
    more: string;
    empty: string;
    accent: string;
    hasContent: boolean;
  };
  health: {
    title: string;
    /** e.g. "1 medicine still due · 1 ongoing" / '' */
    subtitle: string;
    items: WidgetHealthLine[];
    /**
     * Today's medicine trays, drawn above `items`. Optional for the same reason `safeLines`
     * is — an older persisted snapshot has no key here. Read it as `trays ?? []`.
     */
    trays?: WidgetTrayLine[];
    more: string;
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
    // The DB runs in WAL mode (lib/db.ts). The widget's headless task handler
    // (lib/widgets/handler.tsx) reads this row from a SEPARATE process while the
    // app is closed — and a fresh connection can miss changes still sitting in the
    // -wal file, showing a stale/empty snapshot (the "widget shows no tasks even
    // though the app has them" bug). Force a checkpoint so the write lands in the
    // main db file the headless reader opens. TRUNCATE also keeps the -wal small.
    try { db.execSync('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* checkpoint is best-effort */ }
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
