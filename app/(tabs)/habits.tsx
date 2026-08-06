/**
 * habits.tsx — Habits (today/week/month tracking), its own bottom-nav tab.
 *
 * Today/week/month view tabs, an optional child-profile selector, and per-habit cards
 * (progress dots, week strip, rest-day toggle, quick-add).
 *
 * **Split out of app/(tabs)/health.tsx (2026-07-23, UX audit finding E1)**: Habits used
 * to be embedded inside the Health tab — but Health's tab name/icon promised symptom
 * tracking, and a whole separate habit-building system living inside it was a
 * name-vs-content mismatch a user had to learn by accident. This file is that embedded
 * section, unchanged in behavior, promoted back to its own bottom-nav tab (replacing
 * Scan — see lib/siteNav.ts's Edit notes for the full E1/E2 rationale). Health keeps
 * only its symptom-tracking content.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/Surface,
 *             components/PadRow (2026-08-01 — the shared row shell each habit's header line is
 *             drawn through; see HabitCard's own PadRow mount for what that changed and for why
 *             PadSheet was NOT adopted with it), components/PadTypeRow (the always-open
 *             "Type habit" line at the foot of the
 *             Today list — replaced an AddRow that was wrapped in its own Surface, which is
 *             exactly what AddRow's header tells callers not to do), components/QuickAddOptionsPanel
 *             + components/QuickAddOptionRow (2026-08-04 — the type line's Energy row, closing
 *             the parity gap with HomeHabitsCard's own quick-add, which already had it),
 *             components/Stepper + lib/energy (energyFieldsFromStepper — that row's signed
 *             − 0 + control since 2026-08-05, replacing a tap-cycle; the type line also gained
 *             the "More options" button Home's copy already had, same date, same reason),
 *             components/AnimatedListItem (habit
 *             add/remove fade), components/DraggableTaskRow (the long-press-drag gesture),
 *             components/GlowPulse (done-state static halo),
 *             components/HabitIcon (starter chips only — every ROW's leading mark goes through
 *             components/HabitLeading, 2026-08-04, which draws the brand leaf when a habit has
 *             no chosen icon), components/StageTree (2026-08-04 — the ambient `full`-stage
 *             corner watermark, suppressed while the StarterCard's own tree is up),
 *             components/EmptyState, components/StarterCard
 *             (first-run explainer at `stage="sprout"` — no example row since 2026-07-30; the
 *             starter chips in its `children` slot are the example), components/SlideSelector,
 *             components/PressableScale,
 *             components/GoalGlowDot (goal glow), components/SubScreenLinkButton (2026-07-29,
 *             the "Edit Goals" link — see below), components/GoalsSheet (2026-07-31, the popup
 *             that link opens), components/DebugNoteAnchor, components/GhostRow (2026-08-01,
 *             the "just deleted this habit — restore?" row, see below),
 *             constants/theme, lib/date, lib/haptics, lib/habitStarters, lib/i18n,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/useDragReorder (drag-to-reorder),
 *             lib/useGhostTimeout (2026-08-01, the ghost row's timing),
 *             lib/prefill (usePrefill — a note sent here seeds the quick-add), lib/domainColor,
 *             lib/habitRecurrence, store/useHabitStore, store/useGoalStore, store/useSettingsStore
 *   - Habit Today/Week/Month uses the shared SlideSelector; the person filter row +
 *     habit-form "For" chips are gated on settings.peopleModeEnabled (People/family
 *     mode). Profile add/remove lives in app/settings.tsx, not here.
 *   Used by → Expo Router route "/habits" — one of 5 co-mounted pager tabs under
 *             app/(tabs)/_layout.tsx (BottomNav "Habits" tab)
 *   Data    → useHabitStore (habits + habit_logs) via increment/decrement/markRestDay/add;
 *             colour theme + language + child profiles + featureGoals from useSettingsStore; useGoalStore
 *             (linked goal glow only)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - **Inline "ghost" undo row (2026-08-01)**: deleting a habit (there's no delete affordance
 *     on this screen — only app/habit-form.tsx's Delete button) is now a soft-delete
 *     (useHabitStore's `lastDeleted`), and the Today list renders a GhostRow with a restore
 *     action for a few seconds after, or until you leave this tab (lib/useGhostTimeout.ts),
 *     whichever is first. It's appended after the Today list's own empty/populated branch so it still
 *     shows even when deleting was the habit that made the list empty. habit-form.tsx's old
 *     confirm-before-delete dialog is gone with it — same "undo, not confirm" call already
 *     made for tasks.
 *   - **Edit Goals link (2026-07-29, moved + renamed + popup 2026-07-31)**: a
 *     SubScreenLinkButton sits at the BOTTOM of the screen, below the habit list — moved off
 *     its original spot right under HintCard so it stops outranking the day's habits on every
 *     visit. Gated on `featureGoals` — one of Goals' two entry points now that it no longer
 *     has its own Home card (see app/goals.tsx's header). Opens components/GoalsSheet.tsx as
 *     a popup (was `router.push('/goals')`) so editing goals doesn't leave this tab; the
 *     `/goals` route itself is unchanged and still reachable directly (deep links, notes'
 *     "Send it to…"). Mirrors app/(tabs)/plans.tsx's identical link.
 *   - **No streaks (2026-07-20)**: the habit card shows an Energy badge (habit.energyValue,
 *     from the optional Energy system, lib/energy.ts) instead of a streak counter — only
 *     for habits with `energyEnabled`. Rest day no longer needs to "protect" anything (it
 *     never drove Energy) — see lib/energy.ts's habitMetOn for the exemption.
 *   - **Simplified (2026-07-30, user report: "this is generally too messy, simplify")**: three
 *     changes, no features removed. (1) The wrapping `SectionCard` became a plain `Surface`:
 *     its header label was the string "Habits" — this screen's own title, verbatim, a second
 *     time — and it made every habit card a Surface inside a Surface inside a Surface.
 *     (2) The add row's own Surface wrapper is gone (see PadTypeRow above). (3) `HabitCard`'s
 *     header followed the row rule: it used to pack up to NINE elements onto one line, and the
 *     goal dot / weekly progress / done state / energy badge moved onto ONE meta line under
 *     the title, with today's count as the single right-hand value. `hasMetaLine` must mirror
 *     that line's JSX gates exactly. **The done state left that line again on 2026-08-01**:
 *     once the row itself strikes through and fades beside a filled check (the PadRow
 *     conversion), a "Done today" word was a third copy of one fact — so the meta line now
 *     holds three things, not four, and `hasMetaLine` dropped `isDone` with it.
 *   - **Drag to reorder (2026-08-01)**: hold a habit card ~400ms and drag it, the same
 *     gesture Home's preview cards and the shopping list have always had, now shared through
 *     lib/useDragReorder.ts. Two things to know before touching it. The Today list is
 *     filtered by person AND by "is it due today", so the ids committed on drop are a SUBSET
 *     of the habits table — useHabitStore.reorder() slots them back among the rows the user
 *     couldn't see instead of renumbering the visible ones 0…n-1, so a habit that isn't due
 *     today keeps whichever habits it sat between. And the list must render from
 *     `habitDrag.order` (`draggedHabits`), never from `visibleHabits` directly, or nothing
 *     moves under the finger. Week/Month views are not draggable: they are a calendar, and a
 *     calendar's order is the calendar's.
 *   - **Add-habit affordance (2026-07-13 rows pass)**: an inline `AddRow` at the bottom of
 *     the Today habit list is the add-habit trigger — a title-only quick-create with sensible
 *     defaults (icon/goal/recurrence via `commitHabit` → useHabitStore.add), matching Plans'
 *     AddRow → addTask flow; tap a habit card's settings-gear icon (2026-07-21, replaced
 *     long-press) to edit the rest in /habit-form. This
 *     replaced the old header "+" AddFAB (which navigated straight to the form). Week/Month
 *     views show plain, non-interactive empty-state text (they dropped their `onAddHabit` prop).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore, Habit, HabitKind } from '@/store/useHabitStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useSettingsStore, type HabitViewTab as SettingsHabitViewTab } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import { personColor } from '@/lib/personColor';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import Surface from '@/components/Surface';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import Stepper from '@/components/Stepper';
import { energyFieldsFromStepper } from '@/lib/energy';
import AnimatedListItem from '@/components/AnimatedListItem';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import Collapsible from '@/components/Collapsible';
import GlowPulse from '@/components/GlowPulse';
import HabitIcon from '@/components/HabitIcon';
import HabitLeading from '@/components/HabitLeading';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import EmptyState from '@/components/EmptyState';
import StarterCard from '@/components/StarterCard';
import StageTree from '@/components/StageTree';
import SubScreenLinkButton from '@/components/SubScreenLinkButton';
import GoalsSheet from '@/components/GoalsSheet';
import GhostRow from '@/components/GhostRow';
import { HABIT_STARTERS, HabitStarter } from '@/lib/habitStarters';
import { useGhostTimeout } from '@/lib/useGhostTimeout';

/** Starter chips the empty Habits list offers. See the row's own comment for the measurement. */
const HABIT_STARTER_CHIPS = 2;
import SlideSelector from '@/components/SlideSelector';
import PressableScale from '@/components/PressableScale';
import { useT } from '@/lib/i18n';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { useDragReorder } from '@/lib/useDragReorder';
import { usePrefill } from '@/lib/prefill';
import { todayStr, getWeekDates, getMonthDates } from '@/lib/date';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
// TabularNums went with the hand-rolled `habitCount` style — PadRow's `rightValue` already
// carries it, so the count still lines up column-wise without this file importing it.
import { BORDER_WIDTH, computeBorderTone, FontSize, PAD_GUTTER, Radius, Shadow, Spacing, Fonts, Type, HitSlop } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { useScreenColor, getScreenColor } from '@/lib/screenColor';
import { success, selection, tap } from '@/lib/haptics';

