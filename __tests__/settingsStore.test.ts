/**
 * settingsStore.test.ts — unit tests for single-field load/update round-trips:
 * hiddenCards + cardOrder (the "Manage cards" sheet's two columns)
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

/**
 * `home_card_order` is INERT as of 2026-09-01 — Home orders and hides its cards through
 * `card_order` + `hidden_cards` like every other screen. The column is still loaded and still
 * written (this repo never drops one), and that round-trip is what is pinned here: a downgrade
 * must find the column as it left it. Nothing RENDERS from it, so there is deliberately no
 * assertion about what any screen does with the value. The old `sanitizeHomeCardOrder` tests
 * went with lib/homeCards.ts.
 */
describe('homeCardOrder (inert, but still persisted)', () => {
  it('still round-trips through the column', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, home_card_order: '["shopping","notes"]' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().homeCardOrder).toEqual(['shopping', 'notes']);

    (db.runSync as jest.Mock).mockClear();
    useSettingsStore.getState().update({ homeCardOrder: ['plans', 'notes'] });
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
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, hidden_cards: '["todoCalendar"]' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual(['todoCalendar']);
  });

  it('sanitizes on READ, so a stale id cannot survive a registry change', () => {
    // A card removed from lib/cardRegistry.ts, or a backup restored from an older build. Dropping
    // it here is what keeps the sheet from drawing a row for something that no longer exists.
    // ⚠️ `todoMonth` is a REAL example of the case this test names: it was a card until
    // 2026-09-01, when it merged into `todoCalendar`. An install that had hidden it has that
    // string in its column right now.
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, hidden_cards: '["todoCalendar","todoMonth"]' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual(['todoCalendar']);
  });

  it('reads a malformed column as nothing hidden rather than blanking a screen', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, hidden_cards: 'not json' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().hiddenCards).toEqual([]);
  });

  it('update() writes the list as a JSON string to hidden_cards', () => {
    (db.runSync as jest.Mock).mockClear();
    useSettingsStore.getState().update({ hiddenCards: ['todoCalendar'] });
    expect(useSettingsStore.getState().hiddenCards).toEqual(['todoCalendar']);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain('hidden_cards');
    expect(params).toContain(JSON.stringify(['todoCalendar']));
  });
});

/**
 * `card_order` (2026-09-01) — the other half of the "Manage cards" sheet.
 *
 * The load path is what matters, for the same reason `hidden_cards`' does and one more: this
 * column decides the ORDER of what is drawn, so a value that half-applies rearranges a screen
 * with no error anywhere. `sanitizeCardOrder` is called on read here rather than at every
 * consumer, the same shape `hidden_cards`/`collapsed_cards`/`home_card_order` use.
 */
describe('cardOrder', () => {
  it('defaults to no preference when the settings row has no value', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().cardOrder).toEqual({});
  });

  it('reads a persisted order back from the JSON column', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({
      id: 1,
      card_order: '{"todo":["todoRecurring","todoToday"]}',
    });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().cardOrder).toEqual({ todo: ['todoRecurring', 'todoToday'] });
  });

  it('sanitizes on READ, so a stale id cannot survive a registry change', () => {
    // ⚠️ `todoMonth` is a REAL example: it was a card until 2026-09-01, when it merged into
    // `todoCalendar`. An install that had reordered To-do has that string in its column now.
    (db.getFirstSync as jest.Mock).mockReturnValue({
      id: 1,
      card_order: '{"todo":["todoMonth","todoToday"],"notAScreen":["todoToday"]}',
    });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().cardOrder).toEqual({ todo: ['todoToday'] });
  });

  it('reads a malformed column as no preference rather than rearranging a screen', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, card_order: 'not json' });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().cardOrder).toEqual({});
  });

  it('update() writes the bag as a JSON string to card_order', () => {
    (db.runSync as jest.Mock).mockClear();
    const bag = { todo: ['todoRecurring' as const, 'todoToday' as const] };
    useSettingsStore.getState().update({ cardOrder: bag });
    expect(useSettingsStore.getState().cardOrder).toEqual(bag);
    const [sql, params] = (db.runSync as jest.Mock).mock.calls.at(-1)!;
    expect(sql).toContain('card_order');
    expect(params).toContain(JSON.stringify(bag));
  });
});
