/**
 * EnergyMeter.tsx — Home's Energy STRIP (not a card) for the optional Energy system (2026-07-20).
 *
 * Shows today's and this week's energy as `current / capacity`, where current =
 * capacity + the net signed value of every energy task completed / energy habit
 * met in the period (lib/energy.ts). Tapping the edit affordance opens
 * components/EnergyConfigPanel.tsx — folded inline in the card since 2026-09-26 — which owns every number: today's and this
 * week's capacity, plus today's temporary extra (store/useEnergyStore.ts). There is no
 * stepper on the strip itself; see the 2026-08-03 corrections below before adding one.
 *
 * **Both warning rows are gone (2026-08-02).** The strip used to carry an amber "⚠️ Today is
 * planned to use 3 more Energy than you have available" line and a muted green "fully spent"
 * one — the loudest piece of guilt copy left in the app, plus a second line that could sit
 * beside it saying the same thing in another colour. lib/energyPause.ts collapses both
 * conditions into ONE predicate, and this file draws ONE calm accent control for it (see
 * "The overspend control" below). `t.energyMeter.overCommittedDay/Week` and `depletedDay/Week`
 * were deleted with them; don't reintroduce a warning line here.
 *
 * **The overspend control + the pause sheet (2026-08-02)**: while `useEnergyPause().overBudget`
 * and not yet paused, a `pause-circle-outline` in `theme.accent` sits on the strip line next to
 * the ✏️. It is a labelled control, never a badge — it does not animate, pulse, count or turn
 * red, because an over-full day is the worst possible moment for something on screen to start
 * moving. Tapping it opens components/EnergyPauseSheet.tsx; the sheet ALSO opens itself at most
 * once a day (`shouldAutoShow`) while Home is focused and the ✏️ editor is closed. Both of the
 * sheet's answers stamp the day in the store, so nothing re-opens after one, and the app never
 * refers back to which one was pressed.
 *
 * **"I'm good" hides the whole strip for the rest of the day** (`pause.paused`) — meter, editor,
 * hint and control — leaving ONE quiet muted line, `t.energyPause.afterGood`. Presentation only,
 * exactly like a card layout: energy costs keep being recorded, every stored value is untouched,
 * and the next date brings it all back. The sheet itself stays mounted through the pause so its
 * exit animation can finish.
 * That line is the acknowledgement, not a retrospective — the distinction the "the app never
 * reacts to the choice afterwards" rule actually draws. It is static, not tappable, offers no
 * way to un-pause, is never counted or referred to again, and disappears at midnight on its own.
 * Without it the strip silently emptied, which read as a bug rather than as an answer.
 *
 * **Surplus pips (2026-08-02)**: `energyPipCount` returns a third number for energy earned PAST
 * capacity, which the old clamp swallowed (`12 / 10` drew identically to `10 / 10`). Those draw
 * after the full ones as soft accent-outlined pips — a third object, distinct from both the
 * retired glossy token and the hollow spent ring (both gone — see below). They are capped at
 * MAX_SURPLUS_PIPS (4) in
 * lib/energy.ts; do NOT raise that, and read the width math below before assuming they fit.
 *
 * **Strip, not a card (2026-07-31, addendum task B.2)**: this stopped being a `Surface`. It has
 * no card background, no shadow, no card padding and no title row. Energy is chrome for the
 * day, not a fifth list to scroll past, and as a card it competed with the four content cards
 * below it. Don't re-wrap this in `Surface`/`GlassFill`, and don't reinstate the flash-icon +
 * `t.energyMeter.title` header ROW — the label described below does that job in a line the
 * layout already has.
 *
 * **Two lines, one layout, always labelled (2026-08-03).** The strip was ONE line in the common
 * single-meter case — pips, `current / capacity`, edit glyph, no label — and the stacked
 * label+value shape only in `energyMode: 'custom'`. A first-time-user walkthrough killed that
 * arrangement because **it never said what it was**: ten saturated pips and "10 / 10" at the
 * very top of Home, above all content, read as a score or a level — precisely what this system
 * must not read as. The only thing naming it was the 12px italic hint underneath. Rule 11
 * (never colour or shape alone) in spirit if not letter.
 * So: ONE layout for every mode. Line 1 is `label · [temporary chip?] · [overspend?] · ✏️`,
 * line 2 is `pips · current / capacity`, and the permanent hint sits under both. The label
 * carries the word "Energy" (see `t.energyMeter.today`/`thisWeek`).
 * This also RESOLVES the width squeeze the old inline layout documented at length below rather
 * than working around it: ten pips no longer share a row with a label, a value and two glyphs,
 * so the "deliberately tight ≈318px of 328px" arithmetic no longer applies to any mode. The pip
 * row keeps its `flex:1 / minWidth:0 / overflow:'hidden'` clip guard anyway — surplus pips can
 * still overrun a narrow phone, and clipping is that row's documented job.
 *
 * **Three corrections to that pass, from the maintainer's review the same day (2026-08-03).**
 * The first version of it also moved the two capacity steppers OUT of the ✏️ and onto the
 * strip's own top line, always visible. That lasted a day. The review, verbatim: *"the plus and
 * minus is too flexible, and it is not obvious to a user what is what. Energy per day should be
 * configured in a pop-up, not just whenever, and if they have extra Energy that is supposed to
 * be shown as temporary. So it's better to just have a 'tutorial' there instead before anything
 * is added."* Hence:
 *   1. **No stepper anywhere on this strip.** Every number is set in
 *      `components/EnergyConfigSheet.tsx`, which the ✏️ opens — a labelled pop-up where each
 *      stepper has a name and a line saying what it changes, neither of which fits on a strip
 *      line. A bare ± beside a `7 / 10` readout cannot say whether it moves the capacity or the
 *      spend, and being always-there invites nudging the number on every glance. Setting how
 *      much a day holds is a deliberate act. Read that file's header before reversing this: it
 *      is the second reversal on this question, not the first.
 *      ⚠️ **Superseded 2026-09-26 — the sheet became an inline fold in the card.** The
 *      maintainer asked for energy to be *"redigert i kortet"*. What survives of this correction
 *      is its substance: still no always-visible ±, still a name + hint on every stepper — they
 *      now sit in `components/EnergyConfigPanel.tsx`, folded behind the adjust row.
 *   2. **Extra energy reads as temporary, on the strip.** A boost used to vanish into the
 *      total — `+3` simply made a 10-energy day print `13 / 13`, indistinguishable from
 *      somebody whose usual day is 13. The day row now carries a muted `+N today only` chip
 *      (`t.energyMeter.boostChip`) whenever `boostForDay > 0`. Deliberately a neutral
 *      `components/Badge`, not accent and not a fourth kind of pip: borrowed energy is a
 *      footnote about today, not a reward and not a bigger day. Four pip shapes on one row
 *      (available / spent / surplus / borrowed) was the other option and it is not legible.
 *   3. **Before anything has been added, this spot teaches instead of measuring** — see the
 *      "Tutorial state" note below.
 *
 * **Tutorial state (2026-08-03)**: while nothing in the app carries an energy value AND the
 * user has never set a period's capacity, the strip draws `components/StarterCard.tsx` with two
 * sentences and one button into the config sheet, INSTEAD of the meter, the hint and the ✏️.
 * A full ten-pip bar with nothing able to spend it is the score-reading problem at its worst:
 * it is a number that only ever sits at 10/10, above every piece of real content, on the screen
 * a new user sees first.
 *   - **The gate is emptiness, and it is honest about not knowing yet.** `hasEnergyItems` (any
 *     task or habit with a non-zero energy value) OR `hasSetCapacity` (any `energy_budgets`
 *     override row, which is the fingerprint of anyone who has ever opened the sheet) sends the
 *     meter back, and deleting everything brings the tutorial back — same contract as every
 *     other StarterCard. But it is ALSO gated on all three stores having `loaded`: snapshotting
 *     an unloaded store reads as "nothing added" and would flash teaching copy at a user who
 *     has been using Energy for months. While loading, the meter draws (today's behaviour), so
 *     the flash can only ever go the harmless way.
 *   - **This does not contradict the permanent-hint rule below.** The objection that retired
 *     the old Energy StarterCard was that it was a SIBLING card sitting between the meter and
 *     the to-do card, so it read as belonging to the wrong one, and that a self-destructing
 *     explanation is gone by the time you come back to the number months later. This card is
 *     neither: it stands exactly where the meter will stand, with nothing above it, and the
 *     explanation it replaces is still permanent — `t.energyMeter.hint` under the meter, and
 *     every field's own line in the config sheet, both there forever.
 *   - `pause.paused` still wins over it: a day the user has closed out shows the one quiet
 *     line and nothing else, teaching included.
 *
 * **Rendered only when `settings.energySystemEnabled` (2026-07-31)** — Energy is a real toggle
 * again (it was unconditional 2026-07-26 → 2026-07-31), so app/(tabs)/index.tsx gates this
 * mount. The strip is FIXED on Home: it is not a card in lib/cardRegistry.ts, so it
 * can be neither dragged nor removed with the ×; turning the feature off in Settings → Advanced
 * → Features is the only way to make it go away.
 * settings.energyMode (2026-07-24) picks which meter(s) show: 'daily' hides the week
 * row, 'weekly' hides the day row, 'custom' (per-weekday capacities set in
 * app/settings.tsx) shows both since the week total derives from the seven days. (Until
 * 2026-08-03 'custom' was also the only mode drawn as two stacked lines; every mode is now, see
 * the layout note above.)
 *
 * **The permanent inline hint is DELETED (2026-08-17).** From 2026-07-27 the strip carried one
 * small italic line (`t.energyMeter.hint`, "Plan the day around the energy you actually have.")
 * under a hairline rule, directly below the meter, always — the shape that later became the
 * app's shared bulb explainer. The maintainer's ruling deleted that whole tier: *"A native app
 * should not read like a manual… Delete all lightbulb (💡) sections entirely."* The string is
 * gone from lib/i18n.ts too, not just unmounted.
 * ⚠️ **What that costs, stated so it is a decision and not an oversight:** the hint was the only
 * thing on this strip naming what the pips ARE, which is why it survived the 2026-07-31 pass
 * that took away the card and its title. What answers that now is the LABEL on line 1 (which
 * carries the word "Energy" — see `t.energyMeter.today`) plus the tutorial state below, which
 * stands in place of the meter until something can actually spend energy. If the strip ever
 * reads as a score again, the fix is the label or the tutorial, not a line of italic under it.
 * It had replaced a `components/StarterCard` sibling that
 * carried two "+" example rows and vanished once anything had an energy value. Two problems with
 * that, both reported: (1) as a separate card BELOW the meter and directly ABOVE the to-do card,
 * it read as belonging to the to-do card, so its disappearing act looked like a bug in the wrong
 * place; (2) an explanation that self-destructs is unavailable exactly when a user comes back to
 * the number months later and has forgotten what it meant. Attached and permanent fixes both.
 * Keep it to ONE line and no examples — the meter is the smallest card on Home and an explainer
 * taller than the thing it explains was the earlier complaint.
 *
 * Bolt-row meter (2026-07-27): each period reads as a row of small flash-icon "pips"
 * (lib/energy.ts's energyPipCount — 1:1 up to 10, then scaled) plus the `current / capacity`
 * value, replacing the old two-line label-row + ProgressBar stack. A hairline divider
 * separates the day and week lines when both are shown (energyMode 'custom').
 *
 * **The width math, and the layout it used to justify (historical — read the 2026-08-03 layout
 * note above first).** This described the ONE-line arrangement, which no mode draws any more;
 * it is kept because the arithmetic still governs how much can go on the pip line.
 * Ten pips + the value + the edit glyph only
 * fit on one line because the strip pass took back the card's 32px of horizontal padding AND
 * shrank the pip from 24px to 18: at the audited 360px worst case that's 328px of
 * content for 216px of pips (10x18 + 9x4 gap) + ~70px of value at the `large` font scale + 16px
 * of glyph + two 8px gaps ≈ 318px. It is deliberately tight, so `pipRowInline` also carries
 * `flex:1 / minWidth:0 / overflow:'hidden'` — if a future font scale or narrower phone does run
 * out of room the pip row clips instead of painting over the value, which is exactly the
 * 2026-07-28 bug that forced the stacked layout in the first place. Re-check `npm run wraps`
 * before growing `BAR_ICON_SIZE` or putting a label back on this line. (The numbers below are
 * the retired 18px token's; the bar's glyph is `BAR_ICON_SIZE` 17 with the same `PIP_GAP`, so
 * the arithmetic is unchanged to within a pixel per pip.)
 * **Two 2026-08-02 additions spend that margin, and both degrade by clipping the pip row —
 * which is the row's documented job, not a new bug.** (1) The overspend control adds a second
 * 16px glyph plus a `RowTrailing.gap` (16) beside the ✏️: +32px, and only while today is over
 * budget. (2) Up to four surplus pips add up to 4 x (18 + PIP_GAP) = 88px, and only on a
 * day that has finished above its capacity. At the audited 360px worst case a full ten-pip bar
 * plus four surplus pips does NOT fit and the tail clips — the `current / capacity` readout
 * beside it still states the number in full, and the a11y label on the pip row carries
 * `t.energyMeter.surplusLabel(n)` regardless of what is drawn. The alternative (shrinking the
 * pip, or dropping the value) costs the common case to serve the rare one.
 * Every mode now draws the stacked layout that 'custom' pioneered for this reason: label (+ the
 * temporary chip) on a top line (`meterTopRow`), the pip row and the value on a full-width line
 * below it. Two labels' worth of extra text genuinely does not fit inline at any pip size worth
 * drawing — which is why the label-less one-liner existed, and why buying a second line was the
 * only way to give the strip a name.
 *
 * (**"Label dropped for the single-meter case (2026-07-28)"** used to be documented here:
 * `row()`'s `label` was nullable and passed only in 'custom' mode. Reversed on 2026-08-03 — the
 * label is unconditional and the param no longer admits null, which is the whole point of the
 * layout note above. `meterValue`'s `marginLeft:'auto'` still does the value's right-alignment.)
 *
 * **The edit affordance travels** (`row()`'s `trailing` param): it rides the end of the FIRST
 * visible meter's top line. It is passed to exactly one row — never render two.
 *
 * **The glossy energy-token pip is GONE (2026-09-06), and ~30 lines describing it were still
 * here until 2026-09-07.** From 2026-07-27 an available pip was a saturated token — a
 * `react-native-svg` `RadialGradient` fill, a dark rim, and a gloss ellipse, deliberately NOT
 * matching the app's matte button material because a pip is not pressable. It reached that shape
 * over three rounds and two explicit rejections, which is why it was documented at length.
 *   v2's Energibudsjett bar replaced it with a flat run of `flash` / `flash-outline` glyphs (see
 * `row()`), and the reason is in that renderer's own comment: the gloss is what made ten of them
 * read as a SCORE, which is the failure this component has been working around with words since
 * 2026-08-03. So this is a resolution of that problem, not a downgrade — but the token's
 * `react-native-svg` import, its three styles and this prose all survived the change and had to
 * be cleared separately. If a token ever comes back, read `docs/archive/AGENTS_HISTORY.md` for
 * why it was shaped that way before re-deriving it.
 *
 * **Depleted/recovered pulse (2026-07-28)**: `EnergyPulse` fires a single ~1.5s glow (via
 * `getGlow`) the moment a period's `current` crosses the zero line — `theme.good` when it
 * goes from ≤0 back to positive ("recovered"), `theme.accent` (deliberately NOT `theme.bad`)
 * when it drops to ≤0 ("depleted"). Tracked per-period via a prev-positive ref so it only
 * fires ON THE TRANSITION, never on mount or on every render while already in that state.
 * **Depleted state is not a failure state.** The glow is the whole of it now: the calm/caring
 * `t.energyMeter.depletedDay/Week` line it used to be paired with was deleted along with the
 * warning rows (see above), so there is no copy left to keep on the right side of that line —
 * and nothing should be added. The system's point is balance/planning, not spending it all,
 * and a day that hits zero is a cue to ease off, never a "Great job!" and never a scolding.
 *
 * Connections:
 *   Imports → components/Badge (the `+N today only` chip), components/Button,
 *             components/PressableScale, components/StarterCard (the tutorial state),
 *             components/EnergyConfigPanel (inline, in a components/Collapsible),
 *             components/EnergyPauseSheet,
 *             constants/theme, constants/motion, lib/useAppTheme, lib/i18n, lib/date, lib/energy,
 *             lib/useEnergyPause, store/useSettingsStore, store/useTaskStore,
 *             store/useHabitStore, store/useEnergyStore, expo-router (useFocusEffect),
 *             react-native-reanimated
 *             (react-native-svg is deliberately NOT imported any more — the glossy token that
 *              needed it was replaced by the Energibudsjett bar on 2026-09-06; the import and
 *              its three pip styles were cleared on 2026-09-07, see the styles block;
 *              components/Surface is deliberately NOT imported any more — see "Strip, not a card";
 *              components/Stepper is not imported here — every stepper lives in
 *              EnergyConfigPanel, folded behind the card's adjust row since 2026-09-26)
 *   Used by → app/(tabs)/index.tsx (Home) — mounted fixed, above the Shared card and the
 *             card stack, gated on settings.energySystemEnabled
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides (base capacity AND the
 *             'b:' boost row); writes those overrides, plus today's pause/pin state through
 *             lib/useEnergyPause.ts (device-local `app_meta`, never synced)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Badge } from '@/components/Badge';
import PressableScale from '@/components/PressableScale';
import Card from '@/components/Card';
import Stepper from '@/components/Stepper';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import { SegmentedControl } from '@/components/FormControls';
import EnergyConfigPanel from '@/components/EnergyConfigPanel';
import Collapsible from '@/components/Collapsible';
import EnergyPauseSheet from '@/components/EnergyPauseSheet';
import { Fonts, FontSize, MIN_TAP_TARGET, Radius, RowTrailing, Spacing, getGlow, rgba } from '@/constants/theme';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { countRender, countLayout } from '@/lib/perfTrace';
import { useT } from '@/lib/i18n';
import { dayOfWeekMon0, todayStr } from '@/lib/date';
import { useIsPaneBody } from '@/lib/cardPane';
import { getScreenColor } from '@/lib/screenColor';
import { energyDeltaForDay, energyDeltaForWeek, energySplitForDay, energySplitForWeek, energyBudgetBar, MAX_PIPS } from '@/lib/energy';
import { useEnergyPause } from '@/lib/useEnergyPause';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';
import { Duration, Ease } from '@/constants/motion';

type PulseKind = 'recovered' | 'depleted';

/** The overspend row's pause glyph. */
const EDIT_ICON_SIZE = 16;

