/**
 * reminders.test.ts — unit tests for lib/reminders.ts (syncReminders).
 *
 * Verifies the scheduling decisions without touching the OS: notifications, the
 * settings store, and i18n are all mocked. Covers the enabled/disabled branch,
 * the app→Expo weekday conversion, and the monthly stagger (incl. its clamp).
 */
// Mocks are declared inside the factories (not captured consts) so they survive
// jest.mock hoisting; typed handles are grabbed via the imports below.
jest.mock('@/lib/notifications', () => ({
  scheduleWeeklyReminder: jest.fn().mockResolvedValue(undefined),
  cancelWeeklyReminder: jest.fn().mockResolvedValue(undefined),
  scheduleMonthlyReminder: jest.fn().mockResolvedValue(undefined),
  cancelMonthlyReminder: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/store/useSettingsStore', () => ({ useSettingsStore: { getState: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({
  getTranslations: () => ({
    notif: { weeklyTitle: 'wt', weeklyBody: 'wb', monthlyTitle: 'mt', monthlyBody: 'mb' },
  }),
}));

import * as notifModule from '@/lib/notifications';
import { useSettingsStore } from '@/store/useSettingsStore';
import { syncReminders } from '@/lib/reminders';

const notif = notifModule as unknown as {
  scheduleWeeklyReminder: jest.Mock;
  cancelWeeklyReminder: jest.Mock;
  scheduleMonthlyReminder: jest.Mock;
  cancelMonthlyReminder: jest.Mock;
};
const getState = useSettingsStore.getState as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('syncReminders', () => {
  it('cancels both reminders and schedules nothing when disabled', async () => {
    getState.mockReturnValue({ remindersEnabled: false, language: 'no' });
    await syncReminders();
    expect(notif.cancelWeeklyReminder).toHaveBeenCalledTimes(1);
    expect(notif.cancelMonthlyReminder).toHaveBeenCalledTimes(1);
    expect(notif.scheduleWeeklyReminder).not.toHaveBeenCalled();
    expect(notif.scheduleMonthlyReminder).not.toHaveBeenCalled();
  });

  it('schedules weekly (Expo weekday) + monthly staggered by 3 min when enabled', async () => {
    getState.mockReturnValue({
      remindersEnabled: true,
      reminderTime: '08:00',
      weeklyResetDay: 0, // Monday → Expo weekday 2
      monthlyResetDate: 15,
      language: 'en',
    });
    await syncReminders();
    expect(notif.scheduleWeeklyReminder).toHaveBeenCalledWith(2, 8, 0, {
      title: 'wt',
      body: 'wb',
    });
    // Monthly shares reminderTime but is nudged +3 minutes to avoid a collision.
    expect(notif.scheduleMonthlyReminder).toHaveBeenCalledWith(15, 8, 3, {
      title: 'mt',
      body: 'mb',
    });
  });

  it('clamps the monthly stagger so it never crosses midnight', async () => {
    getState.mockReturnValue({
      remindersEnabled: true,
      reminderTime: '23:58', // +3 would be 00:01 next day → clamp to 23:59
      weeklyResetDay: 6, // Sunday → Expo weekday 1
      monthlyResetDate: 1,
      language: 'en',
    });
    await syncReminders();
    expect(notif.scheduleWeeklyReminder).toHaveBeenCalledWith(1, 23, 58, expect.any(Object));
    expect(notif.scheduleMonthlyReminder).toHaveBeenCalledWith(1, 23, 59, expect.any(Object));
  });
});
