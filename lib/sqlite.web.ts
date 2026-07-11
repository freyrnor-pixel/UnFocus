/**
 * sqlite.web.ts — Web preview shim for lib/sqlite.ts.
 *
 * PRIMARY PATH REJECTED (spike outcome): expo-sqlite's web backend (wa-sqlite/
 * WASM) bridges its worker to the main thread via Atomics on a SharedArrayBuffer,
 * which requires a growable SHARED WebAssembly.Memory. In this container that
 * allocation fails with `RangeError: Out of memory: Cannot allocate Wasm memory
 * for new instance` — confirmed reproducible, root-caused to `RLIMIT_MEMLOCK`
 * being fixed at 8MB with no permission to raise it (`ulimit -l unlimited` →
 * "Operation not permitted"). Not fixable from app code.
 *
 * FALLBACK (this file): `sql.js`, an in-memory, single-threaded WASM SQLite
 * build that needs no worker, no SharedArrayBuffer, no locked memory. Its own
 * init is async (fetch + compile the .wasm), which collides with every store
 * expecting a synchronous `db` handle at import time — solved by loading sql.js
 * via a plain `<script>` bootstrap in dist/index.html (see
 * scripts/build-web.mjs) that runs BEFORE the app bundle's `<script>` tag is
 * even inserted, and stashes the ready `SQL.Database` on
 * `window.__unfocusSqlJsDb__`. By the time this module evaluates, that global
 * already exists — genuinely synchronous, no queuing/proxy tricks needed.
 *
 * In-memory only (no persistence across reloads) — fine for a preview harness
 * that needs no durability, per EMULATOR_TESTING_SPIKE.md's fallback plan.
 *
 * Connections:
 *   Imports → none (reads the sql.js global set by scripts/build-web.mjs's
 *             index.html bootstrap)
 *   Used by → lib/db.ts (web bundle resolves this over lib/sqlite.ts)
 *   Data    → in-memory SQLite database (sql.js), owns the same table surface
 *             as the native `unfocus.db` (schema lives in lib/db.ts)
 */

type SqlJsValue = string | number | Uint8Array | null;
type SqlJsStatement = {
  bind(params: SqlJsValue[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
};
type SqlJsDatabase = {
  exec(sql: string): unknown;
  run(sql: string, params?: SqlJsValue[]): SqlJsDatabase;
  prepare(sql: string): SqlJsStatement;
  getRowsModified(): number;
};

declare global {
  interface Window {
    __unfocusSqlJsDb__?: SqlJsDatabase;
  }
}

function getSqlJsDb(): SqlJsDatabase {
  const raw = typeof window !== 'undefined' ? window.__unfocusSqlJsDb__ : undefined;
  if (!raw) {
    throw new Error(
      'sql.js database not ready — expected window.__unfocusSqlJsDb__ to be set by the ' +
        'index.html bootstrap (scripts/build-web.mjs) before the app bundle loads.'
    );
  }
  return raw;
}

function toSqlJsParams(params: readonly (string | number | null)[]): SqlJsValue[] {
  return params.map((p) => p);
}

function runQuery<T = Record<string, unknown>>(sql: string, params: readonly (string | number | null)[]): T[] {
  const stmt = getSqlJsDb().prepare(sql);
  try {
    stmt.bind(toSqlJsParams(params));
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export const db = {
  execSync(source: string): void {
    getSqlJsDb().exec(source);
  },
  runSync(source: string, params: readonly (string | number | null)[] = []): { changes: number; lastInsertRowId: number } {
    const sqlJsDb = getSqlJsDb();
    sqlJsDb.run(source, toSqlJsParams(params));
    return { changes: sqlJsDb.getRowsModified(), lastInsertRowId: 0 };
  },
  getAllSync<T = Record<string, unknown>>(source: string, params: readonly (string | number | null)[] = []): T[] {
    return runQuery<T>(source, params);
  },
  getFirstSync<T = Record<string, unknown>>(source: string, params: readonly (string | number | null)[] = []): T | undefined {
    return runQuery<T>(source, params)[0];
  },
  withTransactionSync(task: () => void): void {
    getSqlJsDb().exec('BEGIN');
    try {
      task();
      getSqlJsDb().exec('COMMIT');
    } catch (e) {
      getSqlJsDb().exec('ROLLBACK');
      throw e;
    }
  },
};
