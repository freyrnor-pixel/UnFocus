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
 * components/CardCollapseToggle.tsx. `components/CardExpandButton.tsx` has exactly one other
 * legitimate importer — components/CardExpandHost.tsx, the expanded pane's own close control —
 * and both exceptions are named, not allowlisted (`lib/__tests__/cardAnatomy.test.ts`). One
 * assertion per control, and each is stronger than every list the previous passes maintained:
 * those listed the cards that were already right, so a new card was compliant by default. This
 * one says where the controls may be built at all.
 *
 * Connections:
 *   Imports → components/Surface, components/SectionRail, components/Collapsible,
 *             components/CardCollapseToggle, components/CardExpandButton, components/CardHintLine,
 *             constants/theme,
 *             lib/cardRegistry, lib/cardPane, lib/useCollapsedCard, lib/useCardExpand,
 *             lib/screenColor, lib/useAppTheme
 *   Used by → every card on every tab; components/SectionCard.tsx (via `CardShell`, until it
 *             is retired)
 *   Data    → settings.collapsedCards, for cards whose registry entry folds
 *
 * Edit notes:
 *   - ⚠️ **The ⤢ is back in a card header (2026-08-26), reversing 2026-08-22** ("Remove all full
 *     screen buttons, instead user just presses the title") **on the maintainer's explicit
 *     instruction, who has seen and accepted its measured cost**: across five screens × three
 *     widths × two languages, 6 of 30 combinations truncate a card title with the ⤢ back, vs 1
 *     of 30 without — nearly all at 360px, and only on a card that ALSO carries its own control
 *     (Catalogue's lock, Medicine's bell) plus the ⤢ plus the fold. Three buttons is one too
 *     many at that width, and it is a known, accepted cost rather than a regression to chase.
 *     **The title stays pressable too** — two ways in is fine, and it is what keeps
 *     `labelPressHint` honest for anyone who still reaches for the name.
 *   - **The trailing cluster is fold → `{controls}` → ⤢, in that order, always** (2026-08-27,
 *     round 20, reversing 2026-08-26's `{controls}` → ⤢ → fold). `controls` is the caller's OWN
 *     controls and nothing else — a bell, a lock, a ⋮. The **⤢ is outermost** now, in the card's
 *     actual top-right corner, and the fold leads. What that buys: the ⤢ is the one control that
 *     changes which SCREEN you are looking at, and it now sits in the same corner on every card
 *     whether or not that card folds — which the old order could not, since a non-folding card's
 *     ⤢ landed exactly where a folding card's chevron did.
 *     The ⤢ draws at `IconSize.compact` (30, nearest the mockup's 29) and a caller's own controls
 *     at `IconSize.action` (36); both reach the 48px `MIN_TAP_TARGET` through
 *     `components/IconButton.tsx`'s own hit-target floor (`Math.max(MIN_TAP_TARGET, size +
 *     Spacing.sm)` on the PRESSABLE, never on the painted circle) — never a literal 48-wide
 *     filled box, which would cost another 24px of header width per control.
 *   - **`peek` and `hint` are content props, not description** (2026-08-27). A `peek` is one line
 *     under the title saying what a CLOSED card holds, replacing the bare count that read as a
 *     score; a `hint` is one muted italic line under the header saying what the card is FOR, and
 *     is passed only while the card has content. Both are live state, like `count` — the registry
 *     still owns everything a card LOOKS like, and neither prop reopens that.
 *   - **Closed is a bare header.** Three things follow the body rather than the card: the rail's
 *     hairline (`divider={!collapsed}`), the GAP the rail reserves under itself (`railClosed`,
 *     2026-08-24) and the card's bottom inset (`cardCollapsed`) — so a folded card is its header
 *     and nothing else *by construction* rather than by each caller remembering. The middle one
 *     was missed until a user reported that *"titles are not vertically centered"*: 8px of the
 *     rail's own margin plus 8px of card padding sat under a header with nothing between them,
 *     which put every closed card's title 4px above its centre.
 *   - ⚠️ **Inside its own full-screen pane, a card draws its BODY and nothing else (2026-08-28,
 *     lib/cardPane.ts).** `components/CardExpandHost.tsx` paints the pane's title bar and its
 *     close control, and then mounts a surface whose whole job is to render one `<Card>` — so
 *     until this, an expanded card drew a second Surface, a second header with the same word on
 *     it, a fold chevron and an ⤢, inside the pane's own paddings. Measured on Home's Today card:
 *     65px of pane header, then a 52px card header saying "Today" again. **This is NOT what
 *     `embedded` does** — `embedded` drops the Surface and the horizontal padding and KEEPS the
 *     header, which is right for a section inside a card and exactly wrong for a pane. The `hint`
 *     survives into the pane (it is what the card is FOR, and the pane has nowhere else to say
 *     it); the fold and the ⤢ do not, since neither can act on a pane.
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
import CardExpandButton from '@/components/CardExpandButton';
import { MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import type { Domain } from '@/lib/domainColor';
import { CardKey, cardSpec } from '@/lib/cardRegistry';
import type { CardId } from '@/lib/collapsedCards';
import type { ExpandableCardId } from '@/lib/expandableCards';
import { getScreenColor } from '@/lib/screenColor';
import { PaneCardContext, useIsPaneBody } from '@/lib/cardPane';
import { useIsCardHidden } from '@/lib/useHiddenCard';
import { useCardExpand } from '@/lib/useCardExpand';
import { useCollapsedCard } from '@/lib/useCollapsedCard';
import CardHintLine from '@/components/CardHintLine';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type CardProps = {
  id: CardKey;
  /** Optional tally shown after the title. A size, never a score. */
  count?: number | { left: number; total: number };
  /**
   * One line under the title saying what is inside — see `SectionRail`'s `peek`, which owns the
   * rendering and the width budget. Live state, like `count`, which is why it is a prop: the
   * registry holds what a card LOOKS like, never what it currently holds.
   */
  peek?: string;
  /**
   * One muted italic line under the header saying what this card is for — see
   * `components/CardHintLine.tsx`, which owns the rendering and the reversal it represents.
   *
   * ⚠️ **Pass it only while the card HAS content.** An empty card already speaks, through
   * `StarterCard`'s line or `NarratorQuote`'s aside, and drawing both stacks two muted italic
   * lines — which is the "reads like a manual" failure the 2026-08-17 deletion was about. The
   * gate is the caller's because only the caller knows what empty means for its surface;
   * AGENTS.md's empty-state note lists five different predicates across the app.
   */
  hint?: string;
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

export default function Card({ id, count, peek, hint, countRef, controls, embedded, contentStyle, children }: CardProps) {
  const t = useT();
  const theme = useAppTheme();
  const spec = cardSpec(id);
  // Both hooks run unconditionally, unlike SectionCard's split-by-component dance. That split
  // existed because a per-day section would otherwise subscribe to the settings store; a Card is
  // a singleton by definition (a section drawn one-per-row of user data is not a Card at all),
  // so there is nothing here to protect.
  const [collapsed, toggleCollapsed] = useCollapsedCard(id as CardId);
  const expand = useCardExpand(id as ExpandableCardId);
  // Is THIS card the one the open full-screen pane is drawing? See lib/cardPane.ts — the pane
  // already paints the title and the close control, so drawing a card here is the title twice
  // over plus a fold chevron and an ⤢ that cannot mean anything inside a pane.
  const isPaneBody = useIsPaneBody(id);
  // ── Put away entirely (2026-08-30) ───────────────────────────────────────────────────────
  // Hiding lives HERE rather than at ~15 call sites, and that is the whole reason this feature
  // needed no edit to TodoSurface / HabitsSurface / HealthSurface / shopping.tsx — 6 369 lines
  // between them, every card in hardcoded JSX. A `null` child in a `gap` container is simply not
  // laid out, so the screen rhythm needs nothing either.
  //   ⚠️ Read AFTER `isPaneBody` deliberately: a pane draws the card it was opened from, and a
  // card cannot be hidden while its own full-screen pane is open. Checking first would blank the
  // pane instead of closing it.
  const cardHidden = useIsCardHidden(id);

  const folds = spec.fold === 'persisted';
  const expands = spec.expand === 'surface';
  const label = spec.title(t);

  // ⚠️ **Inside its own pane a card is its BODY and nothing else** (2026-08-28). Not `embedded`,
  // which drops the Surface and keeps the header — a section inside a card needs that header;
  // a pane has already drawn it. The provider is re-set to `null` so nothing deeper can claim
  // the pane a second time. `hint` survives (it is what the card is FOR, and the pane has no
  // other place to say it); the fold and the ⤢ do not, since neither can act on a pane.
  if (isPaneBody) {
    return (
      <PaneCardContext.Provider value={null}>
        <View style={[styles.content, contentStyle]}>
          {hint ? <CardHintLine text={hint} /> : null}
          {children}
        </View>
      </PaneCardContext.Provider>
    );
  }

  // Nothing is unloaded — the rows keep their reminders and still count. See lib/hiddenCards.ts.
  if (cardHidden) return null;

  const shell = (
    <CardShell
      hue={getScreenColor(theme, spec.hue).base}
      domain={spec.domain}
      icon={spec.icon}
      badgeHue={spec.badgeHue}
      label={label}
      count={count}
      countRef={countRef}
      peek={peek}
      hint={hint}
      embedded={embedded}
      contentStyle={contentStyle}
      collapsed={folds ? collapsed : undefined}
      onToggleCollapse={folds ? toggleCollapsed : undefined}
      // Pressing a card's NAME opens it full screen, and since 2026-08-22 it is the ONLY way to:
      // the ⤢ that used to sit beside the fold is deleted. The rail has had a slot for exactly
      // this since 2026-08-10; wiring it here means every expandable card gets it, rather than
      // the four that remembered.
      onLabelPress={expands ? expand.onExpand : undefined}
      // The title still carries the "open full screen" wording in its accessible label even
      // though the ⤢ is back — two ways in, one accessible name each. See the header note.
      labelPressHint={expands ? `${label} — ${t.expandCardLabel}` : undefined}
      controls={controls}
      // Just inside the fold, which stays outermost. `undefined` (not a component call) when
      // the card doesn't expand, so a non-expandable card's cluster is exactly `{controls}` →
      // fold, unchanged.
      expandButton={expands ? (
        <CardExpandButton expanded={expand.expanded} onExpand={expand.onExpand} onCollapse={expand.onCollapse} />
      ) : undefined}
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
  /** See CardProps' `peek`. */
  peek?: string;
  /** See CardProps' `hint`. */
  hint?: string;
  countRef?: React.Ref<Text>;
  onLabelPress?: () => void;
  /** Accessible name for the pressable title, when pressing it does something. */
  labelPressHint?: string;
  /** The caller's own header controls — drawn first, before the ⤢ and the fold. */
  controls?: React.ReactNode;
  /**
   * The full-screen ⤢, just inside the fold (which stays outermost). Built by the caller
   * (components/Card.tsx's default export) from `lib/useCardExpand.ts`'s hook, because this
   * shell has no registry access of its own — see components/SectionCard.tsx, whose cards never
   * expand and so never pass one.
   */
  expandButton?: React.ReactNode;
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
  peek,
  hint,
  onLabelPress,
  labelPressHint,
  controls,
  expandButton,
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
      peek={peek}
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
          {/* ⚠️ **The fold, then the caller's own controls, then the ⤢ — always, and the ⤢ is
              last** (2026-08-27, round 20). This REVERSES the order that stood here from
              2026-08-26, which read `controls → ⤢ → fold` with the fold outermost, and it is a
              maintainer ruling against the drawn mockup rather than a re-derivation: the round 20
              screens put the chevron first and the expand control in the corner, on every card,
              on every screen.
                The reasoning that produced the old order is still worth knowing, because it is
              what makes this a real reversal and not drift. The fold was put outermost so the
              control a user reaches for most often sits in the corner where the thumb lands. The
              ruling trades that for a different consistency: the ⤢ is the one control that
              changes what SCREEN you are looking at, and the mockup keeps it in the same corner
              on every card whether or not that card also folds — which the old order could not,
              since a non-folding card's ⤢ then sat where a folding card's chevron sat.
                `SectionCard` drew chevron-first for months before 2026-08-26 (the Katalog card
              came out `fold → camera → lock`); that was drift, this is the same shape arrived at
              deliberately, and there is still exactly one place it is spelled. */}
          {folds && (
            <CardCollapseToggle collapsed={!!collapsed} onToggle={onToggleCollapse!} cardLabel={label} />
          )}
          {controls}
          {expandButton}
        </>
      }
    />
  );

  // The hint sits under the header rule and above everything the caller draws — the placement
  // rule that survived the 2026-08-17 deletion ("explanation always sits underneath sub-header",
  // 2026-08-12) and is now used again. Inside the `Collapsible`, so a folded card takes its
  // explanation away with its content.
  const body = (
    <View style={[styles.content, contentStyle]}>
      {hint ? <CardHintLine text={hint} /> : null}
      {children}
    </View>
  );

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
  //
  // ⚠️ **The vertical inset is SYMMETRIC as of 2026-08-28 — `Spacing.sm` at both ends.** It was
  // 8 top / 16 bottom, which is neither a rung apart on purpose nor anything the mockup draws:
  // `DESIGN_COMPARISON/20-corrected-screens.html` uses 11px both ways, and its "padding is down
  // across the board" line is one of the two the maintainer named as not having landed. 8 is the
  // rung below 11 on the deliberate 4/8/16/24/32/48 scale, and the top inset was already there,
  // so this makes the two ends agree rather than inventing a value between them. Worth 8px on
  // every open card and every embedded section in the app.
  //   The HORIZONTAL inset stays `Spacing.md`: it is what holds a row's text off the card's edge
  // and what `npm run wraps` measures every screen's text width against, and the mockup's own
  // horizontal figure (12) is not on the scale either.
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  content: { gap: Spacing.sm },
  // Closed, the bottom inset matches the top one — padding reserved for rows that are not drawn
  // is just a gap. Since 2026-08-28 the open card's inset is `Spacing.sm` too, so this is the
  // same value; it is kept as its own style rather than deleted because "closed is a bare
  // header" is a construction the card system depends on (lib/__tests__/cardAnatomy.test.ts),
  // and it must not silently stop being expressed if the open card's bottom inset ever grows.
  cardCollapsed: { paddingBottom: Spacing.sm },
  // Closed, the rail labels nothing, so it reserves no gap under itself either — see the
  // `style` prop passed above.
  railClosed: { marginBottom: 0 },
  // `embedded`: the OUTER card already inset this content from the screen edge, and a second
  // horizontal inset is the "three stacked paddings" shape the wrap audit keeps finding.
  cardEmbedded: { paddingHorizontal: 0 },
});
