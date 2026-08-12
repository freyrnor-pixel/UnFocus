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
 *   Imports → lib/db (the shared handle + table set), lib/date (todayStr),
 *             lib/fileExport (shareTextFile / saveTextToDevice / safDirectoryLabel — the
 *             two export flows and the SAF label live there now, shared with the AI setup
 *             guide and the design lab; SaveToDeviceResult is re-exported from here so
 *             existing importers are unaffected),
 *             store/useSettingsStore (auto-backup target uri + last-run stamp);
 *             expo-file-system/legacy (incl. StorageAccessFramework — still used directly
 *             by the auto-backup path, which needs the created file's URI back),
 *             expo-document-picker, expo-constants, expo-updates, react-native (Platform)
 *   Used by → app/settings.tsx (Data tab → Local account card's Backup & restore section),
 *             app/onboarding/restore.tsx (first-run "restore my data" step),
 *             app/_layout.tsx (saveAutoBackup on app background)
 *   Data    → reads/writes EVERY table in unfocus.db; restore DELETEs then
 *             re-INSERTs all rows inside one transaction (FKs off for the swap)
 *
 * Edit notes:
 *   - NATIVE modules (expo-file-system / expo-sharing / expo-document-picker) —
 *     adding these is a native-surface change, so it is gated behind a new APK/AAB
 *     build (see AGENTS.md "Runtime version"). Do NOT bump runtimeVersion until
 *     that build exists.
 *   - Auto-backup is a SINGLE self-updating file that must SURVIVE UNINSTALL, so it
 *     never writes to the sandbox (cache/document dir on Android). Android points at
 *     a user-picked SAF folder (settings.autoBackupUri, persistable permission),
 *     overwriting that one file; iOS uses the fixed documentDirectory file (Files /
 *     iCloud-visible). chooseAutoBackupLocation() sets the target; saveAutoBackup()
 *     writes it and stamps settings.autoBackupLastAt.
 *   - Uses expo-file-system's LEGACY functional API (writeAsStringAsync etc.) on
 *     purpose — stable signatures across the SDK 56 new-API migration.
 *   - exportBackupToDevice() writes a real local file instead of routing through
 *     the share sheet: on Android via SAF (`StorageAccessFramework`, user picks a
 *     folder); on iOS via `documentDirectory`, which Files exposes under
 *     "On My iPhone/iPad → UnFocus" thanks to the `UIFileSharingEnabled` +
 *     `LSSupportsOpeningDocumentsInPlace` flags in app.json (falls back to the
 *     share sheet if that write fails).
 *   - schemaVersion is PRAGMA user_version; keep it in lock-step with lib/db.ts's
 *     migrations array (never reorder/remove entries there — that's what makes an
 *     older backup's rows safe to load into a newer schema).
 *   - Table/column names are interpolated into SQL (not bindable as params), but
 *     they come only from sqlite_master / PRAGMA table_info of the LIVE db and the
 *     backup's keys are intersected against the live columns — never trusted raw.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as DocumentPicker from 'expo-document-picker';
import {
  documentDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  EncodingType,
  StorageAccessFramework,
} from 'expo-file-system/legacy';
import type { SQLiteBindValue } from 'expo-sqlite';
import db from '@/lib/db';
import { todayStr } from '@/lib/date';
import {
  safDirectoryLabel,
  saveTextToDevice,
  shareTextFile,
  type SaveToDeviceResult,
  type TextFileSpec,
} from '@/lib/fileExport';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Identifies a file as an UnFocus backup; import refuses anything else. */
const BACKUP_MAGIC = 'unfocus-backup';

/** Filename (no extension) of the single self-updating auto-backup file. */
const AUTO_BACKUP_BASENAME = 'unfocus-auto-backup';

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

function buildBackup(opts: { redactName?: boolean } = {}): BackupFile {
  const tables: Record<string, Row[]> = {};
  for (const table of listTables()) {
    let rows = db.getAllSync<Row>(`SELECT * FROM "${table}"`);
    if (opts.redactName && table === 'settings') {
      rows = rows.map((r) => ({ ...r, user_name: '' }));
    }
    tables[table] = rows;
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
 * Fixed, uninstall-surviving path where auto-backup writes on this platform, or
 * null when there is none. iOS: the app's documentDirectory — user-visible in
 * Files (UIFileSharingEnabled) and swept into device/iCloud backups. Android has
 * NO persistent fixed path (documentDirectory/cacheDirectory both live in the
 * sandbox and die on uninstall), so it returns null — Android auto-backup goes to
 * the user-picked SAF location (settings.autoBackupUri) instead.
 */
function getAutoBackupPath(): string | null {
  if (Platform.OS === 'ios' && documentDirectory) return `${documentDirectory}${AUTO_BACKUP_BASENAME}.json`;
  return null;
}

/** Human-readable description of the auto-backup location shown in settings. */
function getAutoBackupLabel(): string {
  if (Platform.OS === 'ios') return 'Files → On My iPhone/iPad → UnFocus';
  return 'the folder you choose';
}

export type AutoBackupLocation = { uri: string; label: string };

/**
 * Ask the user where the single self-updating auto-backup file should live and
 * return a PERSISTENT target for it. Android: the user picks a folder via SAF
 * (grants a persistable URI permission that survives relaunch/reboot) and we
 * create the backup file there once, returning its content:// URI — every later
 * saveAutoBackup() overwrites that same file. iOS/other: no folder picker, so the
 * file lives at the fixed documentDirectory path; we return an empty uri and just
 * a label. Returns null if the user cancels or no location is available. Throws
 * only on an unexpected SAF failure — the caller surfaces that.
 */
export async function chooseAutoBackupLocation(): Promise<AutoBackupLocation | null> {
  if (Platform.OS === 'android') {
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    const fileUri = await StorageAccessFramework.createFileAsync(
      perm.directoryUri,
      AUTO_BACKUP_BASENAME,
      'application/json'
    );
    return { uri: fileUri, label: safDirectoryLabel(perm.directoryUri) };
  }
  // iOS/other: fixed documentDirectory file, no picker.
  if (getAutoBackupPath()) return { uri: '', label: getAutoBackupLabel() };
  return null;
}

/**
 * Write a full backup (including name) to the persistent auto-backup target and
 * stamp settings.autoBackupLastAt on success. Android: overwrite the user-picked
 * SAF file (settings.autoBackupUri) in place — a single state, no versions. iOS:
 * overwrite the fixed documentDirectory file. Silent on failure — never throws.
 * Called automatically (app background) when autoBackupEnabled is on, and from the
 * "Back up now" button. A no-op on Android until a location has been chosen.
 */
export async function saveAutoBackup(): Promise<void> {
  const { autoBackupUri } = useSettingsStore.getState();
  try {
    const json = JSON.stringify(buildBackup());
    if (autoBackupUri) {
      // Android SAF file the user picked — overwrite in place.
      await StorageAccessFramework.writeAsStringAsync(autoBackupUri, json, { encoding: EncodingType.UTF8 });
    } else {
      const path = getAutoBackupPath();
      if (!path) return; // Android with no chosen location yet — nothing to write to.
      await writeAsStringAsync(path, json, { encoding: EncodingType.UTF8 });
    }
    useSettingsStore.getState().update({ autoBackupLastAt: new Date().toISOString() });
  } catch {
    // Best-effort — a failed write is not surfaced to the user
  }
}

/**
 * Re-exported from lib/fileExport, which owns it now. Kept here because app screens and the
 * two other exporters already import it from this module.
 */
export type { SaveToDeviceResult };

/** The one description of "a backup file", shared by both export flows below. */
function backupFileSpec(): TextFileSpec {
  return {
    basename: `unfocus-backup-${todayStr()}`,
    extension: 'json',
    mime: 'application/json',
    uti: 'public.json',
    dialogTitle: 'UnFocus backup',
  };
}

/**
 * Serialise the whole DB to a JSON file and open the OS share sheet so the user can save it
 * wherever they like. Returns 'unavailable' when the platform has no share sheet. Throws on
 * write failure — the caller surfaces that. The name is REDACTED in this copy; see
 * exportBackupToDevice.
 */
export async function exportBackup(): Promise<'shared' | 'unavailable'> {
  return shareTextFile(JSON.stringify(buildBackup({ redactName: true })), backupFileSpec());
}

/**
 * Serialise the whole DB and write it as a real file directly to a
 * user-visible location, instead of routing through the OS share sheet.
 * Android: user picks a folder via SAF, file is created there. iOS: written
 * into the app's document directory (visible under Files → On My iPhone/iPad
 * → UnFocus), falling back to the share sheet if that write fails. Throws on
 * unexpected write failure — the caller surfaces that.
 */
export async function exportBackupToDevice(): Promise<SaveToDeviceResult> {
  // NOT redacted, unlike exportBackup above: a file the user is deliberately filing away
  // on their own device is their own data, where a shared one may not stay theirs.
  return saveTextToDevice(JSON.stringify(buildBackup()), backupFileSpec());
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
