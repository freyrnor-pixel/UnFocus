/**
 * energyPause.test.ts — the daily energy pause's two pure rules, and the promise around them.
 *
 * Most of this is ordinary branch coverage over lib/energyPause.ts. One block is not:
 *
 *   **The no-notification guarantee.** Being over today's energy is a state, not an alert.
 *   A push about it would be precisely the nag this feature exists to delete — it replaces
 *   the app's loudest remaining guilt copy ("⚠️ Today is planned to use 3 more Energy than
 *   you have available"). Nothing else enforces that, so it is asserted structurally, by
 *   reading the source of all three new modules. Same technique as
 *   lib/__tests__/episodes.test.ts and lib/__tests__/cardLayout.test.ts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { MAX_DECIDE_CANDIDATES, decideCandidates, isOverBudget } from '@/lib/energyPause';
import type { Task } from '@/store/useTaskStore';

const DAY = '2026-08-02';

function task(o: Partial<Task>): Task {
  return {
    id: 't', title: 'T', date: DAY, taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day',
    monthDay: 1, monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false,
    energyValue: 1, sortOrder: 0, hint: '', followsTaskId: null, hasStartDate: false,
    sharedOut: false, assignee: '', assigneeId: '', createdByPersonId: '',
    cardType: 'standard', steps: [], ...o,
  } as Task;
}

/**
 * The two conditions the removed amber/leaf warning rows covered, collapsed into one. Either
 * alone is enough — the point of a single predicate is that there is one calm indicator
 * rather than two lines that could both be on screen saying the same thing.
 */
describe('isOverBudget', () => {
  it('is true on the SPENT path — what is already done has used the day up', () => {
    expect(isOverBudget(0, 0)).toBe(true); // exactly spent counts
    expect(isOverBudget(-3, 0)).toBe(true);
  });

  it('is true on the PLANNED path — what is still on the books would not fit', () => {
    expect(isOverBudget(7, 1)).toBe(true);
    expect(isOverBudget(7, 12)).toBe(true);
  });

  it('is true when both paths fire at once, without double-counting anything', () => {
    expect(isOverBudget(-2, 4)).toBe(true);
  });

  it('is false only when there is energy left AND the plan fits', () => {
    expect(isOverBudget(1, 0)).toBe(false);
    expect(isOverBudget(10, 0)).toBe(false);
  });

  it('treats a zero overshoot as fitting, not as overspending', () => {
    // plannedOver is derived as -Math.min(0, …), so 0 means "exactly fits".
    expect(isOverBudget(5, 0)).toBe(false);
  });
});

