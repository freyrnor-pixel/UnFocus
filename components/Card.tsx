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
 *             components/CardCollapseToggle, constants/theme,
 *             lib/cardRegistry, lib/useCollapsedCard, lib/useCardExpand, lib/screenColor,
 *             lib/useAppTheme
 *   Used by → every card on every tab; components/SectionCard.tsx (via `CardShell`, until it
 *             is retired)
 *   Data    → settings.collapsedCards, for cards whose registry entry folds
 *
 * Edit notes:
 *   - ⚠️ **There is no ⤢ in a card header any more (2026-08-22).** Maintainer: *"Remove all full
 *     screen buttons, instead user just presses the title."* The rail has carried
 *     `onLabelPress` since 2026-08-10 and this file has wired every expandable card's title to
 *     `expand.onExpand` since the registry landed — so the button was a second control for a
 *     thing the title already did, and it was the widest item in the cluster. Deleting it is
 *     the whole change: the measure ref, the geometry and `useCardExpand` are untouched,
 *     because none of them care which control fires.
 *     `components/CardExpandButton.tsx` still exists — the expanded PANE draws one as its close
 *     control (components/CardExpandHost.tsx). It is a card header that may not have one, and
 *     the import ban is what keeps that true.
 *   - **The trailing cluster is `{controls}` → fold, in that order, always.** `controls` is the
 *     caller's OWN controls and nothing else — a bell, a lock, a ⋮. The fold is outermost, in
 *     the card's actual top-right corner, which is where the ⤢ used to land.
 *   - **Closed is a bare header.** Three things follow the body rather than the card: the rail's
 *     hairline (`divider={!collapsed}`), the GAP the rail reserves under itself (`railClosed`,
 *     2026-08-24) and the card's bottom inset (`cardCollapsed`) — so a folded card is its header
 *     and nothing else *by construction* rather than by each caller remembering. The middle one
 *     was missed until a user reported that *"titles are not vertically centered"*: 8px of the
 *     rail's own margin plus 8px of card padding sat under a header with nothing between them,
 *     which put every closed card's title 4px above its centre.
 *   - `CardShell` is exported for exactly one caller, components/SectionCard.tsx, so that
 *     component can be reimplemented on this one with no visual change before it dies. It is not
 *     a public escape hatch: a new surface takes `Card` and an entry in the registry.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import Collapsible from '@/components/Collapsible';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import { MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
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
  /**
   * Ref onto the rendered count, to MEASURE it. One caller — components/HomeShoppingCard.tsx
   * flies a ticked row to that figure. Not a styling hook; see SectionRail's `countRef`.
   */
  countRef?: React.Ref<Text>;
  /** The caller's OWN header controls — a bell, a lock, a ⋮. Never a fold. */
  controls?: React.ReactNode;
  /** Drawn inside another card, so this one draws no card of its own. */
  embedded?: boolean;
  /** Extra style for the inner content wrapper below the header. */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function Card({ id, count, countRef, controls, embedded, contentStyle, children }: CardProps) {
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
      countRef={countRef}
      embedded={embedded}
      contentStyle={contentStyle}
      collapsed={folds ? collapsed : undefined}
      onToggleCollapse={folds ? toggleCollapsed : undefined}
      // Pressing a card's NAME opens it full screen, and since 2026-08-22 it is the ONLY way to:
      // the ⤢ that used to sit beside the fold is deleted. The rail has had a slot for exactly
      // this since 2026-08-10; wiring it here means every expandable card gets it, rather than
      // the four that remembered.
      onLabelPress={expands ? expand.onExpand : undefined}
      // The button carried the "open full screen" wording in its accessible label. With the
      // button gone the title has to carry it, or the one control left is a name that does not
      // say it is a control.
      labelPressHint={expands ? `${label} — ${t.expandCardLabel}` : undefined}
      controls={controls}
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
  countRef?: React.Ref<Text>;
  onLabelPress?: () => void;
  /** Accessible name for the pressable title, when pressing it does something. */
  labelPressHint?: string;
  /** The caller's own header controls — drawn first, before the fold, which is outermost. */
  controls?: React.ReactNode;
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
 * caller's own trailing cluster; the fold is appended by this component, outermost, because
 * that is the one ordering both callers share.
 */
export function CardShell({
  hue,
  domain,
  icon,
  badgeHue,
  label,
  count,
  countRef,
  onLabelPress,
  labelPressHint,
  controls,
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
      countRef={countRef}
      // The middle rung of the heading ladder: 20 with a badge. A card is not a group heading
      // (24, no badge) and not a section inside one (17, a dot) — see SectionRail's `tier`.
      tier={tier}
      onLabelPress={onLabelPress}
      labelPressHint={labelPressHint}
      // Every card header is one height, whether or not it has a pressable title and whether or
      // not it has any controls at all. `naming` only floors itself at MIN_TAP_TARGET when it is
      // pressable, so without this a non-expandable card's header row sat visibly shorter than
      // its neighbour's — which the ⤢ had been hiding, since it floored the row from the other
      // side on exactly the cards whose titles were pressable.
      rowMinHeight={MIN_TAP_TARGET}
      // The hairline follows the BODY: the rule is what ties a header to the content under it,
      // so a folded card drawing one draws it over nothing.
      divider={!isClosed}
      // ...and so does the GAP under the rule (2026-08-24). `SectionRail`'s container carries a
      // `marginBottom` to separate the header from the rows it labels; on a folded card there
      // are none, so it was 8px of reserved space below a header with the card's own 8px
      // bottom inset already under it — which sat the title 4px above the closed card's centre
      // on every card in the app. Reported as *"titles are not vertically centered"*. The
      // `paddingBottom` half of this was already handled by `cardCollapsed`; this is the same
      // rule one level up, and it is why closed is a bare header BY CONSTRUCTION rather than
      // by each caller remembering.
      style={isClosed ? styles.railClosed : undefined}
      right={
        <>
          {/* ⚠️ **The caller's own controls, then the fold — always, and the fold is last.** The
              rule was `controls → fold → ⤢` until 2026-08-22, when the ⤢ was deleted app-wide
              (the title opens the card now). The fold inherits the corner it used to yield.
              `SectionCard` implemented the opposite order for months, putting the chevron
              first: the Katalog card came out `fold → camera → lock` where the rule asks for
              `camera → lock → fold`. There is one place to get it right now. */}
          {controls}
          {folds && (
            <CardCollapseToggle collapsed={!!collapsed} onToggle={onToggleCollapse!} cardLabel={label} />
          )}
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
  // Closed, the rail labels nothing, so it reserves no gap under itself either — see the
  // `style` prop passed above.
  railClosed: { marginBottom: 0 },
  // `embedded`: the OUTER card already inset this content from the screen edge, and a second
  // horizontal inset is the "three stacked paddings" shape the wrap audit keeps finding.
  cardEmbedded: { paddingHorizontal: 0 },
});
