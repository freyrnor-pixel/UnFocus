/**
 * goals.tsx — the Goals screen: every goal, how strong it is, and what's pointed at it.
 *
 * Goals existed long before this screen (store/useGoalStore.ts, since the task/habit form
 * pickers) but had nowhere to be looked at: they could only be created and deleted from
 * inside components/GoalPicker.tsx, and the only place one appeared afterwards was a small
 * glow dot on a linked row. A goal you can't see isn't encouragement.
 *
 * **No longer a Home card (2026-07-29, user report: Home had too many lists).** Goals had a
 * Home preview card (components/HomeGoalsCard.tsx, 2026-07-28) for exactly one day — it's
 * deleted now. Goals are reached from Habits and Plans instead (a "Goals" link button, same
 * idea as Shopping's Food/Catalogue links), since that's where a goal is actually worked —
 * this screen itself is unchanged, still the one place to see every goal's strength and what
 * points at it.
 *
 * **This is also where "cutting back" lives.** Habits in this app are positive-only — there
 * is no negative-habit kind, no "log a slip", no broken-streak state, and none is planned.
 * Something you want to do LESS of is expressed as a Goal ("Less time on my phone"), and the
 * tasks and habits linked to it are the replacement behaviour. That needs no new data model:
 * the goal's title carries the direction, and the existing strength mechanic already does the
 * right emotional thing — it rises when you work on it and cools back toward neutral when you
 * don't, never below (lib/goalStrength.ts). Nothing here can tell you you're failing, because
 * there is no state in which a goal is failing.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/StarterCard,
 *             components/Surface, components/GoalGlowDot, components/AddRow,
 *             components/IconButton, components/PressableScale, constants/theme,
 *             lib/goalStarters, lib/goalStrength (decayedStrength), lib/haptics, lib/i18n,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/prefill (usePrefill — a note sent
 *             here seeds the add field), store/useGoalStore, store/useTaskStore,
 *             store/useHabitStore (linked counts only)
 *   Used by → Expo Router route "/goals" — direct deep links only (a note's "Send it to… →
 *             Goals" still routes here). The Habits/Plans "Edit Goals" link no longer opens
 *             this screen (2026-07-31): it opens components/GoalsSheet.tsx, a popup that
 *             duplicates this screen's list/add/delete behaviour, so editing goals doesn't
 *             leave the tab you were on. This screen is kept unchanged so an existing deep
 *             link never dead-ends. (2026-07-29 — Goals dropped its own Home card,
 *             components/HomeGoalsCard.tsx, deleted; see below)
 *   Data    → reads/writes useGoalStore (goals table) via add/rename/remove; reads
 *             useTaskStore/useHabitStore only to COUNT what points at each goal. Schedules
 *             nothing.
 *
 * Edit notes:
 *   - `settings.featureGoals` gates the Habits/Plans "Edit Goals" link (and GoalsSheet.tsx,
 *     the popup it opens), not this screen — this route stays reachable directly so an
 *     existing deep link never dead-ends even with the feature off.
 *   - Deleting a goal unlinks every task and habit pointing at it (useGoalStore.remove does
 *     that in one transaction). The confirm copy already says so — keep it in sync with
 *     GoalsSheet.tsx's copy of the same confirm.
 *   - Strength shown is always `decayedStrength(...)`, never the raw stored value. See
 *     lib/goalStrength.ts: the raw number plus a timestamp IS the state; decay is computed
 *     on read, so anything that renders the raw value shows a stale, too-warm goal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import StarterCard from '@/components/StarterCard';
import Surface from '@/components/Surface';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import AddRow from '@/components/AddRow';
import PressableScale from '@/components/PressableScale';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Radius, Spacing, TabularNums, Type, HitSlop } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { GOAL_STARTERS } from '@/lib/goalStarters';
import { decayedStrength } from '@/lib/goalStrength';
import { tap, success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { usePrefill } from '@/lib/prefill';
import { useGoalStore } from '@/store/useGoalStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default function GoalsScreen() {
  const theme = useAppTheme();
  const t = useT();
  const goals = useGoalStore((s) => s.goals);
  const addGoal = useGoalStore((s) => s.add);
  const removeGoal = useGoalStore((s) => s.remove);
  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  // Collapsed until the header ⓘ is tapped (2026-07-31 — the hook's first-visit auto-open
  // and its `autoOpen` arg are gone; every screen behaves this way now).
  const [hintOpen, setHintOpen] = useFirstVisitHint('goals');
  const [draft, setDraft] = useState('');

  // Arrived here from a note's ⋯ → Send it to… → Goals: the note's text is on the route, so
  // seed the add field with it rather than making the user retype what they just wrote.
  const prefill = usePrefill();
  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);

  // How many tasks/habits point at each goal. One pass over each list rather than a filter
  // per goal — this renders on every store change and the lists can be long.
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
    <ScreenScaffold
      title={t.goals.title}
      tier="site"
      screenKey="goals"
      infoActive={hintOpen}
      onInfoToggle={() => setHintOpen((v) => !v)}
    >
      <View style={styles.content}>
        {hintOpen && <HintCard text={t.hints.goals.text} example={t.hints.goals.example} />}

        {goals.length === 0 ? (
          <StarterCard text={t.starters.goals.text}>
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
              // Three bands, all of them fine to be in. There is deliberately no fourth,
              // worse-than-neutral band — see the header.
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
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  list: { gap: Spacing.sm },
  goalCard: { borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  goalTitle: { flex: 1, minWidth: 0, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  goalStatus: { fontSize: FontSize.sm, fontFamily: Type.label.fontFamily },
  goalMeta: { fontSize: FontSize.xs },
  tapToAdd: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
  // `flexWrap` with no minWidth on the chips — a goal title is long enough that a fixed
  // minimum would break the row at 360px (see AGENTS.md's wrap-audit lessons).
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
});
