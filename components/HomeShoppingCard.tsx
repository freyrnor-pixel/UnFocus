/**
 * HomeShoppingCard.tsx — Home's shopping list, as a pageable notepad of the four cycle weeks.
 *
 * A ruled sheet (components/PadSheet) of the selected week's items, with `‹ Week 2 · 12–18 May ›`
 * arrows in the header to step through Weeks 1–4 of the monthly cycle. Rebuilt 2026-07-30 from a
 * card that showed exactly one list — whichever one's date range contained today — and expanded
 * into a nested structure of dish `ExpandableCard`s plus three labelled sections.
 *
 * What changed and why (user report: "simplify, make it look more or less just like a shopping
 * list, but user can tap left/right button to go through different lists — when doing so it
 * should animate"):
 *   - **A week pager instead of one fixed list.** Every week gets a page whether or not a list
 *     exists for it, so the pager's length never changes under the user's finger and "no list
 *     this week" is a real, visible state rather than a page the arrows skip.
 *   - **One flat ruled list instead of nested cards.** A dish is a row's meta line now, not an
 *     `ExpandableCard` wrapping more rows — a card inside a card inside a card was the opposite
 *     of "just like a shopping list".
 *   - **In cart is a caption, not a section card.** Shopping keeps its existing move logic
 *     (maintainer's call: only Notes changed to stay-in-place-until-tomorrow), so a ticked item
 *     still moves — it just moves under a plain caption inside the same pad.
 *   - Purchased history isn't on Home at all any more; that's the Shopping screen's job.
 *   - **The quick-add's options are a labelled panel (2026-08-05).** Quantity and the
 *     destination list used to be a stepper and a chip crammed onto the same 44px line as the
 *     input — which is part of why the input had no room to draw as a real field. They are two
 *     labelled rows below it now, matching Habits and To-do. The destination also stopped
 *     being a chip that CYCLED forward through the lists on tap: with a monthly list per
 *     household category that could be five one-way stops, only one of them ever visible. It
 *     opens a picker (showAppModal). Same defect, same fix as the energy and repeat rows.
 *
 * Connections:
 *   Imports → components/PadSheet + components/PadRow + components/PadTypeRow +
 *             components/PadFooterToggle (the ruled sheet, the type line, the three-size
 *             footer), components/Surface, components/IconButton (the week arrows),
 *             components/CardAccent (CardAccentBadge), components/PressableScale,
 *             components/CardMenuSheet (CardMenuButton — the header "⋮", when Home passes a menu),
 *             components/ProgressBar, components/Stepper (quick-add quantity),
 *             components/QuickAddOptionsPanel + components/QuickAddOptionRow (the quick-add's
 *             labelled Quantity + Add-to rows), components/AppModal (showAppModal — the
 *             destination-list picker),
 *             components/ShoppingItemSheet (this card mounts its own item detail sheet —
 *             AnimatedBottomSheet renders into a Modal, so depth in the tree doesn't matter),
 *             constants/theme, constants/motion (Duration/Ease — the week slide),
 *             lib/haptics (selection on each arrow), lib/i18n, lib/shoppingGroups (listProgress),
 *             lib/useAppTheme, lib/domainColor, lib/padState, lib/budget (SpendPace type only),
 *             react-native-reanimated, store/useShoppingStore (ShoppingItem type),
 *             store/useShoppingListStore (ShoppingList type)
 *   Used by → app/(tabs)/index.tsx (Home shopping preview — it builds the `weeks` array with
 *             lib/date's weekOfMonthlyCycle/dateRangeForCycleWeek, the same helpers
 *             app/(tabs)/shopping.tsx buckets its own Week 1–4 sections with)
 *   Data    → mutations bubble up via callbacks (Home owns the stores), EXCEPT the item detail
 *             sheet it mounts, which writes shopping_items itself via useShoppingStore.update().
 *             Card size persists to settings.cardStates via the `padState` props.
 *
 * Edit notes:
 *   - **The header "⋮" (2026-08-04, workstream A)**: `cardMenu` is optional and BUILT BY HOME
 *     (app/(tabs)/index.tsx), not here — its rows write `settings.homeCardOrder` and flip Home's
 *     reorder mode, neither of which this card can reach. No prop, no ⋮ (the To-do tab's own
 *     mount passes none). See components/CardMenuSheet.tsx's header before moving it.
 *   - **Quantity READS here and is EDITED in the sheet** (row rule, 2026-07-28) — it is the
 *     row's one right-hand value, and `components/ShoppingItemSheet.tsx` is still the only
 *     editor for a weekly item's quantity/unit/price/category. Don't add a stepper to a row.
 *   - **The pager animates, and the animation is the feedback.** `translateX` + fade over
 *     `Duration.tabSwitch`, direction taken from the arrow pressed, snapped instantly under
 *     `reducedMotion` (gate at the trigger, per ANIMATION_GUIDELINES §7). A `selection()`
 *     haptic per arrow, matching components/SlideSelector.
 *   - **Week index is local state, deliberately not persisted.** It resets to the week
 *     containing today on every mount, which is nearly always the week you want; a remembered
 *     week would silently show a stale list days later.
 *   - The flight animation (ANIMATION_GUIDELINES §8) targets the card's own item-count badge:
 *     there is no "In cart" section card left to fly to, and the badge is always mounted
 *     whenever there is an item to tick. Reduced motion falls straight through to `onToggle`.
 *   - **The badge now reads "{remaining}/{total}", not a bare total (2026-08-04,
 *     DESIGN_COMPARISON/09).** The old grey "{left}/{total} left" header sentence is gone, and
 *     its number moved INTO this badge rather than a second pill beside the title — the badge
 *     already was the design-comparison's "coloured count pill" pattern (`domainColor.soft`
 *     plate, plain `theme.text` ink, never `domainColor.accent` as text — A.4 rule 1), just
 *     showing the wrong number for that job. Only the label changed; `badgeRef`'s node identity
 *     and position are untouched, so the flight animation still lands in the same place.
 *   - `HOME_PREVIEW_CARD_MIN_HEIGHT` applies while the card is NOT open — closed and preview
 *     both — so the four Home cards read as one size at rest; never while open, so a long list
 *     grows freely. See PlanTaskCard's header.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Surface from '@/components/Surface';
import IconButton from '@/components/IconButton';
import { CardAccentBadge } from '@/components/CardAccent';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import CardHintNote from '@/components/CardHintNote';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import Stepper from '@/components/Stepper';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import { showAppModal } from '@/components/AppModal';
import ShoppingItemSheet from '@/components/ShoppingItemSheet';
import type { FlightRect } from '@/components/FlightOverlay';
import {
  FontSize,
  Fonts,
  HOME_PREVIEW_CARD_MIN_HEIGHT,
  PAD_GUTTER,
  Radius,
  Spacing,
  TabularNums,
  computeBorderTone,
  rgba,
} from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility, useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { selection, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { ShoppingItem } from '@/store/useShoppingStore';
import { ShoppingList } from '@/store/useShoppingListStore';
import { listProgress } from '@/lib/shoppingGroups';
import { getScreenColor } from '@/lib/screenColor';
import { PadState, padVisibleRows } from '@/lib/padState';
import { SpendPace } from '@/lib/budget';

/** One page of the pager: a cycle week, whatever list sits in it, and that list's items. */
export type ShoppingWeek = {
  week: number;
  list: ShoppingList | null;
  range: { startDate: string; endDate: string };
  dishGroups: [string, ShoppingItem[]][];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
};

