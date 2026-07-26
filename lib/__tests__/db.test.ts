/**
 * db.test.ts — unit test for lib/db.ts's pruneOldData(), specifically the tasks
 * DELETE query (2026-07-20 long-run health pass).
 *
 * pruneOldData() is now actually called (see app/_layout.tsx), so a wrong WHERE
 * clause here would silently delete live data — an unfinished backlog task or an
 * undated Whenever task — on every cold start. 'expo-sqlite' is auto-mocked
 * (__mocks__/expo-sqlite.js) so lib/sqlite.ts's `db` handle is a jest.fn()-based
 * stub; this asserts on the exact SQL text and params passed to its runSync,
 * rather than exercising real SQLite semantics (not available headless).
 */
import { initDb, pruneOldData } from '@/lib/db';
import { db } from '@/lib/sqlite';

const mockRunSync = db.runSync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('pruneOldData — tasks query', () => {
  it('only deletes non-recurring, dated, DONE tasks past the cutoff', () => {
    pruneOldData();
    const tasksCall = mockRunSync.mock.calls.find(([sql]: [string]) => sql.includes('FROM tasks'));
    expect(tasksCall).toBeDefined();
    const [sql, params] = tasksCall!;
    // Must gate on all three: non-recurring, has a real start date, and done —
    // dropping any of these would delete live backlog/Whenever/recurring data.
    expect(sql).toContain("recurring = 'none'");
    expect(sql).toContain('has_start_date = 1');
    expect(sql).toContain('done = 1');
    expect(sql).toContain('task_date < ?');
    expect(params).toHaveLength(1);
    // Cutoff is a YYYY-MM-DD string ~365 days back.
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('never blocks startup if a delete throws', () => {
    mockRunSync.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => pruneOldData()).not.toThrow();
  });
});

/**
 * Feature opt-in migrations — ORIGINAL commit (2026-07-25 settings reorganization).
 *
 * Migrations are an append-only log (PRAGMA user_version indexes into the array), so this
 * commit's lines can never be edited or removed — only corrected by a later append. The
 * describe block below this one covers the same-day follow-up that changed the actual
 * final behaviour; this block just pins down that the original lines are still present
 * verbatim, which the follow-up's correctness depends on.
 */
describe('feature opt-in migrations (original)', () => {
  const FLAGS = ['feature_goals', 'feature_sharing', 'feature_scan', 'feature_food', 'feature_automations'];

  function migrationSql(): string[] {
    initDb();
    return (db.execSync as jest.Mock).mock.calls.map(([sql]: [string]) => sql);
  }

  it.each(FLAGS)('adds %s defaulting to 0', (col) => {
    expect(migrationSql()).toContain(`ALTER TABLE settings ADD COLUMN ${col} INTEGER DEFAULT 0`);
  });

  it('back-fills every flag to 1 for users who already finished onboarding', () => {
    const backfill = migrationSql().find((sql) => sql.startsWith('UPDATE settings SET feature_goals'));
    expect(backfill).toBeDefined();
    for (const col of FLAGS) expect(backfill).toContain(`${col} = 1`);
    expect(backfill).toContain('WHERE setup_complete = 1');
  });

  it('runs the back-fill after the columns it updates', () => {
    const sql = migrationSql();
    const lastAlter = Math.max(...FLAGS.map((c) => sql.findIndex((s) => s.includes(`ADD COLUMN ${c}`))));
    const backfill = sql.findIndex((s) => s.startsWith('UPDATE settings SET feature_goals'));
    expect(backfill).toBeGreaterThan(lastAlter);
  });

  it('contains the original (superseded) migration flipping Energy off for fresh installs', () => {
    // This line's effect is reversed by the follow-up migration below — kept here only
    // because the array is append-only. Do not read this as current behaviour.
    expect(migrationSql()).toContain('UPDATE settings SET energy_system_enabled = 0 WHERE setup_complete = 0');
  });
});

/**
 * Defaults-revision follow-up migrations (2026-07-25, same day as the original commit).
 *
 * Maintainer feedback after the initial ship: Energy and Goals should be on by default
 * after all (still real toggles), and Scan & receipts / Food & recipes should be
 * permanently on, not a toggle at all. Since the original migrations above can't be
 * edited, these are corrective UPDATEs appended after them — each must both exist AND run
 * after the line it corrects, or the fix has no effect for anyone who already applied the
 * original migration.
 */
describe('feature opt-in migrations (defaults-revision follow-up)', () => {
  function migrationSql(): string[] {
    initDb();
    return (db.execSync as jest.Mock).mock.calls.map(([sql]: [string]) => sql);
  }

  it('reverses the Energy flip-off for every install, regardless of setup_complete', () => {
    const sql = migrationSql();
    const flipOff = sql.indexOf('UPDATE settings SET energy_system_enabled = 0 WHERE setup_complete = 0');
    const flipBackOn = sql.indexOf('UPDATE settings SET energy_system_enabled = 1 WHERE setup_complete = 0');
    expect(flipOff).toBeGreaterThanOrEqual(0);
    expect(flipBackOn).toBeGreaterThan(flipOff);
  });

  it('turns Goals on for every install, unconditionally (no WHERE clause)', () => {
    const sql = migrationSql();
    const backfill = sql.findIndex((s) => s.startsWith('UPDATE settings SET feature_goals') && s.includes('feature_sharing'));
    const goalsOnForEveryone = sql.indexOf('UPDATE settings SET feature_goals = 1');
    expect(goalsOnForEveryone).toBeGreaterThanOrEqual(0);
    // Must be the bare "= 1", not the original multi-column back-fill line re-matched.
    expect(sql[goalsOnForEveryone]).not.toContain('feature_sharing');
    expect(goalsOnForEveryone).toBeGreaterThan(backfill);
  });

  it('turns Scan & receipts and Food & recipes on for every install, unconditionally', () => {
    const sql = migrationSql();
    expect(sql).toContain('UPDATE settings SET feature_scan = 1, feature_food = 1');
  });

  /**
   * 2026-07-26: Energy stops being a toggle too — "always on, just on 0 by default".
   * Must be unconditional AND last, since two earlier lines flip the same column on a
   * `WHERE setup_complete = 0` condition; landing before either would leave a fresh
   * install on whatever they set.
   */
  it('pins Energy on for every install, after both earlier conditional flips', () => {
    const sql = migrationSql();
    const pinned = sql.indexOf('UPDATE settings SET energy_system_enabled = 1');
    expect(pinned).toBeGreaterThanOrEqual(0);
    // The bare "= 1", not the earlier `WHERE setup_complete = 0` line re-matched.
    expect(sql[pinned]).not.toContain('WHERE');
    const conditionalFlips = sql
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => line.includes('energy_system_enabled') && line.includes('WHERE'))
      .map(({ i }) => i);
    expect(conditionalFlips.length).toBe(2);
    conditionalFlips.forEach((i) => expect(pinned).toBeGreaterThan(i));
  });
});
