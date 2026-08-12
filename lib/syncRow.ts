/**
 * syncRow.ts — stamp a local edit AND announce it, as one call.
 *
 * The two things that must always happen together after mutating a synced row:
 * lib/liveSync's `touchRow` (move `updated_at` + `origin_device_id`, so the edit wins
 * future merges) and lib/syncService's `broadcastRow` (push it to connected peers now).
 *
 * Four stores each carried a byte-identical private copy of this pair — `syncTaskRow`,
 * `syncItemRow`, `syncPersonRow`, `syncTagRow` — differing only in the table name, each
 * one's comment saying it "mirrors" the last. They still exist as one-line wrappers so
 * each store names its own table once instead of at every call site, but the BODY lives
 * here, once.
 *
 * **Why the pair is not optional.** An unstamped write never moves `updated_at`, so a
 * paired phone's untouched copy wins the LWW tiebreak outright — and because `buildDelta`
 * ships a FULL-ROW snapshot, one later edit to any unrelated field on that phone carries
 * the stale value back. That is exactly the bug AGENTS.md's top gotcha records: the
 * monthly reset reverting itself, every month, on every household that had ever paired a
 * device. See __tests__/shoppingResetSync.test.ts.
 *
 * **Why this is its own module rather than a function in lib/syncService.ts.** A store
 * test mocks `@/lib/syncService` wholesale to keep the LAN transport out of the test
 * environment. Had the pair lived inside that module it would call the module's own
 * `broadcastRow`, not the mocked one, and the tests that assert "this bulk write announced
 * every row it changed" would silently stop observing the broadcast half. Living one level
 * up, it resolves both halves through the module registry, so both stay mockable.
 *
 * Connections:
 *   Imports → lib/liveSync (touchRow), lib/syncService (broadcastRow),
 *             store/useSettingsStore (deviceId)
 *   Used by → store/useTaskStore.ts, store/useShoppingStore.ts, store/usePeopleStore.ts,
 *             store/useTagStore.ts — each via its own one-line named wrapper
 *   Data    → writes `updated_at` / `origin_device_id` on the named row (via touchRow)
 *
 * Edit notes:
 *   - The soft-delete paths deliberately do NOT go through here. Three of them run inside
 *     a `tx()` alongside other SQL and broadcast at a different point (or not in that
 *     block at all), so the pair isn't uniform there — those still call `softDelete` and
 *     `broadcastRow` explicitly. Don't "finish the job" by forcing them into one helper
 *     without reading each transaction first.
 */
import { SyncTable, touchRow } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Stamp one local edit and push it to every connected peer. */
export function syncRow(table: SyncTable, id: string): void {
  touchRow(table, id, useSettingsStore.getState().deviceId);
  broadcastRow(table, id);
}

/**
 * `syncRow` over many ids, reading the device id once. Behaviourally identical to calling
 * `syncRow` in a loop — the single read is the only reason this exists separately.
 */
export function syncRows(table: SyncTable, ids: string[]): void {
  const deviceId = useSettingsStore.getState().deviceId;
  for (const id of ids) {
    touchRow(table, id, deviceId);
    broadcastRow(table, id);
  }
}
