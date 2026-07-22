/**
 * habitRecurrence.test.ts — unit tests for lib/habitRecurrence.ts.
 *
 * Covers habitOccursOn (daily/weekly/monthly/one-time/weekly-flexible), the weekly
 * cumulative count helper, habitProgress (fixed-schedule vs. weekly-flexible count/
 * ratio/isDone), and habitMetOn (per-day vs. once-per-week-on-the-crossing-day for
 * weekly-flexible — this is what makes the Energy system award a habit's value only
 * once per week instead of every day after the goal is reached). Pure functions —
 * no DB, no store; plain objects cast to the store types.
 */
import { habitOccursOn, habitWeekCountThrough, habitProgress, habitMetOn } from '@/lib/habitRecurrence';
import type { Habit, HabitLog } from '@/store/useHabitStore';

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

const log = (habitId: string, logDate: string, count: number, restDay = false): HabitLog => ({
  id: `${habitId}-${logDate}`, habitId, logDate, count, restDay,
});

// 2026-07-13 Mon .. 2026-07-19 Sun
const MON = '2026-07-13';
const WED = '2026-07-15';
const FRI = '2026-07-17';
const SUN = '2026-07-19';

describe('habitOccursOn', () => {
  it('daily/one-time/weekly-flexible are always due', () => {
    expect(habitOccursOn(habit({ recurrence: 'daily' }), WED)).toBe(true);
    expect(habitOccursOn(habit({ recurrence: 'one-time' }), WED)).toBe(true);
    expect(habitOccursOn(habit({ recurrence: 'weekly-flexible' }), WED)).toBe(true);
  });

  it('weekly with no days picked is due every day', () => {
    expect(habitOccursOn(habit({ recurrence: 'weekly', recurrenceDays: [] }), WED)).toBe(true);
  });

  it('weekly only matches its picked weekdays', () => {
    const h = habit({ recurrence: 'weekly', recurrenceDays: [2] }); // Wed
    expect(habitOccursOn(h, WED)).toBe(true);
    expect(habitOccursOn(h, MON)).toBe(false);
  });

  it('monthly matches only the pinned day-of-month', () => {
    const h = habit({ recurrence: 'monthly', recurrenceDays: [15] });
    expect(habitOccursOn(h, WED)).toBe(true);
    expect(habitOccursOn(h, MON)).toBe(false);
  });
});

describe('habitWeekCountThrough', () => {
  it('sums logged counts from Monday through the given date, ignoring later days', () => {
    const h = habit({ id: 'w' });
    const logs = [log('w', MON, 1), log('w', WED, 2), log('w', FRI, 5)];
    expect(habitWeekCountThrough(h, logs, WED)).toBe(3); // Mon + Wed, not Fri
    expect(habitWeekCountThrough(h, logs, FRI)).toBe(8);
  });
});

describe('habitProgress', () => {
  it('fixed-schedule habit: count/ratio/isDone come from that single day only', () => {
    const h = habit({ id: 'w', dailyGoal: 2, recurrence: 'daily' });
    const logs = [log('w', MON, 3), log('w', WED, 1)];
    const p = habitProgress(h, logs, WED);
    expect(p.count).toBe(1);
    expect(p.isDone).toBe(false);
  });

  it('weekly-flexible habit: count is the week cumulative, done once it reaches the goal', () => {
    const h = habit({ id: 'w', dailyGoal: 3, recurrence: 'weekly-flexible' });
    const logs = [log('w', MON, 1), log('w', WED, 1)];
    expect(habitProgress(h, logs, WED)).toMatchObject({ count: 2, goal: 3, isDone: false });
    const withFri = [...logs, log('w', FRI, 1)];
    expect(habitProgress(h, withFri, FRI)).toMatchObject({ count: 3, goal: 3, isDone: true });
    // Stays "done" through the rest of the week even without more logging.
    expect(habitProgress(h, withFri, SUN)).toMatchObject({ count: 3, isDone: true });
  });
});

describe('habitMetOn', () => {
  it('fixed-schedule habit: met on any day its own count reaches the goal', () => {
    const h = habit({ id: 'w', dailyGoal: 2, recurrence: 'daily' });
    expect(habitMetOn(h, [log('w', WED, 1)], WED)).toBe(false);
    expect(habitMetOn(h, [log('w', WED, 2)], WED)).toBe(true);
  });

  it('a rest day is never met, even if the count would otherwise qualify', () => {
    const h = habit({ id: 'w', dailyGoal: 1, recurrence: 'daily' });
    expect(habitMetOn(h, [log('w', WED, 5, true)], WED)).toBe(false);
  });

  it('weekly-flexible: met ONLY on the day the weekly cumulative first crosses the goal', () => {
    const h = habit({ id: 'w', dailyGoal: 3, recurrence: 'weekly-flexible' });
    const logs = [log('w', MON, 1), log('w', WED, 1), log('w', FRI, 1)];
    // Cumulative: Mon=1, Wed=2, Fri=3 — only Friday crosses the goal.
    expect(habitMetOn(h, logs, MON)).toBe(false);
    expect(habitMetOn(h, logs, WED)).toBe(false);
    expect(habitMetOn(h, logs, FRI)).toBe(true);
    // Not met again later in the week — Energy should only apply once.
    expect(habitMetOn(h, logs, SUN)).toBe(false);
  });

  it('weekly-flexible: a single day reaching the goal outright is met that day', () => {
    const h = habit({ id: 'w', dailyGoal: 2, recurrence: 'weekly-flexible' });
    expect(habitMetOn(h, [log('w', WED, 2)], WED)).toBe(true);
  });
});
