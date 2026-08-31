/**
 * GoalQuickCell.tsx — a quick-add composer's "Goal" option (DESIGN_COMPARISON/19-IMPLEMENTATION.md
 * phase 7).
 *
 * One `QuickAddOptionRow` cell, at the "options" tier of the three-tier composer contract
 * (AGENTS.md "The hierarchy of settings when making a row"). Tapping it opens the SAME kind of
 * picker `TodoSurface.tsx`'s existing repeat cell already uses — a `showAppModal` list — rather
 * than the full `components/GoalPicker.tsx` field (label + inline expanding list + a "new goal"
 * row): a quick-add's options tier links an EXISTING goal, it does not create one. Creating a
 * goal stays in `components/GoalsEditor.tsx`'s own add row, which every card with a Goals
 * section already carries a tap away.
 *
 * Connections:
 *   Imports → components/QuickAddOptionRow, components/AppModal (showAppModal), lib/i18n,
 *             lib/haptics (tap), store/useGoalStore
 *   Used by → components/TodoSurface.tsx (Today/Week/Month/Whenever composers)
 *   Data    → reads useGoalStore (goals); the selected goalId is owned by the caller's draft
 *             state and flows in via `value`/`onChange`, same contract as GoalPicker
 *
 * Edit notes:
 *   - **A picker, not a modal-free inline expansion (2026-08-26).** A `showAppModal` list is a
 *     React Native `<Modal>`, which takes window focus and blurs whichever composer field opened
 *     it — the exact shape `lib/__tests__/composerFocusSteal.test.ts` guards. That guard lives in
 *     the composer (PadTypeRow/AddRow's `engaged` state + `controlsResponderProps` on the panel
 *     slot), not here, so this component doesn't need its own version of it — it only needs to be
 *     mounted inside that slot, which every caller already is.
 *   - No "no blind tap-cycles" trap here: this is a picker (showsMore's `›`), not a cycle.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { tap } from '@/lib/haptics';
import { useGoalStore } from '@/store/useGoalStore';

type Props = {
  value: string | null;
  onChange: (goalId: string | null) => void;
  accent: string;
};

export default function GoalQuickCell({ value, onChange, accent }: Props) {
  const router = useRouter();
  const t = useT();
  const goals = useGoalStore((s) => s.goals);
  const selected = value ? (goals.find((g) => g.id === value) ?? null) : null;

  function pick() {
    tap();
    showAppModal(t.goals.pickerLabel, undefined, [
      ...(value ? [{ text: t.goals.none, onPress: () => onChange(null) }] : []),
      ...goals.map((g) => ({
        text: g.id === value ? `• ${g.title}` : g.title,
        onPress: () => onChange(g.id),
      })),
      // ⚠️ **The way IN to goal editing, and since 2026-09-01 the only one.** Maintainer:
      // *"Goal editing is done by an 'Edit Goals' button that appears at the bottom of the
      // drop-down-menu when user presses 'Goal' in card."* The two folded `GoalsEditor` sections
      // (To-do's "Practical goals", Habits' "Personal goals" — the same editor over the same
      // store, under two labels on two tabs) are deleted, and this row replaces both.
      //   Last before Cancel, deliberately: the list above is what you came here to do, and this
      // is the escape hatch for the case the list cannot serve — the goal you want does not
      // exist yet. That also keeps this file's own rule intact, that a quick-add's options tier
      // LINKS an existing goal and does not create one; it now names where creating happens
      // instead of leaving the user to find it.
      { text: t.goals.editGoals, onPress: () => router.push('/goals-editor') },
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  return (
    <QuickAddOptionRow
      opt="goal"
      icon="flag"
      label={t.goals.pickerLabel}
      value={selected ? selected.title : t.goals.none}
      isSet={!!selected}
      accent={accent}
      onPress={pick}
      showsMore
      accessibilityLabel={`${t.goals.pickerLabel}: ${selected ? selected.title : t.goals.none}`}
    />
  );
}
