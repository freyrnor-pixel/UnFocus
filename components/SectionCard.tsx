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
 *   Imports → components/Card (CardShell), lib/collapsedCards, lib/useCollapsedCard
 *   Used by → app/plans.tsx, app/habits.tsx, components/TodoSurface.tsx (Week card, local
 *             per-weekday fold via `onToggleCollapse`)
 *   Data    → settings.collapsedCards, but ONLY when a caller passes `collapseKey` (the
 *             foldable variant is a separate component so the plain one reads no store)
 *
 * ⚠️ **This is a shim as of 2026-08-21, and it is on its way out.** Every pixel it draws now
 * comes from `CardShell` in components/Card.tsx; its own `Surface`, rail, `Collapsible`, fold
 * chevron and stylesheet are gone. Its nine-prop surface *is* the defect the card registry
 * exists to remove — three fold mechanisms and a free-form `right` slot that let each caller
 * invent its own control order — so callers move to `<Card id="…">` screen by screen and this
 * file dies with the last one. **Do not add a prop to it.**
 *
 * Edit notes:
 *   - **`collapseKey` makes a section foldable (2026-08-14), and only a singleton may take one.**
 *     The id is the storage key, so a card drawn one per day or per group has nothing stable to
 *     store — on the To-do tab that means Today/Whenever/Recurring opt in and the per-day and
 *     per-group cards deliberately do not. Callers without the prop are untouched: no chevron,
 *     no `Collapsible`, and no subscription to the settings store (see
 *     `CollapsibleSectionCard`'s own note for why that split is a component and not an `if`).
 *   - **`collapsed`/`onToggleCollapse` is the LOCAL sibling of `collapseKey` (card-element
 *     standardization pass, 2026-08-20)** — same fold chevron and `Collapsible`, but the open/
 *     closed state lives in the CALLER's own memory instead of `settings.collapsed_cards`, for
 *     exactly the per-day/per-group sections `collapseKey` above says can't take a persisted id
 *     (the To-do Week card's seven weekday sections are the first user of it — a week rolls
 *     forward, so "Tuesday is folded" isn't a fact worth remembering past this render). Passing
 *     both `collapseKey` and `onToggleCollapse` is not supported — `collapseKey` wins.
 *   - **A CLOSED card is its header and nothing else (2026-08-21, CONSISTENCY_AUDIT.md §2).**
 *     The rail's hairline is passed `divider={!collapsed}` and the card's bottom inset drops to
 *     `Spacing.sm` to match its top one. Both are what `components/CollapsedSection.tsx` already
 *     did; this component didn't follow, so a folded `SectionCard` drew a rule over nothing plus
 *     25px of empty card — visibly unlike the closed drawer sitting right under it on the To-do
 *     tab. Don't reintroduce either: the rule ties a header to content, and padding reserved for
 *     rows that aren't drawn is just a gap.
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
import { StyleProp, ViewStyle } from 'react-native';
import SectionRail from '@/components/SectionRail';
import { CardShell } from '@/components/Card';
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
  /**
   * Paint the badge in `hue` instead of `domain`'s own identity colour — a straight passthrough
   * to `SectionRail`'s prop of the same name, added 2026-08-21 by the consistency audit.
   *
   * It exists because `lib/domainColor.ts` aliases FOUR domains (`shop`/`meal`/`budget`/`scan`)
   * onto one emerald, so `domain="meal"` and `domain="shop"` resolve to the identical badge —
   * which is what made every card on the Shop tab the same colour and left the Dishes card with
   * no identity of its own (CONSISTENCY_AUDIT.md §15). A card that owns a real hue can now pass
   * it and have the badge, the label's divider and the card agree. Leave it off wherever the
   * badge is genuinely marking a domain.
   */
  badgeHue?: boolean;
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
  /** Locally-controlled fold state (not persisted) — see the edit note above. Ignored when
   *  `collapseKey` is also passed. */
  collapsed?: boolean;
  /** Presence of this (not `collapsed`'s value) is what switches the card into foldable mode. */
  onToggleCollapse?: () => void;
  /**
   * Drawn INSIDE another card, so this one draws no card of its own (2026-08-20) — a plain
   * View in place of the `Surface`, keeping the rail, the fold and the content exactly as they
   * are. Same convention as `FoodTab`/`CatalogueTab`/`TodoSurface`'s `embedded`: it unwraps
   * only the chrome that assumes a screen backdrop, never the content.
   *
   * It exists for the To-do Week card, whose seven weekday sections moved inside one outer card
   * so the ⤢ has a single header to sit in the corner of. A Surface inside a Surface reads as a
   * nested panel, which is the thing the blueprint pass banned outright ("do NOT place borders,
   * dividers, or separate background boxes inside of main cards").
   */
  embedded?: boolean;
  children: React.ReactNode;
};

export default function SectionCard({
  hue,
  domain,
  icon,
  badgeHue,
  label,
  count,
  right,
  style,
  contentStyle,
  collapseKey,
  collapsed,
  onToggleCollapse,
  embedded = false,
  children,
}: Props) {
  // No `borderColor` — the card inherits the SCREEN's hue (see the `hue` prop's doc). `hue`
  // still reaches the rail below, which is where a section's own identity lives now.
  if (collapseKey) {
    return (
      <PersistedFoldableSectionCard
        hue={hue}
        domain={domain}
        icon={icon}
        badgeHue={badgeHue}
        label={label}
        count={count}
        right={right}
        style={style}
        contentStyle={contentStyle}
        collapseKey={collapseKey}
        embedded={embedded}
      >
        {children}
      </PersistedFoldableSectionCard>
    );
  }
  return (
    <CardShell
      // An `embedded` SectionCard is a section INSIDE a card — the To-do Week card's seven
      // weekday sections, Today's per-person groups — so it takes the ladder's bottom rung.
      // Standing on its own it is a card, and takes the middle one.
      tier={embedded ? 'sub' : 'card'}
      hue={hue}
      domain={domain}
      icon={icon}
      badgeHue={badgeHue}
      label={label}
      count={count}
      controls={right}
      collapsed={onToggleCollapse ? !!collapsed : undefined}
      onToggleCollapse={onToggleCollapse}
      embedded={embedded}
      style={style}
      contentStyle={contentStyle}
    >
      {children}
    </CardShell>
  );
}

/**
 * Reads the persisted `collapseKey`, then hands off to the same rendering the local variant
 * uses. Split out so the plain card calls no hook at all — `useCollapsedCard` subscribes to
 * the settings store, and every per-day/per-group SectionCard would otherwise re-render on any
 * collapse anywhere. Rules of hooks means the split has to be a separate component.
 */
function PersistedFoldableSectionCard({
  collapseKey,
  right,
  ...rest
}: Omit<Props, 'collapseKey' | 'collapsed' | 'onToggleCollapse'> & { collapseKey: CardId }) {
  const [collapsed, toggleCollapsed] = useCollapsedCard(collapseKey);
  return (
    <CardShell
      {...rest}
      tier={rest.embedded ? 'sub' : 'card'}
      controls={right}
      collapsed={collapsed}
      onToggleCollapse={toggleCollapsed}
    />
  );
}
