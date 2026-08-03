/**
 * EnergyMeter.tsx — Home's Energy STRIP (not a card) for the optional Energy system (2026-07-20).
 *
 * Shows today's and this week's energy as `current / capacity`, where current =
 * capacity + the net signed value of every energy task completed / energy habit
 * met in the period (lib/energy.ts). Tapping the edit affordance reveals steppers
 * to override today's and this week's capacity, plus today's one-day boost
 * (store/useEnergyStore.ts).
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
 * glossy token and the hollow spent ring. They are capped at MAX_SURPLUS_PIPS (4) in
 * lib/energy.ts; do NOT raise that, and read the width math below before assuming they fit.
 *
 * **Strip, not a card (2026-07-31, addendum task B.2)**: this stopped being a `Surface`. It has
 * no card background, no shadow, no card padding and no title row. Energy is chrome for the
 * day, not a fifth list to scroll past, and as a card it competed with the four content cards
 * below it. Don't re-wrap this in `Surface`/`GlassFill`, and don't reinstate the flash-icon +
 * `t.energyMeter.title` header ROW — the label described below does that job in a line the
 * layout already has.
 *
 * **Two lines, one layout, always labelled and always settable (2026-08-03).** The strip was
 * ONE line in the common single-meter case — pips, `current / capacity`, edit glyph, no label —
 * and the stacked label+value shape only in `energyMode: 'custom'`. A first-time-user
 * walkthrough killed that arrangement on two counts:
 *   1. **It never said what it was.** Ten saturated pips and "10 / 10" at the very top of Home,
 *      above all content, read as a score or a level — precisely what this system must not read
 *      as. The only thing naming it was the 12px italic hint underneath. Rule 11 (never colour
 *      or shape alone) in spirit if not letter.
 *   2. **Setting your own number was behind a pencil.** The maintainer's call was that Energy
 *      should be "on and shown by default, in a state the user can use to set energy per
 *      day/week — easy, and not forceful."
 * So: ONE layout for every mode. Line 1 is `label · [capacity stepper] · [overspend?] · ✏️`,
 * line 2 is `pips · current / capacity`, and the permanent hint sits under both. The label
 * carries the word "Energy" (see `t.energyMeter.today`/`thisWeek`).
 * This also RESOLVES the width squeeze the old inline layout documented at length below rather
 * than working around it: ten pips no longer share a row with a label, a value, a stepper and
 * two glyphs, so the "deliberately tight ≈318px of 328px" arithmetic no longer applies to any
 * mode. The pip row keeps its `flex:1 / minWidth:0 / overflow:'hidden'` clip guard anyway —
 * surplus pips can still overrun a narrow phone, and clipping is that row's documented job.
 * The ✏️ editor is now the today-only boost and nothing else: the two capacity steppers moved
 * onto their rows' top lines. Keep the boost hidden — an always-visible "give myself more for
 * today" stepper is an invitation, and this system describes a day rather than rewarding one.
 *
 * **Rendered only when `settings.energySystemEnabled` (2026-07-31)** — Energy is a real toggle
 * again (it was unconditional 2026-07-26 → 2026-07-31), so app/(tabs)/index.tsx gates this
 * mount. The strip is FIXED on Home: it sits outside `HOME_CARD_KINDS`/`HomeCardManager`, so it
 * can be neither dragged nor removed with the ×; turning the feature off in Settings → Advanced
 * → Features is the only way to make it go away.
 * settings.energyMode (2026-07-24) picks which meter(s) show: 'daily' hides the week
 * row, 'weekly' hides the day row, 'custom' (per-weekday capacities set in
 * app/settings.tsx) shows both since the week total derives from the seven days. 'custom' is
 * the one case that ISN'T a single line — two meters need their labels to stay tellable apart,
 * so each keeps the stacked label+value / pips shape below.
 *
 * **Permanent inline hint (2026-07-27, kept through the 2026-07-31 strip pass)**: one small
 * italic line (`t.energyMeter.hint`) under a hairline rule, attached directly below the meter,
 * always — via the shared `components/CardHintNote.tsx` at its own `FontSize.xs`, i.e. at or
 * under caption size. Losing the card surface did NOT orphan it: it hangs off the strip's
 * bottom edge instead of the card's, and it is the only thing left naming what the pips are, so
 * it matters more here than it did inside a titled card. It replaced a `components/StarterCard` sibling that
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
 * **Two layouts, and the width math behind them.** Ten pips + the value + the edit glyph only
 * fit on one line because the strip pass took back the card's 32px of horizontal padding AND
 * shrank the pip from 24px to `PIP_SIZE` (18): at the audited 360px worst case that's 328px of
 * content for 216px of pips (10x18 + 9x4 gap) + ~70px of value at the `large` font scale + 16px
 * of glyph + two 8px gaps ≈ 318px. It is deliberately tight, so `pipRowInline` also carries
 * `flex:1 / minWidth:0 / overflow:'hidden'` — if a future font scale or narrower phone does run
 * out of room the pip row clips instead of painting over the value, which is exactly the
 * 2026-07-28 bug that forced the stacked layout in the first place. Re-check `npm run wraps`
 * before growing `PIP_SIZE` or putting a label back on this line.
 * **Two 2026-08-02 additions spend that margin, and both degrade by clipping the pip row —
 * which is the row's documented job, not a new bug.** (1) The overspend control adds a second
 * 16px glyph plus a `RowTrailing.gap` (16) beside the ✏️: +32px, and only while today is over
 * budget. (2) Up to four surplus pips add up to 4 x (PIP_SIZE + PIP_GAP) = 88px, and only on a
 * day that has finished above its capacity. At the audited 360px worst case a full ten-pip bar
 * plus four surplus pips does NOT fit and the tail clips — the `current / capacity` readout
 * beside it still states the number in full, and the a11y label on the pip row carries
 * `t.energyMeter.surplusLabel(n)` regardless of what is drawn. The alternative (shrinking the
 * pip, or dropping the value) costs the common case to serve the rare one.
 * The 'custom' (both meters) case keeps that stacked layout: label+value share a top line
 * (`meterTopRow`), the pip row is a full-width line below it. Two labels' worth of extra text
 * genuinely does not fit inline at any pip size worth drawing.
 *
 * **Label dropped for the single-meter case (2026-07-28)**: `row()`'s `label` param is
 * nullable — passed only when BOTH day and week meters are on screen at once (`energyMode`
 * 'custom') where it's the one thing telling the rows apart; in the far more common
 * single-meter case ('daily'/'weekly') it's dropped entirely rather than repeating what the
 * lone row already makes obvious. `meterValue`'s `marginLeft:'auto'` (not `meterTopRow`'s
 * `justifyContent`) does the right-alignment so this works with or without a label present,
 * without a conditional style branch.
 *
 * **The edit affordance travels** (`row()`'s `trailing` param): it rides the end of the single
 * line in the common case, and the end of the FIRST visible meter's top line in 'custom' mode.
 * It is passed to exactly one row — never render two.
 *
 * **Energy-token pip (2026-07-28, round 3 — after two shadow/bevel "keycap" passes still read
 * as flat or too grey, user then pointed at trading-card game energy-type icons as the actual
 * reference)**: an available pip is a small saturated token/badge, NOT a UI control — solid
 * radial-shaded fill (`react-native-svg` `RadialGradient`, `lighten(accent)` center easing to
 * `darken(accent)` at the rim), a heavy dark rim (`darken(accent, 0.5)` stroke), and one bright
 * gloss ellipse near the top-left (a second `RadialGradient`, high center opacity — this is the
 * detail that sells "glossy token," keep it bold, don't dim it back toward a subtle highlight).
 * A spent pip is a plain hollow ring (`theme.surfaceInset` fill, `theme.border` outline, muted
 * outline icon) — an emptied slot, no gloss, no gradient.
 * **This is a deliberate departure from the app's button system** (`constants/theme.ts`'s
 * matte face-lift + `computeRimGradient`, `components/Button.tsx`/`IconButton.tsx`'s "no
 * specular highlight, moulded ABS" rule): that rule is about every PRESSABLE control reading as
 * one consistent physical material. A pip has never been pressable — it's closer to a
 * scoreboard chip or a collected token than a button — so it's fine, and arguably clearer, for
 * it to read as a different kind of object. Don't "fix" this pip to match Button's matte
 * recipe; that was tried (twice) and explicitly rejected.
 * Each pip's SVG gradients need a unique `id` — react-native-svg on web (`npm run preview`)
 * renders every `<Svg>` into the SAME DOM document, so a literal repeated id string would
 * collide across pips (GlassFill.tsx hit this same issue first; same fix here): one top-level
 * `React.useId()` call (`pipGradientBaseId`, NOT called inside the pip `.map()` — that would
 * break the rules of hooks) suffixed with `rowKey` ('day'/'week') + index.
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
 *   Imports → components/Stepper, components/Collapsible, components/PressableScale,
 *             components/CardHintNote, components/EnergyPauseSheet, constants/theme,
 *             constants/motion, lib/useAppTheme, lib/i18n, lib/date, lib/energy,
 *             lib/useEnergyPause, store/useSettingsStore, store/useTaskStore,
 *             store/useHabitStore, store/useEnergyStore, expo-router (useFocusEffect),
 *             react-native-reanimated
 *             (components/Surface is deliberately NOT imported any more — see "Strip, not a card")
 *   Used by → app/(tabs)/index.tsx (Home) — mounted fixed, above the Shared card and the
 *             HomeCardManager stack, gated on settings.energySystemEnabled
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides (base capacity AND the
 *             'b:' boost row); writes those overrides, plus today's pause/pin state through
 *             lib/useEnergyPause.ts (device-local `app_meta`, never synced)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import CardHintNote from '@/components/CardHintNote';
import EnergyPauseSheet from '@/components/EnergyPauseSheet';
import { Fonts, FontSize, Radius, RowTrailing, Spacing, darken, lighten, getGlow, hitSlopFor } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { energyDeltaForDay, energyDeltaForWeek, energyPipCount } from '@/lib/energy';
import { useEnergyPause } from '@/lib/useEnergyPause';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';
import { Duration, Ease } from '@/constants/motion';

type PulseKind = 'recovered' | 'depleted';

/** The header's edit glyph. Named so `hitSlopFor()` can expand it to MIN_TAP_TARGET from the
 *  one number that matters — at 16px it needs 14px of slop, which a hand-picked 8 or 12
 *  (40px of target) doesn't reach. */
