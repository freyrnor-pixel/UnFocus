/**
 * taskReset.test.ts — the state-based reset's three rules (2026-08-17, lib/taskReset.ts).
 *
 * The arithmetic half is ordinary unit testing. The other half is a SOURCE SCAN, and it is
 * the more important one: the promise this feature makes is about what the app does NOT do —
 * no overdue count, no "days late", no escalation with age, no record that a task was pushed.
 * That is an absence, and an absence cannot be asserted by calling a function; the same
 * technique lib/__tests__/episodes.test.ts and lib/__tests__/dayLog.test.ts use to keep their
 * equivalent promises true.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  WASH_AWAY_HOURS,
  canPostpone,
  hoursSinceStamp,
  isWashedAway,
  notTodayDate,
  recurringResetPatch,
  type DecayableTask,
  type ResettableTask,
} from '@/lib/taskReset';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'lib/taskReset.ts'), 'utf8');
/**
 * The module with its comments stripped. The bans below are on the CODE — the prose is where
 * this file EXPLAINS that it has no streak and no notion of lateness, so scanning it raw
 * would fail on its own documentation.
 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TODAY = '2026-08-17'; // a Monday
const NOW = Date.parse('2026-08-17T12:00:00Z');

function recurringTask(over: Partial<ResettableTask> = {}): ResettableTask {
  return {
    date: '2026-08-10',
    done: false,
    doneAt: '',
    recurring: 'daily',
    weekInterval: 1,
    hasStartDate: false,
    ...over,
  };
}

function decayTask(over: Partial<DecayableTask> = {}): DecayableTask {
  return {
    date: '2026-08-10',
    done: false,
    recurring: 'none',
    hasStartDate: true,
    cardType: 'standard',
    lastActedAt: '2026-08-10T12:00:00.000Z', // 7 days before NOW
    ...over,
  };
}

/** `hours` before NOW, as the ISO stamp the column stores. */
function stampHoursAgo(hours: number): string {
  return new Date(NOW - hours * 3600000).toISOString();
}

describe('rule 1 — recurring normalization rolls the row forward instead of counting', () => {
  it('rolls a daily task that is carrying an earlier day to today', () => {
    expect(recurringResetPatch(recurringTask({ recurring: 'daily' }), TODAY)).toEqual({ date: TODAY });
  });

  it('clears a completion that belonged to the earlier day, in the same patch', () => {
    // The whole "state over count" rule in one assertion: yesterday's tick does not survive
    // into today as a done flag, and it does not become a counter either — the patch has
    // exactly three fields and none of them is a number.
    const patch = recurringResetPatch(recurringTask({ done: true, doneAt: '08:30' }), TODAY);
    expect(patch).toEqual({ date: TODAY, done: false, doneAt: '' });
  });

  it('leaves a task already carrying today alone — null, so the caller writes nothing', () => {
    expect(recurringResetPatch(recurringTask({ date: TODAY }), TODAY)).toBeNull();
    // Including one ticked TODAY: its completion is current, and clearing it would un-tick a
    // task the user finished an hour ago.
    expect(recurringResetPatch(recurringTask({ date: TODAY, done: true, doneAt: '08:30' }), TODAY)).toBeNull();
  });

  it('is idempotent — running it on its own output is a no-op', () => {
    const task = recurringTask({ done: true, doneAt: '08:30' });
    const patch = recurringResetPatch(task, TODAY)!;
    expect(recurringResetPatch({ ...task, ...patch }, TODAY)).toBeNull();
  });

  it('rolls a weekly every-week task to today, whichever weekday that is', () => {
    expect(recurringResetPatch(recurringTask({ recurring: 'weekly', date: '2026-08-04' }), TODAY)).toEqual({
      date: TODAY,
    });
  });

  /**
   * The one case where "today" is the wrong answer. lib/taskRecurrence.ts anchors an
   * every-n-weeks task's parity on `task.date` when `hasStartDate` is set, so stamping today
   * would move an every-other-week task onto the other week — silently rescheduling a series
   * that the user set up on a calendar. It rolls by whole intervals instead.
   */
  it('preserves weekly parity for an every-other-week task with a start date', () => {
    // 2026-07-20 is a Monday, four weeks before TODAY — an even number of weeks, so today is
    // on-parity and is a legal landing place.
    expect(
      recurringResetPatch(
        recurringTask({ recurring: 'weekly', weekInterval: 2, hasStartDate: true, date: '2026-07-20' }),
        TODAY
      )
    ).toEqual({ date: TODAY });

    // 2026-07-27 is three weeks before TODAY — odd, so today is the OFF week. The roll lands
    // one week back, which is on-parity and still ahead of where the row was.
    expect(
      recurringResetPatch(
        recurringTask({ recurring: 'weekly', weekInterval: 2, hasStartDate: true, date: '2026-07-27' }),
        TODAY
      )
    ).toEqual({ date: '2026-08-10' });
  });

  it('never rolls a row backwards', () => {
    // One week apart with interval 2: the only on-parity landing place is before the date the
    // row already has, so it stays put.
    const patch = recurringResetPatch(
      recurringTask({ recurring: 'weekly', weekInterval: 2, hasStartDate: true, date: '2026-08-14' }),
      TODAY
    );
    expect(patch).toBeNull();
  });

  it('leaves one-off and monthly tasks alone', () => {
    expect(recurringResetPatch(recurringTask({ recurring: 'none' }), TODAY)).toBeNull();
    expect(recurringResetPatch(recurringTask({ recurring: 'monthly' }), TODAY)).toBeNull();
  });
});

