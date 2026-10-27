/**
 * habitStrength.test.ts — pins lib/habitStrength.ts (Loop's score, per occurrence, with
 * partial credit, rest days skipped, and an unlogged today that never counts).
 *
 * Connections:
 *   Imports → lib/habitStrength, lib/date
 *   Used by → jest
 *   Data    → none
 */
import { habitStrength, strengthLevel, dueFrequency } from '@/lib/habitStrength';
import { addDays } from '@/lib/date';
import type { Habit, HabitLog } from '@/store/useHabitStore';

const TODAY = '2026-10-26';

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1', title: 'Water', icon: 'water', kind: 'build', category: 'other', cue: '', craving: '', response: '', reward: '',
    dailyGoal: 1, recurrence: 'daily', recurrenceDays: [], recurrenceInterval: 1, notificationEnabled: false,
    notificationTimes: [], reminderMode: null, reminderCount: null, reminderIntervalMin: null, reminderStart: null,
    reminderEnd: null, routineOrder: 0, active: true, createdAt: '2026-08-01T08:00:00.000Z', childName: '',
    energyEnabled: false, energyValue: 0, goalId: null,
    ...over,
  } as Habit;
}

function logs(days: number, count = 1, extra: Partial<HabitLog> = {}): HabitLog[] {
  return Array.from({ length: days }, (_, i) => ({
    id: `l${i}`, habitId: 'h1', logDate: addDays(TODAY, -i), count, restDay: false, firstAt: '08:00', ...extra,
  }));
}

describe('habitStrength', () => {
  it('starts at 0 and grows with every logged occurrence', () => {
    expect(habitStrength(habit({ createdAt: `${TODAY}T08:00:00.000Z` }), [], TODAY)).toBe(0);
    const a = habitStrength(habit(), logs(10), TODAY)!;
    const b = habitStrength(habit(), logs(40), TODAY)!;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("Loop's half-life: 13 straight days from zero reaches one half", () => {
    const h = habit({ createdAt: `${addDays(TODAY, -12)}T08:00:00.000Z` });
    expect(habitStrength(h, logs(13), TODAY)).toBeCloseTo(0.5, 5);
  });

  it('one gap costs a sliver, not the lot', () => {
    const full = habitStrength(habit(), logs(60), TODAY)!;
    const gap = habitStrength(habit(), logs(60).filter((l) => l.logDate !== addDays(TODAY, -1)), TODAY)!;
    expect(full - gap).toBeLessThan(0.06);
  });

  it('partial credit: 1 of 2 grows half as fast as 2 of 2', () => {
    const half = habitStrength(habit({ dailyGoal: 2 }), logs(30, 1), TODAY)!;
    const whole = habitStrength(habit({ dailyGoal: 2 }), logs(30, 2), TODAY)!;
    expect(half).toBeCloseTo(whole / 2, 5);
  });

  it('a rest day is skipped — neither up nor down', () => {
    const rested = logs(30).map((l) => (l.logDate === addDays(TODAY, -3) ? { ...l, count: 0, restDay: true } : l));
    const without = logs(30).filter((l) => l.logDate !== addDays(TODAY, -3));
    const h = habit({ createdAt: `${addDays(TODAY, -29)}T08:00:00.000Z` });
    // Resting = as if that day were not scheduled; a plain gap would cost something.
    expect(habitStrength(h, rested, TODAY)!).toBeGreaterThan(habitStrength(h, without, TODAY)!);
  });

  it('an unlogged today never pulls it down', () => {
    const throughYesterday = logs(30).filter((l) => l.logDate !== TODAY);
    const yesterdayView = habitStrength(habit(), throughYesterday, addDays(TODAY, -1))!;
    expect(habitStrength(habit(), throughYesterday, TODAY)).toBeCloseTo(yesterdayView, 10);
  });

  it('less frequent habits have shorter half-lives in occurrences (Loop √frequency)', () => {
    expect(dueFrequency(habit({ recurrence: 'weekly', recurrenceDays: [0] }))).toBeCloseTo(1 / 7);
    // 5 weekly Mondays in a row lands near a half, where 5 daily days would be ~0.23.
    const weekly = habit({ recurrence: 'weekly', recurrenceDays: [0], createdAt: '2026-09-21T08:00:00.000Z' });
    const mondays = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((d, i) => ({
      id: `m${i}`, habitId: 'h1', logDate: d, count: 1, restDay: false, firstAt: '',
    }));
    expect(habitStrength(weekly, mondays, TODAY)!).toBeGreaterThan(0.5);
  });

  it('one-time habits have no strength', () => {
    expect(habitStrength(habit({ recurrence: 'one-time' }), [], TODAY)).toBeNull();
  });

  it('levels are words, in order', () => {
    expect([0, 0.3, 0.6, 0.9].map(strengthLevel)).toEqual(['new', 'growing', 'strong', 'established']);
  });
});
