/**
 * habitNotifications.ts — build & (re)schedule a habit's daily reminders.
 *
 * Extracted from store/useHabitStore.ts so the store no longer reads the settings
 * store directly to schedule: the caller passes the relevant settings in. Content is
 * localised here; scheduling goes through lib/notifications. A habit can have
 * several reminders a day — each time in notificationTimes gets its own daily
 * trigger under id `habit-<id>-<i>` (legacy single reminders used `habit-<id>`).
 *
 * Decision 016 Q4 — quiet hours: an occurrence whose time falls inside the quiet
 * window is SKIPPED for that day, never shifted (habits skip; tasks, in a future
 * task-notifications phase, shift via lib/notifications.ts's pushPastQuietHours —
 * deliberately not reused here).
 *
 * Connections:
 *   Imports → lib/notifications, lib/i18n (+ Habit/Language types)
 *   Used by → store/useHabitStore.ts
 *   Data    → schedules OS notifications (no SQLite/store access)
 *
 * Edit notes:
 *   - Always cancel via cancelHabitReminders() before rescheduling so removed
 *     occurrences (and any legacy `habit-<id>` key) don't linger.
 *   - Decision 016 Q2: no fallback to a legacy single `notificationTime` here —
 *     `notificationTimes` is the sole live source of truth (empty ⇒ no reminders).
 */
import type { Habit } from '@/store/useHabitStore';
import type { Language } from '@/store/useSettingsStore';
import { getTranslations } from '@/lib/i18n';
import { scheduleDailyReminder, cancelDailyReminder, isWithinQuietHours } from '@/lib/notifications';

/** Upper bound on reminders-per-habit we schedule/cancel — keeps the cancel loop finite. */
const MAX_HABIT_REMINDERS = 24;

/** The settings a habit reminder depends on (a structural subset of the settings store). */
export type HabitNotifSettings = {
  habitNotificationsEnabled: boolean;
  language: Language;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

/** Cancel every reminder occurrence for a habit (indexed keys + the legacy single key). */
export async function cancelHabitReminders(habitId: string): Promise<void> {
  await cancelDailyReminder(`habit-${habitId}`); // legacy single-reminder key
  for (let i = 0; i < MAX_HABIT_REMINDERS; i++) {
    await cancelDailyReminder(`habit-${habitId}-${i}`);
  }
}

/**
 * Schedule (or cancel) a habit's daily reminders, honouring the given settings.
 * Occurrences that fall inside quiet hours are skipped for that day, not shifted
 * (Decision 016 Q4) — they simply stay unscheduled since everything was already
 * cancelled above.
 */
export function syncHabitReminder(habit: Habit, s: HabitNotifSettings): void {
  void cancelHabitReminders(habit.id);
  if (!s.habitNotificationsEnabled || !habit.notificationEnabled || !habit.active) return;
  if (habit.notificationTimes.length === 0) return;

  const t = getTranslations(s.language);
  habit.notificationTimes.slice(0, MAX_HABIT_REMINDERS).forEach((time, i) => {
    const [h, m] = (time || '08:00').split(':').map((n) => parseInt(n, 10));
    const hour = Number.isFinite(h) ? h : 8;
    const minute = Number.isFinite(m) ? m : 0;
    if (s.quietHoursEnabled && isWithinQuietHours(hour, minute, s.quietHoursStart, s.quietHoursEnd)) return;
    void scheduleDailyReminder(`habit-${habit.id}-${i}`, hour, minute, {
      title: t.notif.habitReminderTitle(habit.title),
      body: t.notif.habitReminderBody,
    });
  });
}
