/**
 * SectionCard.tsx — a boxed list section: SectionRail header + content inside one card.
 *
 * The "one card per section" grouping primitive (2026-07-17). Where the color-rail redesign
 * left each section as a loose header pill floating above a stack of cards on the bare
 * backdrop — which read as scattered, unrelated boxes — SectionCard draws a single bordered
 * glass Surface around the whole section (its `<SectionRail>` header + its rows), with a
 * hue-colored edge tying the box to the section's domain color. So "Today", "Whenever" and
 * "Recurring" (and the Health screen's sections, etc.) each read as one clearly-bounded group
 * instead of a run of separated cards.
 *
 * Connections:
 *   Imports → components/Surface, components/SectionRail, constants/theme
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/health.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - The colored edge is the section `hue` (a solid domain accent) passed straight to
 *     `<Surface borderColor>` — the same colored-edge-on-neutral-fill language health.tsx's
 *     domain cards already use (Decision: dropped whole-card tint, 2026-07-14). Because the
 *     box itself now carries the hue, rows inside it no longer need their own per-card
 *     `railColor` left edge — drop it at the call site to avoid double-coding.
 *   - Header is the shared `<SectionRail>` so the tinted-pill label + count stay consistent
 *     with the rest of the app; pass `right` through for a header-side control (e.g. a toggle).
 *   - `contentStyle` spreads onto the inner content wrapper (below the header) for callers
 *     that need to override the default gap between rows.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import { Radius, Spacing } from '@/constants/theme';

type Props = {
  /** Solid domain accent (getDomainColor(theme, domain).accent) — colors the header + card edge. */
  hue: string;
  label: string;
  /** Optional item tally shown after the label. */
  count?: number;
  /** Optional control rendered flush-right in the header (e.g. a toggle). */
  right?: React.ReactNode;
  /** Extra style for the outer card (margin, etc.). */
  style?: StyleProp<ViewStyle>;
  /** Extra style for the inner content wrapper below the header. */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function SectionCard({ hue, label, count, right, style, contentStyle, children }: Props) {
  return (
    <Surface borderColor={hue} style={[styles.card, style]}>
      <SectionRail hue={hue} label={label} count={count} right={right} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  // Decision 043 rule 2: Spacing.xl above every section. Padding is routed to the inner
  // content view by Surface, so the header pill + rows sit inset from the card edge.
  card: { marginTop: Spacing.xl, borderRadius: Radius.md, padding: Spacing.md },
  // The rows/empty state stack below the header, with the same inter-row gap the loose
  // sections used (Spacing.sm). SectionRail carries its own marginBottom, so no extra
  // top gap is added here.
  content: { gap: Spacing.sm },
});
