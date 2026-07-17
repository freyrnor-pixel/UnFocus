/**
 * taskCalendar.web.ts — web preview stub for lib/taskCalendar.ts.
 *
 * expo-calendar has no web implementation, so every sync/cancel call is a no-op
 * here; the pure eligibility/detail-builder helpers still work identically
 * (they don't touch any native module) so callers don't need to branch.
 *
 * Connections:
 *   Imports → store/useTaskStore (Task type only)
 *   Used by → store/useTaskStore.ts (Metro resolves this over lib/taskCalendar.ts on web)
 *   Data    → none
 */
import type { Task } from '@/store/useTaskStore';

export type TaskCalendarSettings = { calendarSyncEnabled: boolean };

export function isCalendarEligible(task: Pick<Task, 'recurring' | 'time'>): boolean {
  return task.recurring === 'none' && !!task.time;
}

export function buildEventDetails(
  task: Pick<Task, 'title' | 'date' | 'time' | 'taskType' | 'durationMinutes' | 'hint'>
): { title: string; startDate: Date; endDate: Date; notes?: string } | null {
  if (!task.time) return null;
  const start = new Date(`${task.date}T${task.time}:00`);
  if (isNaN(start.getTime())) return null;
  const durationMin = task.taskType === 'time-box' ? (task.durationMinutes ?? 30) : 30;
  const end = new Date(start.getTime() + durationMin * 60000);
  return { title: task.title, startDate: start, endDate: end, notes: task.hint || undefined };
}

export async function syncTaskCalendarEvent(_task: Task, _s: TaskCalendarSettings): Promise<string | null> {
  return null;
}

export async function cancelTaskCalendarEvent(_eventId: string): Promise<void> {}
