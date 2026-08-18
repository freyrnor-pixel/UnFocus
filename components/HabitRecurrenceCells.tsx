/**
 * HabitRecurrenceCells.tsx — the habit quick-add's repeat picker + conditional schedule cells.
 *
 * Tier-2 progressive disclosure for a habit's "every N days/weeks" schedule (2026-08-11):
 * one always-visible QuickAddOptionRow that opens a picker (daily/weekly/monthly/flexible,
 * same shape as PlanTaskCard's pickRecurring()), plus up to two more cells that only appear
 * once a recurrence needing them is picked — a weekday multi-select row for weekly, a
 * day-of-month Stepper for monthly, a weekly-goal Stepper for weekly-flexible, and an "every
 * N" Stepper for daily/weekly. This is the progressive disclosure itself: nothing here is
 * collapsed behind its own toggle, the conditional RENDER is the whole mechanism (see
 * AGENTS.md's Wave A brief — tier 3 stays a push to /habit-form, this never grows an inline
 * "advanced view").
 *
 * Split out of app/habits.tsx / components/HomeHabitsCard.tsx rather than copy-pasted
 * into both, because those two composers are pinned against each other
 * (lib/__tests__/energyModes.test.ts) and five pieces of local state plus a modal picker is
 * exactly the kind of thing that drifts if written twice. lib/useHabitRecurrenceDraft.ts owns
 * the STATE; this component only renders it, so a screen mounts both together:
 *   const draft = useHabitRecurrenceDraft();
 *   <HabitRecurrenceCells draft={draft} accent={screenHue} />
 *
 * Connections:
 *   Imports → components/QuickAddOptionRow, components/QuickAddOptionsPanel (type only, via
 *             the caller — this component renders ROWS, not the panel itself),
 *             components/Stepper, components/PressableScale, constants/theme (AspectRatio,
 *             FontSize, Fonts, Radius, Spacing), lib/useAppTheme, lib/i18n (useT),
 *             lib/haptics (tap), lib/useHabitRecurrenceDraft (HabitRecurrenceDraft type)
 *   Used by → app/habits.tsx, components/HomeHabitsCard.tsx (both inside their existing
 *             `<QuickAddOptionsPanel>`, alongside the energy cell)
 *   Data    → none — presentational; all state lives in the `draft` prop
 *
 * Edit notes:
 *   - **The repeat picker cell (`t.habitHowOften`) is unconditional** — it does not sit behind
 *     `energySystemEnabled` or any other flag, unlike the energy cell beside it. Don't gate it;
 *     repetition is a core habit property, not an Energy-system feature.
 *   - The weekday chips copy app/habit-form.tsx's `dayChip` styling exactly (same colours,
 *     same `theme.accent` active fill — chip SELECTED-state colour is a separate convention
 *     from the card-border screen-hue rule; components/TaskCard.tsx's `weekdayChip` does the
 *     same). Multi-select, so DESIGN_RULES.md rule 19a exempts it from becoming a
 *     SegmentedControl — don't convert it.
 *   - The "every N" cell's LABEL is the sentence ("Every 3 days") and its VALUE is a live
 *     Stepper for the same number — a label that updates as you adjust the control, same
 *     pattern as the monthly day-of-month cell below it (label static, value live).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import Stepper from '@/components/Stepper';
import PressableScale from '@/components/PressableScale';
import { AspectRatio, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap } from '@/lib/haptics';
import type { HabitRecurrenceDraft } from '@/lib/useHabitRecurrenceDraft';

type Props = {
  draft: HabitRecurrenceDraft;
  /** The screen's own hue (lib/screenColor.ts) — passed straight through to every cell's
   *  `accent`, matching the energy cell beside these in the same panel. */
  accent: string;
};

export default function HabitRecurrenceCells({ draft, accent }: Props) {
  const theme = useAppTheme();
  const t = useT();

  const recurrenceLabel =
    draft.recurrence === 'daily' ? t.habitRecurrenceDaily
      : draft.recurrence === 'weekly' ? t.habitRecurrenceWeekly
      : draft.recurrence === 'monthly' ? t.habitRecurrenceMonthly
      : t.habitRecurrenceWeeklyFlexible;

  function openPicker() {
    draft.pick({
      title: t.pad.recurrencePicker,
      cancel: t.cancel,
      daily: t.habitRecurrenceDaily,
      weekly: t.habitRecurrenceWeekly,
      monthly: t.habitRecurrenceMonthly,
      weeklyFlexible: t.habitRecurrenceWeeklyFlexible,
    });
  }

  return (
    <>
      <QuickAddOptionRow
        icon="repeat"
        label={t.habitHowOften}
        value={recurrenceLabel}
        isSet={draft.recurrence !== 'daily'}
        onPress={openPicker}
        showsMore
        accent={accent}
      />

      {(draft.recurrence === 'daily' || draft.recurrence === 'weekly') && (
        <QuickAddOptionRow
          icon="repeat"
          label={
            draft.recurrence === 'daily'
              ? t.habitEveryNDaysLabel(draft.recurrenceInterval)
              : t.habitEveryNWeeksLabel(draft.recurrenceInterval)
          }
          value={
            <Stepper
              value={draft.recurrenceInterval}
              onChange={draft.setRecurrenceInterval}
              min={1}
              max={12}
              accessibilityLabel={t.habitHowOften}
            />
          }
          wide
          accent={accent}
        />
      )}

      {draft.recurrence === 'weekly' && (
        <QuickAddOptionRow
          icon="calendar-outline"
          label={t.habitRepeatDaysLabel}
          value={
            <View style={styles.daysRow}>
              {t.dayLabels.map((label, i) => {
                const active = draft.weekDays.includes(i);
                return (
                  <PressableScale
                    key={i}
                    style={[
                      styles.dayChip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      active && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      draft.toggleWeekDay(i);
                    }}
                    scaleTo={0.97}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Text style={[styles.dayText, { color: theme.text }, active && { color: theme.accentInk }]}>
                      {label.slice(0, 2)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          }
          wide
          accent={accent}
        />
      )}

      {draft.recurrence === 'monthly' && (
        <QuickAddOptionRow
          icon="calendar-outline"
          label={t.taskMonthlyByDay}
          value={
            <Stepper
              value={draft.monthDay}
              onChange={draft.setMonthDay}
              min={1}
              max={28}
              accessibilityLabel={t.taskMonthlyByDay}
            />
          }
          accent={accent}
        />
      )}

      {draft.recurrence === 'weekly-flexible' && (
        <QuickAddOptionRow
          icon="flag-outline"
          label={t.habitWeeklyGoal}
          value={
            <Stepper
              value={draft.weeklyGoal}
              onChange={draft.setWeeklyGoal}
              min={1}
              max={20}
              accessibilityLabel={t.habitWeeklyGoal}
            />
          }
          accent={accent}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  daysRow: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
  dayChip: {
    flex: 1,
    aspectRatio: AspectRatio.square,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
