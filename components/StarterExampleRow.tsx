/**
 * StarterExampleRow.tsx — a single read-only "preview row" shown inside a StarterCard
 * (components/StarterCard.tsx), styled to read as an actual row from that list —
 * leading icon + title + trailing meta pill — rather than a sentence describing one.
 *
 * Connections:
 *   Imports → components/Badge, constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/habits.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx, components/EnergyMeter.tsx (all inside their
 *             StarterCard's `example` slot)
 *   Data    → none — pure presentation; callers pass already-localized strings and a
 *             domain/semantic accent color (e.g. getDomainColor(theme, 'shop').accent)
 *
 * Edit notes:
 *   - Deliberately non-interactive (no Pressable) — this is a preview of what a real
 *     row looks like once added, not a shortcut to add one. Habits' one-tap starter
 *     chips (rendered separately, in StarterCard's `children` slot) are the actual
 *     add affordance.
 *   - `meta`/`metaVariant` reuse components/Badge — keep meta text short (a count,
 *     a signed number, a recurrence word) so it reads as a pill, not a second sentence.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/Badge';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Leading glyph, shown inside a thin circle matching the app's row-checkbox sizing. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Row title — the example item itself (e.g. "Milk", "Headache"). */
  title: string;
  /** Optional trailing pill (e.g. "Weekly", "+1", "3/5"). */
  meta?: string;
  metaVariant?: 'neutral' | 'success' | 'warning' | 'danger';
  /** Domain/semantic accent for the icon + its circle border. */
  accent: string;
};

export default function StarterExampleRow({ icon, title, meta, metaVariant = 'neutral', accent }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <View style={[styles.iconWrap, { borderColor: accent }]}>
        <Ionicons name={icon} size={13} color={accent} />
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {meta ? <Badge label={meta} variant={metaVariant} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
});