const EDIT_ICON_SIZE = 16;

/**
 * The two glyphs at the end of the strip line — ✏️ alone most days, the calm overspend
 * control to its left when today is over its energy.
 *
 * They are the app's second pair of independent tap targets sitting side by side, so they
 * follow `RowTrailing`'s arithmetic rather than each carrying a symmetric `hitSlopFor(16)`
 * (14px a side, which across ANY sane gap would overlap — and RN hit-tests siblings in
 * reverse order, so the ✏️ would silently swallow the right edge of the pause control). Each
 * is clipped on the side it shares with its neighbour, to the same 4px `RowTrailing` uses,
 * and the gap is `RowTrailing.gap` (16) so 16 − 4 − 4 = 8px belongs to neither. Both keep
 * their full 14px top/bottom, i.e. 44px on the axis a thumb actually misses on.
 */
const PAIR_CLIP = RowTrailing.actionSlop.right;
/** ✏️ on its own — nothing beside it, so it keeps a plain symmetric target. */
const EDIT_SLOP = hitSlopFor(EDIT_ICON_SIZE);
/** ✏️ with the pause control to its LEFT — clipped on that side. */
const EDIT_SLOP_PAIRED = { ...EDIT_SLOP, left: PAIR_CLIP };
/** The pause control, always the LEFT of the pair — clipped on its right. */
const OVERSPEND_SLOP = { ...EDIT_SLOP, right: PAIR_CLIP };

