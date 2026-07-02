/**
 * notifications.ts — low-level expo-notifications scheduling primitives.
 *
 * Configures the foreground notification handler and exposes language-agnostic
 * schedule/cancel helpers (weekly, monthly, per-task one-off, recurring weekly
 * task, daily/habit, persistent overview, snooze re-nudge). Callers pass
 * already-localised Content; this module never builds strings itself. Uses
 * stable identifiers so re-scheduling replaces. Also owns quiet-hours time math
 * (isWithinQuietHours/pushPastQuietHours) and the interactive "Done"/"Remind me
 * later" notification action buttons (syncNotificationCategories, onNotificationAction).
 *
 * Ported in full (Phase 5, habit store+form session) even though only
 * scheduleDailyReminder/cancelDailyReminder/isWithinQuietHours are consumed today
 * (via lib/habitNotifications.ts) — this is a single self-contained primitives file
 * with zero SQLite/store coupling (see Data line below), so splitting out a
 * habit-only slice would fork it from the file a future task-notifications phase
 * needs verbatim. Same "port the foundational file whole, ahead of every consumer"
 * precedent already used for lib/date.ts and lib/id.ts. Everything task/weekly/
 * monthly/persistent/re-nudge-related below is currently unused (no store calls it
 * yet) — inert until that phase wires it up, matching every other "ported ahead of
 * its consumer" component in this repo.
 *
 * Connections:
 *   Imports → —
 *   Used by → lib/habitNotifications.ts (store/useHabitStore.ts); everything else
 *             (task/weekly/monthly/persistent/re-nudge helpers) is unconsumed until
 *             a future task-notifications phase wires it up
 *   Data    → schedules OS notifications (no SQLite/store)
 *
 * Edit notes:
 *   - Keep notification identifiers consistent between schedule and cancel
 *     (e.g. `task-${id}`, `daily-${key}`) or cancellation silently misses.
 *   - Scheduling failures are swallowed via `ignore` — intentional, never crash the UI.
 *   - Content must already be localised by the caller; do not import i18n here.
 *     syncNotificationCategories() follows the same rule — it takes already-localised
 *     button labels rather than a language code, so this file never imports lib/i18n.
 *   - refreshPersistentNotification only calls scheduleNotificationAsync when the
 *     content actually changed since the last call (module-level cache) — Android
 *     bumps a notification's position/recency on every notify(), so re-posting
 *     identical content on every app open made it look like a fresh alert.
 *   - The persistent notification lives on its own Android channel
 *     (PERSISTENT_CHANNEL_ID) with showBadge: false and LOW importance, so it
 *     never contributes an app-icon badge count or a heads-up popup.
 *   - Content.color (optional) tints the small notification icon on Android —
 *     used by the persistent overview to mirror a task's in-app accent color.
 *   - This is the ONLY file that imports 'expo-notifications' directly — other
 *     files (e.g. app/_layout.tsx) must go through onNotificationAction() rather
 *     than adding their own response listener, so the native import stays here.
 *   - isWithinQuietHours/pushPastQuietHours are pure time-of-day math (HH:MM in,
 *     no Date objects) so the same helpers work for both one-off tasks (which
 *     have a real Date) and weekly-recurring occurrences (which only have
 *     hour/minute/weekday) — callers convert their own Date/weekday as needed.
 *     Habit reminders (lib/habitNotifications.ts) consult isWithinQuietHours only
 *     — they SKIP a daily occurrence that falls inside the window rather than
 *     pushing it past the end (Decision 016 Q4); pushPastQuietHours is the
 *     task-side shift behaviour, deliberately not reused for habits.
 *   - scheduleReNudge/cancelReNudge use the `${taskId}-renudge` identifier suffix,
 *     parallel to cancelTaskNotification's `-s${day}`/`-e${day}` convention.
 */
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * All scheduling helpers are language-agnostic: callers pass already-localised
 * text via `Content`. Building the strings is the coordinator's job (see
 * lib/habitNotifications.ts and, later, a task-notifications equivalent), so the
 * user's chosen language is the single source of truth.
 */
export type Content = { title: string; body: string; color?: string };

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function ignore() {
  /* scheduling can fail silently (permissions, past dates) — never crash the UI */
}

