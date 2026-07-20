/**
 * energy.test.ts — unit tests for lib/energy.ts (the pure Energy-system helpers).
 *
 * Covers the signed day/week deltas: an energy-enabled task counts only when done
 * and dated to that day; an energy-enabled habit counts only when met (log count ≥
 * daily goal) that day; positive values restore, negative drain; the week delta is
 * the sum across the Mon–Sun week; and week key formatting. Pure functions — no DB,
 * no store; plain objects cast to the store types.
 */
import { dayKey, weekKey, energyDeltaForDay, energyDeltaForWeek } from '@/lib/energy';
import type { Task } from '@/store/useTaskStore';
import type { Habit, HabitLog } from '@/store/useHabitStore';

function task(o: Partial<Task>): Task {
  return {
    id: 't', title: 'T', date: '2026-07-15', taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day',
    monthDay: 1, monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false,
    energyValue: 1, sortOrder: 0, hint: '', followsTaskId: null, hasStartDate: false,
    sharedOut: false, assignee: '', steps: [], ...o,
  } as Task;
}

function habit(o: Partial<Habit>): Habit {
  return {
    id: 'h', title: 'H', icon: '', kind: 'neutral', category: 'other', cue: '',
    craving: '', response: '', reward: '', dailyGoal: 1, recurrence: 'daily',
    recurrenceDays: [], notificationEnabled: false, notificationTimes: [],
    reminderMode: null, reminderCount: null, reminderIntervalMin: null,
    reminderStart: null, reminderEnd: null, routineOrder: 0, active: true,
    createdAt: '', childName: '', energyEnabled: false, energyValue: 1, ...o,
  } as Habit;
}

const log = (habitId: string, logDate: string, count: number): HabitLog => ({
  id: `${habitId}-${logDate}`, habitId, logDate, count, restDay: false,
});

const DAY = '2026-07-15'; // a Wednesday

describe('period keys', () => {
  it('dayKey is the date itself', () => {
    expect(dayKey(DAY)).toBe('2026-07-15');
  });
  it('weekKey is the w:-prefixed Monday of the week', () => {
    expect(weekKey(DAY)).toBe('w:2026-07-13'); // Monday of that week
  });
});

describe('energyDeltaForDay', () => {
  it('ignores tasks that are not energy-enabled', () => {
    expect(energyDeltaForDay(DAY, [task({ done: true, energyEnabled: false, energyValue: 5 })], [], [])).toBe(0);
  });

  it('ignores energy tasks that are not done', () => {
    expect(energyDeltaForDay(DAY, [task({ done: false, energyEnabled: true, energyValue: 5 })], [], [])).toBe(0);
  });

  it('ignores energy tasks dated to another day', () => {
    expect(energyDeltaForDay(DAY, [task({ date: '2026-07-16', done: true, energyEnabled: true, energyValue: 5 })], [], [])).toBe(0);
  });

  it('sums signed values of completed energy tasks (positive restores, negative drains)', () => {
    const tasks = [
      task({ id: 'a', done: true, energyEnabled: true, energyValue: 3 }),
      task({ id: 'b', done: true, energyEnabled: true, energyValue: -2 }),
    ];
    expect(energyDeltaForDay(DAY, tasks, [], [])).toBe(1);
  });

  it('counts an energy habit only when met that day', () => {
    const h = habit({ id: 'w', energyEnabled: true, energyValue: 1, dailyGoal: 2 });
    // count 1 < goal 2 → not met, no energy
    expect(energyDeltaForDay(DAY, [], [h], [log('w', DAY, 1)])).toBe(0);
    // count 2 >= goal 2 → met, +1
    expect(energyDeltaForDay(DAY, [], [h], [log('w', DAY, 2)])).toBe(1);
  });

  it('excludes a rest-day habit from the delta — no reward, no penalty', () => {
    const h = habit({ id: 'w', energyEnabled: true, energyValue: 1, dailyGoal: 1 });
    const restLog: HabitLog = { id: 'w-rest', habitId: 'w', logDate: DAY, count: 0, restDay: true };
    expect(energyDeltaForDay(DAY, [], [h], [restLog])).toBe(0);
    // Even if count happens to reach goal, resting still excludes it.
    const restLogMet: HabitLog = { id: 'w-rest2', habitId: 'w', logDate: DAY, count: 1, restDay: true };
    expect(energyDeltaForDay(DAY, [], [h], [restLogMet])).toBe(0);
  });

  it('adds task and habit deltas together', () => {
    const tasks = [task({ done: true, energyEnabled: true, energyValue: -2 })];
    const habits = [habit({ id: 'w', energyEnabled: true, energyValue: 1, dailyGoal: 1 })];
    expect(energyDeltaForDay(DAY, tasks, habits, [log('w', DAY, 1)])).toBe(-1);
  });
});

describe('energyDeltaForWeek', () => {
  it('sums the deltas across the Mon–Sun week', () => {
    const tasks = [
      task({ id: 'mon', date: '2026-07-13', done: true, energyEnabled: true, energyValue: 2 }),
      task({ id: 'wed', date: '2026-07-15', done: true, energyEnabled: true, energyValue: -1 }),
      task({ id: 'nextwk', date: '2026-07-20', done: true, energyEnabled: true, energyValue: 5 }), // outside week
    ];
    expect(energyDeltaForWeek(DAY, tasks, [], [])).toBe(1);
  });
});
