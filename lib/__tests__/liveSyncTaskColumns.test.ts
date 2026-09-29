/**
 * liveSyncTaskColumns.test.ts — a synced task must arrive with WHEN and HOW OFTEN it happens.
 *
 * Until 2026-09-29 `has_start_date`, `finish_time` and the five recurrence-shape columns were
 * missing from lib/liveSync.ts's task whitelist, so a peer inserted every synced task with the
 * column DEFAULTs: dated tasks landed undated (Whenever), every-other-week became weekly, a
 * monthly task moved to the 1st. This drives the real buildDelta over a mocked row rather
 * than matching source text, so it fails if the columns stop reaching the wire.
 */
import { applyDelta, buildDelta, monotonicStamp, parseDelta, touchRow } from '@/lib/liveSync';

const mockGetFirstSync = jest.fn();
const mockRunSync = jest.fn();
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { getFirstSync: (...a: unknown[]) => mockGetFirstSync(...a), runSync: (...a: unknown[]) => mockRunSync(...a) },
}));


const SHAPE_COLUMNS = {
  has_start_date: 1,
  finish_time: '11:30',
  recurring_week_interval: 2,
  recurring_monthly_mode: 'ordinal',
  recurring_month_day: 17,
  recurring_month_ordinal: 'last',
  recurring_month_weekday: 4,
};

test('buildDelta carries the schedule-shape columns of a task', () => {
  mockGetFirstSync.mockReturnValue({
    id: 't1', title: 'Bins', task_date: '2026-10-01', updated_at: 'u', origin_device_id: 'd', deleted_at: null,
    ...SHAPE_COLUMNS,
  });
  const delta = buildDelta('tasks', 't1');
  expect(delta).not.toBeNull();
  expect(delta!.fields).toEqual(expect.objectContaining(SHAPE_COLUMNS));
});

test('done_at stays device-local', () => {
  mockGetFirstSync.mockReturnValue({ id: 't1', title: 'x', done_at: '09:00', updated_at: 'u', origin_device_id: 'd' });
  expect(buildDelta('tasks', 't1')!.fields).not.toHaveProperty('done_at');
});

test('done_on syncs (a monthly task resets the same way on both phones)', () => {
  mockGetFirstSync.mockReturnValue({ id: 't1', title: 'x', done_on: '2026-09-01', updated_at: 'u', origin_device_id: 'd' });
  expect(buildDelta('tasks', 't1')!.fields).toHaveProperty('done_on', '2026-09-01');
});

describe('task_steps are a sync table (2026-09-29)', () => {
  test('parseDelta accepts them', () => {
    expect(
      parseDelta({ table: 'task_steps', id: 's1', updatedAt: 'u', originDeviceId: 'd', deletedAt: null, fields: {} })
    ).not.toBeNull();
  });
  test('the step columns reach the wire', () => {
    mockGetFirstSync.mockReturnValue({ id: 's1', task_id: 't1', title: 'Buy tape', done: 1, order_index: 2, updated_at: 'u' });
    expect(buildDelta('task_steps', 's1')!.fields).toEqual({ task_id: 't1', title: 'Buy tape', done: 1, order_index: 2 });
  });
});

describe('monotonicStamp — a local edit always beats the version it edits', () => {
  const NOW = '2026-09-29T10:00:00.000Z';
  test('plain now when the row is older', () => {
    mockGetFirstSync.mockReturnValue({ u: '2026-09-29T09:00:00.000Z' });
    expect(monotonicStamp('tasks', 't1', NOW)).toBe(NOW);
  });
  test('1 ms past a row stamped AHEAD of this clock (a peer whose clock runs fast)', () => {
    mockGetFirstSync.mockReturnValue({ u: '2026-09-29T10:05:00.000Z' });
    expect(monotonicStamp('tasks', 't1', NOW)).toBe('2026-09-29T10:05:00.001Z');
  });
  test('touchRow writes that stamp', () => {
    mockRunSync.mockClear();
    mockGetFirstSync.mockReturnValue({ u: '2026-09-29T10:05:00.000Z' });
    touchRow('tasks', 't1', 'me', NOW);
    expect(mockRunSync.mock.calls[0][1][0]).toBe('2026-09-29T10:05:00.001Z');
  });
});

describe('applyDelta refuses to resurrect a pruned row from an ancient delta', () => {
  const delta = (updatedAt: string) => ({
    table: 'tasks' as const, id: 'gone', updatedAt, originDeviceId: 'p', deletedAt: null,
    fields: { title: 'x', task_date: '2025-01-01' },
  });
  const NOW_MS = Date.parse('2026-09-29T00:00:00Z');
  test('older than the retention window, no local row → ignored', () => {
    mockRunSync.mockClear();
    mockGetFirstSync.mockReturnValue(null);
    expect(applyDelta(delta('2025-06-01T00:00:00.000Z'), NOW_MS)).toBe(false);
    expect(mockRunSync).not.toHaveBeenCalled();
  });
  test('recent, no local row → inserted', () => {
    mockRunSync.mockClear();
    mockGetFirstSync.mockReturnValue(null);
    expect(applyDelta(delta('2026-09-28T00:00:00.000Z'), NOW_MS)).toBe(true);
  });
});
