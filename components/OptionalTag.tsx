/**
 * OptionalTag.tsx — small "Opt" badge marking a field as not required to save.
 *
 * Sits beside a field's label (or is embedded via FormControls.Input's `optional`
 * prop) in a create/edit form, so a user scanning the form can tell at a glance
 * which fields they can skip. Deliberately just a muted bordered chip with a
 * short word/abbreviation — not a sentence — so it reads as a tag, not copy.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/i18n
 *   Used by → components/FormControls.tsx (Input's `optional` prop), app/habit-form.tsx,
 *             app/medicine-form.tsx, app/health-form.tsx, components/TaskCard.tsx —
 *             any label row for a field that isn't required to save
 *   Data    → none (purely presentational)
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';

export default function OptionalTag() {
  const theme = useAppTheme();
  const t = useT();
  return (
    <Text
      style={[
        styles.tag,
        { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      {t.optionalTag}
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: {
    fontSize: FontSize.xs - 1,
    fontFamily: Fonts.semibold,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    overflow: 'hidden',
  },
});
