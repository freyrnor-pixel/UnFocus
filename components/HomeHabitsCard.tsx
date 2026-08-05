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
 *   Imports → components/Surface, components/CardAccent (CardAccentBadge), components/Badge,
 *             components/HabitIcon (starter chips only), components/HabitLeading (2026-08-04 —
 *             the row's leading mark: the habit's icon, or the brand leaf when it has none,
 *             DESIGN_COMPARISON/04 option (a)), components/PressableScale, components/ProgressBar,
 *             components/Motif (the `leaf-icon` corner accent, DESIGN_COMPARISON/04 option (b)),
 *             components/QuickAddOptionsPanel + components/QuickAddOptionRow (2026-08-04 —
 *             the type line's labeled Energy row, replacing an icon-only chip),
 *             components/CardHintNote (foot-of-card explainer), components/AddRow,
 *             components/CardMenuSheet (CardMenuButton — the header "⋮", when Home passes a menu),
 *             constants/theme, lib/haptics, lib/i18n, lib/date (todayStr), lib/useAppTheme,
 *             lib/domainColor, lib/habitRecurrence (habitOccursOn, habitProgress),
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
 *     ALL → one-tap `HABIT_STARTERS` chips, capped at `STARTER_PREVIEW_COUNT` (see that
 *     constant — the Habits TAB still offers all four), and the explainer
 *     (`t.starters.habits.text`) as a foot-of-card `components/CardHintNote`.
 *     **Simplified 2026-07-30**: this block used to open with a bulb explainer, then an
 *     "Example habits" caption, then a read-only `StarterExampleRow` — which rendered the
 *     first starter's own title and goal ("Drink 4 glasses of water 0/4") directly above a
 *     chip reading "Drink 4 glasses of water +". Same suggestion twice, four lines deep,
 *     before anything actionable. The chips ARE the example and they're tappable, so the
 *     row went; the explainer moved to the foot (see CardHintNote's header for why teaching
 *     no longer sits between a card's title and its content).
 *     Habits exist but none are due today → the same quiet `t.noHabitsYet` one-liner
 *     habits.tsx's Today tab shows in that case, so the two surfaces never disagree.
 *   - **Quick-add**: creates a daily/dailyGoal-1 habit with the same neutral default icon
 *     ('ellipse-outline') as habits.tsx's own `commitHabit`. As of 2026-08-01 the type line
 *     carries one essential setting — an Energy row (components/QuickAddOptionRow, labeled
 *     not icon-only since 2026-08-04; off→+1→−1→off, gated on `energySystemEnabled`, same
 *     cycle as PlanTaskCard's) — plus a "…" that commits the
 *     draft and opens the just-created habit's full editor (`/habit-form?id=`) pre-filled,
 *     for icon/goal/recurrence/reminders. Both the checkmark and "…" paths write the SAME
 *     row (`useHabitStore.add` returns the created Habit), so editing further in the full
 *     form is never a second copy. Always rendered, regardless of which empty state (if any)
 *     is showing — mirrors habits.tsx's own Today tab, where the quick-add row sits below
 *     the section unconditionally.
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
 *   - **`leaf-icon` corner accent (2026-08-04, DESIGN_COMPARISON/04).** A single small leaf
 *     motif tucked top-right, behind the header row (painted first, so it sits BEHIND the
 *     badge/count pill rather than competing with them — it simply disappears where they're
 *     opaque). Deliberately **not** tinted `domainColor.accent`: DESIGN_RULES_AUDIT.md's
 *     item 10 already counts FOUR identity-hue fill-derivatives on this card (badge, card
 *     edge, progress-bar fill, count pill) — a leaf carrying the same hue would be a fifth
 *     expression of "this is Habits" with no new information, the exact thing A.4 rule 3
 *     removed the whole-header wash for. `theme.textMuted` instead (same neutral token
 *     SectionDivider's `trunk-divider` motif uses), at low opacity — texture, not a colour
 *     statement. `leaf-icon` (not `leaf-sprig`): the sprig is an ILLUSTRATION with its own
 *     baked blue palette that `color` can't override, and blue reads as a foreign object on
 *     this card's green edge — see Motif.tsx's header and `constants/motifs.ts`'s `pal` field.
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
import Motif from '@/components/Motif';
import HabitIcon from '@/components/HabitIcon';
import HabitLeading from '@/components/HabitLeading';
import CardHintNote from '@/components/CardHintNote';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, PAD_GUTTER, Radius, Spacing, HitSlop, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useHabitStore, Habit } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
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

type Props = {
  /** Home's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
};

export default function HomeHabitsCard({ cardMenu }: Props) {
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
  // Quick-add's one essential setting (2026-08-01) — mirrors PlanTaskCard's energy chip
  // (off→+1→−1→off). Icon/goal/reminders stay full-editor-only; see the "…" button below.
  const [habitEnergyValue, setHabitEnergyValue] = useState(0);
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);

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
  function createHabit(
    title: string,
    icon: string,
    dailyGoal: number,
    energyEnabled = false,
    energyValue = 1
  ): Habit {
    const habit = addHabit({
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
      energyEnabled,
      energyValue,
      goalId: null,
    });
    success();
    return habit;
  }

  function cycleEnergy() {
    tap();
    setHabitEnergyValue((current) => (current === 0 ? 1 : current > 0 ? -1 : 0));
  }

  function commitHabit() {
    const title = habitDraft.trim();
    if (!title) return;
    // Neutral "to-do" marker default, matching habits.tsx's own quick-add — a star reads
    // as a reward/rating, against the app's no-shame framing.
    createHabit(title, 'ellipse-outline', 1, habitEnergyValue !== 0, habitEnergyValue || 1);
    setHabitDraft('');
    setHabitEnergyValue(0);
  }

  // "…" — commits the same draft as the checkmark, then opens the just-created habit's full
  // editor pre-filled (icon/goal/reminders live there). Same saved row either way, so editing
  // in the full form updates the one the quick-add already wrote.
  function commitHabitAndEdit() {
    const title = habitDraft.trim();
    if (!title) return;
    const habit = createHabit(title, 'ellipse-outline', 1, habitEnergyValue !== 0, habitEnergyValue || 1);
    setHabitDraft('');
    setHabitEnergyValue(0);
    router.push({ pathname: '/habit-form', params: { id: habit.id } });
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
                style={[styles.adjBtn, styles.adjBtnPlus, { backgroundColor: domainColor.accent }]}
                onPress={counted}
                hitSlop={HitSlop.base}
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
      {/* Corner leaf accent (DESIGN_COMPARISON/04) — painted first so the header row's badge
          and count pill, drawn after, stack on top and hide it wherever they're opaque. */}
      <Motif id="leaf-icon" color={theme.textMuted} opacity={0.45} fit="meet" style={styles.leafAccent} />
      <View style={styles.cardContent}>
        {/* Badge is a normal flex child — one left edge for the whole card. */}
        <View style={styles.titleRowPressable}>
          <View style={styles.titleRow}>
            {/* Only the badge + title navigate. The count pill and the ⋮ are siblings, not
                children — a Badge inside a PressableScale reads as a button that isn't one,
                and an icon button nested in a larger pressable makes its own tap ambiguous. */}
            <PressableScale onPress={handleTitlePress} style={styles.headerLeft} scaleTo={0.98}>
              <CardAccentBadge domain="habit" size={32} />
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{t.habitsTitle}</Text>
              </View>
            </PressableScale>
            {/* Count pill, not the old grey sentence (DESIGN_COMPARISON/09) — see
                HomeNotesCard's edit note for why it's a fixed-position row sibling rather than
                inline after the title. */}
            {dueTodayHabits.length > 0 && (
              <Badge
                label={`${pendingCount}/${dueTodayHabits.length}`}
                bg={domainColor.soft}
                fg={theme.textMuted}
                borderColor={rgba(domainColor.accent, 0.3)}
                tabularNums
                accessibilityLabel={t.pad.summary(pendingCount, dueTodayHabits.length)}
              />
            )}
            {cardMenu ? <CardMenuButton cardTitle={t.habitsTitle} {...cardMenu} /> : null}
          </View>
          {/* Outside the tap target on purpose: a progress bar is a readout, not a button. */}
          {dueTodayHabits.length > 0 && (
            <ProgressBar
              value={doneCount / dueTodayHabits.length}
              color={domainColor.accent}
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
          // tappable; the explainer moved to the card's foot (CardHintNote, below).
          <View style={styles.emptyWrap}>
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
                  <HabitIcon icon={s.icon} size={13} color={theme.textMuted} />
                  <Text style={[styles.starterChipText, { color: theme.text }]}>{t.starters.habits.suggestions[s.key]}</Text>
                  <Ionicons name="add" size={13} color={theme.accent} />
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
              onMore={commitHabitAndEdit}
              panel={
                energySystemEnabled ? (
                  <QuickAddOptionsPanel>
                    <QuickAddOptionRow
                      icon={habitEnergyValue === 0 ? 'flash-outline' : habitEnergyValue > 0 ? 'flash' : 'flash-off'}
                      label={t.energyMeter.title}
                      value={habitEnergyValue === 0 ? t.off : habitEnergyValue > 0 ? '+1' : '-1'}
                      isSet={habitEnergyValue !== 0}
                      accent={domainColor.accent}
                      onPress={cycleEnergy}
                      accessibilityLabel={`${t.energyConsumeLabel}: ${habitEnergyValue === 0 ? t.off : habitEnergyValue > 0 ? '+1' : '-1'}`}
                    />
                  </QuickAddOptionsPanel>
                ) : undefined
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

        {/* Explainer at the FOOT (2026-07-30) — it used to lead the empty state, between the
            title and the first tappable thing. Only while there are no habits at all. */}
        {habits.length === 0 ? <CardHintNote text={t.starters.habits.text} noBorder /> : null}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Corner leaf accent (DESIGN_COMPARISON/04). Positioned against the Surface's own content
  // view (zero padding there — cardContent applies its own inset), so top/right sit close to
  // the card's true edge, mostly in the strip above the title row; Surface's internal
  // overflow:'hidden' mask clips it to the rounded corner for free, no extra style needed here.
  leafAccent: { position: 'absolute', top: Spacing.xs, right: Spacing.xs, width: 28, height: 28 },
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
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, includeFontPadding: false, textAlignVertical: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  // Just the starter chips now — the explainer moved to a foot-of-card CardHintNote and the
  // read-only example row (a duplicate of chip #1) is gone entirely (2026-07-30).
  emptyWrap: { gap: Spacing.sm, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
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
