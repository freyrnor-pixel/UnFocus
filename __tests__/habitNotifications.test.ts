/**
 * habitNotifications.test.ts — unit tests for lib/habitNotifications.ts
 * (syncHabitReminder).
 *
 * Habits SKIP any occurrence that falls inside quiet hours (Decision 016 Q4) —
 * the deliberate opposite of tasks, which shift. Also covers multi-time
 * scheduling, the enable/active gates, and the always-cancel-first
 * contract. Only the scheduling primitives and i18n are mocked; the real
 * isWithinQuietHours math (lib/notifications) is kept.
 */
import * as notif from '@/lib/notifications';
import { syncHabitReminder, HabitNotifSettings } from '@/lib/habitNotifications';
import type { Habit } from '@/store/useHabitStore';

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

const schedule = notif.scheduleDailyReminder as jest.Mock;

const baseSettings: HabitNotifSettings = {
  habitNotificationsEnabled: true,
  language: 'en',
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
};

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1',
    title: 'Water',
    notificationEnabled: true,
    notificationTimes: ['08:00'],
    active: true,
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

/**
 * Habit reminders were the only reminder type in the app with NO action buttons — tasks had
 * Done from AP-05 and medicine trays got Taken with the tray system, but a habit nudge could
 * only be dismissed or tapped through into the app. That is the wrong ask for the reminder
 * most likely to arrive while your hands are full, so it carries its own category now.
 *
 * The payload is what the listener in app/_layout.tsx filters on, and it is the ONLY thing
 * distinguishing a habit response from a task or medicine one — all three listeners are
 * mounted at once and each ignores what it does not recognise. A missing `habitId` here is
 * therefore not a broken button, it is a silent one.
 */
describe('habit reminders are actionable', () => {
  it('carries the habit-reminder category and the habit id', () => {
    syncHabitReminder(habit({ notificationTimes: ['08:00'] }), baseSettings);
    expect(schedule.mock.calls[0][4]).toEqual({
      data: { habitId: 'h1' },
      categoryIdentifier: 'habit-reminder',
    });
  });

  it('uses its own category, never the task or medicine one', () => {
    syncHabitReminder(habit({ notificationTimes: ['08:00', '12:00'] }), baseSettings);
    for (const call of schedule.mock.calls) {
      expect(call[4].categoryIdentifier).toBe('habit-reminder');
      expect(call[4].data).not.toHaveProperty('taskId');
      expect(call[4].data).not.toHaveProperty('medicineTray');
    }
  });
});
