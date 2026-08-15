/**
 * notifications.ts — low-level expo-notifications scheduling primitives.
 *
 * Configures the foreground notification handler and exposes language-agnostic
 * schedule/cancel helpers (weekly, monthly, per-task one-off, recurring weekly
 * task, recurring daily task, daily/habit, persistent overview, snooze
 * re-nudge). Callers pass
 * already-localised Content; this module never builds strings itself. Uses
 * stable identifiers so re-scheduling replaces. Also owns quiet-hours time math
 * (isWithinQuietHours/pushPastQuietHours) and the interactive notification action
 * buttons — two independent categories: 'task-reminder' ("Done"/"Remind me later",
 * syncNotificationCategories + onNotificationAction, payload `data.taskId`) and
 * 'medicine-reminder' ("Taken"/"Remind me later", syncMedicineCategories +
 * onMedicineAction + scheduleTrayReNudge, payload `data.medicineTray`). Each listener
 * filters on its own payload key, so both can be mounted at once.
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
 *   Used by → lib/habitNotifications.ts (store/useHabitStore.ts);
 *             lib/medicineNotifications.ts (store/useMedicineStore.ts — per-tray daily
 *             reminders + the 'medicine-reminder' category);
 *             lib/widgets/sync.ts (refreshPersistentNotification / cancelPersistentNotification —
 *             the persistent "today's overview" notification, gated on the persistentNotifEnabled
 *             setting); the remaining task/weekly/monthly/re-nudge helpers are unconsumed until
 *             a future task-notifications phase wires them up
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
 *     never contributes an app-icon badge count or a heads-up popup. Its lockscreen
 *     visibility is PUBLIC (2026-08-15) so the pinned overview is readable without
 *     unlocking — read PERSISTENT_CHANNEL_ID's block before changing that value or the
 *     id, because Android freezes a channel's importance/visibility/sound at creation.
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
import type { Language } from '@/store/useSettingsStore';

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

// Recurring DAILY task reminder: a real repeating native trigger, mirroring
// scheduleWeeklyTaskNotifications — unlike monthly recurrence, "every day" has
// a direct native trigger so no next-occurrence/re-arm dance is needed.
export async function scheduleDailyTaskNotification(
  id: string,
  hour: number,
  minute: number,
  content: Content,
  end?: { hour: number; minute: number; content: Content }
) {
  await cancelTaskNotification(id);
  await Notifications.scheduleNotificationAsync({
    identifier: `task-${id}-daily`,
    content: { ...content, data: { taskId: id }, categoryIdentifier: 'task-reminder' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  }).catch(ignore);
  if (end) {
    await Notifications.scheduleNotificationAsync({
      identifier: `task-${id}-daily-end`,
      content: { ...end.content, data: { taskId: id, isEnd: true }, categoryIdentifier: 'task-reminder' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: end.hour, minute: end.minute },
    }).catch(ignore);
  }
}

export async function cancelTaskNotification(id: string) {
  // Clears the one-off reminders, the daily-recurring pair, and every weekly
  // occurrence (start + end for each of the seven possible days), so it works
  // whatever kind the task is.
  await Notifications.cancelScheduledNotificationAsync(`task-${id}`).catch(ignore);
  await Notifications.cancelScheduledNotificationAsync(`task-end-${id}`).catch(ignore);
  await Notifications.cancelScheduledNotificationAsync(`task-${id}-daily`).catch(ignore);
  await Notifications.cancelScheduledNotificationAsync(`task-${id}-daily-end`).catch(ignore);
  for (let d = 0; d < 7; d++) {
    await Notifications.cancelScheduledNotificationAsync(`task-${id}-s${d}`).catch(ignore);
    await Notifications.cancelScheduledNotificationAsync(`task-${id}-e${d}`).catch(ignore);
  }
}

// ── Daily reminder (used for habits and medicine trays) ─────────────────────
/**
 * `opts` is how a caller opts INTO interactive buttons: `categoryIdentifier` picks the
 * registered category (see syncNotificationCategories / syncMedicineCategories) and
 * `data` is the payload the corresponding onNotificationAction/onMedicineAction listener
 * filters on. Habit reminders pass neither and stay plain, non-actionable notifications.
 */
