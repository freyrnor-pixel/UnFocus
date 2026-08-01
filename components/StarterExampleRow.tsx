/**
 * StarterExampleRow.tsx — a single "preview row" shown while a list is empty, styled to read
 * as an actual row from that list — leading icon + title + trailing meta pill — rather than a
 * sentence describing one. Optionally carries a real "+" add button (`onAdd`) so the example
 * is an actual opt-in try-it, not just an illustration.
 *
 * Connections:
 *   Imports → components/Badge, components/PressableScale, constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/habits.tsx, app/(tabs)/plans.tsx, app/(tabs)/health.tsx (all inside
 *             their StarterCard's `example` slot — app/(tabs)/shopping.tsx dropped its own
 *             two example rows 2026-07-28, see that file's StarterCard call), plus
 *             components/PlanTaskCard.tsx and components/HomeHabitsCard.tsx, which render
 *             it directly in their own in-card empty states (no StarterCard wrapper — a
 *             Surface inside a Surface would read as a nested panel; HomeShoppingCard
 *             dropped its own use of this the same day, for the same reason as its full
 *             /shopping screen)
 *   Data    → none — pure presentation; callers pass already-localized strings, a
 *             domain/semantic accent color (e.g. getDomainColor(theme, 'shop').accent),
 *             and (optionally) an `onAdd` callback that writes the example into the
 *             real store
 *
 * Edit notes:
 *   - **Styled as a real list row (2026-07-27, user report: the suggested-add row should be
 *     "designed the same as other rows in app")**: the fill is the same `rgba(accent, 0.05)`
 *     wash and the border the same `rgba(accent, 0.2)` that components/PlanTaskCard's
 *     `rowCard` uses for a live task, at the same padding — not the old neutral
 *     `surfaceMuted`/`theme.border` plate, which read as a callout box about a row instead of
 *     a row. `accent` therefore has to be the surrounding list's own domain accent; passing an
 *     arbitrary hue makes the suggestion look like it belongs to a different list.
 *   - **(2026-07-31, addendum A.4 rule 1) `accent` is a FILL/EDGE colour here, never ink.** The
 *     leading glyph and the "example" tag word used to be drawn in it; both are `textMuted`
 *     now, and the "+" is `theme.accent` (it is an action, and the app has one action colour).
 *     The row keeps every hue it had — wash, row edge, icon circle, tag chip, "+" button — so
 *     it still reads as belonging to its list. The reason is legibility at the collapsed
 *     four-hue set: Shopping's gold is 2.25:1 on white, so a 13px glyph and an 11px word drawn
 *     in it were the two least readable things on an empty screen.
 *   - `onAdd` is optional — omit it for a purely read-only preview (Habits' row does
 *     this: its four *real* one-tap add chips, rendered separately in StarterCard's
 *     `children`, already cover the same item, so a second "+" here would just be a
 *     redundant second way to do the same thing). When provided, the caller owns the
 *     actual store write AND its own haptic (`success()`) — this component only calls
 *     it, matching the house pattern (see app/(tabs)/habits.tsx's createHabit).
 *   - `meta`/`metaVariant` reuse components/Badge — keep meta text short (a count,
 *     a signed number, a recurrence word) so it reads as a pill, not a second sentence.
 *   - **`tag` replaced the caption line (2026-07-30)**: the "is this a real row?" ambiguity
 *     that this row's deliberate real-row styling creates used to be answered by a full-width
 *     uppercase "EXAMPLE TASKS" caption above it (StarterCard's `exampleLabel`, plus
 *     hand-rolled copies in PlanTaskCard/HomeHabitsCard). That cost a whole line on a card
 *     whose whole problem was already too many lines of teaching before any content — so the
 *     marker moved onto the row itself. Keep the copy to one word (`t.starters.exampleLabel`);
 *     it competes for width with the title, meta pill and "+" at 360px.
 *   - There used to be a `compact` chip variant for a `compact` StarterCard. Its only caller
 *     was components/EnergyMeter's disappearing empty-state explainer, which became a
 *     permanent one-line hint with no examples (2026-07-27) — the variant went with it.
 *   - `added` (2026-07-31, user report: tapping the "+" made the whole example vanish with no
 *     feedback of what happened): callers used to gate their StarterCard/example on a plain
 *     `list.length === 0`, so writing the example into the real store flipped that count to 1
 *     and unmounted the row in the same tick — see StarterCard's Edit notes for why that read
 *     as the example just disappearing rather than "added". Callers now keep the row mounted
 *     for the rest of that visit and pass `added` instead: the row dims (`opacity: 0.5`) and
 *     the "+" is replaced with a static, non-pressable checkmark — same geometry, so nothing
 *     reflows. `onAdd` is ignored while `added` is true (the row has nothing left to add).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/Badge';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, Radius, Spacing, rgba, HitSlop } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Leading glyph, shown inside a thin circle matching the app's row-checkbox sizing. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Row title — the example item itself (e.g. "Milk", "Headache"). */
  title: string;
  /**
   * Short "this is an example, not a real row" marker (`t.starters.exampleLabel`), drawn as a
   * small chip between the icon and the title. Replaces the full-width uppercase caption line
   * that used to sit above these rows — see the Edit notes.
   */
  tag?: string;
  /** Optional trailing pill (e.g. "Weekly", "+1", "3/5"). */
  meta?: string;
  metaVariant?: 'neutral' | 'success' | 'warning' | 'danger';
  /** The surrounding list's domain accent — drives the row wash and the three edges (row,
   *  icon circle, tag chip, "+" button). Never the glyph or the text: see the A.4 note. */
  accent: string;
  /** When provided, renders a trailing "+" button that writes this example into the
   *  real store — omit for a read-only preview (see Edit notes). */
  onAdd?: () => void;
  /** Accessibility-label prefix for the add button, e.g. "Add" → "Add Milk". */
  addLabel?: string;
  /** Already written to the real store this visit — dims the row and swaps the "+" for a
   *  static checkmark instead of unmounting (see Edit notes). */
  added?: boolean;
};

