/**
 * metaJson.ts — one JSON-blob-in-`app_meta` accessor, built per key prefix.
 *
 * `app_meta` is the app's key/value side table. Several features keep a small JSON blob in
 * it under a prefixed key, and each had written out the same four operations by hand:
 * read-and-parse-and-normalize-with-a-safe-default, stringify-and-INSERT-OR-REPLACE,
 * DELETE, and a `GLOB '<prefix>*'` scan of every row under the prefix.
 *
 * lib/viewSnapshot.ts and lib/energyDayState.ts were the clearest case — structurally the
 * same file with a different payload type, about 50 shared lines, and energyDayState's own
 * header said so outright ("Mirrors lib/viewSnapshot.ts exactly"). Both now build their
 * accessor from here and keep their existing public API.
 *
 * **Two disciplines this preserves, because both are load-bearing:**
 *   - **Nothing here throws.** These reads happen inside render passes
 *     (lib/useNewSinceSeen.ts, lib/useEnergyPause.ts). A corrupt blob degrades to the
 *     caller's fallback and is logged; it never takes a screen down.
 *   - **`app_meta` is device-local and must stay that way.** It is not in
 *     lib/syncService.ts's `SyncTable` union and must never be added
 *     (lib/__tests__/liveSync.test.ts guards it). Two people in People/family mode would
 *     otherwise clear each other's glows and pause each other's days.
 *
 * Connections:
 *   Imports → lib/db (the shared handle), lib/dataAccess (logDbError)
 *   Used by → lib/viewSnapshot.ts, lib/energyDayState.ts, lib/__tests__/metaJson.test.ts
 *   Data    → SQLite `app_meta` rows under whatever prefix the caller names
 *
 * Edit notes:
 *   - **The normalizer decides the shape, including whether "missing" is representable.**
 *     viewSnapshot passes `ViewSnapshot | null` with a `null` fallback (a surface may
 *     genuinely never have been saved); energyDayState passes a total normalizer with
 *     `DEFAULT_DAY_STATE` (a day with no row is a real, meaningful state). Both work
 *     because `T` covers the fallback — don't "simplify" this into a nullable-only API.
 *   - `readAll` keys its result on the part of the row key AFTER the prefix, and skips a
 *     row whose remainder is empty. One unreadable row degrades to the fallback rather
 *     than costing the whole scan.
 */
import db from '@/lib/db';
import { logDbError } from '@/lib/dataAccess';

/** The four operations a prefixed JSON blob supports. */
export type MetaJsonStore<T> = {
  /** Read one key's blob, or the fallback if it is missing, corrupt or unreadable. */
  read: (key: string) => T;
  /** Overwrite one key's blob. */
  write: (key: string, value: T) => void;
  /** Drop one key's blob — the test/reset seam. */
  clear: (key: string) => void;
  /** Every stored blob under this prefix, keyed by the part of the row key after it. */
  readAll: () => Record<string, T>;
};

/**
 * Build an accessor for JSON blobs stored under `prefix` in `app_meta`.
 *
 * @param prefix   Row-key prefix, including its trailing separator (e.g. `'view:'`).
 * @param normalize Coerce an untrusted parsed blob into `T`. Called on every read.
 * @param fallback What a missing, corrupt or unreadable row reads as.
 * @param label    Module name used in the `logDbError` tag, e.g. `'viewSnapshot'`.
 */
export function metaJson<T>(
  prefix: string,
  normalize: (raw: unknown) => T,
  fallback: T,
  label: string
): MetaJsonStore<T> {
  return {
    read(key) {
      try {
        const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [
          `${prefix}${key}`,
        ]);
        if (!row?.value) return fallback;
        return normalize(JSON.parse(row.value) as unknown);
      } catch (e) {
        logDbError(`${label}.read(${key})`, e);
        return fallback;
      }
    },

    write(key, value) {
      try {
        db.runSync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
          `${prefix}${key}`,
          JSON.stringify(value),
        ]);
      } catch (e) {
        logDbError(`${label}.write(${key})`, e);
      }
    },

    clear(key) {
      try {
        db.runSync('DELETE FROM app_meta WHERE key = ?', [`${prefix}${key}`]);
      } catch (e) {
        logDbError(`${label}.clear(${key})`, e);
      }
    },

    readAll() {
      try {
        const rows = db.getAllSync<{ key: string; value: string }>(
          'SELECT key, value FROM app_meta WHERE key GLOB ?',
          [`${prefix}*`]
        );
        const out: Record<string, T> = {};
        for (const row of rows ?? []) {
          const suffix = row.key.slice(prefix.length);
          if (!suffix) continue;
          try {
            out[suffix] = normalize(JSON.parse(row.value) as unknown);
          } catch {
            // One unreadable row must not cost the rest of them.
            out[suffix] = fallback;
          }
        }
        return out;
      } catch (e) {
        logDbError(`${label}.readAll`, e);
        return {};
      }
    },
  };
}
