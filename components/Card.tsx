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
 *             lib/screenColor, lib/useAppTheme, lib/cardHintContext (tells NarratorQuote a hint
 *             is showing)
 *             + for `CardTabs`: components/IconButton, components/PressableScale, lib/useCardOrder,
 *             lib/hiddenCards, lib/haptics, store/useSettingsStore, expo-router (⋮ → /card-options)
 *   Used by → every card on every tab; components/SectionCard.tsx (via `CardShell`, until it
 *             is retired); `CardTabs` by app/(tabs)/index.tsx, app/(tabs)/shopping.tsx,
 *             components/TodoSurface.tsx, components/HabitsSurface.tsx,
 *             components/HealthSurface.tsx; `TAB_EXCLUDE` by app/card-options.tsx
 *   Data    → settings.collapsedCards, for cards whose registry entry folds
 *
 * Edit notes:
 *   - ⚠️ **One tabbed card per screen (Variant C, maintainer 2026-10-15).** Each screen wraps its
 *     `cardOrder.map(...)` in `CardTabs`; a `Card` that finds `CardTabsContext` naming its id draws
 *     its BODY only while it is the active tab and nothing otherwise (the pane's body-only shape),
 *     and reports that it is mounted plus its count so the tab row lists only real cards. Nothing
 *     folds inside the tabbed card; the header's ⌄/⤢ became the card FOOTER's ⋮ (options page)
 *     and ⤢. Cards outside it (`TAB_EXCLUDE`, Home's Energy) keep the full header described below.
 *   - ⚠️ **The ⤢ is back in a card header (2026-08-26), reversing 2026-08-22** ("Remove all full
 *     screen buttons, instead user just presses the title") **on the maintainer's explicit
 *     instruction, who has seen and accepted its measured cost**: across five screens × three
 *     widths × two languages, 6 of 30 combinations truncate a card title with the ⤢ back, vs 1
 *     of 30 without — nearly all at 360px, and only on a card that ALSO carries its own control
 *     (Catalogue's lock, Medicine's bell) plus the ⤢ plus the fold. Three buttons is one too
 *     many at that width, and it is a known, accepted cost rather than a regression to chase.
 *     ⚠️ **Since 2026-10-11 the title FOLDS instead** (V2 card rule) — ⤢ is the only door to
 *     full screen. Medicine's bell and Catalogue's lock left the header the same day, so the
 *     three-button truncation above no longer occurs.
 *   - ⚠️ **V2 card rule (2026-10-11): the trailing cluster is ⌄ → ⤢ and NOTHING ELSE.** `controls`
 *     is gone from `Card`'s props — a card-specific control (a reminders switch, a lock) lives in
 *     the card's BODY. `CardShell` keeps the slot for `SectionCard`, whose sections are not cards.
 *     The history below is how the order was reached.
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import IconButton from '@/components/IconButton';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import Collapsible from '@/components/Collapsible';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import CardExpandButton from '@/components/CardExpandButton';
import { Fonts, MIN_TAP_TARGET, Radius, Spacing, Type } from '@/constants/theme';
import type { Domain } from '@/lib/domainColor';
import { CardKey, CardScreen, cardSpec } from '@/lib/cardRegistry';
import { isHidden } from '@/lib/hiddenCards';
import { useOrderedCards } from '@/lib/useCardOrder';
import { useSettingsStore } from '@/store/useSettingsStore';
import { selection } from '@/lib/haptics';
import type { CardId } from '@/lib/collapsedCards';
import type { ExpandableCardId } from '@/lib/expandableCards';
import { getScreenColor } from '@/lib/screenColor';
import { PaneCardContext, useIsPaneBody } from '@/lib/cardPane';
import { useIsCardHidden } from '@/lib/useHiddenCard';
import { useCardExpand } from '@/lib/useCardExpand';
import { useCollapsedCard } from '@/lib/useCollapsedCard';
import CardHintLine from '@/components/CardHintLine';
import { CardHintContext } from '@/lib/cardHintContext';
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
   * Ref onto the rendered count, to MEASURE it (for a flight animation landing on the figure).
   * No caller since HomeShoppingCard was deleted (2026-10-11). Not a styling hook; see
   * SectionRail's `countRef`.
   */
  countRef?: React.Ref<Text>;
  /** Drawn inside another card, so this one draws no card of its own. */
  embedded?: boolean;
  /** Extra style for the inner content wrapper below the header. */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * The screen's tabbed card (Variant C, 2026-10-15) — see `CardTabs` below. A `Card` whose id is
 * in `ids` draws nothing of its own: the active one draws its BODY into the tab container (the
 * same body-only shape a full-screen pane gets), the rest draw nothing. Every one of them still
 * reports that it is mounted, and its count, so the tab row only offers cards that exist.
 */
type CardTabsCtx = {
  ids: readonly CardKey[];
  active: CardKey | null;
  report: (id: CardKey, info: { count?: number } | null) => void;
};
const CardTabsContext = React.createContext<CardTabsCtx | null>(null);

export default function Card({ id, count, peek, hint, countRef, embedded, contentStyle, children }: CardProps) {
  const t = useT();
  const theme = useAppTheme();
  const spec = cardSpec(id);
  const tabs = React.useContext(CardTabsContext);
  const inTabs = !!tabs && tabs.ids.includes(id);
  const tally = typeof count === 'number' ? count : count?.left;
  const report = tabs?.report;
  useEffect(() => {
    if (!inTabs || !report) return;
    report(id, { count: tally });
    return () => report(id, null);
  }, [inTabs, report, id, tally]);
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
  // A tab inside the screen's tabbed card: the active one is its body, the rest are nothing.
  // Checked AFTER the pane, which is a separate tree and never carries this context anyway.
  if (inTabs && !isPaneBody && tabs!.active !== id) return null;
  if (isPaneBody || inTabs) {
    return (
      <PaneCardContext.Provider value={null}>
        <CardHintContext.Provider value={!!hint}>
          <View style={[styles.content, contentStyle]}>
            {hint ? <CardHintLine text={hint} /> : null}
            {children}
          </View>
        </CardHintContext.Provider>
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
      // ⚠️ **Pressing a card's NAME folds it (2026-10-11, V2 card rule)**, the same as ⌄. It
      // opened full screen from 2026-08-22, and that was the one surprise in the header: a
      // beginner tapping the title to open the card got a different screen instead. ⤢ is the
      // only way to full screen now — one control, one meaning.
      onLabelPress={folds ? toggleCollapsed : undefined}
      // Says what the press does, like the chevron's own name — but with a dash, not the toggle's
      // colon, so the two stay distinct to anything that looks a control up by name.
      labelPressHint={folds ? `${label} — ${collapsed ? t.expandListLabel : t.collapseListLabel}` : undefined}
      // ⌄ then ⤢, and nothing else: no card passes its own header controls any more (`controls`
      // is gone from this component's props). `undefined` when the card doesn't expand.
      expandButton={expands ? (
        <CardExpandButton expanded={expand.expanded} onExpand={expand.onExpand} onCollapse={expand.onCollapse} cardLabel={label} />
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

/**
 * Cards on a screen that stay ordinary cards OUTSIDE its tabbed card. Read by the screen that
 * mounts `CardTabs` and by app/card-options.tsx, so the ⋮ page never lists a non-tab as a tab.
 */
export const TAB_EXCLUDE: Partial<Record<CardScreen, readonly CardKey[]>> = { home: ['homeEnergy'] };

/** The tab each screen last showed, for the life of the process — survives a tab-screen remount. */
const lastTab = new Map<CardScreen, CardKey>();
/** Height outside a tab's body: tab row + footer + the card's insets + the floating nav. */
const TAB_CHROME = 260;

/**
 * One card per screen, with a tab per registry card (Variant C, maintainer 2026-10-15).
 *
 * Wraps the screen's existing `cardOrder.map(...)` — nothing inside changes. Each `<Card>` in
 * there finds this context, reports itself, and draws only its body while it is the active tab.
 * So the tab list is: the screen's cards in the user's order (settings.cardOrder), minus hidden
 * ones (settings.hiddenCards), minus `exclude`, minus any that are not mounted right now (a card
 * gated on a feature flag or on having data simply never reports).
 *
 * Nothing folds in here. The footer carries the active tab's name, ⋮ (its own options page,
 * app/card-options.tsx) and ⤢ when the card has a full-screen pane.
 *
 * Connections: reads lib/useCardOrder, lib/hiddenCards, settings.hiddenCards; ⋮ pushes
 * /card-options; ⤢ is `CardExpandButton` over `useCardExpand(active)`.
 * Used by: app/(tabs)/index.tsx, app/(tabs)/shopping.tsx, components/TodoSurface.tsx,
 * components/HabitsSurface.tsx, components/HealthSurface.tsx.
 */
export function CardTabs({
  screen,
  exclude,
  disabled,
  children,
}: {
  screen: CardScreen;
  /** Cards on this screen that stay ordinary cards outside the tabbed one (Home's Energy). */
  exclude?: readonly CardKey[];
  /** Render children untouched — for the same surface mounted inside a full-screen pane. */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  // Inside a full-screen pane the surface is drawing one card's body already — no tabs there.
  const inPane = React.useContext(PaneCardContext) !== null;
  if (disabled || inPane) return <>{children}</>;
  return <CardTabsInner screen={screen} exclude={exclude}>{children}</CardTabsInner>;
}

function CardTabsInner({
  screen,
  exclude,
  children,
}: {
  screen: CardScreen;
  exclude?: readonly CardKey[];
  children: React.ReactNode;
}) {
  const t = useT();
  const theme = useAppTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const ordered = useOrderedCards(screen);
  const hiddenCards = useSettingsStore((s) => s.hiddenCards);
  const [reports, setReports] = useState<Partial<Record<CardKey, { count?: number }>>>({});
  const [chosen, setChosen] = useState<CardKey | null>(() => lastTab.get(screen) ?? null);
  // Where this card starts on screen (Home has the Energy card above it), so the body's minimum
  // height leaves the footer on screen rather than one card-height below it. 96 ≈ under the header.
  const [topY, setTopY] = useState(96);

  const report = useCallback((id: CardKey, info: { count?: number } | null) => {
    setReports((prev) => {
      const cur = prev[id];
      if (info === null) {
        if (!cur) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (cur && cur.count === info.count) return prev;
      return { ...prev, [id]: info };
    });
  }, []);

  const ids = useMemo(
    () => ordered.filter((id) => !exclude?.includes(id) && !isHidden(hiddenCards, id)),
    [ordered, exclude, hiddenCards],
  );
  const present = ids.filter((id) => reports[id]);
  // Before the first reports land, the first candidate renders so the first frame is not empty.
  const active: CardKey | null =
    chosen && present.includes(chosen) ? chosen : present[0] ?? (chosen && ids.includes(chosen) ? chosen : ids[0] ?? null);

  const ctx = useMemo(() => ({ ids, active, report }), [ids, active, report]);
  const expandable = !!active && cardSpec(active).expand === 'surface';
  const expand = useCardExpand((active ?? ids[0] ?? 'homeToday') as ExpandableCardId);
  const hue = active ? getScreenColor(theme, cardSpec(active).hue).base : theme.accent;
  const activeLabel = active ? cardSpec(active).title(t) : '';

  const pick = (id: CardKey) => {
    selection();
    lastTab.set(screen, id);
    setChosen(id);
  };

  return (
    <View
      ref={expand.ref}
      collapsable={false}
      onLayout={() => {
        // Window position, not `layout.y`: the parent is often a wrapper (a TourTarget) whose
        // own y is what moves. Measured at mount, when the screen is not scrolled.
        expand.ref.current?.measureInWindow((_x, y) => {
          const top = Math.round(y);
          if (top > 0 && Math.abs(top - topY) > 4) setTopY(top);
        });
      }}
    >
      <Surface style={styles.tabsCard}>
        {present.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabScroll}
            contentContainerStyle={styles.tabRow}
            accessibilityRole="tablist"
            accessibilityLabel={t.cardTabs.tablist}
          >
            {present.map((id) => {
              const on = id === active;
              const n = reports[id]?.count;
              const label = cardSpec(id).title(t);
              return (
                <PressableScale
                  key={id}
                  onPress={() => pick(id)}
                  scaleTo={0.96}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={n ? `${label}, ${n}` : label}
                  style={[
                    styles.tab,
                    { borderColor: on ? hue : theme.border, backgroundColor: on ? hue : 'transparent' },
                  ]}
                >
                  <Text style={[styles.tabText, { color: on ? theme.textInverse : theme.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {n ? (
                    <Text style={[styles.tabCount, { color: on ? theme.textInverse : theme.textMuted }]}>{n}</Text>
                  ) : null}
                </PressableScale>
              );
            })}
          </ScrollView>
        )}

        <CardTabsContext.Provider value={ctx}>
          {/* The body, not the card, takes the minimum height — so the footer sits at the card's
              foot on a short list instead of straight under the last row. Roughly the window
              minus header, nav, tab row and footer; a long list simply grows past it. */}
          <View style={[styles.tabBody, { minHeight: Math.max(200, height - topY - TAB_CHROME) }]}>{children}</View>
        </CardTabsContext.Provider>

        {active && (
          <View style={[styles.tabFoot, { borderTopColor: theme.border }]}>
            <Text style={[styles.tabFootLabel, { color: theme.textMuted }]} numberOfLines={1}>
              {activeLabel}
            </Text>
            <IconButton
              icon="ellipsis-vertical"
              label={t.cardTabs.options(activeLabel)}
              onPress={() => router.push({ pathname: '/card-options', params: { screen, card: active } })}
            />
            {expandable && (
              <CardExpandButton
                expanded={expand.expanded}
                onExpand={expand.onExpand}
                onCollapse={expand.onCollapse}
                cardLabel={activeLabel}
              />
            )}
          </View>
        )}
      </Surface>
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
      // ⚠️ **A FOLDING card's rail never reserves the header→body gap — `folds`, not `isClosed`
      // (2026-09-09).** `SectionRail`'s container carries `marginBottom: Spacing.sm` to hold the
      // header off the rows it labels, and a folded card has no rows, so this used to be
      // cancelled the moment `collapsed` flipped. That is a LAYOUT prop changing on the first
      // frame of a 200/240ms animation: the body jumped 8px up as it started closing and 8px of
      // empty gap appeared before it had begun opening. Reported from the device as a *"flicker
      // or jump mid-animation"*, twice, and looked for inside `components/Collapsible.tsx` both
      // times — it was never in there, because the thing that moved was outside the clip.
      //   For a folding card the gap now rides INSIDE the animated body instead
      // (`styles.contentFoldGap` below), where it grows and shrinks with the reveal. Both rest
      // states are pixel-identical to before: open is rail-margin 0 + body padding 8, closed is
      // 0 + nothing drawn. A card that does NOT fold keeps the rail's own margin, unchanged.
      style={folds ? styles.railClosed : undefined}
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
  // The provider tells a NarratorQuote further down that this card is already explaining
  // itself, so an empty card speaks once (2026-10-11 — lib/cardHintContext.ts).
  const body = (
    <CardHintContext.Provider value={!!hint}>
      <View style={[styles.content, folds && styles.contentFoldGap, contentStyle]}>
        {hint ? <CardHintLine text={hint} /> : null}
        {children}
      </View>
    </CardHintContext.Provider>
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
  // The header→body gap for a FOLDING card, carried by the body instead of by the rail so it
  // animates with the fold rather than snapping on its first frame — see the `railClosed` note
  // at the rail's `style` prop. Same 8px, one level down.
  contentFoldGap: { paddingTop: Spacing.sm },
  // Closed, the rail labels nothing, so it reserves no gap under itself either — see the
  // `style` prop passed above.
  railClosed: { marginBottom: 0 },
  // `embedded`: the OUTER card already inset this content from the screen edge, and a second
  // horizontal inset is the "three stacked paddings" shape the wrap audit keeps finding.
  cardEmbedded: { paddingHorizontal: 0 },
  // ── CardTabs ──
  tabsCard: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  // `flexGrow: 0` — inside the card's column a horizontal ScrollView otherwise takes the spare
  // height and the pills stretch to fill it.
  tabScroll: { flexGrow: 0, flexShrink: 0 },
  tabRow: { gap: Spacing.sm, paddingRight: Spacing.md, alignItems: 'center' },
  tab: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tabText: { fontFamily: Type.label.fontFamily, fontSize: Type.bodyStrong.size },
  tabCount: { fontFamily: Fonts.semibold, fontSize: Type.caption.size, fontVariant: ['tabular-nums'] },
  tabBody: { flex: 1, gap: Spacing.sm },
  tabFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TAP_TARGET,
  },
  tabFootLabel: { flex: 1, fontFamily: Type.caption.fontFamily, fontSize: Type.label.size },
});
