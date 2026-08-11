/**
 * habitRecurrence.test.ts — unit tests for lib/habitRecurrence.ts.
 *
 * Covers habitOccursOn (daily/weekly/monthly/one-time/weekly-flexible, plus the
 * 2026-08-11 recurrenceInterval multiplier — every N days/weeks, derived from
 * createdAt), the weekly cumulative count helper, habitProgress (fixed-schedule vs.
 * weekly-flexible count/ratio/isDone), and habitMetOn (per-day vs.
 * once-per-week-on-the-crossing-day for weekly-flexible — this is what makes the
 * Energy system award a habit's value only once per week instead of every day after
 * the goal is reached). Pure functions — no DB, no store; plain objects cast to the
 * store types.
 */
import { habitOccursOn, habitWeekCountThrough, habitProgress, habitMetOn } from '@/lib/habitRecurrence';
import { dateStr } from '@/lib/date';
import type { Habit, HabitLog } from '@/store/useHabitStore';

function habit(o: Partial<Habit>): Habit {
  return {
    id: 'h', title: 'H', icon: '', kind: 'neutral', category: 'other', cue: '',
    craving: '', response: '', reward: '', dailyGoal: 1, recurrence: 'daily',
    recurrenceDays: [], recurrenceInterval: 1, notificationEnabled: false, notificationTimes: [],
    reminderMode: null, reminderCount: null, reminderIntervalMin: null,
    reminderStart: null, reminderEnd: null, routineOrder: 0, active: true,
    createdAt: '', childName: '', energyEnabled: false, energyValue: 1, ...o,
  } as Habit;
}

