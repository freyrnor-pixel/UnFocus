/**
 * taskOccursOn.test.ts — unit tests for the recurrence resolver (taskOccursOn)
 * and the next-occurrence lookup (nextOccurrenceDate), both in lib/taskRecurrence.ts
 * (extracted from store/useTaskStore.ts 2026-07-20, which re-exports taskOccursOn
 * for backwards compatibility — this file still imports it from the store to also
 * exercise that re-export path).
 *
 * taskOccursOn is the single function that decides which tasks show up on a given
 * day — one-off, daily, weekly (incl. every-N-weeks parity), and monthly
 * (day-of-month clamped, or nth/last weekday). nextOccurrenceDate scans forward
 * from a date to find the next occurrence — used by lib/taskNotifications.ts to
 * schedule a monthly recurring task's reminder (no native trigger expresses
 * "day-of-month, clamped"/"nth weekday"). The store imports the SQLite handle at
 * top level, so '@/lib/db' is mocked to keep the suite headless (same pattern as
 * shoppingListStore.test.ts). Reference dates below (all 2026):
 *   Mon 07-13, Wed 07-15, Thu 07-16, Sun 07-19, Wed 07-22, Wed 07-29.
 */
import { taskOccursOn } from '@/store/useTaskStore';
import type { Task } from '@/store/useTaskStore';
import { nextOccurrenceDate } from '@/lib/taskRecurrence';

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'T',
    date: '2026-07-15',
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

describe('recurring "none"', () => {
  it('matches only its own date', () => {
    const t = task({ recurring: 'none', date: '2026-07-15' });
    expect(taskOccursOn(t, '2026-07-15')).toBe(true);
    expect(taskOccursOn(t, '2026-07-16')).toBe(false);
  });
});

describe('recurring "daily"', () => {
  it('matches every day when undated', () => {
    const t = task({ recurring: 'daily', hasStartDate: false });
    expect(taskOccursOn(t, '2026-07-15')).toBe(true);
    expect(taskOccursOn(t, '2030-01-01')).toBe(true);
  });

  it('respects a start-date boundary', () => {
    const t = task({ recurring: 'daily', hasStartDate: true, date: '2026-07-15' });
    expect(taskOccursOn(t, '2026-07-14')).toBe(false);
    expect(taskOccursOn(t, '2026-07-15')).toBe(true);
    expect(taskOccursOn(t, '2026-07-16')).toBe(true);
  });
});

describe('recurring "weekly"', () => {
  it('matches the selected weekday every week (interval 1)', () => {
    const t = task({ recurring: 'weekly', recurringDays: [2] }); // 2 = Wednesday
    expect(taskOccursOn(t, '2026-07-15')).toBe(true); // Wed
    expect(taskOccursOn(t, '2026-07-22')).toBe(true); // Wed
    expect(taskOccursOn(t, '2026-07-16')).toBe(false); // Thu
  });

  it('respects every-2-weeks parity anchored on the start date', () => {
    const t = task({
      recurring: 'weekly',
      recurringDays: [2], // Wednesday
      weekInterval: 2,
      hasStartDate: true,
      date: '2026-07-15', // Wed, anchor
    });
    expect(taskOccursOn(t, '2026-07-15')).toBe(true); // week 0
    expect(taskOccursOn(t, '2026-07-22')).toBe(false); // week 1 (off-parity)
    expect(taskOccursOn(t, '2026-07-29')).toBe(true); // week 2
    expect(taskOccursOn(t, '2026-07-16')).toBe(false); // wrong weekday
  });
});

describe('recurring "monthly" (day-of-month)', () => {
  it('clamps the day to the last day of a short month', () => {
    const t = task({ recurring: 'monthly', monthlyMode: 'day', monthDay: 31 });
    expect(taskOccursOn(t, '2026-02-28')).toBe(true); // Feb clamps 31 → 28
    expect(taskOccursOn(t, '2026-02-27')).toBe(false);
    expect(taskOccursOn(t, '2026-03-31')).toBe(true); // full month, exact
  });
});

describe('recurring "monthly" (ordinal weekday)', () => {
  it('matches the first Monday of the month', () => {
    const t = task({
      recurring: 'monthly',
      monthlyMode: 'ordinal',
      monthOrdinal: 'first',
      monthWeekday: 0, // Monday
    });
    expect(taskOccursOn(t, '2026-07-06')).toBe(true); // 1st Monday of July 2026
    expect(taskOccursOn(t, '2026-07-13')).toBe(false); // 2nd Monday
    expect(taskOccursOn(t, '2026-07-07')).toBe(false); // Tuesday
  });

  it('matches the last Monday of the month', () => {
    const t = task({
      recurring: 'monthly',
      monthlyMode: 'ordinal',
      monthOrdinal: 'last',
      monthWeekday: 0, // Monday
    });
    expect(taskOccursOn(t, '2026-07-27')).toBe(true); // last Monday of July 2026
    expect(taskOccursOn(t, '2026-07-20')).toBe(false); // 3rd Monday, not last
  });
});

describe('nextOccurrenceDate', () => {
  it('returns fromDate itself when it already matches', () => {
    const t = task({ recurring: 'monthly', monthlyMode: 'day', monthDay: 15 });
    expect(nextOccurrenceDate(t, '2026-07-15')).toBe('2026-07-15');
  });

  it('finds the next day-of-month occurrence, crossing into the next month', () => {
    const t = task({ recurring: 'monthly', monthlyMode: 'day', monthDay: 15 });
    expect(nextOccurrenceDate(t, '2026-07-16')).toBe('2026-08-15');
  });

  it('finds the next occurrence across a clamped short month (Feb)', () => {
    const t = task({ recurring: 'monthly', monthlyMode: 'day', monthDay: 31 });
    expect(nextOccurrenceDate(t, '2026-02-01')).toBe('2026-02-28');
  });

  it('finds the next last-weekday-of-month occurrence', () => {
    const t = task({
      recurring: 'monthly',
      monthlyMode: 'ordinal',
      monthOrdinal: 'last',
      monthWeekday: 0, // Monday
    });
    // Last Monday of July 2026 is 07-27; searching from 07-28 should land on
    // the last Monday of August (08-31).
    expect(nextOccurrenceDate(t, '2026-07-28')).toBe('2026-08-31');
  });

  it('returns null when no occurrence falls within maxDays', () => {
    const t = task({ recurring: 'monthly', monthlyMode: 'day', monthDay: 15 });
    expect(nextOccurrenceDate(t, '2026-07-16', 10)).toBeNull();
  });

  it('respects a start-date boundary in the future', () => {
    const t = task({ recurring: 'monthly', monthlyMode: 'day', monthDay: 5, hasStartDate: true, date: '2026-09-01' });
    // Without the boundary this would match 2026-08-05; the start date pushes
    // the first valid occurrence to September.
    expect(nextOccurrenceDate(t, '2026-07-16')).toBe('2026-09-05');
  });
});
