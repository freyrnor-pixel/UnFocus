/**
 * energy.test.ts — unit tests for lib/energy.ts (the pure Energy-system helpers).
 *
 * Covers the signed day/week deltas: an energy-enabled task counts only when done
 * and dated to that day; an energy-enabled habit counts only when met (log count ≥
 * daily goal) that day; positive values restore, negative drain; the week delta is
 * the sum across the Mon–Sun week; and week key formatting. Also covers the
 * "planned" variants (plannedEnergyDeltaForDay/Week), which count every
 * energy-enabled task/habit SCHEDULED for the period regardless of done/met status
 * (used to warn about an over-committed day/week before anything's completed).
 * Pure functions — no DB, no store; plain objects cast to the store types.
 *
 * Also covers the two 2026-08-02 additions: `energyPipCount`'s `surplus` channel (pips
 * earned PAST capacity, capped at MAX_SURPLUS_PIPS so the clipping pip row can't overflow)
 * and `boostKey`, the 'b:'-prefixed third period-key shape for a today-only energy boost.
 * The existing `energyPipCount` assertions gained an explicit `surplus` field — `toEqual` is
 * exact, so a new key has to be named — but their pipCount/filled expectations are unchanged,
 * which is the point: surplus is purely additive.
 */
import { dayKey, weekKey, boostKey, energyDeltaForDay, energyDeltaForWeek, plannedEnergyDeltaForDay, plannedEnergyDeltaForWeek, energyStepperValue, energyFieldsFromStepper, energyPipCount, MAX_SURPLUS_PIPS } from '@/lib/energy';
import type { Task } from '@/store/useTaskStore';
import type { Habit, HabitLog } from '@/store/useHabitStore';