export async function scheduleDailyReminder(
  key: string,
  hour: number,
  minute: number,
  content: Content,
  opts: { data?: Record<string, string>; categoryIdentifier?: string } = {}
) {
  await cancelDailyReminder(key);
  await Notifications.scheduleNotificationAsync({
    identifier: `daily-${key}`,
    content: { ...content, ...(opts.data ? { data: opts.data } : {}), ...(opts.categoryIdentifier ? { categoryIdentifier: opts.categoryIdentifier } : {}) },
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
 * The quiet-hours settings every scheduler needs, plus the language its copy is baked in.
 *
 * lib/taskNotifications.ts, lib/habitNotifications.ts and lib/medicineNotifications.ts each
 * declared these same four fields inline on their own `XNotifSettings` type; they extend
 * this now and add only what is theirs. A structural subset of the settings store, so a
 * caller can keep passing the store object straight through.
 */
export type QuietHoursSettings = {
  language: Language;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

/**
 * Whether a reminder at `hour`:`minute` should be SKIPPED entirely for quiet hours.
 *
 * Habits and medicine trays skip; tasks defer instead (see `pushPastQuietHours` below).
 * That split is deliberate — a habit or a dose window has a natural next occurrence, so a
 * skipped one is simply not nudged, whereas a task reminder has only the one chance and is
 * pushed past the window. lib/habitNotifications.ts and lib/medicineNotifications.ts had
 * this same condition written out inline.
 */
export function shouldSkipForQuietHours(hour: number, minute: number, s: QuietHoursSettings): boolean {
  return s.quietHoursEnabled && isWithinQuietHours(hour, minute, s.quietHoursStart, s.quietHoursEnd);
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
/**
 * ⚠️ **The `-v2` suffix is load-bearing and the id must never be edited in place.**
 *
 * Android treats a channel's importance, sound and lockscreen visibility as immutable after
 * the first `createNotificationChannel` for that id: a later call with the same id updates
 * only the name/description/group and silently drops everything else, because those fields
 * belong to the user once the channel exists. The 2026-08-15 pass turned this notification's
 * lockscreen visibility PUBLIC (it had never been set, so it sat at Android's `PRIVATE`
 * default and showed "contents hidden" on a secure lock screen — the one place a pinned
 * overview is worth having). On every install that had already posted an overview, setting
 * it on the old `persistent-overview` id would have been a no-op. Hence a new id, plus a
 * one-shot delete of the legacy one so the shade doesn't list two "Daily overview" channels.
 *
 * If a future change touches importance/visibility/sound again, bump to `-v3` the same way.
 */
const PERSISTENT_CHANNEL_ID = 'persistent-overview-v2';
const LEGACY_PERSISTENT_CHANNEL_IDS = ['persistent-overview'];

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
    // Readable on a locked screen. lib/widgets/sync.ts is what keeps that safe: the body it
    // posts is the snapshot's `overview.safeLines`, which omits health entirely and reduces
    // medicine to a bare count — the widget's own `overview.lines` is the fuller version.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).catch(ignore);
  for (const legacy of LEGACY_PERSISTENT_CHANNEL_IDS) {
    await Notifications.deleteNotificationChannelAsync(legacy).catch(ignore);
  }
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

/**
 * Registers the "medicine-reminder" category — a tray reminder's Taken / Remind-me-later
 * buttons, so a dose can be logged from the notification shade without opening the app
 * (the single most-used path for "did I take it?"). Kept a SEPARATE category from
 * 'task-reminder' because the actions mean different things and carry different payloads
 * (a tray id, not a task id); same already-localised-labels contract.
 */
export async function syncMedicineCategories(takenLabel: string, snoozeLabel: string) {
  await Notifications.setNotificationCategoryAsync('medicine-reminder', [
    { identifier: 'med-taken', buttonTitle: takenLabel },
    { identifier: 'med-snooze', buttonTitle: snoozeLabel },
  ]).catch(ignore);
}

export type MedicineActionId = 'med-taken' | 'med-snooze';

/**
 * Subscribes to taps on a medicine tray reminder's buttons. Only fires for responses
 * carrying `data.medicineTray`, so it ignores task/habit/persistent notifications
 * entirely — that's what lets it coexist with onNotificationAction's own listener.
 * Returns an unsubscribe function.
 */
export function onMedicineAction(
  handler: (action: MedicineActionId, tray: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const tray = response.notification.request.content.data?.medicineTray as string | undefined;
    const actionId = response.actionIdentifier;
    if (!tray || (actionId !== 'med-taken' && actionId !== 'med-snooze')) return;
    handler(actionId, tray);
  });
  return () => subscription.remove();
}

/** One-off follow-up for a snoozed medicine tray reminder (mirrors scheduleReNudge). */
export async function scheduleTrayReNudge(tray: string, delayMs: number, content: Content) {
  await cancelTrayReNudge(tray);
  await Notifications.scheduleNotificationAsync({
    identifier: `medtray-${tray}-renudge`,
    content: { ...content, data: { medicineTray: tray }, categoryIdentifier: 'medicine-reminder' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(delayMs / 1000)),
    },
  }).catch(ignore);
}

export async function cancelTrayReNudge(tray: string) {
  await Notifications.cancelScheduledNotificationAsync(`medtray-${tray}-renudge`).catch(ignore);
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
