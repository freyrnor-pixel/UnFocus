/**
 * taskNotifications.test.ts — unit tests for lib/taskNotifications.ts
 * (syncTaskNotification).
 *
 * Decides whether a task's reminder is scheduled or cancelled, and — crucially —
 * SHIFTS the reminder past quiet hours (tasks shift, habits skip; Decision 016
 * Q4). Settings are passed in, so we only mock the scheduling primitives and
 * i18n; the real pushPastQuietHours math (from lib/notifications) is kept.
 */
jest.mock('@/lib/notifications', () => {
  const actual = jest.requireActual('@/lib/notifications');
  return {
    __esModule: true,
    ...actual,
    scheduleTaskNotification: jest.fn(),
    scheduleWeeklyTaskNotifications: jest.fn(),
    cancelTaskNotification: jest.fn().mockResolvedValue(undefined),
  };
});
jest.mock('@/lib/i18n', () => ({
  getTranslations: () => ({ notif: { overviewNothingElse: 'nothing else' } }),
}));

import * as notif from '@/lib/notifications';
import { syncTaskNotification, TaskNotifSettings } from '@/lib/taskNotifications';
import type { Task } from '@/store/useTaskStore';

const schedule = notif.scheduleTaskNotification as jest.Mock;
const scheduleWeekly = notif.scheduleWeeklyTaskNotifications as jest.Mock;
const cancel = notif.cancelTaskNotification as jest.Mock;

const baseSettings: TaskNotifSettings = {
  taskNotificationsEnabled: true,
  language: 'en',
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
};

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'T',
    date: '2099-01-05', // far future so one-off reminders aren't "in the past"
    time: '10:00',
    taskType: 'start-at',
    done: false,
    recurring: 'none',
    recurringDays: [],
    weekInterval: 1,
    monthlyMode: 'day',
    monthDay: 1,
    monthOrdinal: 'first',
    monthWeekday: 0,
    energyEnabled: false,
    energyValue: 1,
    sortOrder: 0,
    hint: '',
    followsTaskId: null,
    hasStartDate: false,
    sharedOut: false,
    assignee: '',
    steps: [],
    ...overrides,
  } as Task;
}

beforeEach(() => jest.clearAllMocks());

describe('gating', () => {
  it('cancels and schedules nothing when task notifications are disabled', () => {
    syncTaskNotification(task({}), { ...baseSettings, taskNotificationsEnabled: false });
    expect(cancel).toHaveBeenCalledWith('t1');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancels when the task has no time', () => {
    syncTaskNotification(task({ time: undefined }), baseSettings);
    expect(cancel).toHaveBeenCalledWith('t1');
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe('one-off tasks', () => {
  it('schedules a future, not-done task', () => {
    syncTaskNotification(task({}), baseSettings);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0][0]).toBe('t1');
  });

  it('cancels a done task', () => {
    syncTaskNotification(task({ done: true }), baseSettings);
    expect(cancel).toHaveBeenCalledWith('t1');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancels a task whose time is already in the past', () => {
    syncTaskNotification(task({ date: '2000-01-01' }), baseSettings);
    expect(cancel).toHaveBeenCalledWith('t1');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('SHIFTS the reminder past quiet hours (fires at the window end)', () => {
    // 22:00 is inside quiet [21:00, 08:00) → reminder deferred to 08:00 next day.
    syncTaskNotification(task({ time: '22:00' }), { ...baseSettings, quietHoursEnabled: true });
    expect(schedule).toHaveBeenCalledTimes(1);
    const firedAt: Date = schedule.mock.calls[0][1];
    expect(firedAt.getHours()).toBe(8);
    expect(firedAt.getMinutes()).toBe(0);
  });
});

describe('weekly-recurring tasks', () => {
  it('schedules one occurrence per selected weekday', () => {
    syncTaskNotification(task({ recurring: 'weekly', recurringDays: [0, 2] }), baseSettings);
    expect(scheduleWeekly).toHaveBeenCalledTimes(1);
    const [id, occurrences] = scheduleWeekly.mock.calls[0];
    expect(id).toBe('t1');
    expect(occurrences.map((o: { suffix: string }) => o.suffix)).toEqual(['s0', 's2']);
  });

  it('cancels a weekly task with no selected days', () => {
    syncTaskNotification(task({ recurring: 'weekly', recurringDays: [] }), baseSettings);
    expect(cancel).toHaveBeenCalledWith('t1');
    expect(scheduleWeekly).not.toHaveBeenCalled();
  });

  it('shifts a weekly occurrence that lands in quiet hours', () => {
    syncTaskNotification(task({ recurring: 'weekly', recurringDays: [0], time: '22:00' }), {
      ...baseSettings,
      quietHoursEnabled: true,
    });
    const [, occurrences] = scheduleWeekly.mock.calls[0];
    expect(occurrences[0].hour).toBe(8);
    expect(occurrences[0].minute).toBe(0);
  });
});