describe('decideCandidates', () => {
  it('never returns more than four, however long the day is', () => {
    const many = Array.from({ length: 30 }, (_, i) => task({ id: `t${i}`, sortOrder: i }));
    expect(decideCandidates(many, DAY)).toHaveLength(MAX_DECIDE_CANDIDATES);
    expect(MAX_DECIDE_CANDIDATES).toBe(4);
  });

  it('excludes tasks already done', () => {
    const tasks = [task({ id: 'a', done: true }), task({ id: 'b', done: false })];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['b']);
  });

  // A 'note' has no completion state at all (lib/cardType.ts), so it can never be "the one
  // thing I'm doing next".
  it("excludes a 'note' card, which cannot be completed", () => {
    const tasks = [task({ id: 'note', cardType: 'note' }), task({ id: 'real' })];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['real']);
  });

  it('includes the other three card types', () => {
    const tasks = [
      task({ id: 'standard', cardType: 'standard' }),
      task({ id: 'simple', cardType: 'simple' }),
      task({ id: 'stepped', cardType: 'stepped' }),
    ];
    expect(decideCandidates(tasks, DAY).map((t) => t.id).sort()).toEqual([
      'simple',
      'standard',
      'stepped',
    ]);
  });

  it('excludes tasks dated to another day', () => {
    const tasks = [task({ id: 'yesterday', date: '2026-08-01' }), task({ id: 'today' })];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['today']);
  });

  it('returns nothing for an empty day', () => {
    expect(decideCandidates([], DAY)).toEqual([]);
  });

  it('prefers the LOW energy cost first', () => {
    const tasks = [
      task({ id: 'heavy', energyEnabled: true, energyValue: -5 }),
      task({ id: 'light', energyEnabled: true, energyValue: -1 }),
      task({ id: 'middling', energyEnabled: true, energyValue: -3 }),
    ];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['light', 'middling', 'heavy']);
  });

  // A restoring task gives energy back, so on a day that is already over it is the cheapest
  // possible next thing.
  it('puts a task that RESTORES energy ahead of everything that costs', () => {
    const tasks = [
      task({ id: 'costs', energyEnabled: true, energyValue: -1 }),
      task({ id: 'restores', energyEnabled: true, energyValue: 2 }),
    ];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['restores', 'costs']);
  });

  // energyValue defaults to 1 with energyEnabled false — reading it raw would price every
  // untouched task at "restores 1" and float it to the top (lib/energy.ts's stepper trap).
  it('prices a task outside the Energy system at zero, not at its stored value', () => {
    const tasks = [
      task({ id: 'optedOut', energyEnabled: false, energyValue: 1 }),
      task({ id: 'restores', energyEnabled: true, energyValue: 2 }),
      task({ id: 'costs', energyEnabled: true, energyValue: -2 }),
    ];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['restores', 'optedOut', 'costs']);
  });

  it('breaks a cost tie towards the hard-dated item', () => {
    const tasks = [
      task({ id: 'loose' }),
      task({ id: 'timed', time: '09:00' }),
    ];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['timed', 'loose']);
  });

  it('treats an explicit start date as hard-dated too', () => {
    const tasks = [task({ id: 'loose' }), task({ id: 'dated', hasStartDate: true })];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['dated', 'loose']);
  });

  // Cost is the primary key: a hard-dated but expensive task must NOT jump a cheap loose one.
  it('does not let hard-dating override the cost preference', () => {
    const tasks = [
      task({ id: 'timedHeavy', time: '09:00', energyEnabled: true, energyValue: -6 }),
      task({ id: 'looseLight', energyEnabled: true, energyValue: -1 }),
    ];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['looseLight', 'timedHeavy']);
  });

  it('keeps the incoming order within a tier, so a dragged list stays in its shape', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })];
    expect(decideCandidates(tasks, DAY).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the array it was given', () => {
    const tasks = [
      task({ id: 'heavy', energyEnabled: true, energyValue: -5 }),
      task({ id: 'light', energyEnabled: true, energyValue: -1 }),
    ];
    decideCandidates(tasks, DAY);
    expect(tasks.map((t) => t.id)).toEqual(['heavy', 'light']);
  });
});

describe('module boundaries', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');
  /** Strip JSDoc so prose *describing* a rule doesn't trip the scan. */
  const code = (rel: string) => read(rel).replace(/\/\*\*[\s\S]*?\*\//g, '');

  it('lib/energyPause.ts stays pure — no store, DB, notification or widget module', () => {
    const source = code('lib/energyPause.ts');
    for (const forbidden of ['@/lib/db', '@/lib/notifications', '@/lib/reminders', '@/lib/widgets']) {
      expect(source).not.toContain(forbidden);
    }
    // The only store reference allowed is the TYPE import, which erases at compile time.
    expect(source).toContain("import type { Task } from '@/store/useTaskStore'");
    expect(source.replace(/import type[^\n]*\n/g, '')).not.toContain('@/store/');
  });

  // The product promise: this feature never notifies, at any horizon. Nothing else keeps it
  // true, so it is asserted over the source of all three new modules.
  it.each([
    'lib/energyPause.ts',
    'lib/energyDayState.ts',
    'lib/useEnergyPause.ts',
  ])('%s schedules nothing', (file) => {
    const source = code(file);
    for (const api of [
      'scheduleDailyReminder',
      'scheduleNotification',
      'scheduleWeeklyTaskNotifications',
      'syncReminders',
      'expo-notifications',
      'lib/notifications',
      'lib/medicineNotifications',
    ]) {
      expect(source).not.toContain(api);
    }
  });
});
