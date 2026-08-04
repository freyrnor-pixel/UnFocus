/**
 * dayLog.test.ts — the day-log selector, and the four product promises it carries.
 *
 * Most of this is ordinary branch coverage. Four blocks are not, and none of them has any
 * other enforcement in the codebase:
 *
 *   1. **Absence beats invention.** An entry with no honest time is DROPPED, never floated
 *      to the top of the day and never given a synthesised one. The feature's whole value
 *      is being a record you can trust when your head says you did nothing; a log that
 *      guesses is worth less than a log with a hole in it.
 *   2. **No counting, anywhere.** No total, no "3 of 9", no percentage, no rate. A chaotic
 *      day yields a low number and a low number is a verdict. Asserted structurally as well
 *      as behaviourally, because the tempting regression is a helpful-looking `count` field.
 *   3. **No durations.** Nothing here subtracts two times. The app derives a duration in
 *      exactly one place (lib/episodes.ts's `describeDuration`) and that stays the only one.
 *   4. **No notifications, at any horizon.** Nothing on this surface interrupts anyone.
 *      Same source-scan technique as lib/__tests__/episodes.test.ts, which is what keeps
 *      the equivalent promise true for episodes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildDayLog, DayLogSources, formatEntryTime } from '@/lib/dayLog';

/** A source set with every list empty; spread it and override just the one under test. */
const EMPTY: DayLogSources = { tasks: [], habits: [], doses: [], health: [], moments: [] };

const WHOLE_DAY = 1440;

describe('buildDayLog — ordering', () => {
  it('returns entries oldest first, across every kind', () => {
    const entries = buildDayLog(
      {
        tasks: [{ id: 't1', title: 'Washed up', doneAt: '14:00' }],
        habits: [{ id: 'hb1', name: 'Morning stretch', firstAt: '07:05' }],
        doses: [{ id: 'd1', label: 'Elvanse', takenAt: '08:15' }],
        health: [{ id: 'h1', label: 'Headache', atMinutes: 11 * 60 }],
        moments: [{ id: 'm1', text: 'Rang the dentist', atTime: '09:40' }],
      },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.label)).toEqual([
      'Morning stretch',
      'Elvanse',
      'Rang the dentist',
      'Headache',
      'Washed up',
    ]);
  });

  // DESIGN_RULES rule 9 — layout is stable, nothing jumps. Two things logged in the same
  // minute must keep a fixed order across renders rather than shuffling.
  it('breaks ties on a stable id rather than leaving order to sort stability', () => {
    const sources: DayLogSources = {
      ...EMPTY,
      tasks: [
        { id: 'b', title: 'Second', doneAt: '10:00' },
        { id: 'a', title: 'First', doneAt: '10:00' },
      ],
    };
    const once = buildDayLog(sources, WHOLE_DAY).map((e) => e.id);
    const twice = buildDayLog(sources, WHOLE_DAY).map((e) => e.id);
    expect(once).toEqual(twice);
    expect(once).toEqual(['task:a', 'task:b']);
  });

  it('prefixes ids by kind so two sources cannot collide on a shared row id', () => {
    const entries = buildDayLog(
      {
        ...EMPTY,
        tasks: [{ id: 'same', title: 'A task', doneAt: '09:00' }],
        moments: [{ id: 'same', text: 'A moment', atTime: '09:30' }],
      },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.id)).toEqual(['task:same', 'moment:same']);
  });
});

describe('buildDayLog — the now-line cutoff', () => {
  it('omits entries after the cutoff', () => {
    const sources: DayLogSources = {
      ...EMPTY,
      tasks: [
        { id: 'past', title: 'Behind now', doneAt: '09:00' },
        { id: 'ahead', title: 'Ahead of now', doneAt: '15:00' },
      ],
    };
    expect(buildDayLog(sources, 12 * 60).map((e) => e.label)).toEqual(['Behind now']);
  });

  /**
   * REGRESSION (2026-08-02, caught in the web preview, not by a unit test).
   *
   * The cutoff was a strict `<`. Both this module and lib/useNowMinutes are
   * minute-granular, so the thing a user JUST did is stamped at exactly the current
   * minute — and was therefore dropped for up to 60 seconds. The log rendered empty
   * every single time you ticked something, which is precisely when you'd look at it,
   * so the feature appeared broken in the only moment that mattered.
   *
   * An entry stamped at the current minute has already happened. Do not tighten this
   * back to `<`.
   */
  it('INCLUDES an entry stamped at exactly the cutoff minute', () => {
    const sources: DayLogSources = {
      ...EMPTY,
      tasks: [{ id: 'just-now', title: 'Ticked this very minute', doneAt: '12:00' }],
    };
    expect(buildDayLog(sources, 12 * 60).map((e) => e.label)).toEqual(['Ticked this very minute']);
  });

  it('includes a moment captured at exactly the cutoff minute too', () => {
    const sources: DayLogSources = {
      ...EMPTY,
      moments: [{ id: 'm', text: 'Rang the dentist', atTime: '12:00' }],
    };
    expect(buildDayLog(sources, 12 * 60)).toHaveLength(1);
  });

  it('still omits the very next minute', () => {
    const sources: DayLogSources = {
      ...EMPTY,
      tasks: [{ id: 'soon', title: 'One minute ahead', doneAt: '12:01' }],
    };
    expect(buildDayLog(sources, 12 * 60)).toEqual([]);
  });

  it('1440 means the whole day — what a past date passes', () => {
    const sources: DayLogSources = {
      ...EMPTY,
      tasks: [{ id: 'late', title: 'Just before midnight', doneAt: '23:59' }],
    };
    expect(buildDayLog(sources, WHOLE_DAY)).toHaveLength(1);
  });
});

