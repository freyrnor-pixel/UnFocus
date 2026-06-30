/**
 * dataAccess.ts — shared SQLite data-access helpers for the Zustand stores.
 *
 * Removes the boilerplate that every store used to hand-roll: the
 * `try/catch → getAllSync → rowToX → set` load shape, raw INSERT/UPDATE string
 * building, typed column reads with defaults, and JSON (de)serialisation. SQL is
 * built by pure functions (buildSelect/buildInsert/buildUpdate) that are unit
 * tested; the loadAll/loadFirst/insertRow/updateRow/tx wrappers add the single
 * db handle + one consistent error log (replacing 14 silent `catch`es).
 *
 * Connections:
 *   Imports → lib/db
 *   Used by → store/* (data layer)
 *   Data    → executes SQL against the shared `unfocus.db` handle
 *
 * Edit notes:
 *   - Column readers mirror the OLD per-store semantics exactly: readStr/readInt/
 *     readReal coalesce only null/undefined to the default (like `?? d`); call
 *     sites keep their own `|| undefined` where they want falsy→undefined.
 *   - updateRow writes ONLY the columns present in `values`; unlisted columns are
 *     left untouched by SQLite. Combined with a FieldMap this turns the old
 *     full-row rewrites (e.g. settings' 43 columns) into minimal updates with the
 *     same observable result.
 *   - readJson falls back instead of throwing on corrupt JSON, so one bad column
 *     can't blank an entire load() — matches the defensive parse settings already used.
 */
import db from '@/lib/db';

/** A raw SQLite result row. */
export type Row = Record<string, unknown>;

/** A value bindable as a SQL parameter. */
export type SQLValue = string | number | null;

/** One consistent place to surface a DB failure instead of swallowing it silently. */
export function logDbError(context: string, error: unknown): void {
  console.error(`[db] ${context}:`, error instanceof Error ? error.message : error);
}

// ── Typed column readers (null/undefined → default) ─────────────────────────
export function readStr(row: Row, col: string, fallback = ''): string {
  const v = row[col];
  return v == null ? fallback : String(v);
}

export function readInt(row: Row, col: string, fallback = 0): number {
  const v = row[col];
  return v == null ? fallback : Number(v);
}

export function readReal(row: Row, col: string, fallback = 0): number {
  const v = row[col];
  return v == null ? fallback : Number(v);
}

/** SQLite stores booleans as 0/1; truthy only when exactly 1 (matches old `=== 1`). */
export function readBool(row: Row, col: string): boolean {
  return row[col] === 1;
}

/** Parse a JSON text column, returning `fallback` on null/empty/corrupt input. */
export function readJson<T>(row: Row, col: string, fallback: T): T {
  const raw = row[col];
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

// ── Field → column mapping (for INSERT/partial UPDATE) ───────────────────────
/**
 * Describes how a store's object fields map to DB columns. `to` serialises the
 * field value to a SQL value (e.g. boolean→0/1, array→JSON, apply a default).
 */
export type FieldMap<T> = {
  [K in keyof T]?: { col: string; to?: (value: T[K]) => SQLValue };
};

/** Build a `{ column: sqlValue }` object from an (optionally partial) object. */
export function rowValues<T>(obj: Partial<T>, map: FieldMap<T>): Record<string, SQLValue> {
  const out: Record<string, SQLValue> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const m = map[key];
    if (!m) continue;
    const value = obj[key] as T[typeof key];
    out[m.col] = m.to ? m.to(value) : (value as unknown as SQLValue);
  }
  return out;
}

// ── Pure SQL builders (unit tested) ─────────────────────────────────────────
export type SelectOpts = { where?: string; orderBy?: string; params?: SQLValue[] };

export function buildSelect(table: string, opts: SelectOpts = {}): { sql: string; params: SQLValue[] } {
  let sql = `SELECT * FROM ${table}`;
  if (opts.where) sql += ` WHERE ${opts.where}`;
  if (opts.orderBy) sql += ` ORDER BY ${opts.orderBy}`;
  return { sql, params: opts.params ?? [] };
}

export function buildInsert(table: string, values: Record<string, SQLValue>): { sql: string; params: SQLValue[] } {
  const cols = Object.keys(values);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  return { sql, params: cols.map((c) => values[c]) };
}

export function buildUpdate(
  table: string,
  values: Record<string, SQLValue>,
  where: string,
  whereParams: SQLValue[] = []
): { sql: string; params: SQLValue[] } {
  const cols = Object.keys(values);
  const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`;
  return { sql, params: [...cols.map((c) => values[c]), ...whereParams] };
}

// ── DB-executing wrappers ───────────────────────────────────────────────────
/** Load every matching row and map it; logs and returns [] on failure. */
export function loadAll<T>(table: string, map: (row: Row) => T, opts: SelectOpts = {}): T[] {
  try {
    const { sql, params } = buildSelect(table, opts);
    return db.getAllSync<Row>(sql, params).map(map);
  } catch (e) {
    logDbError(`loadAll(${table})`, e);
    return [];
  }
}

/** Load the first matching row and map it; logs and returns null on failure. */
export function loadFirst<T>(table: string, map: (row: Row) => T, opts: SelectOpts = {}): T | null {
  try {
    const { sql, params } = buildSelect(table, opts);
    const row = db.getFirstSync<Row>(sql, params);
    return row ? map(row) : null;
  } catch (e) {
    logDbError(`loadFirst(${table})`, e);
    return null;
  }
}

/** Insert a single row from a `{ column: value }` map. */
export function insertRow(table: string, values: Record<string, SQLValue>): void {
  const { sql, params } = buildInsert(table, values);
  db.runSync(sql, params);
}

/**
 * Update only the supplied columns of the row(s) matching `where`. An empty
 * `values` map is a no-op (nothing to set).
 */
export function updateRow(
  table: string,
  values: Record<string, SQLValue>,
  where: string,
  whereParams: SQLValue[] = []
): void {
  if (Object.keys(values).length === 0) return;
  const { sql, params } = buildUpdate(table, values, where, whereParams);
  db.runSync(sql, params);
}

/** Run `fn` inside a synchronous transaction so multi-step writes stay atomic. */
export function tx(fn: () => void): void {
  db.withTransactionSync(fn);
}
