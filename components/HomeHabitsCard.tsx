/**
 * HomeHabitsCard.tsx — Home-screen preview of today's habits, mirroring PlanTaskCard/
 * HomeShoppingCard's Surface + domain-colored-border layout.
 *
 * Rebuilt on the shared pad language 2026-07-30 (components/PadSheet + PadRow + PadTypeRow +
 * PadFooterToggle): ruled lines, a "Type habit" line on the first rule, the check/counter in the
 * right margin, and one chevron cycling the card's three sizes. The per-row bordered `rowCard`
 * fill is gone — a bordered box per row is the opposite of a ruled sheet.
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
 *     habits.tsx's own StarterCard uses) + one-tap `HABIT_STARTERS` chips, capped at
 *     `STARTER_PREVIEW_COUNT` (see that constant — the Habits TAB still offers all four).
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
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, PAD_GUTTER, Radius, Spacing, TabularNums } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useHabitStore, Habit } from '@/store/useHabitStore';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
import { HABIT_STARTERS } from '@/lib/habitStarters';
import { getDomainColor } from '@/lib/domainColor';
import { padVisibleRows } from '@/lib/padState';
import { useCardState } from '@/lib/useCardState';


/**
 * How many starter chips the EMPTY card offers. Two, not the full four — the same call, for
 * the same measured reason, as HomeGoalsCard's STARTER_PREVIEW_COUNT. This card shipped
 * (#418) before the Goals card found the problem (#423), so it kept rendering all four:
 * `npm run wraps --lang=no` had the row wrapping at EVERY width tested — two lines even at
 * 430px, and four lines (one chip per line) at 327px, which is a lot of Home to hand an
 * empty state. The other two starters stay on the Habits tab, one tap away via the title.
 */
const STARTER_PREVIEW_COUNT = 2;

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

  const [state, setState] = useCardState('habits');
  const [habitDraft, setHabitDraft] = useState('');

  const dueTodayHabits = habits.filter((h) => habitOccursOn(h, today));
  const doneCount = dueTodayHabits.filter((h) => habitProgress(h, logs, today).isDone).length;
  const pendingCount = dueTodayHabits.length - doneCount;

  const visibleHabits = padVisibleRows(dueTodayHabits, state);

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

  /**
   * One habit as a pad row. The trailing control is a −/+ pair rather than a check whenever
   * `dailyGoal > 1` — a single tap can't mean "done" for "drink 4 glasses of water" — and a
   * plain check when the goal is 1, so the common case matches every other pad row in the app.
   * Either way the row only strikes through once the day's FULL count is met (habitProgress's
   * `isDone`), which is the maintainer's rule: a partial day is not a failed one.
   */
  function renderHabitRow(habit: Habit) {
    const { count, goal, isDone } = habitProgress(habit, logs, today);
    const counted = () => {
      if (!isDone && count + 1 >= goal) success();
      else tap();
      increment(habit.id, today);
    };
    return (
      <PadRow
        key={habit.id}
        title={habit.title}
        accent={domainColor.accent}
        done={isDone}
        leading={
          isDone ? (
            <Ionicons name="checkmark" size={16} color={domainColor.accent} />
          ) : (
            <HabitIcon icon={habit.icon} size={16} color={domainColor.accent} />
          )
        }
        rightValue={goal > 1 ? `${count}/${goal}` : undefined}
        onPress={() => router.push('/habits')}
        trailing={
          goal > 1 ? (
            <View style={styles.adjRow}>
              <PressableScale
                style={[styles.adjBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => { tap(); decrement(habit.id, today); }}
                hitSlop={8}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${t.decreaseQty} ${habit.title}`}
              >
                <Text style={[styles.adjBtnText, { color: theme.textMuted }]}>−</Text>
              </PressableScale>
              <PressableScale
                style={[styles.adjBtn, styles.adjBtnPlus, { backgroundColor: domainColor.accent }]}
                onPress={counted}
                hitSlop={8}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${t.increaseQty} ${habit.title}`}
              >
                <Text style={[styles.adjBtnText, { color: theme.accentInk }]}>+</Text>
              </PressableScale>
            </View>
          ) : undefined
        }
        onToggle={goal > 1 ? undefined : () => (isDone ? decrement(habit.id, today) : counted())}
        toggleLabel={habit.title}
      />
    );
  }

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      style={[styles.card, state !== 'open' && styles.cardCollapsed]}
    >
      {/* Header wash + badge mount OUTSIDE cardContent, directly in Surface — see
          HomeShoppingCard/HomeNotesCard's "Badge/wash moved outside cardContent's padding"
          edit note for why (native padding inheritance vs. react-native-web). */}
      <CardAccentWash domain="habit" />
      <View style={styles.cardContent}>
        {/* Badge is a normal flex child — one left edge for the whole card. */}
        <PressableScale onPress={handleTitlePress} style={styles.titleRowPressable} scaleTo={0.98}>
          <View style={styles.titleRow}>
            <CardAccentBadge domain="habit" size={32} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{t.habitsTitle}</Text>
              {dueTodayHabits.length > 0 && (
                <Text style={[styles.summary, { color: theme.textMuted }]}>
                  {t.pad.summary(pendingCount, dueTodayHabits.length)}
                </Text>
              )}
            </View>
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
              {HABIT_STARTERS.slice(0, STARTER_PREVIEW_COUNT).map((s) => (
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
        ) : null}

        <PadSheet
          state={state}
          typeRow={
            <PadTypeRow
              prompt={t.pad.type.habit}
              value={habitDraft}
              onChangeText={setHabitDraft}
              onSubmit={commitHabit}
              accent={domainColor.accent}
            />
          }
        >
          {visibleHabits.map(renderHabitRow)}
        </PadSheet>

        <PadFooterToggle
          state={state}
          onChange={setState}
          total={dueTodayHabits.length}
          accent={domainColor.accent}
        />
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Minimum height for the CLOSED and PREVIEW states, never for OPEN (maintainer's call,
  // 2026-07-30): the four cards read as one intentional size at rest, and an open card is free
  // to grow to whatever its content needs. Same constant, and the same "only while not fully
  // open" gate, the pre-pad card used — `state !== 'open'` is what `!expanded` used to mean.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // Collapsed-only floor so Habits reads the same size as its Notes/Plans/Shopping
  // siblings regardless of how few habits are due — see constants/theme.ts.
  // ONE horizontal inset for the whole card (PAD_GUTTER). The height floor is `cardCollapsed`
  // above — applied while not open, see its comment.
  cardContent: { paddingHorizontal: PAD_GUTTER, paddingTop: PAD_GUTTER, paddingBottom: PAD_GUTTER },
  titleRowPressable: { marginBottom: Spacing.md },
  // Badge is a normal flex child now, so there is no paddingLeft dodging an absolute one.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  // Tabular figures so the four Home cards' counts line up down the screen.
  summary: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, ...TabularNums },
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

});
