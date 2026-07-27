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
 * Connections:
 *   Imports → components/Surface, components/Stepper, components/Collapsible,
 *             components/PressableScale, constants/theme, lib/useAppTheme, lib/i18n,
 *             lib/date, lib/energy, store/useSettingsStore, store/useTaskStore,
 *             store/useHabitStore, store/useEnergyStore
 *   Used by → app/(tabs)/index.tsx (Home)
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides; writes overrides only
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { energyDeltaForDay, energyDeltaForWeek, plannedEnergyDeltaForDay, plannedEnergyDeltaForWeek, energyPipCount } from '@/lib/energy';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';

export default function EnergyMeter() {
  const theme = useAppTheme();
  const t = useT();

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

  const row = (label: string, current: number, capacity: number) => {
    const boltColor = current <= 0 ? theme.bad : theme.accent;
    const { pipCount, filled } = energyPipCount(current, capacity);
    return (
      <View style={styles.meterRow}>
        <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>
        <View style={styles.pipRow}>
          {Array.from({ length: pipCount }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < filled ? 'flash' : 'flash-outline'}
              size={13}
              color={i < filled ? boltColor : theme.textMuted}
            />
          ))}
        </View>
        <Text style={[styles.meterValue, { color: theme.textMuted }]}>{`${current} / ${capacity}`}</Text>
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

      {showDay && row(t.energyMeter.today, dayCurrent, dayCapacity)}
      {showDay && dayPlannedOver > 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="alert-circle" size={14} color={theme.warn} />
          <Text style={[styles.warningText, { color: theme.warn }]}>{t.energyMeter.overCommittedDay(dayPlannedOver)}</Text>
        </View>
      )}
      {showDay && showWeek && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
      {showWeek && row(t.energyMeter.thisWeek, weekCurrent, weekCapacity)}
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
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, minWidth: 62 },
  pipRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
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
