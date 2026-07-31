/**
 * BonsaiCard.tsx — Habits tab card for the optional Bonsai/points reward system (2026-07-31).
 *
 * Shows the all-time points total (settings.lifetimeBonsaiPoints) and a small bonsai tree
 * (components/BonsaiTree.tsx) whose growth STAGE reflects that total and whose HEALTH
 * (tinted green→grey) reflects recent tending — see lib/bonsai.ts for both mechanics. This
 * is the "reward, not balance" counterpart to the Energy system: Energy asks whether a
 * day/week is over-committed, this only ever adds up — there is no over-committed state.
 *
 * Gated on settings.showPoints by the caller (app/(tabs)/habits.tsx renders it
 * conditionally, same pattern as app/(tabs)/health.tsx's featureMedicine/MedicineTrayCard)
 * — an off-by-default opt-in offered in app/onboarding/features.tsx and Settings → Advanced
 * → Features. Points themselves always accumulate regardless of the flag (see
 * useHabitStore.ts's increment()), so turning this on later shows full history, not a fresh
 * start.
 *
 * Connections:
 *   Imports → components/Surface, components/BonsaiTree, components/CardHintNote,
 *             constants/theme, lib/useAppTheme, lib/i18n, lib/date, lib/bonsai,
 *             store/useHabitStore, store/useSettingsStore
 *   Used by → app/(tabs)/habits.tsx
 *   Data    → reads habits + habit_logs (health) and settings.lifetimeBonsaiPoints (growth);
 *             writes nothing itself — the counter is written by useHabitStore.ts's increment()
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import BonsaiTree from '@/components/BonsaiTree';
import CardHintNote from '@/components/CardHintNote';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { bonsaiState } from '@/lib/bonsai';
import { useHabitStore } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function BonsaiCard() {
  const theme = useAppTheme();
  const t = useT();
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const points = useSettingsStore((s) => s.lifetimeBonsaiPoints);

  const state = bonsaiState(habits, logs, points, todayStr());
  const stageLabel = t.bonsai.stages[state.stageKey];
  // Health tiers pick the caption — 'seed' (no points yet) is its own case since there's
  // nothing to be tended or neglected about a tree that hasn't been planted.
  const caption =
    state.points === 0
      ? t.bonsai.captionSeed
      : state.health >= 0.75
        ? t.bonsai.captionThriving
        : state.health >= 0.4
          ? t.bonsai.captionSteady
          : state.health > 0
            ? t.bonsai.captionLow
            : t.bonsai.captionWaiting;

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="leaf" size={18} color={theme.good} />
          <Text style={[styles.title, { color: theme.text }]}>{t.bonsai.title}</Text>
        </View>
        <Text style={[styles.points, { color: theme.textMuted }]}>{t.bonsai.pointsValue(state.points)}</Text>
      </View>

      <View style={styles.treeRow}>
        <BonsaiTree
          stage={state.stageKey}
          health={state.health}
          goodColor={theme.good}
          greyColor={theme.textMuted}
          size={104}
        />
        <View style={styles.treeInfo}>
          <Text style={[styles.stageLabel, { color: theme.text }]}>{stageLabel}</Text>
          <Text style={[styles.caption, { color: theme.textMuted }]}>{caption}</Text>
        </View>
      </View>

      <CardHintNote text={t.bonsai.hint} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: 18, fontFamily: Fonts.bold },
  points: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  treeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  treeInfo: { flex: 1, minWidth: 0, gap: 2 },
  stageLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  caption: { fontSize: FontSize.sm },
});
