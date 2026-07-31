/**
 * growth.test.ts — unit tests for lib/growth.ts (the ambient growth reward).
 *
 * Pure functions, no mocks. Verifies: a day counts as active from EITHER a completed task
 * or a met habit; the streak survives a not-yet-started today; intensity ramps with the
 * streak, decays with idleness, and floors at neutral rather than going negative; and the
 * level is monotonic in the high-water mark so branches never un-grow.
 */
import {
  GROWTH_RAMP_DAYS,
  GROWTH_DECAY_DAYS,
  GROWTH_LEVELS,
  isActiveOn,
  daysSinceActive,
  currentStreak,
  growthIntensity,
  growthLevel,
  growthState,
} from '@/lib/growth';
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

function habit(o: Partial<Habit> = {}): Habit {
  return {
    id: 'h', title: 'H', icon: '', kind: 'neutral', category: 'other', cue: '',
    craving: '', response: '', reward: '', dailyGoal: 1, recurrence: 'daily',
    recurrenceDays: [], notificationEnabled: false, notificationTimes: [],
    reminderMode: null, reminderCount: null, reminderIntervalMin: null,
    reminderStart: null, reminderEnd: null, routineOrder: 0, active: true,
    createdAt: '', childName: '', energyEnabled: false, energyValue: 1, ...o,
  } as Habit;
}

const log = (logDate: string): HabitLog => ({
  id: `h-${logDate}`, habitId: 'h', logDate, count: 1, restDay: false,
} as HabitLog);

/** 'YYYY-MM-DD' n days before `from`. */
function back(from: string, n: number): string {
  const d = new Date(from + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TODAY = '2026-07-31';

describe('isActiveOn', () => {
  it('counts a completed task', () => {
    expect(isActiveOn(TODAY, [task({ date: TODAY, done: true })], [], [])).toBe(true);
  });

  it('does not count an incomplete task', () => {
    expect(isActiveOn(TODAY, [task({ date: TODAY, done: false })], [], [])).toBe(false);
  });

  it('does not count a task completed on another day', () => {
    expect(isActiveOn(TODAY, [task({ date: back(TODAY, 3), done: true })], [], [])).toBe(false);
  });

  it('counts a met habit', () => {
    expect(isActiveOn(TODAY, [], [habit()], [log(TODAY)])).toBe(true);
  });

  it('is false on an empty day', () => {
    expect(isActiveOn(TODAY, [], [], [])).toBe(false);
  });
});

describe('daysSinceActive', () => {
  it('is 0 when something happened today', () => {
    expect(daysSinceActive(TODAY, [], [habit()], [log(TODAY)])).toBe(0);
  });

  it('finds the most recent active day', () => {
    const logs = [log(back(TODAY, 3)), log(back(TODAY, 6))];
    expect(daysSinceActive(TODAY, [], [habit()], logs)).toBe(3);
  });

  it('is null past the decay window', () => {
    const logs = [log(back(TODAY, GROWTH_DECAY_DAYS + 1))];
    expect(daysSinceActive(TODAY, [], [habit()], logs)).toBeNull();
  });
});

describe('currentStreak', () => {
  it('counts consecutive active days', () => {
    const logs = [0, 1, 2, 3].map((i) => log(back(TODAY, i)));
    expect(currentStreak(TODAY, [], [habit()], logs)).toBe(4);
  });

  it('survives a today that has not happened yet', () => {
    // Active on each of the last 5 days EXCEPT today — the streak is whole, not broken.
    const logs = [1, 2, 3, 4, 5].map((i) => log(back(TODAY, i)));
    expect(currentStreak(TODAY, [], [habit()], logs)).toBe(5);
  });

  it('stops at the first gap', () => {
    const logs = [0, 1, 3, 4].map((i) => log(back(TODAY, i)));
    expect(currentStreak(TODAY, [], [habit()], logs)).toBe(2);
  });

  it('is 0 when nothing is in the window', () => {
    expect(currentStreak(TODAY, [], [], [])).toBe(0);
  });

  it('mixes tasks and habits across days', () => {
    const tasks = [task({ id: 'a', date: TODAY, done: true })];
    const logs = [log(back(TODAY, 1)), log(back(TODAY, 2))];
    expect(currentStreak(TODAY, tasks, [habit()], logs)).toBe(3);
  });
});

describe('growthIntensity', () => {
  it('is 0 with no streak', () => {
    expect(growthIntensity(0, 0)).toBe(0);
  });

  it('is 0 when the last active day is outside the window', () => {
    expect(growthIntensity(30, null)).toBe(0);
  });

  it('reaches full strength at the ramp length', () => {
    expect(growthIntensity(GROWTH_RAMP_DAYS, 0)).toBe(1);
  });

  it('does not exceed 1 past the ramp', () => {
    expect(growthIntensity(GROWTH_RAMP_DAYS * 4, 0)).toBe(1);
  });

  it('ramps monotonically', () => {
    let prev = -1;
    for (let s = 0; s <= GROWTH_RAMP_DAYS; s++) {
      const v = growthIntensity(s, 0);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('decays toward neutral as idle days accumulate', () => {
    const fresh = growthIntensity(GROWTH_RAMP_DAYS, 0);
    const stale = growthIntensity(GROWTH_RAMP_DAYS, 5);
    expect(stale).toBeLessThan(fresh);
    expect(stale).toBeGreaterThan(0);
  });

  it('floors at neutral and never goes negative', () => {
    for (let since = 0; since <= GROWTH_DECAY_DAYS * 3; since++) {
      expect(growthIntensity(GROWTH_RAMP_DAYS, since)).toBeGreaterThanOrEqual(0);
    }
    expect(growthIntensity(GROWTH_RAMP_DAYS, GROWTH_DECAY_DAYS)).toBe(0);
  });
});

describe('growthLevel', () => {
  it('starts at 0', () => {
    expect(growthLevel(0)).toBe(0);
  });

  it('reaches the top level at the last threshold', () => {
    expect(growthLevel(GROWTH_LEVELS[GROWTH_LEVELS.length - 1])).toBe(GROWTH_LEVELS.length - 1);
  });

  it('never decreases as the best streak grows', () => {
    let prev = 0;
    for (let b = 0; b <= GROWTH_LEVELS[GROWTH_LEVELS.length - 1] + 10; b++) {
      const level = growthLevel(b);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it('matches each threshold exactly', () => {
    GROWTH_LEVELS.forEach((threshold, i) => {
      expect(growthLevel(threshold)).toBe(i);
    });
  });
});

describe('growthState', () => {
  it('folds the current streak into the stored high-water mark', () => {
    const logs = [0, 1, 2, 3, 4].map((i) => log(back(TODAY, i)));
    const s = growthState([], [habit()], logs, 2, TODAY);
    expect(s.streak).toBe(5);
    expect(s.best).toBe(5);
  });

  it('keeps a higher stored best when the current streak is shorter', () => {
    const logs = [log(TODAY)];
    const s = growthState([], [habit()], logs, 30, TODAY);
    expect(s.streak).toBe(1);
    expect(s.best).toBe(30);
    expect(s.level).toBe(growthLevel(30));
  });

  it('keeps the level while the tint fades back to neutral', () => {
    // Best streak of 30 banked, but nothing done for longer than the decay window.
    const s = growthState([], [], [], 30, TODAY);
    expect(s.intensity).toBe(0);
    expect(s.level).toBe(growthLevel(30));
    expect(s.level).toBeGreaterThan(0);
  });
});
