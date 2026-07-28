/**
 * personEnergy.test.ts — Energy split per person (2026-07-28, sharing phase 3).
 *
 * The three decisions worth pinning, because each is silently wrong-lookable:
 *   1. `pressure` is measured against each person's OWN capacity, so an honest low
 *      capacity is never punished by the comparison.
 *   2. An empty `assigneeId` counts as the self person's — otherwise every pre-back-fill
 *      row, every unassigned peer row and every removed-person row would vanish from the
 *      household total.
 *   3. Habits don't sync, so a person with their own paired phone is `tasksOnly` and their
 *      habits must NOT be counted from this device's table even if a name happens to match.
 *
 * Pure functions — no DB, no store; plain objects cast to the store types.
 */
import {
  matchTasks,
  matchHabits,
  isTasksOnly,
  energyPressure,
  personEnergy,
  householdEnergy,
  energyImbalance,
} from '@/lib/personEnergy';
import type { Task } from '@/store/useTaskStore';
import type { Habit, HabitLog } from '@/store/useHabitStore';
import type { Person } from '@/store/usePeopleStore';

function task(o: Partial<Task>): Task {
  return {
    id: 't', title: 'T', date: '2026-07-15', taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day',
    monthDay: 1, monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false,
    energyValue: 1, sortOrder: 0, hint: '', followsTaskId: null, hasStartDate: true,
    sharedOut: false, assignee: '', assigneeId: '', createdByPersonId: '',
    tagIds: [], steps: [], ...o,
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

function person(o: Partial<Person>): Person {
  return {
    id: 'p', name: 'P', color: '#3B6FE0', deviceId: '', isSelf: false,
    dailyCapacity: 10, weeklyCapacity: 50, sortOrder: 0, createdAt: '', ...o,
  } as Person;
}

const DAY = '2026-07-15'; // a Wednesday
const ME = person({ id: 'me', name: 'Me', isSelf: true });
const PARTNER = person({ id: 'partner', name: 'Sam', sortOrder: 1 });
const NO_LOGS: HabitLog[] = [];

describe('matchTasks', () => {
  it('counts an unassigned task as the self person\'s', () => {
    // Covers pre-back-fill rows, rows a peer created without assigning, and rows whose
    // person was removed — none of which should drop out of the household total.
    const tasks = [task({ id: 'a', assigneeId: '' })];
    expect(matchTasks(tasks, ME, 'me').map((t) => t.id)).toEqual(['a']);
    expect(matchTasks(tasks, PARTNER, 'me')).toEqual([]);
  });

  it('routes an explicitly assigned task to that person only', () => {
    const tasks = [task({ id: 'a', assigneeId: 'partner' })];
    expect(matchTasks(tasks, PARTNER, 'me').map((t) => t.id)).toEqual(['a']);
    expect(matchTasks(tasks, ME, 'me')).toEqual([]);
  });
});

describe('habit visibility', () => {
  it('a paired person is tasks-only — their habits live on their own phone', () => {
    const paired = person({ id: 'partner', name: 'Sam', deviceId: 'dev-2' });
    expect(isTasksOnly(paired)).toBe(true);
    // Even a name-matching local habit must not be counted: habits don't sync, so this
    // device's table cannot be their source of truth.
    expect(matchHabits([habit({ childName: 'Sam' })], paired)).toEqual([]);
  });

  it('a hand-kept person\'s habits ARE local, matched by name', () => {
    expect(isTasksOnly(PARTNER)).toBe(false);
    expect(matchHabits([habit({ id: 'x', childName: 'Sam' })], PARTNER).map((h) => h.id)).toEqual(['x']);
  });

  it('the self row owns the empty child name, and is never tasks-only', () => {
    expect(isTasksOnly(ME)).toBe(false);
    expect(matchHabits([habit({ id: 'mine', childName: '' })], ME).map((h) => h.id)).toEqual(['mine']);
  });
});

describe('energyPressure', () => {
  it('is drain over capacity', () => {
    expect(energyPressure(10, -5)).toBe(0.5);
    expect(energyPressure(10, -10)).toBe(1);
  });

  it('goes above 1 when over-committed', () => {
    expect(energyPressure(10, -15)).toBe(1.5);
  });

  it('treats a restoring plan as no pressure, not negative pressure', () => {
    expect(energyPressure(10, 5)).toBe(0);
    expect(energyPressure(10, 0)).toBe(0);
  });

  it('handles a zero capacity without dividing by it', () => {
    expect(energyPressure(0, -1)).toBe(1);
    expect(energyPressure(0, 0)).toBe(0);
  });
});

describe('personEnergy', () => {
  it('separates what has happened from what is merely booked', () => {
    const tasks = [
      task({ id: 'done', assigneeId: 'me', energyEnabled: true, energyValue: -3, done: true }),
      task({ id: 'todo', assigneeId: 'me', energyEnabled: true, energyValue: -2, done: false }),
    ];
    const row = personEnergy(DAY, 'day', ME, tasks, [], NO_LOGS, 'me');
    // Only the completed one has been applied…
    expect(row.appliedDelta).toBe(-3);
    expect(row.remaining).toBe(7);
    // …but both are on the books.
    expect(row.plannedDelta).toBe(-5);
    expect(row.projected).toBe(5);
    expect(row.pressure).toBe(0.5);
  });

  it('measures against the person\'s own capacity, not a shared one', () => {
    const small = person({ id: 'small', dailyCapacity: 5 });
    const large = person({ id: 'large', dailyCapacity: 20 });
    const drain = (assigneeId: string) =>
      task({ id: assigneeId, assigneeId, energyEnabled: true, energyValue: -5 });
    const rowSmall = personEnergy(DAY, 'day', small, [drain('small')], [], NO_LOGS, 'me');
    const rowLarge = personEnergy(DAY, 'day', large, [drain('large')], [], NO_LOGS, 'me');
    // The same absolute load, very different pressure — which is the whole point.
    expect(rowSmall.plannedDelta).toBe(rowLarge.plannedDelta);
    expect(rowSmall.pressure).toBe(1);
    expect(rowLarge.pressure).toBe(0.25);
  });

  it('uses the weekly capacity for the week period', () => {
    const row = personEnergy(DAY, 'week', ME, [], [], NO_LOGS, 'me');
    expect(row.capacity).toBe(50);
    expect(row.projected).toBe(50);
  });

  it('counts a hand-kept person\'s habits but not a paired one\'s', () => {
    const habits = [habit({ childName: 'Sam', energyEnabled: true, energyValue: -4 })];
    const handKept = personEnergy(DAY, 'day', PARTNER, [], habits, NO_LOGS, 'me');
    expect(handKept.plannedDelta).toBe(-4);
    expect(handKept.tasksOnly).toBe(false);

    const paired = person({ id: 'partner', name: 'Sam', deviceId: 'dev-2' });
    const pairedRow = personEnergy(DAY, 'day', paired, [], habits, NO_LOGS, 'me');
    expect(pairedRow.plannedDelta).toBe(0);
    expect(pairedRow.tasksOnly).toBe(true);
  });
});

describe('householdEnergy', () => {
  const people = [ME, PARTNER];

  it('orders most-committed first so the card needn\'t sort', () => {
    const tasks = [
      task({ id: 'a', assigneeId: 'partner', energyEnabled: true, energyValue: -8 }),
      task({ id: 'b', assigneeId: 'me', energyEnabled: true, energyValue: -1 }),
    ];
    const rows = householdEnergy(DAY, 'day', people, tasks, [], NO_LOGS);
    expect(rows.map((r) => r.personId)).toEqual(['partner', 'me']);
  });

  it('returns a row per person even when nothing is booked', () => {
    const rows = householdEnergy(DAY, 'day', people, [], [], NO_LOGS);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.pressure === 0)).toBe(true);
  });
});

