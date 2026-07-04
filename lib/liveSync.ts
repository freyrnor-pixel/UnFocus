/**
 * liveSync.ts — last-write-wins row sync data model (Decision 038b).
 *
 * Defines the on-the-wire row delta for live peer sync and the merge policy:
 * **last-write-wins per row**, keyed by `updated_at` with `origin_device_id` as a
 * deterministic tiebreak, and soft-delete **tombstones** (`deleted_at`) so a delete
 * isn't undone by a stale peer copy. First cut is **tasks + shopping_items only**
 * (Decision 038b scope); habits/child profiles come later.
 *
 * Delegation is a **directed create** (parent → child device) the child cannot
 * reassign back: such a delta carries `directed: true`. The *enforcement* (a child
 * device refusing to emit a reassigning delta) lands with child-mode gating in
 * Decision 038c; this module carries the flag and the guard hook.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess
 *   Used by → (future) the sync loop: it stamps local edits (touchRow/softDelete),
 *             builds deltas, signs them via lib/peerAuth, sends over lib/lanTransport,
 *             and on receive verifies then calls applyDelta. Nothing wires the socket
 *             loop yet — this is the data-model foundation 038c/app integration build on.
 *   Data    → reads/writes the sync-meta columns (updated_at, origin_device_id,
 *             deleted_at) on the `tasks` and `shopping_items` tables (Decision 038b migration)
 *
 * Edit notes:
 *   - LWW compares ISO-8601 `updated_at` strings lexicographically — that only works
 *     because todayStr()/toISOString() are fixed-width UTC. Never store a local-format
 *     timestamp here.
 *   - Column writes are whitelisted per table (TABLE_COLUMNS) — a delta's `fields`
 *     keys are filtered against it before hitting SQL, since deltas are untrusted input.
 *   - A tombstone keeps the row (per the never-drop rule) with `deleted_at` set; the
 *     stores must filter `deleted_at IS NULL` when reading live data (wiring step).
 */
import db from '@/lib/db';
import { SQLValue } from '@/lib/dataAccess';

/** Tables in the Decision 038b first cut. */
export type SyncTable = 'tasks' | 'shopping_items';
export const SYNC_TABLES: SyncTable[] = ['tasks', 'shopping_items'];

/** Whitelisted syncable data columns per table (meta columns handled separately). */
const TABLE_COLUMNS: Record<SyncTable, string[]> = {
  tasks: [
    'title', 'task_date', 'task_time', 'task_type', 'duration_minutes', 'done',
    'recurring', 'recurring_days', 'created_at', 'sort_order', 'hint', 'follows_task_id',
  ],
  shopping_items: [
    'name', 'amount', 'unit', 'list_type', 'checked', 'store', 'price', 'created_at', 'list_id',
  ],
};

/** One row change crossing the wire. Becomes the signed peerAuth body. */
export type RowDelta = {
  table: SyncTable;
  id: string;
  /** ISO-8601 UTC. Drives last-write-wins. */
  updatedAt: string;
  /** Author device id — LWW tiebreak + delegation origin. */
  originDeviceId: string;
  /** Tombstone timestamp (ISO) or null for a live row. */
  deletedAt: string | null;
  /** Whitelisted column → value for the row body. Ignored for pure tombstones. */
  fields: Record<string, SQLValue>;
  /** Delegation: directed create (parent → child), not bidirectional. */
  directed?: boolean;
};

type LocalMeta = { updatedAt: string; originDeviceId: string } | null;

/** Read the local row's sync meta, or null if the row doesn't exist. */
function localMeta(table: SyncTable, id: string): LocalMeta {
  const row = db.getFirstSync(
    `SELECT updated_at AS u, origin_device_id AS o FROM ${table} WHERE id = ?`,
    [id],
  ) as { u?: string; o?: string } | null;
  if (!row) return null;
  return { updatedAt: row.u ?? '', originDeviceId: row.o ?? '' };
}

/**
 * Last-write-wins decision. Returns true if `incoming` should overwrite `local`.
 * Newer `updatedAt` wins; on an exact tie the lexicographically-greater
 * `originDeviceId` wins (deterministic + symmetric across both devices). A missing
 * local row always yields true.
 */
