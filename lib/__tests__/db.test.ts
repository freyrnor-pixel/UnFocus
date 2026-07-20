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
import { pruneOldData } from '@/lib/db';
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
