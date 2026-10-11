/**
 * BudgetBar.tsx — the Budget card's one bar: spent of the month's budget, with a mark for today.
 *
 * V2 (2026-10-11): the maintainer asked for Budget to read like Home's Energy card — one slim
 * line you take in at a glance, the period visible, the per-day figures under it. The fill is
 * what has been spent; the thin mark is where today sits in the payday-to-payday period. Fill
 * left of the mark = spending slower than the period; right of it = faster. Neither is coloured
 * `bad` — DESIGN_RULES.md rule 23: a budget you are ahead of is information, not a failure.
 *
 * Connections:
 *   Imports → react-native, constants/theme, lib/useAppTheme, lib/i18n
 *   Used by → app/(tabs)/shopping.tsx (the `shopBudget` card)
 *   Data    → none (props only; the maths is lib/budget.ts's computeSpendPace)
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';

type Props = {
  spent: number;
  budget: number;
  daysElapsed: number;
  periodLength: number;
  /** The fill colour — the screen's hue, so the bar belongs to Handle. */
  color: string;
};

/** Pure: the two fractions the bar draws, both clamped to [0, 1]. Exported for the test. */
export function budgetBarFractions(spent: number, budget: number, daysElapsed: number, periodLength: number) {
  const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
  return {
    fill: budget > 0 ? clamp(spent / budget) : 0,
    today: periodLength > 0 ? clamp(daysElapsed / periodLength) : 0,
  };
}

export default function BudgetBar({ spent, budget, daysElapsed, periodLength, color }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { fill, today } = budgetBarFractions(spent, budget, daysElapsed, periodLength);
  const left = budget - spent;
  const daysLeft = Math.max(0, periodLength - daysElapsed);
  const line =
    left >= 0
      ? t.budget.leftWithDays(String(Math.round(left)), daysLeft)
      : t.budget.aboveBy(String(Math.round(-left)));

  return (
    <View style={styles.wrap} accessible accessibilityLabel={line}>
      <View style={[styles.track, { backgroundColor: theme.surfaceInset }]}>
        <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
        <View style={[styles.today, { left: `${today * 100}%`, backgroundColor: theme.text }]} />
      </View>
      <Text style={[styles.line, { color: theme.textMuted }]} numberOfLines={1}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  track: { height: 10, borderRadius: Radius.sm, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: Radius.sm },
  today: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  line: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
});
