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
 *   Imports → components/Surface, components/SectionRail, components/Collapsible,
 *             components/CardCollapseToggle, constants/theme, lib/collapsedCards,
 *             lib/useCollapsedCard
 *   Used by → app/plans.tsx, app/habits.tsx
 *   Data    → settings.collapsedCards, but ONLY when a caller passes `collapseKey` (the
 *             foldable variant is a separate component so the plain one reads no store)
 *
 * Edit notes:
 *   - **`collapseKey` makes a section foldable (2026-08-14), and only a singleton may take one.**
 *     The id is the storage key, so a card drawn one per day or per group has nothing stable to
 *     store — on the To-do tab that means Today/Whenever/Recurring opt in and the per-day and
 *     per-group cards deliberately do not. Callers without the prop are untouched: no chevron,
 *     no `Collapsible`, and no subscription to the settings store (see
 *     `CollapsibleSectionCard`'s own note for why that split is a component and not an `if`).
 *   - **The card edge is the SCREEN's hue, not the section's (card design reset, 2026-08-05).**
 *     This used to pass `hue` straight to `<Surface borderColor>`, which is now an override of
 *     the one-colour-per-screen border and shipped a maroon "Recurring" card next to a blue
 *     "Whenever" one on the To-do tab. `hue` now stops at the SectionRail header — badge,
 *     label, divider — and the card inherits like everything else. Rows inside still don't
 *     need a per-card `railColor` left edge; that part of the 2026-07-17 note stands.
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
import Collapsible from '@/components/Collapsible';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import { Radius, Spacing } from '@/constants/theme';
import { Domain } from '@/lib/domainColor';
import { CardId } from '@/lib/collapsedCards';
import { useCollapsedCard } from '@/lib/useCollapsedCard';

type Props = {
  /**
   * Solid domain accent (getDomainColor(theme, domain).accent) — colours the header rail's
   * badge, label and divider.
   *
   * **It no longer colours the card EDGE (card design reset, 2026-08-05).** The border is one
   * colour per screen now (lib/screenColor.ts), so a section passing its own hue to
   * `Surface borderColor` would override that and put a different-coloured card on the screen —
   * which is exactly what it did: the To-do tab drew a blue "Whenever" card next to a maroon
   * "Recurring" one, because `repeatingHue` borrows the health token for its badge. The badge
   * keeps that borrowed colour (it's a glyph plate, and lib/domainColor.ts is still the system
   * for those); the card around it now inherits its screen's hue like every other card.
   */
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
  /**
   * Makes the section foldable, remembered across launches under this id (2026-08-14).
   *
   * Omit it and the card behaves exactly as it always has — always open, no chevron, no store
   * read. Only a SINGLETON section can take one: the id is the storage key, so a card drawn one
   * per day or per group has nothing stable to store. See lib/collapsedCards.ts.
   */
  collapseKey?: CardId;
  children: React.ReactNode;
};

export default function SectionCard({
  hue,
  domain,
  icon,
  label,
  count,
  right,
  style,
  contentStyle,
  collapseKey,
  children,
}: Props) {
  // No `borderColor` — the card inherits the SCREEN's hue (see the `hue` prop's doc). `hue`
  // still reaches the rail below, which is where a section's own identity lives now.
  return collapseKey ? (
    <CollapsibleSectionCard
      hue={hue}
      domain={domain}
      icon={icon}
      label={label}
      count={count}
      right={right}
      style={style}
      contentStyle={contentStyle}
      collapseKey={collapseKey}
    >
      {children}
    </CollapsibleSectionCard>
  ) : (
    <Surface style={[styles.card, style]}>
      <SectionRail hue={hue} domain={domain} icon={icon} label={label} count={count} right={right} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Surface>
  );
}

/**
 * The foldable variant, split out so the plain one calls no hook at all.
 *
 * A branch rather than a `collapseKey ?? ''` default because `useCollapsedCard` subscribes to
 * the settings store: every per-day and per-group SectionCard on the To-do tab would otherwise
 * re-render on any collapse anywhere, for a feature it does not have. Rules of hooks means the
 * split has to be a separate component, not an `if` inside one.
 */
function CollapsibleSectionCard({
  hue,
  domain,
  icon,
  label,
  count,
  right,
  style,
  contentStyle,
  collapseKey,
  children,
}: Props & { collapseKey: CardId }) {
  const [collapsed, toggleCollapsed] = useCollapsedCard(collapseKey);

  return (
    <Surface style={[styles.card, style]}>
      <SectionRail
        hue={hue}
        domain={domain}
        icon={icon}
        label={label}
        count={count}
        // The chevron goes AFTER whatever the caller put in the header, so a section's own
        // control keeps the position it has always had and the fold sits outermost — the same
        // ordering components/MedicineTrayCard.tsx uses for its reminder bell.
        // Wrapped in a row: SectionRail's own `right` slot is a bare View, so it is a COLUMN by
        // default and two children would stack. Only wrapped when the caller supplied one —
        // otherwise the chevron goes in alone and needs no row of its own.
        right={
          right ? (
            <View style={styles.headerActions}>
              {right}
              <CardCollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} cardLabel={label} />
            </View>
          ) : (
            <CardCollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} cardLabel={label} />
          )
        }
      />
      {/* The count stays on the rail while collapsed, which is the point: a folded section still
          says how much is in it. */}
      <Collapsible open={!collapsed}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </Collapsible>
    </Surface>
  );
}

const styles = StyleSheet.create({
  // **No vertical margin (2026-08-08).** This carried `marginTop: Spacing.xl` (Decision 043
  // rule 2) until the spacing pass — the screen's content container owns the gap between
  // stacked cards now (`SCREEN_GAP`, constants/theme.ts). A card declaring its own margin is
  // what produced five different gaps down one column: a card that remembered got 32px, the
  // ones that forgot (the sub-screen links) got 0. Padding is routed to the inner content
  // view by Surface, so the header pill + rows sit inset from the card edge.
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  // The rows/empty state stack below the header, with the same inter-row gap the loose
  // sections used (Spacing.sm). SectionRail carries its own marginBottom, so no extra
  // top gap is added here.
  content: { gap: Spacing.sm },
  // Caller's own header control + the fold chevron, side by side. `Spacing.xs` rather than `sm`
  // because both children already carry a MIN_TAP_TARGET box, so the visible gap is wider than
  // the number suggests.
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
