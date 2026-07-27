/**
 * viewSnapshot.test.ts — the "what was the last view hiding" diff and its guard rails.
 *
 * The product rule under test: a glow marks VISIBILITY, not novelty. A row that has existed
 * for months and was collapsed behind "Now and next" must glow when a fuller layout reveals
 * it; a row that was already on screen must not glow just because the list changed around it.
 * `newlyVisibleIds` / `newlyVisibleFields` are pure, so the rule is asserted directly here.
 *
 * The normalize tests matter because this blob is JSON in a key-value column: an older build,
 * a hand-edited backup, or a half-written row must degrade to "no saved view" (glow nothing)
 * rather than throwing inside a render pass.
 */
import db from '@/lib/db';
import {
  NO_NEW_FIELDS,
  ViewSnapshot,
  clearSnapshot,
  getSnapshot,
  hasNoNewFields,
  newlyVisibleFields,
  newlyVisibleIds,
  normalizeSnapshot,
  setSnapshot,
} from '@/lib/viewSnapshot';

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

const getFirstSync = db.getFirstSync as jest.Mock;
const runSync = db.runSync as jest.Mock;

beforeEach(() => {
  getFirstSync.mockReset();
  runSync.mockReset();
});

const snap = (over: Partial<ViewSnapshot> = {}): ViewSnapshot => ({
  layout: 'nowNext',
  ids: ['a', 'b'],
  fields: { meta: false, price: false, extras: false },
  ...over,
});

describe('newlyVisibleIds', () => {
  it('reports rows the saved view was not showing', () => {
    // "Now and next" showed a and b; the full layout draws all four.
    expect(newlyVisibleIds(['a', 'b', 'c', 'd'], snap())).toEqual(['c', 'd']);
  });

  it('reports nothing when the same rows are on screen', () => {
    expect(newlyVisibleIds(['a', 'b'], snap())).toEqual([]);
  });

  it('does not care how old a row is — only whether it was shown', () => {
    // The rule is visibility, not novelty: 'c' may have existed for months. It glows because
    // the previous view was hiding it, and that is the entire point of the feature.
    expect(newlyVisibleIds(['c'], snap({ ids: ['a'] }))).toEqual(['c']);
  });

  it('reports nothing on a first visit, when there is no saved view', () => {
    // Glowing every row the first time a surface is opened would be noise, not information.
    expect(newlyVisibleIds(['a', 'b', 'c'], null)).toEqual([]);
  });

  it('ignores rows that disappeared — the glow marks arrivals, never departures', () => {
    expect(newlyVisibleIds(['a'], snap({ ids: ['a', 'b', 'c'] }))).toEqual([]);
  });

  it('handles an empty screen', () => {
    expect(newlyVisibleIds([], snap())).toEqual([]);
  });
});

describe('newlyVisibleFields', () => {
  it('reports a field the saved view was not drawing', () => {
    // "Just the basics" → "Normal": quantity and price appear on rows already on screen.
    expect(newlyVisibleFields({ meta: true, price: true, extras: false }, snap())).toEqual({
      meta: true,
      price: true,
      extras: false,
    });
  });

  it('reports nothing when a field is being hidden rather than revealed', () => {
    const before = snap({ fields: { meta: true, price: true, extras: true } });
    expect(newlyVisibleFields({ meta: false, price: false, extras: false }, before)).toEqual(NO_NEW_FIELDS);
  });

  it('reports nothing when field visibility is unchanged', () => {
    const before = snap({ fields: { meta: true, price: false, extras: false } });
    expect(newlyVisibleFields({ meta: true, price: false, extras: false }, before)).toEqual(NO_NEW_FIELDS);
  });

  it('reports nothing without a saved view', () => {
    expect(newlyVisibleFields({ meta: true, price: true, extras: true }, null)).toEqual(NO_NEW_FIELDS);
  });
});

describe('hasNoNewFields', () => {
  it('distinguishes an empty diff from a populated one', () => {
    expect(hasNoNewFields(NO_NEW_FIELDS)).toBe(true);
    expect(hasNoNewFields({ meta: false, price: true, extras: false })).toBe(false);
  });
});

describe('normalizeSnapshot', () => {
  it('accepts a well-formed blob', () => {
    expect(normalizeSnapshot({ layout: 'basic', ids: ['x'], fields: { meta: true, price: false, extras: false } })).toEqual({
      layout: 'basic',
      ids: ['x'],
      fields: { meta: true, price: false, extras: false },
    });
  });

  it('rejects anything without an ids array', () => {
    expect(normalizeSnapshot({ layout: 'basic' })).toBeNull();
    expect(normalizeSnapshot(null)).toBeNull();
    expect(normalizeSnapshot('nope')).toBeNull();
    expect(normalizeSnapshot(['a'])).toBeNull();
  });

  it('drops non-string ids and defaults missing fields to hidden', () => {
    // Defaulting to hidden is the safe direction: a missing flag can at worst cause one
    // extra glow, where defaulting to visible would silently suppress a real reveal.
    expect(normalizeSnapshot({ ids: ['a', 7, null, 'b'] })).toEqual({
      layout: '',
      ids: ['a', 'b'],
      fields: { meta: false, price: false, extras: false },
    });
  });
});

describe('storage', () => {
  it('round-trips through the surface-scoped app_meta key', () => {
    setSnapshot('shopping', snap());
    expect(runSync).toHaveBeenCalledWith('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
      'view:shopping',
      JSON.stringify(snap()),
    ]);
  });

  it('returns null for a surface with no saved view', () => {
    getFirstSync.mockReturnValueOnce(undefined);
    expect(getSnapshot('plans:today')).toBeNull();
  });

  it('returns null rather than throwing on a corrupt blob', () => {
    getFirstSync.mockReturnValueOnce({ value: '{not json' });
    expect(getSnapshot('shopping')).toBeNull();
  });

  it('swallows a write failure instead of throwing into a render pass', () => {
    runSync.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(() => setSnapshot('shopping', snap())).not.toThrow();
  });

  it('clears only the surface it was asked to clear', () => {
    clearSnapshot('plans:week');
    expect(runSync).toHaveBeenCalledWith('DELETE FROM app_meta WHERE key = ?', ['view:plans:week']);
  });
});
