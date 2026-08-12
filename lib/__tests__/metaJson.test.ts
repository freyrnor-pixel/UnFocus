/**
 * metaJson.test.ts — the shared `app_meta` JSON accessor.
 *
 * lib/viewSnapshot.ts and lib/energyDayState.ts were structurally the same file with a
 * different payload type (the latter's header said so outright) until 2026-08-12. Their
 * storage half lives here now, so the guarantees both of them depend on are asserted once:
 *
 *   1. **Nothing throws.** These reads run inside render passes (lib/useNewSinceSeen.ts,
 *      lib/useEnergyPause.ts). A corrupt blob, a missing row or a DB that is refusing reads
 *      must all degrade to the caller's fallback.
 *   2. **`readAll` scans by prefix, keyed on the remainder.** This is the operation that
 *      hydrates useEnergyStore's in-memory day map on boot, and the one whose SQL changed in
 *      the extraction — a hardcoded `GLOB 'energy:day:*'` became a bound `GLOB ?`. Nothing
 *      covered it before, so it is pinned here.
 *   3. **The fallback type is the caller's choice.** viewSnapshot needs a nullable payload
 *      (a surface may never have been saved); energyDayState needs a total one (a day with
 *      no row is a real state). Both shapes are exercised below.
 */
import db from '@/lib/db';
import { metaJson } from '@/lib/metaJson';

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
const getAllSync = db.getAllSync as jest.Mock;
const runSync = db.runSync as jest.Mock;

type Payload = { n: number };
const DEFAULT: Payload = { n: 0 };

/** Total normalizer, the lib/energyDayState.ts shape. */
const normalizeTotal = (raw: unknown): Payload => {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return { n: typeof obj.n === 'number' ? obj.n : 0 };
};

/** Nullable normalizer, the lib/viewSnapshot.ts shape. */
const normalizeNullable = (raw: unknown): Payload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return typeof obj.n === 'number' ? { n: obj.n } : null;
};

const total = metaJson<Payload>('thing:', normalizeTotal, DEFAULT, 'thing');
const nullable = metaJson<Payload | null>('view:', normalizeNullable, null, 'view');

beforeEach(() => {
  jest.clearAllMocks();
  getAllSync.mockReturnValue([]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('read', () => {
  it('prefixes the key and parses the stored blob', () => {
    getFirstSync.mockReturnValue({ value: '{"n":7}' });
    expect(total.read('a')).toEqual({ n: 7 });
    expect(getFirstSync).toHaveBeenCalledWith('SELECT value FROM app_meta WHERE key = ?', [
      'thing:a',
    ]);
  });

  it.each([
    ['a missing row', undefined],
    ['an empty value', { value: '' }],
    ['unparseable JSON', { value: '{not json' }],
  ])('returns the fallback for %s rather than throwing', (_label, row) => {
    getFirstSync.mockReturnValue(row);
    expect(() => total.read('a')).not.toThrow();
    expect(total.read('a')).toEqual(DEFAULT);
  });

  it('returns the fallback when the DB itself throws', () => {
    getFirstSync.mockImplementation(() => {
      throw new Error('db is gone');
    });
    expect(total.read('a')).toEqual(DEFAULT);
  });

  // The two callers need different answers to "what does absent mean", which is why the
  // fallback is a parameter and not a hardcoded null.
  it('honours a null fallback for a nullable payload', () => {
    getFirstSync.mockReturnValue(undefined);
    expect(nullable.read('home')).toBeNull();
  });
});

describe('write / clear', () => {
  it('stringifies under the prefixed key', () => {
    total.write('a', { n: 3 });
    expect(runSync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
      ['thing:a', '{"n":3}'],
    );
  });

  it('deletes only the prefixed key', () => {
    total.clear('a');
    expect(runSync).toHaveBeenCalledWith('DELETE FROM app_meta WHERE key = ?', ['thing:a']);
  });

  it('swallows a write failure instead of throwing', () => {
    runSync.mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => total.write('a', { n: 1 })).not.toThrow();
    expect(() => total.clear('a')).not.toThrow();
  });
});

describe('readAll', () => {
  // The extraction turned a hardcoded GLOB literal into a bound parameter. If the pattern
  // stopped being passed, the scan would return every app_meta row in the database —
  // including other features' blobs — and normalize each one into this caller's shape.
  it('scans by prefix with the pattern BOUND, not interpolated', () => {
    total.readAll();
    expect(getAllSync).toHaveBeenCalledWith(
      'SELECT key, value FROM app_meta WHERE key GLOB ?',
      ['thing:*'],
    );
  });

  it('keys the result on the remainder after the prefix', () => {
    getAllSync.mockReturnValue([
      { key: 'thing:2026-08-11', value: '{"n":1}' },
      { key: 'thing:2026-08-12', value: '{"n":2}' },
    ]);
    expect(total.readAll()).toEqual({ '2026-08-11': { n: 1 }, '2026-08-12': { n: 2 } });
  });

  it('skips a row whose key is nothing but the prefix', () => {
    getAllSync.mockReturnValue([{ key: 'thing:', value: '{"n":1}' }]);
    expect(total.readAll()).toEqual({});
  });

  it('degrades ONE unreadable row to the fallback without losing the others', () => {
    getAllSync.mockReturnValue([
      { key: 'thing:good', value: '{"n":5}' },
      { key: 'thing:bad', value: '{{{' },
    ]);
    expect(total.readAll()).toEqual({ good: { n: 5 }, bad: DEFAULT });
  });

  it('returns an empty map when the scan itself throws', () => {
    getAllSync.mockImplementation(() => {
      throw new Error('db is gone');
    });
    expect(total.readAll()).toEqual({});
  });
});
