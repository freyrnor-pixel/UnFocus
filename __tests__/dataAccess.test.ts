/**
 * dataAccess.test.ts — unit tests for lib/dataAccess.ts.
 *
 * This is the shared row-mapping / SQL-building layer used by 13 of 14 stores,
 * so a regression here corrupts writes app-wide. The module imports the SQLite
 * handle at top level, so we mock '@/lib/db' to keep the tests headless (no
 * native SQLite) and to assert the execute-wrappers call through correctly.
 */
// Mock the SQLite handle. Defined inside the factory (not a captured const) so
// it survives jest.mock hoisting; we grab a typed handle via the import below.
import db from '@/lib/db';

import {
  buildSelect,
  buildInsert,
  buildUpdate,
  rowValues,
  readStr,
  readInt,
  readReal,
  readBool,
  readJson,
  readEnum,
  isConstraintError,
  loadAll,
  loadFirst,
  insertRow,
  updateRow,
  tx,
  type FieldMap,
} from '@/lib/dataAccess';

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));
const mockDb = db as unknown as {
  getAllSync: jest.Mock;
  getFirstSync: jest.Mock;
  runSync: jest.Mock;
  withTransactionSync: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

describe('pure SQL builders', () => {
  it('buildSelect with and without clauses', () => {
    expect(buildSelect('t')).toEqual({ sql: 'SELECT * FROM t', params: [] });
    expect(buildSelect('t', { where: 'a = ?', orderBy: 'b DESC', params: [1] })).toEqual({
      sql: 'SELECT * FROM t WHERE a = ? ORDER BY b DESC',
      params: [1],
    });
  });
  it('buildInsert produces placeholders in column order', () => {
    expect(buildInsert('t', { a: 1, b: 'x' })).toEqual({
      sql: 'INSERT INTO t (a, b) VALUES (?, ?)',
      params: [1, 'x'],
    });
  });
  it('buildUpdate appends where params after set params', () => {
    expect(buildUpdate('t', { a: 1, b: 2 }, 'id = ?', ['k'])).toEqual({
      sql: 'UPDATE t SET a = ?, b = ? WHERE id = ?',
      params: [1, 2, 'k'],
    });
  });
});

describe('typed column readers', () => {
  const row = { s: 'hi', n: 3, r: 1.5, flag: 1, notFlag: 0, j: '{"x":1}', bad: '{nope', e: 'b' };
  it('readStr / readInt / readReal coalesce only null/undefined to the default', () => {
    expect(readStr(row, 's')).toBe('hi');
    expect(readStr({ s: null }, 's', 'd')).toBe('d');
    expect(readInt(row, 'n')).toBe(3);
    expect(readInt({}, 'missing', 7)).toBe(7);
    expect(readReal(row, 'r')).toBe(1.5);
  });
  it('readBool is true only when exactly 1', () => {
    expect(readBool(row, 'flag')).toBe(true);
    expect(readBool(row, 'notFlag')).toBe(false);
  });
  it('readJson parses, and falls back on corrupt/empty input', () => {
    expect(readJson(row, 'j', {})).toEqual({ x: 1 });
    expect(readJson(row, 'bad', { fallback: true })).toEqual({ fallback: true });
    expect(readJson({ j: '' }, 'j', [1])).toEqual([1]);
  });
  it('readEnum guards against values outside the allowed set', () => {
    expect(readEnum(row, 'e', ['a', 'b'] as const, 'a')).toBe('b');
    expect(readEnum({ e: 'z' }, 'e', ['a', 'b'] as const, 'a')).toBe('a');
  });
});

describe('isConstraintError', () => {
  it('detects SQLite constraint violations', () => {
    expect(isConstraintError(new Error('UNIQUE constraint failed: t.id'))).toBe(true);
    expect(isConstraintError(new Error('disk I/O error'))).toBe(false);
  });
});

describe('rowValues + FieldMap', () => {
  type T = { done: boolean; name: string; ignored: number };
  const map: FieldMap<T> = {
    done: { col: 'done', to: (v) => (v ? 1 : 0) },
    name: { col: 'name' },
  };
  it('serialises mapped fields and skips unmapped ones', () => {
    expect(rowValues<T>({ done: true, name: 'x', ignored: 9 }, map)).toEqual({ done: 1, name: 'x' });
  });
  it('supports partial objects', () => {
    expect(rowValues<T>({ done: false }, map)).toEqual({ done: 0 });
  });
});

describe('db-executing wrappers', () => {
  it('loadAll maps every row; returns [] and logs on failure', () => {
    mockDb.getAllSync.mockReturnValueOnce([{ v: 1 }, { v: 2 }]);
    expect(loadAll('t', (r) => (r as { v: number }).v)).toEqual([1, 2]);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDb.getAllSync.mockImplementationOnce(() => { throw new Error('boom'); });
    expect(loadAll('t', (r) => r)).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('loadFirst maps a row, or returns null when none', () => {
    mockDb.getFirstSync.mockReturnValueOnce({ v: 5 });
    expect(loadFirst('t', (r) => (r as { v: number }).v)).toBe(5);
    mockDb.getFirstSync.mockReturnValueOnce(undefined);
    expect(loadFirst('t', (r) => r)).toBeNull();
  });
  it('insertRow runs a built INSERT', () => {
    insertRow('t', { a: 1 });
    expect(mockDb.runSync).toHaveBeenCalledWith('INSERT INTO t (a) VALUES (?)', [1]);
  });
  it('updateRow is a no-op when there are no values', () => {
    updateRow('t', {}, 'id = ?', ['k']);
    expect(mockDb.runSync).not.toHaveBeenCalled();
  });
  it('updateRow runs a built UPDATE when values are present', () => {
    updateRow('t', { a: 2 }, 'id = ?', ['k']);
    expect(mockDb.runSync).toHaveBeenCalledWith('UPDATE t SET a = ? WHERE id = ?', [2, 'k']);
  });
  it('tx runs the callback inside a transaction', () => {
    const fn = jest.fn();
    tx(fn);
    expect(mockDb.withTransactionSync).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});
