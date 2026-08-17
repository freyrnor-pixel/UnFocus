/**
 * taskStateReset.test.ts — store/useTaskStore.ts's three state-based-reset actions
 * (2026-08-17): `normalizeRecurringTasks`, `notToday`, and `washedAwayTasks`/`bringBack`.
 *
 * The RULES are pure and tested in lib/__tests__/taskReset.test.ts. What is tested here is
 * the half the store owns and that file cannot see: which rows get written, which columns
 * the SQL touches, and — the load-bearing one — which writes stamp `last_acted_at` and which
 * deliberately do not. That distinction is invisible to `tsc`, to a screenshot and to the web
 * preview: getting it backwards would make the app's own nightly tidy-up count as the user
 * touching every task, so nothing would ever wash away and the archive would sit empty
 * forever with no error anywhere.
 *
 * Only '@/lib/db' is mocked, the same minimal recipe as __tests__/taskStore.test.ts — which
 * already establishes that this store's other side effects (notifications, calendar sync,
 * the live-sync broadcast) are safe no-ops headless.
 */
import { useTaskStore } from '@/store/useTaskStore';
import type { Task } from '@/store/useTaskStore';
import { WASH_AWAY_HOURS } from '@/lib/taskReset';
import db from '@/lib/db';

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));

const runSync = db.runSync as jest.Mock;

const TODAY = '2026-08-17';
/** Well past the window, so a task carrying it is unambiguously washed away. */
const LONG_AGO = new Date(Date.now() - (WASH_AWAY_HOURS + 24) * 3600000).toISOString();
const JUST_NOW = new Date().toISOString();

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'T',
    date: '2026-08-10',
    taskType: 'start-at',
    done: false,
    doneAt: '',
    recurring: 'none',
    recurringDays: [],
    weekInterval: 1,
    monthlyMode: 'day',
    monthDay: 1,
    monthOrdinal: 'first',
    monthWeekday: 0,
    energyEnabled: false,
    energyValue: 1,
    sortOrder: 0,
    hint: '',
    followsTaskId: null,
    hasStartDate: true,
    sharedOut: false,
    assignee: '', assigneeId: '', createdByPersonId: '',
    tagIds: [],
    rotation: 'none',
    rotationPersonIds: [],
    rotationAnchor: '',
    goalId: null,
    cardType: 'standard',
    lastActedAt: JUST_NOW,
    steps: [],
    ...overrides,
  } as Task;
}

/**
 * Every column named by an UPDATE issued since the last `runSync.mockClear()`, minus the
 * live-sync stamp.
 *
 * `updated_at`/`origin_device_id` ride on EVERY write in this store (lib/liveSync's
 * `touchRow`, via `syncRow`) and say nothing about the task — they are which device wrote
 * last, for the LWW tiebreak. Counting them would make "this action writes exactly these
 * fields" untestable; leaving them out is what lets the assertion be about the task's own
 * state. They are asserted separately where they matter (see normalizeRecurringTasks).
 */
const SYNC_STAMP = new Set(['updated_at', 'origin_device_id']);
function writtenColumns(): string[] {
  return runSync.mock.calls
    .map(([sql]) => String(sql))
    .filter((sql) => sql.startsWith('UPDATE'))
    .flatMap((sql) => sql.replace(/^UPDATE \w+ SET /, '').split(' WHERE ')[0].split(', '))
    .map((assignment) => assignment.split(' =')[0].trim())
    .filter((col) => !SYNC_STAMP.has(col));
}

beforeEach(() => {
  runSync.mockClear();
  useTaskStore.setState({ tasks: [], deletedTasks: [] });
});

