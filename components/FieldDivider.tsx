/**
 * FieldDivider.tsx — plain hairline rule separating distinct fields inside one edit box.
 *
 * Unlike components/SectionDivider.tsx (a decorative rule-mark-rule flanker between
 * whole cards/sections), this is the same bare `theme.border` line app/settings.tsx has
 * long used between rows inside one ExpandableCard/Surface — pulled out into a shared
 * component so app/habit-form.tsx, app/medicine-form.tsx, app/health-form.tsx and
 * components/TaskCard.tsx's editor don't each hand-roll their own copy.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → app/habit-form.tsx, app/medicine-form.tsx, app/health-form.tsx,
 *             components/TaskCard.tsx (between field groups in the expanded editor)
 *   Data    → none (purely presentational)
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function FieldDivider({ style }: Props) {
  const theme = useAppTheme();
  return <View style={[styles.rule, { backgroundColor: theme.border }, style]} />;
}

const styles = StyleSheet.create({
  rule: {
    height: 1,
    marginVertical: Spacing.sm,
  },
});
