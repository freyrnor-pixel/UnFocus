/**
 * habitStore.test.ts — unit tests for useHabitStore.reorder() (the drag-reorder commit) and
 * remove()/restoreLastDeleted()/dismissLastDeleted() (the inline "ghost" undo, 2026-08-01).
 *
 * The Habits tab drags rows in a list that is filtered twice over (by person, and by whether
 * the habit is due today), so what it commits is usually a SUBSET of the habits table. The
 * contract that makes that safe is the whole point of the reorder tests: the moved ids go back
 * into the slots they already occupied, so a habit the user could not see keeps whichever
 * visible habits it sat between — it does not get pushed to the end of the list by a drag it
 * wasn't part of.
 *
 * The ghost-undo tests assert remove() is a soft-delete (an UPDATE, never a habit_logs DELETE)
 * that stages the removed habit in `lastDeleted`, and that restoreLastDeleted()/
 * dismissLastDeleted() are the only two things that can happen to that pending ghost.
 *
 * Headless: the store reaches SQLite and the notification/widget layers at import time, so
 * those are mocked.
 */
import { useHabitStore, Habit } from '@/store/useHabitStore';
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
jest.mock('@/lib/habitNotifications', () => ({
  syncHabitReminder: jest.fn(),
  cancelHabitReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/widgets/sync', () => ({ scheduleWidgetSync: jest.fn() }));

function habit(id: string, routineOrder: number, createdAt = '2026-01-01T00:00:00.000Z'): Habit {
  return { id, title: id, routineOrder, createdAt, active: true } as Habit;
}

const order = () => useHabitStore.getState().habits.map((h) => h.id);

afterEach(() => useHabitStore.setState({ habits: [], logs: [] }));

describe('useHabitStore.reorder', () => {
  it('applies a new order for a fully visible list', () => {
    useHabitStore.setState({ habits: [habit('a', 0), habit('b', 1), habit('c', 2)] });
    useHabitStore.getState().reorder(['c', 'a', 'b']);
    expect(order()).toEqual(['c', 'a', 'b']);
  });

  it('works on a fresh install where every routine_order is still 0', () => {
    // Nothing has ever been reordered, so the order is created_at's. A neighbour swap of two
    // equal numbers would be a no-op; renumbering all of them is what makes this land.
    useHabitStore.setState({
      habits: [
        habit('a', 0, '2026-01-01T00:00:00.000Z'),
        habit('b', 0, '2026-01-02T00:00:00.000Z'),
        habit('c', 0, '2026-01-03T00:00:00.000Z'),
      ],
    });
    useHabitStore.getState().reorder(['b', 'a', 'c']);
    expect(order()).toEqual(['b', 'a', 'c']);
  });

  it('keeps a hidden habit between the same two visible ones', () => {
    // 'hidden' isn't due today, so the screen never passes it — but it sits between a and b,
    // and it has to stay there when a and b swap.
    useHabitStore.setState({
      habits: [habit('a', 0), habit('hidden', 1), habit('b', 2), habit('c', 3)],
    });
    useHabitStore.getState().reorder(['b', 'a', 'c']);
    expect(order()).toEqual(['b', 'hidden', 'a', 'c']);
  });

  it('renumbers every habit so the stored order matches what was applied', () => {
    useHabitStore.setState({ habits: [habit('a', 5), habit('b', 9), habit('c', 40)] });
    useHabitStore.getState().reorder(['c', 'b', 'a']);
    expect(useHabitStore.getState().habits.map((h) => h.routineOrder)).toEqual([0, 1, 2]);
  });

  it('ignores ids that are no longer in the store', () => {
    useHabitStore.setState({ habits: [habit('a', 0), habit('b', 1)] });
    useHabitStore.getState().reorder(['b', 'gone', 'a']);
    expect(order()).toEqual(['b', 'a']);
  });

  it('does nothing when fewer than two known ids are committed', () => {
    useHabitStore.setState({ habits: [habit('a', 3), habit('b', 7)] });
    useHabitStore.getState().reorder(['a']);
    expect(useHabitStore.getState().habits.map((h) => h.routineOrder)).toEqual([3, 7]);
  });
});

describe('useHabitStore remove/restoreLastDeleted/dismissLastDeleted (ghost undo)', () => {
  afterEach(() => {
    (db.getAllSync as jest.Mock).mockReset().mockReturnValue([]);
    (db.runSync as jest.Mock).mockClear();
  });

  it('remove() filters the habit out, stages it as lastDeleted, and soft-deletes (never touches habit_logs)', () => {
    useHabitStore.setState({ habits: [habit('a', 0), habit('b', 1)], lastDeleted: null });

    useHabitStore.getState().remove('a');

    expect(order()).toEqual(['b']);
    expect(useHabitStore.getState().lastDeleted?.id).toBe('a');
    const calls = (db.runSync as jest.Mock).mock.calls;
    expect(calls.some(([sql]) => /UPDATE habits SET deleted_at/.test(sql))).toBe(true);
    expect(calls.some(([sql]) => /DELETE FROM habits/.test(sql))).toBe(false);
    expect(calls.some(([sql]) => /habit_logs/.test(sql))).toBe(false);
  });

  it('a second remove() replaces the pending ghost rather than queuing it', () => {
    useHabitStore.setState({ habits: [habit('a', 0), habit('b', 1)], lastDeleted: null });

    useHabitStore.getState().remove('a');
    useHabitStore.getState().remove('b');

    expect(useHabitStore.getState().lastDeleted?.id).toBe('b');
  });

  it('dismissLastDeleted() drops the ghost without restoring anything', () => {
    useHabitStore.setState({ habits: [], lastDeleted: habit('a', 0) });

    useHabitStore.getState().dismissLastDeleted();

    expect(useHabitStore.getState().lastDeleted).toBeNull();
    expect(useHabitStore.getState().habits).toEqual([]);
  });

  it('restoreLastDeleted() clears the tombstone, reloads the habit back into habits, and clears lastDeleted', () => {
    (db.getAllSync as jest.Mock).mockImplementation((sql: string) =>
      /habit_logs/.test(sql) ? [] : [{ id: 'a', title: 'A', created_at: '2026-01-01T00:00:00.000Z', routine_order: 0, active: 1 }]
    );
    useHabitStore.setState({ habits: [], lastDeleted: habit('a', 0) });

    useHabitStore.getState().restoreLastDeleted();

    expect(order()).toEqual(['a']);
    expect(useHabitStore.getState().lastDeleted).toBeNull();
  });

  it('restoreLastDeleted() is a no-op when there is nothing pending', () => {
    useHabitStore.setState({ habits: [habit('a', 0)], lastDeleted: null });

    useHabitStore.getState().restoreLastDeleted();

    expect(order()).toEqual(['a']);
    expect(useHabitStore.getState().lastDeleted).toBeNull();
  });
});
