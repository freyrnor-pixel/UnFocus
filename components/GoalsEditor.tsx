/**
 * GoalsEditor.tsx — the Goals drawer's body: browse, add and delete goals in place.
 *
 * Mounted inside a components/CollapsedSection.tsx "Goals" drawer on Habits and Plans.
 * Replaces the old GoalsPreviewList (read-only) + components/GoalsSheet.tsx (popup) pair
 * (2026-08-12, maintainer: "This should not be a pop-up. Examples included in card just
 * like other cards, and making, editing and deleting in the card, not a pop up.") — the
 * drawer's body IS the editor now, the same "mount the real thing instead of a preview"
 * shape Shopping's Food/Catalogue drawers already use. GoalsSheet.tsx is deleted, so there
 * is nothing left to pop up: the caller passes no `onTitlePress` to CollapsedSection any
 * more — Goals now expands in place exactly like the Whenever drawer does.
 *
 * Connections:
 *   Imports → components/PadSheet, components/PadRow, components/AddRow,
 *             components/StarterCard (its `embedded` mode — the empty state),
 *             components/GoalGlowDot, components/PressableScale, components/AppModal
 *             (showAppModal), constants/theme, constants/motion (Travel), lib/goalStarters,
 *             lib/goalStrength (decayedStrength), lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useGoalStore, store/useTaskStore, store/useHabitStore (linked counts only)
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/habits.tsx — both inside a
 *             components/CollapsedSection.tsx "Goals" drawer, with no `onTitlePress`
 *   Data    → reads/writes useGoalStore (goals table) via add/remove; reads
 *             useTaskStore/useHabitStore only to COUNT what points at each goal. Schedules
 *             nothing.
 *
 * Edit notes:
 *   - **No Surface of its own.** This is mounted inside CollapsedSection's own Surface, so
 *     wrapping goal rows (or the empty-state explainer) in another Surface would read as a
 *     nested panel — same rule Shopping's `embedded` FoodTab/CatalogueTab follow. Goal rows
 *     go through PadRow/PadSheet at the field rung; the empty state is
 *     `<StarterCard embedded>`, i.e. that component's real contents with its Surface,
 *     padding and StageTree dropped.
 *     Until 2026-08-12 this file HAND-COPIED that card's bulb row and chip slot, for want of
 *     a way to mount it without its card — the `embedded` prop is that way, and it is what
 *     the same pass gave Health and Habits so their examples stop being a card inside a card.
 *     Don't reintroduce a local copy of the explainer: the whole point is that one component
 *     owns the wording, spacing and voice of every empty state.
 *   - **Starter chips only show while there are no goals yet** — same "gone once you have
 *     content of your own" rule every other StarterCard-driven surface follows. The manual
 *     add row (AddRow) is always present, empty or not.
 *   - **A goal's title is capped at one line here** (`PadRow`'s own `numberOfLines={1}`),
 *     which REVERSES GoalsSheet's deliberate "no cap — a goal's title is the whole point of
 *     the card" call (2026-08-06). Trade-off, not an oversight: the maintainer's 2026-08-12
 *     ask was for Goals to read "just like other cards" in the drawer, and every other row on
 *     this row-anatomy contract truncates at one line. A goal's full title is still visible
 *     in app/goals.tsx (the standalone screen) and in the row's own accessible name.
 *   - Deleting a goal unlinks every task and habit pointing at it (useGoalStore.remove does
 *     that in one transaction) — same confirm copy app/goals.tsx uses, keep them in sync.
 *   - Strength shown is always `decayedStrength(...)`, never the raw stored value — see
 *     lib/goalStrength.ts.
 *   - Delete is the row's ⋯ action (PadRow's `onAction`), going straight to the confirm
 *     dialog — same pattern HomeShoppingCard's remove and PlanTaskCard's delete-task use,
 *     not a menu with a second step.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import StarterCard from '@/components/StarterCard';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, Radius, Spacing, TabularNums } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { GOAL_STARTERS } from '@/lib/goalStarters';
import { decayedStrength } from '@/lib/goalStrength';
import { tap, success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useGoalStore } from '@/store/useGoalStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default function GoalsEditor({ accent }: { accent: string }) {
  const theme = useAppTheme();
  const t = useT();
  const goals = useGoalStore((s) => s.goals);
  const addGoal = useGoalStore((s) => s.add);
  const removeGoal = useGoalStore((s) => s.remove);
  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const [draft, setDraft] = useState('');

  const linked = useMemo(() => {
    const counts = new Map<string, { tasks: number; habits: number }>();
    const bump = (id: string | null | undefined, key: 'tasks' | 'habits') => {
      if (!id) return;
      const entry = counts.get(id) ?? { tasks: 0, habits: 0 };
      entry[key] += 1;
      counts.set(id, entry);
    };
    for (const task of tasks) bump(task.goalId, 'tasks');
    for (const habit of habits) bump(habit.goalId, 'habits');
    return counts;
  }, [tasks, habits]);

  function commitAdd() {
    const title = draft.trim();
    if (!title) return;
    success();
    addGoal(title);
    setDraft('');
  }

  function addStarter(title: string) {
    success();
    addGoal(title);
  }

  function confirmDelete(id: string, title: string) {
    tap();
    showAppModal(t.goals.deleteConfirmTitle(title), t.goals.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.goals.deleteLabel, style: 'destructive', onPress: () => removeGoal(id) },
    ]);
  }

  return (
    <View style={styles.wrap}>
      {goals.length === 0 ? (
        // The shared empty-state card, without its Surface (2026-08-12). This block used to be
        // a hand-copy of components/StarterCard.tsx's own bulb row + chip slot, because there
        // was no way to get that card's contents without the card. `embedded` is that way now,
        // so the explainer's wording, spacing and voice come from the one component again.
        <StarterCard embedded text={t.hints.goals.text}>
          <View style={styles.starterChips}>
            {GOAL_STARTERS.map((starter) => (
              <PressableScale
                key={starter.key}
                style={[styles.starterChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => addStarter(t.starters.goals.suggestions[starter.key])}
                travel={Travel.sm}
                accessibilityRole="button"
                accessibilityLabel={`${t.starters.addExample} ${t.starters.goals.suggestions[starter.key]}`}
              >
                <Ionicons name={starter.icon} size={16} color={theme.accent} />
                <Text style={[styles.starterChipText, { color: theme.text }]}>
                  {t.starters.goals.suggestions[starter.key]}
                </Text>
              </PressableScale>
            ))}
          </View>
        </StarterCard>
      ) : (
        <PadSheet state="open">
          {goals.map((goal) => {
            const level = decayedStrength(goal.strength, goal.strengthUpdatedAt, Date.now());
            const counts = linked.get(goal.id) ?? { tasks: 0, habits: 0 };
            const hasLinks = counts.tasks + counts.habits > 0;
            const days = goal.strengthUpdatedAt
              ? Math.floor((Date.now() - new Date(goal.strengthUpdatedAt).getTime()) / MS_PER_DAY)
              : null;
            const band =
              level >= 0.6 ? t.goals.strengthStrong : level >= 0.2 ? t.goals.strengthWarm : t.goals.strengthNeutral;
            const metaText =
              (hasLinks ? t.goals.linkedCount(counts.tasks, counts.habits) : t.goals.neverWorked) +
              (days !== null ? ` · ${t.goals.lastWorked(days)}` : '');
            return (
              <PadRow
                key={goal.id}
                title={goal.title}
                accent={accent}
                rightValue={band}
                meta={
                  <Text style={[styles.meta, TabularNums, { color: theme.textMuted }]} numberOfLines={1}>
                    {metaText}
                  </Text>
                }
                leading={
                  <GoalGlowDot
                    color={goal.color}
                    strength={goal.strength}
                    strengthUpdatedAt={goal.strengthUpdatedAt}
                    size={14}
                  />
                }
                onAction={() => confirmDelete(goal.id, goal.title)}
                actionLabel={t.goals.deleteLabel}
              />
            );
          })}
        </PadSheet>
      )}

      <AddRow
        value={draft}
        onChangeText={setDraft}
        onSubmit={commitAdd}
        placeholder={t.goals.newPlaceholder}
        accent={accent}
        showDivider={goals.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  // The bulb row's own styles are gone with the hand-copy — components/StarterCard.tsx's
  // `embedded` mode draws it now. Don't reintroduce a local copy.
  meta: { fontSize: FontSize.xs },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    minHeight: 36,
  },
  starterChipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
