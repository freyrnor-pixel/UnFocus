/**
 * taskCardTypes.test.ts — store-level tests for the per-item card types (2026-08-01,
 * phase 1): store/useTaskStore.ts's cardType field and the guards a 'note' turns on.
 *
 * The three promises the feature is built on, one describe block each:
 *   1. Switching type is LOSSLESS and REVERSIBLE — stepped → simple → stepped restores
 *      every step, including which ones were done.
 *   2. Stepped progress PERSISTS — it survives a remount (a fresh load() from the rows on
 *      disk), because the visible step is derived from those rows rather than from state.
 *   3. A 'note' has no completion state — it can't be completed by any path, so it never
 *      reaches lifetimeCompletedTasks and never counts as work.
 *
 * The pure half (lib/cardType.ts's rules, plus the energy/growth exclusions) is in
 * lib/__tests__/cardType.test.ts. Only '@/lib/db' is mocked here — the same minimal recipe
 * __tests__/taskStore.test.ts uses, which already proves useTaskStore's other side effects
 * (notifications, calendar sync, live-sync broadcast) are safe no-ops headless.
 */
import { useTaskStore } from '@/store/useTaskStore';
import type { Task, TaskStep } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { currentStepIndex, steppedProgress } from '@/lib/cardType';

/**
 * Rows the fake DB hands back to load(), so a "remount" reads real persisted state rather
 * than whatever happens to be in the store. The `mock` prefix is what lets the hoisted
 * jest.mock factory below reference it (jest's out-of-scope-variable rule).
 */
const mockRows: { tasks: Record<string, unknown>[]; steps: Record<string, unknown>[] } = { tasks: [], steps: [] };

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    // load() issues two queries: the tasks, then all task_steps. Told apart by the SQL.
    getAllSync: jest.fn((sql: string) => (/task_steps/.test(sql) ? mockRows.steps : mockRows.tasks)),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));

function step(overrides: Partial<TaskStep>): TaskStep {
  return { id: 's1', taskId: 't1', title: 'Step', done: false, orderIndex: 0, ...overrides };
}

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
    hasStartDate: false,
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

beforeEach(() => {
  mockRows.tasks = [];
  mockRows.steps = [];
  useTaskStore.setState({ tasks: [], deletedTasks: [], loaded: false });
  useSettingsStore.setState({ lifetimeCompletedTasks: 0 } as never);
});

// ── 1. Switching type is lossless and reversible ────────────────────────────────────

describe('switching card type', () => {
  const stepped = () =>
    task({
      cardType: 'stepped',
      steps: [
        step({ id: 'a', title: 'One', done: true, orderIndex: 0 }),
        step({ id: 'b', title: 'Two', done: true, orderIndex: 1 }),
        step({ id: 'c', title: 'Three', done: false, orderIndex: 2 }),
      ],
    });

  it('stepped → simple HIDES steps without deleting them', () => {
    useTaskStore.setState({ tasks: [stepped()] });
    useTaskStore.getState().update('t1', { cardType: 'simple' });

    const after = useTaskStore.getState().tasks[0];
    expect(after.cardType).toBe('simple');
    expect(after.steps).toHaveLength(3);
    expect(after.steps.map((s) => s.done)).toEqual([true, true, false]);
  });

  it('round-trips back to stepped with every step and done flag intact', () => {
    useTaskStore.setState({ tasks: [stepped()] });
    const before = useTaskStore.getState().tasks[0].steps;

    // The full loop, through all four types, in both directions.
    for (const type of ['simple', 'note', 'standard', 'stepped'] as const) {
      useTaskStore.getState().update('t1', { cardType: type });
    }

    const after = useTaskStore.getState().tasks[0];
    expect(after.cardType).toBe('stepped');
    expect(after.steps).toEqual(before);
    // And so the card resumes on exactly the step it was showing.
    expect(currentStepIndex(after.steps)).toBe(2);
    expect(steppedProgress(after.steps)).toEqual({ done: 2, total: 3 });
  });

  it('keeps the other fields a type hides — they are presentation, not deletion', () => {
    useTaskStore.setState({
      tasks: [task({ cardType: 'standard', time: '09:00', energyEnabled: true, energyValue: -3 })],
    });
    useTaskStore.getState().update('t1', { cardType: 'simple' });

    const after = useTaskStore.getState().tasks[0];
    expect(after.time).toBe('09:00');
    expect(after.energyEnabled).toBe(true);
    expect(after.energyValue).toBe(-3);
  });

  it("keeps a done task's done flag when it becomes a note, so reverting restores it", () => {
    useTaskStore.setState({ tasks: [task({ done: true })] });
    useTaskStore.getState().update('t1', { cardType: 'note' });
    expect(useTaskStore.getState().tasks[0].done).toBe(true);

    useTaskStore.getState().update('t1', { cardType: 'standard' });
    expect(useTaskStore.getState().tasks[0].done).toBe(true);
  });
});

