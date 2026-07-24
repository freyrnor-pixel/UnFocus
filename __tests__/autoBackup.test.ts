/**
 * autoBackup.test.ts — unit tests for lib/backup.ts's persistent auto-backup path.
 *
 * The contract that matters: auto-backup must write to a location that SURVIVES
 * uninstall, never the sandbox. So saveAutoBackup() writes to the user-picked SAF
 * file (settings.autoBackupUri) on Android, and to the fixed documentDirectory
 * file on iOS, stamping settings.autoBackupLastAt on success. chooseAutoBackupLocation()
 * creates the single SAF file and returns its content URI + a folder label.
 * We drive it with mocked expo-file-system/legacy + db and assert the write target.
 */
import { Platform } from 'react-native';
import { saveAutoBackup, chooseAutoBackupLocation } from '@/lib/backup';
import { useSettingsStore } from '@/store/useSettingsStore';

const mockWriteAsString = jest.fn().mockResolvedValue(undefined);
const mockSafWrite = jest.fn().mockResolvedValue(undefined);
const mockSafCreate = jest.fn();
const mockSafPerms = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...a: unknown[]) => mockWriteAsString(...a),
  readAsStringAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: (...a: unknown[]) => mockSafPerms(...a),
    createFileAsync: (...a: unknown[]) => mockSafCreate(...a),
    writeAsStringAsync: (...a: unknown[]) => mockSafWrite(...a),
  },
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn((sql: string) => {
      if (sql.includes('sqlite_master')) return [{ name: 'settings' }];
      if (sql.includes('table_info')) return [{ name: 'id' }, { name: 'user_name' }];
      return [];
    }),
    getFirstSync: jest.fn(() => ({ user_version: 5 })),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: (fn: () => void) => fn(),
  },
}));

beforeEach(() => {
  mockWriteAsString.mockClear();
  mockSafWrite.mockClear();
  mockSafCreate.mockClear();
  mockSafPerms.mockClear();
  useSettingsStore.setState({ autoBackupUri: '', autoBackupLabel: '', autoBackupLastAt: '' });
});

describe('saveAutoBackup', () => {
  it('overwrites the user-picked SAF file on Android and stamps last-backed-up', async () => {
    (Platform as { OS: string }).OS = 'android';
    useSettingsStore.setState({ autoBackupUri: 'content://tree/x/doc/unfocus-auto-backup.json' });

    await saveAutoBackup();

    expect(mockSafWrite).toHaveBeenCalledTimes(1);
    expect(mockSafWrite.mock.calls[0][0]).toBe('content://tree/x/doc/unfocus-auto-backup.json');
    // Sandbox path is never used when a SAF target exists.
    expect(mockWriteAsString).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().autoBackupLastAt).not.toBe('');
  });

  it('writes the fixed documentDirectory file on iOS (no SAF uri)', async () => {
    (Platform as { OS: string }).OS = 'ios';

    await saveAutoBackup();

    expect(mockWriteAsString).toHaveBeenCalledTimes(1);
    expect(mockWriteAsString.mock.calls[0][0]).toBe('file:///docs/unfocus-auto-backup.json');
    expect(mockSafWrite).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().autoBackupLastAt).not.toBe('');
  });

  it('is a no-op on Android with no chosen location', async () => {
    (Platform as { OS: string }).OS = 'android';

    await saveAutoBackup();

    expect(mockWriteAsString).not.toHaveBeenCalled();
    expect(mockSafWrite).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().autoBackupLastAt).toBe('');
  });
});

describe('chooseAutoBackupLocation', () => {
  it('creates the SAF file and returns its uri + folder label on Android', async () => {
    (Platform as { OS: string }).OS = 'android';
    mockSafPerms.mockResolvedValueOnce({ granted: true, directoryUri: 'content://tree/primary:Download' });
    mockSafCreate.mockResolvedValueOnce('content://tree/primary:Download/doc/unfocus-auto-backup.json');

    const loc = await chooseAutoBackupLocation();

    expect(loc).toEqual({
      uri: 'content://tree/primary:Download/doc/unfocus-auto-backup.json',
      label: 'Download',
    });
  });

  it('returns null when the user denies the Android folder permission', async () => {
    (Platform as { OS: string }).OS = 'android';
    mockSafPerms.mockResolvedValueOnce({ granted: false });

    expect(await chooseAutoBackupLocation()).toBeNull();
    expect(mockSafCreate).not.toHaveBeenCalled();
  });

  it('returns a label with an empty uri on iOS (fixed documentDirectory file)', async () => {
    (Platform as { OS: string }).OS = 'ios';

    const loc = await chooseAutoBackupLocation();

    expect(loc?.uri).toBe('');
    expect(loc?.label).toContain('Files');
    expect(mockSafPerms).not.toHaveBeenCalled();
  });
});