/* The header ✏️ and pause glyph pair (and their PAIR_CLIP hit-slop arithmetic) are gone with
   the header controls (2026-10-11, V2 card rule): the pause control is a body row now. */

/** Pip diameter + the gap between pips. Down from 24/5 in the 2026-07-31 strip pass — see the
 *  file header's "Two layouts, and the width math behind them" note before changing either;
 *  ten pips have to share one line with the value and the edit glyph now. */
const PIP_GAP = 4;
/** The flash glyph inside a pip — ~60% of the badge, same proportion the 24px pip used. */
/** v2's bar glyph and its legend key. The bar reads at a glance; the legend is a footnote. */
const BAR_ICON_SIZE = 17;
/** The day amount's stepper ceiling — matches EnergyConfigPanel's day stepper. */
const DAILY_MAX = 30;

/** One-shot ~1.5s glow behind a meter row — see the file header's "Depleted/recovered pulse"
 *  note. Local to this file (not GlowPulse) because it needs a timed fade in→hold→out
 *  sequence GlowPulse's on/off `active` prop doesn't do. Remounted via a changing `key` on
 *  every new trigger, so it always plays its sequence from the start. */
function EnergyPulse({ color, reducedMotion }: { color: string; reducedMotion: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1; // keep the cue, drop the motion — parent removes this after its timeout
      return;
    }
    opacity.value = withSequence(
      withTiming(1, { duration: Duration.cardOut, easing: Ease.enter }),
      withTiming(1, { duration: Duration.hold }),
      withTiming(0, { duration: Duration.holdOut, easing: Ease.exit }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }, getGlow(color, 'soft'), style]}
    />
  );
}

