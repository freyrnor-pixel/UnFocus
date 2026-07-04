/**
 * backup.ts — local, device-only data portability (Decision 036).
 *
 * Serialises the WHOLE `unfocus.db` to a single versioned JSON file and hands it
 * to the OS share sheet (export), and restores such a file back into the local
 * database after an explicit confirm (import). The app never uploads anything —
 * the export's destination and the import's source are entirely the user's
 * choice, outside the app. Keeps the "local-only, no remote accounts, no servers"
 * invariant intact (a local account per Decision 039 is device-only and rides along
 * in this backup via the settings row — it does NOT add any upload or server path).
 *
 * Format is a versioned JSON dump keyed by table (preferred over a raw-file copy
 * for forward-compat across migrations): every table's rows are captured as-is,
 * with a header carrying `magic`, `schemaVersion` (= PRAGMA user_version, i.e.
 * lib/db.ts's migrations count) and `appVersion`. Import refuses a backup whose
 * schemaVersion is NEWER than this build (unknown columns can't be applied);
 * OLDER backups restore cleanly because migrations only ADD columns — missing
 * columns fall back to their defaults, and initDb() has already brought the live
 * schema up to date before any restore runs.
 *
 * A backup reflects the DB's CURRENT state, including whatever pruneOldData()
 * (lib/db.ts, 365-day retention) has already removed — export does not un-prune.
 *
 * Connections:
 *   Imports → lib/db (the shared handle + table set), lib/date (todayStr);
 *             expo-file-system/legacy, expo-sharing, expo-document-picker,
 *             expo-constants, expo-updates
 *   Used by → app/settings.tsx (Data tab → Backup & restore card)
 *   Data    → reads/writes EVERY table in unfocus.db; restore DELETEs then
 *             re-INSERTs all rows inside one transaction (FKs off for the swap)
 *
 * Edit notes:
 *   - NATIVE modules (expo-file-system / expo-sharing / expo-document-picker) —
 *     adding these is a native-surface change, so it is gated behind a new APK/AAB
 *     build (see AGENTS.md "Runtime version"). Do NOT bump runtimeVersion until
 *     that build exists.
 *   - Uses expo-file-system's LEGACY functional API (writeAsStringAsync etc.) on
 *     purpose — stable signatures across the SDK 56 new-API migration.
 *   - schemaVersion is PRAGMA user_version; keep it in lock-step with lib/db.ts's
 *     migrations array (never reorder/remove entries there — that's what makes an
 *     older backup's rows safe to load into a newer schema).
 *   - Table/column names are interpolated into SQL (not bindable as params), but
 *     they come only from sqlite_master / PRAGMA table_info of the LIVE db and the
 *     backup's keys are intersected against the live columns — never trusted raw.
 */
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  cacheDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import type { SQLiteBindValue } from 'expo-sqlite';
import db from '@/lib/db';
import { todayStr } from '@/lib/date';

/** Identifies a file as an UnFocus backup; import refuses anything else. */
const BACKUP_MAGIC = 'unfocus-backup';

type Row = Record<string, unknown>;

export interface BackupFile {
  magic: string;
  /** = PRAGMA user_version at export time (lib/db.ts migrations count). */
  schemaVersion: number;
  /** app.json `version` at export time — informational. */
  appVersion: string;
  exportedAt: string;
  tables: Record<string, Row[]>;
}

/** Current on-disk schema version (migrations applied). */
function currentSchemaVersion(): number {
  return db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/** Every user table (excludes SQLite internals + Android's metadata table). */
function listTables(): string[] {
  return db
    .getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'android_metadata' ORDER BY name"
    )
    .map((r) => r.name);
}

/** Column names of a live table, per PRAGMA table_info. */
function tableColumns(table: string): Set<string> {
  return new Set(
    db.getAllSync<{ name: string }>(`PRAGMA table_info("${table}")`).map((c) => c.name)
  );
}

