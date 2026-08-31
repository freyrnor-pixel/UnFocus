/**
 * design-lab/index.tsx — the playground: empty screens, empty cards, build what you want.
 *
 * The lab's first cut could open one of eleven pre-filled cards, in a box pinned to the top of
 * a screen of knobs. It answered *"is this token wrong?"* well and *"here is the card I want"*
 * not at all — there was no blank card (the sanitizer deleted one), no way to see a card in the
 * context of a screen, and no screen. This is the answer to the other question: the app's own
 * shell, with nothing in it, that you put things into.
 *
 * **What is real here and what is the lab's.** The header, the backdrop, the per-screen border
 * hue and the bottom nav are the app's own — `BottomNav` is the shipped component driven by a
 * synthetic navigator, not a lookalike, and every part on every card is the real control. What
 * the lab owns is the ARRANGEMENT: which cards are on a screen, and where the parts sit on
 * them. That line is why placement is a four-column grid rather than a coordinate — see
 * components/DesignLabCard.tsx.
 *
 * Connections:
 *   Imports → components/{ScreenScaffold,Surface,Button,PressableScale,BottomNav,DesignLabCard,
 *             PartPalette,PartControls,CardStarterSheet,DraggableTaskRow,FormControls,AppModal},
 *             constants/theme, lib/{designLab,designLabEdit,designLabPlace,useDesignLab,
 *             useDragReorder,siteNav,screenColor,useAppTheme,i18n,haptics}
 *   Used by → app/settings.tsx (Advanced tab, a link gated on featureDesignLab). The route is
 *             still `/design-lab` — this is the directory's index, so that link is unchanged.
 *   Data    → reads/writes `settings.designLab` through `useLabDraft` (debounced). Reads
 *             nothing else and writes nothing else: no task, habit, note or health row is
 *             touched from this screen, and the nav here navigates the LAB, never the app.
 *
 * Edit notes:
 *   - **One header, not two.** `ScreenScaffold tier="sub"` already draws a header with a back
 *     arrow; a second app-looking header under it would be two title bars and ~120px of chrome
 *     above the thing being judged. The scaffold's own title changes with the playground screen
 *     instead, and the back arrow always leaves the lab.
 *   - **`bottomNav={false}` and the bar is rendered here**, absolutely positioned the way
 *     app/(tabs)/_layout.tsx's `PagerFloatingNav` does it. `ScreenScaffold` only reserves bottom
 *     clearance for `tier === 'site'`, so this screen adds its own — from
 *     `BOTTOM_NAV_HEIGHT + NAV_FLOAT_GAP + insets.bottom`, never a hardcoded sum.
 *   - **Screens are seeded lazily.** Tapping a nav item does not write anything; the
 *     `ScreenSpec` is minted the first time something is put on it. That keeps an idle visit to
 *     the lab a genuine no-op, which is what "it is a question, not a setting" means here.
 *   - **One card is selected at a time, and the shelf and the panel act on it.** A drag never
 *     crosses cards — the inspector could not express that move either, and the measured drop
 *     targets belong to whichever card reported last.
 *   - **Every drag has a tap equivalent, and that is not optional.** Playwright cannot activate
 *     `activateAfterLongPress` in the web build at all, so a drag-only capability is one no
 *     automated check in this repo can reach. Adding is a shelf tap, moving between row
 *     positions is the panel's slot pills, moving on the grid is its row/width pills.
 *   - **Undo is one step and lives in memory.** Every edit op returns a whole new bag, so
 *     keeping the previous one before a destructive change is free. It is deliberately not
 *     stored: a build-freely tool needs a way back from an accident, not a history.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import BottomNav, { NAV_FLOAT_GAP, NAV_PAINTED_HEIGHT } from '@/components/BottomNav';
import DesignLabCard, { type BodyMetrics, type SlotRect } from '@/components/DesignLabCard';
import PartPalette from '@/components/PartPalette';
import PartControls from '@/components/PartControls';
import CardStarterSheet from '@/components/CardStarterSheet';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import { Input, SegmentedControl } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import {
  SLOTS_FOR_KIND,
  isPlaceableSlot,
  slotAtPoint,
  type CardOrigin,
  type CardPart,
  type LabOverrides,
  type PartKind,
  type PartSlot,
  type PlaygroundCard,
  type ScreenSpec,
} from '@/lib/designLab';
import {
  addCard,
  addPart,
  addScreen,
  duplicateCard,
  findScreenFor,
  movePartToCell,
  movePartToSlot,
  removeCard,
  removePart,
  reorderCards,
  updateCard,
  updatePart,
  type CardRef,
} from '@/lib/designLabEdit';
import { bodyCellAtPoint, layoutBodyParts, type BodyCell } from '@/lib/designLabPlace';
import { useLabDraft } from '@/lib/useDesignLab';
import { useDragReorder } from '@/lib/useDragReorder';
import { SITE_ITEMS, TAB_ROUTE_NAME } from '@/lib/siteNav';
import { type ScreenKey } from '@/lib/screenColor';
import { FontSize, Fonts, HitSlop, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

/** The screens the playground offers, in bottom-nav order. These ARE `lib/screenColor` keys. */
const LAB_SCREENS = SITE_ITEMS.map((item) => TAB_ROUTE_NAME[item.route] as string);

