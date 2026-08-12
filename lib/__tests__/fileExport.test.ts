/**
 * fileExport.test.ts — the two export flows, once, for all three exporters.
 *
 * lib/backup.ts, lib/aiSetupGuide.ts and lib/designLabExport.ts each carried their own copy
 * of this logic until 2026-08-12, and none of the three was covered: the platform ladder
 * (Android SAF → iOS documentDirectory → share sheet) was only ever exercised by hand on a
 * device. Now that there is one implementation, it is worth pinning — especially the two
 * behaviours a reader would most plausibly "tidy" away:
 *
 *   1. **`basename` carries no extension on the Android path.** `createFileAsync` derives
 *      the extension from the MIME type and appends it, so passing 'x.json' yields
 *      'x.json.json'. The iOS and cache paths DO append it by hand.
 *   2. **A failed iOS write falls THROUGH to the share sheet** rather than propagating.
 *      A sandbox that refuses the write should still leave the user a way to get the file
 *      out — dropping the try/catch would turn a recoverable case into a thrown error.
 */
import { Platform } from 'react-native';

const mockShareAsync = jest.fn();
const mockIsAvailableAsync = jest.fn(async () => true);
const mockWriteAsStringAsync = jest.fn(async () => undefined);
const mockRequestDirectoryPermissionsAsync = jest.fn();
const mockCreateFileAsync = jest.fn(async () => 'content://tree/primary%3ADownload/doc%3A42');
const mockSafWriteAsStringAsync = jest.fn(async () => undefined);

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: (...a: unknown[]) => mockIsAvailableAsync(...(a as [])),
  shareAsync: (...a: unknown[]) => mockShareAsync(...a),
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...a: unknown[]) => mockWriteAsStringAsync(...(a as [])),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: (...a: unknown[]) =>
      mockRequestDirectoryPermissionsAsync(...(a as [])),
    createFileAsync: (...a: unknown[]) => mockCreateFileAsync(...(a as [])),
    writeAsStringAsync: (...a: unknown[]) => mockSafWriteAsStringAsync(...(a as [])),
  },
}));

import { safDirectoryLabel, saveTextToDevice, shareTextFile, TextFileSpec } from '@/lib/fileExport';

const SPEC: TextFileSpec = {
  basename: 'unfocus-backup-2026-08-12',
  extension: 'json',
  mime: 'application/json',
  uti: 'public.json',
  dialogTitle: 'UnFocus backup',
};

function setPlatform(os: 'android' | 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCreateFileAsync.mockResolvedValue('content://tree/primary%3ADownload/doc%3A42');
});

describe('safDirectoryLabel', () => {
  it.each([
    ['a SAF tree URI', 'content://com.android.providers/tree/primary%3ADownload', 'Download'],
    ['a nested folder', 'content://x/tree/primary%3ADocuments%2FUnFocus', 'Documents/UnFocus'],
  ])('reduces %s to its human-readable tail', (_label, uri, expected) => {
    expect(safDirectoryLabel(uri)).toBe(expected);
  });

  // Documenting what it actually does, not an idealised contract: with no /tree/ segment
  // the whole URI falls through to the `split(':').pop()`, which strips the scheme too. It
  // is labelled best-effort and only ever receives SAF content://…/tree/… URIs, so this is
  // a curiosity rather than a bug — but it should be a deliberate curiosity.
  it('degrades to the post-colon tail for a URI with no /tree/ segment', () => {
    expect(safDirectoryLabel('file:///somewhere')).toBe('///somewhere');
  });

  it('never throws on input it cannot decode', () => {
    expect(() => safDirectoryLabel('%%%not-a-uri')).not.toThrow();
    expect(safDirectoryLabel('%%%not-a-uri')).toBe('%%%not-a-uri');
  });
});

describe('shareTextFile', () => {
  it('writes into the cache dir under basename.extension and opens the share sheet', async () => {
    setPlatform('ios');
    await expect(shareTextFile('{}', SPEC)).resolves.toBe('shared');
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/unfocus-backup-2026-08-12.json',
      '{}',
      { encoding: 'utf8' },
    );
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/unfocus-backup-2026-08-12.json', {
      mimeType: 'application/json',
      dialogTitle: 'UnFocus backup',
      UTI: 'public.json',
    });
  });

  it('reports unavailable, and writes nothing, when there is no share sheet', async () => {
    setPlatform('web');
    mockIsAvailableAsync.mockResolvedValue(false);
    await expect(shareTextFile('{}', SPEC)).resolves.toBe('unavailable');
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });
});

describe('saveTextToDevice — Android', () => {
  beforeEach(() => setPlatform('android'));

  it('passes basename WITHOUT an extension to createFileAsync', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: 'content://x/tree/primary%3ADownload',
    });
    const result = await saveTextToDevice('{}', SPEC);
    // The extension comes from the MIME type on this path; appending it here would
    // produce "…json.json" on the user's device.
    expect(mockCreateFileAsync).toHaveBeenCalledWith(
      'content://x/tree/primary%3ADownload',
      'unfocus-backup-2026-08-12',
      'application/json',
    );
    expect(result).toEqual({ status: 'saved', location: 'Download' });
  });

  it('reports canceled, and writes nothing, when the folder picker is dismissed', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(saveTextToDevice('{}', SPEC)).resolves.toEqual({ status: 'canceled' });
    expect(mockCreateFileAsync).not.toHaveBeenCalled();
    expect(mockSafWriteAsStringAsync).not.toHaveBeenCalled();
  });
});

describe('saveTextToDevice — iOS', () => {
  beforeEach(() => setPlatform('ios'));

  it('writes into the document directory, extension appended', async () => {
    await expect(saveTextToDevice('{}', SPEC)).resolves.toEqual({
      status: 'saved',
      location: 'Files → On My iPhone/iPad → UnFocus',
    });
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      'file:///docs/unfocus-backup-2026-08-12.json',
      '{}',
      { encoding: 'utf8' },
    );
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('falls through to the share sheet when that write is refused, rather than throwing', async () => {
    mockWriteAsStringAsync.mockRejectedValueOnce(new Error('sandbox'));
    await expect(saveTextToDevice('{}', SPEC)).resolves.toEqual({
      status: 'saved',
      location: 'the location you chose',
    });
    expect(mockShareAsync).toHaveBeenCalled();
  });
});

describe('saveTextToDevice — no share sheet available', () => {
  it('reports unavailable once every rung of the ladder is exhausted', async () => {
    setPlatform('web');
    mockIsAvailableAsync.mockResolvedValue(false);
    await expect(saveTextToDevice('{}', SPEC)).resolves.toEqual({ status: 'unavailable' });
  });
});