// Promise 1. Every one of these is a real shape the data takes: a task completed before
// tasks.done_at existed, a task a paired device ticked (done_at is deliberately not synced),
// or a health entry whose UTC created_at landed on a different local day.
describe('buildDayLog — absence beats invention', () => {
  it.each([
    ['an empty time', ''],
    ['whitespace', '   '],
    ['a malformed time', '9am'],
    ['a bare hour', '09'],
    ['an out-of-range hour', '25:00'],
    ['an out-of-range minute', '10:75'],
  ])('drops a task with %s rather than placing it', (_label, doneAt) => {
    const entries = buildDayLog({ ...EMPTY, tasks: [{ id: 't', title: 'X', doneAt }] }, WHOLE_DAY);
    expect(entries).toEqual([]);
  });

  it('drops a health entry whose time could not be resolved', () => {
    const entries = buildDayLog(
      { ...EMPTY, health: [{ id: 'h', label: 'Nausea', atMinutes: null }] },
      WHOLE_DAY
    );
    expect(entries).toEqual([]);
  });

  it('never places an unresolvable entry at midnight', () => {
    const entries = buildDayLog(
      {
        ...EMPTY,
        tasks: [
          { id: 'good', title: 'Timed', doneAt: '13:00' },
          { id: 'bad', title: 'Untimed', doneAt: '' },
        ],
      },
      WHOLE_DAY
    );
    // The failure mode this guards: a `?? 0` fallback turning "no time" into 00:00, which
    // would silently claim an untimed task was the first thing that happened that day.
    expect(entries.map((e) => e.atMinutes)).toEqual([13 * 60]);
  });
});

/**
 * Habits (2026-08-02). A habit is a standing commitment the user set up, so doing it is
 * exactly the evidence this log is for — my first pass excluded them on a weak argument
 * about multi-count habits and the maintainer was right to reject it.
 *
 * The rule is the FIRST log of the day, deliberately not "was the daily goal met":
 * gating on met-ness would import a pass/fail threshold into a surface that has none, and
 * 5 of 7 glasses of water would leave no trace at all. Everything below encodes that
 * choice; if someone "unifies" this with habitMetOn() these are what should fail.
 *
 * (The rest-day and count-of-zero gates live in lib/useDayLog.ts, which is what feeds
 * this module — the selector is handed only habits that already qualify.)
 */
describe('buildDayLog — habits', () => {
  it('places a habit at the time it was first logged', () => {
    const entries = buildDayLog(
      { ...EMPTY, habits: [{ id: 'h1', name: 'Morning stretch', firstAt: '07:05' }] },
      WHOLE_DAY
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'habit',
      label: 'Morning stretch',
      atMinutes: 7 * 60 + 5,
      sourceId: 'h1',
    });
  });

  // The whole point of choosing "first log" over "met". A counter habit the user got
  // part-way through is still something they did, and the log must say so.
  it('includes a partly-done counter habit — no threshold', () => {
    const entries = buildDayLog(
      { ...EMPTY, habits: [{ id: 'water', name: 'Drink water', firstAt: '08:00' }] },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.label)).toEqual(['Drink water']);
  });

  // Absence beats invention, same as tasks: a habit logged before habit_logs.first_at
  // existed has no honest time and must not be floated to midnight.
  it.each([
    ['no stamp (pre-migration)', ''],
    ['whitespace', '  '],
    ['a malformed time', 'morning'],
  ])('drops a habit with %s', (_label, firstAt) => {
    const entries = buildDayLog({ ...EMPTY, habits: [{ id: 'h', name: 'X', firstAt }] }, WHOLE_DAY);
    expect(entries).toEqual([]);
  });

  it('interleaves habits with every other kind by time, not by kind', () => {
    const entries = buildDayLog(
      {
        ...EMPTY,
        tasks: [{ id: 't', title: 'Washed up', doneAt: '09:00' }],
        habits: [
          { id: 'a', name: 'Early habit', firstAt: '06:30' },
          { id: 'b', name: 'Late habit', firstAt: '21:00' },
        ],
      },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.label)).toEqual(['Early habit', 'Washed up', 'Late habit']);
  });

  it('gives habits their own id namespace so a habit and task cannot collide', () => {
    const entries = buildDayLog(
      {
        ...EMPTY,
        tasks: [{ id: 'same', title: 'A task', doneAt: '09:00' }],
        habits: [{ id: 'same', name: 'A habit', firstAt: '08:00' }],
      },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.id)).toEqual(['habit:same', 'task:same']);
  });
});