// ── Weekly planning reminder ────────────────────────────────────────────────
export async function scheduleWeeklyReminder(
  weekday: number, // Expo weekday: 1 = Sunday … 7 = Saturday
  hour: number,
  minute: number,
  content: Content
) {
  await cancelWeeklyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly-reminder',
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  }).catch(ignore);
}

export async function cancelWeeklyReminder() {
  await Notifications.cancelScheduledNotificationAsync('weekly-reminder').catch(ignore);
}

// ── Monthly shopping-list reset reminder ────────────────────────────────────
export async function scheduleMonthlyReminder(
  dayOfMonth: number,
  hour: number,
  minute: number,
  content: Content
) {
  await cancelMonthlyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: 'monthly-reset',
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: dayOfMonth,
      hour,
      minute,
    },
  }).catch(ignore);
}

export async function cancelMonthlyReminder() {
  await Notifications.cancelScheduledNotificationAsync('monthly-reset').catch(ignore);
}

// ── Per-task reminder (one-off, fires at a specific date/time) ───────────────
export async function scheduleTaskNotification(
  id: string,
  date: Date,
  content: Content,
  end?: { date: Date; content: Content }
) {
  await cancelTaskNotification(id);
  await Notifications.scheduleNotificationAsync({
    identifier: `task-${id}`,
    content: { ...content, data: { taskId: id }, categoryIdentifier: 'task-reminder' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  }).catch(ignore);

  if (end) {
    await Notifications.scheduleNotificationAsync({
      identifier: `task-end-${id}`,
      content: { ...end.content, data: { taskId: id, isEnd: true }, categoryIdentifier: 'task-reminder' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: end.date },
    }).catch(ignore);
  }
}

// A single weekly occurrence of a recurring task's reminder. `suffix` makes the
// identifier unique within the task (e.g. "s3" = start on day 3, "e3" = its end).
export type WeeklyTaskOccurrence = {
  suffix: string;
  weekday: number; // Expo weekday: 1 = Sunday … 7 = Saturday
  hour: number;
  minute: number;
  content: Content;
};

// Recurring task reminders: one repeating weekly trigger per occurrence.
export async function scheduleWeeklyTaskNotifications(
  id: string,
  occurrences: WeeklyTaskOccurrence[]
) {
  await cancelTaskNotification(id);
  for (const o of occurrences) {
    await Notifications.scheduleNotificationAsync({
      identifier: `task-${id}-${o.suffix}`,
      content: { ...o.content, data: { taskId: id }, categoryIdentifier: 'task-reminder' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: o.weekday,
        hour: o.hour,
        minute: o.minute,
      },
    }).catch(ignore);
  }
}

export async function cancelTaskNotification(id: string) {
  // Clears both the one-off reminders and every weekly occurrence (start + end
  // for each of the seven possible days), so it works whatever kind the task is.
  await Notifications.cancelScheduledNotificationAsync(`task-${id}`).catch(ignore);
  await Notifications.cancelScheduledNotificationAsync(`task-end-${id}`).catch(ignore);
  for (let d = 0; d < 7; d++) {
    await Notifications.cancelScheduledNotificationAsync(`task-${id}-s${d}`).catch(ignore);
    await Notifications.cancelScheduledNotificationAsync(`task-${id}-e${d}`).catch(ignore);
  }
}

// ── Daily reminder (used for habits) ────────────────────────────────────────
export async function scheduleDailyReminder(
  key: string,
  hour: number,
  minute: number,
  content: Content
) {
  await cancelDailyReminder(key);
  await Notifications.scheduleNotificationAsync({
    identifier: `daily-${key}`,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  }).catch(ignore);
}

export async function cancelDailyReminder(key: string) {
  await Notifications.cancelScheduledNotificationAsync(`daily-${key}`).catch(ignore);
}

// ── Quiet hours ──────────────────────────────────────────────────────────────
/** Parses "HH:MM" into minutes-since-midnight; malformed input reads as 0. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * True when `hour`/`minute` falls inside the [start, end) quiet window. Handles
 * windows that cross midnight (e.g. start='21:00', end='08:00') as well as
 * same-day windows (e.g. start='13:00', end='15:00'). A zero-width window
 * (start === end) is treated as "always off", not "always on".
 */
export function isWithinQuietHours(hour: number, minute: number, start: string, end: string): boolean {
  const t = hour * 60 + minute;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

/**
 * If `hour`/`minute` falls inside quiet hours, returns the window's end time
 * instead (so the caller can defer a notification past it); otherwise returns
 * the original time unchanged. `rolledOver` tells the caller whether the
 * pushed time lands on the next calendar day (true whenever the quiet window
 * wraps past midnight and the original time was on its "evening" side).
 */
export function pushPastQuietHours(
  hour: number,
  minute: number,
  start: string,
  end: string
): { hour: number; minute: number; rolledOver: boolean } {
  if (!isWithinQuietHours(hour, minute, start, end)) return { hour, minute, rolledOver: false };
  const [eh, em] = end.split(':').map((n) => parseInt(n, 10));
  const rolledOver = eh * 60 + em <= hour * 60 + minute;
  return { hour: eh, minute: em, rolledOver };
}

// ── Persistent "today's overview" notification ──────────────────────────────
const PERSISTENT_CHANNEL_ID = 'persistent-overview';

let persistentChannelReady = false;
async function ensurePersistentChannel() {
  if (persistentChannelReady) return;
  persistentChannelReady = true;
  await Notifications.setNotificationChannelAsync(PERSISTENT_CHANNEL_ID, {
    name: 'Daily overview',
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
    sound: null,
    enableVibrate: false,
    vibrationPattern: [],
  }).catch(ignore);
}

// Fires immediately under a stable identifier, so each call replaces the
// previous one in place rather than stacking new notifications. Skips the
// native call entirely when the content hasn't changed since the last call,
// so opening the app doesn't re-surface/reorder it when nothing is new.
let lastPersistentContentKey: string | null = null;
export async function refreshPersistentNotification(content: Content) {
  const key = `${content.title} ${content.body} ${content.color ?? ''}`;
  if (key === lastPersistentContentKey) return;
  lastPersistentContentKey = key;
  await ensurePersistentChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: 'persistent-overview',
    content: { ...content, sticky: true, autoDismiss: false, sound: false, vibrate: [] },
    trigger: { channelId: PERSISTENT_CHANNEL_ID },
  }).catch(ignore);
}

