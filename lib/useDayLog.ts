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
 *             store/useTaskStore, store/useHabitStore, store/useMedicineStore,
 *             store/useHealthStore, store/useMomentsStore, store/usePeopleStore (the
 *             person filter on habits), store/useSettingsStore (language, featureDayLog,
 *             peopleModeEnabled)
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
 *   - **Known boundary: habits go back 35 days, everything else 365.**
 *     `useHabitStore.load()` only holds the last 35 days of `habit_logs` in memory
 *     (store/useHabitStore.ts), while `pruneOldData()` keeps a year. So app/day-log.tsx
 *     shows no habits past 35 days back even though tasks and health entries still appear.
 *     The rows are still in SQLite — this is an in-memory window, not data loss — and
 *     widening it would change what the growth streak and Energy scans load, so it is left
 *     alone deliberately. Absent, not wrong.
 */
import { useMemo } from 'react';
import { buildDayLog, DayEntry, DayLogSources } from '@/lib/dayLog';
import { utcStampToLocalMinutes } from '@/lib/date';
import { getTranslations } from '@/lib/i18n';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { usePeopleStore } from '@/store/usePeopleStore';
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
 * Returns `undefined` — not `[]` — when `settings.featureDayLog` is off. The flag gates
 * this SURFACE, never the data underneath it, so every `done_at` keeps being stamped and
 * switching the flag back on shows a complete history; but `undefined` vs. `[]` is also
 * the signal PlanTaskCard's `dayLog` prop gates itself on (`dayLogActive = !!dayLog`) —
 * an `[]` here read as "on, nothing happened yet" and made the now-line boundary
 * permanently active regardless of the setting. Callers that don't care about the
 * distinction (app/day-log.tsx) coalesce with `?? []`.
 */
export function useDayLog(date: string, cutoffMinutes: number): DayEntry[] | undefined {
  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const doses = useMedicineStore((s) => s.doses);
  const medicines = useMedicineStore((s) => s.medicines);
  const healthLogs = useHealthStore((s) => s.logs);
  const moments = useMomentsStore((s) => s.moments);
  const enabled = useSettingsStore((s) => s.featureDayLog);
  const language = useSettingsStore((s) => s.language);
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const people = usePeopleStore((s) => s.people);

  return useMemo(() => {
    if (!enabled) return undefined;
    const t = getTranslations(language);
    const medicineName = new Map(medicines.map((m) => [m.id, m.name]));
    // >1 because the self row always exists, so that is what actually means "there is
    // somebody else to tell apart from me".
    const showHabitProfiles = peopleModeEnabled && people.length > 1;

    const sources: DayLogSources = {
      // `done` AND a matching date: a recurring task's row carries the date it's due, and
      // an un-ticked task has no doneAt anyway, so both filters are cheap and honest.
      tasks: tasks
        .filter((task) => task.done && task.date === date && task.doneAt)
        .map((task) => ({ id: task.id, title: task.title, doneAt: task.doneAt })),
      // A habit counts as "happened today" if it was logged at least once and the day
      // isn't a rest day. Deliberately NOT habitMetOn() — see lib/dayLog.ts's header for
      // why a threshold has no place on this surface.
      //
      // Person filter mirrors app/(tabs)/habits.tsx: only when People mode is on AND there
      // is somebody else, because filtering while it's off would make a habit assigned to a
      // family member silently vanish — the exact trap that screen warns about. `''` is
      // "mine" and covers habits written before the People registry existed.
      habits: (showHabitProfiles ? habits.filter((h) => (h.childName ?? '') === '') : habits)
        .map((h) => ({ habit: h, log: habitLogs.find((l) => l.habitId === h.id && l.logDate === date) }))
        .filter(({ log }) => !!log && log.count >= 1 && !log.restDay && !!log.firstAt)
        .map(({ habit, log }) => ({ id: habit.id, name: habit.title, firstAt: log!.firstAt })),
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
  }, [
    enabled, language, tasks, habits, habitLogs, doses, medicines, healthLogs, moments,
    peopleModeEnabled, people, date, cutoffMinutes,
  ]);
}

export default useDayLog;
