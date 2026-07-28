/**
 * HomeHabitsCard.tsx — Home-screen preview of today's habits, mirroring PlanTaskCard/
 * HomeShoppingCard's Surface + domain-colored-border layout.
 *
 * Shows habits due today (lib/habitRecurrence's habitOccursOn), each row a compact
 * title + −/+ log control (the same increment/decrement model app/(tabs)/habits.tsx's
 * HabitCard uses — a habit's dailyGoal can be >1, so a plain checkbox can't always mean
 * "done"), collapsed to the first 5 with a "Show all/less" toggle, and a trailing
 * quick-add row. Tapping the title navigates to the full Habits tab. Self-contained
 * (reads useHabitStore directly) — no props, unlike PlanTaskCard/HomeShoppingCard which
 * need Home's own cross-store aggregation (Habits doesn't touch any other store).
 *
 * Connections:
 *   Imports → components/Surface, components/CardAccent (badge+wash gradient move),
 *             components/HabitIcon, components/PressableScale, components/ProgressBar,
 *             components/StarterExampleRow (empty-state example row), components/AddRow,
 *             constants/theme, lib/haptics, lib/i18n, lib/date (todayStr), lib/useAppTheme,
 *             lib/domainColor, lib/habitRecurrence (habitOccursOn, habitProgress),
 *             lib/habitStarters (HABIT_STARTERS — one-tap starter chips), store/useHabitStore
 *   Used by → app/(tabs)/index.tsx (Home habits preview, placed directly under the To-do/
 *             Plans card)
 *   Data    → reads/writes useHabitStore (habits + habit_logs) via increment/decrement/add
 *
 * Edit notes:
 *   - **New card (2026-07-28, user report: "Habits card must be added to home screen under
 *     to-do")**: a full interactive mirror, not a read-only summary. Positioned right after
 *     'plans' in the default `settings.homeCardOrder` (see store/useSettingsStore.ts's
 *     default + lib/db.ts's back-fill migration for existing installs).
 *   - **Due-today filtering** mirrors app/(tabs)/habits.tsx's Today tab (`habitOccursOn`),
 *     but WITHOUT that screen's People/family profile filter — this card always shows
 *     every due habit regardless of person; tap through to /habits for a person-filtered
 *     view. Kept simple on purpose: a Home preview card isn't the place for a second
 *     person-filter UI.
 *   - **Log control**: a −/+ pair (not a plain checkbox), mirroring HabitCard's own
 *     interaction — `dailyGoal` can be >1 (e.g. "Drink 4 glasses of water"), so a single
 *     tap can't always mean "done". `habitProgress()` (lib/habitRecurrence.ts) gives the
 *     same count/goal/isDone the full Habits tab reads; a done row gets a checkmark +
 *     dimmed/struck-through title. `success()` only fires on the tap that actually
 *     completes the goal (mirrors PlanTaskCard's done-toggle haptic rule); lesser taps
 *     get the lighter `tap()`.
 *   - **Empty states, two tiers (mirrors habits.tsx's Today tab exactly)**: no habits AT
 *     ALL → bulb explainer (`t.starters.habits.text`) + an "Example habits" divider
 *     caption (`t.starters.habits.exampleLabel`, 2026-07-28 — a suggestion styled like a
 *     real row didn't read as an example without one) + one read-only `StarterExampleRow`
 *     (no `onAdd` — the real one-tap add is the starter chips below it, same split
 *     habits.tsx's own StarterCard uses) + the same four one-tap `HABIT_STARTERS` chips.
 *     Habits exist but none are due today → the same quiet `t.noHabitsYet` one-liner
 *     habits.tsx's Today tab shows in that case, so the two surfaces never disagree.
 *   - **Quick-add**: a trailing `AddRow`, title-only, creates a daily/dailyGoal-1 habit
 *     with the same neutral default icon ('ellipse-outline') as habits.tsx's own
 *     `commitHabit` — everything else (icon/goal/recurrence/reminders) is edited later via
 *     /habit-form (tap through to /habits, then the habit's gear icon). Always rendered,
 *     regardless of which empty state (if any) is showing — mirrors habits.tsx's own
 *     Today tab, where the quick-add row sits below the section unconditionally.
 *   - Collapsed sizing / badge-and-wash-outside-padding follow the exact same pattern as
 *     HomeShoppingCard/HomeNotesCard/PlanTaskCard — see any of those files' own edit notes
 *     for the native-vs-web absolute-positioning caveat if touching `badgeFixed`.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import ProgressBar from '@/components/ProgressBar';
import HabitIcon from '@/components/HabitIcon';
import StarterExampleRow from '@/components/StarterExampleRow';
import AddRow from '@/components/AddRow';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useHabitStore, Habit } from '@/store/useHabitStore';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
import { HABIT_STARTERS } from '@/lib/habitStarters';
import { getDomainColor } from '@/lib/domainColor';

const COLLAPSED_COUNT = 5;

export default function HomeHabitsCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'habit');
  const today = todayStr();

  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const increment = useHabitStore((s) => s.increment);
  const decrement = useHabitStore((s) => s.decrement);
  const addHabit = useHabitStore((s) => s.add);

  const [expanded, setExpanded] = useState(false);
  const [habitDraft, setHabitDraft] = useState('');

  const dueTodayHabits = habits.filter((h) => habitOccursOn(h, today));
  const doneCount = dueTodayHabits.filter((h) => habitProgress(h, logs, today).isDone).length;
  const pendingCount = dueTodayHabits.length - doneCount;

  const visibleHabits = expanded ? dueTodayHabits : dueTodayHabits.slice(0, COLLAPSED_COUNT);
  const showToggle = dueTodayHabits.length > COLLAPSED_COUNT;

  function handleTitlePress() {
    router.push('/habits');
  }

  // Same new-habit shape app/habit-form.tsx writes, minus the fields the quick-add/starter
  // chips leave at their defaults — mirrors habits.tsx's own createHabit exactly (icon and
  // dailyGoal are the only inputs that actually vary between the two callers there).
  function createHabit(title: string, icon: string, dailyGoal: number) {
    addHabit({
      title,
      icon,
      kind: 'neutral',
      category: 'other',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal,
      recurrence: 'daily',
      recurrenceDays: [],
      notificationEnabled: false,
      notificationTimes: [],
      reminderMode: null,
      reminderCount: null,
      reminderIntervalMin: null,
      reminderStart: null,
      reminderEnd: null,
      routineOrder: 0,
      childName: '',
      energyEnabled: false,
      energyValue: 1,
      goalId: null,
    });
    success();
  }

  function commitHabit() {
    const title = habitDraft.trim();
    if (!title) return;
    // Neutral "to-do" marker default, matching habits.tsx's own quick-add — a star reads
    // as a reward/rating, against the app's no-shame framing.
    createHabit(title, 'ellipse-outline', 1);
    setHabitDraft('');
  }

  function renderHabitRow(habit: Habit) {
    const { count, goal, isDone } = habitProgress(habit, logs, today);
    return (
      <View key={habit.id} style={styles.row}>
        <View
          style={[
            styles.rowCard,
            { backgroundColor: rgba(domainColor.accent, 0.05) },
            { borderColor: rgba(domainColor.accent, 0.2) },
          ]}
        >
          {isDone
            ? <Ionicons name="checkmark" size={16} color={domainColor.accent} />
            : <HabitIcon icon={habit.icon} size={16} color={domainColor.accent} />}
          <Text
            numberOfLines={1}
            style={[
              styles.rowTitle,
              { color: isDone ? theme.textMuted : theme.text },
              isDone && { textDecorationLine: 'line-through' },
            ]}
          >
            {habit.title}
          </Text>
        </View>
        <View style={styles.adjRow}>
          <PressableScale
            style={[styles.adjBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => { tap(); decrement(habit.id, today); }}
            hitSlop={8}
            scaleTo={0.9}
          >
            <Text style={[styles.adjBtnText, { color: theme.textMuted }]}>−</Text>
          </PressableScale>
          <PressableScale
            style={[styles.adjBtn, styles.adjBtnPlus, { backgroundColor: domainColor.accent }]}
            onPress={() => {
              if (!isDone && count + 1 >= goal) success();
              else tap();
              increment(habit.id, today);
            }}
            hitSlop={8}
            scaleTo={0.9}
          >
            <Text style={[styles.adjBtnPlusText, { color: theme.accentInk }]}>+</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      {/* Header wash + badge mount OUTSIDE cardContent, directly in Surface — see
          HomeShoppingCard/HomeNotesCard's "Badge/wash moved outside cardContent's padding"
          edit note for why (native padding inheritance vs. react-native-web). */}
      <CardAccentWash domain="habit" />
      <CardAccentBadge domain="habit" size={32} style={styles.badgeFixed} />
      <View style={styles.cardContent}>
        <PressableScale onPress={handleTitlePress} style={styles.titleRowPressable} scaleTo={0.97}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{t.habitsTitle}</Text>
            {pendingCount > 0 && (
              <View style={[styles.badge, { backgroundColor: domainColor.soft, borderColor: rgba(domainColor.accent, 0.4) }]}>
                <Text style={[styles.badgeText, { color: domainColor.accent }]}>{pendingCount}</Text>
              </View>
            )}
          </View>
          {dueTodayHabits.length > 0 && (
            <ProgressBar
              value={doneCount / dueTodayHabits.length}
              color={domainColor.accent}
              height={4}
              style={styles.progressBar}
            />
          )}
        </PressableScale>

        {habits.length === 0 ? (
          // No habits AT ALL — explainer + labelled example + one-tap starters (mirrors
          // habits.tsx's Today-tab StarterCard exactly, inlined so this card doesn't nest
          // a Surface inside a Surface).
          <View style={styles.emptyWrap}>
            <View style={styles.emptyTextRow}>
              <Ionicons name="bulb-outline" size={14} color={theme.textMuted} style={styles.emptyBulb} />
              <Text style={[styles.emptyExplainer, { color: theme.text }]}>{t.starters.habits.text}</Text>
            </View>
            <Text style={[styles.exampleDivider, { color: theme.textMuted }]}>{t.starters.habits.exampleLabel}</Text>
            <StarterExampleRow
              icon={HABIT_STARTERS[0].icon}
              title={t.starters.habits.suggestions[HABIT_STARTERS[0].key]}
              meta={`0/${HABIT_STARTERS[0].dailyGoal}`}
              accent={domainColor.accent}
            />
            <Text style={[styles.starterTapLabel, { color: theme.textMuted }]}>{t.starters.habits.tapToAdd}</Text>
            <View style={styles.starterChips}>
              {HABIT_STARTERS.map((s) => (
                <PressableScale
                  key={s.key}
                  onPress={() => createHabit(t.starters.habits.suggestions[s.key], s.icon, s.dailyGoal)}
                  scaleTo={0.96}
                  accessibilityRole="button"
                  accessibilityLabel={t.starters.habits.suggestions[s.key]}
                  style={[styles.starterChip, { borderColor: domainColor.accent, backgroundColor: theme.surfaceMuted }]}
                >
                  <HabitIcon icon={s.icon} size={13} color={domainColor.accent} />
                  <Text style={[styles.starterChipText, { color: theme.text }]}>{t.starters.habits.suggestions[s.key]}</Text>
                  <Ionicons name="add" size={13} color={domainColor.accent} />
                </PressableScale>
              ))}
            </View>
          </View>
        ) : dueTodayHabits.length === 0 ? (
          // Habits exist but none occur today — the same quiet one-liner habits.tsx's
          // Today tab shows in this case.
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
        ) : (
          <View style={styles.rowsContainer}>
            {visibleHabits.map(renderHabitRow)}
          </View>
        )}

        <AddRow
          placeholder={t.health.addHabit}
          value={habitDraft}
          onChangeText={setHabitDraft}
          onSubmit={commitHabit}
          accent={domainColor.accent}
          accessibilityLabel={t.health.addHabit}
        />

        {showToggle && (
          <PressableScale
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
            scaleTo={0.97}
          >
            <Text style={[styles.footerBtnText, { color: domainColor.accent }]}>
              {expanded ? t.home.habitsCollapse : t.home.habitsExpand}
            </Text>
          </PressableScale>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Collapsed-only floor so Habits reads the same size as its Notes/Plans/Shopping
  // siblings regardless of how few habits are due — see constants/theme.ts.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  cardContent: { flex: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.md + 4 },
  titleRowPressable: { marginBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: 52 },
  badgeFixed: { position: 'absolute', top: Spacing.md + 4, left: Spacing.md, zIndex: 2 },
  progressBar: { marginTop: Spacing.xs },
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, includeFontPadding: false, textAlignVertical: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  emptyWrap: { gap: Spacing.sm, marginBottom: Spacing.sm },
  emptyTextRow: { flexDirection: 'row', gap: Spacing.xs },
  emptyBulb: { marginTop: 2 },
  emptyExplainer: { flex: 1, fontSize: FontSize.sm, lineHeight: 20, fontFamily: Fonts.medium, fontStyle: 'italic' },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  // "Example habits" divider caption — mirrors components/StarterCard's own exampleLabel
  // caption styling so the two surfaces read as one system.
  exampleDivider: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
  starterTapLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  starterChipText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  rowsContainer: { gap: Spacing.xs, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  rowTitle: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  adjRow: { flexDirection: 'row', gap: 4 },
  adjBtn: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnPlus: { borderWidth: 0 },
  adjBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, lineHeight: FontSize.sm },
  adjBtnPlusText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, lineHeight: FontSize.sm },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
});
