/**
 * settingsStore.test.ts — unit tests for single-field load/update round-trips:
 * homeCardOrder (Home preview card management, components/HomeCardManager.tsx)
 * and lifetimeCompletedTasks (the all-time completed-task counter, 2026-07-20 —
 * see store/useTaskStore.ts's "All-time completed-task counter" edit note).
 *
 * Mocks '@/lib/db' so load() reads a fake row and update() writes are asserted via
 * the mocked runSync call, same headless idiom as shoppingStore.test.ts.
 */
import db from '@/lib/db';
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

describe('homeCardOrder', () => {
  it('defaults to plans/notes/shopping (Tasks first) when the settings row has no value', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().homeCardOrder).toEqual(['plans', 'notes', 'shopping']);
  });

  it('reads a persisted order back from the JSON column', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, home_card_order: '["shopping","notes"]' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().homeCardOrder).toEqual(['shopping', 'notes']);
  });

  it('update() writes the new order as a JSON string to home_card_order', () => {
    (db.runSync as jest.Mock).mockClear();
    useSettingsStore.getState().update({ homeCardOrder: ['plans', 'notes'] });
    expect(useSettingsStore.getState().homeCardOrder).toEqual(['plans', 'notes']);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain('home_card_order');
    expect(params).toContain(JSON.stringify(['plans', 'notes']));
  });
});

describe('lifetimeCompletedTasks (2026-07-20 long-run health pass)', () => {
  it('defaults to 0 when the settings row has no value', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(0);
  });

  it('reads a persisted count back from lifetime_completed_tasks', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, lifetime_completed_tasks: 42 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(42);
  });

  it('update() writes the new count to lifetime_completed_tasks', () => {
    (db.runSync as jest.Mock).mockClear();
    useSettingsStore.getState().update({ lifetimeCompletedTasks: 7 });
    expect(useSettingsStore.getState().lifetimeCompletedTasks).toBe(7);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain('lifetime_completed_tasks');
    expect(params).toContain(7);
  });
});

/**
 * Feature opt-ins (2026-07-25 settings reorganization). These gate additive surfaces
 * (goals, sharing, scan/budget, food/catalogue, automations) and must default to OFF so a
 * fresh install starts on the basics — the on-for-existing-users half of that contract is a
 * `WHERE setup_complete = 1` back-fill migration in lib/db.ts, not store logic.
 */
describe('feature opt-ins', () => {
  const KEYS = [
    ['featureGoals', 'feature_goals'],
    ['featureSharing', 'feature_sharing'],
    ['featureScan', 'feature_scan'],
    ['featureFood', 'feature_food'],
    ['featureAutomations', 'feature_automations'],
  ] as const;

  it.each(KEYS)('%s defaults to false when the settings row has no value', (field) => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState()[field]).toBe(false);
  });

  it.each(KEYS)('%s reads back as true from a 1 in %s', (field, column) => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, [column]: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState()[field]).toBe(true);
  });

  it.each(KEYS)('update() writes %s to %s as 0/1', (field, column) => {
    (db.runSync as jest.Mock).mockClear();
    useSettingsStore.getState().update({ [field]: true });
    expect(useSettingsStore.getState()[field]).toBe(true);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain(column);
    expect(params).toContain(1);
  });
});
