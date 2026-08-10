/**
 * StarterExampleRow.tsx — a single "preview row" shown while a list is empty: the SHAPE of a row
 * from that list (leading icon + title + trailing meta pill) drawn as a **provisional sketch**,
 * so it reads as a suggestion rather than as something already in the list. Optionally carries a
 * real "+" add button (`onAdd`) so the example is an actual opt-in try-it, not just an
 * illustration.
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
 *   - **⚠️ REVERSED 2026-08-10 — this row is deliberately NOT a real row any more.** User
 *     report: "Examples are not visible examples, they look like a part of the card or an
 *     active task, not as a temporary thing."
 *     The previous rule (2026-07-27, from the opposite report — "designed the same as other
 *     rows in app") made the fill the same `rgba(accent, 0.05)` wash and the border the same
 *     `rgba(accent, 0.2)` that components/PlanTaskCard's `rowCard` uses for a LIVE task, at the
 *     same padding, with a full-strength `theme.text` semibold title. That succeeded completely:
 *     it became indistinguishable from a real row, and the only thing left saying otherwise was
 *     a 10px "Example" pill competing for width with the title at 360px.
 *     What it is now — every channel says provisional, and none of them says "content":
 *       • **dashed** border in neutral `theme.border` (the same `borderStyle: 'dashed'` treatment
 *         PlanTaskCard's own ghost add-row already uses for "this isn't here yet")
 *       • **no fill** — transparent, so it never reads as a filled row on the card
 *       • title in `theme.textMuted`, **italic** — matching StarterCard's own explainer voice
 *       • icon ring in `theme.border`, not the accent
 *     `accent` survives for exactly two things: the "+" button (a real action, in the app's one
 *     action colour) and the tag chip's edge, so the suggestion still points at its own list.
 *     **Don't "restore" the real-row styling by citing the 2026-07-27 note** — that note is
 *     kept above precisely so the reversal is legible as a decision, not as drift.
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
  // Dashed + unfilled + neutral: a sketch of a row, not a row. See the 2026-08-10 reversal in
  // the Edit notes before making any of this look "finished" again.
  return (
    <View style={[styles.row, { borderColor: theme.border }, added && styles.rowAdded]}>
      {/* A.4 rule 1: the glyph and the "example" word are neutral ink. The ring is neutral too
          now — the accent survives only on the tag's edge and the "+" (a real action). */}
      <View style={[styles.iconWrap, { borderColor: theme.border }]}>
        <Ionicons name={icon} size={13} color={theme.textMuted} />
      </View>
      {tag ? (
        <View style={[styles.tag, { borderColor: rgba(accent, 0.45) }]}>
          <Text style={[styles.tagText, { color: theme.textMuted }]} numberOfLines={1}>{tag}</Text>
        </View>
      ) : null}
      <Text style={[styles.title, { color: theme.textMuted }]} numberOfLines={1}>
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
  // Geometry + padding still mirror PlanTaskCard's `rowCard` — the example has to be the same
  // SHAPE as the thing it's an example of, or it stops teaching anything. What changed
  // 2026-08-10 is the finish: `dashed` and no `backgroundColor`, so the shape reads as an
  // outline waiting to be filled rather than as a row that already exists.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
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
    // Italic, and drawn in textMuted at the call site — the same voice StarterCard's explainer
    // text uses, which is what ties the example to the teaching card rather than to the list.
    fontStyle: 'italic',
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
