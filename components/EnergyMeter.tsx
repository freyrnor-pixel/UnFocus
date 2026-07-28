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
 * **Game-like pip buttons (2026-07-28)**: each pip is now a small raised/sunken "keycap"
 * (reuses constants/theme's `getElevation` — the same raised/flat tokens PressableScale's
 * `depth` prop draws from) rather than a bare icon: an available pip is `getElevation('raised')`
 * over `theme.surface` (popped out), a spent pip is `getElevation('flat')` over
 * `theme.surfaceInset` (pressed in — that token is literally "the deepest surface" already).
 * Purely visual, NOT actually pressable (there's nothing to tap on a pip) — the point is the
 * bar reading like a row of game HUD charges being used up, not a real control.
 *
 * **Stacked row layout (2026-07-28 fix)**: label+value share a top line (`meterTopRow`); the
 * pip row is a full-width line below it, not squeezed into the same row as the label/value
 * text. At the default capacity of 10, ten fixed 18px pips need ~216px, which doesn't fit
 * alongside label/value text on real phone widths in a single row — they overflowed and
 * painted over the value text. Don't put pips back on the same line as the label/value.
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
 *             components/PressableScale, constants/theme, lib/useAppTheme, lib/i18n,
 *             lib/date, lib/energy, store/useSettingsStore, store/useTaskStore,
 *             store/useHabitStore, store/useEnergyStore, react-native-reanimated
 *   Used by → app/(tabs)/index.tsx (Home)
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides; writes overrides only
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Surface from '@/components/Surface';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, Radius, Spacing, getElevation, getGlow } from '@/constants/theme';
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

  // energyMode picks which meter(s) apply — 'daily'/'weekly' show only their own
  // meter, 'custom' (per-weekday capacities, set in Settings) shows both since the
  // week total is derived from the seven day amounts.
  const showDay = energyMode !== 'weekly';
  const showWeek = energyMode !== 'daily';

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

  const row = (label: string, current: number, capacity: number, pulse: { id: number; kind: PulseKind } | null) => {
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
          <View style={styles.meterTopRow}>
            <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>
            <Text style={[styles.meterValue, { color: theme.textMuted }]}>{`${current} / ${capacity}`}</Text>
          </View>
          <View style={styles.pipRow}>
            {Array.from({ length: pipCount }).map((_, i) => {
              const active = i < filled;
              return (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    active
                      ? { backgroundColor: theme.surface, borderTopColor: 'rgba(255,255,255,0.5)', borderBottomColor: 'rgba(0,0,0,0.20)', ...getElevation('raised', theme.shadow) }
                      : { backgroundColor: theme.surfaceInset, borderTopColor: 'rgba(0,0,0,0.22)', borderBottomColor: 'rgba(255,255,255,0.08)', ...getElevation('flat', theme.shadow) },
                  ]}
                >
                  <Ionicons
                    name={active ? 'flash' : 'flash-outline'}
                    size={12}
                    color={active ? theme.accent : theme.textMuted}
                  />
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
          <Ionicons name="flash" size={16} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>{t.energyMeter.title}</Text>
        </View>
        <PressableScale
          onPress={() => setEditing((v) => !v)}
          hitSlop={8}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={t.energyMeter.editTitle}
        >
          <Ionicons
            name={editing ? 'checkmark' : 'create-outline'}
            size={18}
            color={editing ? theme.accent : theme.textMuted}
          />
        </PressableScale>
      </View>

      {showDay && row(t.energyMeter.today, dayCurrent, dayCapacity, dayPulse)}
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
      {showWeek && row(t.energyMeter.thisWeek, weekCurrent, weekCapacity, weekPulse)}
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
          disappearing StarterCard sibling. */}
      <View style={[styles.hintRow, { borderTopColor: theme.border }]}>
        <Ionicons name="bulb-outline" size={12} color={theme.textMuted} style={styles.hintIcon} />
        <Text style={[styles.hintText, { color: theme.textMuted }]}>{t.energyMeter.hint}</Text>
      </View>

    </Surface>
  );
}

const styles = StyleSheet.create({
  // Tighter vertically than a standard card (2026-07-27, user report: "the Energy card can be
  // vertically shorter") — one title row plus one or two single-line meters doesn't need a full
  // Spacing.md band above and below. Horizontal padding stays md so it still lines up with the
  // other Home cards' content.
  card: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  // Wraps each meter row so EnergyPulse (an absoluteFill sibling) has a position:relative
  // parent to glow behind — see the "Depleted/recovered pulse" file-header note.
  meterRowWrap: { position: 'relative', borderRadius: Radius.sm },
  // Stacked (2026-07-28 fix): label+value share a top line, the pip row gets the full
  // card width on its own line below. A single-line layout (label — pips — value all in
  // one row) ran out of horizontal room on real phones once pips became fixed-size
  // "keycaps" — at the default capacity of 10, the pips alone need ~216px, which doesn't
  // fit alongside the label/value text at typical content widths (~296-330px), so the
  // pips overflowed their box and painted over the value text. Stacking removes the
  // three-way competition for width entirely instead of trying to tune sizes that could
  // break again at another font-scale/language/width combination.
  meterRow: { gap: 4 },
  meterTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // "Keycap" pip — an available (unspent) pip is raised/popped via getElevation('raised'),
  // a spent pip sits flat/sunken via getElevation('flat') over theme.surfaceInset. Purely
  // visual (see file header) — never wrapped in PressableScale, nothing to actually press.
  pip: { width: 18, height: 18, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  meterValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  warningText: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  editor: { gap: Spacing.sm, paddingTop: Spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Permanent explainer — a hairline rule ties it to the meter above rather than letting it
  // float as its own paragraph, and it stays small enough not to compete with the numbers.
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.xs, marginTop: 2 },
  hintIcon: { marginTop: 1 },
  hintText: { flex: 1, fontSize: FontSize.xs, lineHeight: 16, fontStyle: 'italic' },
});