function buildBackup(): BackupFile {
  const tables: Record<string, Row[]> = {};
  for (const table of listTables()) {
    tables[table] = db.getAllSync<Row>(`SELECT * FROM "${table}"`);
  }
  return {
    magic: BACKUP_MAGIC,
    schemaVersion: currentSchemaVersion(),
    appVersion: Constants.expoConfig?.version ?? '',
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/**
 * Serialise the whole DB to a JSON file in the cache dir and open the OS share
 * sheet so the user can save it wherever they like. Returns 'unavailable' when
 * the platform has no share sheet (the file is still written). Throws on write
 * failure — the caller surfaces that.
 */
export async function exportBackup(): Promise<'shared' | 'unavailable'> {
  const json = JSON.stringify(buildBackup());
  const uri = `${cacheDirectory}unfocus-backup-${todayStr()}.json`;
  await writeAsStringAsync(uri, json, { encoding: EncodingType.UTF8 });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'UnFocus backup',
    UTI: 'public.json',
  });
  return 'shared';
}

export type ParsedBackup =
  | { status: 'canceled' }
  | { status: 'invalid' }
  | { status: 'tooNew' }
  | { status: 'ok'; data: BackupFile; rowCount: number };

/**
 * Let the user pick a backup file, then read + validate it WITHOUT touching the
 * database. The caller shows a confirm before calling restoreBackup(). Never
 * throws — bad files resolve to 'invalid'.
 */
export async function pickAndParseBackup(): Promise<ParsedBackup> {
  let uri: string | undefined;
  try {
    // Accept any file type — some Android file providers report a .json backup as
    // octet-stream, which an 'application/json' filter would hide. We validate the
    // contents by `magic` after reading, so an over-broad picker is safe.
    const res = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (res.canceled) return { status: 'canceled' };
    uri = res.assets?.[0]?.uri;
  } catch {
    return { status: 'invalid' };
  }
  if (!uri) return { status: 'canceled' };

  let data: BackupFile;
  try {
    const raw = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
    data = JSON.parse(raw);
  } catch {
    return { status: 'invalid' };
  }

  if (!data || data.magic !== BACKUP_MAGIC || typeof data.tables !== 'object' || data.tables === null) {
    return { status: 'invalid' };
  }
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > currentSchemaVersion()) {
    return { status: 'tooNew' };
  }

  let rowCount = 0;
  for (const rows of Object.values(data.tables)) {
    if (Array.isArray(rows)) rowCount += rows.length;
  }
  return { status: 'ok', data, rowCount };
}

/**
 * Replace ALL local data with the backup's contents, in one transaction. For
 * every table present in BOTH the backup and the live schema: DELETE all rows,
 * then re-INSERT the backup's rows (only columns that still exist are written;
 * unknown tables/columns are skipped). Foreign keys are disabled for the swap so
 * delete/insert ordering across related tables doesn't matter. Throws on failure
 * — the transaction rolls back, leaving current data intact.
 */
export function restoreBackup(data: BackupFile): void {
  const liveTables = new Set(listTables());

  // PRAGMA foreign_keys can't change inside a transaction, so toggle it around.
  db.execSync('PRAGMA foreign_keys = OFF');
  try {
    db.withTransactionSync(() => {
      // Clear every live table first — true "replace all data" semantics, so
      // leftover rows in tables the (possibly older) backup doesn't contain don't
      // survive the restore.
      for (const table of liveTables) {
        db.execSync(`DELETE FROM "${table}"`);
      }
      // Then repopulate from the backup (tables not in the live schema are skipped;
      // only columns that still exist are written).
      for (const table of Object.keys(data.tables)) {
        if (!liveTables.has(table)) continue;
        const rows = data.tables[table];
        if (!Array.isArray(rows)) continue;
        const cols = tableColumns(table);

        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const keys = Object.keys(row).filter((k) => cols.has(k));
          if (keys.length === 0) continue;
          const colList = keys.map((k) => `"${k}"`).join(', ');
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map((k) => (row as Row)[k] as SQLiteBindValue);
          db.runSync(`INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`, values);
        }
      }
      // Guarantee the settings singleton exists even if the backup somehow lacked
      // it — initDb() also re-creates it on the reload that follows a restore.
      db.execSync('INSERT OR IGNORE INTO settings (id) VALUES (1)');
    });
  } finally {
    db.execSync('PRAGMA foreign_keys = ON');
  }
}

/**
 * Reload the JS app so every store re-reads the freshly restored database.
 * Swallows errors (reloadAsync is a no-op / throws in some dev contexts); the
 * caller can fall back to asking the user to restart manually.
 */
export async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    /* dev/unsupported — user restarts manually */
  }
}
