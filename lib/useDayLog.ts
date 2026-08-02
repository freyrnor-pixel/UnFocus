/**
 * useDayLog.ts — the store-reading wrapper around lib/dayLog.ts.
 *
 * Same split as lib/useGrowth.ts vs lib/growth.ts, and lib/useSurfaceLayout.ts vs
 * lib/cardLayout.ts: every Zustand read lives here, all the arithmetic lives there, and
 * a test keeps lib/dayLog.ts dependency-free.
 *
 * This is also the ONE place allowed to convert `health_logs.created_at` out of UTC —
 * see the note below, it is the only column in the app that needs it.
 *
 * Connections:
 *   Imports → lib/dayLog, lib/date (todayStr, utcStampToLocalMinutes), lib/i18n
 *             (getTranslations — labels for rows whose source has no user-visible title),
 *             store/useTaskStore, store/useMedicineStore, store/useHealthStore,
 *             store/useMomentsStore, store/useSettingsStore (language, featureDayLog)
 *   Used by → components/PlanTaskCard.tsx, app/day-log.tsx
 *   Data    → reads tasks, medicine_doses + medicines, health_logs, moments. Writes nothing.
 *
 * Edit notes:
 *   - **`date` and `cutoffMinutes` are separate arguments on purpose.** Today's log is
 *     cut at the now-line so a task due later doesn't appear as already-happened; a past
 *     day passes 1440, because every minute of it is behind you. Don't collapse them into
 *     a single "is it today" flag — app/day-log.tsx needs both shapes.
 *   - Memoised on the store arrays plus the cutoff, so it recomputes when a row changes
 *     or the minute ticks over, not on every render.
 *   - A dose's label is its medicine's NAME, resolved here. Doses store only a medicine_id,
 *     and lib/dayLog.ts must not import a store to look one up.
 *   - Health rows resolve their time as `startTime` first (the user typed it, so it beats
 *     everything), then `createdAt` via utcStampToLocalMinutes — which returns null when
 *     the UTC instant lands on a different LOCAL day, and null means the entry is dropped
 *     rather than filed under the wrong date.
 */
import { useMemo } from 'react';
import { buildDayLog, DayEntry, DayLogSources } from '@/lib/dayLog';
import { utcStampToLocalMinutes } from '@/lib/date';
import { getTranslations } from '@/lib/i18n';
import { useTaskStore } from '@/store/useTaskStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/** 'H:MM'/'HH:MM' → minutes since midnight, or null. Local copy so lib/dayLog stays pure. */
function timeToMinutes(hhmm: string): number | null {
  const match = hhmm?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * The day's already-happened entries for `date`, oldest first, cut at `cutoffMinutes`.
 *
 * Returns an empty array when `settings.featureDayLog` is off — the flag gates this
 * SURFACE, never the data underneath it, so every `done_at` keeps being stamped and
 * switching the flag back on shows a complete history.
 */
export function useDayLog(date: string, cutoffMinutes: number): DayEntry[] {
  const tasks = useTaskStore((s) => s.tasks);
  const doses = useMedicineStore((s) => s.doses);
  const medicines = useMedicineStore((s) => s.medicines);
  const healthLogs = useHealthStore((s) => s.logs);
  const moments = useMomentsStore((s) => s.moments);
  const enabled = useSettingsStore((s) => s.featureDayLog);
  const language = useSettingsStore((s) => s.language);

  return useMemo(() => {
    if (!enabled) return [];
    const t = getTranslations(language);
    const medicineName = new Map(medicines.map((m) => [m.id, m.name]));

    const sources: DayLogSources = {
      // `done` AND a matching date: a recurring task's row carries the date it's due, and
      // an un-ticked task has no doneAt anyway, so both filters are cheap and honest.
      tasks: tasks
        .filter((task) => task.done && task.date === date && task.doneAt)
        .map((task) => ({ id: task.id, title: task.title, doneAt: task.doneAt })),
      doses: doses
        .filter((d) => d.date === date)
        .map((d) => ({
          id: d.id,
          // A dose whose medicine has since been deleted still happened — fall back to a
          // neutral word rather than dropping the row or rendering a bare id.
          label: medicineName.get(d.medicineId) ?? t.dayLog.kinds.medicine,
          takenAt: d.takenAt,
        })),
      health: healthLogs
        .filter((l) => l.date === date)
        .map((l) => ({
          id: l.id,
          label: l.ailment,
          atMinutes: timeToMinutes(l.startTime) ?? utcStampToLocalMinutes(l.createdAt, date),
        })),
      moments: moments
        .filter((m) => m.logDate === date)
        .map((m) => ({ id: m.id, text: m.text, atTime: m.atTime })),
    };

    return buildDayLog(sources, cutoffMinutes);
  }, [enabled, language, tasks, doses, medicines, healthLogs, moments, date, cutoffMinutes]);
}

export default useDayLog;
