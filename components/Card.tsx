/**
 * Card.tsx — the only thing in the app that draws a card.
 *
 * Maintainer, 2026-08-21: *"It just feels like a bunch of cards per screen. No order, no
 * logic."* The measured cause was that nothing owned a card's anatomy: **7 components drew a
 * card header, 9 of those headers were hand-rolled, and the trailing controls came out in 13
 * distinct orders** — not because anyone got it wrong, but because the order was decided
 * independently at each site and two of the shared components disagreed by construction (Me's
 * cards put ⋮ before the fold; `SectionCard` injected the fold *before* the caller's controls).
 *
 * So a caller no longer describes a card. It names one:
 *
 *     <Card id="todoToday" count={todayList.length}>…</Card>
 *
 * Everything else — hue, badge, glyph, title, whether it folds, whether it grows to fill the
 * screen, whether it rests open — is read from lib/cardRegistry.ts. There is no prop for any of
 * it, which is what makes a fourteenth order unspellable rather than merely discouraged.
 *
 * **The load-bearing guard is a BAN, not an allowlist.** No file outside this one may import
 * components/CardCollapseToggle.tsx or components/CardExpandButton.tsx
 * (`lib/__tests__/cardAnatomy.test.ts`). One assertion, and it is stronger than every list the
 * previous passes maintained: those listed the cards that were already right, so a new card was
 * compliant by default. This one says where the controls may be built at all.
 *
 * Connections:
 *   Imports → components/Surface, components/SectionRail, components/Collapsible,
 *             components/CardCollapseToggle, components/CardExpandButton, constants/theme,
 *             lib/cardRegistry, lib/useCollapsedCard, lib/useCardExpand, lib/screenColor,
 *             lib/useAppTheme
 *   Used by → every card on every tab; components/SectionCard.tsx (via `CardShell`, until it
 *             is retired)
 *   Data    → settings.collapsedCards, for cards whose registry entry folds
 *
 * Edit notes:
 *   - **The trailing cluster is `{controls}` → fold → ⤢, in that order, always.** `controls` is
 *     the caller's OWN controls and nothing else — a bell, a lock, a ⋮. The fold yields the
 *     outermost slot to the ⤢ because the maintainer's rule is that the full-screen button
 *     lands in the card's actual top-right corner on every surface.
 *   - **Closed is a bare header.** The rail's hairline follows the body (`divider={!collapsed}`)
 *     and the card's bottom inset drops to match its top one, so a folded card is its header and
 *     nothing else *by construction* rather than by each caller remembering.
 *   - `CardShell` is exported for exactly one caller, components/SectionCard.tsx, so that
 *     component can be reimplemented on this one with no visual change before it dies. It is not
 *     a public escape hatch: a new surface takes `Card` and an entry in the registry.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import Collapsible from '@/components/Collapsible';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import CardExpandButton from '@/components/CardExpandButton';
import { Radius, Spacing } from '@/constants/theme';
import type { Domain } from '@/lib/domainColor';
import { CardKey, cardSpec } from '@/lib/cardRegistry';
import type { CardId } from '@/lib/collapsedCards';
import type { ExpandableCardId } from '@/lib/expandableCards';
import { getScreenColor } from '@/lib/screenColor';
import { useCardExpand } from '@/lib/useCardExpand';
import { useCollapsedCard } from '@/lib/useCollapsedCard';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type CardProps = {
  id: CardKey;
  /** Optional tally shown after the title. A size, never a score. */
  count?: number | { left: number; total: number };
  /** The caller's OWN header controls — a bell, a lock, a ⋮. Never a fold or a ⤢. */
  controls?: React.ReactNode;
  /** Drawn inside another card, so this one draws no card of its own. */
  embedded?: boolean;
  /** Extra style for the inner content wrapper below the header. */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function Card({ id, count, controls, embedded, contentStyle, children }: CardProps) {
  const t = useT();
  const theme = useAppTheme();
  const spec = cardSpec(id);
  // Both hooks run unconditionally, unlike SectionCard's split-by-component dance. That split
  // existed because a per-day section would otherwise subscribe to the settings store; a Card is
  // a singleton by definition (a section drawn one-per-row of user data is not a Card at all),
  // so there is nothing here to protect.
  const [collapsed, toggleCollapsed] = useCollapsedCard(id as CardId);
  const expand = useCardExpand(id as ExpandableCardId);

  const folds = spec.fold === 'persisted';
  const expands = spec.expand === 'surface';
  const label = spec.title(t);

  const shell = (
    <CardShell
      hue={getScreenColor(theme, spec.hue).base}
      domain={spec.domain}
      icon={spec.icon}
      badgeHue={spec.badgeHue}
      label={label}
      count={count}
      embedded={embedded}
      contentStyle={contentStyle}
      collapsed={folds ? collapsed : undefined}
      onToggleCollapse={folds ? toggleCollapsed : undefined}
      // Pressing a card's NAME opens it full screen, which is what the four Me cards did with a
      // hand-rolled PressableScale around their badge-and-title cluster. The rail has had a slot
      // for exactly this since 2026-08-10; wiring it here means every expandable card gets it,
      // rather than the four that remembered.
      onLabelPress={expands ? expand.onExpand : undefined}
      controls={controls}
      afterFold={
        expands ? (
          <CardExpandButton expanded={expand.expanded} onExpand={expand.onExpand} onCollapse={expand.onCollapse} />
        ) : null
      }
    >
      {children}
    </CardShell>
  );

  // The ref goes on the OUTERMOST view or the expansion animates from the wrong box.
  // `collapsable={false}` keeps Android from flattening it away and leaving nothing to measure.
  if (!expands) return shell;
  return (
    <View ref={expand.ref} collapsable={false}>
      {shell}
    </View>
  );
}

