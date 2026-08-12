/**
 * fileExport.ts — getting a text file out of the app, the two ways the app offers.
 *
 * `shareTextFile` opens the OS share sheet; `saveTextToDevice` writes a real file to a
 * user-visible location instead. Both take the finished text and a description of the file;
 * neither knows or cares what is in it.
 *
 * **Why this exists.** lib/backup.ts, lib/aiSetupGuide.ts and lib/designLabExport.ts each
 * carried their own copy of both flows plus a character-for-character identical
 * `safDirectoryLabel` — about 110 lines, differing only in filename, MIME type, UTI and
 * dialog title. The copies knew they were copies: aiSetupGuide's said it mirrored backup's
 * "exactly", designLabExport's said it mirrored aiSetupGuide's "exactly", and
 * `SaveToDeviceResult` was already shared out of backup.ts — the extraction had been
 * started and stopped one step short. A fourth export would have been a fourth copy.
 *
 * The platform ladder both flows walk, and the reason for each rung:
 *   1. **Android** — `StorageAccessFramework`: the user picks a folder, the file is created
 *      there. Android has no app-visible "Files" area worth writing to blindly.
 *   2. **iOS** — `documentDirectory`, which surfaces as Files → On My iPhone/iPad → UnFocus.
 *      Wrapped in a try/catch that falls THROUGH to the share sheet rather than failing:
 *      a sandbox that refuses the write should still leave the user a way out.
 *   3. **Share sheet** — the last resort on both, and the only path on web.
 *
 * Connections:
 *   Imports → expo-file-system, expo-sharing, react-native (Platform)
 *   Used by → lib/backup.ts (exportBackup / exportBackupToDevice, and safDirectoryLabel for
 *             chooseAutoBackupLocation), lib/aiSetupGuide.ts (exportAiSetupGuide /
 *             …ToDevice), lib/designLabExport.ts (exportDesignLab / …ToDevice)
 *   Data    → writes files only; touches no store, no DB, no settings
 *
 * Edit notes:
 *   - **`basename` carries no extension and that is load-bearing.** Android's
 *     `createFileAsync` derives the extension from the MIME type and appends it itself, so
 *     passing "backup.json" there yields "backup.json.json". The iOS and cache paths build
 *     `${basename}.${extension}` by hand. Keep the two fields separate.
 *   - **`saveTextToDevice` does NOT own the auto-backup path.** lib/backup.ts's
 *     `chooseAutoBackupLocation` needs the created file's URI back so later writes can
 *     overwrite that same file in place; this returns only a display label. It shares
 *     `safDirectoryLabel` with this module and nothing else — don't fold it in.
 *   - The caller supplies the finished text, so a difference in CONTENT between the two
 *     flows stays the caller's business. lib/backup.ts relies on this: its share-sheet
 *     export redacts the user's name and its save-to-device export does not.
 */
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
  EncodingType,
  StorageAccessFramework,
} from 'expo-file-system/legacy';

/** What a save-to-device attempt did. 'canceled' means the user dismissed the folder picker. */
export type SaveToDeviceResult =
  | { status: 'saved'; location: string }
  | { status: 'canceled' }
  | { status: 'unavailable' };

/** Everything that differs between one exported file and the next. */
export type TextFileSpec = {
  /** Filename WITHOUT an extension — see the edit note on why. */
  basename: string;
  /** Extension without the leading dot, e.g. 'json'. */
  extension: string;
  /** MIME type, e.g. 'application/json'. Android derives the extension from this. */
  mime: string;
  /** Apple Uniform Type Identifier, e.g. 'public.json'. */
  uti: string;
  /** Title shown on the OS share sheet. */
  dialogTitle: string;
};

/** Best-effort human-readable label for a SAF directory URI, e.g. "Download". */
export function safDirectoryLabel(dirUri: string): string {
  try {
    const decoded = decodeURIComponent(dirUri);
    const afterTree = decoded.split('/tree/')[1] ?? decoded;
    return afterTree.split(':').pop() || decoded;
  } catch {
    return dirUri;
  }
}

/** Write `text` into the cache dir and hand the file to the OS share sheet. */
async function writeToCacheAndShare(text: string, file: TextFileSpec): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = `${cacheDirectory}${file.basename}.${file.extension}`;
  await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    mimeType: file.mime,
    dialogTitle: file.dialogTitle,
    UTI: file.uti,
  });
  return true;
}

/**
 * Write `text` to the cache dir and open the OS share sheet so the user can put it
 * wherever they like. Returns 'unavailable' when the platform has no share sheet.
 * Throws on write failure — the caller surfaces that.
 */
export async function shareTextFile(text: string, file: TextFileSpec): Promise<'shared' | 'unavailable'> {
  return (await writeToCacheAndShare(text, file)) ? 'shared' : 'unavailable';
}

/**
 * Write `text` as a real file to a user-visible location rather than routing it through the
 * share sheet. Walks the three-rung platform ladder in this module's header. Throws on an
 * unexpected write failure — the caller surfaces that.
 */
export async function saveTextToDevice(text: string, file: TextFileSpec): Promise<SaveToDeviceResult> {
  if (Platform.OS === 'android') {
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return { status: 'canceled' };
    const fileUri = await StorageAccessFramework.createFileAsync(
      perm.directoryUri,
      file.basename,
      file.mime
    );
    await StorageAccessFramework.writeAsStringAsync(fileUri, text, { encoding: EncodingType.UTF8 });
    return { status: 'saved', location: safDirectoryLabel(perm.directoryUri) };
  }

  if (Platform.OS === 'ios' && documentDirectory) {
    try {
      const uri = `${documentDirectory}${file.basename}.${file.extension}`;
      await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });
      return { status: 'saved', location: 'Files → On My iPhone/iPad → UnFocus' };
    } catch {
      // Fall through to the share sheet below — a refused sandbox write should still
      // leave the user a way to get the file out.
    }
  }

  if (!(await writeToCacheAndShare(text, file))) return { status: 'unavailable' };
  return { status: 'saved', location: 'the location you chose' };
}
