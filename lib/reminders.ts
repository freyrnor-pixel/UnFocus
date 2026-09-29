/**
 * reminders.ts — coordinator that turns settings into scheduled weekly/monthly reminders.
 *
 * syncReminders() reads the settings store + active language, builds localised
 * Content, and (re)schedules or cancels the weekly planning nudge and monthly
 * shopping-reset reminder via lib/notifications. Call after any reminder/language
 * setting change or on app start.
 *
 * Connections:
 *   Imports → lib/date (toExpoWeekday, monthlyResetDayIn), lib/time, lib/i18n, lib/notifications, store/useSettingsStore
 *   Used by → app/_layout.tsx, app/onboarding/privacy.tsx (finishSetup — the single
 *             completion path since the 2026-08-03 two-screen cut), app/settings.tsx
 *   Data    → reads settings store; schedules OS notifications
 *
 * Edit notes:
 *   - Weekday conversion: app stores 0=Mon..6=Sun, Expo wants 1=Sun..7=Sat —
 *     use toExpoWeekday from lib/date (shared with task reminders).
 *   - parseTimeOrDefault (lib/time) falls back to 08:00 on malformed "HH:MM";
 *     the user's reminderTime always wins — the fallback only covers bad input.
 *   - A reset day of 29–31 is armed as a one-off for the next CLAMPED date
 *     (nextMonthlyReminderDate) rather than a native MONTHLY trigger, which would skip
 *     every shorter month. That needs re-arming, so app/_layout.tsx calls syncReminders()
 *     on every foreground (it is idempotent).
 *   - Weekly + monthly share reminderTime, so the monthly reminder is staggered
 *     by MONTHLY_OFFSET_MIN minutes (clamped to the same day) to avoid two
 *     banners firing at the same instant when reset day and date coincide.
 */
import { useSettingsStore } from '@/store/useSettingsStore';
import { monthlyResetDayIn, toExpoWeekday } from '@/lib/date';
import { parseTimeOrDefault } from '@/lib/time';
import { getTranslations } from '@/lib/i18n';
import {
  scheduleWeeklyReminder,
  cancelWeeklyReminder,
  scheduleMonthlyReminder,
  scheduleMonthlyReminderAt,
  cancelMonthlyReminder,
} from '@/lib/notifications';

/** The last day-of-month every month has; above it a native MONTHLY trigger skips months. */
const SAFE_MONTHLY_DAY = 28;

/**
 * The next instant, strictly after `now`, at which the monthly reminder should fire: the
 * reset day clamped to each month's length (lib/date's monthlyResetDayIn) at hour:minute.
 */
export function nextMonthlyReminderDate(now: Date, resetDate: number, hour: number, minute: number): Date {
  for (let i = 0; i < 3; i++) {
    const d = monthlyResetDayIn(now.getFullYear(), now.getMonth() + i, resetDate);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() > now.getTime()) return d;
  }
  // Unreachable: some month within three always has a future reset day.
  const d = monthlyResetDayIn(now.getFullYear(), now.getMonth() + 1, resetDate);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Weekly + monthly reminders share the user's reminderTime, so when a reset day
 * and reset date land on the same calendar day they would fire at the exact same
 * instant. We nudge the monthly reminder a few minutes later so the two banners
 * don't collide. Kept small (and time-of-day only) so it never crosses midnight
 * or otherwise drifts the user's chosen time meaningfully.
 */
const MONTHLY_OFFSET_MIN = 3;

/** Add `add` minutes to [hour, minute], clamped to stay within the same day. */
function offsetMinutes([hour, minute]: [number, number], add: number): [number, number] {
  const total = Math.min(hour * 60 + minute + add, 23 * 60 + 59);
  return [Math.floor(total / 60), total % 60];
}

/**
 * Re-schedule the weekly planning nudge and the monthly shopping-reset reminder
 * from the current settings. Call after changing any reminder-related setting,
 * the language, or on app start.
 */
export async function syncReminders() {
  const s = useSettingsStore.getState();
  const t = getTranslations(s.language);

  if (!s.remindersEnabled) {
    await cancelWeeklyReminder();
    await cancelMonthlyReminder();
    return;
  }

  const [hour, minute] = parseTimeOrDefault(s.reminderTime);
  await scheduleWeeklyReminder(toExpoWeekday(s.weeklyResetDay), hour, minute, {
    title: t.notif.weeklyTitle,
    body: t.notif.weeklyBody,
  });
  // Stagger the monthly reminder a few minutes past the weekly one so the two
  // never fire at the same instant if the reset day and date coincide.
  const [mHour, mMinute] = offsetMinutes([hour, minute], MONTHLY_OFFSET_MIN);
  const monthlyContent = { title: t.notif.monthlyTitle, body: t.notif.monthlyBody };
  if (s.monthlyResetDate > SAFE_MONTHLY_DAY) {
    // A native MONTHLY trigger on day 29–31 skips every shorter month. Arm the clamped date
    // as a one-off instead; app/_layout.tsx re-runs this on every foreground to re-arm it.
    await scheduleMonthlyReminderAt(
      nextMonthlyReminderDate(new Date(), s.monthlyResetDate, mHour, mMinute),
      monthlyContent
    );
  } else {
    await scheduleMonthlyReminder(s.monthlyResetDate, mHour, mMinute, monthlyContent);
  }
}
