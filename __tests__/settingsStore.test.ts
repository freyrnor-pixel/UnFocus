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
import { EMPTY_OVERRIDES, EMPTY_PLAYGROUND, MIN_TAP_TARGET_FLOOR } from '@/lib/designLab';

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
  it('defaults to plans/habits/notes/shopping/health when the settings row has no value', () => {
    // Order is deliberate: To-do first, then habits, then notes, shopping and health. Goals
    // joined the default set 2026-07-28 when it got a Home card, then left it again 2026-07-29
    // (too many lists on Home) — see app/goals.tsx's header for its new entry points.
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    // 'habits' left the default for one same-day window on 2026-08-20 (5 tabs → 3, folded into
    // 'plans' as a section) and rejoined it hours later in the "full-screen card expansion"
    // pass, alongside the new 'health' kind (Health left the bottom nav the same pass). A
    // stored order from that brief window is un-folded on read — see sanitizeHomeCardOrder in
    // lib/homeCards.ts.
    expect(useSettingsStore.getState().homeCardOrder).toEqual(['plans', 'habits', 'notes', 'shopping', 'health']);
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
 * Feature flags (2026-07-25 settings reorganization; defaults revised same day). These
 * assert the STORE's load/update round-trip only — parsing a raw row via readBool()/
 * rowValues(), independent of what any migration sets a real settings row to. The "row has
 * no value at all" case below is a simulated bare row (id only), not a fresh install; the
 * true fresh-vs-existing defaults for each flag are asserted against the actual migration
 * SQL in lib/__tests__/db.test.ts instead.
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

/**
 * The design lab's bag (2026-08-07).
 *
 * `setDesignLabDraft` exists because a full playground is a six-figure JSON string and the lab
 * commits on every change: writing the column per keystroke would put a `JSON.stringify` and a
 * SQLite write behind every character typed into a card's label. It updates memory only, and
 * `lib/useDesignLab.ts`'s `useLabDraft` debounces a real `update()` behind it. Both halves of
 * that split are asserted here, because a memory-only write that never gets flushed is a
 * setting silently lost on restart.
 */
describe('the design lab bag', () => {
  it('setDesignLabDraft updates memory and writes NOTHING to the column', () => {
    (db.runSync as jest.Mock).mockClear();
    const bag = { ...EMPTY_OVERRIDES, note: 'the edges are too loud' };
    useSettingsStore.getState().setDesignLabDraft(bag);
    expect(useSettingsStore.getState().designLab).toBe(bag);
    expect((db.runSync as jest.Mock).mock.calls).toHaveLength(0);
  });

  it('update() is what actually reaches design_lab, as JSON', () => {
    (db.runSync as jest.Mock).mockClear();
    const bag = { ...EMPTY_OVERRIDES, shape: { radiusScale: 2 } };
    useSettingsStore.getState().update({ designLab: bag });
    expect(useSettingsStore.getState().designLab).toEqual(bag);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain('design_lab');
    expect(params).toContain(JSON.stringify(bag));
  });

  // The column is device-local and arrives from JSON a backup or a hand edit can mangle, so
  // it goes through the sanitizer on the way in like every other stored bag.
  it('sanitizes on load, so a mangled column cannot reach a render path', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({
      id: 1,
      design_lab: JSON.stringify({ shape: { minTapTarget: 2 }, colors: { light: { accent: 'not-a-hex' } } }),
    });
    useSettingsStore.getState().load();
    const loaded = useSettingsStore.getState().designLab;
    expect(loaded.shape.minTapTarget).toBe(MIN_TAP_TARGET_FLOOR);
    expect(loaded.colors.light.accent).toBeUndefined();
    expect(loaded.playground).toEqual(EMPTY_PLAYGROUND);
  });
});