describe('rule 2 — "Not today" is tomorrow, and nothing else', () => {
  it('returns tomorrow', () => {
    expect(notTodayDate(TODAY)).toBe('2026-08-18');
  });

  it('crosses a month boundary', () => {
    expect(notTodayDate('2026-08-31')).toBe('2026-09-01');
  });

  it('offers itself only for a task that can actually move', () => {
    const base = { recurring: 'none' as const, done: false, cardType: 'standard' as const };
    expect(canPostpone(base)).toBe(true);
    // Recurring: `date` is a scheduling boundary, so writing tomorrow into it would retime a
    // series rather than skip a day (the same exclusion TaskCard's move shortcut makes).
    expect(canPostpone({ ...base, recurring: 'daily' })).toBe(false);
    // Finished, and a note — neither has anything to push.
    expect(canPostpone({ ...base, done: true })).toBe(false);
    expect(canPostpone({ ...base, cardType: 'note' })).toBe(false);
  });
});

describe('rule 3 — washing away is a filter, and it fails safe', () => {
  it('washes away a task untouched for longer than the window', () => {
    expect(isWashedAway(decayTask({ lastActedAt: stampHoursAgo(WASH_AWAY_HOURS + 1) }), TODAY, NOW)).toBe(true);
  });

  it('keeps a task touched inside the window, including exactly at the boundary', () => {
    expect(isWashedAway(decayTask({ lastActedAt: stampHoursAgo(WASH_AWAY_HOURS - 1) }), TODAY, NOW)).toBe(false);
    expect(isWashedAway(decayTask({ lastActedAt: stampHoursAgo(WASH_AWAY_HOURS) }), TODAY, NOW)).toBe(false);
  });

  it('keeps a recurring task, a finished task and a note', () => {
    const old = stampHoursAgo(WASH_AWAY_HOURS * 10);
    expect(isWashedAway(decayTask({ lastActedAt: old, recurring: 'daily' }), TODAY, NOW)).toBe(false);
    expect(isWashedAway(decayTask({ lastActedAt: old, done: true }), TODAY, NOW)).toBe(false);
    expect(isWashedAway(decayTask({ lastActedAt: old, cardType: 'note' }), TODAY, NOW)).toBe(false);
  });

  it('keeps a task booked for today or later, however long ago it was written', () => {
    const old = stampHoursAgo(WASH_AWAY_HOURS * 10);
    expect(isWashedAway(decayTask({ lastActedAt: old, date: TODAY }), TODAY, NOW)).toBe(false);
    expect(isWashedAway(decayTask({ lastActedAt: old, date: '2026-09-01' }), TODAY, NOW)).toBe(false);
    // An UNDATED Whenever task has no such booking — a `date` in the past on a row whose
    // hasStartDate is false is just whatever day it was written on, so it can wash away.
    expect(isWashedAway(decayTask({ lastActedAt: old, hasStartDate: false }), TODAY, NOW)).toBe(true);
  });

  /**
   * Hiding a row is the outcome that loses work, so an unreadable stamp must never produce
   * it. This is the assertion that keeps the failure direction right.
   */
  it('keeps a task whose stamp is missing or unreadable', () => {
    expect(isWashedAway(decayTask({ lastActedAt: '' }), TODAY, NOW)).toBe(false);
    expect(isWashedAway(decayTask({ lastActedAt: 'not a date' }), TODAY, NOW)).toBe(false);
  });

  it('reads the SQLite datetime() shape as UTC, not as local time', () => {
    // `created_at` is `YYYY-MM-DD HH:MM:SS` in UTC and the back-fill seeds this column from
    // it. Parsed as local it would be hours out — the trap lib/date.ts's
    // utcStampToLocalMinutes documents — which at this window's resolution decides whether a
    // task is hidden.
    expect(hoursSinceStamp('2026-08-17 06:00:00', NOW)).toBe(6);
    expect(hoursSinceStamp('2026-08-17T06:00:00Z', NOW)).toBe(6);
    expect(hoursSinceStamp('', NOW)).toBeNull();
    expect(hoursSinceStamp('nonsense', NOW)).toBeNull();
  });
});

