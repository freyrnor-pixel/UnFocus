/**
 * habitStore.test.ts — unit tests for useHabitStore.reorder(), the drag-reorder commit.
 *
 * The Habits tab drags rows in a list that is filtered twice over (by person, and by whether
 * the habit is due today), so what it commits is usually a SUBSET of the habits table. The
 * contract that makes that safe is the whole point of these tests: the moved ids go back into
 * the slots they already occupied, so a habit the user could not see keeps whichever visible
 * habits it sat between — it does not get pushed to the end of the list by a drag it wasn't
 * part of.
 *
 * Headless: the store reaches SQLite and the notification/widget layers at import time, so
 * those are mocked. Only ordering is asserted here.
 */
import { useHabitStore, Habit } from '@/store/useHabitStore';

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
