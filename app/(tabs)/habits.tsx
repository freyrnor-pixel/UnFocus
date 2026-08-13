/**
 * habits.tsx — Habits (today's list only, 2026-08-06), its own bottom-nav tab.
 *
 * An optional child-profile selector and per-habit cards (progress, expandable week strip
 * + rest-day toggle, quick-add). **The Today/Week/Month browsing tabs are gone** — see the
 * dated edit note below; a habit is set up once with a recurrence + optional reminder, and
 * the maintainer's call was that browsing it by day/week/month is what a to-do is for.
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
 *   Imports → components/ScreenScaffold, components/HintCard, components/StarterCard
 *             (and components/StarterSuggestionChip, 2026-08-12 — the shared empty-state
 *             suggestion chip that replaced this screen's hand-rolled `starterChip`)
 *             (2026-08-06 v3 — back on this screen, now carrying its own `collapsible`
 *             drop-down for the suggested-habits chips; see the v3 Edit note below),
 *             components/Surface,
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
 *             components/HabitRecurrenceCells + lib/useHabitRecurrenceDraft (2026-08-11 —
 *             the "every N days/weeks" repeat picker + its conditional cells, rendered inside
 *             the same panel as the energy cell above; the state half (the hook) and the
 *             render half (the component) are split out because HomeHabitsCard.tsx mounts an
 *             IDENTICAL panel and the two are pinned against each other by
 *             lib/__tests__/energyModes.test.ts — see that hook's header),
 *             components/AnimatedListItem (habit
 *             add/remove fade), components/DraggableTaskRow (the long-press-drag gesture),
 *             components/GlowPulse (done-state static halo),
 *             components/HabitIcon (starter chips only — every ROW's leading mark goes through
 *             components/HabitLeading, 2026-08-04, which draws the brand leaf when a habit has
 *             no chosen icon), components/StageTree (2026-08-04 — the ambient `full`-stage
 *             corner watermark at the foot of the list; no longer shares a "one tree per
 *             screen" rule with anything since 2026-08-06 v2 — see below),
 *             components/PressableScale (the suggested-habits collapse/expand control lives in
 *             components/StarterCard now, not here),
 *             components/CollapsedSection + components/GoalsEditor (the "Goals" drawer —
 *             the same shape To-do draws; this link has been a card, then a hand-rolled row,
 *             then a shared `SubScreenLinkRow`, a drawer-onto-a-popup as of 2026-08-10, and
 *             is a drawer with the editor mounted straight in its body as of 2026-08-12 —
 *             components/GoalsSheet.tsx, the popup it used to open, is deleted; see the note
 *             below — also where a habit's linked goal shows its living-glow dot as of
 *             2026-08-06, not on this screen's own rows any more), components/DebugNoteAnchor,
 *             components/GhostRow (2026-08-01,
 *             the "just deleted this habit — restore?" row, see below),
 *             constants/theme, constants/motion (Duration, the registration flash), lib/date,
 *             lib/haptics, lib/habitStarters, lib/i18n,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/useDragReorder (drag-to-reorder),
 *             lib/useGhostTimeout (2026-08-01, the ghost row's timing),
 *             lib/prefill (usePrefill — a note sent here seeds the quick-add), lib/domainColor,
 *             lib/habitRecurrence, store/useHabitStore, store/useSettingsStore
 *   - The person filter row + habit-form "For" chips are gated on settings.peopleModeEnabled
 *     (People/family mode). Profile add/remove lives in app/settings.tsx, not here.
 *   Used by → Expo Router route "/habits" — one of 5 co-mounted pager tabs under
 *             app/(tabs)/_layout.tsx (BottomNav "Habits" tab)
 *   Data    → useHabitStore (habits + habit_logs) via increment/decrement/markRestDay/add;
 *             colour theme + language + child profiles + featureGoals from useSettingsStore
 *
 * Edit notes:
 *   - **Habits screen redesign (2026-08-06)**, five changes in one pass, all confirmed with
 *     the maintainer before landing:
 *     1. **Today/Week/Month tab-slider removed.** A habit is configured once (recurrence +
 *        optional reminder time) and Notifications take care of reminding — browsing it by
 *        day/week/month was judged to be what a to-do is for, not a habit. `WeekView`/
 *        `MonthView` and the segmented selector that switched between them are deleted; only the
 *        Today list remains. The per-HABIT expandable week-strip drawer (tap a row → 7-day
 *        dots + rest-day toggle) is UNCHANGED — that is a different, smaller thing (one
 *        habit's own recent history, not cross-habit browsing) and wasn't part of this ask.
 *        `settings.habitViewTab` is now an inert column (never dropped — see
 *        store/useSettingsStore.ts's "Inert columns" note).
 *     2. **Card sub-header**: `t.habits.cardSubtitle` at the top of the Habits Surface — it had
 *        no label or description of any kind since the 2026-07-30 pass removed its duplicate
 *        "Habits" title.
 *     3. **Always −/+ to register, never a check** — see the row-rule comment inside
 *        `HabitCard` for the full reasoning, and its new `flash` state for the momentary
 *        colour confirmation on each tap ("so they know it's been registered").
 *     4. **The goal's living-glow dot left this screen** and shows only on the goal card
 *        itself (components/GoalsEditor.tsx) — "the reward light indicator should be on the
 *        Goals, not the habits".
 *     5. ~~StarterCard is dismissible~~ **superseded 2026-08-06 v2 — see below.** The first
 *        pass put components/StarterCard.tsx here with a permanent `dismissKey="habits"` "X".
 *        That's gone from this screen; read the v2 note for what replaced it.
 *   - **Habits screen redesign v2 (2026-08-06, user feedback on the first pass)** — four more
 *     fixes, none of them new asks, all corrections of a first pass that didn't fully land:
 *     1. **Sub-header now actually reads as one.** It was small, muted, medium-weight text —
 *        visually identical to any other line of body copy. Now bold + full-contrast
 *        (`theme.text`) with its own breathing room.
 *     2. **(Superseded 2026-08-10.)** "Edit Goals" was moved INSIDE this card as a plain row,
 *        because components/SubScreenLinkButton drew its own `<Surface>` and so read as a
 *        second small card below the Habits card wherever its JSX sat — the fix had to be the
 *        SHAPE, not the position. It is a `<CollapsedSection>` drawer at screen level now; see
 *        the "Edit Goals" note below for why that is not a return to the thing this rejected.
 *     3. **The idle "Type habit" line no longer shows a ghost check ring** (`noGhostCheck` on
 *        PadTypeRow) — every habit row ends in a −/+ pair, never a check, so the ring used to
 *        preview a control that could never appear. The field widens into the freed space for
 *        free (`flex: 1`).
 *     4. **components/StarterCard.tsx is GONE from this screen, replaced by two separate,
 *        purpose-built pieces**: a plain "tips" line (`t.starters.habits.text`) directly under
 *        the sub-header, permanent and un-boxed; and a separate "suggested habits" card that
 *        COLLAPSES to a small pill on tap (`examplesCollapsed` state, `toggleExamples()`,
 *        LayoutAnimation — same pattern components/HintCard.tsx's own pill uses) rather than
 *        being permanently dismissed. It disappears ENTIRELY only once `allStartersAdded` is
 *        true — every one of the shown starter suggestions already exists as a habit,
 *        independent of `profileHabits.length` or the collapse state. `dismissKey`/
 *        `dismissedStarters` stay in use elsewhere (Goals) for the "hide for good" case; this
 *        screen no longer uses either. **Superseded 2026-08-06 v3 — see below.**
 *   - **Habits screen redesign v3 (2026-08-06)**: the v2 pass's hand-rolled pill/card toggle
 *     is GONE — components/StarterCard.tsx is BACK on this screen, now carrying the
 *     collapsible behavior itself (its new `collapsible`/`exampleHeaderLabel` props), so
 *     Habits, Goals, Plans and Health all share one identical collapse mechanism instead of
 *     five near-copies (the "cleaner suggestion that works for all cards" the maintainer
 *     asked for after seeing the v2 pass). `examplesCollapsed`/`toggleExamples()` and the
 *     hand-rolled `examplesCard`/`examplesPill` styles are deleted from this file along with
 *     the now-unused `LayoutAnimation`/`useAccessibility` imports — see StarterCard's own
 *     `collapsible` edit note for what replaced them. Two things carry over unchanged: the
 *     plain "tips" line stays exactly as v2 left it (permanent, un-boxed, under the
 *     sub-header — passed to StarterCard as nothing, since `text` is optional now and this
 *     screen already renders its own copy elsewhere, see StarterCard's Edit notes on why);
 *     and `!allStartersAdded` still gates whether the card mounts at all — StarterCard's
 *     `collapsible` only owns the collapse SHAPE while it's mounted, never that gate.
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - **Inline "ghost" undo row (2026-08-01)**: deleting a habit (there's no delete affordance
 *     on this screen — only app/habit-form.tsx's Delete button) is now a soft-delete
 *     (useHabitStore's `lastDeleted`), and the Today list renders a GhostRow with a restore
 *     action for a few seconds after, or until you leave this tab (lib/useGhostTimeout.ts),
 *     whichever is first. It's appended after the Today list's own empty/populated branch so it still
 *     shows even when deleting was the habit that made the list empty. habit-form.tsx's old
 *     confirm-before-delete dialog is gone with it — same "undo, not confirm" call already
 *     made for tasks.
 *   - **Edit Goals row (2026-07-29, moved + renamed + popup 2026-07-31; INLINED 2026-08-06)**:
 *     sits BELOW the Habits card, at the foot of the screen — after the habit list and
 *     quick-add, so it never outranks the day's habits. **It is a `<CollapsedSection>` drawer
 *     as of 2026-08-10** (components/CollapsedSection.tsx), the app's one shape for "a surface
 *     this screen leads to", shared with To-do's Goals + Earlier days and Shopping's Food +
 *     Catalogue. Expanding previews the goals; pressing the name opens the popup.
 *     **Why this is not a return to the card that was rejected.** The history: a
 *     `SubScreenLinkButton` card (2026-08-06) → a plain row inside the Habits card, because a
 *     bordered `<Surface>` whose whole content was one link read as a second small card
 *     floating below this one → the shared `SubScreenLinkRow` (2026-08-08) → this. What was
 *     wrong with the card was that it spent a card on a row's worth of information and could
 *     only ever be *followed*; a drawer shows what is behind it, which is what earns the card.
 *     A row inside the Habits card would now make this screen the odd one out.
 *     Gated on `featureGoals` — one of Goals' two entry points (the other is To-do), and as
 *     of 2026-08-12 one of only two, full stop: **app/goals.tsx is deleted**. That screen was
 *     a second implementation of this drawer's body — the same list, add row, starter chips
 *     and delete confirm as components/GoalsEditor.tsx, with its own copy of the confirm copy
 *     both headers used to tell each other to keep in sync. The `/goals` route is gone with
 *     it, so a note's "Send it to… → Goals" lands HERE now, in the `goals` prefill slot (see
 *     the `usePrefill` calls below and lib/prefill.ts). One thing was genuinely lost, not
 *     moved: that screen showed a goal's title uncapped, and a PadRow caps it at one line.
 *     That is the 2026-08-12 "read just like other cards" ruling applied consistently, not an
 *     oversight — the full title is still in the row's accessible name.
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
 *     once the row itself strikes through and fades (the PadRow conversion), a "Done today"
 *     word was a third copy of one fact — so the meta line held three things, not four, and
 *     `hasMetaLine` dropped `isDone` with it. **The goal dot left the meta line too, on
 *     2026-08-06** — see the redesign note above; `hasMetaLine` is down to two terms now
 *     (weekly progress, energy).
 *   - **Drag to reorder (2026-08-01)**: hold a habit card ~400ms and drag it, the same
 *     gesture Home's preview cards and the shopping list have always had, now shared through
 *     lib/useDragReorder.ts. Two things to know before touching it. The Today list is
 *     filtered by person AND by "is it due today", so the ids committed on drop are a SUBSET
 *     of the habits table — useHabitStore.reorder() slots them back among the rows the user
 *     couldn't see instead of renumbering the visible ones 0…n-1, so a habit that isn't due
 *     today keeps whichever habits it sat between. And the list must render from
 *     `habitDrag.order` (`draggedHabits`), never from `visibleHabits` directly, or nothing
 *     moves under the finger. (Week/Month views, which weren't draggable, are gone entirely
 *     as of 2026-08-06 — see the redesign note above.)
 *   - **Add-habit affordance (2026-07-13 rows pass)**: an inline `AddRow` at the bottom of
 *     the Today habit list is the add-habit trigger — a title-only quick-create with sensible
 *     defaults (icon/goal/recurrence via `commitHabit` → useHabitStore.add), matching Plans'
 *     AddRow → addTask flow; tap a habit card's settings-gear icon (2026-07-21, replaced
 *     long-press) to edit the rest in /habit-form. This
 *     replaced the old header "+" AddFAB (which navigated straight to the form).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore, Habit, HabitKind, HabitRecurrence } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import { personColor } from '@/lib/personColor';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import StarterCard from '@/components/StarterCard';
import StarterSuggestionChip from '@/components/StarterSuggestionChip';
import CardHintNote from '@/components/CardHintNote';
import CollapsedSection from '@/components/CollapsedSection';
import GoalsEditor from '@/components/GoalsEditor';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import Surface from '@/components/Surface';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import HabitRecurrenceCells from '@/components/HabitRecurrenceCells';
import Stepper from '@/components/Stepper';
import { energyFieldsFromStepper } from '@/lib/energy';
import { useHabitRecurrenceDraft } from '@/lib/useHabitRecurrenceDraft';
import AnimatedListItem from '@/components/AnimatedListItem';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import Collapsible from '@/components/Collapsible';
import GlowPulse from '@/components/GlowPulse';
import HabitIcon from '@/components/HabitIcon';
import HabitLeading from '@/components/HabitLeading';
import StageTree from '@/components/StageTree';
import GhostRow from '@/components/GhostRow';
import { HABIT_STARTERS, HabitStarter } from '@/lib/habitStarters';
import { useGhostTimeout } from '@/lib/useGhostTimeout';

/** Starter chips the empty Habits list offers. See the row's own comment for the measurement. */
const HABIT_STARTER_CHIPS = 2;
import PressableScale from '@/components/PressableScale';
import { useT } from '@/lib/i18n';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { useDragReorder } from '@/lib/useDragReorder';
import { usePrefill } from '@/lib/prefill';
import { todayStr, getWeekDates } from '@/lib/date';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
// TabularNums went with the hand-rolled `habitCount` style — PadRow's `rightValue` already
// carries it, so the count still lines up column-wise without this file importing it.
import { BORDER_WIDTH, computeBorderTone, contrastOn, FontSize, PAD_GUTTER, Radius, SCREEN_GAP, Shadow, Spacing, Fonts, Type, HitSlop } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';
import { Duration } from '@/constants/motion';
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
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const log = logs.find((l) => l.habitId === habit.id && l.logDate === today);
  const isRestToday = log?.restDay ?? false;
  const { count, goal, ratio, isDone } = habitProgress(habit, logs, today);
  const isWeeklyFlexible = habit.recurrence === 'weekly-flexible';
  // MUST mirror the meta-line JSX gates below exactly (the trap components/TaskCard.tsx
  // documents): if the two drift, a habit with only one meta item silently loses its line.
  const hasMetaLine = isWeeklyFlexible || habit.energyEnabled;

  // Registration flash (2026-08-06, "so they know it's been registered"): a brief colour
  // change on whichever of −/+ was just tapped, distinct per direction. Momentary only —
  // it clears itself, unlike the static per-button fill styles.adjRow's own comment says
  // NOT to reinstate (a persistent accent fill on "+" reads as "+ is the important half").
  const [flash, setFlash] = useState<'plus' | 'minus' | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  function triggerFlash(which: 'plus' | 'minus') {
    setFlash(which);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), Duration.card);
  }

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
   * The "+ one" path, fired by every habit's `+` button (2026-08-06: no more goal-1 check —
   * see the row-rule comment below). `success()` is deliberately NOT fired here even though
   * HomeHabitsCard's own `counted` does: this screen has always fired it from the `isDone`
   * effect above, so firing it here as well would double the haptic on the exact tap that
   * completes the goal. The lesser taps get the light one.
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
            (weekly progress · energy) → ONE right-hand value (the count) → ⋯ → the −/+ control.

            **Drawn by components/PadRow.tsx since 2026-08-01 (B2-3, inverted).** The audit
            behind that task found the shared row primitive was imported by the four HOME cards
            and by no tab screen at all — so Home was the newer code and the tabs were what had
            drifted, and the task's "convert Home to match the tabs" direction ran backwards.
            This screen was converted first. What changed with the shell: the gear became
            PadRow's ONE ⋯ action (the row rule's "one row-level action button"). `done` now
            strikes and fades the WHOLE row, which is the shared finished-row treatment a
            ticked note/task/shopping item already had.

            **The check is gone entirely (2026-08-06, "remove the tab-slider")**: every habit,
            not just `dailyGoal > 1` ones, now registers through the −/+ pair — the maintainer's
            call was that a habit needs exactly one interaction model, and a tap that means
            "done" for a goal-1 habit but "one more" for anything else was two models wearing
            one control. `count/goal` is no longer suppressed at goal 1 for the same reason:
            with no check circle to carry that fact, the count is the only place it lives. The
            goal-1 "done" story is still told — the LEADING icon still swaps to a checkmark
            (below) and the row still strikes through — just not by a second, now-removed
            control on the right.

            The goal's own living-glow dot (components/GoalGlowDot) also left this row
            (2026-08-06, "the reward light indicator should be on the Goals, not the habits") —
            it's on the goal row itself now (components/GoalsEditor.tsx), which
            is the ONE place per goal a user needs to see its momentum, rather than repeated on
            every habit and task that happens to link to it.

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
          // The ONE right-hand value: today's count against the goal. Always shown now
          // (2026-08-06) — with the check gone, this is the only place a goal-1 habit's
          // progress is visible.
          rightValue={`${count}/${goal}`}
          onPress={() => setExpanded((v) => !v)}
          onAction={() => onEdit(habit.id)}
          actionLabel={t.habits.editButtonLabel}
          trailing={
            <View style={styles.adjRow}>
              <PressableScale
                style={[
                  styles.adjBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  // Registration flash — see the `flash` state doc above. Distinct colour
                  // from "+" (accent, not good/bad): a decrement isn't a penalty, just the
                  // other direction of the same count.
                  flash === 'minus' && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                ]}
                onPress={() => { selection(); decrement(habit.id, today); triggerFlash('minus'); }}
                hitSlop={HitSlop.base}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${t.decreaseQty} ${habit.title}`}
              >
                <Text style={[styles.adjBtnText, { color: flash === 'minus' ? theme.accent : theme.textMuted }]}>−</Text>
              </PressableScale>
              <PressableScale
                style={[
                  styles.adjBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  flash === 'plus' && { backgroundColor: theme.good, borderColor: theme.good },
                ]}
                onPress={() => { counted(); triggerFlash('plus'); }}
                hitSlop={HitSlop.base}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${t.increaseQty} ${habit.title}`}
              >
                <Text style={[styles.adjBtnPlusText, { color: flash === 'plus' ? contrastOn(theme.good) : theme.text }]}>+</Text>
              </PressableScale>
            </View>
          }
        />

        {/* Clip-revealed, not a bare `{expanded && …}` (2026-08-08). This was the last habit
            surface that popped its body in with no transition while the rest of the app —
            TaskCard, ExpandableCard, WeekListCard, habit-form, and this very file's own
            person-filter reveal — all glide through `Collapsible`. It clips a measured height
            with NO opacity fade, deliberately: a folded row should read "still there, just
            folded". Don't swap in a fade; Collapsible's header says why. */}
        <Collapsible open={expanded}>
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
        </Collapsible>
        </View>
      </View>
      </View>
  );
}

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
  // Gates the "Goals" drawer at the bottom of the screen (2026-07-29).
  const featureGoals = useSettingsStore((s) => s.featureGoals);

  // The ⓘ hint is collapsed until tapped (2026-07-31 — the first-visit auto-open and its
  // `autoOpen` arg are gone); the card's own tips line + suggested-habits card already teach
  // this (2026-08-06 v2 — see the header's dated note; was StarterCard until then).
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
  // "Every N days/weeks" repeat picker (2026-08-11) — always visible, unlike the energy cell
  // above; see lib/useHabitRecurrenceDraft.ts's header for why the state lives in a shared hook.
  const habitRecurrenceDraft = useHabitRecurrenceDraft();

  // Arrived from a note's ⋯ → Send it to… → Habits: seed the quick-add with the note's text
  // instead of making the user retype it (lib/prefill.ts).
  const prefill = usePrefill();
  useEffect(() => {
    if (prefill) setHabitDraft(prefill);
  }, [prefill]);

  // …and → Goals, which since 2026-08-12 arrives on THIS screen too: the Goals editor is a
  // drawer down the page (app/goals.tsx, the screen it used to open, is retired). The `goals`
  // slot is what keeps the two apart — without it the quick-add above would take a goal and
  // silently create a habit named after the note. It seeds GoalsEditor's own add row and
  // opens the drawer around it, so the text lands somewhere the user can see it.
  const goalPrefill = usePrefill('goals');

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

  /**
   * Have all the shown starter suggestions already been added? (2026-08-06 v2, "Suggested
   * habits only disappear if all are added.") The suggested-habits card's visibility is
   * governed SOLELY by this — independent of how many other, non-starter habits exist, and
   * independent of the manual collapse-to-pill toggle, which only changes its SHAPE while
   * this is false. Matched by title against the localized suggestion text, since a habit
   * created from a starter chip carries no other marker back to which starter made it — the
   * same "no persistent bookkeeping" trade-off the rest of this screen makes elsewhere. A
   * starter whose habit was later renamed will look "not added" again; accepted, since there
   * is no better signal available without a new column.
   */
  const allStartersAdded = useMemo(
    () =>
      HABIT_STARTERS.slice(0, HABIT_STARTER_CHIPS).every((s) =>
        profileHabits.some((h) => h.title === t.starters.habits.suggestions[s.key])
      ),
    [profileHabits, t]
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


  // Same new-habit shape app/habit-form.tsx writes, minus the fields the quick-add leaves
  // at their defaults (goal/recurrence/notifications) — editable later via the form. Shared
  // by the inline AddRow and the empty-state starter chips, which differ only in title/icon/goal.
  // recurrence/recurrenceDays/recurrenceInterval default to plain daily (today's behaviour) —
  // the starter chips and any other caller that doesn't pass them are unaffected.
  function createHabit(
    title: string,
    icon: string,
    dailyGoal: number,
    energyEnabled = false,
    energyValue = 1,
    recurrence: HabitRecurrence = 'daily',
    recurrenceDays: number[] = [],
    recurrenceInterval = 1
  ) {
    addHabitQuick({
      title,
      icon,
      kind: 'neutral',
      category: 'other',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal,
      recurrence,
      recurrenceDays,
      recurrenceInterval,
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
      // Starters do NOT create a goals row the user never named — the gear icon is where
      // that happens instead.
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
    const { recurrence, recurrenceDays, recurrenceInterval, dailyGoal } = habitRecurrenceDraft.toHabitFields();
    createHabit(title, 'ellipse-outline', dailyGoal, energy.energyEnabled, energy.energyValue, recurrence, recurrenceDays, recurrenceInterval);
    setHabitDraft('');
    setHabitEnergyValue(0);
    habitRecurrenceDraft.reset();
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
        ...habitRecurrenceDraft.toParams(),
      },
    });
    setHabitDraft('');
    setHabitEnergyValue(0);
    habitRecurrenceDraft.reset();
  }

  function addStarterHabit(starter: HabitStarter) {
    createHabit(t.starters.habits.suggestions[starter.key], starter.icon, starter.dailyGoal);
  }

  return (
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
              {/* Sub-header (2026-08-06, restyled after user feedback that the first pass —
                  small muted italic-adjacent text — read as just another line of body copy,
                  not a header). Bold, full-contrast, and its own row with real breathing room
                  under it, so it reads as a heading FOR the card rather than a caption INSIDE
                  it. Distinct wording from hints.habits.text (the collapsible ⓘ hint just
                  above this card) on purpose — see lib/i18n.ts's habits.cardSubtitle doc. */}
              <Text style={[styles.cardSubtitle, { color: theme.text }]}>{t.habits.cardSubtitle}</Text>

              {/* Tips (2026-08-06 v2, user feedback): a plain line under the sub-header, not
                  boxed and not gated on emptiness — "tips stays". Distinct from the examples
                  block right below, which has its own, different lifecycle (see there).
                  **components/CardHintNote since 2026-08-13**, replacing a hand-rolled bulb +
                  italic row. Same sentence, same position, same permanence — what changes is
                  that it is no longer a third implementation of the app's one explainer line
                  (this tab and Health had drifted to different type sizes and, here, a
                  different weight). `placement="head"` is the position, not a claim about
                  emptiness: the ruling is "the explanation sits underneath the sub-header",
                  and this card's tip is permanent by an older, separate decision. The
                  `marginBottom: 0` cancels the note's own head gap — this card stacks its
                  children on `gap: Spacing.md` already, and both would make it 32px. */}
              <CardHintNote text={t.starters.habits.text} placement="head" style={styles.tipsNote} />

              {/* Person filter (People/family mode) — Me + each profile. Management is in
                  Settings. Mounted only when there IS somebody to filter by (2026-08-08): a
                  closed `Collapsible` stays mounted at zero height, so as a child of this
                  card's `gap: Spacing.md` it booked 16px of blank card on every install that
                  isn't in People mode — i.e. almost all of them. */}
              {showHabitProfiles && (
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
              )}

              {/* Today's list — the ONLY view now (2026-08-06, "remove the tab-slider"). A
                  habit is set up once with a recurrence and an optional reminder time;
                  browsing it by day/week/month was judged to be what a to-do is for, not a
                  habit, so the Today/Week/Month selector and the WeekView/MonthView grids
                  it switched to are gone — see the file header's dated note and
                  store/useSettingsStore.ts's "Inert columns" entry for `habitViewTab`. */}
              {/* The bottom half of the card — list, composer, Goals row. It had NO gap at
                  all (2026-08-08), while the card's own children above it stacked at
                  Spacing.md, so the same card breathed at the top and was flush at the
                  bottom: the empty-state box, the "Write habit" line and the Goals row all
                  touched. It matches the card's rhythm now. */}
              <View style={styles.habitsCardBody}>
                {/* "X / Y done" tally removed (debug-note 2026-07-21): a score reintroduces
                    the shame/reward framing the app deliberately avoids. */}
                <View style={styles.section}>
                  {visibleHabits.length === 0 ? (
                    // 2026-08-12: the quiet "nothing here yet" one-liner was removed for BOTH
                    // "no habits at all" and "habits exist but none occur today" — the
                    // card-level tips line + suggested-habits card above already explain an
                    // empty list, so this rendered nothing but a redundant line under them.
                    // See components/HomeHabitsCard.tsx's matching removal.
                    null
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

                  {/* Suggested habits (2026-08-06 v3) — components/StarterCard's shared
                      `collapsible` drop-down, replacing this screen's own hand-rolled
                      pill/card toggle from the v2 pass. No `text` prop: the tips line above
                      already carries the explanation, permanently, so this is examples only.
                      Two things distinguish it from every other empty-state explainer:
                        1. It collapses to a normal-looking trigger row on tap, not a floating
                           pill — reversible, unlike StarterCard's `dismissKey` "X" (unused here).
                        2. It disappears ENTIRELY only once `allStartersAdded` — independent of
                           `profileHabits.length`, so it stays useful even for someone who already
                           has a pile of their own custom habits but hasn't tried the shortcuts.
                           That gating is this screen's own job — StarterCard's `collapsible` only
                           owns the collapse SHAPE, never whether the card mounts at all.
                      **`embedded`, and inside this section rather than above the card body
                      (2026-08-12)**: it used to draw its own Surface between the tips line and
                      the body — a card inside this card, putting the suggestions 51px in from
                      the screen edge while the To-do day card draws its example bare at 33.5.
                      Suggestions are rows in the list they are suggestions for now: last in the
                      list's own slot, above the composer that would create the real thing. See
                      components/StarterCard.tsx's `embedded` note. */}
                  {!allStartersAdded && (
                    <StarterCard embedded collapsible exampleHeaderLabel={t.starters.habits.tapToAdd}>
                      {/* Two chips, not four (2026-07-30) — the same measured call
                          components/HomeHabitsCard.tsx already made. `npm run wraps --lang=no`
                          had this row wrapping at every width tested: 4 chips on 2 lines at
                          393px and 4 lines at 360px (560px of chips into 254px of row). A row
                          with a hard minimum width can't be fixed by shortening copy, so the
                          fix is fewer chips; the rest are one tap away on the type line below. */}
                      {/* One shared chip since 2026-08-12 (components/StarterSuggestionChip) —
                          this was one of five hand-rolled copies, and the two habit surfaces'
                          copy was the hued-and-filled one. `leading` rather than `icon`: a
                          habit's stored glyph may be a legacy emoji, which only HabitIcon
                          draws. */}
                      <View style={styles.starterChips}>
                        {HABIT_STARTERS.slice(0, HABIT_STARTER_CHIPS).map((s) => (
                          <StarterSuggestionChip
                            key={s.key}
                            label={t.starters.habits.suggestions[s.key]}
                            leading={<HabitIcon icon={s.icon} size={14} color={theme.textMuted} />}
                            onAdd={() => addStarterHabit(s)}
                            addLabel={t.starters.addExample}
                          />
                        ))}
                      </View>
                    </StarterCard>
                  )}
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
                  // No check to preview (2026-08-06, user report: "the circle to the right of
                  // the empty row") — every habit row ends in a −/+ pair now, never a check,
                  // so the idle ghost ring previewed a control that could never appear. The
                  // input widens into the freed space for free (it's already flex: 1).
                  noGhostCheck
                  panel={
                    <QuickAddOptionsPanel>
                      {/* Signed stepper, not a tap-cycle — see the identical mount in
                          components/HomeHabitsCard.tsx for why it changed. Keep the two
                          in step; lib/__tests__/energyModes.test.ts checks both. */}
                      {energySystemEnabled && (
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
                      )}
                      {/* "Every N days/weeks" (2026-08-11) — unconditional, unlike the energy
                          cell above; see components/HabitRecurrenceCells.tsx's header. */}
                      <HabitRecurrenceCells draft={habitRecurrenceDraft} accent={screenHue} />
                    </QuickAddOptionsPanel>
                  }
                />

              </View>
            </Surface>
            </DebugNoteAnchor>
          </TourTarget>

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

              No longer suppressed by a competing StarterCard tree (2026-08-06 v2 dropped the
              watermark from the suggested-habits card, which isn't a StarterCard any more —
              see the header's dated note) — back to the original plain gate: nothing to
              stand on until there's at least one habit. */}
          {/* Goals — the same drawer the To-do tab draws (2026-08-10). Expanding shows the
              goals AND lets you add/edit/delete them right there — no popup any more
              (2026-08-12, maintainer: "This should not be a pop-up. Examples included in
              card just like other cards, and making, editing and deleting in the card, not
              a pop up."). See components/CollapsedSection.tsx and components/GoalsEditor.tsx.

              This REVERSES the 2026-08-06 placement, and deliberately. That pass moved Goals
              from a `SubScreenLinkButton` card into a plain row INSIDE the Habits card, on the
              maintainer's reasoning: "in the habits card... saves us from yet another card".
              The objection was to a card that could only be *followed* — a bordered Surface
              whose entire content was one link, which is a card's worth of space for a row's
              worth of information. A drawer is not that: it earns its card by showing what is
              behind it, and it is now the app's one shape for "a surface this screen leads to"
              (To-do's Goals and Earlier days, Shopping's Food and Catalogue). A row inside the
              Habits card would be the odd one out again, on the very screen the maintainer
              asked to make consistent. Same `featureGoals` gate — turning the feature off
              removes the drawer entirely, editor included. */}
          {featureGoals && (
            <CollapsedSection
              hue={screenHue}
              domain="habit"
              icon="flag"
              label={t.goals.editLinkPersonal}
              openSignal={goalPrefill}
            >
              <GoalsEditor accent={screenHue} prefill={goalPrefill} />
            </CollapsedSection>
          )}

          {profileHabits.length === 0 ? (
            <View style={styles.footSpacer} />
          ) : (
            <View style={styles.footTreeRow}>
              <StageTree stage="full" opacity={0.3} style={styles.footTree} />
            </View>
          )}
        </View>
      </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  // The screen owns the vertical rhythm (2026-08-08). `gap` here, and NO vertical margin on
  // any card in the stack — see SCREEN_GAP's doc in constants/theme.ts for the five different
  // gaps this replaced. A child that is always mounted but sometimes zero-height (a closed
  // Collapsible) must be grouped or conditionally rendered, or it books a gap slot for nothing.
  content: { padding: Spacing.md, gap: SCREEN_GAP },

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
  // No `marginBottom` (2026-08-08): the card's own `gap: Spacing.md` already separates this
  // from the tips line, and the extra Spacing.xs made the heading→tips gap 20px on a card
  // where every other gap was 16.
  cardSubtitle: { fontSize: FontSize.md, fontFamily: Fonts.bold },
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
  // The card's bottom half stacks at the card's own rhythm — see the render-side note.
  habitsCardBody: { gap: Spacing.md },

  // Tips line (2026-08-06 v2) — plain text under the sub-header, not boxed.
  // The tips line's own row/icon/text styles are gone (2026-08-13) — components/CardHintNote
  // draws all three now. This is only the gap cancellation; see the mount for why.
  tipsNote: { marginBottom: 0 },

  // Suggested-habits chips (2026-08-06 v3) — rendered inside components/StarterCard's
  // `collapsible` drop-down now; the card/pill shell itself moved there, shared by every
  // screen that uses it. See the render-side "Suggested habits" note.
  // Only the cloud's own wrap/gap lives here now — the chip itself is
  // components/StarterSuggestionChip.tsx (2026-08-12), shared with HomeHabitsCard, Goals, the
  // Goals drawer and the health-issues sheet. The local `starterChip`/`starterChipText` styles
  // are deleted with it; they were the hued, filled, full-contrast copy the maintainer was
  // pointing at ("the filled buttons").
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },

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
  // On a list of counted habits it also repeated that emphasis once per row. The MOMENTARY
  // registration flash (2026-08-06, HabitCard's `flash` state) doesn't contradict this — it
  // clears itself a beat after the tap, unlike a static default fill, and both directions get
  // one (not just "+"), so neither half reads as the persistently "important" one.
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
});
