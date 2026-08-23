/**
 * relatedRowSync.test.ts — deleting a row must ANNOUNCE the OTHER rows it rewrites
 * (2026-08-23).
 *
 * Three deletes in this app clear a column on rows they do not own, with raw SQL rather than
 * the owning store's `update()`:
 *   - `useTagStore.remove()`    → `tasks.tag_ids`        (drops the tag from every task)
 *   - `useTaskStore.remove()`   → `tasks.follows_task_id` (whoever followed it loses the link)
 *   - `usePeopleStore.remove()` → `tasks.assignee_id`     (their tasks return to the household)
 *
 * All three columns are in lib/liveSync's `tasks` whitelist, and none of the three UPDATEs
 * touches `updated_at`. That is the 2026-08-10 shopping-reset bug (__tests__/shoppingResetSync
 * .test.ts) in three more places, and the tag one was the sharpest: it DID broadcast the
 * rewritten rows, just without stamping them — so the delta shipped under the row's old
 * timestamp and `incomingWins` rejected it outright (equal `updated_at`, equal
 * `origin_device_id` → the peer keeps its copy). The deleted tag stayed on the other phone,
 * and the peer's next edit to any field on that task carried it home in the full-row snapshot.
 *
 * `useTaskStore.setFollower()` had done this correctly since it was written, which is what
 * makes `remove()`'s version a slip rather than a design: one function nulls that column and
 * announces it, the other nulled it and told nobody.
 *
 * The assertions are the stamp AND the broadcast, because either alone is silent: an
 * unstamped broadcast loses LWW, and a stamp with no broadcast waits for the next sync.
 */
import { useTagStore } from '@/store/useTagStore';
import { useTaskStore, type Task } from '@/store/useTaskStore';
import { usePeopleStore, type Person } from '@/store/usePeopleStore';
import { incomingWins } from '@/lib/liveSync';

const mockTouchRow = jest.fn();
const mockSoftDelete = jest.fn();
const mockBroadcastRow = jest.fn();
/** Rows the tag store's "which tasks mention this tag" SELECT should return. */
const mockTaggedRows: { rows: { id: string; tag_ids: string }[] } = { rows: [] };

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn((sql: string) => (/FROM tasks/.test(sql) ? mockTaggedRows.rows : [])),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));
jest.mock('@/lib/liveSync', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/liveSync'),
  touchRow: (...a: unknown[]) => mockTouchRow(...a),
  softDelete: (...a: unknown[]) => mockSoftDelete(...a),
}));
jest.mock('@/lib/syncService', () => ({
  __esModule: true,
  broadcastRow: (...a: unknown[]) => mockBroadcastRow(...a),
  startSync: jest.fn(),
  stopSync: jest.fn(),
  isSyncAvailable: jest.fn(() => false),
}));

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1', title: 'T', date: '2026-08-23', taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day', monthDay: 1,
    monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false, energyValue: 1, sortOrder: 0,
    hint: '', followsTaskId: null, hasStartDate: true, sharedOut: false,
    assignee: '', assigneeId: '', createdByPersonId: '', tagIds: [], steps: [],
    ...overrides,
  } as Task;
}

/** Ids stamped / broadcast for the `tasks` table since the last reset. */
const announced = () => ({
  stamped: mockTouchRow.mock.calls.filter((c) => c[0] === 'tasks').map((c) => c[1]).sort(),
  broadcast: mockBroadcastRow.mock.calls.filter((c) => c[0] === 'tasks').map((c) => c[1]).sort(),
});

beforeEach(() => {
  mockTouchRow.mockClear();
  mockSoftDelete.mockClear();
  mockBroadcastRow.mockClear();
  mockTaggedRows.rows = [];
  useTaskStore.setState({ tasks: [], deletedTasks: [] });
  usePeopleStore.setState({ people: [] });
  useTagStore.setState({ tags: [] });
});

describe('useTagStore.remove announces the tasks it rewrites', () => {
  it('stamps AND broadcasts every task the tag was on', () => {
    mockTaggedRows.rows = [{ id: 'a', tag_ids: 'g1,g2' }, { id: 'b', tag_ids: 'g1' }];
    useTagStore.setState({ tags: [{ id: 'g1', name: 'Home', createdAt: '', sortOrder: 0 }] });
    useTaskStore.setState({
      tasks: [task({ id: 'a', tagIds: ['g1', 'g2'] }), task({ id: 'b', tagIds: ['g1'] })],
      deletedTasks: [],
    });

    useTagStore.getState().remove('g1');

    expect(announced()).toEqual({ stamped: ['a', 'b'], broadcast: ['a', 'b'] });
  });
});

describe('useTaskStore.remove announces the follower it orphans', () => {
  it('stamps AND broadcasts the task that followed the deleted one', () => {
    useTaskStore.setState({
      tasks: [task({ id: 'pred' }), task({ id: 'follower', followsTaskId: 'pred' }), task({ id: 'other' })],
      deletedTasks: [],
    });

    useTaskStore.getState().remove('pred');

    const { stamped, broadcast } = announced();
    expect(stamped).toEqual(['follower']);
    // The deleted row itself is broadcast too (its tombstone) — the follower is the addition.
    expect(broadcast).toEqual(['follower', 'pred']);
  });

  it('announces nothing extra when the deleted task had no follower', () => {
    useTaskStore.setState({ tasks: [task({ id: 'lonely' })], deletedTasks: [] });

    useTaskStore.getState().remove('lonely');

    expect(announced().stamped).toEqual([]);
  });
});

describe('usePeopleStore.remove announces the tasks it hands back', () => {
  it('stamps AND broadcasts every task that was assigned to them', () => {
    usePeopleStore.setState({
      people: [{ id: 'p1', name: 'Sam', isSelf: false } as Person],
    });
    useTaskStore.setState({
      tasks: [task({ id: 'a', assigneeId: 'p1' }), task({ id: 'b', assigneeId: 'p1' }), task({ id: 'c' })],
      deletedTasks: [],
    });

    usePeopleStore.getState().remove('p1');

    expect(announced()).toEqual({ stamped: ['a', 'b'], broadcast: ['a', 'b'] });
  });
});

describe('why the stamp is the half that matters', () => {
  it('an unstamped broadcast loses LWW against the peer’s identical copy', () => {
    const local = { updatedAt: '2026-08-23T10:00:00.000Z', originDeviceId: 'A' };
    // What a bare broadcastRow() would have shipped: the row as it stands, stamp untouched.
    expect(incomingWins(local, { updatedAt: local.updatedAt, originDeviceId: 'A' })).toBe(false);
    // What syncRows() ships: a fresh stamp, which wins.
    expect(incomingWins(local, { updatedAt: '2026-08-23T10:00:01.000Z', originDeviceId: 'A' })).toBe(true);
  });
});