const log = (habitId: string, logDate: string, count: number, restDay = false): HabitLog => ({
  // `firstAt` is the day log's stamp (lib/dayLog.ts); habitMetOn/habitProgress never read
  // it. Present only to satisfy the type.
  id: `${habitId}-${logDate}`, habitId, logDate, count, restDay, firstAt: '',
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

describe('habitOccursOn: recurrenceInterval (2026-08-11 "every N days/weeks")', () => {
  it('N <= 1 is byte-identical to plain daily/weekly, regardless of createdAt', () => {
    const daily1 = habit({ recurrence: 'daily', recurrenceInterval: 1, createdAt: '2026-01-01 00:00:00' });
    const dailyDefault = habit({ recurrence: 'daily', createdAt: '2026-01-01 00:00:00' });
    expect(habitOccursOn(daily1, WED)).toBe(true);
    expect(habitOccursOn(dailyDefault, WED)).toBe(true);

    const weekly1 = habit({ recurrence: 'weekly', recurrenceDays: [2], recurrenceInterval: 1, createdAt: MON + ' 00:00:00' });
    expect(habitOccursOn(weekly1, WED)).toBe(true); // Wed is the picked day
    expect(habitOccursOn(weekly1, MON)).toBe(false); // Mon isn't picked — unaffected by interval
    // A whole month later, still every week (N=1 never gates on the week).
    expect(habitOccursOn(weekly1, '2026-08-12')).toBe(true); // a later Wednesday
  });

  it('daily, every 3 days: occurs on the anchor and every 3rd day after, across a month boundary', () => {
    // SQLite datetime('now') shape: 'YYYY-MM-DD HH:MM:SS'.
    const h = habit({ recurrence: 'daily', recurrenceInterval: 3, createdAt: '2026-07-30 09:00:00' });
    expect(habitOccursOn(h, '2026-07-30')).toBe(true); // anchor day itself
    expect(habitOccursOn(h, '2026-07-31')).toBe(false);
    expect(habitOccursOn(h, '2026-08-01')).toBe(false);
    expect(habitOccursOn(h, '2026-08-02')).toBe(true); // +3 days, crosses the month boundary
    expect(habitOccursOn(h, '2026-08-03')).toBe(false);
    expect(habitOccursOn(h, '2026-08-05')).toBe(true); // +6 days
  });

  it('weekly, every 2 weeks: the whole anchor week occurs, the next week does not, then it resumes', () => {
    // Anchor week is MON..SUN (2026-07-13..2026-07-19); recurrenceDays empty = every day
    // of an included week (mirrors the plain-weekly "no days picked = every day" rule).
    const h = habit({ recurrence: 'weekly', recurrenceDays: [], recurrenceInterval: 2, createdAt: MON + ' 00:00:00' });
    expect(habitOccursOn(h, MON)).toBe(true); // anchor week
    expect(habitOccursOn(h, WED)).toBe(true); // anchor week
    expect(habitOccursOn(h, '2026-07-22')).toBe(false); // next week — skipped
    expect(habitOccursOn(h, '2026-07-29')).toBe(true); // two weeks later — resumes
  });

  it('weekly, every 2 weeks, with specific weekdays: both gates apply', () => {
    const h = habit({ recurrence: 'weekly', recurrenceDays: [2], recurrenceInterval: 2, createdAt: MON + ' 00:00:00' }); // Wed
    expect(habitOccursOn(h, WED)).toBe(true); // anchor week, right weekday
    expect(habitOccursOn(h, MON)).toBe(false); // anchor week, wrong weekday
    expect(habitOccursOn(h, '2026-07-22')).toBe(false); // next Wed, but the wrong (skipped) week
    expect(habitOccursOn(h, '2026-07-29')).toBe(true); // Wed two weeks later
  });

  it('a missing or blank createdAt fails open (treated as always occurring), never hides the habit', () => {
    const dailyBlank = habit({ recurrence: 'daily', recurrenceInterval: 5, createdAt: '' });
    expect(habitOccursOn(dailyBlank, WED)).toBe(true);
    expect(habitOccursOn(dailyBlank, SUN)).toBe(true);

    const weeklyGarbled = habit({ recurrence: 'weekly', recurrenceDays: [], recurrenceInterval: 4, createdAt: 'not-a-date' });
    expect(habitOccursOn(weeklyGarbled, WED)).toBe(true);
  });

  /**
   * Regression, 2026-08-11. The anchor used to be `createdAt.slice(0, 10)` — a UTC date —
   * while `date` is a LOCAL one. A habit created at 00:30 local east of Greenwich carries a
   * UTC stamp dated the day BEFORE, so `daysBetween(anchor, today)` was 1 and an
   * every-2-days habit was absent from the very day it was made.
   *
   * Written against the local-creation-day INVARIANT rather than fixed date literals,
   * because jest does not pin TZ (nothing in jest.config.js sets it) — so this runs at the
   * runner's offset, UTC on CI and the maintainer's own zone locally. Where UTC and local
   * agree the two dates coincide and these assertions are merely true rather than probing;
   * at any non-zero offset they fail against the old slice().
   */
  it('anchors on the LOCAL creation date, so a just-created habit always occurs today', () => {
    // 00:30 local — the window where the local and UTC dates disagree east of Greenwich.
    const createdLocal = new Date(2026, 7, 11, 0, 30);
    const createdAt = createdLocal.toISOString();
    const localDay = dateStr(createdLocal);

    for (const n of [2, 3, 5]) {
      const h = habit({ recurrence: 'daily', recurrenceInterval: n, createdAt });
      expect(habitOccursOn(h, localDay)).toBe(true);
      // …and the cycle counts from that same local day: n days on, the days between off.
      const nDaysLater = dateStr(new Date(2026, 7, 11 + n));
      expect(habitOccursOn(h, nDaysLater)).toBe(true);
      expect(habitOccursOn(h, dateStr(new Date(2026, 7, 12)))).toBe(false);
    }
  });

  it('reads both createdAt stamp shapes as UTC (ISO from the store, datetime() from the column default)', () => {
    const iso = habit({ recurrence: 'daily', recurrenceInterval: 2, createdAt: '2026-08-11T09:00:00.000Z' });
    const sqlite = habit({ recurrence: 'daily', recurrenceInterval: 2, createdAt: '2026-08-11 09:00:00' });
    for (const d of ['2026-08-11', '2026-08-12', '2026-08-13']) {
      expect(habitOccursOn(iso, d)).toBe(habitOccursOn(sqlite, d));
    }
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