export async function cancelPersistentNotification() {
  lastPersistentContentKey = null;
  await Notifications.dismissNotificationAsync('persistent-overview').catch(ignore);
  await Notifications.cancelScheduledNotificationAsync('persistent-overview').catch(ignore);
}

// ── Re-nudge (snooze follow-up) ─────────────────────────────────────────────
/** One-off follow-up notification fired `delayMs` after the original reminder was snoozed. */
export async function scheduleReNudge(taskId: string, delayMs: number, content: Content) {
  await cancelReNudge(taskId);
  await Notifications.scheduleNotificationAsync({
    identifier: `${taskId}-renudge`,
    content: { ...content, data: { taskId }, categoryIdentifier: 'task-reminder' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(delayMs / 1000)),
    },
  }).catch(ignore);
}

export async function cancelReNudge(taskId: string) {
  await Notifications.cancelScheduledNotificationAsync(`${taskId}-renudge`).catch(ignore);
}

// ── Interactive notification actions (Done / Remind me later) ──────────────
/**
 * Registers the "task-reminder" category's action buttons. Button titles are
 * already-localised strings (see the file-level edit note) — call again
 * whenever the language changes so the OS-level buttons stay in sync.
 */
export async function syncNotificationCategories(doneLabel: string, snoozeLabel: string) {
  await Notifications.setNotificationCategoryAsync('task-reminder', [
    { identifier: 'done', buttonTitle: doneLabel },
    { identifier: 'snooze', buttonTitle: snoozeLabel },
  ]).catch(ignore);
}

export type NotificationActionId = 'done' | 'snooze';

/**
 * Subscribes to taps on the action buttons registered by syncNotificationCategories.
 * Only fires for responses carrying a `data.taskId` (i.e. task reminders, not
 * weekly/monthly/habit/persistent notifications). Returns an unsubscribe function.
 */
export function onNotificationAction(
  handler: (action: NotificationActionId, taskId: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const taskId = response.notification.request.content.data?.taskId as string | undefined;
    const actionId = response.actionIdentifier;
    if (!taskId || (actionId !== 'done' && actionId !== 'snooze')) return;
    handler(actionId, taskId);
  });
  return () => subscription.remove();
}
