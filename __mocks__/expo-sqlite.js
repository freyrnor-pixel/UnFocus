/**
 * Manual mock for expo-sqlite (auto-applied by Jest for this node_modules package).
 *
 * The headless node test environment has no native SQLite, so importing lib/db.ts
 * (which calls SQLite.openDatabaseSync at module load) otherwise throws
 * "NativeDatabase is not a constructor" and takes down any suite that transitively
 * imports it — even ones that only test pure, DB-free functions (e.g. liveSync's
 * incomingWins/parseDelta).
 *
 * This stub lets those modules import cleanly. Tests that need real query behavior
 * should mock '@/lib/db' directly (see __tests__/dataAccess.test.ts) rather than
 * relying on this no-op handle.
 */
const makeDb = () => ({
  execSync: jest.fn(),
  getAllSync: jest.fn(() => []),
  getFirstSync: jest.fn(() => null),
  runSync: jest.fn(),
  withTransactionSync: (fn) => (typeof fn === 'function' ? fn() : undefined),
});

module.exports = {
  openDatabaseSync: jest.fn(() => makeDb()),
};
