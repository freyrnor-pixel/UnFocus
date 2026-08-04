/**
 * GoalsSheet.tsx — "Edit Goals" popup: every goal, how strong it is, and a way to add/delete.
 *
 * Opened from a low-emphasis "Edit Goals" link at the BOTTOM of Habits and Plans (2026-07-31
 * — moved off the top of those screens, under the hint card, where it competed with the
 * actual list for attention on every visit; see those files' Edit notes). Replaces the old
 * `router.push('/goals')` entry point with a popup so editing goals doesn't leave the tab
 * you were on. app/goals.tsx itself is UNCHANGED and still reachable by direct route (a note's
 * "Send it to… → Goals" still routes there) — this sheet duplicates its list/add/delete
 * behaviour rather than replacing the screen, so an existing deep link never dead-ends.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/PressableScale,
 *             components/StarterCard, components/GoalGlowDot, components/AddRow,
 *             constants/theme, constants/motion, lib/goalStarters, lib/goalStrength
 *             (decayedStrength), lib/haptics, lib/i18n, lib/useAppTheme, store/useGoalStore,
 *             store/useTaskStore, store/useHabitStore (linked counts only)
 *   Used by → app/(tabs)/habits.tsx, app/(tabs)/plans.tsx (both an "Edit Goals" link)
 *   Data    → reads/writes useGoalStore (goals table) via add/remove; reads
 *             useTaskStore/useHabitStore only to COUNT what points at each goal. Schedules
 *             nothing.
 *
 * Edit notes:
 *   - Deleting a goal unlinks every task and habit pointing at it (useGoalStore.remove does
 *     that in one transaction) — same confirm copy as app/goals.tsx, keep them in sync.
 *   - Strength shown is always `decayedStrength(...)`, never the raw stored value — see
 *     lib/goalStrength.ts.
 *   - Decision 044b applies: the sheet shell is AnimatedBottomSheet so it plays a real exit
 *     animation.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import StarterCard from '@/components/StarterCard';
import AddRow from '@/components/AddRow';
import Button from '@/components/Button';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, HitSlop, Radius, Spacing, TabularNums, Type } from '@/constants/theme';
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

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function GoalsSheet({ visible, onClose }: Props) {
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
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.goals.editLink}</Text>
        {/* The explanation is stated ONCE. With no goals yet, the StarterCard below is the
            teaching surface and carries it; this subtitle would have sat directly above that
            card saying the same thing in different words ("The bigger thing your to-dos and
            habits are for" over "What your to-dos and habits add up to"), which put two
            paraphrases of one sentence in the top third of the sheet before anything you
            could act on. Once there ARE goals the card is gone, so the subtitle takes the
            job back. */}
        {goals.length > 0 && (
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t.hints.goals.text}</Text>
        )}

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {goals.length === 0 ? (
            // The fuller of the two sentences, since it is now the only one: it explains the
            // linking mechanic, not just what a goal is.
            <StarterCard text={t.hints.goals.text}>
              <Text style={[styles.tapToAdd, { color: theme.textMuted }]}>{t.starters.goals.tapToAdd}</Text>
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
            <View style={styles.list}>
              {goals.map((goal) => {
                const level = decayedStrength(goal.strength, goal.strengthUpdatedAt, Date.now());
                const counts = linked.get(goal.id) ?? { tasks: 0, habits: 0 };
                const hasLinks = counts.tasks + counts.habits > 0;
                const days = goal.strengthUpdatedAt
                  ? Math.floor((Date.now() - new Date(goal.strengthUpdatedAt).getTime()) / MS_PER_DAY)
                  : null;
                const statusLabel =
                  level >= 0.6 ? t.goals.strengthStrong : level >= 0.2 ? t.goals.strengthWarm : t.goals.strengthNeutral;
                return (
                  <Surface key={goal.id} borderColor={goal.color} style={styles.goalCard}>
                    <View style={styles.goalHeader}>
                      <GoalGlowDot
                        color={goal.color}
                        strength={goal.strength}
                        strengthUpdatedAt={goal.strengthUpdatedAt}
                        size={14}
                      />
                      <Text style={[styles.goalTitle, { color: theme.text }]} numberOfLines={2}>
                        {goal.title}
                      </Text>
                      <PressableScale
                        onPress={() => confirmDelete(goal.id, goal.title)}
                        hitSlop={HitSlop.base}
                        travel={Travel.sm}
                        accessibilityRole="button"
                        accessibilityLabel={t.goals.deleteLabel}
                      >
                        <Ionicons name="close-outline" size={18} color={theme.textMuted} />
                      </PressableScale>
                    </View>
                    <Text style={[styles.goalStatus, { color: theme.textMuted }]}>{statusLabel}</Text>
                    <Text style={[styles.goalMeta, TabularNums, { color: theme.textMuted }]}>
                      {hasLinks ? t.goals.linkedCount(counts.tasks, counts.habits) : t.goals.neverWorked}
                      {days !== null ? ` · ${t.goals.lastWorked(days)}` : ''}
                    </Text>
                  </Surface>
                );
              })}
            </View>
          )}

          <AddRow
            value={draft}
            onChangeText={setDraft}
            onSubmit={commitAdd}
            placeholder={t.goals.newPlaceholder}
            accent={theme.accent}
          />
        </ScrollView>

        {/* Dismissing is not this sheet's main action — adding or linking a goal is. This was a
            hand-rolled full-width accent fill, which made "Done" the loudest thing on screen
            while doing the least, and sat it right under the quiet add row that actually
            matters. Secondary, through the shared Button (it was bypassing the design system's
            button entirely, so it also missed the cap-travel press). */}
        <Button label={t.goals.close} onPress={onClose} variant="secondary" style={styles.doneBtn} />
      </Surface>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  subtitle: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  scroll: { flexGrow: 0 },
  list: { gap: Spacing.sm, marginBottom: Spacing.sm },
  goalCard: { borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  goalTitle: { flex: 1, minWidth: 0, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  goalStatus: { fontSize: FontSize.sm, fontFamily: Type.label.fontFamily },
  goalMeta: { fontSize: FontSize.xs },
  tapToAdd: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
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
  starterChipText: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
  // Button owns its own height, radius, padding and press travel; this only positions it.
  doneBtn: { marginTop: Spacing.xs },
});