type ShellProps = {
  hue: string;
  domain?: Domain;
  icon?: React.ComponentProps<typeof SectionRail>['icon'];
  badgeHue?: boolean;
  label: string;
  count?: number | { left: number; total: number };
  onLabelPress?: () => void;
  /** The caller's own header controls — drawn first, before the fold. */
  controls?: React.ReactNode;
  /** Drawn after the fold, i.e. outermost. The ⤢, and nothing else. */
  afterFold?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  embedded?: boolean;
  /** Which rung of the heading ladder this card's title is. See SectionRail's `tier`. */
  tier?: 'card' | 'sub';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * The card's geometry and header, with no knowledge of the registry.
 *
 * Exported for components/SectionCard.tsx only — see the edit notes. `controls` here is the
 * FULL trailing cluster (the fold is inserted by this component, between the caller's controls
 * and whatever the caller put last), because that is the one ordering both callers share.
 */
export function CardShell({
  hue,
  domain,
  icon,
  badgeHue,
  label,
  count,
  onLabelPress,
  controls,
  afterFold,
  collapsed,
  onToggleCollapse,
  embedded = false,
  tier = 'card',
  style,
  contentStyle,
  children,
}: ShellProps) {
  const Shell = embedded ? View : Surface;
  const folds = !!onToggleCollapse;
  const isClosed = folds && !!collapsed;

  const rail = (
    <SectionRail
      hue={hue}
      domain={domain}
      icon={icon}
      badgeHue={badgeHue}
      label={label}
      count={count}
      // The middle rung of the heading ladder: 20 with a badge. A card is not a group heading
      // (24, no badge) and not a section inside one (17, a dot) — see SectionRail's `tier`.
      tier={tier}
      onLabelPress={onLabelPress}
      // The hairline follows the BODY: the rule is what ties a header to the content under it,
      // so a folded card drawing one draws it over nothing.
      divider={!isClosed}
      right={
        <>
          {/* ⚠️ **The caller's own controls, then the fold, then the ⤢ — always.** The rule has
              been stated in five files since 2026-08-20 and `SectionCard` implemented the
              opposite, putting the chevron first: the Katalog card came out `fold → camera →
              lock → ⤢` where the rule asks for `camera → lock → fold → ⤢`. Correcting it used
              to mean moving the chevron on every card at once, which is why it was pinned as-is
              rather than fixed. There is one place to correct now. The pair reads "how much of
              this", then "how big is this", and the ⤢ lands in the card's actual corner. */}
          {controls}
          {folds && (
            <CardCollapseToggle collapsed={!!collapsed} onToggle={onToggleCollapse!} cardLabel={label} />
          )}
          {afterFold}
        </>
      }
    />
  );

  const body = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <Shell style={[styles.card, isClosed && styles.cardCollapsed, embedded && styles.cardEmbedded, style]}>
      {rail}
      {folds ? <Collapsible open={!collapsed}>{body}</Collapsible> : body}
    </Shell>
  );
}

/**
 * The fold chevron, for the one thing that is NOT a card: a SECTION drawn one-per-row of user
 * data (components/WeekListCard.tsx's per-list card, and the monthly-list card beside it).
 *
 * The registry cannot name those — an id built from a list id accumulates entries for lists that
 * no longer exist, which is lib/collapsedCards.ts's singleton rule — so their fold is local
 * state and they cannot go through `Card`. This is the one door out of the import ban, and it is
 * named for what it is so a card header cannot reach for it by mistake. **There is deliberately
 * no matching export for the ⤢**: a section rides its parent card's.
 */
export { default as SectionFoldToggle } from '@/components/CardCollapseToggle';

const styles = StyleSheet.create({
  // No vertical margin: the screen's content container owns the gap between stacked cards
  // (`SCREEN_GAP`, constants/theme.ts).
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  content: { gap: Spacing.sm },
  // Closed, the bottom inset matches the top one — padding reserved for rows that are not drawn
  // is just a gap.
  cardCollapsed: { paddingBottom: Spacing.sm },
  // `embedded`: the OUTER card already inset this content from the screen edge, and a second
  // horizontal inset is the "three stacked paddings" shape the wrap audit keeps finding.
  cardEmbedded: { paddingHorizontal: 0 },
});