describe('normalizeRecurringTasks — the app tidying up, not the user acting', () => {
  it('rolls a stale daily task forward and clears the completion it was carrying', () => {
    useTaskStore.setState({
      tasks: [task({ id: 'r1', recurring: 'daily', date: '2026-08-14', done: true, doneAt: '07:15' })],
    });
    useTaskStore.getState().normalizeRecurringTasks(TODAY);

    const next = useTaskStore.getState().tasks[0];
    expect(next.date).toBe(TODAY);
    expect(next.done).toBe(false);
    expect(next.doneAt).toBe('');
  });

  /**
   * The reason this action writes raw instead of going through `update()`. If normalization
   * counted as the user touching the task, the wash-away window would reset on every
   * foreground and the archive could never fill — a silent, permanent no-op.
   */
  it('does NOT stamp lastActedAt', () => {
    useTaskStore.setState({
      tasks: [task({ id: 'r1', recurring: 'daily', date: '2026-08-14', lastActedAt: LONG_AGO })],
    });
    useTaskStore.getState().normalizeRecurringTasks(TODAY);

    expect(useTaskStore.getState().tasks[0].lastActedAt).toBe(LONG_AGO);
    expect(writtenColumns()).not.toContain('last_acted_at');
  });

  /**
   * The 2026-08-10 gotcha, applied to a new bulk write: `task_date` and `done` are both on
   * lib/liveSync's whitelist, and an unstamped bulk write leaves a paired phone's stale copy
   * winning the LWW tiebreak — which is how the monthly shopping reset silently reverted
   * itself every month. A comment claiming this is safe would not be evidence; this is.
   */
  it('DOES stamp the live-sync columns, because task_date and done are synced', () => {
    useTaskStore.setState({ tasks: [task({ id: 'r1', recurring: 'daily', date: '2026-08-14' })] });
    useTaskStore.getState().normalizeRecurringTasks(TODAY);

    const allColumns = runSync.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.startsWith('UPDATE'))
      .join(' ');
    expect(allColumns).toContain('updated_at');
    expect(allColumns).toContain('origin_device_id');
  });

  it('writes nothing at all when every recurring row is already current', () => {
    const before = [
      task({ id: 'r1', recurring: 'daily', date: TODAY }),
      task({ id: 'o1', recurring: 'none', date: '2026-01-01' }),
      task({ id: 'm1', recurring: 'monthly', date: '2026-01-01' }),
    ];
    useTaskStore.setState({ tasks: before });
    useTaskStore.getState().normalizeRecurringTasks(TODAY);

    expect(runSync).not.toHaveBeenCalled();
    // Same array reference: an idempotent run must not re-render every subscriber either.
    expect(useTaskStore.getState().tasks).toBe(before);
  });

  it('leaves one-off and monthly tasks where they are', () => {
    useTaskStore.setState({
      tasks: [
        task({ id: 'o1', recurring: 'none', date: '2026-08-01' }),
        task({ id: 'm1', recurring: 'monthly', date: '2026-08-01' }),
        task({ id: 'r1', recurring: 'daily', date: '2026-08-01' }),
      ],
    });
    useTaskStore.getState().normalizeRecurringTasks(TODAY);

    const byId = Object.fromEntries(useTaskStore.getState().tasks.map((t) => [t.id, t]));
    expect(byId.o1.date).toBe('2026-08-01');
    expect(byId.m1.date).toBe('2026-08-01');
    expect(byId.r1.date).toBe(TODAY);
  });
});

