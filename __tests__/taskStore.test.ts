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
import { useTaskStore } from '@/store/useTaskStore';
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
    assignee: '',
    steps: [],
    ...overrides,
  } as Task;
}

beforeEach(() => {
  useSettingsStore.setState({ lifetimeCompletedTasks: 0 });
  useTaskStore.setState({ tasks: [task({ id: 't1', done: false })] });
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