// ── 2. Stepped progress persists ────────────────────────────────────────────────────

describe('stepped progress across a remount', () => {
  it('resumes on the same step after a fresh load() from the persisted rows', () => {
    // What the DB holds after two of three steps were ticked in an earlier session.
    mockRows.tasks = [{ id: 't1', title: 'T', task_date: '2026-07-15', card_type: 'stepped', done: 0 }];
    mockRows.steps = [
      { id: 'a', task_id: 't1', title: 'One', done: 1, order_index: 0 },
      { id: 'b', task_id: 't1', title: 'Two', done: 1, order_index: 1 },
      { id: 'c', task_id: 't1', title: 'Three', done: 0, order_index: 2 },
    ];

    useTaskStore.getState().load();

    const loaded = useTaskStore.getState().tasks[0];
    expect(loaded.cardType).toBe('stepped');
    expect(steppedProgress(loaded.steps)).toEqual({ done: 2, total: 3 });
    // The card comes back showing step three — nothing stored a pointer to it.
    expect(currentStepIndex(loaded.steps)).toBe(2);
    expect(loaded.steps[currentStepIndex(loaded.steps)].title).toBe('Three');
  });

  it('reads a row written before the column existed as an ordinary standard card', () => {
    mockRows.tasks = [{ id: 't1', title: 'T', task_date: '2026-07-15', done: 0 }];
    useTaskStore.getState().load();
    expect(useTaskStore.getState().tasks[0].cardType).toBe('standard');
  });
});

// ── 3. A note has no completion state ───────────────────────────────────────────────

describe('note cards and completion', () => {
  it('cannot be completed by toggle()', () => {
    useTaskStore.setState({ tasks: [task({ cardType: 'note' })] });
    useTaskStore.getState().toggle('t1');

    expect(useTaskStore.getState().tasks[0].done).toBe(false);
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('cannot be completed by completeDirect() either', () => {
    useTaskStore.setState({ tasks: [task({ cardType: 'note' })] });
    useTaskStore.getState().completeDirect('t1');

    expect(useTaskStore.getState().tasks[0].done).toBe(false);
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('is not auto-completed by the steps cascade when it carries leftover steps', () => {
    // A stepped card switched to a note keeps its steps; ticking the last one must not
    // complete it through update(), which toggle()'s own guard never sees.
    useTaskStore.setState({
      tasks: [
        task({
          cardType: 'note',
          steps: [step({ id: 'a', done: true, orderIndex: 0 }), step({ id: 'b', done: false, orderIndex: 1 })],
        }),
      ],
    });
    useTaskStore.getState().toggleStep('b');

    expect(useTaskStore.getState().tasks[0].done).toBe(false);
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('leaves an ordinary task completing exactly as before', () => {
    useTaskStore.setState({ tasks: [task({ cardType: 'standard' })] });
    useTaskStore.getState().toggle('t1');

    expect(useTaskStore.getState().tasks[0].done).toBe(true);
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(1);
  });

  it('defaults a newly added task to standard — creation never asks for a type', () => {
    const created = useTaskStore.getState().add({
      title: 'New', date: '2026-07-15', taskType: 'start-at', done: false,
      recurring: 'none', recurringDays: [], sortOrder: 0,
    });
    expect(created.cardType).toBe('standard');
  });
});