// Habits are no longer split into build/break — a single calm "met" colour (good),
// with accent for in-progress and a neutral border for not-yet-started. The `kind`
// param is retained only so existing call sites compile; it no longer affects colour.
function habitColor(_kind: HabitKind, theme: ThemePalette): string {
  return theme.good;
}

function progressColor(ratio: number, _kind: HabitKind, theme: ThemePalette): string {
  if (ratio >= 1) return theme.good;
  if (ratio > 0) return theme.accent;
  // No-shame: zero progress uses a calm neutral border — no red punishment colour.
  return theme.border;
}

// shouldShowHabitOnDate lived here; now lib/habitRecurrence.ts's habitOccursOn (also
// used by lib/energy.ts and lib/widgets/sync.ts, so the "is this due" logic exists
// in exactly one place, including 'weekly-flexible' support).

/**
 * A single day's dot-fill ratio for the Week/Month grids and WeekStrip. For a
 * `weekly-flexible` habit each day is binary (did anything get logged that day?) —
 * dividing by the weekly goal would leave every day's dot barely filled. Fixed-
 * schedule habits keep the existing count/dailyGoal ratio.
 */
function dotRatio(habit: Habit, count: number): number {
  if (habit.recurrence === 'weekly-flexible') return count > 0 ? 1 : 0;
  return habit.dailyGoal > 0 ? Math.min(count / habit.dailyGoal, 1) : 0;
}

const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_ABBR_NO = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

// No streaks (2026-07-20) — habits with the optional Energy system enabled show their
// signed energy value instead (positive restores the day's/week's budget, negative drains
// it — lib/energy.ts). Habits without energyEnabled show nothing here.
function EnergyBadge({ value, theme }: { value: number; theme: ThemePalette }) {
  const styles = useScaledStyles(baseStyles);
  const positive = value >= 0;
  const color = positive ? theme.good : theme.bad;
  return (
    <View style={[styles.energyPill, { borderColor: color }]}>
      <Ionicons name="flash" size={11} color={color} />
      <Text style={[styles.energyPillText, { color }]}>{positive ? `+${value}` : `${value}`}</Text>
    </View>
  );
}

