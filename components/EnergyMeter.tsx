/**
 * EnergyMeter.tsx — Home card for the optional Energy system (2026-07-20).
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
 * Always rendered (2026-07-26): Energy stopped being a toggle — a task/habit reads 0 unless
 * you give it a value, so the meter simply sits at capacity until something has one.
 * settings.energyMode (2026-07-24) picks which meter(s) show: 'daily' hides the week
 * row, 'weekly' hides the day row, 'custom' (per-weekday capacities set in
 * app/settings.tsx) shows both since the week total derives from the seven days.
 *
 * **Permanent inline hint (2026-07-27)**: one small italic line (`t.energyMeter.hint`) under a
 * hairline rule, INSIDE this card, always. It replaced a `components/StarterCard` sibling that
 * carried two "+" example rows and vanished once anything had an energy value. Two problems with
 * that, both reported: (1) as a separate card BELOW the meter and directly ABOVE the to-do card,
 * it read as belonging to the to-do card, so its disappearing act looked like a bug in the wrong
 * place; (2) an explanation that self-destructs is unavailable exactly when a user comes back to
 * the number months later and has forgotten what it meant. Attached and permanent fixes both.
 * Keep it to ONE line and no examples — the meter is the smallest card on Home and an explainer
 * taller than the thing it explains was the earlier complaint.
 *
 * Compact everywhere (2026-07-27, user report — "the card can be vertically shorter"): tighter
 * vertical padding + gap than a standard card.
 *
 * Bolt-row meter (2026-07-27): each period is one line — label, a row of small flash-icon
 * "pips" (lib/energy.ts's energyPipCount — 1:1 up to 10, then scaled), and the `current /
 * capacity` value, replacing the old two-line label-row + ProgressBar stack to keep the
 * card short. A hairline divider separates the day and week lines when both are shown
 * (energyMode 'custom').
 *
 * **Stacked row layout (2026-07-28 fix)**: label+value share a top line (`meterTopRow`); the
 * pip row is a full-width line below it, not squeezed into the same row as the label/value
 * text. At the default capacity of 10, ten fixed 24px pips need ~285px, which doesn't fit
 * alongside label/value text on real phone widths in a single row — they overflowed and
 * painted over the value text. Don't put pips back on the same line as the label/value.
 *
 * **Label dropped for the single-meter case (2026-07-28)**: `row()`'s `label` param is
 * nullable — passed only when BOTH day and week meters are on screen at once (`energyMode`
 * 'custom') where it's the one thing telling the rows apart; in the far more common
 * single-meter case ('daily'/'weekly') it's dropped entirely rather than repeating what the
 * lone row already makes obvious. `meterValue`'s `marginLeft:'auto'` (not `meterTopRow`'s
 * `justifyContent`) does the right-alignment so this works with or without a label present,
 * without a conditional style branch.
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
 *   Imports → components/Surface, components/Stepper, components/Collapsible,
 *             components/PressableScale, components/CardHintNote, constants/theme, lib/useAppTheme, lib/i18n,
 *             lib/date, lib/energy, store/useSettingsStore, store/useTaskStore,
 *             store/useHabitStore, store/useEnergyStore, react-native-reanimated
 *   Used by → app/(tabs)/index.tsx (Home)
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides; writes overrides only
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Surface from '@/components/Surface';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import CardHintNote from '@/components/CardHintNote';
import { Fonts, FontSize, Radius, Spacing, darken, lighten, getGlow } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { energyDeltaForDay, energyDeltaForWeek, plannedEnergyDeltaForDay, plannedEnergyDeltaForWeek, energyPipCount } from '@/lib/energy';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';

type PulseKind = 'recovered' | 'depleted';

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
      withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
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
   * The common case ('daily'/'weekly' — one meter on the card). The `current / capacity`
   * value then moves UP onto the header row beside the title (2026-07-30, user report: "Energy
   * card is too high"), because with no label to sit beside it, it otherwise got an entire
   * 20px line to itself between the header and the pips. 'custom' shows both meters, where
   * each row needs its own label+value line to stay tellable apart, so the value stays put.
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
  const row = (rowKey: 'day' | 'week', label: string | null, current: number, capacity: number, pulse: { id: number; kind: PulseKind } | null) => {
    const { pipCount, filled } = energyPipCount(current, capacity);
    return (
      <View style={styles.meterRowWrap}>
        {pulse && (
          <EnergyPulse
            key={pulse.id}
            color={pulse.kind === 'recovered' ? theme.good : theme.accent}
            reducedMotion={reducedMotion}
          />
        )}
        <View style={styles.meterRow}>
          {/* Single-meter mode draws no top line at all — the value moved up into the card
              header (see `singleMeter` below), so this would be an empty 20px band. */}
          {!singleMeter && (
            <View style={styles.meterTopRow}>
              {label && <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>}
              <Text style={[styles.meterValue, { color: theme.textMuted }]}>{`${current} / ${capacity}`}</Text>
            </View>
          )}
          <View style={styles.pipRow}>
            {Array.from({ length: pipCount }).map((_, i) => {
              const active = i < filled;
              if (!active) {
                return (
                  <View key={i} style={[styles.pipEmpty, { backgroundColor: theme.surfaceInset, borderColor: theme.border }]}>
                    <Ionicons name="flash-outline" size={14} color={theme.textMuted} />
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
                  <Ionicons name="flash" size={14} color="#FFFFFF" />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="flash" size={18} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>{t.energyMeter.title}</Text>
        </View>
        {/* The value rides the header in single-meter mode — see `singleMeter`. */}
        {singleMeter && (
          <Text style={[styles.headerValue, { color: theme.textMuted }]}>
            {showDay ? `${dayCurrent} / ${dayCapacity}` : `${weekCurrent} / ${weekCapacity}`}
          </Text>
        )}
        <PressableScale
          onPress={() => setEditing((v) => !v)}
          hitSlop={12}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={t.energyMeter.editTitle}
        >
          <Ionicons
            name={editing ? 'checkmark' : 'create-outline'}
            size={16}
            color={editing ? theme.accent : theme.textMuted}
          />
        </PressableScale>
      </View>

      {showDay && row('day', showWeek ? t.energyMeter.today : null, dayCurrent, dayCapacity, dayPulse)}
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
      {showWeek && row('week', showDay ? t.energyMeter.thisWeek : null, weekCurrent, weekCapacity, weekPulse)}
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

      {/* Permanent one-line explainer, INSIDE the card, directly under the meter it explains
          (2026-07-27, user report). See the file header for why this is no longer a
          disappearing StarterCard sibling. The shape this pioneered became the shared
          components/CardHintNote.tsx (2026-07-30), which every Home card's tip now uses. */}
      <CardHintNote text={t.energyMeter.hint} style={styles.hint} />

    </Surface>
  );
}

const styles = StyleSheet.create({
  // Tighter vertically than a standard card (2026-07-27, user report: "the Energy card can be
  // vertically shorter") — one title row plus one or two single-line meters doesn't need a full
  // Spacing.md band above and below. Horizontal padding stays md so it still lines up with the
  // other Home cards' content.
  card: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // flex:1 so the title block takes the slack and the value + edit icon sit together at the
  // right edge, rather than the value floating in the middle on a space-between row.
  titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // 18, up from FontSize.md/16 (2026-07-30, user report: "Energy header a bit bigger") — still
  // below the 20px the four domain cards' titles use, since this is the smallest card on Home.
  title: { fontSize: 18, fontFamily: Fonts.bold },
  // The hoisted single-meter value (see `singleMeter`). Tabular-ish weight matching meterValue
  // so 'custom' mode's per-row values and this one read as the same number in two places.
  headerValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  // Wraps each meter row so EnergyPulse (an absoluteFill sibling) has a position:relative
  // parent to glow behind — see the "Depleted/recovered pulse" file-header note.
  meterRowWrap: { position: 'relative', borderRadius: Radius.sm },
  // Stacked (2026-07-28 fix): label+value share a top line, the pip row gets the full
  // card width on its own line below. A single-line layout (label — pips — value all in
  // one row) ran out of horizontal room on real phones once pips became fixed-size tokens
  // — at the default capacity of 10, the pips alone need ~285px, which doesn't fit
  // alongside the label/value text at typical content widths (~296-330px), so the
  // pips overflowed their box and painted over the value text. Stacking removes the
  // three-way competition for width entirely instead of trying to tune sizes that could
  // break again at another font-scale/language/width combination.
  meterRow: { gap: 6 },
  // No justifyContent here — meterValue's own marginLeft:'auto' pushes it to the right
  // edge whether or not meterLabel is rendered (label is omitted when only one meter
  // row is on screen, see the `row()` comment above), so this layout doesn't need a
  // conditional style branch for the label-present vs. label-absent case.
  meterTopRow: { flexDirection: 'row', alignItems: 'center' },
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Full card width now that it's on its own line (2026-07-28 stack fix) — see `pipBadge`
  // below for the size/gap math that keeps this fitting at the narrowest audited width.
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Energy-token pip (2026-07-28, round 3 — see file header's "Energy-token pip" note): an
  // available pip's real fill/rim/gloss are drawn by the Svg in row()'s renderer; this View
  // only needs a matching backgroundColor so its own shadow casts in the right (circular)
  // shape — the Svg fully covers it, nothing here is actually visible except the shadow.
  // Purely visual, never wrapped in PressableScale — nothing here is pressable. Sized at
  // 24px: 10*24 + 9*5 gap = 285px, fits the 360px-wide worst case (~296px content) with
  // margin — don't grow this further without re-checking `npm run wraps` math.
  pipBadge: {
    width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 3, elevation: 4,
  },
  // A spent pip is a plain hollow ring — an emptied slot, no gradient, no gloss, no shadow.
  pipEmpty: { width: 24, height: 24, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  meterValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium, marginLeft: 'auto' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  warningText: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  editor: { gap: Spacing.sm, paddingTop: Spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // CardHintNote brings its own hairline/type; this only trims its default top margin, since
  // the card's own `gap` already separates it from the meter above.
  hint: { marginTop: 2 },
});
