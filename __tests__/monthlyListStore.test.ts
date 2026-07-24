/**
 * monthlyListStore.test.ts — unit tests for store/useMonthlyListStore.ts (Shopping —
 * Monthly redesign, 2026-07-22): CRUD for named, independently-budgeted Monthly lists.
 *
 * The store imports the SQLite handle at top level, so '@/lib/db' is mocked to stay
 * headless (no native SQLite) — same pattern as shoppingListStore.test.ts.
 */
import { useMonthlyListStore } from '@/store/useMonthlyListStore';

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

afterEach(() => {
  useMonthlyListStore.setState({ lists: [] });
  jest.clearAllMocks();
});

describe('add', () => {
  it('creates a list with the given name, zero budget, unlocked, and no lastReset yet', () => {
    const id = useMonthlyListStore.getState().add({ name: 'Groceries' });
    const list = useMonthlyListStore.getState().lists.find((l) => l.id === id)!;
    expect(list.name).toBe('Groceries');
    expect(list.budgetNok).toBe(0);
    expect(list.locked).toBe(false);
    expect(list.lastReset).toBe('');
  });

  it('assigns sequential sortOrder by default so new lists append at the end', () => {
    useMonthlyListStore.getState().add({ name: 'A' });
    useMonthlyListStore.getState().add({ name: 'B' });
    const lists = useMonthlyListStore.getState().lists;
    expect(lists[0].sortOrder).toBe(0);
    expect(lists[1].sortOrder).toBe(1);
  });
});

describe('rename / setBudget / toggleLocked', () => {
  it('rename() updates only the name', () => {
    const id = useMonthlyListStore.getState().add({ name: 'Old' });
    useMonthlyListStore.getState().rename(id, 'New');
    expect(useMonthlyListStore.getState().lists.find((l) => l.id === id)!.name).toBe('New');
  });

  it('setBudget() clamps negative input to 0', () => {
    const id = useMonthlyListStore.getState().add({ name: 'A' });
    useMonthlyListStore.getState().setBudget(id, -50);
    expect(useMonthlyListStore.getState().lists.find((l) => l.id === id)!.budgetNok).toBe(0);
  });

  it('toggleLocked() flips locked without touching other fields', () => {
    const id = useMonthlyListStore.getState().add({ name: 'A' });
    useMonthlyListStore.getState().toggleLocked(id);
    expect(useMonthlyListStore.getState().lists.find((l) => l.id === id)!.locked).toBe(true);
    useMonthlyListStore.getState().toggleLocked(id);
    expect(useMonthlyListStore.getState().lists.find((l) => l.id === id)!.locked).toBe(false);
  });
});

describe('remove', () => {
  it('removes only the targeted list, leaving others intact', () => {
    const idA = useMonthlyListStore.getState().add({ name: 'A' });
    const idB = useMonthlyListStore.getState().add({ name: 'B' });
    useMonthlyListStore.getState().remove(idA);
    const lists = useMonthlyListStore.getState().lists;
    expect(lists.find((l) => l.id === idA)).toBeUndefined();
    expect(lists.find((l) => l.id === idB)).toBeDefined();
  });
});

describe('stampAllReset', () => {
  it('sets lastReset on every list at once', () => {
    useMonthlyListStore.getState().add({ name: 'A' });
    useMonthlyListStore.getState().add({ name: 'B' });
    useMonthlyListStore.getState().stampAllReset('2026-07-22');
    expect(useMonthlyListStore.getState().lists.every((l) => l.lastReset === '2026-07-22')).toBe(true);
  });
});
