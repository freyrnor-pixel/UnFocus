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
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/habits.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - The colored edge is the section `hue` (a solid domain accent) passed straight to
 *     `<Surface borderColor>` — the same colored-edge-on-neutral-fill language habits.tsx's
 *     domain cards already use (Decision: dropped whole-card tint, 2026-07-14). Because the
 *     box itself now carries the hue, rows inside it no longer need their own per-card
 *     `railColor` left edge — drop it at the call site to avoid double-coding.
 *   - Header is the shared `<SectionRail>` (gradient badge or dot + ALL-CAPS title + hairline
 *     rule) so the label + count stay consistent with the rest of the app; pass `right` through
 *     for a header-side control (e.g. a toggle). Top padding is tightened (Spacing.sm) so the
 *     header hugs the card's top edge and reads high on the card.
 *   - `domain` is optional and passes straight through to SectionRail (2026-07-26, "bring the
 *     card colour back"): pass it when the section has a real domain identity (Habits' own
 *     section, Plans' Whenever/Recurring/Shared) to get the small gradient badge instead of a
 *     flat dot. Omit it for sections keyed to an arbitrary hue instead of a domain (Plans'
 *     "Today"/weekday groups use `theme.accent`, which isn't a `Domain`).
 *   - `icon` (2026-07-27) overrides just the badge GLYPH while `domain` still drives its
 *     colour. Needed when a section borrows another domain's hue to stay visually distinct
 *     from its neighbours — Plans' Recurring section borrows `health` for the colour
 *     (`meal` until 2026-08-04; see `constants/colors.ts`'s card-identity addendum for why),
 *     and before this override it inherited whichever glyph came with that domain instead
 *     of "repeat". Reach for `icon` rather than switching `domain` on its own: the label
 *     and divider follow `hue`, so changing the domain to fix the glyph desyncs the badge
 *     colour from the rest of the header.
 *   - `contentStyle` spreads onto the inner content wrapper (below the header) for callers
 *     that need to override the default gap between rows.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import { Radius, Spacing } from '@/constants/theme';
import { Domain } from '@/lib/domainColor';

type Props = {
  /** Solid domain accent (getDomainColor(theme, domain).accent) — colors the header + card edge. */
  hue: string;
  /** Section's domain identity, if any — see the Edit notes above. */
  domain?: Domain;
  /** Override the badge glyph while keeping `domain`'s colour — forwarded to SectionRail. */
  icon?: React.ComponentProps<typeof SectionRail>['icon'];
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

export default function SectionCard({ hue, domain, icon, label, count, right, style, contentStyle, children }: Props) {
  return (
    <Surface borderColor={hue} style={[styles.card, style]}>
      <SectionRail hue={hue} domain={domain} icon={icon} label={label} count={count} right={right} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  // Decision 043 rule 2: Spacing.xl above every section. Padding is routed to the inner
  // content view by Surface, so the header pill + rows sit inset from the card edge.
  card: {
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  // The rows/empty state stack below the header, with the same inter-row gap the loose
  // sections used (Spacing.sm). SectionRail carries its own marginBottom, so no extra
  // top gap is added here.
  content: { gap: Spacing.sm },
});
