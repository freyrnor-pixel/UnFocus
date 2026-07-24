/**
 * taskCalendar.test.ts — Tests for lib/taskCalendar.ts's pure helpers.
 *
 * Covers isCalendarEligible and buildEventDetails only — the native-calling
 * glue (ensureCalendar/syncTaskCalendarEvent/cancelTaskCalendarEvent) is left
 * to manual device verification per TESTING.md's scoping of native-module glue.
 */
import { isCalendarEligible, buildEventDetails } from '@/lib/taskCalendar';
import type { Task } from '@/store/useTaskStore';

jest.mock('expo-calendar', () => ({
  ExpoCalendar: { get: jest.fn() },
  ExpoCalendarEvent: { get: jest.fn() },
  getCalendars: jest.fn(),
  createCalendar: jest.fn(),
  getDefaultCalendarSync: jest.fn(),
  requestCalendarPermissions: jest.fn(),
  EntityTypes: { EVENT: 'event' },
  CalendarAccessLevel: { OWNER: 'owner' },
}));

function baseTask(overrides: Partial<Task> = {}): Pick<Task, 'recurring' | 'time'> & Partial<Task> {
  return {
    recurring: 'none',
    time: '10:00',
    date: '2026-07-20',
    title: 'Call the plumber',
    taskType: 'start-at',
    hint: '',
    ...overrides,
  };
}

describe('isCalendarEligible', () => {
  it('is eligible for a one-off, timed task', () => {
    expect(isCalendarEligible(baseTask())).toBe(true);
  });

  it('is not eligible for a recurring task even with a time', () => {
    expect(isCalendarEligible(baseTask({ recurring: 'weekly' }))).toBe(false);
  });

  it('is not eligible for a Whenever (no time) task', () => {
    expect(isCalendarEligible(baseTask({ time: undefined }))).toBe(false);
  });
});

describe('buildEventDetails', () => {
  it('derives a time-box event window from its duration', () => {
    const details = buildEventDetails(baseTask({ taskType: 'time-box', durationMinutes: 45 }) as Task);
    expect(details).not.toBeNull();
    expect(details!.startDate.toISOString()).toBe(new Date('2026-07-20T10:00:00').toISOString());
    expect(details!.endDate.getTime() - details!.startDate.getTime()).toBe(45 * 60000);
  });

  it('defaults a start-at event to a 30 min window', () => {
    const details = buildEventDetails(baseTask({ taskType: 'start-at' }) as Task);
    expect(details).not.toBeNull();
    expect(details!.endDate.getTime() - details!.startDate.getTime()).toBe(30 * 60000);
  });

  it('returns null when time is missing or unparseable', () => {
    expect(buildEventDetails(baseTask({ time: undefined }) as Task)).toBeNull();
  });
});
