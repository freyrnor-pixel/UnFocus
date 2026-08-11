/**
 * useHabitRecurrenceDraft.ts — shared quick-add draft state for a habit's schedule.
 *
 * Both habit composers (app/(tabs)/habits.tsx and components/HomeHabitsCard.tsx) mount an
 * IDENTICAL quick-add panel, pinned against each other by lib/__tests__/energyModes.test.ts.
 * The 2026-08-11 "every N days/weeks" feature adds a repeat picker plus up to three
 * conditional cells (weekday chips, day-of-month, weekly-goal) on top of that panel — five
 * pieces of local state and a modal picker, which is exactly the kind of thing that drifts if
 * copy-pasted into two files. This hook is the state half (components/HabitRecurrenceCells.tsx
 * is the rendering half); each screen owns one instance and passes it straight through.
 *
 * Connections:
 *   Imports → lib/date (dayOfWeekMon0), lib/haptics (tap), components/AppModal (showAppModal),
 *             store/useHabitStore (HabitRecurrence type only)
 *   Used by → app/(tabs)/habits.tsx, components/HomeHabitsCard.tsx (both via
 *             components/HabitRecurrenceCells.tsx, which renders this hook's state)
 *   Data    → none — in-memory draft only; the caller's own createHabit() writes it via
 *             useHabitStore.add()/toHabitFields(), and openHabitFormWithDraft() via toParams()
 *
 * Edit notes:
 *   - `recurrenceInterval` is a MULTIPLIER on 'daily'/'weekly' (lib/habitRecurrence.ts) —
 *     nothing here needs to know that; it only carries the picked number.
 *   - `setRecurrence('weekly')` seeds today's weekday when the set is empty, mirroring
 *     app/habit-form.tsx's `changeRecurrence` — lib/habitRecurrence.ts reads an empty
 *     `recurrenceDays` as "every day", so an empty chip row would silently mean the opposite
 *     of what it looks like.
 *   - `reset()` must be called after every commit (both the tier-1 ✓ and the tier-3 "More
 *     options" hand-off) — same discipline as the existing habitDraft/habitEnergyValue resets
 *     it now sits beside at each call site.
 */
import { useState } from 'react';
import { dayOfWeekMon0 } from '@/lib/date';
import { tap } from '@/lib/haptics';
import { showAppModal } from '@/components/AppModal';
import type { HabitRecurrence } from '@/store/useHabitStore';

/** Labels the picker modal needs — passed in by the caller (components/HabitRecurrenceCells.tsx)
 *  so this hook stays free of useT()/component context and can't itself drift from lib/i18n.ts. */
export type HabitRecurrencePickerLabels = {
  title: string;
  cancel: string;
  daily: string;
  weekly: string;
  monthly: string;
  weeklyFlexible: string;
};

export type HabitRecurrenceDraft = ReturnType<typeof useHabitRecurrenceDraft>;

export function useHabitRecurrenceDraft() {
  const [recurrence, setRecurrenceRaw] = useState<HabitRecurrence>('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState(1);
  const [weeklyGoal, setWeeklyGoal] = useState(1);

  function setRecurrence(mode: HabitRecurrence) {
    if (mode === 'weekly' && weekDays.length === 0) setWeekDays([dayOfWeekMon0(new Date())]);
    setRecurrenceRaw(mode);
  }

  function toggleWeekDay(d: number) {
    setWeekDays((prev) =>
      prev.includes(d) ? (prev.length === 1 ? prev : prev.filter((x) => x !== d)) : [...prev, d]
    );
  }

  function reset() {
    setRecurrenceRaw('daily');
    setRecurrenceInterval(1);
    setWeekDays([]);
    setMonthDay(1);
    setWeeklyGoal(1);
  }

  /** Opens the "how often" picker — same shape as PlanTaskCard's pickRecurring(): a list
   *  showing all options at once, the current one marked with "• ", one tap either way. */
  function pick(labels: HabitRecurrencePickerLabels) {
    tap();
    const options: HabitRecurrence[] = ['daily', 'weekly', 'monthly', 'weekly-flexible'];
    const labelOf = (m: HabitRecurrence) =>
      m === 'daily' ? labels.daily
        : m === 'weekly' ? labels.weekly
        : m === 'monthly' ? labels.monthly
        : labels.weeklyFlexible;
    showAppModal(
      labels.title,
      undefined,
      [
        ...options.map((mode) => ({
          text: mode === recurrence ? `• ${labelOf(mode)}` : labelOf(mode),
          onPress: () => setRecurrence(mode),
        })),
        { text: labels.cancel, style: 'cancel' as const },
      ]
    );
  }

  /** `dailyGoal`/`recurrence`/`recurrenceDays`/`recurrenceInterval` for useHabitStore.add(). */
  function toHabitFields() {
    return {
      recurrence,
      recurrenceDays: recurrence === 'weekly' ? weekDays : recurrence === 'monthly' ? [monthDay] : [],
      recurrenceInterval,
      dailyGoal: recurrence === 'weekly-flexible' ? weeklyGoal : 1,
    };
  }

  /** String params for handing an unsaved pick to /habit-form's create-mode seed
   *  (title/energy already do this — see openHabitFormWithDraft at each call site). */
  function toParams(): Record<string, string> {
    return {
      recurrence,
      recurrenceInterval: String(recurrenceInterval),
      recurrenceDays: JSON.stringify(
        recurrence === 'weekly' ? weekDays : recurrence === 'monthly' ? [monthDay] : []
      ),
      dailyGoal: String(recurrence === 'weekly-flexible' ? weeklyGoal : 1),
    };
  }

  return {
    recurrence,
    recurrenceInterval,
    weekDays,
    monthDay,
    weeklyGoal,
    setRecurrence,
    setRecurrenceInterval,
    toggleWeekDay,
    setMonthDay,
    setWeeklyGoal,
    reset,
    pick,
    toHabitFields,
    toParams,
  };
}
