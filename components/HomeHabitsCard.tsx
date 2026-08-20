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
 * title + −/+ log control (the same increment/decrement model app/habits.tsx's
 * HabitCard uses — a habit's dailyGoal can be >1, so a plain checkbox can't always mean
 * "done"), collapsed to the first 5 with a "Show all/less" toggle, and a trailing
 * quick-add row. Tapping the title navigates to the full Habits tab. Self-contained
 * (reads useHabitStore directly) — no props, unlike PlanTaskCard/HomeShoppingCard which
 * need Home's own cross-store aggregation (Habits doesn't touch any other store).
 *
 * Connections:
 *   Imports → components/NarratorQuote (2026-08-19 — what the empty slot says, restored in step
 *             with app/habits.tsx, which lost the same line in the same 2026-08-12 pass),
 *             components/Surface, components/CardAccent (CardAccentBadge), components/Badge,
 *             components/StarterCard (2026-08-13 — `embedded collapsible`, so the suggestions
 *             sit in the same foldable box every other empty-state example does; this card's
 *             hand-rolled label-plus-bare-cloud is deleted),
 *             components/StarterSuggestionChip (2026-08-12 — the shared empty-state
 *             suggestion chip; this card's own hand-rolled copy is deleted),
 *             components/HabitIcon (starter chips only), components/HabitLeading (2026-08-04 —
 *             the row's leading mark: the habit's icon, or the brand leaf when it has none,
 *             DESIGN_COMPARISON/04 option (a)), components/PressableScale, components/ProgressBar,
 *             components/QuickAddOptionsPanel + components/QuickAddOptionRow (2026-08-04 —
 *             the type line's labeled Energy row, replacing an icon-only chip),
 *             components/Stepper + lib/energy (energyFieldsFromStepper — that row's signed
 *             − 0 + control since 2026-08-05, replacing a tap-cycle),
 *             components/HabitRecurrenceCells + lib/useHabitRecurrenceDraft (2026-08-11 —
 *             the "every N days/weeks" repeat picker cells, rendered in the same panel as the
 *             energy row above; split out because app/habits.tsx mounts an IDENTICAL
 *             panel and the two are pinned against each other by
 *             lib/__tests__/energyModes.test.ts),
 *             components/AddRow,
 *             components/CardMenuSheet (CardMenuButton — the header "⋮", when Home passes a menu),
 *             constants/theme, lib/haptics, lib/i18n, lib/date (todayStr), lib/useAppTheme,
 *             lib/screenColor, lib/habitRecurrence (habitOccursOn, habitProgress),
 *             lib/habitStarters (HABIT_STARTERS — one-tap starter chips), store/useHabitStore,
 *             store/useSettingsStore (energySystemEnabled, gates the quick-add energy chip)
 *   Used by → app/(tabs)/index.tsx (Home habits preview, placed directly under the To-do/
 *             Plans card)
 *   Data    → reads/writes useHabitStore (habits + habit_logs) via increment/decrement/add
 *
 * Edit notes:
 *   - **New card (2026-07-28, user report: "Habits card must be added to home screen under
 *     to-do")**: a full interactive mirror, not a read-only summary. Positioned right after
 *     'plans' in the default `settings.homeCardOrder` (see store/useSettingsStore.ts's
 *     default + lib/db.ts's back-fill migration for existing installs).
 *   - **Due-today filtering** mirrors app/habits.tsx's Today tab (`habitOccursOn`),
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
 *     ALL → one-tap `HABIT_STARTERS` chips, capped at `STARTER_PREVIEW_COUNT` (see that
 *     constant — the Habits TAB still offers all four). It also carried a one-line explainer
 *     under the header (`t.starters.habits.text`, a bulb + italic sentence); **that whole tier
 *     was deleted on 2026-08-17** — *"a native app should not read like a manual"* — so the card
 *     goes straight from its header to its content. The string is deleted too, not just
 *     unmounted. ⚠️ It said "the ⓘ banner is where a screen explains itself" — that stopped
 *     being true on 2026-08-20, when the banner was deleted app-wide; the empty-state
 *     components/StarterCard.tsx is where it happens now.
 *   - **Quick-add**: creates a daily/dailyGoal-1 habit with the same neutral default icon
 *     ('ellipse-outline') as habits.tsx's own `commitHabit`. As of 2026-08-01 the type line
 *     carries one essential setting — an Energy row (components/QuickAddOptionRow, labeled
 *     not icon-only since 2026-08-04, gated on `energySystemEnabled`) — plus a second button
 *     beside the confirm check. Both changed on 2026-08-05:
 *       - **Energy is a signed `− 0 +` Stepper, not a tap-cycle.** It used to cycle
 *         off→+1→−1→off and print `t.off` ("av") for zero: no sign that tapping cycled, no
 *         way back, and a word naming neither the control nor the choice (user report: "The
 *         'av' does not make sense to me"). Both real editors — components/TaskCard.tsx and
 *         app/habit-form.tsx — already used exactly this Stepper for exactly this number.
 *       - **"More options" opens `/habit-form` prefilled and saves NOTHING.** It used to
 *         create the habit and then open the saved row, so an empty line hit an early
 *         `return` and the button did nothing at all (user report: "The three dots don't do
 *         anything"). A habit is the one surface here with a real create-mode editor screen,
 *         so the draft goes over as params (`title`, `energy`) and Save there is the only
 *         write — backing out leaves no half-made habit behind.
 *     Always rendered, regardless of which empty state (if any) is showing — mirrors
 *     habits.tsx's own Today tab, where the quick-add row sits below the section
 *     unconditionally. Keep this in step with habits.tsx's copy; lib/__tests__/energyModes.test.ts
 *     pins both.
 *   - Collapsed sizing follows the exact same pattern as HomeShoppingCard/HomeNotesCard/
 *     PlanTaskCard — see any of those files' own edit notes.
 *   - **(2026-07-31, addendum A.4) The header wash is gone.** The identity hue appears as the
 *     badge fill, the card's own low-alpha edge, the progress-bar fill and — since 2026-08-04,
 *     DESIGN_COMPARISON/09 — the header's count pill's plate; all four are the "fill-shaped
 *     derivative" uses A.4 rule 1 permits (`lib/domainColor.ts`'s header), never text/icon
 *     colour. What's gone for good is the WHOLE-HEADER wash A.4 rule 3 removed — one flat band
 *     repeating the same idea a third time with no new information. The count pill isn't that:
 *     it's the same fill vocabulary carrying a number nothing else on the card shows.
 *   - **Count pill, not a summary sentence (2026-08-04, DESIGN_COMPARISON/09).** Fixed-position
 *     header-row sibling, not inline after the title — see HomeNotesCard's edit note for why.
 *   - **The header "⋮" (2026-08-04, workstream A)**: `cardMenu` is optional and BUILT BY HOME
 *     (app/(tabs)/index.tsx), not here — the rows it carries change `settings.homeCardOrder` and
 *     Home's reorder mode, neither of which this card can reach. Adding it split the header the
 *     way HomeNotesCard/HomeShoppingCard already were: the tap-through PressableScale now wraps
 *     only the badge + title (`headerLeft`), so the count pill and the ⋮ are its siblings rather
 *     than nested pressables inside it. The progress bar stopped being part of the tap target in
 *     the same change — it is a readout, not a button, and the title above it still navigates.
 *   - **`leaf-icon` corner accent — REMOVED (2026-08-06, user report: "weird leaf in the
 *     upper right corner").** Was a small leaf motif tucked top-right behind the header row
 *     (2026-08-04, DESIGN_COMPARISON/04); read as an unexplained stray mark rather than
 *     texture. Don't re-add it without a direct ask.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge } from '@/components/CardAccent';
import { Badge } from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import HabitIcon from '@/components/HabitIcon';
import HabitLeading from '@/components/HabitLeading';
import NarratorQuote from '@/components/NarratorQuote';
import StarterCard from '@/components/StarterCard';
import StarterSuggestionChip from '@/components/StarterSuggestionChip';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import { useCardExpand } from '@/lib/useCardExpand';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import HabitRecurrenceCells from '@/components/HabitRecurrenceCells';
import Stepper from '@/components/Stepper';
import { energyFieldsFromStepper } from '@/lib/energy';
import { useHabitRecurrenceDraft } from '@/lib/useHabitRecurrenceDraft';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, OpticalCenter, PAD_GUTTER, Radius, Spacing, HitSlop, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useHabitStore, Habit, HabitRecurrence } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
import { HABIT_STARTERS } from '@/lib/habitStarters';
import { getScreenColor } from '@/lib/screenColor';
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

type Props = {
  /** Home's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
  /**
   * Draw as a SECTION inside another card rather than as a card of its own (2026-08-20, the
   * 5→3 tab merge). Home passes this into components/PlanTaskCard.tsx's `extraSection`, so
   * "I dag" is one card holding the day's tasks and the day's habits.
   *
   * **Presentation only — no behaviour goes behind this flag**, the same contract
   * components/FoodTab.tsx and components/CatalogueTab.tsx's `embedded` prop carries. It drops
   * exactly two things, and both are chrome that assumes a card of one's own:
   *   - the `<Surface>`. A Surface inside a Surface reads as a nested panel, which is the rule
   *     the Goals/Food/Catalogue drawers already follow.
   *   - the `CardAccentBadge` + the ⋮ menu. A section header inside a card is a LABEL; a badge
   *     and a per-card menu belong to the card, and the host card already has both.
   * Everything else is identical: the same rows, the same composer, the same starter card, the
   * same narrator line, the same footer toggle sizing the same list. The count badge stays —
   * it says how big the section is, which is exactly what a section header is for.
   */
  embedded?: boolean;
};

export default function HomeHabitsCard({ cardMenu, embedded = false }: Props) {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  // The card's one hue (border + every content accent). This used to be lib/domainColor's
  // 'habit' identity, a different value from the screen border below — content now pulls
  // from the same screenColor the border does, so the whole card is one colour family.
  const screenColor = getScreenColor(theme, 'habits');
  // Full-screen expansion (2026-08-20) — a separate control from the title, which still pushes
  // to /habits: that pushed screen holds deeper per-habit setup and the Week/Month calendar
  // views an expanded preview does not, so both stay live (see lib/siteNav.ts's note).
  const cardExpand = useCardExpand('homeHabits');
  const today = todayStr();

  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const increment = useHabitStore((s) => s.increment);
  const decrement = useHabitStore((s) => s.decrement);
  const addHabit = useHabitStore((s) => s.add);

  const [state, setState] = useCardState('habits');
  const [habitDraft, setHabitDraft] = useState('');
  // Quick-add's one essential setting (2026-08-01) — mirrors PlanTaskCard's energy chip
  // (off→+1→−1→off). Icon/goal/reminders stay full-editor-only; see the "…" button below.
  const [habitEnergyValue, setHabitEnergyValue] = useState(0);
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  // "Every N days/weeks" repeat picker (2026-08-11) — always visible, unlike the energy chip
  // above; see lib/useHabitRecurrenceDraft.ts's header for why the state lives in a shared hook.
  const habitRecurrenceDraft = useHabitRecurrenceDraft();

  const dueTodayHabits = habits.filter((h) => habitOccursOn(h, today));
  const doneCount = dueTodayHabits.filter((h) => habitProgress(h, logs, today).isDone).length;
  const pendingCount = dueTodayHabits.length - doneCount;

  const visibleHabits = padVisibleRows(dueTodayHabits, state);

  function handleTitlePress() {
    router.push('/habits');
  }

  // Same new-habit shape app/habit-form.tsx writes, minus the fields the quick-add/starter
  // chips leave at their defaults — mirrors habits.tsx's own createHabit exactly (icon and
  // dailyGoal are the only inputs that actually vary between the two callers there). Returns
  // the created Habit (useHabitStore.add does since 2026-08-01) so the "…" quick-add path can
  // navigate straight to it.
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
  ): Habit {
    const habit = addHabit({
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
      childName: '',
      energyEnabled,
      energyValue,
      goalId: null,
    });
    success();
    return habit;
  }

  function commitHabit() {
    const title = habitDraft.trim();
    if (!title) return;
    // Neutral "to-do" marker default, matching habits.tsx's own quick-add — a star reads
    // as a reward/rating, against the app's no-shame framing.
    const energy = energyFieldsFromStepper(habitEnergyValue);
    const { recurrence, recurrenceDays, recurrenceInterval, dailyGoal } = habitRecurrenceDraft.toHabitFields();
    createHabit(title, 'ellipse-outline', dailyGoal, energy.energyEnabled, energy.energyValue, recurrence, recurrenceDays, recurrenceInterval);
    setHabitDraft('');
    setHabitEnergyValue(0);
    habitRecurrenceDraft.reset();
  }

  /**
   * "More options" — opens the habit editor with the quick-add's draft carried over, and
   * **saves nothing** (2026-08-05).
   *
   * It used to create the habit first and then open the saved row, which meant an empty line
   * hit `if (!title) return;` and the button did nothing at all — the user report that started
   * this pass ("The three dots don't do anything"). A habit is the one surface here with a
   * real create-mode editor screen, so it can do the honest thing instead: hand the draft to
   * `/habit-form` as params and let Save there be the only write. Backing out costs nothing
   * and leaves no half-made habit behind, and an empty line is a perfectly valid press — it
   * just opens a blank form, which is what "more options" means when you haven't typed yet.
   */
  function openHabitFormWithDraft() {
    tap();
    const title = habitDraft.trim();
    router.push({
      pathname: '/habit-form',
      params: { title, energy: String(habitEnergyValue), ...habitRecurrenceDraft.toParams() },
    });
    setHabitDraft('');
    setHabitEnergyValue(0);
    habitRecurrenceDraft.reset();
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
        accent={screenColor.base}
        done={isDone}
        leading={
          // A.4: done is a STATUS, so it takes the status token as ink (`good`); the habit's
          // own glyph is neutral ink. Neither is the identity hue — that stays a fill (the
          // header badge + the card edge).
          // A habit with no chosen icon draws the brand leaf rather than nothing (2026-08-04,
          // design comparison task 04(a)) — see components/HabitLeading.tsx for why the leaf
          // can fill a slot the neutral hollow-circle default could not.
          isDone ? (
            <Ionicons name="checkmark" size={16} color={theme.good} />
          ) : (
            <HabitLeading icon={habit.icon} size={16} color={theme.textMuted} />
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
                <Text style={[styles.adjBtnText, { color: theme.text }]}>+</Text>
              </PressableScale>
            </View>
          ) : undefined
        }
        onToggle={goal > 1 ? undefined : () => (isDone ? decrement(habit.id, today) : counted())}
        toggleLabel={habit.title}
      />
    );
  }

  const body = (
      <View style={embedded ? styles.embeddedContent : styles.cardContent}>
        {/* Badge is a normal flex child — one left edge for the whole card. */}
        <View style={styles.titleRowPressable}>
          <View style={styles.titleRow}>
            {/* Only the badge + title navigate. The count pill and the ⋮ are siblings, not
                children — a Badge inside a PressableScale reads as a button that isn't one,
                and an icon button nested in a larger pressable makes its own tap ambiguous. */}
            <PressableScale onPress={handleTitlePress} style={styles.headerLeft} scaleTo={0.98}>
              {/* No badge when embedded: a section header inside a card is a label, and the
                  host card already carries the one badge (see the `embedded` prop's doc). */}
              {!embedded && (
                <CardAccentBadge domain="habit" size={32} accentOverride={screenColor.base} />
              )}
              <View style={styles.headerText}>
                <Text
                  style={[embedded ? styles.sectionTitle : styles.title, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {t.habitsTitle}
                </Text>
              </View>
            </PressableScale>
            {/* Count pill, not the old grey sentence (DESIGN_COMPARISON/09) — see
                HomeNotesCard's edit note for why it's a fixed-position row sibling rather than
                inline after the title. */}
            {dueTodayHabits.length > 0 && (
              <Badge
                label={`${pendingCount}/${dueTodayHabits.length}`}
                bg={screenColor.soft}
                fg={theme.textMuted}
                borderColor={rgba(screenColor.base, 0.3)}
                tabularNums
                accessibilityLabel={t.pad.summary(pendingCount, dueTodayHabits.length)}
              />
            )}
            {/* ⚠️ **No CardExpandButton here (2026-08-19).** `homeHabits`'s registered body in
                components/CardExpandHost.tsx is still `ComingSoonBody` — the real habits surface
                has never been extracted out of app/habits.tsx the way To-do, Health and Notes
                were — so this button opened a full-screen pane whose only content was the words
                "Expand card". That was invisible while this card was one of five on a busy Home
                screen; it is one of THREE on the Me tab now, and a stub is not something to ship
                on a screen this small. Same call, and the same wording, as the `shopLists`
                placeholder: unreachable rather than a button that opens a stub. The id stays in
                lib/expandableCards.ts so a future pass can extract `HabitsSurface.tsx` and wire
                it up; the way to the deep surface today is the header title → pushed
                app/habits.tsx, which is unchanged. */}
            {cardMenu && !embedded ? <CardMenuButton cardTitle={t.habitsTitle} {...cardMenu} /> : null}
          </View>
          {/* Outside the tap target on purpose: a progress bar is a readout, not a button. */}
          {dueTodayHabits.length > 0 && (
            <ProgressBar
              value={doneCount / dueTodayHabits.length}
              color={screenColor.base}
              height={4}
              style={styles.progressBar}
            />
          )}
        </View>


        {habits.length === 0 ? (
          // No habits AT ALL — one-tap starters, and nothing else (2026-07-30). This block used
          // to open with a bulb explainer, then an "EXAMPLE HABITS" caption, then a read-only
          // StarterExampleRow — which rendered "Drink 4 glasses of water 0/4" directly above a
          // chip reading "Drink 4 glasses of water +", i.e. the same suggestion twice, four
          // lines deep, before anything you could act on. The chips ARE the example and they're
          // tappable. (The explainer line that used to sit above it is deleted — 2026-08-17.)
          //
          // **The shared collapsible box since 2026-08-13.** The trigger row used to be a plain
          // `starterTapLabel` Text with an unboxed chip cloud under it — a hand-rolled stand-in
          // for components/StarterCard's `collapsible`, and the reason this card's suggestions
          // were the one set in the app that could not be folded away. Same content, same
          // chips; what it gains is the border, the chevron and the fold (maintainer,
          // 2026-08-13: "boxed everywhere so it can always be folded"). `embedded` because we
          // are inside this card's own Surface already, and **no `text`** — the explainer is
          // the explainer line that used to sit above, and one card saying the same sentence twice with two
          // different lifespans is what StarterCard's optional-`text` note warns against.
          <View style={styles.emptyWrap}>
            {/* The narrator (2026-08-19), above the fold — Home's habits card and the Habits
                tab lost their "nothing here yet" lines in the same 2026-08-12 pass and for the
                same reason, so they take the restoration together. Letting only the tab speak
                is exactly the Home-vs-tab drift the row rule's note warns about. See
                components/NarratorQuote.tsx. */}
            <NarratorQuote category="habits" />
            <StarterCard embedded collapsible>
              {/* components/StarterSuggestionChip since 2026-08-12 — see the Habits tab's own
                  mount for why the five hand-rolled copies became one. Two chips, not four:
                  `npm run wraps` had the four-chip row wrapping at every width tested. */}
              <View style={styles.starterChips}>
                {HABIT_STARTERS.slice(0, STARTER_PREVIEW_COUNT).map((s) => (
                  <StarterSuggestionChip
                    key={s.key}
                    label={t.starters.habits.suggestions[s.key]}
                    leading={<HabitIcon icon={s.icon} size={14} color={theme.textMuted} />}
                    onAdd={() => createHabit(t.starters.habits.suggestions[s.key], s.icon, s.dailyGoal)}
                    addLabel={t.starters.addExample}
                  />
                ))}
              </View>
            </StarterCard>
          </View>
        ) : null}

        <PadSheet
          state={state}
          typeRow={
            <PadTypeRow
              prompt={t.pad.type.habit}
              value={habitDraft}
              onChangeText={setHabitDraft}
              onSubmit={commitHabit}
              accent={screenColor.base}
              onMore={openHabitFormWithDraft}
              panel={
                <QuickAddOptionsPanel>
                  {/* A real signed stepper (2026-08-05), not the tap-cycle this used to be.
                      The row cycled off → +1 → −1 → off, showing the app's generic on/off
                      word `t.off` ("av") for zero — a value with no way to tell it cycled,
                      no way back, and no clue it was about energy at all (user report: "The
                      'av' does not make sense to me. Energy should be more apparent with
                      - 0 + buttons"). Both real editors — components/TaskCard.tsx and
                      app/habit-form.tsx — already use exactly this control for exactly this
                      number, so the quick-add was the odd one out. `QuickAddOptionRow` takes
                      a live node as its `value` (that is how PlanTaskCard mounts TimeBoxInput
                      and FormSwitch), so nothing about the row itself had to change.
                      The label is `energyGiveTakeLabel` for the same reason: it is what the
                      editors say, and unlike a bare "Energy" it names what the number does. */}
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
                      accent={screenColor.base}
                    />
                  )}
                  {/* "Every N days/weeks" (2026-08-11) — unconditional, unlike the energy
                      cell above; see components/HabitRecurrenceCells.tsx's header. */}
                  <HabitRecurrenceCells draft={habitRecurrenceDraft} accent={screenColor.base} />
                </QuickAddOptionsPanel>
              }
            />
          }
        >
          {visibleHabits.map(renderHabitRow)}
        </PadSheet>

        <PadFooterToggle
          state={state}
          onChange={setState}
          total={dueTodayHabits.length}
        />

      </View>
  );

  // Embedded: no Surface of our own — we are already inside the host card's one.
  if (embedded) return body;

  return (
    <View ref={cardExpand.ref} collapsable={false}>
      <Surface
        surfaceContext="ambient"
        borderColor={screenColor.base}
        style={[styles.card, state !== 'open' && styles.cardCollapsed]}
      >
        {body}
      </Surface>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // No vertical margin (2026-08-08): the list that stacks these owns the gap
  // (`SCREEN_GAP`, constants/theme.ts). Was `marginBottom: Spacing.sm`.
  card: { borderRadius: Radius.md },
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
  // Embedded (2026-08-20): no horizontal padding, because the HOST card already applied its
  // own gutter — padding here again would inset this section's rows from the task rows above
  // and the two lists would not line up. Only a top gap, separating the section from the
  // task list's footer toggle.
  embeddedContent: { paddingTop: Spacing.lg },
  // Spacing.lg (was .md), matching HomeNotesCard/HomeShoppingCard/PlanTaskCard's header gap
  // (2026-07-30, user report: content below still read as crowding the colored badge at .md).
  titleRowPressable: { marginBottom: Spacing.lg },
  // Badge is a normal flex child now, so there is no paddingLeft dodging an absolute one.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // flex:1 + minWidth:0 so a long title yields to the pill and the ⋮ rather than pushing
  // them off the row — the wrap audit's "clipped controls" case (npm run wraps).
  headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  progressBar: { marginTop: Spacing.xs },
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, ...OpticalCenter },
  // A SECTION header INSIDE a card, which is a rung below the section headers the 2026-08-15
  // pass set at `FontSize.xl` extrabold — those sit on a SCREEN, where the screen title is 24
  // and a section may match it. Here the host card's own title is 20, so xl (24) made the
  // subordinate label the biggest thing in the card and inverted the hierarchy — caught in the
  // web preview, not by a test. `md` extrabold keeps the weight that carries the grouping while
  // sitting clearly under the title it belongs to.
  sectionTitle: { fontSize: FontSize.md, fontFamily: Fonts.extrabold, ...OpticalCenter },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  // Just the starter chips now — the explainer line that used to accompany them (2026-07-30 at the foot,
  // back under the header on 2026-08-12) and the read-only example row (a duplicate of
  // chip #1) is gone entirely.
  emptyWrap: { gap: Spacing.sm, marginBottom: Spacing.sm },
  // `starterTapLabel` is gone (2026-08-13) — it was a hand-rolled stand-in for StarterCard's
  // `collapsible` trigger row, which draws that label itself. Don't reintroduce a local copy.
  // The cloud's wrap/gap only — the chip is components/StarterSuggestionChip.tsx (2026-08-12).
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },

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
  // Both halves are the same recessed shape (2026-08-05) — the "+" used to carry a solid
  // domain-accent fill and drop its border. See components/Stepper.tsx's edit note: a −/+
  // pair is ONE control, and filling half of it in the action colour claims an emphasis the
  // "+" hasn't got. The matching pair on app/habits.tsx changed with it.
  adjBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, lineHeight: FontSize.sm },

});