describe('buildDayLog — per-kind mapping', () => {
  it('carries sourceId for kinds with an origin record to navigate back to', () => {
    const entries = buildDayLog(
      {
        ...EMPTY,
        tasks: [{ id: 't1', title: 'A task', doneAt: '09:00' }],
        doses: [{ id: 'd1', label: 'A dose', takenAt: '10:00' }],
        health: [{ id: 'h1', label: 'An entry', atMinutes: 11 * 60 }],
      },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.sourceId)).toEqual(['t1', 'd1', 'h1']);
  });

  // A moment IS the record — there is nothing to open, so it deliberately has no sourceId.
  it('omits sourceId on a moment', () => {
    const [entry] = buildDayLog(
      { ...EMPTY, moments: [{ id: 'm1', text: 'Rang the dentist', atTime: '09:40' }] },
      WHOLE_DAY
    );
    expect(entry.sourceId).toBeUndefined();
    expect(entry.kind).toBe('moment');
  });

  it('tags each entry with the kind it came from', () => {
    const entries = buildDayLog(
      {
        tasks: [{ id: 't', title: 'a', doneAt: '01:00' }],
        habits: [{ id: 'hb', name: 'b', firstAt: '01:30' }],
        doses: [{ id: 'd', label: 'c', takenAt: '02:00' }],
        health: [{ id: 'h', label: 'd', atMinutes: 180 }],
        moments: [{ id: 'm', text: 'e', atTime: '04:00' }],
      },
      WHOLE_DAY
    );
    expect(entries.map((e) => e.kind)).toEqual(['task', 'habit', 'medicine', 'health', 'moment']);
  });
});

describe('formatEntryTime', () => {
  it.each([
    [0, '00:00'],
    [9 * 60 + 5, '09:05'],
    [13 * 60 + 40, '13:40'],
    [23 * 60 + 59, '23:59'],
  ])('renders %p as %p, zero-padded so a column of times lines up', (minutes, expected) => {
    expect(formatEntryTime(minutes)).toBe(expected);
  });
});

// Promises 2–4, asserted structurally. These are product rules with no other enforcement:
// nothing about a passing render would catch a `total` creeping back in.
describe('the day log keeps its promises structurally', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');
  /** Strip JSDoc so prose *describing* a rule doesn't trip the scan. */
  const code = (rel: string) => read(rel).replace(/\/\*\*[\s\S]*?\*\//g, '');

  it('lib/dayLog.ts reaches no DB, store, notification or widget module', () => {
    const source = code('lib/dayLog.ts');
    for (const forbidden of [
      '@/lib/db',
      '@/store/',
      '@/lib/notifications',
      '@/lib/reminders',
      '@/lib/widgets',
      'react',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it.each(['lib/dayLog.ts', 'lib/useDayLog.ts'])('%s schedules nothing', (file) => {
    const source = code(file);
    for (const api of [
      'scheduleNotificationAsync',
      'Notifications.',
      'setNotificationHandler',
      'syncReminders',
      'scheduleDailyReminder',
    ]) {
      expect(source).not.toContain(api);
    }
  });

  // Invariant 1. `.length` is the tell: any aggregate over the entries has to start there.
  // formatEntryTime and the parser use only arithmetic on a single value.
  it('lib/dayLog.ts derives no count, total or percentage', () => {
    const source = code('lib/dayLog.ts');
    for (const aggregate of ['.length', 'reduce(', 'Math.round', 'toFixed', '%`', 'percent']) {
      expect(source).not.toContain(aggregate);
    }
  });

  // Invariant 2. An entry has an instant, not a span — the moment this file starts
  // subtracting two times, it has become a stopwatch, which is the thing episodes and
  // medicine trays are both carefully NOT.
  it('DayEntry exposes an instant and no duration field', () => {
    const source = read('lib/dayLog.ts');
    const type = source.slice(source.indexOf('export type DayEntry'), source.indexOf('DayLogSources'));
    for (const field of ['duration', 'endMinutes', 'elapsed', 'spanMinutes']) {
      expect(type).not.toContain(field);
    }
  });

  // Regression: useDayLog used to return `[]` — not `undefined` — when
  // settings.featureDayLog is off. PlanTaskCard gates its `dayLogActive` boundary purely
  // on the dayLog prop's *presence* (`!!dayLog`), and `[]` is just as truthy as a real
  // list, so the now-line split was permanently on regardless of the setting. `undefined`
  // is the only return value that actually turns the boundary off.
  it('lib/useDayLog.ts returns undefined, not [], when the feature flag is off', () => {
    const source = code('lib/useDayLog.ts');
    expect(source).toMatch(/if \(!enabled\) return undefined;/);
    expect(source).not.toMatch(/if \(!enabled\) return \[\];/);
    expect(source).toMatch(/DayEntry\[\] \| undefined/);
  });
});
