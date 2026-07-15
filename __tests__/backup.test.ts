/**
 * backup.test.ts — unit tests for lib/backup.ts restoreBackup().
 *
 * restoreBackup is the one destructive path (replace-ALL-data), so the contract
 * that matters is: every live table is cleared first, only tables present in the
 * live schema are repopulated, and only columns that still exist are written
 * (unknown tables/columns from an older/newer backup are skipped, never crash).
 * We drive it with a db mock whose getAllSync answers sqlite_master + PRAGMA
 * table_info, and assert the INSERT/DELETE calls it makes.
 */
const mockRunSync = jest.fn();
const mockExecSync = jest.fn();

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    // sqlite_master → live tables; PRAGMA table_info("X") → that table's columns.
    getAllSync: jest.fn((sql: string) => {
      if (sql.includes('sqlite_master')) return [{ name: 'tasks' }, { name: 'settings' }];
      if (sql.includes('table_info("tasks")')) return [{ name: 'id' }, { name: 'title' }];
      if (sql.includes('table_info("settings")')) return [{ name: 'id' }, { name: 'user_name' }];
      return [];
    }),
    getFirstSync: jest.fn(() => ({ user_version: 5 })),
    runSync: (...args: unknown[]) => mockRunSync(...args),
    execSync: (...args: unknown[]) => mockExecSync(...args),
    withTransactionSync: (fn: () => void) => fn(),
  },
}));

import { restoreBackup, BackupFile } from '@/lib/backup';

const runSync = mockRunSync;
const execSync = mockExecSync;

beforeEach(() => {
  runSync.mockClear();
  execSync.mockClear();
});

function backup(tables: BackupFile['tables']): BackupFile {
  return {
    magic: 'unfocus-backup',
    schemaVersion: 5,
    appVersion: '1.0.0',
    exportedAt: 'x',
    tables,
  };
}

describe('restoreBackup', () => {
  it('clears every live table before repopulating', () => {
    restoreBackup(backup({ tasks: [] }));
    const deletes = execSync.mock.calls
      .map((c) => c[0])
      .filter((s: string) => s.startsWith('DELETE'));
    expect(deletes).toEqual(
      expect.arrayContaining(['DELETE FROM "tasks"', 'DELETE FROM "settings"'])
    );
  });

  it('inserts only columns that exist in the live schema (drops unknown columns)', () => {
    restoreBackup(backup({ tasks: [{ id: '1', title: 'A', removed_col: 'x' }] }));
    const inserts = runSync.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO "tasks"'));
    expect(inserts).toHaveLength(1);
    // removed_col is not a live column → excluded from both the SQL and the values.
    expect(inserts[0][0]).toContain('"id"');
    expect(inserts[0][0]).toContain('"title"');
    expect(inserts[0][0]).not.toContain('removed_col');
    expect(inserts[0][1]).toEqual(['1', 'A']);
  });

  it('skips tables that no longer exist in the live schema', () => {
    restoreBackup(backup({ ghost_table: [{ id: '1' }], tasks: [{ id: '2', title: 'B' }] }));
    const insertedTables = runSync.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.startsWith('INSERT INTO'));
    expect(insertedTables.some((s) => s.includes('"ghost_table"'))).toBe(false);
    expect(insertedTables.some((s) => s.includes('"tasks"'))).toBe(true);
  });

  it('skips rows whose columns are all unknown, without crashing', () => {
    restoreBackup(backup({ tasks: [{ only_unknown: 'x' }] }));
    const inserts = runSync.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO "tasks"'));
    expect(inserts).toHaveLength(0);
  });

  it('toggles foreign keys off then back on around the swap', () => {
    restoreBackup(backup({ tasks: [] }));
    const pragmas = execSync.mock.calls
      .map((c) => c[0])
      .filter((s: string) => s.includes('foreign_keys'));
    expect(pragmas[0]).toBe('PRAGMA foreign_keys = OFF');
    expect(pragmas[pragmas.length - 1]).toBe('PRAGMA foreign_keys = ON');
  });
});