export function incomingWins(
  local: LocalMeta,
  incoming: { updatedAt: string; originDeviceId: string },
): boolean {
  if (!local) return true;
  if (incoming.updatedAt !== local.updatedAt) return incoming.updatedAt > local.updatedAt;
  return incoming.originDeviceId > local.originDeviceId;
}

/** Validate an untrusted inbound object into a RowDelta, or null if malformed. */
export function parseDelta(input: unknown): RowDelta | null {
  const d = input as RowDelta;
  if (
    !d ||
    (d.table !== 'tasks' && d.table !== 'shopping_items') ||
    typeof d.id !== 'string' ||
    typeof d.updatedAt !== 'string' ||
    typeof d.originDeviceId !== 'string' ||
    (d.deletedAt !== null && typeof d.deletedAt !== 'string') ||
    typeof d.fields !== 'object' ||
    d.fields === null
  ) {
    return null;
  }
  return d;
}

/**
 * Apply an inbound delta under LWW. Returns true if it changed local state,
 * false if a newer/equal local row won and it was ignored. Upserts on `id`;
 * a tombstone (deletedAt set) marks the row deleted without dropping it.
 */
export function applyDelta(delta: RowDelta): boolean {
  const local = localMeta(delta.table, delta.id);
  if (!incomingWins(local, delta)) return false;

  const allowed = TABLE_COLUMNS[delta.table];
  const cols: string[] = ['id', 'updated_at', 'origin_device_id', 'deleted_at'];
  const vals: SQLValue[] = [delta.id, delta.updatedAt, delta.originDeviceId, delta.deletedAt];
  // Even for a tombstone we carry through any provided fields so the row body is
  // consistent, but a tombstone with no fields is valid (delete of a known id).
  for (const [key, value] of Object.entries(delta.fields)) {
    if (allowed.includes(key)) {
      cols.push(key);
      vals.push(value as SQLValue);
    }
  }
  const placeholders = cols.map(() => '?').join(', ');
  db.runSync(
    `INSERT OR REPLACE INTO ${delta.table} (${cols.join(', ')}) VALUES (${placeholders})`,
    vals,
  );
  return true;
}

/**
 * Stamp a local edit so it will win future merges and can be emitted as a delta.
 * Call this whenever the app mutates a syncable row locally.
 */
export function touchRow(table: SyncTable, id: string, selfDeviceId: string, now = new Date().toISOString()): void {
  db.runSync(`UPDATE ${table} SET updated_at = ?, origin_device_id = ? WHERE id = ?`, [
    now,
    selfDeviceId,
    id,
  ]);
}

/** Soft-delete a local row (tombstone) so the deletion propagates and sticks. */
export function softDelete(table: SyncTable, id: string, selfDeviceId: string, now = new Date().toISOString()): void {
  db.runSync(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ?, origin_device_id = ? WHERE id = ?`,
    [now, now, selfDeviceId, id],
  );
}

/** Build an outbound delta from a local row (post-touch). Returns null if the row is gone. */
export function buildDelta(table: SyncTable, id: string, opts: { directed?: boolean } = {}): RowDelta | null {
  const row = db.getFirstSync(`SELECT * FROM ${table} WHERE id = ?`, [id]) as Record<string, unknown> | null;
  if (!row) return null;
  const allowed = TABLE_COLUMNS[table];
  const fields: Record<string, SQLValue> = {};
  for (const col of allowed) {
    if (col in row) fields[col] = (row[col] ?? null) as SQLValue;
  }
  return {
    table,
    id,
    updatedAt: (row.updated_at as string) ?? '',
    originDeviceId: (row.origin_device_id as string) ?? '',
    deletedAt: (row.deleted_at as string) ?? null,
    fields,
    ...(opts.directed ? { directed: true } : {}),
  };
}

// Delegation enforcement note (Decision 038b rule → 038c owns enforcement):
// "delegation is a directed create the child cannot reassign back." The `directed`
// flag above marks such a delta on the wire. This layer intentionally does NOT gate
// reassignment: `origin_device_id` is the LWW last-writer, not a stable owner, so it
// cannot distinguish "reassign" from a normal edit. Child mode (038c) enforces the
// rule by hiding reassignment affordances entirely — there is no owner-change delta to
// gate at the data layer. When 038c lands, revisit whether a distinct owner column is
// needed; for the tasks+shopping first cut, directed rows only ever flow parent → child.
