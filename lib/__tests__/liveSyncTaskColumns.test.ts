/**
 * liveSyncTaskColumns.test.ts — a synced task must arrive with WHEN and HOW OFTEN it happens.
 *
 * Until 2026-09-29 `has_start_date`, `finish_time` and the five recurrence-shape columns were
 * missing from lib/liveSync.ts's task whitelist, so a peer inserted every synced task with the
 * column DEFAULTs: dated tasks landed undated (Whenever), every-other-week became weekly, a
 * monthly task moved to the 1st. This drives the real buildDelta over a mocked row rather
 * than matching source text, so it fails if the columns stop reaching the wire.
 */
import { buildDelta } from '@/lib/liveSync';

const mockGetFirstSync = jest.fn();
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { getFirstSync: (...a: unknown[]) => mockGetFirstSync(...a), runSync: jest.fn() },
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