type Props = {
  /** Home's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
  /** The four cycle weeks, in order. Built by app/(tabs)/index.tsx — see its `shoppingWeeks`. */
  weeks: ShoppingWeek[];
  /** Which week to open on — the one containing today. */
  initialWeek: number;
  onToggle: (id: string) => void;
  /** Cart row's ⋯ — "got it", moving the item from the cart to purchased. */
  onCollect: (id: string) => void;
  onRemove: (item: ShoppingItem) => void;
  onNavigateToShopping: () => void;
  /** See the flight edit note. Omit to keep a plain, un-animated toggle. */
  onFlightStart?: (item: ShoppingItem, from: FlightRect, to: FlightRect) => void;
  /** Spend-vs-budget pace (Decision 026) — null/undefined hides the line. */
  pace?: SpendPace | null;
  /** Inline quick-add. Omit to render the card with no add affordance. */
  onAddItem?: (name: string, quantity: number, monthlyListId?: string) => void;
  /** Target chip's cycle options beyond "this week" — id/name is all it needs. */
  monthlyLists?: { id: string; name: string }[];
  /** Card size (lib/padState). Omit to keep it as local state. */
  padState?: PadState;
  onPadStateChange?: (next: PadState) => void;
  /** Formats a week's date range for the header, e.g. "12–18 May". */
  formatRange: (startDate: string, endDate: string) => string;
};

