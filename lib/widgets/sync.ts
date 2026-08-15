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
 *   Imports → react-native (Platform), lib/date (todayStr, localMinutesOf), lib/i18n
 *             (getTranslations), lib/cardType (isCompletable — 'note' cards never reach the
 *             widget, since every row it lists is tappable and a tap flips `done`),
 *             lib/episodes (isOpen — the health "ongoing" count),
 *             lib/medicineSchedule (traysInUse/trayProgress/trayMinutes — today's trays),
 *             lib/notifications (refresh/cancelPersistentNotification),
 *             lib/widgets/snapshot (types + the shared WIDGET_ACCENT map),
 *             lib/widgets/WidgetViews (renderWidgetByName, WIDGET_NAMES), store/useTaskStore,
 *             store/useShoppingStore, store/useShoppingListStore, store/useNotesStore,
 *             store/useHabitStore, store/useHealthStore, store/useMedicineStore,
 *             store/useSettingsStore
 *   Used by → app/_layout.tsx (foreground/background + after startup load), app/settings.tsx
 *             (persistent-notif toggle); scheduleWidgetSync (debounced) is called from the
 *             mutating actions of store/useTaskStore, store/useShoppingStore,
 *             store/useShoppingListStore, store/useNotesStore, store/useHabitStore,
 *             store/useHealthStore so widgets refresh while the app is open, not just on
 *             foreground/background
 *   Data    → reads the task/shopping/settings stores; writes widget_snapshot; posts/cancels
 *             the persistent notification; updates Android widgets
 *
 * Edit notes:
 *   - The overview is built TWICE — `lines` (full) and `safeLines` (what the pinned
 *     notification posts, and therefore what a locked screen shows). File any new line into
 *     one or both on purpose; see the comment at the split.
 *   - Medicine has no widget of its own; its trays ride on the Health slice. Anything read off
 *     the medicine store here is gated on `settings.featureMedicine`, because a flag that
 *     hides a surface has to hide it outside the app too.
 *   - Widget names passed to requestWidgetUpdate MUST match WIDGET_NAMES / app.json.
 *   - requestWidgetUpdate is lazily required inside the Android guard so the native module is
 *     never touched on iOS or in a build without the widget native code linked.
 *   - Strings are localised HERE (getTranslations), never in the headless handler/views.
 */
import { Platform } from 'react-native';
import { localMinutesOf, todayStr } from '@/lib/date';
import { isCompletable } from '@/lib/cardType';
import { isOpen } from '@/lib/episodes';
import { getTranslations } from '@/lib/i18n';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
import {
  TRAY_IDS,
  trayMinutes,
  trayProgress,
  traysInUse,
  type TrayId,
} from '@/lib/medicineSchedule';
import { refreshPersistentNotification, cancelPersistentNotification } from '@/lib/notifications';
import { saveWidgetSnapshot, WIDGET_ACCENT, type WidgetSnapshot, type WidgetTrayLine } from './snapshot';
import { renderWidgetByName, WIDGET_NAMES } from './WidgetViews';
import { useTaskStore } from '@/store/useTaskStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useHabitStore, type Habit } from '@/store/useHabitStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Widgets scroll (ListWidget), so we can bake more than a handful of rows; overflow
// beyond this still shows a "+N more" footer.
const PREVIEW = 20;

/** First non-empty line of a note's header/body, trimmed for a one-line widget preview. */
function noteText(header: string, body: string): string {
  const src = (header || '').trim() || (body || '').trim();
  return src.split('\n')[0].slice(0, 60);
}

/**
 * Today's medicine trays for the Health widget, plus how many medicines are still untaken.
 *
 * No person filter, matching lib/medicineNotifications.ts's own reasoning: a tray covers
 * everyone's medicine in that window, which is what a shared morning tray should do. Gated on
 * `featureMedicine` — a flag that hides a surface must hide it everywhere, including the ones
 * outside the app — and an off flag yields zero trays, so nothing about medicine reaches the
 * widget or the notification.
 */
function buildTrays(nowMinutes: number, today: string): { trays: WidgetTrayLine[]; dueMedicines: number; dueTrays: TrayId[] } {
  const s = useSettingsStore.getState();
  if (!s.featureMedicine) return { trays: [], dueMedicines: 0, dueTrays: [] };
  const t = getTranslations();
  const meds = useMedicineStore.getState().medicines.filter((m) => m.active);
  const doses = useMedicineStore.getState().doses;
  const times = s.medicineTrayTimes;
  const inUse = new Set(traysInUse(meds, times));

  const trays: WidgetTrayLine[] = [];
  const dueTrays: TrayId[] = [];
  let dueMedicines = 0;
  // TRAY_IDS is already morning → night, i.e. the order the day runs in.
  for (const tray of TRAY_IDS) {
    if (!inUse.has(tray)) continue;
    const { total, taken } = trayProgress(meds, doses, tray, today);
    const taken_all = taken >= total;
    const due = !taken_all && trayMinutes(times, tray) <= nowMinutes;
    if (due) {
      dueTrays.push(tray);
      dueMedicines += total - taken;
    }
    trays.push({
      id: tray,
      label: t.medicine.trays[tray],
      detail: t.widgets.trayProgress(taken, total),
      taken: taken_all,
      due,
    });
  }
  return { trays, dueMedicines, dueTrays };
}

/** Build the fully-localised snapshot from the current store state. */
export function buildWidgetSnapshot(): WidgetSnapshot {
  const t = getTranslations();
  const today = todayStr();

  // ── Tasks (today) ──
  // 'note' cards are dropped outright rather than merely uncounted: every row the widget
  // lists is tappable, and a tap flips `done` (lib/widgets/widgetActions.ts). A note has no
  // completion state, so offering one here would be offering a control that must not exist.
  const todayTasks = useTaskStore.getState().tasksForDate(today).filter((task) => isCompletable(task.cardType));
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
  // Openness comes from `episodeState`, never from `endDate === ''` (2026-08-01) — that
  // sentinel only means "no end recorded", which is what a quick log with no duration
  // writes. Before this the count included every entry that never got an end typed; it is
  // correct for the first time now, so expect it to drop to 0 on existing installs.
  const activeHealth = useHealthStore.getState().logs.filter((l) => isOpen(l) || l.date === today);
  const healthItems = activeHealth
    .slice(0, PREVIEW)
    .map((l) => ({ id: l.id, label: l.ailment, severity: l.severity, ongoing: isOpen(l) }));
  const ongoingCount = activeHealth.filter(isOpen).length;

  // ── Medicine trays (Health widget + the overview) ──
  const { trays, dueMedicines, dueTrays } = buildTrays(localMinutesOf(new Date()), today);

  // ── Overview lines ──
  // TWO renderings of the same day, and the split is the whole point (2026-08-15). `lines` is
  // the full one, for the widget and anything in-app. `safeLines` is what the pinned
  // notification posts, and its channel is PUBLIC — so it drops health outright and reduces
  // medicine to a count, where the full version names the trays that are still due. Anything
  // added below has to be filed into one or both deliberately; a line that lands in `lines`
  // alone is simply not on the lock screen, which is a legitimate answer.
  const nextTask = todayTasks.find((task) => !task.done);
  const nextTaskLine = nextTask ? (nextTask.time ? `${nextTask.time} · ${nextTask.title}` : nextTask.title) : '';

  const shared: string[] = [];
  if (tasksRemaining > 0) shared.push(t.widgets.tasksLeft(tasksRemaining));
  if (shopRemaining > 0) shared.push(t.widgets.itemsLeft(shopRemaining));
  if (habitsRemaining > 0) shared.push(t.widgets.habitsLeft(habitsRemaining));

  const overviewLines = [...shared];
  // "Still due: Morning, Midday" — t.medicine.stillDue is the app's own tray-card copy, so the
  // notification and the Health screen say the same thing in the same words.
  if (dueTrays.length > 0) {
    overviewLines.push(t.medicine.stillDue(dueTrays.map((tray) => t.medicine.trays[tray]).join(', ')));
  }
  // Health rides along on the full line only. It is a COUNT of open episodes and nothing more —
  // no day tally, no escalation, no second prompt — because lib/episodes.ts's promise is that an
  // episode open for a week reads exactly like one open for an hour.
  if (ongoingCount > 0) overviewLines.push(t.widgets.healthOngoing(ongoingCount));
  if (nextTaskLine) overviewLines.push(nextTaskLine);

  const overviewSafeLines = [...shared];
  if (dueMedicines > 0) overviewSafeLines.push(t.widgets.medicineDue(dueMedicines));
  if (nextTaskLine) overviewSafeLines.push(nextTaskLine);

  const healthSubtitle = [
    dueMedicines > 0 ? t.widgets.medicineDue(dueMedicines) : '',
    ongoingCount > 0 ? t.widgets.healthOngoing(ongoingCount) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    updatedAt: Date.now(),
    shopping: {
      title: list?.name || t.widgets.shoppingTitle,
      subtitle: shopRemaining > 0 ? t.widgets.itemsLeft(shopRemaining) : '',
      items: shopItems,
      more: listItems.length > PREVIEW ? t.widgets.more(listItems.length - PREVIEW) : '',
      empty: listItems.length === 0 ? t.widgets.noItems : t.widgets.allDone,
      accent: WIDGET_ACCENT.shop,
      hasContent: shopItems.length > 0,
    },
    tasks: {
      title: t.widgets.tasksTitle,
      subtitle: tasksRemaining > 0 ? t.widgets.tasksLeft(tasksRemaining) : '',
      items: taskItems,
      more: todayTasks.length > PREVIEW ? t.widgets.more(todayTasks.length - PREVIEW) : '',
      empty: t.widgets.noTasks,
      accent: WIDGET_ACCENT.task,
      hasContent: todayTasks.length > 0,
    },
    overview: {
      title: t.notif.overviewTitle,
      lines: overviewLines,
      safeLines: overviewSafeLines,
      empty: t.notif.overviewBodyNoTasks,
      accent: WIDGET_ACCENT.overview,
      hasContent: overviewLines.length > 0,
    },
    notes: {
      title: t.widgets.notesTitle,
      items: noteItems,
      more: activeNotes.length > PREVIEW ? t.widgets.more(activeNotes.length - PREVIEW) : '',
      empty: t.widgets.noNotes,
      voiceLabel: t.widgets.voiceNote,
      accent: WIDGET_ACCENT.notes,
      hasContent: noteItems.length > 0,
    },
    habits: {
      title: t.widgets.habitsTitle,
      subtitle: habitsRemaining > 0 ? t.widgets.habitsLeft(habitsRemaining) : '',
      items: habitItems,
      more: todayHabits.length > PREVIEW ? t.widgets.more(todayHabits.length - PREVIEW) : '',
      // No empty-state text (2026-08-12 — the "No habits today"/"Nothing logged" filler was
      // removed from both this card and Health's below; Empty() in WidgetViews.tsx renders
      // nothing for a blank string).
      empty: '',
      accent: WIDGET_ACCENT.habits,
      hasContent: todayHabits.length > 0,
    },
    health: {
      title: t.widgets.healthTitle,
      subtitle: healthSubtitle,
      items: healthItems,
      trays,
      more: activeHealth.length > PREVIEW ? t.widgets.more(activeHealth.length - PREVIEW) : '',
      // See the habits card's note above — no empty-state text here either.
      empty: '',
      accent: WIDGET_ACCENT.health,
      // A day with trays and no entries is a perfectly normal, and common, day.
      hasContent: healthItems.length > 0 || trays.length > 0,
    },
  };
}

/** Push the current live widgets (Android only; no-op / swallowed everywhere else). */
async function updateAndroidWidgets(snapshot: WidgetSnapshot) {
  if (Platform.OS !== 'android') return;
  try {
    // Lazily required so the native module is never referenced off-Android.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // `safeLines`, never `lines` — this is the surface that shows on a locked screen (see the
  // channel's PUBLIC visibility in lib/notifications.ts and the split where the two are built).
  // `?? lines` only ever fires for a snapshot object built by an older build.
  const lines = snapshot.overview.safeLines ?? snapshot.overview.lines;
  const body = lines.length > 0 ? lines.join(' · ') : t.notif.overviewNothingElse;
  await refreshPersistentNotification({
    title: snapshot.overview.title,
    body,
    color: WIDGET_ACCENT.overview,
  });
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

let widgetSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced trigger for store mutations: coalesces bursts (e.g. checking off several
 * shopping items back to back) into a single syncWidgetsAndOverview() call instead of
 * one per action.
 */
export function scheduleWidgetSync(delayMs = 1000) {
  if (widgetSyncTimer) clearTimeout(widgetSyncTimer);
  widgetSyncTimer = setTimeout(() => {
    widgetSyncTimer = null;
    void syncWidgetsAndOverview();
  }, delayMs);
  // Node/Jest timers expose unref() so a pending debounce never blocks process exit
  // (e.g. a store test that doesn't advance fake timers); RN/Hermes timers are plain
  // numbers with no such method, so this is a no-op there.
  (widgetSyncTimer as unknown as { unref?: () => void })?.unref?.();
}