function WeekStrip({
  habit, today, kind, lang, theme,
}: {
  habit: Habit; today: string; kind: HabitKind; lang: string; theme: ThemePalette;
}) {
  const logs = useHabitStore((s) => s.logs);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const abbr = lang === 'no' ? DAY_ABBR_NO : DAY_ABBR;
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.weekStrip}>
      {weekDates.map((date, i) => {
        const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
        const count = log?.count ?? 0;
        const ratio = dotRatio(habit, count);
        const isFuture = date > today;
        const isRest = !!log?.restDay;
        // Rest days get a solid textMuted fill — distinct from both "met" and "missed".
        const color = isFuture ? theme.border : isRest ? theme.textMuted : progressColor(ratio, kind, theme);
        const filled = !isFuture && (isRest || ratio > 0);
        const isToday = date === today;
        return (
          <View key={date} style={styles.dayCol}>
            <Text style={[styles.dayAbbr, { color: theme.textMuted }, isToday && { color: theme.accent, fontFamily: Fonts.bold }]}>{abbr[i]}</Text>
            <View
              style={[
                styles.weekDot,
                { borderColor: color, backgroundColor: filled ? color : 'transparent' },
                isToday && styles.weekDotToday,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function HabitCard({
  habit, today, onEdit, lang, theme, first,
}: {
  habit: Habit; today: string; onEdit: (id: string) => void; lang: string; theme: ThemePalette;
  /** First row in the list — draws no divider above it. */
  first?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDark = useIsDark();
  const screenHue = useScreenColor() ?? theme.border;
  const logs = useHabitStore((s) => s.logs);
  const increment = useHabitStore((s) => s.increment);
  const decrement = useHabitStore((s) => s.decrement);
  const markRestDay = useHabitStore((s) => s.markRestDay);
  // Goals — the linked goal (if any), for the living-glow dot next to the title. Hidden
  // unless settings.featureGoals is on (opt-in, off for fresh installs); the habit's own
  // goalId is untouched, so turning the feature back on restores the dot.
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const goalForDot = useGoalStore((s) => (habit.goalId ? s.goals.find((g) => g.id === habit.goalId) ?? null : null));
  const linkedGoal = featureGoals ? goalForDot : null;
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const log = logs.find((l) => l.habitId === habit.id && l.logDate === today);
  const isRestToday = log?.restDay ?? false;
  const { count, goal, ratio, isDone } = habitProgress(habit, logs, today);
  const isWeeklyFlexible = habit.recurrence === 'weekly-flexible';
  // MUST mirror the meta-line JSX gates below exactly (the trap components/TaskCard.tsx
  // documents): if the two drift, a habit with only one meta item silently loses its line.
  const hasMetaLine = !!linkedGoal || isWeeklyFlexible || habit.energyEnabled;

  const accent = habitColor(habit.kind, theme);
  // Boxed row (card design reset, 2026-08-05) — the same border this screen's rows get inside
  // components/PadSheet.tsx: the screen hue at the FIELD rung, one step lighter than the card's
  // own edge, so a card full of rows reads as a hierarchy rather than as a grid.
  const rowBox = {
    borderWidth: BORDER_WIDTH.field,
    borderColor: computeBorderTone(screenHue, isDark, 'field'),
    borderRadius: Radius.sm,
  };

  const prevDone = useRef(isDone);
  useEffect(() => {
    if (isDone && !prevDone.current) {
      success();
    }
    prevDone.current = isDone;
  }, [isDone]);

  // Decision 043 rule 3 / Decision 014 downstream to-do: progress/done state reads from
  // the 4px accent bar only — the card body stays theme.surface regardless of state
  // (donePill/checkmark already carry the "done" signal).
  const barColor = isDone ? accent : progressColor(ratio, habit.kind, theme);

  /**
   * The "+ one" path, shared by the `+` button (goal > 1) and the check (goal 1).
   * `success()` is deliberately NOT fired here even though HomeHabitsCard's own `counted`
   * does: this screen has always fired it from the `isDone` effect above, so firing it here
   * as well would double the haptic on the exact tap that completes the goal. The lesser taps
   * get the light one.
   */
  const counted = () => {
    if (count + 1 < goal) selection();
    increment(habit.id, today);
  };

  return (
      <View style={styles.habitGlowWrap}>
      <GlowPulse active={isDone} color={accent} mode="static" radius={0} />
      {/* Boxed row (card design reset, 2026-08-05): this used to be a hairline `theme.rule`
          divider between flush rows. It is now its own bordered box in the screen's hue at the
          FIELD rung, matching components/PadSheet.tsx exactly — this screen's rows and the
          Home habits card's rows are the same object, which is the point of the reset. */}
      <View style={[styles.habitCard, rowBox, !first && styles.habitCardStacked]}>
        <View style={[styles.habitAccent, { backgroundColor: barColor }]} />
        <View style={styles.habitCardContent}>

        {/* Row rule (2026-07-30, user report: "this is generally too messy, simplify"). This
            header used to pack up to NINE elements onto one line — icon, title, goal dot,
            weekly-progress text, a "Done today" pill, the gear, an Energy badge, and the −/+
            pair — which is why a list of them read as noise. Now: icon → title → ONE meta line
            (goal dot · weekly progress · energy) → ONE right-hand value (the count) → ⋯ →
            the check or the −/+ control. Nothing was removed; the middle four moved down a line.

            **Drawn by components/PadRow.tsx since 2026-08-01 (B2-3, inverted).** The audit
            behind that task found the shared row primitive was imported by the four HOME cards
            and by no tab screen at all — so Home was the newer code and the tabs were what had
            drifted, and the task's "convert Home to match the tabs" direction ran backwards.
            This screen was converted first. What changed with the shell: the gear became
            PadRow's ONE ⋯ action (the row rule's "one row-level action button"), a habit whose
            `dailyGoal` is 1 now gets a real check instead of a −/+ pair it never needed (the
            −/+ stays for `goal > 1`, where one tap genuinely can't mean "done" — that is the
            whole reason the pair exists), and `count/goal` is suppressed for those goal-1
            habits because the check already says it. `done` now strikes and fades the WHOLE
            row, which is the shared finished-row treatment a ticked note/task/shopping item
            already had.

            What deliberately did NOT change: the card shell around this row. The 4px progress
            bar, the done-state GlowPulse halo and the expandable week-strip/rest-day drawer
            below are all things a Home pad row has no equivalent of, and they are why this
            surface is a card and not a bare line on a ruled sheet. PadSheet was NOT adopted
            here for the same reason plus one more — its `typeRow` is pinned as the pad's FIRST
            line, and this screen's add row deliberately sits at the BOTTOM of the list (see the
            PadTypeRow mount below). */}
        <PadRow
          title={habit.title}
          // theme.good, via habitColor. Every completion signal on this screen is already the
          // good token (the bar, the halo, the checkmark, the done word), so the new check
          // takes it too — Home passes its habit DOMAIN hue there instead, which is the one
          // remaining divergence between the two surfaces and is a colour call, not this one.
          accent={accent}
          done={isDone}
          // A.4: done is a STATUS, so it takes the status token as ink; the habit's own glyph
          // is neutral. Mirrors HomeHabitsCard's leading exactly.
          // A habit with no chosen icon used to draw NO leading mark — the neutral default is a
          // hollow circle, and this row already ends in one (the check), so two identical rings
          // with the leading one inert was the result. As of 2026-08-04 (design comparison task
          // 04(a)) that hole is filled with the brand leaf instead: a leaf is not a circle, so
          // it can't be confused with the check the way the ellipse was. components/HabitLeading
          // owns that decision for all four habit row sites — don't re-inline the gate here.
          leading={isDone
            ? <Ionicons name="checkmark" size={22} color={theme.good} />
            : <HabitLeading icon={habit.icon} size={22} color={theme.textMuted} />}
          meta={hasMetaLine ? (
            <>
              {linkedGoal ? (
                <GoalGlowDot color={linkedGoal.color} strength={linkedGoal.strength} strengthUpdatedAt={linkedGoal.strengthUpdatedAt} size={9} />
              ) : null}
              {isWeeklyFlexible && (
                <Text style={[styles.weeklyProgressText, { color: theme.textMuted }]}>
                  {t.habits.weeklyProgress(count, goal)}
                </Text>
              )}
              {/* "Done today" used to sit here as a filled pill, then (2026-07-30) as a quiet
                  word. It is gone entirely as of 2026-08-01: since the PadRow conversion the
                  row STRIKES THROUGH and fades next to a filled check, so the word was the
                  third copy of one fact on a line that exists to hold the other three. Its
                  string went with it (`habits.doneToday` in lib/i18n.ts, both languages — this
                  was its only caller; plans.tsx's focus layout has its own `focusFirst.doneToday`
                  and is untouched). */}
              {habit.energyEnabled && <EnergyBadge value={habit.energyValue} theme={theme} />}
            </>
          ) : undefined}
          // The ONE right-hand value: today's count against the goal. Suppressed when the goal
          // is 1 — the check to its right already carries that, and "1/1" beside a ticked
          // circle is the same fact twice (HomeHabitsCard made this call first).
          rightValue={goal > 1 ? `${count}/${goal}` : undefined}
          onPress={() => setExpanded((v) => !v)}
          onAction={() => onEdit(habit.id)}
          actionLabel={t.habits.editButtonLabel}
          trailing={goal > 1 ? (
            <View style={styles.adjRow}>
              <PressableScale
                style={[styles.adjBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => { selection(); decrement(habit.id, today); }}
                hitSlop={HitSlop.base}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${t.decreaseQty} ${habit.title}`}
              >
                <Text style={[styles.adjBtnText, { color: theme.textMuted }]}>−</Text>
              </PressableScale>
              <PressableScale
                style={[styles.adjBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={counted}
                hitSlop={HitSlop.base}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${t.increaseQty} ${habit.title}`}
              >
                <Text style={[styles.adjBtnPlusText, { color: theme.text }]}>+</Text>
              </PressableScale>
            </View>
          ) : undefined}
          onToggle={goal > 1 ? undefined : () => (isDone ? decrement(habit.id, today) : counted())}
          toggleLabel={habit.title}
        />

        {expanded && (
          <View style={styles.expanded}>
            <View style={[styles.weekStripWrap, { borderTopColor: theme.border }]}>
              <WeekStrip
                habit={habit}
                today={today}
                kind={habit.kind}
                lang={lang}
                theme={theme}
              />
            </View>
            <PressableScale
              style={[
                styles.restDayBtn,
                { borderColor: theme.border },
                isRestToday && { backgroundColor: theme.textMuted, borderColor: theme.textMuted },
              ]}
              onPress={() => {
                selection();
                markRestDay(habit.id, today);
              }}
              scaleTo={0.97}
            >
              <Ionicons name="moon" size={14} color={isRestToday ? theme.textInverse : theme.textMuted} />
              <Text style={[styles.restDayText, { color: isRestToday ? theme.textInverse : theme.textMuted }]}>
                {isRestToday ? t.habits.restingToday : t.habits.restDay}
              </Text>
            </PressableScale>
            {isRestToday && (
              <Text style={[styles.restDayHint, { color: theme.textMuted }]}>{t.habits.restDayHint}</Text>
            )}
          </View>
        )}
        </View>
      </View>
      </View>
  );
}

// ─── Week overview ───────────────────────────────────────────────────────────

function WeekView({
  habits, today, lang, theme,
}: {
  habits: Habit[]; today: string; lang: string; theme: ThemePalette;
}) {
  const logs = useHabitStore((s) => s.logs);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const abbr = lang === 'no' ? DAY_ABBR_NO : DAY_ABBR;
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const visibleHabits = useMemo(
    () => habits.filter((h) => weekDates.some((d) => habitOccursOn(h, d))),
    [habits, weekDates]
  );

  if (visibleHabits.length === 0) {
    return (
      <Surface style={styles.habitsEmptyCard}>
        <EmptyState title={t.noHabitsYet} />
      </Surface>
    );
  }

  return (
    <View style={styles.weekGrid}>
      <View style={styles.weekGridRow}>
        <View style={styles.weekGridLabel} />
        {weekDates.map((date, i) => (
          <View key={date} style={styles.weekGridCell}>
            <Text style={[styles.weekGridDayAbbr, { color: theme.textMuted }, date === today && { color: theme.accent, fontFamily: Fonts.bold }]}>
              {abbr[i]}
            </Text>
            <Text style={[styles.weekGridDate, { color: theme.textMuted }, date === today && { fontFamily: Fonts.bold }]}>
              {date.slice(8)}
            </Text>
          </View>
        ))}
      </View>

      {visibleHabits.map((habit) => (
        <View key={habit.id} style={styles.weekGridRow}>
          <View style={styles.weekGridLabel}>
            <HabitLeading icon={habit.icon} size={16} color={theme.textMuted} />
            <Text style={[styles.weekGridTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
          </View>
          {weekDates.map((date) => {
            const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
            const ratio = dotRatio(habit, log?.count ?? 0);
            const isFuture = date > today;
            const color = isFuture ? theme.border : progressColor(ratio, habit.kind, theme);
            const filled = !isFuture && ratio > 0;
            return (
              <View key={date} style={styles.weekGridCell}>
                <View style={[
                  styles.weekGridDot,
                  { backgroundColor: filled ? color : 'transparent', borderColor: isFuture ? theme.border : color },
                ]} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Month overview ───────────────────────────────────────────────────────────

function MonthView({
  habits, today, theme,
}: {
  habits: Habit[]; today: string; theme: ThemePalette;
}) {
  const logs = useHabitStore((s) => s.logs);
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [offset, setOffset] = useState(0);

  const { label, dates } = useMemo(() => {
    const base = new Date(today + 'T12:00:00');
    base.setMonth(base.getMonth() + offset);
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    return {
      label: `${String(m).padStart(2, '0')} / ${y}`,
      dates: getMonthDates(y, m),
    };
  }, [today, offset]);

  const minOffset = useMemo(() => {
    const cutoff = new Date(today + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - 35);
    const base = new Date(today + 'T12:00:00');
    return (cutoff.getFullYear() - base.getFullYear()) * 12 + (cutoff.getMonth() - base.getMonth());
  }, [today]);

  const visibleHabits = useMemo(
    () => habits.filter((h) => dates.some((d) => habitOccursOn(h, d))),
    [habits, dates]
  );

  if (visibleHabits.length === 0) {
    return (
      <Surface style={styles.habitsEmptyCard}>
        <EmptyState title={t.noHabitsYet} />
      </Surface>
    );
  }

  return (
    <View>
      <View style={styles.monthNav}>
        <PressableScale
          onPress={() => setOffset((o) => Math.max(minOffset, o - 1))}
          style={[styles.monthNavBtn, offset <= minOffset && { opacity: 0.3 }]}
          disabled={offset <= minOffset}
          scaleTo={0.9}
        >
          <Text style={[styles.monthNavText, { color: theme.accent }]}>‹</Text>
        </PressableScale>
        <Text style={[styles.monthLabel, { color: theme.text }]}>{label}</Text>
        <PressableScale
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          style={[styles.monthNavBtn, offset >= 0 && { opacity: 0.3 }]}
          disabled={offset >= 0}
          scaleTo={0.9}
        >
          <Text style={[styles.monthNavText, { color: theme.accent }]}>›</Text>
        </PressableScale>
      </View>

      {visibleHabits.map((habit) => (
        <View key={habit.id} style={[styles.monthRow, { borderBottomColor: theme.border }]}>
          <View style={styles.monthRowLabel}>
            <HabitLeading icon={habit.icon} size={14} color={theme.textMuted} />
            <Text style={[styles.monthRowTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.monthDots}>
              {dates.map((date) => {
                const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
                const ratio = dotRatio(habit, log?.count ?? 0);
                const isFuture = date > today;
                const color = isFuture ? theme.border : progressColor(ratio, habit.kind, theme);
                const filled = !isFuture && ratio > 0;
                return (
                  <View key={date} style={styles.monthDotWrap}>
                    <Text style={[styles.monthDotDate, { color: theme.textMuted }]}>{date.slice(8)}</Text>
                    <View style={[
                      styles.monthDot,
                      { borderColor: color, backgroundColor: filled ? color : 'transparent' },
                    ]} />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

// The type itself now lives in store/useSettingsStore.ts, since the selection is persisted
// there (2026-07-27) — re-exported shape only, so the local annotations below read the same.
type HabitViewTab = SettingsHabitViewTab;

export default function HabitsScreen() {
  const router = useRouter();
  const habits = useHabitStore((s) => s.habits);
  const reorderHabits = useHabitStore((s) => s.reorder);
  // Inline "ghost" undo row (2026-08-01) — see useHabitStore's `lastDeleted` doc. There's no
  // delete affordance on this screen itself; it's app/habit-form.tsx's Delete button that
  // calls remove() and stages the ghost, then routes back here to show it. useGhostTimeout
  // owns the "a few seconds, or until you leave this tab" window; dismissLastDeleted only
  // drops the offer to restore, it never un-deletes anything itself.
  const lastDeletedHabit = useHabitStore((s) => s.lastDeleted);
  const restoreLastDeletedHabit = useHabitStore((s) => s.restoreLastDeleted);
  const dismissLastDeletedHabit = useHabitStore((s) => s.dismissLastDeleted);
  useGhostTimeout(!!lastDeletedHabit, dismissLastDeletedHabit);

  const lang = useSettingsStore((s) => s.language);
  const people = usePeopleStore((s) => s.people);
  // People/family is part of the sharing surface that's hidden while the single-user basics
  // are reworked (2026-08-05) — see lib/sharingVisibility.ts. The setting keeps its stored
  // value and every person row stays in the DB, so an existing multi-person setup returns
  // intact when the switch flips back; only the UI stands down.
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled) && SHARING_VISIBLE;
  // Gates the "Edit Goals" link at the bottom of the screen (2026-07-29) — same flag
  // HabitCard's own goal glow dot already reads, so turning Goals off hides both at once.
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);

  // The ⓘ hint is collapsed until tapped (2026-07-31 — the first-visit auto-open and its
  // `autoOpen` arg are gone); StarterCard + the one-tap starter habits already teach this.
  const [hintOpen, setHintOpen] = useFirstVisitHint('habits');
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  // This screen's own hue — used below for the starter chips + quick-add accent, which used
  // to draw lib/domainColor's 'habit' identity (dark green) against this (sky-blue) screen.
  // `getScreenColor` (plain function), not `useScreenColor` (context hook): this component
  // renders ScreenScaffold below, so it sits above that provider and the hook would read
  // the default (null → `theme.border`) here — unlike `HabitCard` below, a true descendant of
  // ScreenScaffold, whose own `useScreenColor()` call at line ~260 is correctly scoped.
  const screenHue = getScreenColor(theme, 'habits').base;

  // Persisted (2026-07-27): this was local state, so a user who lives in Week view got
  // dropped back to Today on every remount — leaving a tab and coming back, or any
  // re-render of the tabs stack. Written through settings.update so it survives a relaunch.
  const habitTab = useSettingsStore((s) => s.habitViewTab);
  const updateSettings = useSettingsStore((s) => s.update);
  const setHabitTab = useCallback(
    (v: HabitViewTab) => updateSettings({ habitViewTab: v }),
    [updateSettings]
  );
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  // Inline quick-add (replaces the old "+" bubble → form nav): create a habit from just a
  // title with sensible defaults; the rest (icon/goal/recurrence) is edited later via
  // the card's settings-gear icon → /habit-form. Mirrors Plans' AddRow → addTask flow.
  const addHabitQuick = useHabitStore((s) => s.add);
  const [habitDraft, setHabitDraft] = useState('');
  // Quick-add's Energy row (2026-08-04) — closes the gap with HomeHabitsCard's own quick-add,
  // which already had this; mirrors its habitEnergyValue and its signed Stepper exactly. It
  // was a tap-cycle in both places until 2026-08-05; see HomeHabitsCard's mount for why.
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  const [habitEnergyValue, setHabitEnergyValue] = useState(0);

  // Arrived from a note's ⋯ → Send it to… → Habits: seed the quick-add with the note's text
  // instead of making the user retype it (lib/prefill.ts).
  const prefill = usePrefill();
  useEffect(() => {
    if (prefill) setHabitDraft(prefill);
  }, [prefill]);

  useFocusEffect(
    useCallback(() => {
      return () => { setHintOpen(false); };
    }, [setHintOpen])
  );

  const today = todayStr();

  // Person filter row shows only in People/family mode with somebody besides you
  // (management moved to Settings — this screen only *filters* by person now). The self
  // row always exists in the People registry, so >1 is the real "is there anyone else" test.
  const showHabitProfiles = peopleModeEnabled && people.length > 1;
  // Memoise the habit filter chain (perf sweep 2026-07-15): this used to re-filter the
  // full habits array on every render of this large screen. Only recompute on real input
  // changes. Only filter by person when the filter UI is actually shown; otherwise (People mode
  // off) show every habit so profile-assigned habits don't silently disappear.
  const profileHabits = useMemo(
    () => (showHabitProfiles ? habits.filter((h) => h.childName === selectedProfile) : habits),
    [showHabitProfiles, habits, selectedProfile]
  );
  const visibleHabits = useMemo(
    () => profileHabits.filter((h) => habitOccursOn(h, today)),
    [profileHabits, today]
  );

  // Drag-to-reorder, the same long-press-and-drag as Home's cards and the shopping list
  // (2026-08-01, lib/useDragReorder). The Today list is filtered twice over — by person and by
  // whether the habit is due today — so what gets committed is a SUBSET of the habits table;
  // useHabitStore.reorder() is written to slot those ids back among the rows the user couldn't
  // see rather than renumbering the visible ones 0…n-1. Render from `habitDrag.order`.
  const habitDrag = useDragReorder(
    useMemo(() => visibleHabits.map((h) => h.id), [visibleHabits]),
    reorderHabits
  );
  const draggedHabits = useMemo(
    () =>
      habitDrag.order
        .map((id) => visibleHabits.find((h) => h.id === id))
        .filter((h): h is (typeof visibleHabits)[number] => !!h),
    [habitDrag.order, visibleHabits]
  );

  // Gate habit-card entrance so only habits added after mount fade in (not the whole list).
  const hasMountedHabits = useRef(false);
  useEffect(() => {
    hasMountedHabits.current = true;
  }, []);

  const onEditHabit = useCallback((id: string) => {
    router.push({ pathname: '/habit-form', params: { id } });
  }, [router]);

  const habitTabs: { key: HabitViewTab; label: string }[] = [
    { key: 'today', label: t.habitToday },
    { key: 'week', label: t.habitWeekView },
    { key: 'month', label: t.habitMonthView },
  ];

  // Same new-habit shape app/habit-form.tsx writes, minus the fields the quick-add leaves
  // at their defaults (goal/recurrence/notifications) — editable later via the form. Shared
  // by the inline AddRow and the empty-state starter chips, which differ only in title/icon/goal.
  function createHabit(
    title: string,
    icon: string,
    dailyGoal: number,
    energyEnabled = false,
    energyValue = 1
  ) {
    addHabitQuick({
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
      childName: selectedProfile || '',
      energyEnabled,
      energyValue,
      // Starters do NOT create a goals row the user never named — the StarterCard copy
      // points at the gear icon for that instead.
      goalId: null,
    });
    success();
  }

  function commitHabit() {
    const title = habitDraft.trim();
    if (!title) return;
    // Neutral "to-do" marker default (debug-note 2026-07-21) — a star reads as a
    // reward/rating, against the app's no-shame framing. Custom icons still pickable.
    const energy = energyFieldsFromStepper(habitEnergyValue);
    createHabit(title, 'ellipse-outline', 1, energy.energyEnabled, energy.energyValue);
    setHabitDraft('');
    setHabitEnergyValue(0);
  }

  /**
   * "More options" — parity with HomeHabitsCard's own quick-add (2026-08-05), which had this
   * button while this screen, showing the identical card, silently did not. Opens the habit
   * editor with the draft carried over and saves nothing; see HomeHabitsCard's copy of this
   * function for the full reasoning.
   */
  function openHabitFormWithDraft() {
    tap();
    router.push({
      pathname: '/habit-form',
      params: {
        title: habitDraft.trim(),
        energy: String(habitEnergyValue),
        childName: selectedProfile || '',
      },
    });
    setHabitDraft('');
    setHabitEnergyValue(0);
  }

  function addStarterHabit(starter: HabitStarter) {
    createHabit(t.starters.habits.suggestions[starter.key], starter.icon, starter.dailyGoal);
  }

  return (
    <>
      <ScreenScaffold
        title={t.habitsTitle}
        tier="site"
        screenKey="habits"
        bottomNav={false}
        pagerFloatingNav
        ownBackground={false}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
      >
        <View style={styles.content}>
          {/* The reward system deliberately has NO card here (2026-07-31). The Bonsai card
              that briefly sat at the top of this screen was replaced by ambient growth in
              the app's own backdrop (lib/growth.ts + components/ScreenBackground.tsx) —
              which is also why the 2026-07-21 debug note below, removing a plain "X / Y
              done" tally from this same screen, still holds: no score belongs on this
              screen. */}
          <HintCard text={t.hints.habits.text} example={t.hints.habits.example} open={hintOpen} noPill />

          {/* Habits — one hue-edged card holding the filter · view tabs · rows · add line.
              This used to be a `SectionCard`, whose header label was the string "Habits"
              — the screen's own title, verbatim, a second time (2026-07-30, user report:
              "this is generally too messy, simplify"). A plain Surface keeps the grouping
              and drops the duplicate heading; it also stops being a Surface wrapping a
              Surface wrapping every habit card. Debug notes: anchor the whole section,
              not the inner habit cards/add row. */}
          <TourTarget id="tour.habits.list">
            <DebugNoteAnchor id="habits.section" label="Habits">
            {/* No `borderColor` (card design reset, 2026-08-05): this card sits ON the Habits
                screen, so it inherits that screen's one hue like every other card. It used to
                pass the habit DOMAIN colour (#218432, a dark green), which put a green card on
                a sky-blue screen. The starter chips + quick-add accent below used to keep
                drawing that same dark green after the card edge was fixed — updated 2026-08-06
                to `screenHue` too, so nothing on this card disagrees with its own header any
                more. */}
            <Surface style={styles.habitsCard}>
              {/* Person filter (People/family mode) — Me + each profile. Management is in Settings. */}
              <Collapsible open={showHabitProfiles}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.profileRow}
                >
                  {people.map((person, index) => {
                    const value = person.isSelf ? '' : person.name;
                    return (
                      <PersonChip
                        key={person.id}
                        label={person.isSelf ? person.name || t.habitForMe : person.name}
                        name={person.name}
                        color={personColor(person.color, index)}
                        selected={selectedProfile === value}
                        onPress={() => setSelectedProfile(value)}
                      />
                    );
                  })}
                </ScrollView>
              </Collapsible>

              {/* View tabs — shared bordered segmented control (SlideSelector). Explicit
                  radius={Radius.sm}: this is a MAIN-level screen view switcher (same tier as
                  components/TabSlider.tsx's tab bars, always boxed), not one of SlideSelector's
                  usual sub-level option pickers (which default to a full pill) — see
                  SlideSelector's "radius" edit note for the main/sub rule. */}
              <SlideSelector
                options={habitTabs.map(({ key, label }) => ({ value: key, label }))}
                value={habitTab}
                onChange={(v) => setHabitTab(v as HabitViewTab)}
                radius={Radius.sm}
              />

              {/* Kept mounted (hidden via display:none, not unmounted) when another view tab is
                  active — 2026-07-23 fix: unmounting this block on tab switch made every
                  AnimatedListItem card play its FadeOutDown exit animation at once, overlapping
                  visually with the Week/Month view mounting in the same spot (only visible when
                  there was at least one habit card to exit — see AGENTS.md's "habits animation"
                  debug note). Staying mounted means AnimatedListItem's enter/exit only fires for
                  genuine habit add/remove, matching ANIMATION_GUIDELINES.md §6's "never animate
                  tab switches" rule. */}
              <View style={habitTab === 'today' ? undefined : styles.hiddenTab}>
                {/* "X / Y done" tally removed (debug-note 2026-07-21): a score reintroduces
                    the shame/reward framing the app deliberately avoids. */}
                <View style={styles.section}>
                  {visibleHabits.length === 0 ? (
                    // Two different kinds of "empty" (2026-07-26). No habits AT ALL → the
                    // StarterCard explainer: what a habit is for here, plus four one-tap
                    // examples. It's gated on profileHabits (not visibleHabits) so it doesn't
                    // reappear on a day when the user's existing habits simply aren't due — and
                    // it does come back if they later delete every habit. Habits exist but none
                    // occur today → the old quiet one-liner, unchanged.
                    // No `example` row on this StarterCard (2026-07-30): it was a read-only copy
                    // of the very first starter chip below it — "Drink 4 glasses of water 0/4"
                    // stacked directly above "Drink 4 glasses of water +". The chips are the
                    // example, and unlike the row they actually do something. Same call, same
                    // reason, as components/HomeHabitsCard.tsx's own empty state.
                    profileHabits.length === 0 ? (
                      // `stage="sprout"` (2026-08-04, design comparison task 03): this is the
                      // app's largest empty state — a whole screen with one card on it — so the
                      // watermark can carry a fuller drawing than the default seed. It is a
                      // layout call and nothing else; the stage never moves, and it is the same
                      // sprout on day 1 and day 400. See components/StageTree.tsx.
                      <StarterCard text={t.starters.habits.text} stage="sprout">
                        <Text style={[styles.starterTapLabel, { color: theme.textMuted }]}>{t.starters.habits.tapToAdd}</Text>
                        {/* Two chips, not four (2026-07-30) — the same measured call
                            components/HomeHabitsCard.tsx already made. `npm run wraps --lang=no`
                            had this row wrapping at every width tested: 4 chips on 2 lines at
                            393px and 4 lines at 360px (560px of chips into 254px of row). A row
                            with a hard minimum width can't be fixed by shortening copy, so the
                            fix is fewer chips; the rest are one tap away on the type line below. */}
                        <View style={styles.starterChips}>
                          {HABIT_STARTERS.slice(0, HABIT_STARTER_CHIPS).map((s) => (
                            <PressableScale
                              key={s.key}
                              onPress={() => addStarterHabit(s)}
                              scaleTo={0.96}
                              accessibilityRole="button"
                              accessibilityLabel={t.starters.habits.suggestions[s.key]}
                              style={[styles.starterChip, { borderColor: screenHue, backgroundColor: theme.surfaceMuted }]}
                            >
                              {/* A.4 rule 1: hue on the chip's edge only — glyph neutral, "+"
                                  the action colour (mirrors HomeHabitsCard's starter chips). */}
                              <HabitIcon icon={s.icon} size={14} color={theme.textMuted} />
                              <Text style={[styles.starterChipText, { color: theme.text }]}>{t.starters.habits.suggestions[s.key]}</Text>
                              <Ionicons name="add" size={14} color={theme.accent} />
                            </PressableScale>
                          ))}
                        </View>
                      </StarterCard>
                    ) : (
                      // Neutral edge to match the Week/Month empty placeholders (theme.border,
                      // not the habit domain hue) — quiet "nothing here yet", not a coded surface.
                      <Surface style={styles.sectionCard}>
                        <Text style={[styles.dashedAddText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
                      </Surface>
                    )
                  ) : (
                    draggedHabits.map((h, hi) => (
                      <AnimatedListItem key={h.id} enabled={hasMountedHabits.current}>
                        {/* isOpen={false}: a card's week-strip drawer is HabitCard's own private
                            state, and threading it up here just to disable the drag isn't worth
                            it — dragging an open card works, it simply reflows a taller block.
                            components/HomeCardManager.tsx made the same call for the same reason. */}
                        <DraggableTaskRow isOpen={false} {...habitDrag.rowProps(h.id)}>
                          <HabitCard habit={h} today={today} onEdit={onEditHabit} lang={lang} theme={theme} first={hi === 0} />
                        </DraggableTaskRow>
                      </AnimatedListItem>
                    ))
                  )}
                  {/* The ghost row: rendered regardless of which branch above fired, so deleting
                      a habit's own last visible-today row still offers its undo even though the
                      list above it just switched to the empty state. */}
                  {lastDeletedHabit ? (
                    <AnimatedListItem key={`ghost-${lastDeletedHabit.id}`} enabled>
                      <GhostRow title={lastDeletedHabit.title} onRestore={restoreLastDeletedHabit} />
                    </AnimatedListItem>
                  ) : null}
                </View>

                {/* The pad's type line — always open, at the bottom of this list where the add
                    row has always been. It used to be an AddRow inside its OWN Surface, which
                    is exactly what AddRow's header tells callers not to do ("mount inside the
                    section's Surface — do NOT wrap it in its own card, or the add row detaches
                    from its list"); that nested card was one of the things making this screen
                    read as a pile of boxes. */}
                <PadTypeRow
                  prompt={t.pad.type.habit}
                  value={habitDraft}
                  onChangeText={setHabitDraft}
                  onSubmit={commitHabit}
                  accent={screenHue}
                  onMore={openHabitFormWithDraft}
                  panel={
                    energySystemEnabled ? (
                      <QuickAddOptionsPanel>
                        {/* Signed stepper, not a tap-cycle — see the identical mount in
                            components/HomeHabitsCard.tsx for why it changed. Keep the two
                            in step; lib/__tests__/energyModes.test.ts checks both. */}
                        <QuickAddOptionRow
                          icon={habitEnergyValue === 0 ? 'flash-outline' : habitEnergyValue > 0 ? 'flash' : 'flash-off'}
                          label={t.energyGiveTakeLabel}
                          value={
                            <Stepper
                              value={habitEnergyValue}
                              onChange={setHabitEnergyValue}
                              signed
                              accessibilityLabel={t.energyGiveTakeLabel}
                            />
                          }
                          accent={screenHue}
                        />
                      </QuickAddOptionsPanel>
                    ) : undefined
                  }
                />
              </View>

              {habitTab === 'week' && (
                <WeekView
                  habits={profileHabits}
                  today={today}
                  lang={lang}
                  theme={theme}
                />
              )}
              {habitTab === 'month' && (
                <MonthView
                  habits={profileHabits}
                  today={today}
                  theme={theme}
                />
              )}
            </Surface>
            </DebugNoteAnchor>
          </TourTarget>

          {/* Edit Goals link (2026-07-29, moved to the bottom + renamed + popup 2026-07-31)
              — Goals dropped its own Home card (too many lists on Home); this is now one of
              its two entry points, alongside Plans. Sits below the habit list rather than
              above it (under HintCard, its original spot) since it's an occasional edit
              action, not something that should outrank the day's habits on every visit.
              Opens GoalsSheet as a popup instead of pushing to /goals, so editing goals
              doesn't leave this tab. Gated on featureGoals so turning the feature off
              removes the link, not just the sheet it opens. */}
          {featureGoals && (
            <SubScreenLinkButton
              domain="habit"
              icon="flag"
              label={t.goals.editLink}
              onPress={() => setGoalsSheetOpen(true)}
            />
          )}

          {/* Ambient stage tree (2026-08-04, design comparison task 03) — the `full` stage,
              standing on the backdrop at the foot of the column where the content ends. It is
              decorative and nothing else: bound to no data, it never advances, and it is the
              same tree on a first launch as after a year of habits. That is the ONE use of the
              stage art both the design project's readme and lib/growth.ts allow ("Ambient
              (decorative) — no data bound. Plain backdrop use, sway only, no fill logic"); the
              canopy-from-Energy, grow-over-a-focus-session and stage-from-streak bindings the
              same guideline card proposes are declined by BOTH sides, so don't wire this to
              useGrowth, a habit count or anything else.

              It sits BELOW the list rather than behind the header, which is where this first
              landed: every card on this screen is full-width and opaque, so a tree up there was
              covered by the Habits card with only an accidental sliver showing past its edge.
              Down here it stands on open backdrop and overlaps nothing. It replaced the plain
              bottom spacer, and carries that spacer's height itself.

              Suppressed while the StarterCard is up — that card draws a tree of its own, and
              the art's rule is ONE TREE PER SCREEN. `profileHabits.length === 0` is exactly the
              StarterCard's own gate above; keep the two in step if either moves. */}
          {profileHabits.length === 0 ? (
            <View style={styles.footSpacer} />
          ) : (
            <View style={styles.footTreeRow}>
              <StageTree stage="full" opacity={0.3} style={styles.footTree} />
            </View>
          )}
        </View>
      </ScreenScaffold>
      <GoalsSheet visible={goalsSheetOpen} onClose={() => setGoalsSheetOpen(false)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md },

  // The bottom spacer this screen has always ended on, kept as its own style so the ambient
  // tree below can be swapped in for it without the two disagreeing about how much room the
  // foot of the list needs.
  footSpacer: { height: Spacing.xl + Spacing.xxl },

  // The ambient stage tree (design comparison task 03) standing at the foot of the column.
  // Right-aligned and allowed to run past the screen edge (`marginRight` is negative) for the
  // same reason ScreenBackground's branches are corners-only: the middle is where content
  // lives. It carries footSpacer's height itself, so nothing is lost by replacing it.
  // `pointerEvents` is already 'none' inside both StageTree and Motif, so it can never eat a
  // tap on whatever ends up scrolled under it.
  // Height is the tree's own, not footSpacer's — a fixed-height row with a taller child would
  // let the canopy spill over BottomNav (RN doesn't clip by default). It is ~50px more scroll
  // than the bare spacer was, on a screen that already ends in open backdrop.
  footTreeRow: {
    height: 150,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  footTree: {
    width: 132,
    height: 150,
    marginRight: -Spacing.sm,
  },

  // ─── Habits section ───────────────────────────────────────────────────────
  // Boxed in a <SectionCard> (2026-07-17): the section's inner controls stack with a
  // Spacing.md gap below the card's SectionRail header (overrides SectionCard's default
  // Spacing.sm content gap, keeping the habits sub-controls' original breathing room).
  // Replaced the old SectionCard (2026-07-30) — same grouping, no duplicate "Habits" heading,
  // and one fewer Surface in the nesting. PAD_GUTTER is the single horizontal inset, matching
  // Home's four pad cards so the two surfaces read as the same kind of thing.
  habitsCard: {
    borderRadius: Radius.md,
    paddingHorizontal: PAD_GUTTER,
    paddingTop: PAD_GUTTER,
    paddingBottom: PAD_GUTTER,
    gap: Spacing.md,
  },
  profileRow: {
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  profileChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  profileChipText: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  section: { gap: Spacing.sm },
  // Hides the Today section without unmounting it when Week/Month is active — see the
  // 2026-07-23 fix note above the view-tab render block.
  hiddenTab: { display: 'none' },
  habitsEmptyCard: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  sectionCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  // Inline habit quick-add row card (mirrors Plans' addRowCard).

  dashedAddText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  // Empty-state starter chips (inside StarterCard) — one-tap example habits.
  starterTapLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  starterChipText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },

  // Wraps the (overflow-clipped) habit card so the done-state GlowPulse halo, whose boxShadow
  // extends beyond the card box, isn't clipped. Position:relative for the absolute-fill halo.
  habitGlowWrap: { position: 'relative', borderRadius: Radius.md },
  // Habit card — Decision 043 rule 3: progress/done state lives on the 4px accent bar
  // only (habitAccent); the card body/border never recolors (see barColor in HabitCard).
  // A ruled line on one sheet, NOT a card of its own (2026-08-04). Each habit used to be an
  // opaque rounded surface with its own shadow, stacked inside the list's surface — a card
  // inside a card, three deep once the screen's own Surface is counted. Flat rows separated by
  // a hairline is what the design system's own habit card does, and it is the difference the
  // maintainer was pointing at.
  //
  // The 4px accent bar STAYS and is not decoration: it encodes progress
  // (`progressColor(ratio)`) and the done state. With rows flush and square, consecutive bars
  // line up into one continuous left margin, which reads as the notepad's ruled edge.
  habitCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  // 4px gap between boxes, not flush — two adjacent 1.25px borders would paint a line heavier
  // than the CARD's own edge and invert the hierarchy. Same rule as components/PadSheet.tsx.
  habitCardStacked: { marginTop: Spacing.xs },
  habitAccent: { width: 4, alignSelf: 'stretch' },
  habitCardContent: { flex: 1, padding: Spacing.md, position: 'relative' },
  // The row shell itself — leading icon, title, the ONE meta line, the ONE right-hand value,
  // the ⋯ and the check — is components/PadRow.tsx's since 2026-08-01 (B2-3, inverted), so the
  // styles that used to build it here (cardHeader / habitIcon / habitTitleWrap / habitTitle /
  // titleMetaRow / habitCount) are gone with it. Only the bits PadRow takes as NODES still need
  // styles of their own: the meta line's own text, and the −/+ pair passed as `trailing`.
  energyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  energyPillText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  weeklyProgressText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  // The −/+ pair, handed to PadRow as `trailing` (which replaces its check). Only drawn when
  // dailyGoal > 1 — see the PadRow mount for why a goal of 1 gets a real check instead.
  adjRow: { flexDirection: 'row', gap: Spacing.xs },
  adjBtn: {
    width: 30, height: 30,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Raised, pressable-looking adjusters (depth toward the user) — see Shadow.button.
    // 2026-07-24 contrast pass: the "−" button's fill (theme.surface) matches its parent
    // habitCard's own background exactly, so the shadow-only/top-highlight-only edge it had
    // was the button's ENTIRE visible boundary — added a real borderWidth, defaulted to
    // transparent (the "+" button's colored fill already has its own contrast and shouldn't
    // gain a stray default border) and overridden to theme.border at the "−" button's call site.
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.6)',
    ...Shadow.button,
  },
  adjBtnText: { fontSize: FontSize.lg, lineHeight: 30 },
  // Both halves are the same recessed shape (2026-08-05). The "+" carried a solid accent
  // fill until now — the exact thing components/Stepper.tsx's edit note says not to
  // reinstate, and for the reason given there: a −/+ pair is ONE control, so filling half
  // of it in the app's action colour reads as "+ is the important one", which is not true.
  // On a list of counted habits it also repeated that emphasis once per row.
  adjBtnPlusText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 30 },

  // Expanded content
  expanded: { marginTop: Spacing.sm, gap: Spacing.xs },
  weekStripWrap: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  restDayBtn: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  restDayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  restDayHint: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  dayCol: { alignItems: 'center', gap: 3 },
  dayAbbr: { fontSize: 9, fontFamily: Fonts.semibold },
  weekDot: {
    width: 12, height: 12, borderRadius: Radius.full, borderWidth: 1.5,
  },
  weekDotToday: { borderWidth: 2 },

  // Week grid view
  weekGrid: { gap: 2 },
  weekGridRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  weekGridLabel: {
    width: 110, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: Spacing.xs,
  },
  weekGridTitle: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  weekGridCell: { flex: 1, alignItems: 'center', gap: 2 },
  weekGridDayAbbr: { fontSize: 9 },
  weekGridDate: { fontSize: 9 },
  weekGridDot: {
    width: 14, height: 14, borderRadius: Radius.full, borderWidth: 1.5,
  },

  // Month view
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  monthNavBtn: { padding: Spacing.sm },
  monthNavText: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  monthLabel: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  monthRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  monthRowLabel: { width: 90, flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthRowTitle: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  monthDots: { flexDirection: 'row', gap: 3, paddingHorizontal: Spacing.xs },
  monthDotWrap: { alignItems: 'center', gap: 2 },
  monthDotDate: { fontSize: 7 },
  monthDot: { width: 8, height: 8, borderRadius: Radius.full, borderWidth: 1 },
});
