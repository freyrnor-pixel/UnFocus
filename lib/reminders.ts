/**
 * reminders.ts — coordinator that turns settings into scheduled weekly/monthly reminders.
 *
 * syncReminders() reads the settings store + active language, builds localised
 * Content, and (re)schedules or cancels the weekly planning nudge and monthly
 * shopping-reset reminder via lib/notifications. Call after any reminder/language
 * setting change or on app start.
 *
 * Connections:
 *   Imports → lib/date, lib/time, lib/i18n, lib/notifications, store/useSettingsStore
 *   Used by → app/_layout.tsx, app/onboarding/step5.tsx, app/settings.tsx
 *   Data    → reads settings store; schedules OS notifications
 *
 * Edit notes:
 *   - Weekday conversion: app stores 0=Mon..6=Sun, Expo wants 1=Sun..7=Sat —
 *     use toExpoWeekday from lib/date (shared with task reminders).
 *   - parseTimeOrDefault (lib/time) falls back to 08:00 on malformed "HH:MM";
 *     the user's reminderTime always wins — the fallback only covers bad input.
 *   - Weekly + monthly share reminderTime, so the monthly reminder is staggered
 *     by MONTHLY_OFFSET_MIN minutes (clamped to the same day) to avoid two
 *     banners firing at the same instant when reset day and date coincide.
 */
import { useSettingsStore } from '@/store/useSettingsStore';
import { toExpoWeekday } from '@/lib/date';
import { parseTimeOrDefault } from '@/lib/time';
import { getTranslations } from '@/lib/i18n';
import {
  scheduleWeeklyReminder,
  cancelWeeklyReminder,
  scheduleMonthlyReminder,
  cancelMonthlyReminder,
} from '@/lib/notifications';

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
  await scheduleMonthlyReminder(s.monthlyResetDate, mHour, mMinute, {
    title: t.notif.monthlyTitle,
    body: t.notif.monthlyBody,
  });
}
