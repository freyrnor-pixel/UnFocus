/**
 * notesStore.test.ts — unit tests for useNotesStore.reorder(), the drag-reorder commit.
 *
 * The notes screen drags rows within ONE section (active or checked) and commits that
 * section's ids on drop. Two things have to hold for the screen's `notes.filter(checked)`
 * split to keep working afterwards, and neither is obvious from the call site:
 *   - the committed ids get 0…n-1 and nothing else is touched;
 *   - the in-memory array comes back in the order load() would have produced — checked LAST,
 *     then sort_order — even though the two sections' number ranges now overlap.
 *
 * Headless: the store imports the SQLite handle at top level, so '@/lib/db' is mocked, and
 * lib/dataAccess's updateRow goes through it. Widget sync is mocked to a no-op — it schedules
 * a native refresh we don't want in a unit test.
 */
import { useNotesStore, Note } from '@/store/useNotesStore';

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

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    header: '',
    body: '',
    checked: false,
    checkedAt: '',
    sortOrder: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Three active notes (0,1,2) above two checked ones (0,1) — one section's worth of each. */
function seed() {
  useNotesStore.setState({
    notes: [
      makeNote({ id: 'a', sortOrder: 0 }),
      makeNote({ id: 'b', sortOrder: 1 }),
      makeNote({ id: 'c', sortOrder: 2 }),
      makeNote({ id: 'x', checked: true, sortOrder: 0 }),
      makeNote({ id: 'y', checked: true, sortOrder: 1 }),
    ],
  });
}

const ids = () => useNotesStore.getState().notes.map((n) => n.id);

describe('useNotesStore.reorder', () => {
  beforeEach(seed);
  afterEach(() => useNotesStore.setState({ notes: [] }));

  it('renumbers the committed ids by array position', () => {
    useNotesStore.getState().reorder(['c', 'a', 'b']);
    const byId = Object.fromEntries(useNotesStore.getState().notes.map((n) => [n.id, n.sortOrder]));
    expect(byId).toMatchObject({ c: 0, a: 1, b: 2 });
  });

  it('puts the reordered section in its new order', () => {
    useNotesStore.getState().reorder(['c', 'a', 'b']);
    expect(ids().slice(0, 3)).toEqual(['c', 'a', 'b']);
  });

  it('leaves the other section alone, and below the active one', () => {
    useNotesStore.getState().reorder(['c', 'a', 'b']);
    // Checked notes keep sort_order 0 and 1 — the same numbers the active section now uses —
    // and still sort last, because `checked` is the first key.
    expect(ids().slice(3)).toEqual(['x', 'y']);
    const y = useNotesStore.getState().notes.find((n) => n.id === 'y');
    expect(y?.sortOrder).toBe(1);
  });

  it('reorders the checked section without disturbing the active one', () => {
    useNotesStore.getState().reorder(['y', 'x']);
    expect(ids()).toEqual(['a', 'b', 'c', 'y', 'x']);
  });

  it('ignores ids that are no longer in the store', () => {
    useNotesStore.getState().reorder(['c', 'gone', 'a', 'b']);
    expect(ids().slice(0, 3)).toEqual(['c', 'a', 'b']);
    // 'gone' took slot 1, so the survivors are 0, 2, 3 — the gap is harmless, the order holds.
    const byId = Object.fromEntries(useNotesStore.getState().notes.map((n) => [n.id, n.sortOrder]));
    expect(byId.c).toBe(0);
    expect(byId.a).toBe(2);
    expect(byId.b).toBe(3);
  });
});