export default function HomeShoppingCard({
  cardMenu,
  weeks,
  initialWeek,
  onToggle,
  onCollect,
  onRemove,
  onNavigateToShopping,
  onFlightStart,
  pace,
  onAddItem,
  monthlyLists = [],
  padState,
  onPadStateChange,
  formatRange,
}: Props) {
  const t = useT();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();
  // The card's one hue (border + every content accent) — this used to be lib/domainColor's
  // 'shop' identity (gold), which is a DIFFERENT hue from the screen border below (green) and
  // read as a mismatch: a green-edged card with gold arrows/progress/checks. Content now pulls
  // from the same screenColor the border does, so the whole card is one colour family.
  const screenColor = getScreenColor(theme, 'shopping');
  // Week-arrow buttons are ghost-style (transparent fill, thin border) rather than the old
  // solid-filled circle — a heavy solid-colour blob for a plain prev/next control read as
  // over-designed (user report). Border sits at the lightest "button" rung of the screen hue,
  // same grading Button.tsx's ghost variant uses.
  const pagerButtonBorder = computeBorderTone(screenColor.base, isDark, 'button');

  const [localPadState, setLocalPadState] = useState<PadState>('preview');
  const state = padState ?? localPadState;
  const setState = onPadStateChange ?? setLocalPadState;

  // Local, not persisted: it resets to the week containing today on every mount, which is
  // nearly always the week you want. See the edit note.
  const [pageIndex, setPageIndex] = useState(() =>
    Math.max(0, weeks.findIndex((w) => w.week === initialWeek))
  );
  useEffect(() => {
    const i = weeks.findIndex((w) => w.week === initialWeek);
    if (i >= 0) setPageIndex(i);
  }, [initialWeek, weeks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // This card owns its own item detail sheet rather than threading one up through Home and
  // HomeCardManager: AnimatedBottomSheet renders into a Modal, so mounting depth doesn't
  // affect where the sheet appears, and Home's card set stays a plain list of cards.
  const [detailItem, setDetailItem] = useState<ShoppingItem | null>(null);
  const badgeRef = useRef<any>(null);
  const rowNodes = useRef<Map<string, any>>(new Map());

  // Quick-add. addTargetIndex 0 = this week's list; i>0 = monthlyLists[i-1].
  const [addDraft, setAddDraft] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addTargetIndex, setAddTargetIndex] = useState(0);

  // The week slide. `slide` is a -1…1 offset the page content is nudged by, sprung back to 0 —
  // the motion carries "a different list came in from that side".
  const slide = useSharedValue(0);
  const fade = useSharedValue(1);
  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value }],
    opacity: fade.value,
  }));

  const page = weeks[pageIndex] ?? weeks[0];
  const progress = listProgress({
    dishGroups: page?.dishGroups ?? [],
    ungroupedUnchecked: page?.ungroupedUnchecked ?? [],
    checked: page?.checked ?? [],
  });
  const totalCount = progress.total;

  // Every unchecked row the week has, dish rows included — a dish is a meta line now, not a
  // nested card, so its ingredients are ordinary rows of the same list.
  const dishRows = (page?.dishGroups ?? []).flatMap(([dishName, items]) =>
    items.filter((i) => !i.checked).map((item) => ({ item, dishName }))
  );
  const listRows = [
    ...dishRows,
    ...(page?.ungroupedUnchecked ?? []).map((item) => ({ item, dishName: undefined as string | undefined })),
  ];
  const visibleRows = padVisibleRows(listRows, state);
  const cartRows = page?.checked ?? [];

  function step(direction: 1 | -1) {
    if (weeks.length === 0) return;
    selection();
    const next = (pageIndex + direction + weeks.length) % weeks.length;
    if (reducedMotion) {
      setPageIndex(next);
      return;
    }
    // Out the way it's going, then in from the other side — so the direction of travel matches
    // the arrow that was pressed.
    slide.value = withTiming(-direction * 24, { duration: Duration.tabSwitch / 2, easing: Ease.exit });
    fade.value = withTiming(0, { duration: Duration.tabSwitch / 2, easing: Ease.exit }, () => {
      slide.value = direction * 24;
      slide.value = withTiming(0, { duration: Duration.tabSwitch, easing: Ease.enter });
      fade.value = withTiming(1, { duration: Duration.tabSwitch, easing: Ease.enter });
    });
    setPageIndex(next);
  }

  // Which list a quick-added item lands in. `addTargetIndex` 0 is this week's list and i>0
  // is monthlyLists[i-1] — see its declaration.
  const addTargetName =
    addTargetIndex === 0
      ? t.home.weeklyListChip
      : monthlyLists[addTargetIndex - 1]?.name ?? t.home.weeklyListChip;

  /**
   * Pick a destination list, replacing a chip that cycled to the next one on every tap.
   * A cycle was already opaque with two stops; with a monthly list per household category
   * it could be five, forward-only, with the current stop the only one ever visible.
   */
  function pickAddTarget() {
    tap();
    showAppModal(
      t.home.addToListLabel,
      undefined,
      [
        { text: t.home.weeklyListChip, onPress: () => setAddTargetIndex(0) },
        ...monthlyLists.map((list, i) => ({
          text: list.name,
          onPress: () => setAddTargetIndex(i + 1),
        })),
        { text: t.cancel, style: 'cancel' as const },
      ]
    );
  }

  function commitAdd() {
    const name = addDraft.trim();
    if (!name || !onAddItem) return;
    const monthlyListId = addTargetIndex > 0 ? monthlyLists[addTargetIndex - 1]?.id : undefined;
    onAddItem(name, addQty, monthlyListId);
    setAddDraft('');
    setAddQty(1);
    setAddTargetIndex(0);
  }

  // Ticking flies the row to the card's count badge — there's no "In cart" section card left to
  // land on, and the badge is always mounted whenever there's an item to tick.
  function handleToggle(item: ShoppingItem) {
    if (reducedMotion || !onFlightStart) { onToggle(item.id); return; }
    const rowNode = rowNodes.current.get(item.id);
    const badgeNode = badgeRef.current;
    if (!rowNode?.measureInWindow || !badgeNode?.measureInWindow) { onToggle(item.id); return; }
    rowNode.measureInWindow((x: number, y: number, width: number, height: number) => {
      badgeNode.measureInWindow((bx: number, by: number, bw: number, bh: number) => {
        onFlightStart(item, { x, y, width, height }, { x: bx, y: by, width: bw, height: bh });
        onToggle(item.id);
      });
    });
  }

  const typeRow = onAddItem ? (
    <PadTypeRow
      prompt={t.pad.type.item}
      value={addDraft}
      onChangeText={setAddDraft}
      onSubmit={commitAdd}
      accent={screenColor.base}
      // The labelled panel, not the inline `extras` row (2026-08-05) — same move as
      // components/HomeNotesCard.tsx, so all four Home cards and their tabs now share one
      // quick-add anatomy (DESIGN_RULES.md rule 8). It also gives the title input the whole
      // line above, which it needs now that it draws as a real bordered field.
      panel={
        <QuickAddOptionsPanel>
          <QuickAddOptionRow
            icon="layers-outline"
            label={t.home.quantityLabel}
            value={
              <Stepper
                value={addQty}
                onChange={setAddQty}
                min={1}
                max={99}
                accessibilityLabel={t.home.quantityLabel}
              />
            }
            accent={screenColor.base}
          />
          {/* Was a chip that cycled forward through the lists on tap — the same blind
              tap-cycle as the energy and repeat rows, and worse here because the number of
              stops depends on how many monthly lists exist. It opens a picker now, so every
              destination is one tap away and visible before you commit to it. */}
          <QuickAddOptionRow
            icon={addTargetIndex === 0 ? 'calendar-outline' : 'file-tray-full-outline'}
            label={t.home.addToListLabel}
            value={addTargetName}
            isSet
            accent={screenColor.base}
            onPress={pickAddTarget}
            showsMore
            accessibilityLabel={`${t.home.addToListLabel}: ${addTargetName}`}
          />
        </QuickAddOptionsPanel>
      }
    />
  ) : null;

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={screenColor.base}
      style={[styles.card, state !== 'open' && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>
        {/* Header: badge + title, then the week arrows on their own row so the week label has
            the full width and can't be squeezed between two buttons. This card already had a
            coloured count badge (the flight-animation target items fly to when ticked off) —
            DESIGN_COMPARISON/09 folds the old grey "{left}/{total} left" sentence into that
            SAME badge rather than adding a second pill beside the title: two domain-hued count
            chips in one header would be more chrome than the sentence it replaced, not less. */}
        <View style={styles.header}>
          <PressableScale onPress={onNavigateToShopping} style={styles.headerLeft} scaleTo={0.98}>
            <CardAccentBadge domain="shop" size={32} accentOverride={screenColor.base} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {t.shoppingTitle}
              </Text>
            </View>
          </PressableScale>
          {totalCount > 0 && (
            <View
              ref={badgeRef}
              style={[styles.badge, { backgroundColor: screenColor.soft, borderColor: rgba(screenColor.base, 0.4) }]}
              accessibilityLabel={t.pad.summary(progress.remaining, progress.total)}
            >
              {/* Count badge: hue as the plate + edge (a fill), the figure in plain ink. Shows
                  {remaining}/{total} (2026-08-04, DESIGN_COMPARISON/09) — was the bare list
                  total; the flight-animation target (handleToggle's badgeRef) is unchanged,
                  only the label drew differently. */}
              <Text style={[styles.badgeText, { color: theme.text }]}>
                {progress.remaining}/{progress.total}
              </Text>
            </View>
          )}
          {cardMenu ? <CardMenuButton cardTitle={t.shoppingTitle} {...cardMenu} /> : null}
        </View>

        {/* Week pager. Both arrows always enabled — the pager wraps, so there is no dead end. */}
        <View style={styles.weekRow}>
          <IconButton
            icon="chevron-back"
            label={t.shoppingWeekPrev}
            onPress={() => step(-1)}
            size={32}
            borderColor={pagerButtonBorder}
          />
          <View style={styles.weekLabelWrap}>
            <Text style={[styles.weekLabel, { color: theme.text }]} numberOfLines={1}>
              {t.weekNumberChip(page?.week ?? 1)}
            </Text>
            <Text style={[styles.weekRange, { color: theme.textMuted }]} numberOfLines={1}>
              {page ? formatRange(page.range.startDate, page.range.endDate) : ''}
            </Text>
          </View>
          <IconButton
            icon="chevron-forward"
            label={t.shoppingWeekNext}
            onPress={() => step(1)}
            size={32}
            borderColor={pagerButtonBorder}
          />
        </View>

        {totalCount > 0 && (
          <ProgressBar value={progress.pct} color={screenColor.base} height={4} style={styles.progressBar} />
        )}

        {pace && (
          <Text
            style={[styles.paceText, { color: pace.overPace ? theme.warn : theme.good }]}
            numberOfLines={1}
          >
            {t.budget.perDaySpend(String(Math.round(pace.actualPerDay)), String(Math.round(pace.budgetedPerDay)))}
          </Text>
        )}

        <Animated.View style={pageStyle}>
          {!page?.list ? (
            // A week with no list is a real state, not an error — say so and offer the way in.
            <Text style={[styles.emptyExplainer, { color: theme.textMuted }]}>{t.weekSectionEmpty}</Text>
          ) : null}

          <PadSheet
            state={state}
            typeRow={typeRow}
            footer={
              cartRows.length > 0 ? (
                <View>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                    {t.inKurvenSection(cartRows.length)}
                  </Text>
                  {cartRows.map((item) => (
                    <PadRow
                      key={item.id}
                      title={item.name}
                      accent={screenColor.base}
                      done
                      rightValue={item.amount ? `${item.amount}${item.unit ? ` ${item.unit}` : ''}` : undefined}
                      onPress={() => setDetailItem(item)}
                      onAction={() => { tap(); onCollect(item.id); }}
                      actionLabel={t.doneShoppingBtn}
                      onToggle={() => onToggle(item.id)}
                      toggleLabel={item.name}
                    />
                  ))}
                </View>
              ) : null
            }
          >
            {visibleRows.map(({ item, dishName }) => (
              <View
                key={item.id}
                ref={(node) => {
                  if (node) rowNodes.current.set(item.id, node);
                  else rowNodes.current.delete(item.id);
                }}
              >
                <PadRow
                  title={item.name}
                  accent={screenColor.base}
                  // A dish is the row's ONE meta line now — not an ExpandableCard around it.
                  meta={
                    dishName ? (
                      <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
                        {dishName}
                      </Text>
                    ) : undefined
                  }
                  // Quantity READS here; ShoppingItemSheet is the only place it's edited.
                  rightValue={item.amount ? `${item.amount}${item.unit ? ` ${item.unit}` : ''}` : undefined}
                  onPress={() => setDetailItem(item)}
                  onAction={() => { tap(); onRemove(item); }}
                  actionLabel={t.removeItemLabel}
                  onToggle={() => handleToggle(item)}
                  toggleLabel={item.name}
                />
              </View>
            ))}
          </PadSheet>
        </Animated.View>

        <PadFooterToggle
          state={state}
          onChange={setState}
          total={listRows.length}
        />

        {/* Explainer at the FOOT (2026-07-30). This was a two-line bullet list ("Weekly list
            for groceries." / "Monthly list for what the house needs.") wedged between the week
            pager and the type line — the single biggest block of teaching on Home. It is one
            short line now, below the content. */}
        {totalCount === 0 ? <CardHintNote text={t.starters.shopping.text} noBorder /> : null}
      </View>

      <ShoppingItemSheet
        visible={detailItem !== null}
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  // No vertical margin (2026-08-08): the list that stacks these owns the gap
  // (`SCREEN_GAP`, constants/theme.ts). Was `marginBottom: Spacing.sm`.
  card: { borderRadius: Radius.md },
  // Minimum height for the CLOSED and PREVIEW states, never for OPEN (maintainer's call,
  // 2026-07-30): the four cards read as one intentional size at rest, and an open card is free
  // to grow to whatever its content needs. Same constant, and the same "only while not fully
  // open" gate, the pre-pad card used — `state !== 'open'` is what `!expanded` used to mean.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // ONE horizontal inset for the whole card — see PlanTaskCard's cardContent note.
  cardContent: { paddingHorizontal: PAD_GUTTER, paddingTop: PAD_GUTTER, paddingBottom: PAD_GUTTER },
  // Spacing.lg (was .md, matching HomeHabitsCard/PlanTaskCard/HomeNotesCard's header gap —
  // 2026-07-30, user report: content below still read as crowding the colored badge at .md).
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: Fonts.bold,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
  // Tabular figures (2026-08-04, DESIGN_COMPARISON/09) — the label is now a "{remaining}/{total}"
  // fraction that updates as items fly in, so its digits must not shift width tick to tick.
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold, ...TabularNums },
  // The week label gets the middle of its own row, with an arrow either side. `flex: 1` and no
  // minWidth on the label (see AGENTS.md's wrap-audit lesson) so it shrinks rather than pushing
  // an arrow off the card at 360px.
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  weekLabelWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  weekLabel: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  weekRange: { fontSize: FontSize.xs, fontFamily: Fonts.regular, ...TabularNums },
  progressBar: { marginBottom: Spacing.xs },
  paceText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
  // Still used by the "no list for this week" line; the bulb + two-bullet block it used to
  // share styles with became a foot-of-card CardHintNote (2026-07-30).
  emptyExplainer: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  metaText: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.regular },
  // Uppercase is capped at ≤13px labels (2026-07-28 design review) — FontSize.xs is 12.
  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingTop: Spacing.sm,
  },
});
