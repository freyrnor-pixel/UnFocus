/**
 * handler.tsx — headless widget task handler for react-native-android-widget.
 *
 * Registered at the app entry (index.ts). Android invokes it — possibly with the app
 * process dead — whenever a widget is added, updated, resized, or a widget row is tapped
 * (WIDGET_CLICK), or the OS refresh period elapses. On render actions it reads the
 * pre-built, pre-localised snapshot from SQLite and hands the matching widget JSX to
 * renderWidget. On WIDGET_CLICK it writes the toggle back to SQLite via
 * lib/widgets/widgetActions.ts, patches the affected row in the cached snapshot, and
 * re-renders — all without importing stores or i18n, so it stays cheap and safe in a bare
 * JS context. The app reconciles the authoritative store state on its next foreground
 * (app/_layout.tsx reloads the widget-writable stores from the DB before re-syncing).
 *
 * Connections:
 *   Imports → react-native-android-widget (types), lib/widgets/snapshot (read/save),
 *             lib/widgets/headlessSnapshot (buildHeadlessSnapshot fallback),
 *             lib/widgets/WidgetViews (renderWidgetByName),
 *             lib/widgets/widgetActions (toggleTaskDone/cycleShoppingItem/toggleNoteChecked/toggleHabitDone)
 *   Used by → index.ts (registerWidgetTaskHandler, Android only)
 *   Data    → reads/writes the widget_snapshot SQLite row; the actions write tasks/
 *             shopping_items/notes/habit_logs
 *
 * Edit notes:
 *   - WIDGET_UPDATE (the OS periodic tick, app usually dead) rebuilds from live SQLite via
 *     buildHeadlessSnapshot() FIRST, so widgets refresh in the background instead of staying
 *     frozen on the last app-pushed snapshot until the app is next opened. That fresh build is
 *     rendered but NOT saved back over the cached row (the app's snapshot is more precise).
 *   - WIDGET_ADDED / WIDGET_RESIZED prefer the cached snapshot: readWidgetSnapshot() ??
 *     buildHeadlessSnapshot() ?? placeholder(). The headless builder reads the live tables
 *     directly, so a freshly-planted widget renders real content even if the app has never run
 *     and written a snapshot (the "invisible until I open the app" symptom). placeholder() is
 *     only the last resort if even that read fails.
 *   - WIDGET_CLICK dispatches on `clickAction` + `clickActionData.id`. OPEN_APP / OPEN_URI
 *     are handled natively (never reach here) — only the custom TOGGLE_/CYCLE_ actions do.
 *   - The snapshot patch mirrors the DB write's effect on the visible list (flip done, move
 *     to cart, drop purchased/checked rows). Subtitles/counts aren't re-localised here (no
 *     i18n in the headless context) — they self-correct on the next in-app sync.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readWidgetSnapshot, saveWidgetSnapshot, type WidgetSnapshot } from './snapshot';
import { buildHeadlessSnapshot } from './headlessSnapshot';
import { renderWidgetByName } from './WidgetViews';
import { toggleTaskDone, cycleShoppingItem, toggleNoteChecked, toggleHabitDone } from './widgetActions';

function placeholder(): WidgetSnapshot {
  return {
    updatedAt: Date.now(),
    shopping: { title: 'UnFocus', subtitle: '', items: [], more: '', empty: '—', accent: '#0891B2', hasContent: false },
    tasks: { title: 'UnFocus', subtitle: '', items: [], more: '', empty: '—', accent: '#2563EB', hasContent: false },
    overview: { title: 'UnFocus', lines: [], empty: '—', accent: '#F4A261', hasContent: false },
    notes: { title: 'UnFocus', items: [], more: '', empty: '—', voiceLabel: '', accent: '#8B5CF6', hasContent: false },
    habits: { title: 'UnFocus', subtitle: '', items: [], more: '', empty: '—', accent: '#16A34A', hasContent: false },
    health: { title: 'UnFocus', subtitle: '', items: [], more: '', empty: '—', accent: '#E11D48', hasContent: false },
  };
}

/** Apply a widget tap to the DB and patch the cached snapshot so the re-render reflects it. */
function applyClick(snap: WidgetSnapshot, action: string | undefined, id: string) {
  switch (action) {
    case 'TOGGLE_TASK': {
      const r = toggleTaskDone(id);
      if (r) {
        const it = snap.tasks.items.find((t) => t.id === id);
        if (it) it.done = r.done;
      }
      break;
    }
    case 'CYCLE_SHOP_ITEM': {
      const r = cycleShoppingItem(id);
      if (r) {
        if (r.state === 'purchased') {
          snap.shopping.items = snap.shopping.items.filter((i) => i.id !== id);
          snap.shopping.hasContent = snap.shopping.items.length > 0;
        } else {
          const it = snap.shopping.items.find((i) => i.id === id);
          if (it) it.state = r.state as 'list' | 'cart';
        }
      }
      break;
    }
    case 'TOGGLE_NOTE': {
      const r = toggleNoteChecked(id);
      if (r?.checked) {
        // Checked notes leave the active-only Notes widget.
        snap.notes.items = snap.notes.items.filter((n) => n.id !== id);
        snap.notes.hasContent = snap.notes.items.length > 0;
      }
      break;
    }
    case 'TOGGLE_HABIT': {
      const r = toggleHabitDone(id);
      if (r) {
        const it = snap.habits.items.find((h) => h.id === id);
        if (it) it.done = r.done;
      }
      break;
    }
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, clickAction, clickActionData, renderWidget } = props;

  if (widgetAction === 'WIDGET_CLICK') {
    const id = clickActionData?.id as string | undefined;
    if (!id) return;
    const snap = readWidgetSnapshot();
    if (!snap) return;
    applyClick(snap, clickAction, id);
    saveWidgetSnapshot(snap);
    renderWidget(renderWidgetByName(widgetInfo.widgetName, snap));
    return;
  }

  if (widgetAction !== 'WIDGET_ADDED' && widgetAction !== 'WIDGET_UPDATE' && widgetAction !== 'WIDGET_RESIZED') {
    return;
  }
  // WIDGET_UPDATE is the OS's periodic refresh (updatePeriodMillis) and fires with the app
  // process dead. Rebuild straight from live SQLite here so the widget reflects current data
  // (day rollover, edits made in a previous session) instead of re-rendering the last snapshot
  // the app pushed — otherwise widgets never change until the app is next opened. We render the
  // fresh build but deliberately do NOT persist it over the cached row: the app-built snapshot
  // is more precise (exact recurring-task expansion / list scoping the headless builder only
  // approximates), so we keep it as the cache and only want a fresher render right now.
  // WIDGET_ADDED / WIDGET_RESIZED just need the current visual, so they prefer that cache.
  const fresh = widgetAction === 'WIDGET_UPDATE' ? buildHeadlessSnapshot() : null;
  const snapshot = fresh ?? readWidgetSnapshot() ?? buildHeadlessSnapshot() ?? placeholder();
  renderWidget(renderWidgetByName(widgetInfo.widgetName, snapshot));
}
