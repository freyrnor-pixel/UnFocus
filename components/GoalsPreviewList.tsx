/**
 * GoalsPreviewList.tsx — the read-only goal list shown inside a "Goals" drawer.
 *
 * One row per goal: its glow dot, its title, and which of the three fine-to-be-in strength
 * bands it is in. Nothing here edits anything — adding, renaming and deleting all live in
 * components/GoalsSheet.tsx, which the drawer's title opens.
 *
 * Connections:
 *   Imports → components/PadSheet, components/PadRow, components/GoalGlowDot,
 *             lib/goalStrength (decayedStrength), lib/i18n, lib/useAppTheme,
 *             store/useGoalStore
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/habits.tsx — both inside a
 *             components/CollapsedSection.tsx "Goals" drawer
 *   Data    → reads useGoalStore only. Schedules nothing, writes nothing.
 *
 * Edit notes:
 *   - **Strength is always `decayedStrength(...)`, never the raw stored value** — same rule
 *     GoalsSheet and app/goals.tsx follow. See lib/goalStrength.ts.
 *   - **Three bands, and there is deliberately no fourth, worse one.** A goal's strength floors
 *     at neutral and can never read as failing (AGENTS.md's goals note). Don't add a "needs
 *     attention" state here because a preview feels like it wants urgency — that is exactly the
 *     shape this app refuses.
 *   - Tapping a row opens the same sheet the title does, rather than a per-goal editor: there
 *     isn't one, and inventing a second entry point for editing would put the same list behind
 *     two different doors.
 *   - **The empty state is a dashed ghost-add row, not a StarterCard.** Teaching copy inside a
 *     drawer nobody has opened yet is teaching nobody. It lives HERE rather than at each call
 *     site so the two Goals drawers (To-do and Habits) can't drift apart, which is the whole
 *     reason this component exists instead of two inline lists.
 *   - **The empty line is itself a tap target for `onOpen` (2026-08-11 fix; restyled the same
 *     day — see below).** Unlike HealthIssuesPreviewList's empty state — which stays inert
 *     because a symptom gets tracked automatically the first time it's logged elsewhere — a
 *     goal has no such side door: the ONLY way to create one is through GoalsSheet, opened
 *     either by the drawer's title or by tapping a row. With zero goals there was no row, and
 *     the copy told the user to look "below" for an add control that didn't exist here — the
 *     drawer's title, several lines above, was the only real entry point and nothing marked it
 *     as tappable. The empty line now behaves like every populated row (`onPress={onOpen}`) so
 *     the surface the user is already looking at is itself the way to add a goal.
 *   - **⚠️ Restyled the same day — the first cut copied `plans.tsx`'s `sectionEmpty` look
 *     (solid `surfaceMuted` fill + solid border), which is also this app's real-`Input` look
 *     (`FormControls.tsx`): bordered + filled + rounded reads as a text field you can type
 *     into, and this isn't one — it's a button to GoalsSheet. Maintainer: "buttons should look
 *     like buttons and text fields like text fields." Now dashed, unfilled, with a leading "+"
 *     — the same idiom `StarterExampleRow` and `PlanTaskCard`'s `emptyAddRow` already use for
 *     "tap this to add something," so it reads as an action, not a field. Don't reuse
 *     `sectionEmpty`'s filled look for a pressable row anywhere else for this reason — see the
 *     matching fix in app/(tabs)/shopping.tsx's `monthlyEmptyLocked`.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PressableScale from '@/components/PressableScale';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { decayedStrength } from '@/lib/goalStrength';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useGoalStore } from '@/store/useGoalStore';

export default function GoalsPreviewList({ accent, onOpen }: { accent: string; onOpen: () => void }) {
  const t = useT();
  const theme = useAppTheme();
  const goals = useGoalStore((s) => s.goals);

  if (goals.length === 0) {
    return (
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t.goals.emptyList}
        style={[styles.empty, { borderColor: theme.border }]}
      >
        <Ionicons name="add" size={16} color={theme.accent} />
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.goals.emptyList}</Text>
      </PressableScale>
    );
  }

  return (
    <PadSheet state="open">
      {goals.map((goal) => {
        const level = decayedStrength(goal.strength, goal.strengthUpdatedAt, Date.now());
        const band =
          level >= 0.6 ? t.goals.strengthStrong : level >= 0.2 ? t.goals.strengthWarm : t.goals.strengthNeutral;
        return (
          <PadRow
            key={goal.id}
            title={goal.title}
            accent={accent}
            rightValue={band}
            onPress={onOpen}
            leading={
              <GoalGlowDot
                color={goal.color}
                strength={goal.strength}
                strengthUpdatedAt={goal.strengthUpdatedAt}
                size={14}
              />
            }
          />
        );
      })}
    </PadSheet>
  );
}

const styles = StyleSheet.create({
  // A dashed, unfilled ghost-add row — the same idiom StarterExampleRow and PlanTaskCard's
  // emptyAddRow use for "tap this to add something," so it reads as a button rather than as a
  // text field (see the 2026-08-11 restyle note above). `minHeight` floors it to
  // MIN_TAP_TARGET (DESIGN_RULES rule 17).
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
});
