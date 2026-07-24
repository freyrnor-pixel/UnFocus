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
 * Renders nothing unless settings.energySystemEnabled — the whole system is opt-in.
 *
 * Connections:
 *   Imports → components/Surface, components/ProgressBar, components/Stepper,
 *             components/Collapsible, components/PressableScale, constants/theme,
 *             lib/useAppTheme, lib/i18n, lib/date, lib/energy, store/useSettingsStore,
 *             store/useTaskStore, store/useHabitStore, store/useEnergyStore
 *   Used by → app/(tabs)/index.tsx (Home)
 *   Data    → reads tasks/habits/habitLogs + energy_budgets overrides; writes overrides
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import ProgressBar from '@/components/ProgressBar';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { energyDeltaForDay, energyDeltaForWeek, plannedEnergyDeltaForDay, plannedEnergyDeltaForWeek } from '@/lib/energy';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';

export default function EnergyMeter() {
  const theme = useAppTheme();
  const t = useT();

  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  // Subscribe to the defaults + overrides so the meter recomputes when either changes.
  useSettingsStore((s) => s.energyDailyCapacity);
  useSettingsStore((s) => s.energyWeeklyCapacity);
  useEnergyStore((s) => s.overrides);
  const capacityForDay = useEnergyStore((s) => s.capacityForDay);
  const capacityForWeek = useEnergyStore((s) => s.capacityForWeek);
  const setDayCapacity = useEnergyStore((s) => s.setDayCapacity);
  const setWeekCapacity = useEnergyStore((s) => s.setWeekCapacity);

  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);

  const [editing, setEditing] = useState(false);

  if (!energySystemEnabled) return null;

  const today = todayStr();
  const dayCapacity = capacityForDay(today);
  const weekCapacity = capacityForWeek(today);
  const dayCurrent = dayCapacity + energyDeltaForDay(today, tasks, habits, habitLogs);
  const weekCurrent = weekCapacity + energyDeltaForWeek(today, tasks, habits, habitLogs);

  // Over-committed = if everything still scheduled for the period happened, capacity would go negative.
  const dayPlannedOver = -Math.min(0, dayCapacity + plannedEnergyDeltaForDay(today, tasks, habits));
  const weekPlannedOver = -Math.min(0, weekCapacity + plannedEnergyDeltaForWeek(today, tasks, habits));

  const row = (label: string, current: number, capacity: number) => {
    const value = capacity > 0 ? current / capacity : 0;
    const state = current <= 0 ? 'bad' : undefined;
    return (
      <View style={styles.meterRow}>
        <View style={styles.meterLabelRow}>
          <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.meterValue, { color: theme.textMuted }]}>{`${current} / ${capacity}`}</Text>
        </View>
        <ProgressBar value={value} state={state} />
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

      {row(t.energyMeter.today, dayCurrent, dayCapacity)}
      {dayPlannedOver > 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="alert-circle" size={14} color={theme.warn} />
          <Text style={[styles.warningText, { color: theme.warn }]}>{t.energyMeter.overCommittedDay(dayPlannedOver)}</Text>
        </View>
      )}
      {row(t.energyMeter.thisWeek, weekCurrent, weekCapacity)}
      {weekPlannedOver > 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="alert-circle" size={14} color={theme.warn} />
          <Text style={[styles.warningText, { color: theme.warn }]}>{t.energyMeter.overCommittedWeek(weekPlannedOver)}</Text>
        </View>
      )}

      <Collapsible open={editing}>
        <View style={styles.editor}>
          <View style={styles.editRow}>
            <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t.energyMeter.todayCapacity}</Text>
            <Stepper value={dayCapacity} onChange={(n) => setDayCapacity(today, n)} min={0} />
          </View>
          <View style={styles.editRow}>
            <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t.energyMeter.weekCapacity}</Text>
            <Stepper value={weekCapacity} onChange={(n) => setWeekCapacity(today, n)} min={0} />
          </View>
        </View>
      </Collapsible>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  meterRow: { gap: Spacing.xs },
  meterLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  meterValue: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  warningText: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  editor: { gap: Spacing.sm, paddingTop: Spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
