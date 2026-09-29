/**
 * migrationsRealSqlite.test.ts — initDb() against a REAL SQLite mockEngine (sql.js), not a mock.
 *
 * Since 2026-09-29 the migration runner stops at the first genuine failure and retries it on
 * the next launch, instead of recording it as applied. That is only safe if every migration
 * succeeds on a fresh install — otherwise a new install would stop partway, forever. This
 * runs the whole log on an empty database and asserts it reaches the end, cleanly, twice.
 */
// The pure-JS build: jest's environment can't instantiate the wasm one. sql.js ships no
// types here, so the few calls this file makes are typed locally.
import { initDb } from '@/lib/db';

type Stmt = { bind(p: unknown[]): void; step(): boolean; getAsObject(): Record<string, unknown>; free(): void };
type Database = { exec(sql: string): unknown; run(sql: string, p?: unknown[]): unknown; prepare(sql: string): Stmt };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require('sql.js/dist/sql-asm.js') as () => Promise<{ Database: new () => Database }>;

let mockEngine: Database;
/** A statement fragment to fail exactly once (a transient error), or null. */
let mockFailOnce: string | null = null;

type Params = unknown[] | undefined;
function mockRows(sql: string, params?: Params): Record<string, unknown>[] {
  const stmt = mockEngine.prepare(sql);
  if (params && params.length) stmt.bind(params);
  const out: Record<string, unknown>[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

jest.mock('@/lib/sqlite', () => ({
  db: {
    execSync: (sql: string) => {
      if (mockFailOnce && sql.includes(mockFailOnce)) {
        mockFailOnce = null;
        throw new Error('database is locked');
      }
      return mockEngine.exec(sql);
    },
    runSync: (sql: string, params?: Params) => mockEngine.run(sql, params),
    getAllSync: (sql: string, params?: Params) => mockRows(sql, params),
    getFirstSync: (sql: string, params?: Params) => mockRows(sql, params)[0] ?? null,
    withTransactionSync: (fn: () => void) => fn(),
  },
}));

const userVersion = () => Number(mockRows('PRAGMA user_version')[0].user_version);

let SQL: { Database: new () => Database };
beforeAll(async () => {
  SQL = await initSqlJs();
  mockEngine = new SQL.Database();
});

test('every migration applies on a fresh database', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  initDb();
  expect(errors.mock.calls.map((c) => String(c[0]))).toEqual([]);
  const reached = userVersion();
  expect(reached).toBeGreaterThan(100);
  // The two newest columns exist, so the log really ran to its end.
  const cols = mockRows('PRAGMA table_info(task_steps)').map((c) => c.name);
  expect(cols).toEqual(expect.arrayContaining(['updated_at', 'origin_device_id', 'deleted_at']));
  expect(mockRows('PRAGMA table_info(tasks)').map((c) => c.name)).toContain('done_on');
  errors.mockRestore();
});

test('a second launch is a no-op and keeps the version', () => {
  const before = userVersion();
  initDb();
  expect(userVersion()).toBe(before);
});

test('replaying from an older version (a restored backup) runs to the end without real errors', () => {
  const end = userVersion();
  mockEngine.exec('PRAGMA user_version = 0');
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  initDb();
  expect(errors.mock.calls.map((c) => String(c[0]))).toEqual([]);
  expect(userVersion()).toBe(end);
  errors.mockRestore();
});

test('a migration that fails once is NOT recorded as applied, and runs on the next launch', () => {
  mockEngine = new SQL.Database();
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFailOnce = 'ADD COLUMN done_on';
  initDb();
  expect(errors).toHaveBeenCalledTimes(1);
  expect(mockRows('PRAGMA table_info(tasks)').map((c) => c.name)).not.toContain('done_on');
  // Stopped AT the failure: the step columns after it weren't applied either.
  expect(mockRows('PRAGMA table_info(task_steps)').map((c) => c.name)).not.toContain('deleted_at');
  const stuckAt = userVersion();

  initDb(); // next launch — the transient error is gone
  expect(userVersion()).toBeGreaterThan(stuckAt);
  expect(mockRows('PRAGMA table_info(tasks)').map((c) => c.name)).toContain('done_on');
  expect(mockRows('PRAGMA table_info(task_steps)').map((c) => c.name)).toContain('deleted_at');
  errors.mockRestore();
});