/** v2's `I dag` / `Uke` segment values. */
type EnergyScope = 'day' | 'week';

export default function EnergyMeter() {
  // ⚠️ **Temporary instrument (2026-09-10) — take it out once the Home flicker is settled.**
  // The maintainer's own bisection landed on this card: turning Energy off in Settings stops
  // the flicker, and it follows the card into BOTH of its states. Everything shared between
  // those states reads clean (`Surface`'s style partitioning routes `gap` correctly, both
  // sheets render null while hidden, `useEnergyPause` is memoised and documents that it cannot
  // loop on itself, `TabSlider`'s two layout handlers both dedupe), and no harness here can see
  // a device. This counts renders in the RELEASE build so the next report can say whether this
  // is a re-render storm or something under React — see lib/perfTrace.ts's release-build note.
  countRender('EnergyMeter');
  const theme = useAppTheme();
  const isDark = useIsDark();
  /**
   * Which period the card is showing — v2's `I dag` / `Uke` segment.
   *
   * Local and unpersisted, resetting to the day on every mount: the day is the unit this app
   * works in, and a card that reopens on last week's numbers is answering a question nobody
   * asked. (`components/HomeShoppingCard.tsx`'s week pager makes the same call, for the same
   * reason and in the same words.)
   */
  const [scope, setScope] = useState<EnergyScope>('day');

  /**
   * The colour of an UNSPENT unit, in the bar and in the empty card's placeholder run.
   *
   * ⚠️ **One const, deliberately, because this is exactly where the state drifted before.**
   * `lib/__tests__/stableLayout.test.ts` pins the placeholder to the bar's own unspent glyph,
   * size AND colour — the assertion it grew on 2026-09-07 after the placeholder spent a day
   * drawing a retired recipe nothing else used. Two call sites reading one identifier is what
   * makes that guard's job structural instead of vigilant.
   *   v2's value is `rgba(255,255,255,.2)` with no glow, dimmer than any text token in the app:
   * an unspent unit is a place-holder for a unit, not a thing to read. Light mode needs a touch
   * more to clear its brighter ground.
   */
  const emptyGlyph = rgba(theme.text, isDark ? 0.2 : 0.26);
  const t = useT();
  const { reducedMotion } = useAccessibility();

  const energyMode = useSettingsStore((s) => s.energyMode);
  // Subscribe to the defaults + overrides so the meter recomputes when either changes.
  useSettingsStore((s) => s.energyDailyCapacity);
  useSettingsStore((s) => s.energyWeeklyCapacity);
  const energyCustomCapacities = useSettingsStore((s) => s.energyCustomCapacities);
  const updateSettings = useSettingsStore((s) => s.update);
  // ⚠️ **Spent is the to-do colour and given-back is the habits colour (2026-10-11, V2).**
  // Maintainer: *"Use same coloring in lightning icons as in to-do and habits for giving and
  // taking Energy."* Tasks take energy and wear gold everywhere else; habits give it back and
  // wear cyan. The bolts now say which, so the text legend that explained them is gone.
  const spentHue = getScreenColor(theme, 'plans').base;
  const givenHue = getScreenColor(theme, 'habits').base;
  // Inside Hjem's ⤢ pane this card is its body and shows EVERY number (EnergyConfigPanel).
  const inPane = useIsPaneBody('homeEnergy');
  // Captured, not just subscribed: a non-empty `overrides` is the fingerprint of a user who
  // has set a period's capacity at least once, which is half the tutorial gate below.
  const overrides = useEnergyStore((s) => s.overrides);
  const energyLoaded = useEnergyStore((s) => s.loaded);
  const capacityForDay = useEnergyStore((s) => s.capacityForDay);
  const capacityForWeek = useEnergyStore((s) => s.capacityForWeek);
  const setDayCapacity = useEnergyStore((s) => s.setDayCapacity);
  const setWeekCapacity = useEnergyStore((s) => s.setWeekCapacity);
  const boostForDay = useEnergyStore((s) => s.boostForDay);
  const setDayBoost = useEnergyStore((s) => s.setDayBoost);

  const tasks = useTaskStore((s) => s.tasks);
  const tasksLoaded = useTaskStore((s) => s.loaded);
  const habits = useHabitStore((s) => s.habits);
  const habitsLoaded = useHabitStore((s) => s.loaded);
  const habitLogs = useHabitStore((s) => s.logs);

  // Today's over-budget state, the pause, and the "I'll decide" candidates — one hook so the
  // control here and the pinned card on Home can never disagree about them (lib/useEnergyPause.ts).
  const pause = useEnergyPause();

  // `configOpen` was `editing` until 2026-08-03, when the inline Collapsible editor became
  // a sheet, and on 2026-09-26 the sheet became an inline fold again (EnergyConfigPanel). Same role — "the user is mid-adjustment, don't interrupt".
  const [configOpen, setConfigOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  // energyMode picks which meter(s) apply — 'daily'/'weekly' show only their own
  // meter, 'custom' (per-weekday capacities, set in Settings) shows both since the
  // week total is derived from the seven day amounts.
  const showDay = energyMode !== 'weekly';
  const showWeek = energyMode !== 'daily';
  /* `singleMeter` lived here until 2026-08-03. It picked the one-line, label-less strip for
     'daily'/'weekly' and the stacked shape for 'custom'. There is one layout now — the stacked
     one, in every mode — so nothing needs to ask the question any more. See the header. */

  const today = todayStr();
  const dayCapacity = capacityForDay(today);
  const weekCapacity = capacityForWeek(today);
  /**
   * The two numbers behind `dayCapacity`, kept apart so the ✏️ editor's two steppers can't
   * fight each other.
   *
   * `capacityForDay()` already returns base + boost (store/useEnergyStore.ts), and the meter
   * shows that TOTAL — a boosted day genuinely has more energy in it, so the pips and the
   * `13 / 13` readout should say so. But `setDayCapacity()` writes the BASE row, so feeding
   * the total straight back into the capacity stepper would re-bank the boost as the user's
   * usual capacity on every press (+3 today → stepper reads 13 → tapping it writes base 13 →
   * total 16, and tomorrow starts from 13). Subtracting the boost for display and letting the
   * stepper write what it shows keeps each control on its own row: the capacity stepper edits
   * the base, the boost stepper edits the boost, and the readout above them is their sum.
   */
  const dayBoost = boostForDay(today);
  const dayBaseCapacity = dayCapacity - dayBoost;
  const dayCurrent = dayCapacity + energyDeltaForDay(today, tasks, habits, habitLogs);
  const weekCurrent = weekCapacity + energyDeltaForWeek(today, tasks, habits, habitLogs);
  // The same two numbers, split into the halves the v2 bar draws. `energySplitFor*` re-derives
  // `energyDeltaFor*` exactly (pinned in __tests__/energy.test.ts), so the bar and the value
  // beside it cannot tell different stories.
  const daySplit = energySplitForDay(today, tasks, habits, habitLogs);
  const weekSplit = energySplitForWeek(today, tasks, habits, habitLogs);

  /**
   * The bar the header's peek is describing — v2's peek reads off the SHOWN period
   * ("4 av 8 brukt i dag · +1 gitt tilbake"), so it has to follow the segment. Same
   * `energyBudgetBar` the row itself calls: one derivation, two readers, never two sums.
   */
  /**
   * ⚠️ **The peek states the TRUE numbers, never the bar's.** `energyBudgetBar` scales its runs
   * down to `MAX_PIPS` so a large capacity still fits one line — so on an 18-energy day with
   * nothing spent the bar's own `pipCount` is 10, and a peek reading off it said "0 of 10
   * spent" beside a bar the user had set to 18. The bar is a SHAPE and is allowed to round; the
   * sentence under the title is a claim and is not.
   *
   * That is why these two are the raw split and the raw capacity, and why the peek below
   * (`t.energyMeter.budgetPeek`) is their only reader. An `activeBar = energyBudgetBar(...)`
   * sat here until 2026-09-12 — the very call the warning is about — left behind unread when
   * the peek was corrected. Nothing may reintroduce it: a rounded number is not a claim.
   */
  const activeSplit = scope === 'day' ? daySplit : weekSplit;
  const activeCapacity = scope === 'day' ? dayCapacity : weekCapacity;

  /**
   * The tutorial gate — see the file header's "Tutorial state" note for why this exists.
   *
   * Two ways to be past it, either of which means the number on the strip is about to mean
   * something: the user has given a task or habit an energy value, or they have set a period's
   * capacity themselves (any `energy_budgets` row — day override, week override or a boost).
   * `energyEnabled` alone isn't enough: `energyValue` defaults to 1 behind a false flag in both
   * stores (lib/energy.ts's `energyStepperValue`), so a row is only really in the system when
   * the flag is on AND the value is non-zero.
   *
   * `ready` is the load-order guard: an unloaded store looks exactly like an empty one, and
   * getting this backwards would flash two sentences of teaching copy at somebody who has used
   * Energy for months. Until every store answers, the meter draws.
   */
  const ready = tasksLoaded && habitsLoaded && energyLoaded;
  const hasEnergyItems =
    tasks.some((task) => task.energyEnabled && task.energyValue !== 0) ||
    habits.some((habit) => habit.energyEnabled && habit.energyValue !== 0);
  const hasSetCapacity = Object.keys(overrides).length > 0;
  const showTutorial = ready && !hasEnergyItems && !hasSetCapacity;

  // "Over-committed" (plannedEnergyDeltaForDay) and "fully spent" (current <= 0) used to be
  // computed here for two warning rows. Both now live behind lib/energyPause.ts's single
  // `isOverBudget`, read through `pause.overBudget` above — one state, one control, one sheet.

  // Depleted/recovered pulse tracking — fires once ON THE TRANSITION across the zero line,
  // never on mount or while already sitting in that state. See file header.
  const [dayPulse, setDayPulse] = useState<{ id: number; kind: PulseKind } | null>(null);
  const [weekPulse, setWeekPulse] = useState<{ id: number; kind: PulseKind } | null>(null);
  const prevDayPositive = useRef<boolean | null>(null);
  const prevWeekPositive = useRef<boolean | null>(null);
  const pulseId = useRef(0);

  useEffect(() => {
    if (!showDay) { prevDayPositive.current = null; return; }
    const positive = dayCurrent > 0;
    if (prevDayPositive.current !== null && prevDayPositive.current !== positive) {
      pulseId.current += 1;
      setDayPulse({ id: pulseId.current, kind: positive ? 'recovered' : 'depleted' });
    }
    prevDayPositive.current = positive;
  }, [dayCurrent, showDay]);

  useEffect(() => {
    if (!showWeek) { prevWeekPositive.current = null; return; }
    const positive = weekCurrent > 0;
    if (prevWeekPositive.current !== null && prevWeekPositive.current !== positive) {
      pulseId.current += 1;
      setWeekPulse({ id: pulseId.current, kind: positive ? 'recovered' : 'depleted' });
    }
    prevWeekPositive.current = positive;
  }, [weekCurrent, showWeek]);

  // Matches EnergyPulse's own fade in (200) + hold (900) + fade out (400) = 1500ms.
  useEffect(() => {
    if (!dayPulse) return;
    const id = setTimeout(() => setDayPulse(null), 1500);
    return () => clearTimeout(id);
  }, [dayPulse]);
  useEffect(() => {
    if (!weekPulse) return;
    const id = setTimeout(() => setWeekPulse(null), 1500);
    return () => clearTimeout(id);
  }, [weekPulse]);

  // The strip only lives on Home, so "is Home focused" is just "is this mounted and focused".
  // Kept as state rather than a ref because the auto-show effect below has to re-run when it
  // flips — a ref would go stale and the sheet would either never open or open behind a tab.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  /**
   * The once-a-day automatic offer.
   *
   * Four gates, all of them about the moment being calm enough: the Home screen is focused
   * (the pager mounts all five tabs, so being mounted proves nothing), the config sheet is not
   * open (never interrupt a user who is mid-adjustment), the strip is not in its tutorial state
   * (a first-time explanation is the last thing to cover with a sheet — belt and braces, since
   * a day with no energy items can't be over budget either), and today has not already offered
   * it (`shouldAutoShow`, which lib/useEnergyPause.ts keeps true until the user actually
   * answers — a backgrounded app re-offers rather than burning the day's one chance in
   * silence). Both answers stamp the day in the store, so nothing re-opens after one.
   */
  useEffect(() => {
    if (!focused || configOpen || sheetOpen || showTutorial) return;
    if (!pause.shouldAutoShow) return;
    setSheetOpen(true);
  }, [focused, configOpen, sheetOpen, showTutorial, pause.shouldAutoShow]);

  // label is null when only one of day/week is shown (the common case, energyMode
  // 'daily'/'weekly') — with a single meter on the card, "Today"/"This week" repeats
  // what's already obvious and just eats space. It's only passed when BOTH rows are
  // on screen at once (energyMode 'custom'), where it's the one thing telling them apart.
  // rowKey is a stable 'day'/'week' discriminator for the pip gradient ids — kept separate
  // from `label` (which can be null) so id uniqueness never depends on translated text.
  // Passed to exactly ONE row (see the file header's "The edit affordance travels" note) — the
  // single meter's line, or the first visible meter's top line in 'custom' mode.
  // The calm overspend control (2026-08-02) — what replaced the amber "⚠️ … more Energy than
  // you have available" line and the muted "fully spent" one. ONE indicator for both states
  // (lib/energyPause.ts's isOverBudget), in theme.accent, never theme.warn and never a
  // triangle: being over today's energy is a situation with options, not an error. It is a
  // control, so it is labelled and reaches target; it never animates, pulses or badges — an
  // over-full day is exactly the wrong moment for something on screen to start moving.
  const showOverspend = pause.overBudget && !pause.paused;



  // The inline editor, mounted in whichever card is showing (tutorial or live). `configOpen`
  // survives the tutorial → live flip, so the fold stays open under the user's thumb when the
  // first capacity write swaps the card.
  const configPanel = (
    <EnergyConfigPanel
      showDay={showDay}
      showWeek={showWeek}
      /* BASE, not the total the meter shows — see `dayBaseCapacity` above for why handing
         over the sum would re-bank today's boost as the user's usual capacity. */
      dayBaseCapacity={dayBaseCapacity}
      // Same rule as the card's row: the day's amount IS the everyday amount.
      onDayCapacity={onDailyAmount}
      weekCapacity={weekCapacity}
      onWeekCapacity={(n) => setWeekCapacity(today, n)}
      dayBoost={dayBoost}
      onDayBoost={(n) => setDayBoost(today, n)}
    />
  );


  /**
   * The day's amount is the EVERYDAY amount (2026-10-11, maintainer: *"Naturligvis er det fast
   * hver dag. Ikke per dag."*). There was a "Fast hver dag" switch here whose OFF position made a
   * step change today only — a choice nobody needed, explained by a line nobody should have to
   * read. A step now writes today's row and the default together. A one-day change is what
   * "Extra for today" in the ⤢ pane is for. In 'custom' mode the default is that weekday's own
   * amount, which is what gets written; the mode is never changed from here.
   */
  const saveAsDefault = (n: number) => {
    if (energyMode === 'custom') {
      const next = [...energyCustomCapacities];
      next[dayOfWeekMon0(new Date(today + 'T12:00:00'))] = n;
      updateSettings({ energyCustomCapacities: next });
    } else {
      updateSettings({ energyDailyCapacity: n });
    }
  };
  function onDailyAmount(n: number) {
    setDayCapacity(today, n);
    saveAsDefault(n);
  }

  const row = (
    rowKey: 'day' | 'week',
    label: string,
    current: number,
    capacity: number,
    split: { spent: number; gained: number },
    pulse: { id: number; kind: PulseKind } | null,
    trailing: React.ReactNode,
    /**
     * A static note about this period, drawn beside the label — today's `+N today only` chip
     * and nothing else so far. Never a control: it sits between the label and two real tap
     * targets, and a third target on that line would put PAIR_CLIP's arithmetic back in play.
     */
    badge: React.ReactNode,
    /** Draw the row's own label/chip/controls line. False inside the v2 card, whose SectionRail
     *  is that line — see the note at `meterTopRow` below. */
    chrome = true
  ) => {
    // ── The v2 Energibudsjett bar (2026-09-06) ──────────────────────────────────────────
    //
    // ⚠️ **Filled means SPENT here, which is the inverse of what this row drew until today.**
    // The glossy `energyPipCount` token filled from `current / capacity`, so a full bar meant a
    // day still untouched. v2 states its reading outright — *"filled = brukt, empty = igjen"* —
    // and the arithmetic for it lives in `lib/energy.ts`'s `energyBudgetBar`, once, rather than
    // being re-derived by eye here. Do not "fix" one to match the other without reading that
    // function's note: the two readings are both defensible and this one is the maintainer's.
    //
    // The glyphs are plain `flash` / `flash-outline`, not the radial-gradient-and-gloss token
    // that used to draw here. That token was a deliberate object once ("glossy token, not a flat
    // circle"), but v2 draws a flat row and the gloss is what made ten of them read as a score —
    // the failure the 2026-08-03 label pass was already working around with words.
    //
    // `gitt tilbake` is a THIRD run after a divider, in the habits hue rather than the accent,
    // because energy handed back by a habit is not the same substance as budget you were given.
    // Capped in `energyBudgetBar` so it stays a shape and not a tally.
    const { pipCount, used, left, gain, overspent } = energyBudgetBar(split.spent, split.gained, capacity);
    // ⚠️ **The three runs have to be TELLABLE APART, which is the whole point of the bar
    // (2026-09-08).** They were `theme.accent` / `theme.textMuted` / `theme.good` flat, and on a
    // dark ground `textMuted` is bright enough that a bar with nothing spent yet read as one
    // undifferentiated grey row — reported twice from a device, the second time as "Energy, once
    // again, what?". v2's own CSS is explicit about both halves of the difference and this now
    // matches it: filled is the hue `with filter: drop-shadow(0 0 7px …)`, and empty is
    // `rgba(255,255,255,.2)` with `filter: none` — dimmer than any text token in the app, because
    // an unspent unit is a place-holder for a unit, not a thing to read.
    //   The glow is a `textShadow`, not a shadow view: an Ionicon IS a `Text` glyph, so the halo
    // follows the bolt's own outline rather than a box around it. That is what `drop-shadow`
    // does in the mockup and a `shadowRadius` on a wrapping View would not.
    const glyph = (name: 'flash' | 'flash-outline', color: string, key: string, lit = false) => (
      <Ionicons
        key={key}
        name={name}
        size={BAR_ICON_SIZE}
        color={color}
        style={lit ? { textShadowColor: rgba(color, 0.55), textShadowRadius: 7, textShadowOffset: { width: 0, height: 0 } } : undefined}
      />
    );
    const pips = (
      <View
        style={styles.pipRow}
        accessibilityLabel={t.energyMeter.budgetPeek(used, pipCount, gain)}
      >
        {Array.from({ length: used }).map((_, i) => glyph('flash', spentHue, `u${i}`, true))}
        {Array.from({ length: left }).map((_, i) => glyph('flash-outline', emptyGlyph, `l${i}`))}
        {Array.from({ length: gain }).map((_, i) => glyph('flash', givenHue, `g${i}`, true))}
      </View>
    );
    // The legend is the only thing that says which way the glyphs read, so all three words stay
    // even when a run is empty — two of them alone would leave the bar ambiguous.
    // A bar clamped at full would otherwise read as a day exactly used up. It says so in words
    // instead — stating, never scolding (DESIGN_RULES.md rule 23).
    const overspendNote = overspent > 0 ? (
      <Text style={[styles.overspendNote, { color: theme.textMuted }]} numberOfLines={2}>
        {t.energyMeter.budgetOver(overspent)}
      </Text>
    ) : null;
    // The title row is gone (strip pass), so this value is the only thing naming the number for
    // a screen reader — `t.energyMeter.title` lives on here rather than as visible text.
    const value = (
      <Text
        style={[styles.meterValue, { color: theme.textMuted }]}
        accessibilityLabel={`${t.energyMeter.title}${label ? ` — ${label}` : ''}: ${current} / ${capacity}`}
      >
        {`${current} / ${capacity}`}
      </Text>
    );
    return (
      <View style={styles.meterRowWrap}>
        {pulse && (
          <EnergyPulse
            key={pulse.id}
            color={pulse.kind === 'recovered' ? theme.good : theme.accent}
            reducedMotion={reducedMotion}
          />
        )}
        {/* ONE layout for every energyMode (2026-08-03). There used to be two — a single
            inline line for 'daily'/'weekly' and this stacked shape for 'custom' — and the
            inline one was where all the trouble lived: it had no room for a label (so the
            meter never named itself), and the header's own width math called it "deliberately
            tight", degrading by clipping the pip row once the overspend control or surplus
            pips showed up. Stacking unconditionally buys back a whole line, which is what
            makes room for both the label and an always-visible capacity stepper. */}
        <View style={styles.meterRow}>
          {/* ⚠️ **Suppressed inside the v2 card (2026-09-08).** `components/SectionRail` at the
              card rung now carries the name, the summary line and the ✏️ — see the card below —
              so drawing this line too would put two headers on one card. It stays for the
              `chrome` callers (there are none today; the branch is kept because 'custom' mode
              once drew two meters and may again). */}
          {chrome && <View style={styles.meterTopRow}>
            {/* Label + chip are ONE yielding group: the label side is what gives when a long
                translation meets a chip at the 1.2x font scale, never the glyphs, which have
                no width to give (the wrap audit's documented rule — AGENTS.md). */}
            <View style={styles.labelWrap}>
              <Text style={[styles.meterLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
              {/* The temporary-extra chip, when there is one. It rides beside the label rather
                  than beside the value because it qualifies WHAT the row is (a day with
                  something borrowed against it), not what the number currently reads. */}
              {badge}
            </View>
            {/* Every number is set in the pop-up the ✏️ opens — see the header's correction 1.
                A capacity stepper lived here for one day and was reversed; don't put one back. */}
            <View style={styles.topRowTrailing}>{trailing}</View>
          </View>}
          {/* The value rides the end of the pip line now that the top line carries the label
              and the stepper. It reads against the pips it describes, and the line has room
              for it because nothing else is competing for that row. */}
          {/* ⚠️ **`value` (`current / capacity`) is drawn only by the `chrome` shape (2026-09-08).**
              Inside the v2 card the header's peek already states the day — "0 of 18 spent" — and
              the two are different readings of it (spent-so-far vs left-of-capacity). Side by
              side they read as a contradiction: the first render of this card showed "0 of 10
              spent" next to "18 / 18". One card, one sentence of numbers. */}
          <View style={styles.pipLine} onLayout={() => countLayout('L:pipLine')}>
            {pips}
            {chrome && value}
          </View>
          {overspendNote}
        </View>
      </View>
    );
  };

  return (
    /* ⚠️ **Temporary layout probes (2026-09-11) — remove with the `countRender` pair.**
       The device separated the two events decisively: Home and this card each rendered 5 times
       in 45 seconds (0.1/s, a static tree) while the card visibly would not settle. So whatever
       moves is BELOW React, and only `onLayout` can see it — it fires on the native pass with no
       re-render required. One probe per suspect region, so the next reading names the view that
       is re-laying-out rather than the screen it is on. */
    <View style={styles.strip} onLayout={() => countLayout('L:strip')}>
      {/* Paused (2026-08-02, "I'm good"): the strip stays mounted but draws NOTHING for the
          rest of the day — no meter, no editor, no hint, no control. This is presentation
          only, exactly like a card layout: every energy cost keeps being recorded, every
          value keeps its stored number, and tomorrow's date brings the whole strip back
          untouched. The sheet stays mounted through it so its exit animation can finish. */}
      {/* Nothing has an energy value and no capacity has ever been set: teach, don't measure.
          A full ten-pip bar with nothing able to spend it is the "reads as a score" problem at
          its worst — see the header's "Tutorial state". The card stands exactly where the meter
          will stand, and the button is the same pop-up the ✏️ opens, so the first thing a new
          user can do here is the deliberate thing rather than a nudge. */}
      {/* ── The Energy CARD (V2, 2026-10-11) ──────────────────────────────────────────────
          A registry card now (`homeEnergy`), so it has the same header as every other card —
          ⌄ then ⤢ — and its ⤢ opens a pane holding every number (EnergyConfigPanel). The two
          hand-built `Surface` + `SectionRail` branches (tutorial / live) are one card: the
          tutorial is only a different PEEK and an all-empty bar. The text legend is gone — the
          bolts carry their own colours (gold = spent by a task, cyan = given back by a habit,
          outline = left) — and the "Adjust budget" fold became one slim row: the day's amount
          and a "Fast hver dag" switch that saves it as the everyday default. */}
      {!pause.paused && (
        <Card
          id="homeEnergy"
          peek={showTutorial ? t.energyMeter.tutorialPeek(activeCapacity) : t.energyMeter.budgetPeek(activeSplit.spent, activeCapacity, activeSplit.gained)}
          // Empty-only, like every card hint: what Energy IS, said while the bolts are all outline.
          hint={showTutorial ? t.cardHint.homeEnergy : undefined}
        >
          {!showTutorial && showDay && showWeek && (
            <SegmentedControl<EnergyScope>
              compact
              options={[
                { label: t.energyMeter.scopeDay, value: 'day' },
                { label: t.energyMeter.scopeWeek, value: 'week' },
              ]}
              value={scope}
              onChange={setScope}
              style={styles.scopeSegment}
            />
          )}
          {showTutorial ? (
            <View
              style={styles.tutorialPips}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {Array.from({ length: MAX_PIPS }, (_, i) => (
                <Ionicons key={i} name="flash-outline" size={BAR_ICON_SIZE} color={emptyGlyph} />
              ))}
            </View>
          ) : scope === 'day' ? (
            row('day', t.energyMeter.today, dayCurrent, dayCapacity, daySplit, dayPulse, null,
              dayBoost > 0 ? <Badge label={t.energyMeter.boostChip(dayBoost)} /> : null, false)
          ) : (
            row('week', t.energyMeter.thisWeek, weekCurrent, weekCapacity, weekSplit, weekPulse, null, null, false)
          )}
          {/* Over today's energy: the pause sheet's way in, as a row in the body now that the
              header carries only ⌄ and ⤢. */}
          {showOverspend && (
            <PressableScale
              onPress={() => setSheetOpen(true)}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={t.energyPause.overspendLabel}
              style={styles.overspendRow}
            >
              <Ionicons name="pause-circle-outline" size={EDIT_ICON_SIZE} color={theme.accent} />
              <Text style={[styles.overspendRowText, { color: theme.accent }]} numberOfLines={1}>
                {t.energyPause.overspendLabel}
              </Text>
            </PressableScale>
          )}
          {/* The one control row. Day scope: the amount + "Fast hver dag". Week scope (or a
              weekly-only setup) keeps the adjust row and its fold, which owns the week number. */}
          {inPane ? null : showDay && scope === 'day' ? (
            <View style={styles.dailyRow}>
              <Text style={[styles.dailyLabel, { color: theme.text }]} numberOfLines={1}>
                {t.energyMeter.fixedDaily}
              </Text>
              <Stepper
                value={dayBaseCapacity}
                onChange={onDailyAmount}
                min={0}
                max={DAILY_MAX}
                accessibilityLabel={t.energyMeter.todayCapacity}
              />
            </View>
          ) : (
            <View style={styles.qaLine}>
              <QuickAddOptionRow
                wide
                showsMore
                icon="flash-outline"
                label={t.energyMeter.budgetAdjust}
                value={t.energyMeter.budgetUnits(weekCapacity)}
                isSet
                accent={theme.accent}
                onPress={() => setConfigOpen((v) => !v)}
              />
            </View>
          )}
          {inPane ? configPanel : (
            <Collapsible open={configOpen && !(showDay && scope === 'day')}>
              {configPanel}
            </Collapsible>
          )}
        </Card>
      )}

      {/* The one line the pause leaves behind. It is the acknowledgement itself — the narrator
          answering "I'm good" once, in place, in the space the meter just vacated — not a
          retrospective on it: it is static, never counted, never referred to again, and gone
          at midnight without anyone dismissing it. A strip that silently emptied read as a
          bug, which is the other half of why it is here.
          Deliberately not an explainer line (that whole tier — a bulb icon plus a hairline rule
          — was deleted app-wide on 2026-08-17 and would have rebuilt a card here anyway), not
          tappable, and with no way back: the
          day is the unit, and it resets on its own. No icon, no accent, no entrance. */}
      {pause.paused && (
        <Text style={[styles.pausedNote, { color: theme.textMuted }]}>{t.energyPause.afterGood}</Text>
      )}


      {/* Both triggers — the control above and the once-a-day auto-offer — land here. Closing
          the sheet by any route IS "I'm good" (see EnergyPauseSheet's header), and both
          answers stamp the day in the store, so nothing re-opens after one. */}
      <EnergyPauseSheet
        visible={sheetOpen}
        candidates={pause.candidates}
        onPin={(id) => {
          setSheetOpen(false);
          pause.pin(id);
        }}
        onImGood={() => {
          setSheetOpen(false);
          pause.pause();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // NO padding, NO background, NO shadow — this is the strip, not a card (2026-07-31, addendum
  // task B.2). Dropping the card's 16px horizontal padding is half of what buys the room to put
  // pips, value and edit glyph on one line; see the file header's width math. Because of that,
  // the pips sit ~16px left of the neighbouring cards' CONTENT and flush with their outer edge —
  // deliberate: it's what makes this read as chrome for the day rather than a fifth card.
  strip: { gap: Spacing.xs },
  // v2's `gc slim`: the card's own padding and inner rhythm. `Surface` brings the fill, edge and
  // shadow; this is only the box it wraps around the rail, the segment, the bar and the row.
  budgetCard: { padding: Spacing.md, gap: Spacing.sm },
  // The V2 card's one control row: label, the day's amount, and "Fast hver dag".
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: MIN_TAP_TARGET },
  dailyLabel: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  overspendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: MIN_TAP_TARGET },
  overspendRowText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, flexShrink: 1 },
  // The ROW container a `QuickAddOptionRow` assumes it is in — see both call sites' notes. Its
  // `wide` basis is a width percentage, and this card is otherwise a column, where the same
  // number would be read against the card's own height.
  qaLine: { flexDirection: 'row' },
  // The segment sits under the header at the body's own rhythm — v2 puts it first in the body,
  // above the bar, so the thing it switches is directly beneath it.
  scopeSegment: { marginTop: Spacing.xs },
  // The top line's right-hand cluster: the ✏️, plus the overspend control to its left when it
  // is showing. (It held a capacity stepper too for one day — reversed, see the header's
  // correction 1.) `marginLeft:'auto'` is what right-aligns it without meterTopRow needing a
  // justifyContent, and it keeps the cluster right-aligned even if `labelWrap` is ever given
  // an intrinsic width instead of `flex: 1`.
  topRowTrailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: 'auto' },
  // Label + the temporary chip, as one group that yields. `flex: 1` WITH `minWidth: 0` — the
  // pair, not `flex: 1` alone, is what actually lets a child shrink under Yoga (the same fix
  // components/TaskCard.tsx documents for its title input).
  labelWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // The pip line: pips take the slack, the `current / capacity` value sits at the right edge
  // (its own marginLeft:'auto' does that). This is the row that used to also carry the label's
  // job, the stepper's job and the glyphs' — see the header's layout note.
  pipLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Wraps each meter row so EnergyPulse (an absoluteFill sibling) has a position:relative
  // parent to glow behind — see the "Depleted/recovered pulse" file-header note.
  meterRowWrap: { position: 'relative', borderRadius: Radius.sm },
  // EVERY mode now (2026-08-03), not just 'custom'. Stacked (2026-07-28 fix, generalised):
  // label + stepper share a top line, the pip row gets the full width on its own line below.
  // Putting a LABEL on the same line as ten pips and a value ran out of horizontal room on
  // real phones — that is still true at the bar's glyph size, and it is exactly why the single-meter
  // case went inline (and label-less) in the 2026-07-31 strip pass. Stacking unconditionally
  // is the other way out of that squeeze: it costs one line and buys the label plus a
  // settable stepper. Don't collapse this branch back to one line.
  meterRow: { gap: 6 },
  barSep: { width: 1, height: 14, marginHorizontal: 3, alignSelf: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  legendText: { fontSize: FontSize.xs, fontFamily: Fonts.medium, flexShrink: 1 },
  overspendNote: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  // No justifyContent here — topRowTrailing's own marginLeft:'auto' pushes the stepper and
  // glyphs to the right edge, so this layout needs no conditional branch.
  meterTopRow: { flexDirection: 'row', alignItems: 'center' },
  // flexShrink so a long translation beside a chip truncates rather than shoving the ✏️ off
  // the line — `numberOfLines={1}` on the Text is the other half of that.
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, flexShrink: 1 },
  // Takes the leftover width AFTER the value has its intrinsic size, and clips rather than
  // overflowing. See the file header — an overflowing pip row painting over the value text is
  // the 2026-07-28 bug this guards against. Folded in unconditionally on 2026-08-03: the pips
  // now share a line with the value in every mode, so there is no longer a variant where they
  // don't need it (this was `pipRowInline`, applied only to the single-meter case).
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: PIP_GAP, flex: 1, minWidth: 0, overflow: 'hidden' },
  // ⚠️ **`pipBadge`, `pipEmpty` and `pipSurplus` are DELETED (2026-09-07), with the
  // `react-native-svg` import that fed them.** They drew the glossy energy TOKEN — a radial
  // -gradient fill with a rim and a gloss ellipse, plus a hollow spent ring and an accent
  // surplus ring. `row()` stopped rendering any of it on 2026-09-06 when the Energibudsjett bar
  // replaced the token row, but the styles, the `Svg`/`Defs`/`RadialGradient`/`Stop`/`Circle`/
  // `Rect` import and ~60 lines of this file's header describing the token all stayed — and the
  // tutorial state went on drawing `pipEmpty`, which is how ten retired grey rings ended up
  // being the only Energy most users ever saw. `PIP_SIZE`/`PIP_ICON_SIZE` went with them; the
  // bar sizes from `BAR_ICON_SIZE`. `PIP_GAP` stays — it is the bar's gap now.
  // flexShrink:0 so the value keeps its full width on the strip line and the pip row is what
  // gives, never the number.
  meterValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium, marginLeft: 'auto', flexShrink: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  // The pause control + the ✏️ glyph. The gap is RowTrailing's, not Spacing's, because it is
  // load-bearing: it is what leaves 8px belonging to neither touch area once PAIR_CLIP has
  // taken 4px off each facing edge. See the PAIR_CLIP block at the top of the file.
  trailingCluster: { flexDirection: 'row', alignItems: 'center', gap: RowTrailing.gap },
  /* `editor` / `editRow` / `editLabel` lived here until 2026-08-03 — they styled the inline
     Collapsible editor, which became a sheet and, on 2026-09-26, components/EnergyConfigPanel.tsx
     folded inline again. */
  // The tutorial card's one button. `alignSelf` keeps it button-sized instead of stretching to
  // the card's full width: StarterCard's action slot is documented as "lightweight chips — this
  // is an explainer, not a form", and a full-width CTA on the topmost card of Home reads as
  // setup the user owes the app, which is the one thing this state must not do.
  // The empty-state pip row. Same PIP_GAP as a live meter's `pipRow`, and it WRAPS — the
  // tutorial card is narrower than the strip, and ten pips that overflow would be worse than
  // ten that take two lines.
  // The bar's own gap and wrapping, so this row and `pipRow` read as the same object.
  tutorialPips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: PIP_GAP },
  tutorialAction: { alignSelf: 'flex-start' },
  // The paused day's single line. The app's caption tier (FontSize.xs,
  // italic, theme.textMuted) so it reads as the quietest thing on Home, but hand-rolled
  // rather than reusing that component — its bulb icon and hairline rule would give the
  // pause a bordered header, i.e. exactly the status banner this must not be. No margin of
  // its own: `strip`'s existing gap is the only spacing, so the strip's outer geometry is
  // identical paused and unpaused.
  pausedNote: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
});
