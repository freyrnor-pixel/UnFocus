/**
 * taskStore.test.ts — unit tests for store/useTaskStore.ts's all-time
 * completed-task counter (settings.lifetimeCompletedTasks, 2026-07-20).
 *
 * completedCount() used to be a live `tasks.filter(t => t.done).length` scan;
 * it was replaced by this persisted counter because pruneOldData() (lib/db.ts)
 * now actually prunes old completed dated tasks, which would otherwise silently
 * shrink a live scan. This asserts the counter tracks toggle()/completeDirect()/
 * remove()/clearAll() the same way the old live scan would have. Only '@/lib/db'
 * is mocked (same minimal recipe as __tests__/taskOccursOn.test.ts, which already
 * proves the rest of useTaskStore's side effects — notifications, calendar sync,
 * live-sync broadcast — are safe no-ops in the headless test env).
 */
import { useTaskStore, RECENTLY_DELETED_LIMIT } from '@/store/useTaskStore';
import type { Task } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';

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

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'T',
    date: '2026-07-15',
    taskType: 'start-at',
    done: false,
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
    steps: [],
    ...overrides,
  } as Task;
}

beforeEach(() => {
  useSettingsStore.setState({ lifetimeCompletedTasks: 0 });
  useTaskStore.setState({ tasks: [task({ id: 't1', done: false })], deletedTasks: [] });
});

describe('lifetimeCompletedTasks', () => {
  it('increments on toggle() to done, decrements on toggle() back to undone', () => {
    useTaskStore.getState().toggle('t1');
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(1);

    useTaskStore.getState().toggle('t1');
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('is clamped at 0, never negative', () => {
    // Task starts done=false; toggling once takes it to done=true (+1), so force
    // an already-done task and toggle it off, then try to go further negative
    // via a stray decrement path (remove of a non-done task must NOT decrement).
    useTaskStore.setState({ tasks: [task({ id: 't1', done: true })] });
    useSettingsStore.setState({ lifetimeCompletedTasks: 0 });
    useTaskStore.getState().toggle('t1'); // done → undone
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('completeDirect() increments once and is a no-op on an already-done task', () => {
    useTaskStore.getState().completeDirect('t1');
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(1);

    useTaskStore.getState().completeDirect('t1'); // already done — no-op
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(1);
  });

  it('remove() decrements when the removed task was done, not when it was undone', () => {
    useTaskStore.setState({
      tasks: [task({ id: 'done-task', done: true }), task({ id: 'undone-task', done: false })],
    });
    useSettingsStore.setState({ lifetimeCompletedTasks: 1 });

    useTaskStore.getState().remove('undone-task');
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(1);

    useTaskStore.getState().remove('done-task');
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('clearAll() resets the counter to 0', () => {
    useSettingsStore.setState({ lifetimeCompletedTasks: 9 });
    useTaskStore.getState().clearAll();
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });
});

// Undoable delete (2026-07-27) — the day-view's "Recently deleted" drawer is only as good as
// the list feeding it, so assert what the UI actually depends on: remove() offers the task
// back, the offer is capped and de-duplicated, and clearAll() (a real hard DELETE of every
// row, tombstones included) leaves nothing claiming to be restorable.
describe('deletedTasks (undo buffer)', () => {
  it('remove() puts the deleted task at the front of deletedTasks', () => {
    useTaskStore.setState({
      tasks: [task({ id: 'a', title: 'A' }), task({ id: 'b', title: 'B' })],
      deletedTasks: [],
    });

    useTaskStore.getState().remove('a');
    useTaskStore.getState().remove('b');

    expect(useTaskStore.getState().deletedTasks.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('caps the buffer at RECENTLY_DELETED_LIMIT, dropping the oldest', () => {
    const ids = Array.from({ length: RECENTLY_DELETED_LIMIT + 3 }, (_, i) => `t${i}`);
    useTaskStore.setState({ tasks: ids.map((id) => task({ id })), deletedTasks: [] });

    ids.forEach((id) => useTaskStore.getState().remove(id));

    const buffered = useTaskStore.getState().deletedTasks;
    expect(buffered).toHaveLength(RECENTLY_DELETED_LIMIT);
    // Newest first, and the three oldest deletes have fallen off the end.
    expect(buffered[0].id).toBe(ids[ids.length - 1]);
    expect(buffered.map((t) => t.id)).not.toContain('t0');
  });

  it('never lists the same task twice, even if it is deleted again after a restore', () => {
    useTaskStore.setState({ tasks: [task({ id: 'a' })], deletedTasks: [task({ id: 'a' })] });

    useTaskStore.getState().remove('a');

    expect(useTaskStore.getState().deletedTasks.filter((t) => t.id === 'a')).toHaveLength(1);
  });

  it('clearAll() empties the buffer — those rows are hard-deleted, not restorable', () => {
    useTaskStore.setState({ tasks: [], deletedTasks: [task({ id: 'a' })] });
    useTaskStore.getState().clearAll();
    expect(useTaskStore.getState().deletedTasks).toEqual([]);
  });
});
