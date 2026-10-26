/**
 * backupPassword.test.ts — the optional backup password (2026-10-26) as lib/backup.ts uses it:
 * never inside a backup, applied on every export, adopted on restore.
 *
 * Connections:
 *   Imports → lib/backup, lib/backupCrypto, store/useSettingsStore, lib/db (mocked)
 *   Used by → jest
 *   Data    → none (db mocked)
 */
import { buildBackup, restoreBackup, serializeBackup, unlockBackup, BackupFile } from '@/lib/backup';
import { isEncryptedBackup } from '@/lib/backupCrypto';
import { useSettingsStore } from '@/store/useSettingsStore';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)) }));

const mockRunSync = jest.fn();
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn((sql: string) => {
      if (sql.includes('sqlite_master')) return [{ name: 'settings' }];
      if (sql.includes('table_info("settings")')) return [{ name: 'id' }, { name: 'user_name' }, { name: 'backup_password' }];
      if (sql.startsWith('SELECT * FROM "settings"')) return [{ id: 1, user_name: 'Sam', backup_password: 'hemmelig' }];
      return [];
    }),
    getFirstSync: jest.fn((sql: string) =>
      sql.includes('device_id') ? { d: 'this-phone' } : sql.includes('backup_password') ? { p: 'old-pw' } : { user_version: 5 },
    ),
    runSync: (...args: unknown[]) => mockRunSync(...args),
    execSync: jest.fn(),
    withTransactionSync: (fn: () => void) => fn(),
  },
}));

beforeEach(() => mockRunSync.mockClear());

describe('backup password', () => {
  it('is never written into a backup', () => {
    const b = buildBackup();
    expect(b.tables.settings[0].backup_password).toBe('');
    expect(JSON.stringify(b)).not.toContain('hemmelig');
  });

  it('serializeBackup: plain without a password, sealed with one, and it opens again', async () => {
    useSettingsStore.setState({ backupPassword: '' } as never);
    const plain = await serializeBackup(buildBackup());
    expect(isEncryptedBackup(plain)).toBe(false);

    useSettingsStore.setState({ backupPassword: 'pw-1' } as never);
    const sealed = await serializeBackup(buildBackup());
    expect(isEncryptedBackup(sealed)).toBe(true);
    expect(sealed).not.toContain('Sam');

    const opened = await unlockBackup(sealed, 'pw-1');
    expect(opened.status).toBe('ok');
    expect(opened.status === 'ok' && opened.password).toBe('pw-1');
    expect((await unlockBackup(sealed, 'nope')).status).toBe('wrongPassword');
  });

  it('restore keeps this phone\'s password, or adopts the one that opened the file', () => {
    const data: BackupFile = { magic: 'unfocus-backup', schemaVersion: 5, appVersion: '', exportedAt: '', tables: { settings: [{ id: 1 }] } };
    restoreBackup(data);
    expect(mockRunSync).toHaveBeenCalledWith('UPDATE settings SET backup_password = ? WHERE id = 1', ['old-pw']);
    mockRunSync.mockClear();
    restoreBackup(data, { password: 'from-file' });
    expect(mockRunSync).toHaveBeenCalledWith('UPDATE settings SET backup_password = ? WHERE id = 1', ['from-file']);
  });
});
