/**
 * notesStore.test.ts — unit tests for useNotesStore.reorder() (the drag-reorder commit) and
 * remove()/restoreLastDeleted()/dismissLastDeleted() (the inline "ghost" undo, 2026-08-01).
 *
 * The notes screen drags rows within ONE section (active or checked) and commits that
 * section's ids on drop. Two things have to hold for the screen's `notes.filter(checked)`
 * split to keep working afterwards, and neither is obvious from the call site:
 *   - the committed ids get 0…n-1 and nothing else is touched;
 *   - the in-memory array comes back in the order load() would have produced — checked LAST,
 *     then sort_order — even though the two sections' number ranges now overlap.
 *
 * The ghost-undo tests assert remove() is a soft-delete (an UPDATE, never a hard DELETE) that
 * stages the removed note in `lastDeleted`, and that restoreLastDeleted()/dismissLastDeleted()
 * are the only two things that can happen to that pending ghost.
 *
 * Headless: the store imports the SQLite handle at top level, so '@/lib/db' is mocked, and
 * lib/dataAccess's updateRow goes through it. Widget sync is mocked to a no-op — it schedules
 * a native refresh we don't want in a unit test.
 */
import { useNotesStore, Note } from '@/store/useNotesStore';
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

describe('useNotesStore remove/restoreLastDeleted/dismissLastDeleted (ghost undo)', () => {
  beforeEach(seed);
  afterEach(() => {
    useNotesStore.setState({ notes: [], lastDeleted: null });
    (db.getAllSync as jest.Mock).mockReset().mockReturnValue([]);
    (db.runSync as jest.Mock).mockClear();
  });

  it('remove() filters the note out, stages it as lastDeleted, and soft-deletes (never a hard DELETE)', () => {
    useNotesStore.getState().remove('a');

    expect(ids()).not.toContain('a');
    expect(useNotesStore.getState().lastDeleted?.id).toBe('a');
    const calls = (db.runSync as jest.Mock).mock.calls;
    expect(calls.some(([sql]) => /UPDATE notes SET deleted_at/.test(sql))).toBe(true);
    expect(calls.some(([sql]) => /DELETE FROM notes/.test(sql))).toBe(false);
  });

  it('a second remove() replaces the pending ghost rather than queuing it', () => {
    useNotesStore.getState().remove('a');
    useNotesStore.getState().remove('b');

    expect(useNotesStore.getState().lastDeleted?.id).toBe('b');
  });

  it('dismissLastDeleted() drops the ghost without restoring anything', () => {
    useNotesStore.getState().remove('a');
    useNotesStore.getState().dismissLastDeleted();

    expect(useNotesStore.getState().lastDeleted).toBeNull();
    expect(ids()).not.toContain('a');
  });

  it('restoreLastDeleted() clears the tombstone, reloads the note back in, and clears lastDeleted', () => {
    (db.getAllSync as jest.Mock).mockImplementation(() => [
      { id: 'a', header: '', body: '', checked: 0, checked_at: '', sort_order: 0, created_at: '2026-08-01T00:00:00.000Z' },
    ]);
    useNotesStore.getState().remove('a');

    useNotesStore.getState().restoreLastDeleted();

    expect(ids()).toEqual(['a']);
    expect(useNotesStore.getState().lastDeleted).toBeNull();
  });

  it('restoreLastDeleted() is a no-op when there is nothing pending', () => {
    useNotesStore.getState().restoreLastDeleted();
    expect(useNotesStore.getState().lastDeleted).toBeNull();
    expect(ids()).toEqual(['a', 'b', 'c', 'x', 'y']);
  });
});
