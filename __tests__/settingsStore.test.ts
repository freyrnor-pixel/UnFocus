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
  it('defaults to plans/notes/shopping when the settings row has no value', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    // ⚠️ **The maintainer's sentence, in order** (2026-08-22): *"'Home' had easy access to todays
    // tasks, Notes, and shopping."* Home is the middle tab of five again, and the three cards it
    // carries are the three that sentence names. 'habits', 'health' and 'medicine' left in the
    // same pass — Habits and Health are tabs, Medicine is a card on the Health tab, so a preview
    // here would be a second copy of a surface that already has a home. That is the exact
    // argument the 2026-08-19 pass used to remove 'plans' and 'shopping'; what changed is which
    // surfaces it applies to, not the rule.
    //
    // Note this is the RAW column value — the Home screen reads it through
    // sanitizeHomeCardOrder (lib/homeCards.ts), which is what handles a stored order written by
    // an older build, and which is where the append that reaches existing installs lives.
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

/**
 * `hidden_cards` (2026-08-30) — the column behind components/ManageCardsSheet.tsx.
 *
 * The load path is the half worth pinning: a hidden card is not DRAWN, so a value that
 * half-applies removes a surface with no error anywhere. `sanitizeHiddenCards` is what stands
 * between a malformed column and a blank screen, and it is called on read here rather than at
 * every consumer — the same shape `collapsed_cards` and `home_card_order` use.
 */
describe('hiddenCards', () => {
  it('defaults to nothing hidden when the settings row has no value', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual([]);
  });

  it('reads a persisted list back from the JSON column', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, hidden_cards: '["todoMonth"]' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual(['todoMonth']);
  });

  it('sanitizes on READ, so a stale id cannot survive a registry change', () => {
    // A card removed from lib/cardRegistry.ts, or a backup restored from an older build. Dropping
    // it here is what keeps the sheet from drawing a row for something that no longer exists.
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, hidden_cards: '["todoMonth","goneCard"]' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual(['todoMonth']);
  });

  it('reads a malformed column as nothing hidden rather than blanking a screen', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, hidden_cards: 'not json' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual([]);
  });

  it('update() writes the list as a JSON string to hidden_cards', () => {
    (db.runSync as jest.Mock).mockClear();
    useSettingsStore.getState().update({ hiddenCards: ['todoMonth'] });
    expect(useSettingsStore.getState().hiddenCards).toEqual(['todoMonth']);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain('hidden_cards');
    expect(params).toContain(JSON.stringify(['todoMonth']));
  });
});