describe('energyImbalance', () => {
  it('is zero for a household of one — there is nothing to compare', () => {
    const rows = householdEnergy(DAY, 'day', [ME], [], [], NO_LOGS);
    expect(energyImbalance(rows)).toBe(0);
  });

  it('is the spread between the most- and least-committed', () => {
    const tasks = [task({ id: 'a', assigneeId: 'partner', energyEnabled: true, energyValue: -10 })];
    const rows = householdEnergy(DAY, 'day', [ME, PARTNER], tasks, [], NO_LOGS);
    // Partner at 1.0 (10 of 10), me at 0 — a full capacity apart.
    expect(energyImbalance(rows)).toBe(1);
  });

  it('is zero when both carry the same share of their own capacity', () => {
    // Different absolute loads, identical pressure: correctly reported as balanced.
    const small = person({ id: 'small', dailyCapacity: 5 });
    const large = person({ id: 'large', dailyCapacity: 20, sortOrder: 1 });
    const tasks = [
      task({ id: 'a', assigneeId: 'small', energyEnabled: true, energyValue: -1 }),
      task({ id: 'b', assigneeId: 'large', energyEnabled: true, energyValue: -4 }),
    ];
    const rows = householdEnergy(DAY, 'day', [small, large], tasks, [], NO_LOGS);
    expect(energyImbalance(rows)).toBe(0);
  });
});
