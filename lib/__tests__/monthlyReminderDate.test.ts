/**
 * monthlyReminderDate.test.ts — lib/reminders.ts's clamped monthly-reset reminder date.
 *
 * A native MONTHLY trigger on day 29–31 skips every shorter month, while Settings promises
 * "a short month resets on its last day". Since 2026-09-29 those days are armed as a one-off
 * for the next clamped date; this pins the date math.
 */
import { nextMonthlyReminderDate } from '@/lib/reminders';

jest.mock('@/lib/notifications', () => ({}));
jest.mock('@/store/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({}) } }));
jest.mock('@/lib/i18n', () => ({ getTranslations: () => ({}) }));

const at = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

test('day 31 in a 30-day month fires on the 30th', () => {
  expect(at(nextMonthlyReminderDate(new Date(2026, 8, 10, 12), 31, 8, 3))).toBe('2026-09-30 8:03');
});

test('day 31 after this month\'s has passed goes to the next month\'s last day', () => {
  expect(at(nextMonthlyReminderDate(new Date(2026, 0, 31, 9), 31, 8, 3))).toBe('2026-02-28 8:03');
});

test('same day, before the time → today', () => {
  expect(at(nextMonthlyReminderDate(new Date(2026, 3, 30, 7), 31, 8, 3))).toBe('2026-04-30 8:03');
});

test('crosses the year', () => {
  expect(at(nextMonthlyReminderDate(new Date(2026, 11, 31, 9), 30, 8, 0))).toBe('2027-01-30 8:00');
});
