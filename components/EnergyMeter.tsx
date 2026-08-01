/**
 * EnergyMeter.tsx — Home's Energy STRIP (not a card) for the optional Energy system (2026-07-20).
 *
 * Shows today's and this week's energy as `current / capacity`, where current =
 * capacity + the net signed value of every energy task completed / energy habit
 * met in the period (lib/energy.ts). Tapping the edit affordance reveals two
 * steppers to override today's and this week's capacity (store/useEnergyStore.ts).
 * Also warns (small alert icon + message) when everything still SCHEDULED for
 * the day/week — done or not — would take that period's capacity negative
 * (lib/energy.ts's plannedEnergyDeltaForDay/Week), so an over-committed day/week
 * is visible before anything on it has actually happened.
 *
 * **Strip, not a card (2026-07-31, addendum task B.2)**: this stopped being a `Surface`. It has
 * no card background, no shadow, no card padding and no title row — in the common single-meter
 * case (`energyMode` 'daily'/'weekly') it is ONE thin line: the pips, the `current / capacity`
 * value, and the edit affordance, with the permanent hint under it. Energy is chrome for the
 * day, not a fifth list to scroll past, and as a card it competed with the four content cards
 * below it. Don't re-wrap this in `Surface`/`GlassFill` and don't reinstate the flash-icon +
 * `t.energyMeter.title` header row — the pips are lightning bolts and the hint names the thing;
 * `t.energyMeter.title` survives only as the value's accessibility label.
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
 * **Depleted state is not a failure state** — the accompanying `t.energyMeter.depletedDay/
 * Week` copy is deliberately calm/caring ("a cue to ease off"), never a "Great job!"
 * congratulation: the system's whole point is balance/planning, not spending it all. Keep
 * any future copy on that same side of the line.
 *
 * Connections:
 *   Imports → components/Stepper, components/Collapsible,
 *             components/PressableScale, components/CardHintNote, constants/theme, lib/useAppTheme, lib/i18n,
 *             lib/date, lib/energy, store/useSettingsStore, store/useTaskStore,
 *             store/useHabitStore, store/useEnergyStore, react-native-reanimated
 *             (components/Surface is deliberately NOT imported any more — see "Strip, not a card")
 *   Used by → app/(tabs)/index.tsx (Home) — mounted fixed, above the Shared card and the
 *             HomeCardManager stack, gated on settings.energySystemEnabled
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides; writes overrides only
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import CardHintNote from '@/components/CardHintNote';
import { Fonts, FontSize, Radius, Spacing, darken, lighten, getGlow, hitSlopFor } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { energyDeltaForDay, energyDeltaForWeek, plannedEnergyDeltaForDay, plannedEnergyDeltaForWeek, energyPipCount } from '@/lib/energy';
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

  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);

  const [editing, setEditing] = useState(false);

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
  /**
   * The common case ('daily'/'weekly' — one meter). This is what makes the strip ONE line: pips,
   * value and edit glyph share a row, with no label and (since 2026-07-31) no title row above
   * them. 'custom' shows both meters, where each row needs its own label+value line to stay
   * tellable apart, so those keep the stacked shape.
   */
  const singleMeter = !(showDay && showWeek);

  const today = todayStr();
  const dayCapacity = capacityForDay(today);
  const weekCapacity = capacityForWeek(today);
  const dayCurrent = dayCapacity + energyDeltaForDay(today, tasks, habits, habitLogs);
  const weekCurrent = weekCapacity + energyDeltaForWeek(today, tasks, habits, habitLogs);

  // Over-committed = if everything still scheduled for the period happened, capacity would go negative.
  const dayPlannedOver = -Math.min(0, dayCapacity + plannedEnergyDeltaForDay(today, tasks, habits));
  const weekPlannedOver = -Math.min(0, weekCapacity + plannedEnergyDeltaForWeek(today, tasks, habits));

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

  // label is null when only one of day/week is shown (the common case, energyMode
  // 'daily'/'weekly') — with a single meter on the card, "Today"/"This week" repeats
  // what's already obvious and just eats space. It's only passed when BOTH rows are
  // on screen at once (energyMode 'custom'), where it's the one thing telling them apart.
  // rowKey is a stable 'day'/'week' discriminator for the pip gradient ids — kept separate
  // from `label` (which can be null) so id uniqueness never depends on translated text.
  // Passed to exactly ONE row (see the file header's "The edit affordance travels" note) — the
  // single meter's line, or the first visible meter's top line in 'custom' mode.
  const editButton = (
    <PressableScale
      onPress={() => setEditing((v) => !v)}
      hitSlop={hitSlopFor(EDIT_ICON_SIZE)}
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

  const row = (
    rowKey: 'day' | 'week',
    label: string | null,
    current: number,
    capacity: number,
    pulse: { id: number; kind: PulseKind } | null,
    trailing: React.ReactNode
  ) => {
    const { pipCount, filled } = energyPipCount(current, capacity);
    const pips = (
      <View style={[styles.pipRow, singleMeter && styles.pipRowInline]}>
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
        {singleMeter ? (
          // THE strip: one line, nothing above it. See the file header's width math before
          // adding anything else to this row.
          <View style={styles.stripLine}>
            {pips}
            {value}
            {trailing}
          </View>
        ) : (
          <View style={styles.meterRow}>
            <View style={styles.meterTopRow}>
              {label && <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>}
              {value}
              {trailing ? <View style={styles.topRowTrailing}>{trailing}</View> : null}
            </View>
            {pips}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.strip}>
      {showDay && row('day', showWeek ? t.energyMeter.today : null, dayCurrent, dayCapacity, dayPulse, editButton)}
      {showDay && dayCapacity > 0 && dayCurrent <= 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="leaf-outline" size={14} color={theme.good} />
          <Text style={[styles.warningText, { color: theme.textMuted }]}>{t.energyMeter.depletedDay}</Text>
        </View>
      )}
      {showDay && dayPlannedOver > 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="alert-circle" size={14} color={theme.warn} />
          <Text style={[styles.warningText, { color: theme.warn }]}>{t.energyMeter.overCommittedDay(dayPlannedOver)}</Text>
        </View>
      )}
      {showDay && showWeek && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
      {/* `showDay ? null : editButton` — the glyph is drawn by whichever meter comes FIRST, so
          'weekly' mode (no day row) still gets one and 'custom' mode never gets two. */}
      {showWeek && row('week', showDay ? t.energyMeter.thisWeek : null, weekCurrent, weekCapacity, weekPulse, showDay ? null : editButton)}
      {showWeek && weekCapacity > 0 && weekCurrent <= 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="leaf-outline" size={14} color={theme.good} />
          <Text style={[styles.warningText, { color: theme.textMuted }]}>{t.energyMeter.depletedWeek}</Text>
        </View>
      )}
      {showWeek && weekPlannedOver > 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="alert-circle" size={14} color={theme.warn} />
          <Text style={[styles.warningText, { color: theme.warn }]}>{t.energyMeter.overCommittedWeek(weekPlannedOver)}</Text>
        </View>
      )}

      <Collapsible open={editing}>
        <View style={styles.editor}>
          {showDay && (
            <View style={styles.editRow}>
              <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t.energyMeter.todayCapacity}</Text>
              <Stepper value={dayCapacity} onChange={(n) => setDayCapacity(today, n)} min={0} />
            </View>
          )}
          {showWeek && (
            <View style={styles.editRow}>
              <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t.energyMeter.weekCapacity}</Text>
              <Stepper value={weekCapacity} onChange={(n) => setWeekCapacity(today, n)} min={0} />
            </View>
          )}
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
  // The one-line strip itself (single-meter case): pips take the slack, value and edit glyph
  // sit at the right edge.
  stripLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Keeps the edit glyph off the value in 'custom' mode's stacked top line, where there's no
  // `gap` doing that job on the pip side.
  topRowTrailing: { marginLeft: Spacing.sm },
  // Wraps each meter row so EnergyPulse (an absoluteFill sibling) has a position:relative
  // parent to glow behind — see the "Depleted/recovered pulse" file-header note.
  meterRowWrap: { position: 'relative', borderRadius: Radius.sm },
  // 'custom' mode only (both meters on screen). Stacked (2026-07-28 fix): label+value share a
  // top line, the pip row gets the full width on its own line below. Putting a LABEL on the
  // same line as ten pips and a value ran out of horizontal room on real phones — that's still
  // true at PIP_SIZE 18, which is why only the label-less single-meter case went inline in the
  // 2026-07-31 strip pass. Don't collapse this branch.
  meterRow: { gap: 6 },
  // No justifyContent here — meterValue's own marginLeft:'auto' pushes it to the right
  // edge whether or not meterLabel is rendered (label is omitted when only one meter
  // row is on screen, see the `row()` comment above), so this layout doesn't need a
  // conditional style branch for the label-present vs. label-absent case.
  meterTopRow: { flexDirection: 'row', alignItems: 'center' },
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: PIP_GAP },
  // Inline (strip) variant: takes the leftover width AFTER the value and edit glyph have their
  // intrinsic sizes, and clips rather than overflowing. See the file header — an overflowing
  // pip row painting over the value text is the 2026-07-28 bug this guards against.
  pipRowInline: { flex: 1, minWidth: 0, overflow: 'hidden' },
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
  // flexShrink:0 so the value keeps its full width on the strip line and the pip row is what
  // gives, never the number.
  meterValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium, marginLeft: 'auto', flexShrink: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  warningText: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  editor: { gap: Spacing.sm, paddingTop: Spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // CardHintNote brings its own hairline/italic caption-or-smaller type; this only trims its
  // default top margin, since `strip`'s own `gap` already separates it from the meter above.
  hint: { marginTop: 2 },
});
