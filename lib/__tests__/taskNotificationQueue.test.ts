/**
 * taskNotificationQueue.test.ts — two quick edits to one task can't leave a stale reminder.
 *
 * Task reminders are cancel-everything-then-schedule over many awaits, fired unawaited. Until
 * 2026-09-29 two edits could interleave and the first edit's schedules landed after the second
 * edit's cancel. lib/notifications.ts now queues operations per task id. The fake native layer
 * below yields on every call, which is what exposed the interleave.
 */
import { scheduleWeeklyTaskNotifications, type WeeklyTaskOccurrence } from '@/lib/notifications';

const mockScheduled = new Set<string>();
const mockTick = () => new Promise<void>((r) => setTimeout(r, 0));

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly', DAILY: 'daily' },
  setNotificationHandler: () => {},
  scheduleNotificationAsync: async ({ identifier }: { identifier: string }) => {
    await mockTick();
    mockScheduled.add(identifier);
    return identifier;
  },
  cancelScheduledNotificationAsync: async (identifier: string) => {
    await mockTick();
    mockScheduled.delete(identifier);
  },
}));

const occ = (day: number): WeeklyTaskOccurrence => ({
  suffix: `s${day}`,
  weekday: day + 2,
  hour: 9,
  minute: 0,
  content: { title: 't', body: 'b' },
});

test('the later edit wins completely — no reminder from the earlier edit survives', async () => {
  const a = scheduleWeeklyTaskNotifications('t1', [occ(0), occ(3)]); // Mon + Thu
  const b = scheduleWeeklyTaskNotifications('t1', [occ(0)]); // Thu removed
  await Promise.all([a, b]);
  expect([...mockScheduled].sort()).toEqual(['task-t1-s0']);
});

test('different tasks are not held up by each other', async () => {
  mockScheduled.clear();
  await Promise.all([
    scheduleWeeklyTaskNotifications('x', [occ(1)]),
    scheduleWeeklyTaskNotifications('y', [occ(2)]),
  ]);
  expect([...mockScheduled].sort()).toEqual(['task-x-s1', 'task-y-s2']);
});