/** Pip diameter + the gap between pips. Down from 24/5 in the 2026-07-31 strip pass — see the
 *  file header's "Two layouts, and the width math behind them" note before changing either;
 *  ten pips have to share one line with the value and the edit glyph now. */
const PIP_SIZE = 18;
const PIP_GAP = 4;
/** The flash glyph inside a pip — ~60% of the badge, same proportion the 24px pip used. */
const PIP_ICON_SIZE = 11;

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

export default function EnergyMeter() {
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();

  const energyMode = useSettingsStore((s) => s.energyMode);
  // Subscribe to the defaults + overrides so the meter recomputes when either changes.
  useSettingsStore((s) => s.energyDailyCapacity);
  useSettingsStore((s) => s.energyWeeklyCapacity);
  useSettingsStore((s) => s.energyCustomCapacities);
  useEnergyStore((s) => s.overrides);
  const capacityForDay = useEnergyStore((s) => s.capacityForDay);
  const capacityForWeek = useEnergyStore((s) => s.capacityForWeek);
  const setDayCapacity = useEnergyStore((s) => s.setDayCapacity);
  const setWeekCapacity = useEnergyStore((s) => s.setWeekCapacity);
  const boostForDay = useEnergyStore((s) => s.boostForDay);
  const setDayBoost = useEnergyStore((s) => s.setDayBoost);

  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);

  // Today's over-budget state, the pause, and the "I'll decide" candidates — one hook so the
  // control here and the pinned card on Home can never disagree about them (lib/useEnergyPause.ts).
  const pause = useEnergyPause();

  const [editing, setEditing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  // Document-unique base id for each active pip's pair of SVG gradients — see the file
  // header's "Energy-token pip" note. One call per component instance, suffixed per-pip
  // (rowKey + index) in the row() renderer below rather than calling useId() inside the
  // pip .map(), which would break the rules of hooks.
  const pipGradientBaseId = 'pipGrad' + React.useId().replace(/:/g, '');

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
   * Three gates, all of them about the moment being calm enough: the Home screen is focused
   * (the pager mounts all five tabs, so being mounted proves nothing), the ✏️ editor is not
   * open (never interrupt a user who is mid-interaction with the card), and today has not
   * already offered it (`shouldAutoShow`, which lib/useEnergyPause.ts keeps true until the
   * user actually answers — a backgrounded app re-offers rather than burning the day's one
   * chance in silence). Both answers stamp the day in the store, so nothing re-opens after one.
   */
  useEffect(() => {
    if (!focused || editing || sheetOpen) return;
    if (!pause.shouldAutoShow) return;
    setSheetOpen(true);
  }, [focused, editing, sheetOpen, pause.shouldAutoShow]);

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

  const overspendButton = (
    <PressableScale
      onPress={() => setSheetOpen(true)}
      hitSlop={OVERSPEND_SLOP}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={t.energyPause.overspendLabel}
    >
      <Ionicons name="pause-circle-outline" size={EDIT_ICON_SIZE} color={theme.accent} />
    </PressableScale>
  );

  const editButton = (
    <PressableScale
      onPress={() => setEditing((v) => !v)}
      hitSlop={showOverspend ? EDIT_SLOP_PAIRED : EDIT_SLOP}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={t.energyMeter.editTitle}
    >
      <Ionicons
        name={editing ? 'checkmark' : 'create-outline'}
        size={EDIT_ICON_SIZE}
        color={editing ? theme.accent : theme.textMuted}
      />
    </PressableScale>
  );

  // Passed to exactly ONE row (see the file header's "The edit affordance travels" note).
  // `RowTrailing.gap` between the two, which is what makes PAIR_CLIP's 8px of dead space work.
  const trailingControls = showOverspend ? (
    <View style={styles.trailingCluster}>
      {overspendButton}
      {editButton}
    </View>
  ) : (
    editButton
  );

  const row = (
    rowKey: 'day' | 'week',
    label: string,
    current: number,
    capacity: number,
    pulse: { id: number; kind: PulseKind } | null,
    trailing: React.ReactNode,
    /** The always-visible capacity stepper for this period. See the header's layout note. */
    capacityStepper: React.ReactNode
  ) => {
    const { pipCount, filled, surplus } = energyPipCount(current, capacity);
    const pips = (
      <View
        style={styles.pipRow}
        accessibilityLabel={surplus > 0 ? t.energyMeter.surplusLabel(surplus) : undefined}
      >
        {Array.from({ length: pipCount }).map((_, i) => {
          const active = i < filled;
          if (!active) {
            return (
              <View key={i} style={[styles.pipEmpty, { backgroundColor: theme.surfaceInset, borderColor: theme.border }]}>
                <Ionicons name="flash-outline" size={PIP_ICON_SIZE} color={theme.textMuted} />
              </View>
            );
          }
          const fillId = `${pipGradientBaseId}-${rowKey}-${i}-fill`;
          const glossId = `${pipGradientBaseId}-${rowKey}-${i}-gloss`;
          return (
            <View key={i} style={[styles.pipBadge, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id={fillId} cx="50%" cy="36%" r="80%">
                    <Stop offset="0%" stopColor={lighten(theme.accent, 0.22)} />
                    <Stop offset="55%" stopColor={theme.accent} />
                    <Stop offset="100%" stopColor={darken(theme.accent, 0.22)} />
                  </RadialGradient>
                  {/* Gloss highlight — keep this bold (high center opacity), not subtle.
                      It's the one detail that reads as "glossy token" rather than "flat
                      circle"; see the file header's "Energy-token pip" note. */}
                  <RadialGradient id={glossId} cx="38%" cy="24%" rx="42%" ry="26%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
                    <Stop offset="85%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx="50%" cy="50%" r="46%" fill={`url(#${fillId})`} stroke={darken(theme.accent, 0.5)} strokeWidth={2} />
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glossId})`} />
              </Svg>
              <Ionicons name="flash" size={PIP_ICON_SIZE} color="#FFFFFF" />
            </View>
          );
        })}
        {/* Surplus (2026-08-02): energy EARNED past the day's capacity, which the old clamp
            swallowed — `12 / 10` used to draw identically to `10 / 10`. Drawn after the full
            ones and deliberately a third kind of object: neither the saturated glossy token
            (that's a pip you still have) nor the hollow surfaceInset ring (that's one you've
            spent), but a soft accent-outlined pip with the OUTLINE glyph. It has to read as
            "extra, on top" rather than as a bigger day — the count is capped at
            MAX_SURPLUS_PIPS in lib/energy.ts precisely so it stays a shape and not a score. */}
        {Array.from({ length: surplus }).map((_, i) => (
          <View
            key={`surplus-${i}`}
            style={[styles.pipSurplus, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
          >
            <Ionicons name="flash-outline" size={PIP_ICON_SIZE} color={theme.accent} />
          </View>
        ))}
      </View>
    );
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
          <View style={styles.meterTopRow}>
            <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>
            {/* Setting the number is the primary thing you do to this strip, so it is on the
                strip rather than behind the ✏️ — "shown by default, in a state you can use to
                set energy per day/week, easy and not forceful" (maintainer, 2026-08-03). The
                ✏️ keeps the things that should NOT be one tap away: the today-only boost. */}
            <View style={styles.topRowTrailing}>
              {capacityStepper}
              {trailing}
            </View>
          </View>
          {/* The value rides the end of the pip line now that the top line carries the label
              and the stepper. It reads against the pips it describes, and the line has room
              for it because nothing else is competing for that row. */}
          <View style={styles.pipLine}>
            {pips}
            {value}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.strip}>
      {/* Paused (2026-08-02, "I'm good"): the strip stays mounted but draws NOTHING for the
          rest of the day — no meter, no editor, no hint, no control. This is presentation
          only, exactly like a card layout: every energy cost keeps being recorded, every
          value keeps its stored number, and tomorrow's date brings the whole strip back
          untouched. The sheet stays mounted through it so its exit animation can finish. */}
      {!pause.paused && (
        <>
          {/* Both labels are unconditional now — see the i18n note on `energyMeter.today`.
              The capacity steppers moved OUT of the Collapsible below and onto each row's own
              top line: setting your day's or week's number is the whole point of the strip,
              and it was behind a pencil. The day row steps the BASE capacity, not the total —
              see `dayBaseCapacity` for why stepping the total re-banks the boost. */}
          {showDay && row('day', t.energyMeter.today, dayCurrent, dayCapacity, dayPulse, trailingControls,
            <Stepper
              value={dayBaseCapacity}
              onChange={(n) => setDayCapacity(today, n)}
              min={0}
              accessibilityLabel={t.energyMeter.todayCapacity}
            />
          )}
          {showDay && showWeek && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          {/* `showDay ? null : trailingControls` — the glyphs are drawn by whichever meter comes
              FIRST, so 'weekly' mode (no day row) still gets them and 'custom' mode never gets two. */}
          {showWeek && row('week', t.energyMeter.thisWeek, weekCurrent, weekCapacity, weekPulse, showDay ? null : trailingControls,
            <Stepper
              value={weekCapacity}
              onChange={(n) => setWeekCapacity(today, n)}
              min={0}
              accessibilityLabel={t.energyMeter.weekCapacity}
            />
          )}

          {/* What is left behind the ✏️: the today-only boost, and nothing else. It stays
              hidden on purpose — an always-visible "give myself more for today" stepper is an
              invitation, and this system is meant to describe a day rather than reward one. */}
          <Collapsible open={editing}>
            <View style={styles.editor}>
              {showDay && (
                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t.energyMeter.boostToday}</Text>
                  <Stepper value={dayBoost} onChange={(n) => setDayBoost(today, n)} min={0} />
                </View>
              )}
              {/* The boost's own one-liner, inside the editor rather than under the strip: it
                  only matters while you are looking at the stepper, and the strip already
                  carries the one permanent hint it can afford. */}
              {showDay && <CardHintNote text={t.energyMeter.boostHint} noBorder />}
            </View>
          </Collapsible>

          {/* Permanent one-line explainer, attached directly under the meter it explains
              (2026-07-27, user report). See the file header for why this is no longer a
              disappearing StarterCard sibling. The shape this pioneered became the shared
              components/CardHintNote.tsx (2026-07-30), which every Home card's tip now uses.
              It KEEPS its top hairline (no `noBorder`): with the card surface gone that rule is
              the strip's only bottom edge, and it's what stops the hint reading as a floating
              paragraph between Energy and the card below. */}
          <CardHintNote text={t.energyMeter.hint} style={styles.hint} />
        </>
      )}

      {/* The one line the pause leaves behind. It is the acknowledgement itself — the narrator
          answering "I'm good" once, in place, in the space the meter just vacated — not a
          retrospective on it: it is static, never counted, never referred to again, and gone
          at midnight without anyone dismissing it. A strip that silently emptied read as a
          bug, which is the other half of why it is here.
          Deliberately NOT a CardHintNote (that tier carries a bulb icon and a hairline rule,
          both of which would rebuild a card here), not tappable, and with no way back: the
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
  // The top line's right-hand cluster: the always-visible capacity stepper, then the ✏️ (and
  // the overspend control when it is showing). `marginLeft:'auto'` is what right-aligns it
  // against the label without meterTopRow needing a justifyContent.
  topRowTrailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: 'auto' },
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
  // real phones — that is still true at PIP_SIZE 18, and it is exactly why the single-meter
  // case went inline (and label-less) in the 2026-07-31 strip pass. Stacking unconditionally
  // is the other way out of that squeeze: it costs one line and buys the label plus a
  // settable stepper. Don't collapse this branch back to one line.
  meterRow: { gap: 6 },
  // No justifyContent here — topRowTrailing's own marginLeft:'auto' pushes the stepper and
  // glyphs to the right edge, so this layout needs no conditional branch.
  meterTopRow: { flexDirection: 'row', alignItems: 'center' },
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Takes the leftover width AFTER the value has its intrinsic size, and clips rather than
  // overflowing. See the file header — an overflowing pip row painting over the value text is
  // the 2026-07-28 bug this guards against. Folded in unconditionally on 2026-08-03: the pips
  // now share a line with the value in every mode, so there is no longer a variant where they
  // don't need it (this was `pipRowInline`, applied only to the single-meter case).
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: PIP_GAP, flex: 1, minWidth: 0, overflow: 'hidden' },
  // Energy-token pip (2026-07-28, round 3 — see file header's "Energy-token pip" note): an
  // available pip's real fill/rim/gloss are drawn by the Svg in row()'s renderer; this View
  // only needs a matching backgroundColor so its own shadow casts in the right (circular)
  // shape — the Svg fully covers it, nothing here is actually visible except the shadow.
  // Purely visual, never wrapped in PressableScale — nothing here is pressable. Sized from
  // PIP_SIZE (18, down from 24 in the strip pass) — don't grow it without re-running the
  // one-line width math in the file header and `npm run wraps`.
  pipBadge: {
    width: PIP_SIZE, height: PIP_SIZE, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 3, elevation: 4,
  },
  // A spent pip is a plain hollow ring — an emptied slot, no gradient, no gloss, no shadow.
  pipEmpty: { width: PIP_SIZE, height: PIP_SIZE, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  // A surplus pip (2026-08-02) is the third kind: the empty ring's flat outlined shape, but in
  // accent rather than muted grey, over a soft accent wash. Same geometry as pipEmpty so the
  // row's rhythm doesn't break where the bar ends — only the colour says "extra".
  pipSurplus: { width: PIP_SIZE, height: PIP_SIZE, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  // flexShrink:0 so the value keeps its full width on the strip line and the pip row is what
  // gives, never the number.
  meterValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium, marginLeft: 'auto', flexShrink: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  // The pause control + the ✏️ glyph. The gap is RowTrailing's, not Spacing's, because it is
  // load-bearing: it is what leaves 8px belonging to neither touch area once PAIR_CLIP has
  // taken 4px off each facing edge. See the PAIR_CLIP block at the top of the file.
  trailingCluster: { flexDirection: 'row', alignItems: 'center', gap: RowTrailing.gap },
  editor: { gap: Spacing.sm, paddingTop: Spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // CardHintNote brings its own hairline/italic caption-or-smaller type; this only trims its
  // default top margin, since `strip`'s own `gap` already separates it from the meter above.
  hint: { marginTop: 2 },
  // The paused day's single line. Same caption tier as CardHintNote's text (FontSize.xs,
  // italic, theme.textMuted) so it reads as the quietest thing on Home, but hand-rolled
  // rather than reusing that component — its bulb icon and hairline rule would give the
  // pause a bordered header, i.e. exactly the status banner this must not be. No margin of
  // its own: `strip`'s existing gap is the only spacing, so the strip's outer geometry is
  // identical paused and unpaused.
  pausedNote: { fontSize: FontSize.xs, fontStyle: 'italic' },
});
