/**
 * sync.ts — the single "push today's state outward" coordinator.
 *
 * Reads the hydrated Zustand stores, computes today's tasks + shopping progress once,
 * localises every string, then fans the result out to THREE surfaces that all show the
 * same daily snapshot:
 *   1. the widget_snapshot SQLite cache (so the headless widget handler can render), and
 *   2. every live home-screen widget via requestWidgetUpdate, and
 *   3. the persistent "today's overview" notification (refreshed or cancelled per the
 *      persistentNotifEnabled setting).
 *
 * This is the app-side analogue of lib/reminders.ts's syncReminders — call it whenever
 * today's tasks/shopping/settings change or the app returns to the foreground. It is
 * safe to call on any platform: the widget calls are Android-only and fully guarded, and
 * the notification helpers already swallow their own failures.
 *
 * Connections:
 *   Imports → react-native (Platform), lib/date, lib/i18n (getTranslations),
 *             lib/notifications (refresh/cancelPersistentNotification), lib/widgets/snapshot,
 *             lib/widgets/WidgetViews (renderWidgetByName, WIDGET_NAMES), store/useTaskStore,
 *             store/useShoppingStore, store/useShoppingListStore, store/useNotesStore,
 *             store/useHabitStore, store/useHealthStore, store/useSettingsStore
 *   Used by → app/_layout.tsx (foreground/background + after startup load), app/settings.tsx
 *             (persistent-notif toggle)
 *   Data    → reads the task/shopping/settings stores; writes widget_snapshot; posts/cancels
 *             the persistent notification; updates Android widgets
 *
 * Edit notes:
 *   - Widget names passed to requestWidgetUpdate MUST match WIDGET_NAMES / app.json.
 *   - requestWidgetUpdate is lazily required inside the Android guard so the native module is
 *     never touched on iOS or in a build without the widget native code linked.
 *   - Strings are localised HERE (getTranslations), never in the headless handler/views.
 */
import { Platform } from 'react-native';
import { todayStr } from '@/lib/date';
import { getTranslations } from '@/lib/i18n';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
import { refreshPersistentNotification, cancelPersistentNotification } from '@/lib/notifications';
import { saveWidgetSnapshot, type WidgetSnapshot } from './snapshot';
import { renderWidgetByName, WIDGET_NAMES } from './WidgetViews';
import { useTaskStore } from '@/store/useTaskStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useHabitStore, type Habit } from '@/store/useHabitStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Widgets scroll (ListWidget), so we can bake more than a handful of rows; overflow
// beyond this still shows a "+N more" footer.
const PREVIEW = 20;
const ACCENT = {
  shop: '#0891B2',
  task: '#2563EB',
  overview: '#F4A261',
  notes: '#8B5CF6',
  habits: '#16A34A',
  health: '#E11D48',
};

/** First non-empty line of a note's header/body, trimmed for a one-line widget preview. */
function noteText(header: string, body: string): string {
  const src = (header || '').trim() || (body || '').trim();
  return src.split('\n')[0].slice(0, 60);
}

