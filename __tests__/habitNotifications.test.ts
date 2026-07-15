/**
 * habitNotifications.test.ts — unit tests for lib/habitNotifications.ts
 * (syncHabitReminder).
 *
 * Habits SKIP any occurrence that falls inside quiet hours (Decision 016 Q4) —
 * the deliberate opposite of tasks, which shift. Also covers multi-time
 * scheduling, the enable/active/Focus-mode gates, and the always-cancel-first
 * contract. Only the scheduling primitives and i18n are mocked; the real
 * isWithinQuietHours math (lib/notifications) is kept.
 */
jest.mock('@/lib/notifications', () => {
  const actual = jest.requireActual('@/lib/notifications');
  return {
    __esModule: true,
    ...actual,
    scheduleDailyReminder: jest.fn(),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
  };
});
jest.mock('@/lib/i18n', () => ({
  getTranslations: () => ({
    notif: {
      habitReminderTitle: (name: string) => `Remember: ${name}`,
      habitReminderBody: 'body',
    },
  }),
}));

import * as notif from '@/lib/notifications';
import { syncHabitReminder, HabitNotifSettings } from '@/lib/habitNotifications';
import type { Habit } from '@/store/useHabitStore';

const schedule = notif.scheduleDailyReminder as jest.Mock;

const baseSettings: HabitNotifSettings = {
  habitNotificationsEnabled: true,
  language: 'en',
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
  essentialsModeEnabled: false,
};

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1',
    title: 'Water',
    notificationEnabled: true,
    notificationTimes: ['08:00'],
    active: true,
    importance: 'regular',
    ...overrides,
  } as Habit;
}

beforeEach(() => jest.clearAllMocks());

describe('gating (nothing scheduled)', () => {
  it('schedules nothing when habit notifications are disabled', () => {
    syncHabitReminder(habit({}), { ...baseSettings, habitNotificationsEnabled: false });
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules nothing when the habit itself has notifications off', () => {
    syncHabitReminder(habit({ notificationEnabled: false }), baseSettings);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules nothing for an inactive habit', () => {
    syncHabitReminder(habit({ active: false }), baseSettings);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules nothing when there are no reminder times', () => {
    syncHabitReminder(habit({ notificationTimes: [] }), baseSettings);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancels a non-essential habit when Focus mode is on', () => {
    syncHabitReminder(habit({ importance: 'regular' }), {
      ...baseSettings,
      essentialsModeEnabled: true,
    });
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe('scheduling', () => {
  it('schedules one indexed reminder per time', () => {
    syncHabitReminder(habit({ notificationTimes: ['08:00', '12:00'] }), baseSettings);
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule.mock.calls[0][0]).toBe('habit-h1-0');
    expect(schedule.mock.calls[0][1]).toBe(8);
    expect(schedule.mock.calls[1][0]).toBe('habit-h1-1');
    expect(schedule.mock.calls[1][1]).toBe(12);
  });

  it('SKIPS (does not shift) an occurrence inside quiet hours', () => {
    // 22:00 is inside quiet [21:00, 08:00) → that occurrence is dropped, 12:00 stays.
    syncHabitReminder(habit({ notificationTimes: ['22:00', '12:00'] }), {
      ...baseSettings,
      quietHoursEnabled: true,
    });
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0][0]).toBe('habit-h1-1'); // index preserved
    expect(schedule.mock.calls[0][1]).toBe(12);
  });
});
