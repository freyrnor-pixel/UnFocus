/**
 * StarterExampleRow.tsx — a single "preview row" shown inside a StarterCard
 * (components/StarterCard.tsx), styled to read as an actual row from that list —
 * leading icon + title + trailing meta pill — rather than a sentence describing one.
 * Optionally carries a real "+" add button (`onAdd`) so the example is an actual
 * opt-in try-it, not just an illustration.
 *
 * Connections:
 *   Imports → components/Badge, components/PressableScale, constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/habits.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx, components/EnergyMeter.tsx (all inside their
 *             StarterCard's `example` slot)
 *   Data    → none — pure presentation; callers pass already-localized strings, a
 *             domain/semantic accent color (e.g. getDomainColor(theme, 'shop').accent),
 *             and (optionally) an `onAdd` callback that writes the example into the
 *             real store
 *
 * Edit notes:
 *   - `onAdd` is optional — omit it for a purely read-only preview (Habits' row does
 *     this: its four *real* one-tap add chips, rendered separately in StarterCard's
 *     `children`, already cover the same item, so a second "+" here would just be a
 *     redundant second way to do the same thing). When provided, the caller owns the
 *     actual store write AND its own haptic (`success()`) — this component only calls
 *     it, matching the house pattern (see app/(tabs)/habits.tsx's createHabit).
 *   - `meta`/`metaVariant` reuse components/Badge — keep meta text short (a count,
 *     a signed number, a recurrence word) so it reads as a pill, not a second sentence.
 *   - `compact` (2026-07-27) is the chip form used by a `compact` StarterCard — same row,
 *     just hugging its content (smaller circles/type, `alignSelf:'flex-start'`) so two
 *     examples fit on one wrapped line. Only Energy's explainer uses it: its examples sit
 *     under a meter, not at the head of a list, so full-width preview rows made the note
 *     taller than the card it explains.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/Badge';
import PressableScale from '@/components/PressableScale';
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
  /** When provided, renders a trailing "+" button that writes this example into the
   *  real store — omit for a read-only preview (see Edit notes). */
  onAdd?: () => void;
  /** Accessibility-label prefix for the add button, e.g. "Add" → "Add Milk". */
  addLabel?: string;
  /** Chip sizing for a StarterCard in `compact` mode — hugs its content instead of
   *  spanning the row, so several fit side by side. See Edit notes. */
  compact?: boolean;
};

export default function StarterExampleRow({ icon, title, meta, metaVariant = 'neutral', accent, onAdd, addLabel, compact }: Props) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        compact && styles.rowCompact,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      <View style={[styles.iconWrap, compact && styles.iconWrapCompact, { borderColor: accent }]}>
        <Ionicons name={icon} size={compact ? 11 : 13} color={accent} />
      </View>
      {/* Compact swaps the whole title style rather than layering on top of it — `title`'s
          `flex: 1` (fill the row) and the chip's "hug your text" sizing are contradictory, and
          merging the two shorthand/longhand flex forms resolved to a zero-width text box. */}
      <Text style={[compact ? styles.titleCompact : styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {meta ? <Badge label={meta} variant={metaVariant} /> : null}
      {onAdd ? (
        <PressableScale
          onPress={onAdd}
          scaleTo={0.9}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={addLabel ? `${addLabel} ${title}` : title}
          style={[styles.addBtn, compact && styles.addBtnCompact, { borderColor: accent }]}
        >
          <Ionicons name="add" size={compact ? 12 : 14} color={accent} />
        </PressableScale>
      ) : null}
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
  // Compact (chip) sizing — hugs its content so a couple of examples sit side by side on one
  // line instead of stacking as two full-width rows (2026-07-27, Energy's explainer).
  rowCompact: {
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 1,
    gap: Spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: { width: 18, height: 18, borderWidth: 1 },
  title: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
  // Standalone (not merged over `title`) — sizes to its own text so the chip hugs it.
  titleCompact: { flexShrink: 1, fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  addBtn: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnCompact: { width: 18, height: 18, borderWidth: 1 },
});
