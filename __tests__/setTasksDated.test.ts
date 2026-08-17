/**
 * setTasksDated.test.ts — "Put the day away" moves tasks; it must never delete one, and it
 * must never touch a recurring series (2026-08-20).
 *
 * `useTaskStore.setTasksDated(ids, dated)` is what the To-do tab's day-reset button calls.
 * That button has **no confirmation dialog**, deliberately — the justification is entirely
 * that the action is reversible and destroys nothing (see the action's own doc, and
 * components/PlanTaskCard.tsx's per-row trash for the precedent). So the properties that make
 * skipping the confirm safe are exactly the ones nothing else would catch:
 *
 *   1. **It is not a delete.** No tombstone, no `deletedTasks` entry, no row leaves `tasks`.
 *      If a later refactor "simplified" this into a bulk `remove()`, every type still checks,
 *      the screen still empties, and the undo still appears to work — the loss would only show
 *      up once `deletedTasks`' 10-row cap silently dropped the 11th task.
 *   2. **It refuses recurring tasks.** A recurring task is ONE row whose `hasStartDate` is the
 *      series' START BOUNDARY, not "is it on today" (lib/taskRecurrence.ts). Clearing it would
 *      re-open every occurrence before the start date — a change that is invisible on today's
 *      screen and only discoverable by scrolling back a month. This is the assertion most
 *      worth having, because the bug it prevents has no symptom at the call site.
 *   3. **It round-trips.** The undo restores exactly the flag it cleared, and `date` is never
 *      written in either direction — a task parked from next Thursday keeps Thursday.
 *
 * Headless: '@/lib/db' is mocked (lib/dataAccess + lib/storeCrud write through it), and the
 * three native-facing effects `update()` fans out to are mocked so the SQL can be inspected.
 */
import { useTaskStore } from '@/store/useTaskStore';
import type { Task } from '@/store/useTaskStore';
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

jest.mock('@/lib/widgets/sync', () => ({ scheduleWidgetSync: jest.fn() }));

const runSync = db.runSync as jest.Mock;

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'T',
    date: '2026-07-15',
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
    assignee: '',
    assigneeId: '',
    createdByPersonId: '',
    tagIds: [],
    rotation: 'none',
    rotationPersonIds: [],
    rotationAnchor: '',
    goalId: null,
    cardType: 'standard',
    steps: [],
    ...overrides,
  } as Task;
}

/** Every SQL statement run since the last reset, as one lower-cased blob. */
const sql = () => runSync.mock.calls.map((c) => String(c[0])).join('\n').toLowerCase();

beforeEach(() => {
  runSync.mockClear();
  useTaskStore.setState({
    tasks: [
      task({ id: 'one', date: '2026-07-16' }),
      task({ id: 'two', date: '2026-07-15' }),
      task({ id: 'daily', recurring: 'daily' }),
    ],
    deletedTasks: [],
  });
});

describe('parking a day in Whenever', () => {
  it('clears hasStartDate on the ids it is given', () => {
    useTaskStore.getState().setTasksDated(['one', 'two'], false);

    const byId = Object.fromEntries(useTaskStore.getState().tasks.map((t) => [t.id, t]));
    expect(byId.one.hasStartDate).toBe(false);
    expect(byId.two.hasStartDate).toBe(false);
  });

  it('deletes nothing — no tombstone, no row leaves the store, no undo-zone entry', () => {
    useTaskStore.getState().setTasksDated(['one', 'two'], false);

    // The three shapes a delete could take, all absent.
    expect(useTaskStore.getState().tasks).toHaveLength(3);
    expect(useTaskStore.getState().deletedTasks).toEqual([]);
    expect(sql()).not.toMatch(/delete from tasks|deleted_at/);
  });

  it('leaves `date` untouched, so putting a task back restores its own day', () => {
    useTaskStore.getState().setTasksDated(['one'], false);
    expect(useTaskStore.getState().tasks.find((t) => t.id === 'one')!.date).toBe('2026-07-16');

    useTaskStore.getState().setTasksDated(['one'], true);
    const back = useTaskStore.getState().tasks.find((t) => t.id === 'one')!;
    expect(back.hasStartDate).toBe(true);
    expect(back.date).toBe('2026-07-16'); // NOT today
  });
});

describe('the guards', () => {
  it('refuses a recurring task — hasStartDate is its start boundary, not a per-day flag', () => {
    useTaskStore.getState().setTasksDated(['daily'], false);
    expect(useTaskStore.getState().tasks.find((t) => t.id === 'daily')!.hasStartDate).toBe(true);
  });

  it('is a complete no-op for an id the store does not hold', () => {
    const before = useTaskStore.getState().tasks;
    useTaskStore.getState().setTasksDated(['ghost'], false);

    // Same array REFERENCE, not merely equal contents: a fresh array re-renders every
    // subscriber for a change that did not happen (see __tests__/storeUpdateGuard.test.ts).
    expect(useTaskStore.getState().tasks).toBe(before);
    expect(runSync).not.toHaveBeenCalled();
  });

  it('skips a task already in the target state rather than rewriting it', () => {
    useTaskStore.setState({ tasks: [task({ id: 'one', hasStartDate: false })] });
    runSync.mockClear();

    useTaskStore.getState().setTasksDated(['one'], false);
    expect(runSync).not.toHaveBeenCalled();
  });

  it('an empty id list writes nothing', () => {
    useTaskStore.getState().setTasksDated([], false);
    expect(runSync).not.toHaveBeenCalled();
  });
});