function task(o: Partial<Task>): Task {
  return {
    id: 't', title: 'T', date: '2026-07-15', taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day',
    monthDay: 1, monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false,
    energyValue: 1, sortOrder: 0, hint: '', followsTaskId: null, hasStartDate: false,
    sharedOut: false, assignee: '', assigneeId: '', createdByPersonId: '',
    steps: [], ...o,
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
  it('boostKey is the b:-prefixed date itself', () => {
    expect(boostKey(DAY)).toBe('b:2026-07-15');
  });
  // The three key shapes share one table, so they must never collide — and the 'b:' shape in
  // particular must not look like a day key, or lib/db.ts's day prune would eat it early.
  it('keeps the three period key shapes distinct for the same date', () => {
    const keys = [dayKey(DAY), weekKey(DAY), boostKey(DAY)];
    expect(new Set(keys).size).toBe(3);
    expect(boostKey(DAY)).not.toBe(dayKey(DAY));
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

describe('plannedEnergyDeltaForDay', () => {
  it('ignores tasks that are not energy-enabled', () => {
    expect(plannedEnergyDeltaForDay(DAY, [task({ energyEnabled: false, energyValue: 5 })], [])).toBe(0);
  });

  it('counts a scheduled energy task even when not done yet', () => {
    expect(plannedEnergyDeltaForDay(DAY, [task({ done: false, energyEnabled: true, energyValue: -3 })], [])).toBe(-3);
  });

  it('ignores a one-off energy task dated to another day', () => {
    expect(plannedEnergyDeltaForDay(DAY, [task({ date: '2026-07-16', recurring: 'none', energyEnabled: true, energyValue: 5 })], [])).toBe(0);
  });

  it('counts a daily energy habit even when not yet met that day', () => {
    const h = habit({ energyEnabled: true, energyValue: 2, recurrence: 'daily', dailyGoal: 3 });
    expect(plannedEnergyDeltaForDay(DAY, [], [h])).toBe(2);
  });

  it('only counts a weekly habit on its scheduled weekdays', () => {
    // DAY (2026-07-15) is a Wednesday → Mon-indexed weekday 2.
    const onDay = habit({ id: 'w1', energyEnabled: true, energyValue: 1, recurrence: 'weekly', recurrenceDays: [2] });
    const offDay = habit({ id: 'w2', energyEnabled: true, energyValue: 1, recurrence: 'weekly', recurrenceDays: [0] });
    expect(plannedEnergyDeltaForDay(DAY, [], [onDay])).toBe(1);
    expect(plannedEnergyDeltaForDay(DAY, [], [offDay])).toBe(0);
  });

  it('sums scheduled task and habit deltas together', () => {
    const tasks = [task({ done: false, energyEnabled: true, energyValue: -2 })];
    const habits = [habit({ energyEnabled: true, energyValue: 1, recurrence: 'daily' })];
    expect(plannedEnergyDeltaForDay(DAY, tasks, habits)).toBe(-1);
  });

  it('excludes a weekly-flexible habit from any single day\'s planned total', () => {
    // It isn't pinned to a specific day, so attributing it to one day would be arbitrary.
    const h = habit({ energyEnabled: true, energyValue: -1, recurrence: 'weekly-flexible', dailyGoal: 3 });
    expect(plannedEnergyDeltaForDay(DAY, [], [h])).toBe(0);
  });
});

describe('plannedEnergyDeltaForWeek', () => {
  it('sums scheduled (not just completed) deltas across the Mon–Sun week', () => {
    const tasks = [
      task({ id: 'mon', date: '2026-07-13', recurring: 'none', done: false, energyEnabled: true, energyValue: 2 }),
      task({ id: 'wed', date: '2026-07-15', recurring: 'none', done: false, energyEnabled: true, energyValue: -1 }),
      task({ id: 'nextwk', date: '2026-07-20', recurring: 'none', done: false, energyEnabled: true, energyValue: 5 }), // outside week
    ];
    expect(plannedEnergyDeltaForWeek(DAY, tasks, [])).toBe(1);
  });

  it('counts a weekly-flexible habit exactly once for the week, not once per day', () => {
    const h = habit({ energyEnabled: true, energyValue: -1, recurrence: 'weekly-flexible', dailyGoal: 3 });
    // If this were summed per-day like a normal habit, it would be -7 (once per day of the week).
    expect(plannedEnergyDeltaForWeek(DAY, [], [h])).toBe(-1);
  });
});

/**
 * The single-stepper Energy control (2026-07-26). Both editors show ONE signed stepper
 * where 0 = "no effect" instead of a switch plus a value. The regression these guard:
 * `energyValue` defaults to 1 while `energyEnabled` defaults to false, so showing the raw
 * value would read every untouched task/habit as "+1" and persist it on the next save.
 */
describe('energyStepperValue / energyFieldsFromStepper', () => {
  it('shows 0 for a row that is not in the Energy system, whatever its stored value', () => {
    expect(energyStepperValue(false, 1)).toBe(0);   // the store default — the trap
    expect(energyStepperValue(false, -5)).toBe(0);
    expect(energyStepperValue(false, 0)).toBe(0);
  });

  it('shows the stored value once the row IS in the Energy system', () => {
    expect(energyStepperValue(true, 1)).toBe(1);
    expect(energyStepperValue(true, -3)).toBe(-3);
    expect(energyStepperValue(true, 0)).toBe(0);
  });

  it('derives energyEnabled from the stepper reading, with 0 meaning opted out', () => {
    expect(energyFieldsFromStepper(0)).toEqual({ energyEnabled: false, energyValue: 0 });
    expect(energyFieldsFromStepper(2)).toEqual({ energyEnabled: true, energyValue: 2 });
    expect(energyFieldsFromStepper(-2)).toEqual({ energyEnabled: true, energyValue: -2 });
  });

  it('round-trips: a default row saves as opted-out, so it contributes nothing', () => {
    const fields = energyFieldsFromStepper(energyStepperValue(false, 1));
    expect(fields).toEqual({ energyEnabled: false, energyValue: 0 });
    expect(energyDeltaForDay(DAY, [task({ ...fields, done: true, date: DAY })], [], [])).toBe(0);
  });

  it('round-trips an opted-in row unchanged', () => {
    const fields = energyFieldsFromStepper(energyStepperValue(true, -4));
    expect(fields).toEqual({ energyEnabled: true, energyValue: -4 });
    expect(energyDeltaForDay(DAY, [task({ ...fields, done: true, date: DAY })], [], [])).toBe(-4);
  });
});

describe('energyPipCount', () => {
  it('is 1 pip per unit when capacity is at or under the max', () => {
    expect(energyPipCount(6, 8)).toEqual({ pipCount: 8, filled: 6, surplus: 0 });
  });

  it('scales down proportionally once capacity exceeds the max', () => {
    expect(energyPipCount(30, 40, 10)).toEqual({ pipCount: 10, filled: 8, surplus: 0 }); // 30/40 * 10 = 7.5 → 8
  });

  it('clamps a negative (over-committed) current to zero filled pips', () => {
    expect(energyPipCount(-2, 8)).toEqual({ pipCount: 8, filled: 0, surplus: 0 });
  });

  it('clamps current above capacity to fully filled', () => {
    expect(energyPipCount(12, 8)).toEqual({ pipCount: 8, filled: 8, surplus: 4 });
  });

  it('returns no pips for a zero or negative capacity', () => {
    expect(energyPipCount(0, 0)).toEqual({ pipCount: 0, filled: 0, surplus: 0 });
    expect(energyPipCount(0, -5)).toEqual({ pipCount: 0, filled: 0, surplus: 0 });
  });
});

/**
 * Surplus pips (2026-08-02) — what the clamp used to swallow, so `12 / 10` no longer draws
 * identically to `10 / 10`. The cap is the load-bearing part: the pip row clips, and an
 * uncapped surplus would paint over the value text beside it (the 2026-07-28 overflow bug).
 */
describe('energyPipCount — surplus', () => {
  it('is zero while current is at or under capacity', () => {
    expect(energyPipCount(0, 10).surplus).toBe(0);
    expect(energyPipCount(7, 10).surplus).toBe(0);
    expect(energyPipCount(10, 10).surplus).toBe(0); // exactly full is not surplus
    expect(energyPipCount(-4, 10).surplus).toBe(0);
  });

  it('scales past-capacity energy the same way filled pips are scaled', () => {
    // 1:1 while capacity is under the max — 2 past a capacity of 10 is 2 pips.
    expect(energyPipCount(12, 10).surplus).toBe(2);
    // Scaled down above the max: 10 past 40 with 10 pips = a quarter of the row = 2.5 → 3.
    expect(energyPipCount(50, 40, 10).surplus).toBe(3);
  });

  it('caps the surplus so the pip row can never overflow', () => {
    expect(energyPipCount(100, 10).surplus).toBe(MAX_SURPLUS_PIPS);
    expect(energyPipCount(1000, 40, 10).surplus).toBe(MAX_SURPLUS_PIPS);
    // Whatever the numbers, it never exceeds the cap.
    for (const current of [11, 15, 20, 33, 60, 400]) {
      expect(energyPipCount(current, 10).surplus).toBeLessThanOrEqual(MAX_SURPLUS_PIPS);
    }
  });

  it('is zero for a zero or negative capacity, along with everything else', () => {
    expect(energyPipCount(50, 0).surplus).toBe(0);
    expect(energyPipCount(50, -5).surplus).toBe(0);
  });

  it('leaves pipCount and filled exactly as they were', () => {
    // The surplus channel is additive — the two original values are untouched by it.
    expect(energyPipCount(12, 8).filled).toBe(8);
    expect(energyPipCount(12, 8).pipCount).toBe(8);
  });
});