/** Build the fully-localised snapshot from the current store state. */
export function buildWidgetSnapshot(): WidgetSnapshot {
  const t = getTranslations();
  const today = todayStr();

  // ── Tasks (today) ──
  const todayTasks = useTaskStore.getState().tasksForDate(today);
  const tasksRemaining = todayTasks.filter((task) => !task.done).length;
  const taskItems = todayTasks
    .slice(0, PREVIEW)
    .map((task) => ({ id: task.id, title: task.title, done: task.done }));

  // ── Shopping (current list) — items still in the trip (inWeeklyList = not yet purchased),
  //    split by `checked` (the app's own cross-off, useShoppingStore.toggleCheck): unchecked =
  //    "in list", checked = "in cart / got it". A widget tap cycles list → cart → purchased. ──
  const list = useShoppingListStore.getState().currentList(today);
  const allItems = useShoppingStore.getState().items;
  const listItems = list ? allItems.filter((i) => i.status === 'inWeeklyList' && i.listId === list.id) : [];
  const shopSorted = [...listItems].sort((a, b) => Number(a.checked) - Number(b.checked));
  const shopItems = shopSorted.slice(0, PREVIEW).map((i) => ({
    id: i.id,
    name: i.name,
    state: (i.checked ? 'cart' : 'list') as 'list' | 'cart',
  }));
  const shopRemaining = listItems.filter((i) => !i.checked).length;

  // ── Notes (active/unchecked, most recent order) ──
  const activeNotes = useNotesStore.getState().notes.filter((n) => !n.checked);
  const noteItems = activeNotes
    .slice(0, PREVIEW)
    .map((n) => ({ id: n.id, header: noteText(n.header, n.body), checked: n.checked }));

  // ── Habits (scheduled for today) — done = today's log met the goal (or a rest day),
  //    or (for a 'weekly-flexible' habit) the week's cumulative count reached it. ──
  const habitState = useHabitStore.getState();
  const todayHabits = habitState.habits.filter((h) => h.active && habitOccursOn(h, today));
  const habitDone = (h: Habit) => {
    const log = habitState.logs.find((l) => l.habitId === h.id && l.logDate === today);
    if (log?.restDay) return true;
    return habitProgress(h, habitState.logs, today).isDone;
  };
  const habitItems = todayHabits.slice(0, PREVIEW).map((h) => ({ id: h.id, title: h.title, done: habitDone(h) }));
  const habitsRemaining = todayHabits.filter((h) => !habitDone(h)).length;

  // ── Health (ongoing issues + anything logged today), newest-first (store order). ──
  const activeHealth = useHealthStore.getState().logs.filter((l) => l.endDate === '' || l.date === today);
  const healthItems = activeHealth
    .slice(0, PREVIEW)
    .map((l) => ({ id: l.id, label: l.ailment, severity: l.severity, ongoing: l.endDate === '' }));
  const ongoingCount = activeHealth.filter((l) => l.endDate === '').length;

  // ── Overview lines (also feeds the persistent notification body) ──
  const overviewLines: string[] = [];
  if (tasksRemaining > 0) overviewLines.push(t.widgets.tasksLeft(tasksRemaining));
  if (shopRemaining > 0) overviewLines.push(t.widgets.itemsLeft(shopRemaining));
  const nextTask = todayTasks.find((task) => !task.done);
  if (nextTask) overviewLines.push(nextTask.time ? `${nextTask.time} · ${nextTask.title}` : nextTask.title);

  return {
    updatedAt: Date.now(),
    shopping: {
      title: list?.name || t.widgets.shoppingTitle,
      subtitle: shopRemaining > 0 ? t.widgets.itemsLeft(shopRemaining) : '',
      items: shopItems,
      more: listItems.length > PREVIEW ? t.widgets.more(listItems.length - PREVIEW) : '',
      empty: listItems.length === 0 ? t.widgets.noItems : t.widgets.allDone,
      accent: ACCENT.shop,
      hasContent: shopItems.length > 0,
    },
    tasks: {
      title: t.widgets.tasksTitle,
      subtitle: tasksRemaining > 0 ? t.widgets.tasksLeft(tasksRemaining) : '',
      items: taskItems,
      more: todayTasks.length > PREVIEW ? t.widgets.more(todayTasks.length - PREVIEW) : '',
      empty: t.widgets.noTasks,
      accent: ACCENT.task,
      hasContent: todayTasks.length > 0,
    },
    overview: {
      title: t.notif.overviewTitle,
      lines: overviewLines,
      empty: t.notif.overviewBodyNoTasks,
      accent: ACCENT.overview,
      hasContent: overviewLines.length > 0,
    },
    notes: {
      title: t.widgets.notesTitle,
      items: noteItems,
      more: activeNotes.length > PREVIEW ? t.widgets.more(activeNotes.length - PREVIEW) : '',
      empty: t.widgets.noNotes,
      voiceLabel: t.widgets.voiceNote,
      accent: ACCENT.notes,
      hasContent: noteItems.length > 0,
    },
    habits: {
      title: t.widgets.habitsTitle,
      subtitle: habitsRemaining > 0 ? t.widgets.habitsLeft(habitsRemaining) : '',
      items: habitItems,
      more: todayHabits.length > PREVIEW ? t.widgets.more(todayHabits.length - PREVIEW) : '',
      empty: t.widgets.noHabits,
      accent: ACCENT.habits,
      hasContent: todayHabits.length > 0,
    },
    health: {
      title: t.widgets.healthTitle,
      subtitle: ongoingCount > 0 ? t.widgets.healthOngoing(ongoingCount) : '',
      items: healthItems,
      more: activeHealth.length > PREVIEW ? t.widgets.more(activeHealth.length - PREVIEW) : '',
      empty: t.widgets.noHealth,
      accent: ACCENT.health,
      hasContent: healthItems.length > 0,
    },
  };
}

/** Push the current live widgets (Android only; no-op / swallowed everywhere else). */
async function updateAndroidWidgets(snapshot: WidgetSnapshot) {
  if (Platform.OS !== 'android') return;
  try {
    // Lazily required so the native module is never referenced off-Android.
    const { requestWidgetUpdate } = require('react-native-android-widget');
    await Promise.all(
      WIDGET_NAMES.map((name) =>
        requestWidgetUpdate({
          widgetName: name,
          renderWidget: () => renderWidgetByName(name, snapshot),
          widgetNotFound: () => {},
        }).catch(() => {})
      )
    );
  } catch {
    /* native widget module absent (Expo Go / pre-build) — widgets simply stay inert */
  }
}

/** Refresh the persistent daily-overview notification, or cancel it if disabled. */
async function updatePersistentNotification(snapshot: WidgetSnapshot) {
  const t = getTranslations();
  const enabled = useSettingsStore.getState().persistentNotifEnabled;
  if (!enabled) {
    await cancelPersistentNotification();
    return;
  }
  const body = snapshot.overview.hasContent
    ? snapshot.overview.lines.join(' · ')
    : t.notif.overviewNothingElse;
  await refreshPersistentNotification({ title: snapshot.overview.title, body, color: ACCENT.overview });
}

/**
 * Recompute the snapshot and push it to all three surfaces. Fire-and-forget safe.
 * `persistentOnly` skips the widget writes (used when only the notification toggle changed).
 */
export async function syncWidgetsAndOverview(opts?: { persistentOnly?: boolean }) {
  const snapshot = buildWidgetSnapshot();
  if (!opts?.persistentOnly) {
    saveWidgetSnapshot(snapshot);
    await updateAndroidWidgets(snapshot);
  }
  await updatePersistentNotification(snapshot);
}