export default function StarterExampleRow({ icon, title, tag, meta, metaVariant = 'neutral', accent, onAdd, addLabel, added }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, { backgroundColor: rgba(accent, 0.05), borderColor: rgba(accent, 0.2) }, added && styles.rowAdded]}>
      {/* A.4 rule 1: the hue is the row's wash + edges (a fill channel). The glyph and the
          "example" word are neutral ink — see the header note. */}
      <View style={[styles.iconWrap, { borderColor: accent }]}>
        <Ionicons name={icon} size={13} color={theme.textMuted} />
      </View>
      {tag ? (
        <View style={[styles.tag, { borderColor: rgba(accent, 0.45) }]}>
          <Text style={[styles.tagText, { color: theme.textMuted }]} numberOfLines={1}>{tag}</Text>
        </View>
      ) : null}
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {meta ? <Badge label={meta} variant={metaVariant} /> : null}
      {added ? (
        <View style={[styles.addBtn, { borderColor: theme.textMuted }]}>
          <Ionicons name="checkmark" size={14} color={theme.textMuted} />
        </View>
      ) : onAdd ? (
        <PressableScale
          onPress={onAdd}
          scaleTo={0.9}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={addLabel ? `${addLabel} ${title}` : title}
          style={[styles.addBtn, { borderColor: accent }]}
        >
          <Ionicons name="add" size={14} color={theme.accent} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Geometry + padding deliberately mirror PlanTaskCard's `rowCard` — see the Edit notes.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  // Already added this visit — dimmed, not a fifth row style, just a faded version of the
  // same one (see the `added` Edit note).
  rowAdded: {
    opacity: 0.5,
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
    // minWidth:0 so the title yields to the tag/meta/add cluster instead of pushing them off
    // the row — see AGENTS.md's wrap-audit lesson about minWidth on flex children.
    minWidth: 0,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
  // The "Example" marker (2026-07-30) — a small outlined chip that replaced the full-width
  // uppercase caption line above these rows. flexShrink:0 keeps it whole; the title shrinks
  // first, since a clipped marker would defeat the point of having one.
  tag: {
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.3 },
  addBtn: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