const MODE_BAR_HEIGHT = 56;

export default function DesignLabScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { draft, commit, flush } = useLabDraft();

  const [screenKey, setScreenKey] = useState<string>('index');
  const [editing, setEditing] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [startingCard, setStartingCard] = useState(false);
  const [undoBag, setUndoBag] = useState<LabOverrides | null>(null);

  const screen = useMemo(() => findScreenFor(draft, screenKey), [draft, screenKey]);
  const cards = screen?.cards ?? [];
  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null;
  const selectedPart = selectedCard?.parts.find((p) => p.id === selectedPartId) ?? null;
  const at: CardRef | null = screen && selectedCard
    ? { screenId: screen.id, cardId: selectedCard.id }
    : null;

  const navItem = SITE_ITEMS.find((item) => TAB_ROUTE_NAME[item.route] === screenKey);
  const screenTitle = screen?.title?.trim() || (navItem ? t.nav[navItem.key] : t.designLab.title);

  // ── Writing ────────────────────────────────────────────────────────────────

  /** Remember the bag before anything destructive, so one step back is always available. */
  const guarded = (next: LabOverrides) => {
    setUndoBag(draft);
    commit(next);
    flush();
  };

  const undo = () => {
    if (!undoBag) return;
    commit(undoBag);
    flush();
    setUndoBag(null);
    setSelectedPartId(null);
  };

  /** The screen's spec, minted now if this is the first thing being put on it. */
  const ensureScreen = (): { bag: LabOverrides; screen: ScreenSpec } | null => {
    const existing = findScreenFor(draft, screenKey);
    if (existing) return { bag: draft, screen: existing };
    const made = addScreen(draft, screenKey);
    if (!made.screenId) return null;
    const seeded = findScreenFor(made.next, screenKey);
    return seeded ? { bag: made.next, screen: seeded } : null;
  };

  const onStartCard = (origin: CardOrigin) => {
    setStartingCard(false);
    const base = ensureScreen();
    if (!base) {
      showAppModal(t.designLab.title, t.designLab.playground.screenCap);
      return;
    }
    const made = addCard(base.bag, base.screen.id, origin);
    if (!made.cardId) {
      showAppModal(t.designLab.title, t.designLab.playground.cardCap);
      return;
    }
    commit(made.next);
    flush();
    setSelectedCardId(made.cardId);
    setSelectedPartId(null);
  };

  const onAddPart = (kind: PartKind, slot?: PartSlot, cell?: BodyCell) => {
    if (!at) return;
    const made = addPart(draft, at, kind, slot);
    if (!made.partId) {
      showAppModal(t.designLab.title, t.designLab.playground.partCap);
      return;
    }
    // Placed in a second step so the drop lands where the finger let go rather than at the
    // kind's default cell — `placePart` needs the part to already be in the list to size it.
    const next = cell ? movePartToCell(made.next, at, made.partId, cell) : made.next;
    commit(next);
    flush();
    setSelectedPartId(made.partId);
  };

  const onChangePart = (next: CardPart) => {
    if (!at) return;
    commit(updatePart(draft, at, next));
  };

  const onRemovePart = (partId: string) => {
    if (!at) return;
    guarded(removePart(draft, at, partId));
    setSelectedPartId(null);
  };

  const onRemoveCard = (cardId: string) => {
    if (!screen) return;
    guarded(removeCard(draft, { screenId: screen.id, cardId }));
    setSelectedCardId(null);
    setSelectedPartId(null);
  };

  const onDuplicateCard = (cardId: string) => {
    if (!screen) return;
    const made = duplicateCard(draft, { screenId: screen.id, cardId });
    if (!made.cardId) {
      showAppModal(t.designLab.title, t.designLab.playground.cardCap);
      return;
    }
    commit(made.next);
    flush();
    setSelectedCardId(made.cardId);
  };

  // ── The drag, owned here so the card and the shelf share one ───────────────
  // Both drags answer the same question — where is the finger — against the same measured
  // boxes, which is the whole reason a shelf chip can be dropped into a position inside a
  // real PadRow, or onto a cell of the body grid.

  const slotRects = useRef<Partial<Record<PartSlot, SlotRect>>>({});
  const bodyMetrics = useRef<BodyMetrics | null>(null);
  const [drag, setDrag] = useState<{ kind: PartKind; partId?: string } | null>(null);
  const [dropSlot, setDropSlot] = useState<PartSlot | null>(null);
  const [dropCell, setDropCell] = useState<BodyCell | null>(null);
  // Gesture callbacks can be held by a handler attached on an earlier render, so what they
  // read comes off refs rather than out of a closure — the rule lib/useDragReorder.ts
  // documents. A stale value here means every move reads null and the drop does nothing.
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dropSlotRef = useRef(dropSlot);
  dropSlotRef.current = dropSlot;
  const dropCellRef = useRef(dropCell);
  dropCellRef.current = dropCell;

  const onDragMove = (x: number, y: number) => {
    const active = dragRef.current;
    if (!active) return;
    // The body grid wins where the two overlap: it is the more specific answer, and it is only
    // consulted for a kind that can live in the card's own space at all — dropping a check on
    // the body would otherwise report a cell the part can never take.
    const metrics = bodyMetrics.current;
    const cell = metrics && SLOTS_FOR_KIND[active.kind].some(isPlaceableSlot)
      ? bodyCellAtPoint(metrics.body, metrics.rows, x, y)
      : null;
    const slot = cell ? null : slotAtPoint(active.kind, slotRects.current, x, y);
    setDropCell((prev) => (sameCell(prev, cell) ? prev : cell));
    setDropSlot((prev) => (prev === slot ? prev : slot));
  };

  /** Commit on drop, once — the same rule lib/useDragReorder.ts follows. */
  const onDragEnd = () => {
    const active = dragRef.current;
    const slot = dropSlotRef.current;
    const cell = dropCellRef.current;
    if (active && at) {
      if (active.partId && cell) commit(movePartToCell(draft, at, active.partId, cell));
      else if (active.partId && slot) commit(movePartToSlot(draft, at, active.partId, slot));
      else if (!active.partId && cell) onAddPart(active.kind, 'body', cell);
      else if (!active.partId && slot) onAddPart(active.kind, slot);
    }
    flush();
    setDrag(null);
    setDropSlot(null);
    setDropCell(null);
  };

  const onBodyMetrics = useCallback((metrics: BodyMetrics) => {
    bodyMetrics.current = metrics;
  }, []);

  // ── Chrome ─────────────────────────────────────────────────────────────────

  // The shipped nav, on a synthetic navigator — the same shape app/(tabs)/_layout.tsx's
  // PagerFloatingNav uses. It moves between LAB screens; it never navigates the real app.
  const navState = useMemo(
    () => ({ index: 0, routes: [{ key: screenKey, name: screenKey }] }),
    [screenKey],
  );
  const navigation = useRef({
    navigate: (routeName: string) => {
      if (!LAB_SCREENS.includes(routeName)) return;
      selection();
      setScreenKey(routeName);
      setSelectedCardId(null);
      setSelectedPartId(null);
    },
  }).current;

  const modeBar = (
    <View style={[styles.modeWrap, { backgroundColor: theme.bg }]}>
      <SegmentedControl
        value={editing ? 'build' : 'use'}
        onChange={(v) => {
          selection();
          setEditing(v === 'build');
          setSelectedPartId(null);
        }}
        options={[
          { value: 'build', label: t.designLab.playground.build },
          { value: 'use', label: t.designLab.playground.use },
        ]}
      />
    </View>
  );

  const navClearance = NAV_PAINTED_HEIGHT + NAV_FLOAT_GAP + insets.bottom;

  return (
    <View style={styles.root}>
      <ScreenScaffold
        title={screenTitle}
        tier="sub"
        onBack={() => { flush(); router.back(); }}
        screenKey={screenKey as ScreenKey}
        bottomNav={false}
        stickyGapColor="transparent"
        stickyBelowHeader={modeBar}
        stickyBelowHeaderHeight={MODE_BAR_HEIGHT}
        headerRight={(
          <PressableScale
            onPress={() => { flush(); router.push('/design-lab/tokens'); }}
            scaleTo={0.9}
            hitSlop={HitSlop.base}
            accessibilityRole="button"
            accessibilityLabel={t.designLab.tokensTitle}
          >
            <Ionicons name="color-palette-outline" size={20} color={theme.textMuted} />
          </PressableScale>
        )}
      >
        <View style={[styles.page, { paddingBottom: navClearance }]}>
          <CardList
            cards={cards}
            screenKey={screenKey}
            editing={editing}
            selectedCardId={selectedCardId}
            selectedPartId={selectedPartId}
            dropSlot={dropSlot}
            dropCell={dropCell}
            dragging={!!drag}
            onSelectCard={(id) => { selection(); setSelectedCardId(id); setSelectedPartId(null); }}
            onSelectPart={setSelectedPartId}
            onSlotRect={(rect) => { slotRects.current[rect.slot] = rect; }}
            onBodyMetrics={onBodyMetrics}
            onDragStart={(cardId, partId) => {
              const part = cards.find((c) => c.id === cardId)?.parts.find((p) => p.id === partId);
              if (!part) return;
              setSelectedCardId(cardId);
              setDrag({ kind: part.kind, partId });
            }}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onReorder={(ids) => { if (screen) commit(reorderCards(draft, screen.id, ids)); }}
            // The panel is handed to the LIST rather than drawn after it, so it lands
            // immediately under the card it is about. Below the add-card row it would be two
            // rows away with one card and half a screen away with four.
            inspector={editing && selectedCard ? (
              <CardInspector
                card={selectedCard}
                part={selectedPart}
                onAddPart={(kind) => onAddPart(kind)}
                onDragStart={(kind) => setDrag({ kind })}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                draggingKind={drag && !drag.partId ? drag.kind : null}
                onChangePart={onChangePart}
                onRemovePart={onRemovePart}
                onClosePart={() => setSelectedPartId(null)}
                onRename={(title) => { if (at) commit(updateCard(draft, at, { title })); }}
                onNote={(note) => { if (at) commit(updateCard(draft, at, { note })); }}
                onDuplicate={() => onDuplicateCard(selectedCard.id)}
                onRemove={() => onRemoveCard(selectedCard.id)}
                onBlur={flush}
              />
            ) : null}
          />

          {cards.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              {t.designLab.playground.emptyScreen}
            </Text>
          ) : null}

          {/* At the BOTTOM of the list it appends to — the placement rule
              components/NewMonthlyListRow.tsx set and AGENTS.md spells out. */}
          <PressableScale
            onPress={() => { selection(); setStartingCard(true); }}
            scaleTo={0.97}
            accessibilityRole="button"
            style={[styles.addCard, { borderColor: theme.border }]}
          >
            <Ionicons name="add" size={18} color={theme.accent} />
            <Text style={[styles.addCardLabel, { color: theme.accent }]}>
              {t.designLab.playground.addCard}
            </Text>
          </PressableScale>

          {undoBag ? (
            <Button label={t.undoBtn} onPress={undo} variant="ghost" size="sm" icon="arrow-undo-outline" />
          ) : null}

          <View style={{ height: Spacing.xl }} />
        </View>
      </ScreenScaffold>

      {/* The app's real bar, floated the way the pager floats it. `box-none` so the transparent
          margin around it doesn't swallow touches meant for the cards scrolling underneath. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.navWrap,
          {
            height: navClearance,
            paddingBottom: insets.bottom + NAV_FLOAT_GAP,
            paddingHorizontal: NAV_FLOAT_GAP,
          },
        ]}
      >
        <BottomNav state={navState as never} navigation={navigation as never} />
      </View>

      <CardStarterSheet
        visible={startingCard}
        onClose={() => setStartingCard(false)}
        onPick={onStartCard}
      />
    </View>
  );
}

/** True when two drop cells mean the same thing — keeps a move from re-rendering per pixel. */
function sameCell(a: BodyCell | null, b: BodyCell | null): boolean {
  if (!a || !b) return a === b;
  return a.row === b.row && a.col === b.col && a.insert === b.insert;
}

/**
 * The screen's cards, in order, reorderable by the app's universal hold-and-drag.
 *
 * Only the SELECTED card is drawn in edit mode. A screen of cards all wearing selection rings
 * would be unreadable, and the shelf and the panel act on one card anyway — so the others
 * render exactly as the app would draw them, which is also a useful thing to see.
 */
function CardList({
  cards,
  screenKey,
  editing,
  selectedCardId,
  selectedPartId,
  dropSlot,
  dropCell,
  dragging,
  onSelectCard,
  onSelectPart,
  onSlotRect,
  onBodyMetrics,
  onDragStart,
  onDragMove,
  onDragEnd,
  onReorder,
  inspector,
}: {
  cards: PlaygroundCard[];
  screenKey: string;
  editing: boolean;
  selectedCardId: string | null;
  selectedPartId: string | null;
  dropSlot: PartSlot | null;
  dropCell: BodyCell | null;
  dragging: boolean;
  onSelectCard: (id: string) => void;
  onSelectPart: (id: string) => void;
  onSlotRect: (rect: SlotRect) => void;
  onBodyMetrics: (metrics: BodyMetrics) => void;
  onDragStart: (cardId: string, partId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onReorder: (ids: string[]) => void;
  /** Drawn immediately after the selected card — the panel belongs to a card, not to a page. */
  inspector?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const t = useT();
  const drag = useDragReorder(cards.map((c) => c.id), onReorder);
  const byId = new Map(cards.map((c) => [c.id, c]));

  /** What to call a card out loud. Its own name, else what it was started from — never the
   *  raw origin id, which is storage vocabulary and was reaching the screen reader as "blank". */
  const cardName = (card: PlaygroundCard) => {
    if (card.title.trim()) return card.title;
    const starter = t.designLab.playground.starters[card.origin as keyof typeof t.designLab.playground.starters];
    return starter ?? t.designLab.cards[card.origin as keyof typeof t.designLab.cards] ?? card.id;
  };

  return (
    <>
      {/* Render in the hook's order, not the store's — that is what moves under the finger. */}
      {drag.order.map((id) => {
        const card = byId.get(id);
        if (!card) return null;
        const active = editing && card.id === selectedCardId;
        return (
          <React.Fragment key={id}>
          <DraggableTaskRow isOpen={false} {...drag.rowProps(id)}>
            <View style={[styles.cardWrap, active && { borderColor: theme.accent }]}>
              <PressableScale
                onPress={() => onSelectCard(card.id)}
                scaleTo={1}
                haptic={false}
                disabled={!editing}
                accessibilityRole="button"
                accessibilityLabel={cardName(card)}
              >
                <DesignLabCard
                  origin={card.origin}
                  screen={screenKey}
                  spec={{ parts: card.parts, note: card.note }}
                  editing={active}
                  selectedPartId={active ? selectedPartId ?? undefined : undefined}
                  onSelect={onSelectPart}
                  onSlotRect={active ? onSlotRect : undefined}
                  onBodyMetrics={active ? onBodyMetrics : undefined}
                  onDragStart={(partId) => onDragStart(card.id, partId)}
                  onDragMove={onDragMove}
                  onDragEnd={onDragEnd}
                  dropSlot={active ? dropSlot : null}
                  dropCell={active ? dropCell : null}
                  dragging={active && dragging}
                />
              </PressableScale>
            </View>
          </DraggableTaskRow>
          {active ? inspector : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Everything you can do to the selected card, under it.
 *
 * Two states in one panel: with a part selected it is that part's controls; without one it is
 * the shelf plus the card's own name, note and actions. Keeping them in one place is what makes
 * "tap a thing, change it" the whole interaction — there is no mode to enter and nothing to
 * dismiss before the next edit.
 */
function CardInspector({
  card,
  part,
  onAddPart,
  onDragStart,
  onDragMove,
  onDragEnd,
  draggingKind,
  onChangePart,
  onRemovePart,
  onClosePart,
  onRename,
  onNote,
  onDuplicate,
  onRemove,
  onBlur,
}: {
  card: PlaygroundCard;
  part: CardPart | null;
  onAddPart: (kind: PartKind) => void;
  onDragStart: (kind: PartKind) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  draggingKind: PartKind | null;
  onChangePart: (next: CardPart) => void;
  onRemovePart: (id: string) => void;
  onClosePart: () => void;
  onRename: (title: string) => void;
  onNote: (note: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onBlur: () => void;
}) {
  const theme = useAppTheme();
  const t = useT();
  const bodyRows = layoutBodyParts(card.parts.filter((p) => p.slot === 'body')).length;

  if (part) {
    return (
      <Surface style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={[styles.panelTitle, { color: theme.text }]} numberOfLines={1}>
            {t.designLab.editingPart(part.label || t.designLab.parts[part.kind])}
          </Text>
          <PressableScale
            onPress={() => { selection(); onClosePart(); }}
            scaleTo={0.9}
            hitSlop={HitSlop.base}
            accessibilityRole="button"
            accessibilityLabel={t.designLab.color.close}
          >
            <Ionicons name="close" size={18} color={theme.textMuted} />
          </PressableScale>
        </View>
        <PartControls part={part} onChange={onChangePart} bodyRows={bodyRows} />
        <Button
          label={t.designLab.removePart}
          onPress={() => onRemovePart(part.id)}
          variant="ghost"
          size="sm"
        />
      </Surface>
    );
  }

  return (
    <>
      <PartPalette
        onAdd={onAddPart}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        draggingKind={draggingKind}
      />
      <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.selectHint}</Text>
      <Surface style={styles.panel}>
        <Input
          label={t.designLab.playground.cardName}
          placeholder={t.designLab.playground.cardNamePlaceholder}
          value={card.title}
          onChangeText={onRename}
          onBlur={onBlur}
        />
        <Input
          label={t.designLab.cardNoteLabel}
          placeholder={t.designLab.cardNotePlaceholder}
          value={card.note}
          onChangeText={onNote}
          onBlur={onBlur}
          multiline
        />
        <View style={styles.panelActions}>
          <Button label={t.designLab.playground.duplicateCard} onPress={onDuplicate} variant="ghost" size="sm" />
          <Button label={t.designLab.playground.removeCard} onPress={onRemove} variant="ghost" size="sm" />
        </View>
      </Surface>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  hint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular, paddingVertical: Spacing.md },
  // A ring that is always present and only changes colour, so selecting a card cannot reflow
  // the screen it is on — the same rule the part rings inside the card follow.
  cardWrap: { borderWidth: 1, borderColor: 'transparent', borderRadius: Radius.md + 2, padding: 1 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCardLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  panel: { padding: Spacing.md, gap: Spacing.sm },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  panelTitle: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  panelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  // Positioned chrome: the scroll body passes underneath it, so it carries an opaque fill.
  modeWrap: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs, justifyContent: 'center', flex: 1 },
  navWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 100 },
});