describe('the promise: nothing here can grow a number', () => {
  it('the window is the only constant, and it is a duration rather than a count of failures', () => {
    expect(WASH_AWAY_HOURS).toBe(72);
  });

  it('names no overdue/late/skip concept anywhere in the module', () => {
    // Copy is already CI-banned in lib/i18n.ts (lib/__tests__/copyTone.test.ts). This is the
    // same ban one level down, on the CODE — a `skipCount` or an `overdueDays` field would
    // pass the copy test and still be the thing this feature exists to not have.
    for (const banned of [/overdue/i, /\blate\b/i, /skipCount/, /postponedCount/, /streak/i, /penalt/i]) {
      expect(code).not.toMatch(banned);
    }
  });

  it('exports no function that records that a task was postponed', () => {
    // `notTodayDate` returns a date and takes only a date: there is nowhere for a counter to
    // live even if a caller wanted one.
    expect(notTodayDate.length).toBe(1);
    expect(typeof notTodayDate(TODAY)).toBe('string');
  });

  it('the wash-away answer does not change with age beyond the threshold', () => {
    // A task from March and one from Tuesday get the identical answer — there is no second,
    // worse state further out. Same promise lib/episodes.ts makes about an old episode.
    const march = isWashedAway(decayTask({ lastActedAt: '2026-03-01T12:00:00.000Z' }), TODAY, NOW);
    const tuesday = isWashedAway(decayTask({ lastActedAt: stampHoursAgo(WASH_AWAY_HOURS + 1) }), TODAY, NOW);
    expect(march).toBe(tuesday);
  });

  it('never notifies about any of it', () => {
    // Nothing here is allowed to nudge: not a recurring task rolling over, not a task pushed
    // to tomorrow, and above all not a task washing away. Same assertion, and the same
    // reasoning, as lib/__tests__/episodes.test.ts's notification scan.
    for (const banned of [/expo-notifications/, /scheduleNotification/, /@\/lib\/notifications/]) {
      expect(src).not.toMatch(banned);
    }
  });

  it('reaches no store, no DB and no notification layer', () => {
    // Same dependency-free discipline as lib/cardLayout.ts and lib/cardType.ts — this module
    // is evaluated in a render path (the To-do tab's filter predicate) on every tick.
    for (const banned of [/@\/store\//, /@\/lib\/db/, /@\/lib\/notifications/, /@\/lib\/reminders/]) {
      // The type-only `import type { Task } from '@/store/useTaskStore'` is erased at compile
      // time, so it is exempted by matching on a VALUE import specifically.
      expect(code.replace(/import type[^;]+;/g, '')).not.toMatch(banned);
    }
  });
});

/**
 * The screen half, as source scans.
 *
 * Neither `components/TaskCard.tsx` nor `components/TodoSurface.tsx` has a render-level test
 * in this repo (see lib/__tests__/taskCardMoveShortcut.test.ts's header for why), and none of
 * the headless harnesses can see any of this: `tsc` typechecks both wirings identically, and
 * `npm run preview` walks neither an expanded Today card nor a three-day-old task. So the
 * property is asserted in the text — the same technique lib/__tests__/stableLayout.test.ts
 * and lib/__tests__/exampleRows.test.ts use.
 *
 * `plans` reads components/TodoSurface.tsx, not app/(tabs)/plans.tsx (2026-08-20 extraction) —
 * that file is a thin ScreenScaffold wrapper now; the predicate/drawer this describes live in
 * the extracted surface, unchanged.
 */
describe('the screen half is wired where it has to be', () => {
  const card = readFileSync(join(ROOT, 'components/TaskCard.tsx'), 'utf8');
  const plans = readFileSync(join(ROOT, 'components/TodoSurface.tsx'), 'utf8');

  it('TaskCard gates "Not today" on the STORE\'s own rule, not a local copy of it', () => {
    // The button and the action must not be able to disagree about when this is legal — a
    // second hand-written condition here is how a control ends up doing nothing when tapped.
    expect(card).toMatch(/import \{ canPostpone \} from '@\/lib\/taskReset'/);
    expect(card).toMatch(/\{canPostpone\(task\) && \(/);
  });

  it('TaskCard reads today at PRESS time, never captured in the render body', () => {
    // This card stays mounted across midnight on a pager that never unmounts a screen, so a
    // captured date would push the task to yesterday's tomorrow. Same trap
    // lib/__tests__/todayFreshness.test.ts pins for the tab screens.
    const start = card.indexOf('function handleNotToday');
    expect(start).toBeGreaterThan(-1);
    expect(card.slice(start, start + 200)).toMatch(/notToday\(task\.id, todayStr\(\)\)/);
  });

  it('the wash-away filter sits in plans.tsx\'s ONE shared predicate', () => {
    // In `matchFilters`, which every section selector on that screen already runs through —
    // so an archived task leaves Today, This week, Whenever and All in one move. Filtering
    // per-section would let it linger in one list while being archived in another.
    const start = plans.indexOf('const matchFilters = useCallback');
    const body = plans.slice(start, plans.indexOf('  );', start));
    expect(body).toMatch(/isWashedAway\(tk, today, Date\.now\(\)\)/);
    // ...and behind its feature flag, which must gate the FILTER rather than the drawer, or
    // turning it off would strand the archived tasks in a section nothing renders.
    expect(body).toMatch(/taskDecayOn/);
  });

  it('washed away renders only when it holds something, and shows no age', () => {
    // ⚠️ **Washed away is a SECTION inside the Whenever card's own body as of 2026-08-26**
    // (phase 5 of DESIGN_COMPARISON/19-IMPLEMENTATION.md — was `todoWashedAway`, a top-level
    // registry card under a "CollapsedSection"-shaped drawer; see lib/cardRegistry.ts's note at
    // its old position). It renders inside `wheneverCard`, which is itself gated on
    // `showWhenever` (full tab OR the Whenever card's own expanded pane) — there is no separate
    // `full &&` guard on the section any more, because a section rides its parent's visibility.
    expect(plans).toMatch(/\{washedAway\.length > 0 && \(/);
    const start = plans.indexOf('{washedAway.length > 0 && (');
    const block = plans.slice(start, plans.indexOf('</SectionCard>', start));
    // A date, a "days ago" or a formatted stamp on one of these rows would re-introduce
    // exactly the escalation the whole feature exists to avoid.
    expect(block).not.toMatch(/formatDisplayDate|lastActedAt|hoursSince|\bdaysAgo\b/);
  });
});