describe('notToday — a date, and nothing else', () => {
  it('moves the task to tomorrow and dates it', () => {
    useTaskStore.setState({ tasks: [task({ id: 't1', hasStartDate: false, date: '2026-08-01' })] });
    useTaskStore.getState().notToday('t1', TODAY);

    const next = useTaskStore.getState().tasks[0];
    expect(next.date).toBe('2026-08-18');
    // An undated Whenever task has to actually BECOME dated, or the date it now carries means
    // nothing (lib/taskRecurrence.ts ignores `date` for an undated row).
    expect(next.hasStartDate).toBe(true);
  });

  /**
   * The anti-guilt promise, asserted at the only level it can be: nothing about the task
   * changes except where it is. No skip count, no "postponed" flag, no done/doneAt churn —
   * and no column exists for one, which is what the SQL assertion pins.
   */
  it('records no failure metadata — three columns, and every other field untouched', () => {
    const before = task({ id: 't1', done: false, doneAt: '', hint: 'be kind', sortOrder: 3 });
    useTaskStore.setState({ tasks: [before] });
    useTaskStore.getState().notToday('t1', TODAY);

    expect(writtenColumns().sort()).toEqual(['has_start_date', 'last_acted_at', 'task_date']);

    const after = useTaskStore.getState().tasks[0];
    const ignore = new Set(['date', 'hasStartDate', 'lastActedAt']);
    for (const key of Object.keys(before) as (keyof Task)[]) {
      if (ignore.has(key)) continue;
      expect({ [key]: after[key] }).toEqual({ [key]: before[key] });
    }
  });

  it('counts as the user acting on the task, so it cannot wash away tomorrow', () => {
    useTaskStore.setState({ tasks: [task({ id: 't1', lastActedAt: LONG_AGO })] });
    useTaskStore.getState().notToday('t1', TODAY);

    expect(useTaskStore.getState().tasks[0].lastActedAt).not.toBe(LONG_AGO);
  });

  it('is a complete no-op for a recurring task, a finished one, and an unknown id', () => {
    const tasks = [
      task({ id: 'r1', recurring: 'daily' }),
      task({ id: 'd1', done: true }),
    ];
    useTaskStore.setState({ tasks });
    useTaskStore.getState().notToday('r1', TODAY);
    useTaskStore.getState().notToday('d1', TODAY);
    useTaskStore.getState().notToday('nope', TODAY);

    expect(runSync).not.toHaveBeenCalled();
    expect(useTaskStore.getState().tasks).toBe(tasks);
  });
});

describe('washedAwayTasks / bringBack — a filter and a stamp', () => {
  it('lists only the tasks past the window, longest untouched first', () => {
    const older = new Date(Date.now() - (WASH_AWAY_HOURS + 100) * 3600000).toISOString();
    useTaskStore.setState({
      tasks: [
        task({ id: 'recent', lastActedAt: JUST_NOW }),
        task({ id: 'stale', lastActedAt: LONG_AGO }),
        task({ id: 'stalest', lastActedAt: older }),
        task({ id: 'repeating', recurring: 'daily', lastActedAt: older }),
      ],
    });

    expect(useTaskStore.getState().washedAwayTasks(TODAY).map((t) => t.id)).toEqual(['stalest', 'stale']);
  });

  it('writes nothing — asking which tasks washed away is a read', () => {
    useTaskStore.setState({ tasks: [task({ id: 'stale', lastActedAt: LONG_AGO })] });
    useTaskStore.getState().washedAwayTasks(TODAY);

    expect(runSync).not.toHaveBeenCalled();
  });

  it('bringBack puts a task back with a fresh stamp and changes nothing else', () => {
    const before = task({ id: 'stale', lastActedAt: LONG_AGO, date: '2026-08-01', title: 'still here' });
    useTaskStore.setState({ tasks: [before] });
    useTaskStore.getState().bringBack('stale');

    expect(writtenColumns()).toEqual(['last_acted_at']);
    const after = useTaskStore.getState().tasks[0];
    expect(after.title).toBe('still here');
    // Its own date is untouched: washing away never moved it, so coming back cannot need to.
    expect(after.date).toBe('2026-08-01');
    expect(useTaskStore.getState().washedAwayTasks(TODAY)).toEqual([]);
  });
});

describe('lastActedAt is stamped by the ordinary user write paths', () => {
  it('add() starts the window at creation, not at whatever created_at says', () => {
    const created = useTaskStore.getState().add({
      title: 'new',
      date: TODAY,
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      sortOrder: 0,
    });
    expect(Date.parse(created.lastActedAt)).toBeGreaterThan(Date.now() - 5000);
  });

  it('an ordinary edit through update() re-stamps it', () => {
    useTaskStore.setState({ tasks: [task({ id: 't1', lastActedAt: LONG_AGO })] });
    useTaskStore.getState().update('t1', { title: 'renamed' });

    expect(useTaskStore.getState().tasks[0].lastActedAt).not.toBe(LONG_AGO);
    expect(writtenColumns()).toContain('last_acted_at');
  });

  it('ticking a task off re-stamps it', () => {
    useTaskStore.setState({ tasks: [task({ id: 't1', lastActedAt: LONG_AGO })] });
    useTaskStore.getState().toggle('t1');

    expect(useTaskStore.getState().tasks[0].lastActedAt).not.toBe(LONG_AGO);
  });
});
