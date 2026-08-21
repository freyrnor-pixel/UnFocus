/**
 * CatalogueTab.tsx — the master item catalogue's list UI.
 *
 * The master list of known items (store_items via useCatalogStore), rendered as one
 * flat list sorted alphabetically by name (Decision, visual-audit 2026-07-11 —
 * previously sectioned by item type; flattened since a single glance-sorted list is
 * faster to scan than hunting through category headers). Each existing row shows name + price,
 * a "+" that pushes the item onto a shopping list, is tappable to edit in place
 * (name/price/save), and has a delete button. The catalogue is the single basis both the week
 * lists and the Food screen draw item names/prices from (autocomplete), so edits here flow
 * everywhere.
 *
 * **The header is ONE box, and it is the search field (2026-08-20).** A "+" at its right opens
 * components/CatalogueAddSheet.tsx (adds a NEW catalogue item — distinct from a row's own "+",
 * which adds an EXISTING one to a list). The camera and the lock are `CatalogueHeaderControls`,
 * exported from this file and drawn by whichever HEADER the list sits under, at the same size
 * as every other header icon (2026-08-21 — they used to pass `size={22}` against the header's
 * other icons' default 36, which read as undersized next to the ⤢ expand button beside them).
 * A vertical A–Z scrubber down the right edge (hold-and-drag, contacts-style) jumps the list to
 * the first item under the touched letter — see the "Search + A–Z scrubber" edit note below.
 *
 * **A row's "+" (2026-08-21)** opens the same two-destination choice FoodTab's per-dish "+"
 * offers — "Add to week list" (the weekly Unallocated bucket) or "Add to monthly list" (asks
 * which list if there's more than one) — via `showAppModal` rather than a bespoke popup: this
 * is a one-off choice, not a composer, so the app's existing action-sheet control is the right
 * size for it. `pushItemToWeek`/`pushItemToMonthlyList` mirror FoodTab's
 * `handleAddToWeek`/`pushDishToMonthlyList` field-for-field (see that file for the shape).
 *
 * Connections:
 *   Imports → constants/theme (tokens), lib/useAppTheme, lib/i18n, lib/haptics (success/heavy/
 *             selection), lib/money (formatKr), lib/screenColor, components/Surface,
 *             components/PressableScale, components/IconButton, components/FormControls
 *             (Input), components/CatalogueAddSheet, components/AppModal (showAppModal),
 *             store/useCatalogStore, store/useShoppingStore (add + UNALLOCATED_LIST_ID),
 *             store/useMonthlyListStore (lists + monthlyListLabel), @expo/vector-icons
 *   Used by → app/catalogue.tsx (its own button-launched sub-screen as of 2026-07-23, UX
 *             audit F1 — was app/(tabs)/shopping.tsx's in-place "Catalogue" tab before that),
 *             with ScreenScaffold in scrollable={false} mode so THIS FlatList owns scrolling;
 *             app/(tabs)/shopping.tsx (the Katalog card, `embedded` — 2026-08-10);
 *             components/CardExpandHost.tsx (the same card grown to fill the screen).
 *             ⚠️ **All three own the `locked` state and pass it back down** — see that prop.
 *   Data    → useCatalogStore.addItem/updateItem/removeItem (+ items list); useShoppingStore.add
 *             + useMonthlyListStore.lists (a row's "+")
 *
 * Edit notes:
 *   - **⚠️ ONE box now, not two (2026-08-20).** The 2026-08-14 pass made the header two boxes
 *     — sort + camera + lock, then search + "+" — each box being its own control rather than a
 *     Surface wrapped around a second bordered thing. The maintainer removed the first box
 *     outright in the UI-consistency pass: *"just remove the tab slider for different
 *     filtering"* (the sort control is gone; the list is name-collated always) and *"the two
 *     buttons for camera and lock should be in the top part instead"* (they are
 *     `CatalogueHeaderControls`, in the host's header). With one control left there is no box
 *     left to draw, which is also what fixed the last of the reported *"box in box (textbox)"*:
 *     the field is now a single recessed well in BOTH modes, the same shape `FormControls`'
 *     `recessed` Input gives every other in-card composer. `shell`, `searchCard`, `sortCard`,
 *     `sortRow`, `sortControl` and `searchRowEmbedded` are all deleted.
 *     What still stands from 2026-08-14, and is worth not re-litigating: the search input's
 *     `theme.surfaceMuted` pill is not coming back (nothing else in the app fills a field with
 *     that token, which is why it read as foreign); `listHeader`'s `marginHorizontal` stays 0,
 *     so the field is exactly as wide as the rows under it; and the `components/AddRow.tsx`
 *     composer stays a "+" plus a pop-up, because this is the one list where a new row does not
 *     appear where you typed it.
 *   - **`embedded` (2026-08-10) — mounted inside Shopping's Catalogue drawer, not only on
 *     /catalogue.** Maintainer, against the drawer's old names-only preview: *"I would rather
 *     just the expanded state be like the screens."* So the drawer mounts THIS, and
 *     `components/SubScreenPreviewList.tsx` is deleted. Search, the "+" and its pop-up, the rows
 *     and tap-to-edit-in-place are the SAME code and the same state in both modes — what the
 *     drawer cannot host is the SHELL, and that is all the flag removes:
 *       · the FlatList → a `.map()` inside a height-capped, rounded `ScrollView`, because a
 *         FlatList inside Shopping's ScrollView is a nested same-axis VirtualizedList. ⚠️ The
 *         cap was a ROW COUNT (`EMBEDDED_ROWS = 8`) with an "and N more →" row out to the full
 *         screen until 2026-08-20; the maintainer asked for *"the list … rounded, and scrollable
 *         even when not in full screen"*, so the whole catalogue is here and the tail row —
 *         this card's last navigate-away — is gone. `EMBEDDED_MAX_HEIGHT` bounds the LAYOUT,
 *         not the render;
 *       · the A–Z scrubber → gone, it needs a full column of screen height to drag down;
 *       · the notepad container + grow-to-fill footer → the drawer's card IS the container,
 *         and there is no leftover viewport inside a drawer to soak up;
 *       · (the two header `Surface` wrappers are gone in BOTH modes since 2026-08-20 — the
 *         field draws its own well everywhere, so this is no longer something `embedded`
 *         removes);
 *       · the rows' `paddingHorizontal` and rounded first row → the drawer already pads by
 *         Spacing.md, and a third stacked inset is what wraps a long Norwegian item name.
 *     Rows deliberately keep this screen's divider-separated continuous run rather than
 *     becoming boxed PadRows — matching the destination is the entire reason the component is
 *     mounted here instead of summarised.
 *   - **Virtualised (perf, 2026-07-15)**: renders a real FlatList, so only ~10 rows mount
 *     at a time instead of all ~286 at once. The old version was a `.map()` inside the
 *     Shopping scaffold's shared ScrollView (a FlatList there would be a nested same-axis
 *     VirtualizedList), which fully mounted every row — each a PressableScale carrying its
 *     own Reanimated shared-value/animated-style, so ~570 animated nodes mounted per open
 *     and re-mounted on every tab switch. Now app/catalogue.tsx passes
 *     `scrollable={false}` to ScreenScaffold so this FlatList is the
 *     scroller. The old CATALOGUE_INITIAL_WINDOW / visibleCount / InteractionManager
 *     deferral is gone — virtualization caps the mounted-row count directly instead of just
 *     deferring the full expansion past the first frame.
 *   - **Rows are plain `Pressable`, not `PressableScale`**: at list scale the per-row spring
 *     bounce isn't worth a Reanimated node per row. This extends to the row's trash button —
 *     also a plain Pressable (opacity feedback) — since a PressableScale there means a
 *     Reanimated shared-value/animated-style node PLUS an AccessibilityInfo listener per row,
 *     ~10 of each built synchronously on first paint (part of the tab's open latency). Only the
 *     inline EDIT row's action buttons keep PressableScale (one edit row exists at a time).
 *     `CatalogueRow` is `React.memo`'d with stable callbacks (onStartEdit/onRemove from
 *     useCallback) so typing in the search field or entering edit mode only re-renders the affected
 *     row, not the whole visible window.
 *   - **No per-mount sort (perf, tab-open latency)**: `items` arrives already Norwegian-collated
 *     from useCatalogStore (sorted once in load(), kept sorted by every mutation), so this tab
 *     feeds `items` straight to the FlatList. The old `sortedItems` useMemo re-collated all ~286
 *     rows with localeCompare('no') on every mount — a synchronous beat every time the tab opened.
 *   - **`header` prop** (currently unused — app/catalogue.tsx passes none): when given,
 *     renders as the FlatList's ListHeaderComponent (above the two header boxes) so it scrolls with
 *     the list. Shopping's old in-place Catalogue tab used to hand in its shared hint card
 *     + SharedRequestsSection this way, back when this rendered as one of Shopping's own
 *     tabs outside the screen's normal padded content View.
 *   - New items are still authored into the 'other' category (no category picker in the add
 *     pop-up either, per the spec's "name, price, delete, save") — `category` is kept on the row (used
 *     by autocomplete elsewhere) even though this tab no longer groups/displays by it.
 *   - The add control sits at the TOP of this list (unlike Plans/Shopping's bottom-of-list
 *     AddRow) — deliberate exception: this is a long, alphabetized reference list, not a
 *     short append-order list, so a bottom add row would require scrolling on every add.
 *   - removeItem soft-deletes (see useCatalogStore) so deleting a seeded item sticks across
 *     a seed re-run (seeding is now version-gated, not per-load).
 *   - **No per-row border on the ROWS (2026-07-13, updated 2026-07-14)**: unlike WeekListCard,
 *     individual rows don't carry a screen-hued edge — this list is one long, continuous card,
 *     so a per-row outline would read as a loud frame at this scale. `screenHue` (was
 *     `domainColor.accent` until 2026-08-06 — see the inline note) is still used for the "+"
 *     button's fill AND the OUTER container's border + shadow (`cardOuter`,
 *     2026-07-24) — see the "Notepad container" note below.
 *   - **Grow-to-fill footer (visual-audit, 2026-07-17)**: a short catalogue (most seeded
 *     rows soft-deleted, or a fresh manually-built one) left the FlatList's own flex:1 tail
 *     as plain screen background between the last row and the bottom nav — read as a large
 *     "cut off" gap. `listContent` now carries `flexGrow: 1` and a `ListFooterComponent`
 *     filler (`listFiller`, same `theme.surface` fill, `flexGrow: 1`) soaks up any leftover
 *     viewport height so the card's rounded bottom edge sits near the nav regardless of item
 *     count. The bottom corner rounding moved from the actual last row (`rowLast`, now
 *     removed) onto this filler, since it's now the card's true visual end. The OTHER half of
 *     that same bug report — a large gap even on a FULL (287-row) catalogue, where the
 *     filler never engages since content already overflows the box — turned out to be
 *     ScreenScaffold's `contentPadding` double-reserving `BOTTOM_NAV_HEIGHT` on top of the
 *     clearance the tab pager already gives every `bottomNav={false}` screen; fixed there
 *     (see ScreenScaffold.tsx's own edit notes), not here.
 *   - **Search + A–Z scrubber (2026-07-19)**: a search `TextInput` (in the list header's second
 *     box) filters `items` → `displayItems` by case-insensitive substring; the FlatList renders
 *     `displayItems`. A vertical alphabet column (`indexBar`) sits as a sibling to the FlatList inside
 *     the notepad `card` (a `cardInner` row wraps both) — a fixed reserved gutter, not an absolute
 *     overlay, so long row names never run under it. A single `PanResponder` on the column maps the
 *     touch's ABSOLUTE screen Y (`gestureState.moveY` − the bar top captured on grant, NOT
 *     `nativeEvent.locationY` — locationY is relative to whichever view is under the finger, so it
 *     snaps to A/Å once the finger drifts sideways off the column) ÷ measured bar height × letter
 *     count to a letter, and `scrollToIndex`es the FlatList to that letter's first item (empty
 *     letters resolve forward, contacts-style). The
 *     responder + its helpers are stable (`useCallback([])` reading refs — `scrubRef` holds the latest
 *     letters/first-index map, `barHeightRef` the measured height) so the responder isn't rebuilt each
 *     render. `selection()` haptic + a centered letter bubble (`scrubBubble`) fire on each letter change.
 *     The scrubber is hidden while searching or when the list is short (`SCRUB_MIN_ITEMS`), since a
 *     jumbled/short list has nothing to scrub. No `getItemLayout` (rows aren't strictly fixed height —
 *     the inline edit row differs); `onScrollToIndexFailed` seeds an approximate offset then retries, the
 *     standard fallback for far jumps into not-yet-rendered rows under `removeClippedSubviews`.
 *   - **Notepad container (2026-07-18)**: the FlatList lives inside a rounded, `overflow:hidden`
 *     `card` View that ends ABOVE the bottom nav (root's `paddingBottom`), so the catalogue reads
 *     as a contained notepad sheet within the screen rather than running flush under the nav bar.
 *     The rounded, clipped bottom turns a long list's mid-scroll hard clip into a clean rounded
 *     edge. This replaced the old `LinearGradient` fade-to-`theme.bg` band, which painted a flat
 *     white/black strip over the colourful field and read as the list being "bordered off / cut
 *     off" behind the nav. Horizontal inset moved from `listContent` onto `root` so the clipping
 *     card aligns with the rows.
 *   - **Keyboard-avoidance (2026-07-31)**: this list has no ScrollIntoViewContext (it's the
 *     self-scrolling FlatList, `scrollable={false}` on the parent ScreenScaffold — see that
 *     component's own doc), so `startEdit` calls `flatListRef.scrollToIndex` itself instead,
 *     reusing the same ref the A–Z scrubber already drives. Don't drop this when editing —
 *     without it, editing a row past the first screenful hides the edit fields behind the
 *     keyboard on Android's `windowSoftInputMode=resize`.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import CatalogueAddSheet from '@/components/CatalogueAddSheet';
import IconButton from '@/components/IconButton';
import { useRouter } from 'expo-router';
import { Input } from '@/components/FormControls';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { useShoppingStore, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useMonthlyListStore, monthlyListLabel } from '@/store/useMonthlyListStore';
import { showAppModal } from '@/components/AppModal';
import { BORDER_WIDTH, computeBorderTone, Fonts, FontSize, getElevation, getFieldGlow, getRecessedField, HitSlop, IconSize, MIN_TAP_TARGET, OpticalCenter, Radius, Spacing, TabularNums } from '@/constants/theme';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { ThemePalette } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import { success, heavy, selection } from '@/lib/haptics';
import { formatKr } from '@/lib/money';
import { useScreenColor } from '@/lib/screenColor';

/** Fixed Norwegian alphabet for the A–Z scrubber (æ/ø/å after z). '#' is appended only when
 *  some item name starts with a non-letter, so digit/symbol rows are still reachable. */
const SCRUB_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
/** Below this row count the scrubber is hidden — a short list scrolls fine without it. */
const SCRUB_MIN_ITEMS = 12;

type Props = {
  onNotify: (msg: string) => void;
  /** Screen-owned chrome (hint card + shared requests) rendered above the header boxes. */
  header?: React.ReactNode;
  /**
   * Drawn inside a card rather than as the screen — Shopping's Catalogue drawer
   * (components/CollapsedSection.tsx). The search field, the "+" pop-up, the rows and the
   * tap-to-edit-in-place row are the SAME code and the same state; what the drawer cannot
   * host is the shell. A FlatList inside Shopping's ScrollView is a nested same-axis
   * VirtualizedList, and an A–Z scrubber needs a full column to drag down — so embedded
   * renders a capped, plain-mapped list with neither, and `onOpenFull` carries the rest.
   */
  embedded?: boolean;
  /**
   * ⚠️ **`onOpenFull` is gone (2026-08-20).** It was the "and N more →" tail row's handler, and
   * that row is deleted: the embedded list is complete and scrolls in place, so there is
   * nothing left for it to reveal. Growing this card to fill the screen is the header's ⤢
   * (components/CardExpandButton.tsx), which the HOST owns — this component never knew about it.
   */
  /**
   * The lock, hoisted to the HOST (2026-08-20). The camera and the lock are drawn by
   * `CatalogueHeaderControls` in whatever header this list is sitting under — Shopping's
   * SectionCard header, or /catalogue's ScreenHeader — so the state has to live where that
   * header is. This component only READS it, to decide whether a row shows its trash.
   */
  locked: boolean;
};

/** How tall the embedded list may grow before it scrolls inside itself (2026-08-20).
 *
 *  It replaced `EMBEDDED_ROWS = 8`, which CUT the list at eight rows and offered an "and N more"
 *  row that navigated to the full screen. The list is complete here now; this is the only thing
 *  stopping it from burying everything below it on the Shop tab. A height rather than a row
 *  count on purpose — a row's height moves with the user's text-size setting, so eight rows is
 *  a different amount of screen for different people, and what matters here is how much of the
 *  tab this card is allowed to take. */
const EMBEDDED_MAX_HEIGHT = 320;

type Styles = ReturnType<typeof useScaledStyles<typeof baseStyles>>;

/**
 * One display-mode catalogue row. Memoised + fed stable callbacks so typing in the add
 * row / entering edit mode doesn't re-render every visible row. Plain Pressable (no
 * per-row Reanimated node); only the small trash button keeps PressableScale.
 */
const CatalogueRow = React.memo(function CatalogueRow({
  item,
  isFirst,
  embedded,
  locked,
  onStartEdit,
  onRemove,
  onAddToList,
  theme,
  styles,
  deleteLabel,
  addLabel,
  screenHue,
}: {
  item: StoreItem;
  isFirst: boolean;
  embedded: boolean;
  locked: boolean;
  onStartEdit: (item: StoreItem) => void;
  onRemove: (id: string) => void;
  onAddToList: (item: StoreItem) => void;
  theme: ThemePalette;
  styles: Styles;
  deleteLabel: string;
  addLabel: string;
  screenHue: string;
}) {
  return (
    <View
      style={[
        styles.itemRow,
        { backgroundColor: theme.surface },
        isFirst && styles.rowFirst,
        embedded && styles.rowEmbedded,
      ]}
    >
      <Text
        style={[styles.itemNameTouch, { color: theme.text }]}
        numberOfLines={1}
        onPress={() => onStartEdit(item)}
        suppressHighlighting
      >
        {item.name}
      </Text>
      {item.price > 0 && (
        <Text style={[styles.itemPrice, TabularNums, { color: theme.textMuted }]} onPress={() => onStartEdit(item)}>
          {formatKr(item.price, 0)}
        </Text>
      )}
      {/* Add this item to a shopping list — the row's own action, distinct from the header
          "+" (which creates a brand-new catalogue item). Plain Pressable, same reasoning as
          the trash button below: a per-row Reanimated node is real mount cost at list scale.
          Not gated on `locked` — that guard is about editing the CATALOGUE, and pushing a
          known item onto a shopping list doesn't touch it. */}
      <Pressable
        onPress={() => onAddToList(item)}
        hitSlop={HitSlop.base}
        accessibilityLabel={addLabel}
        style={({ pressed }) => (pressed ? { opacity: 0.5 } : null)}
      >
        <Ionicons name="add-circle-outline" size={20} color={screenHue} />
      </Pressable>
      {/* Plain Pressable (opacity feedback), NOT PressableScale: at list scale a per-row
          Reanimated shared-value/animated-style node + AccessibilityInfo listener per trash
          button is real mount cost across the ~10 rows built on first paint — the second half
          of the Catalogue tab's open latency. Opacity dip keeps the tap feeling responsive. */}
      {/* Hidden while the catalogue is locked (2026-08-13) — see the `locked` state's note.
          Absent, not disabled: a greyed-out trash on 286 rows is 286 things that look broken. */}
      {!locked && (
        <Pressable
          onPress={() => onRemove(item.id)}
          hitSlop={HitSlop.base}
          accessibilityLabel={deleteLabel}
          style={({ pressed }) => (pressed ? { opacity: 0.5 } : null)}
        >
          <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
        </Pressable>
      )}
    </View>
  );
});

/**
 * The camera and the lock, for whatever header the catalogue is sitting under (2026-08-20).
 *
 * They used to ride inside the list's own first box, beside a sort control. That box is gone
 * and the maintainer's instruction was that these two belong "in the top part" — which on the
 * Shop tab is the Katalog card's `SectionCard` header and on /catalogue is the ScreenHeader.
 * Neither of those is inside CatalogueTab, so `locked` is owned by the host and passed back
 * down; this component is the pair of buttons, so the two hosts share one implementation
 * rather than each hand-rolling an IconButton with the right glyph-and-label pairing.
 */
export function CatalogueHeaderControls({
  locked,
  onToggleLock,
}: {
  locked: boolean;
  onToggleLock: () => void;
}) {
  const router = useRouter();
  const t = useT();
  return (
    <>
      {/* Scan → 'catalogue' target (2026-08-13): add unknown names, update known prices, and
          write to no shopping list at all. The camera used to be a single header icon on
          Shopping with no idea what you meant by it. See lib/scanTarget.ts. */}
      {/* ⚠️ **No `size` — the IconButton default (36) is deliberate (consistency audit,
          2026-08-21).** Both of these were `size={22}`, which the maintainer reported as
          *"some buttons are too small, like the lock and camera"*. The TOUCH target was never
          the problem — components/IconButton.tsx floors the hit area at `MIN_TAP_TARGET`
          whatever `size` says — so no test could see it. What the eye sees is the comparison:
          these sit in a card header 8px from a `CardExpandButton`, which passes no `size` and
          so renders at 36, and a 22px disc beside a 36px one reads as 61% of its neighbour.
          Leave the `size` prop OFF rather than writing 36, so the pair tracks the default if it
          ever moves. */}
      <IconButton
        icon="camera-outline"
        label={t.scanForCatalogueLabel}
        onPress={() => router.push({ pathname: '/scan', params: { target: 'catalogue' } })}
      />
      {/* ⚠️ **`active={locked}`, not `active={!locked}` (consistency audit, 2026-08-21).** The
          app draws three of these locks and this one lit the button when the list was UNlocked
          while app/(tabs)/shopping.tsx and components/WeekListCard.tsx both lit it when locked —
          so on one screen the same glyph, lit, meant the opposite thing. `active` is a state
          highlight, and the state this control names is "locked". */}
      <IconButton
        icon={locked ? 'lock-closed' : 'lock-open-outline'}
        label={locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
        onPress={() => { onToggleLock(); selection(); }}
        active={locked}
      />
    </>
  );
}

export default function CatalogueTab({ onNotify, header, embedded = false, locked }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const items = useCatalogStore((s) => s.items);
  const addItem = useCatalogStore((s) => s.addItem);
  const updateItem = useCatalogStore((s) => s.updateItem);
  const removeItem = useCatalogStore((s) => s.removeItem);

  // Per-row "add to list" — pushes a known catalogue item onto the weekly Unallocated
  // bucket or a monthly list, same two destinations + same store calls as FoodTab's
  // per-dish "+" popup (see that file's handleAddToWeek/handleAddToMonthly).
  const shoppingAdd = useShoppingStore((s) => s.add);
  const monthlyLists = useMonthlyListStore((s) => s.lists);

  /** The "+" beside the search field opens components/CatalogueAddSheet.tsx (2026-08-14). */
  const [addOpen, setAddOpen] = useState(false);
  // This screen's own green (2026-08-06) — was lib/domainColor's 'shop' identity, which the
  // 2026-07-31 hue collapse turned to gold; the outer container border was separately hardcoded
  // neutral (`theme.border`) rather than this screen's green. Both now draw the same hue.
  const screenHue = useScreenColor() ?? theme.border;
  // Only used in `embedded` mode — see the search row's own note. Computed unconditionally
  // (a hook can't sit behind a branch, and this is a plain call beside one).
  const isDark = useIsDark();
  const searchFieldEdge = computeBorderTone(screenHue, isDark, 'field');
  // ⚠️ **The search well goes through the SHARED field helpers (consistency audit, 2026-08-21).**
  // The 2026-08-20 pass got this field down to one box, which was the right call and is not
  // being undone — but it hand-rolled that box: `theme.surfaceInset` for the fill (a token no
  // other field in the app uses), a bare `Radius.sm`, and no halo at all, beside composers that
  // are a `getRecessedField` wash at `FIELD_RADIUS` with a `getFieldGlow` halo. Its own comment
  // claimed it "finally matches" `FormControls`' `recessed` Input; it did not, on all three
  // counts. It cannot simply BE that Input — this well holds a leading search glyph, a clear
  // button and the "+" key as well as the text — so it takes the same helpers instead, which is
  // exactly what components/PadTypeRow.tsx does with its own wrapper for the same reason.
  const searchRecess = getRecessedField(theme.surface, isDark);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const [query, setQuery] = useState('');

  /**
   * ⚠️ **There is no sort mode any more (2026-08-20).** A "By name / By type" SegmentedControl
   * sat in a box above the field until the maintainer removed it (*"just remove the tab slider
   * for different filtering"*), and the list is name-collated always — the store's own
   * canonical order, which reads the active locale via lib/collate. `sortByCategoryThenName`
   * still exists and is still used by the shopping lists themselves; only this list's ability
   * to switch to it is gone, along with `t.sortByName`/`t.sortByType`.
   * The consequence worth knowing: the A–Z scrubber's gate used to include `sortMode === 'name'`
   * and now needs only "no query", because there is no other order it could be showing.
   */


  // `items` already arrives collated from useCatalogStore in the active language's order
  // (sorted once in
  // load() + kept sorted by every mutation), so this tab renders it directly — no
  // per-mount sort, which is what used to add a "loading" beat when opening this tab.
  // The search box filters the store's already-collated list by case-insensitive substring; an
  // empty query returns the original array reference untouched, so the default path allocates
  // nothing and re-renders nothing. There is no re-sorting step any more — see the note above.
  const displayItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  // ── A–Z scrubber ──────────────────────────────────────────────────────────────────
  const flatListRef = useRef<FlatList<StoreItem>>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  // Only worth showing on a long, unfiltered list (a filtered/short list has nothing to scrub).
  // The `sortMode === 'name'` term this used to carry is gone with the sort control: there is
  // no aisle-grouped order left for the rail to be meaningless over.
  const showScrubber = query.trim().length === 0 && displayItems.length >= SCRUB_MIN_ITEMS;

  // Letters to render + first-row-index for each present letter, derived from what's on screen.
  const scrubData = useMemo(() => {
    const firstIndex: Record<string, number> = {};
    let hasHash = false;
    displayItems.forEach((it, i) => {
      const c = (it.name.trim()[0] || '').toUpperCase();
      const bucket = SCRUB_ALPHABET.includes(c) ? c : '#';
      if (bucket === '#') hasHash = true;
      if (firstIndex[bucket] === undefined) firstIndex[bucket] = i;
    });
    const letters = hasHash ? [...SCRUB_ALPHABET, '#'] : SCRUB_ALPHABET;
    return { firstIndex, letters };
  }, [displayItems]);

  // Refs let the PanResponder's stable handlers always read the latest data/measurements
  // without rebuilding the responder on every render.
  const scrubRef = useRef(scrubData);
  scrubRef.current = scrubData;
  const barHeightRef = useRef(0);
  // Absolute (screen) Y of the bar's top edge, captured on grant. We map with the touch's
  // ABSOLUTE Y (gestureState.moveY) minus this, NOT nativeEvent.locationY — locationY is
  // measured against whatever view is under the finger, so once the finger slides sideways off
  // the column onto a list row it collapses to the row's frame and the letter snaps to A/Å.
  const barTopRef = useRef(0);
  const lastLetterRef = useRef<string | null>(null);

  // Resolve a letter to a row index; an empty letter jumps forward to the next present
  // letter (falling back to the previous one), so every letter on the bar goes somewhere.
  const resolveIndex = useCallback((letter: string) => {
    const { letters, firstIndex } = scrubRef.current;
    const start = letters.indexOf(letter);
    for (let k = start; k < letters.length; k++) {
      const idx = firstIndex[letters[k]];
      if (idx !== undefined) return idx;
    }
    for (let k = start - 1; k >= 0; k--) {
      const idx = firstIndex[letters[k]];
      if (idx !== undefined) return idx;
    }
    return 0;
  }, []);

  // `relativeY` is the touch's Y relative to the bar's top edge (clamped into the bar), so the
  // selected letter always tracks the finger's vertical placement — even when the finger has
  // drifted horizontally off the column.
  const handleScrub = useCallback(
    (relativeY: number) => {
      const { letters } = scrubRef.current;
      const h = barHeightRef.current;
      if (!h || letters.length === 0) return;
      const i = Math.max(0, Math.min(letters.length - 1, Math.floor((relativeY / h) * letters.length)));
      const letter = letters[i];
      if (letter === lastLetterRef.current) return;
      lastLetterRef.current = letter;
      setActiveLetter(letter);
      selection();
      flatListRef.current?.scrollToIndex({ index: resolveIndex(letter), animated: false, viewPosition: 0 });
    },
    [resolveIndex]
  );

  const endScrub = useCallback(() => {
    lastLetterRef.current = null;
    setActiveLetter(null);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // On grant the finger is over the bar, so locationY is valid there and lets us derive the
        // bar's absolute top (pageY − locationY) once. Every subsequent move then maps with the
        // absolute screen Y (moveY) − that top, which stays correct off-column.
        onPanResponderGrant: (e) => {
          barTopRef.current = e.nativeEvent.pageY - e.nativeEvent.locationY;
          handleScrub(e.nativeEvent.locationY);
        },
        onPanResponderMove: (_e, g) => handleScrub(g.moveY - barTopRef.current),
        onPanResponderRelease: endScrub,
        onPanResponderTerminate: endScrub,
      }),
    [handleScrub, endScrub]
  );

  function handleAdd({ name, price }: { name: string; price: number }) {
    addItem({ name, price, category: 'other' });
    success();
    onNotify(t.catalogueItemAdded(name));
  }

  function pushItemToWeek(item: StoreItem) {
    shoppingAdd({
      name: item.name,
      amount: '1',
      unit: '',
      listType: 'weekly',
      store: '',
      price: item.price,
      inventoryQty: 0,
      status: 'inWeeklyList',
      listId: UNALLOCATED_LIST_ID,
      category: item.category,
    });
    success();
    onNotify(t.dishAddedToWeek(item.name));
  }

  function pushItemToMonthlyList(item: StoreItem, monthlyListId: string) {
    shoppingAdd({
      name: item.name,
      amount: '1',
      unit: '',
      listType: 'monthly',
      store: '',
      price: item.price,
      inventoryQty: 0,
      status: 'catalog',
      targetQuantity: 1,
      monthlyListId,
      category: item.category,
    });
    success();
    onNotify(t.dishAddedToMonthly(item.name));
  }

  function handleAddToMonthly(item: StoreItem) {
    if (monthlyLists.length === 0) {
      onNotify(t.monthlyListsEmpty);
      return;
    }
    if (monthlyLists.length === 1) {
      pushItemToMonthlyList(item, monthlyLists[0].id);
      return;
    }
    showAppModal(t.allocateToListTitle, '', [
      ...monthlyLists.map((l) => ({ text: monthlyListLabel(l, t.defaultMonthlyListName), onPress: () => pushItemToMonthlyList(item, l.id) })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  // The row's "+" — same two destinations FoodTab's per-dish popup offers, as a plain
  // showAppModal action sheet rather than a bespoke popup: this is a one-off choice, not a
  // composer, and the app already has a control for exactly that shape.
  const handleAddToList = useCallback((item: StoreItem) => {
    showAppModal(t.addDishPopupTitle(item.name), '', [
      { text: t.addToWeekListBtn, onPress: () => pushItemToWeek(item) },
      { text: t.addToMonthlyListBtn, onPress: () => handleAddToMonthly(item) },
      { text: t.cancel, style: 'cancel' as const },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyLists, t]);

  // Lets startEdit find the tapped row's current index without depending on `displayItems`
  // (which would change its identity — and every memoized CatalogueRow's onStartEdit prop
  // with it — on every search keystroke).
  const displayItemsRef = useRef(displayItems);
  displayItemsRef.current = displayItems;

  const startEdit = useCallback((item: StoreItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price > 0 ? String(item.price) : '');
    // Keyboard-avoidance (2026-07-31): this is a self-scrolling FlatList (scrollable={false}
    // on the parent ScreenScaffold), so there's no ScrollIntoViewContext to hand off to —
    // scrollToIndex is this list's own equivalent. viewPosition 0.25 leaves room below the
    // edit row for the keyboard instead of just centering it. requestAnimationFrame so the
    // edit row (autoFocus'd name field) has actually swapped in before we measure/scroll.
    const idx = displayItemsRef.current.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.25 });
      });
    }
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      removeItem(id);
      heavy();
    },
    [removeItem]
  );

  function commitEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (name) updateItem(editingId, { name, price: parseFloat(editPrice.replace(',', '.')) || 0 });
    setEditingId(null);
  }

  const renderItem = ({ item, index }: { item: StoreItem; index: number }) => {
    // No rounded top row embedded: `rowFirst` rounds into the notepad container's corner, and
    // there is no container here. The horizontal inset goes too — the drawer's card already
    // pads by Spacing.md, and stacking a third one is what squeezes a long Norwegian item
    // name into a wrap (see AGENTS.md's note on horizontal chrome stacking).
    const isFirst = !embedded && index === 0;
    if (editingId === item.id) {
      return (
        <View
          style={[
            styles.editRow,
            { backgroundColor: theme.surface },
            isFirst && styles.rowFirst,
            embedded && styles.rowEmbedded,
          ]}
        >
          <Input
            recessed
            containerStyle={styles.editNameInputContainer}
            value={editName}
            onChangeText={setEditName}
            placeholder={t.catalogueItemNamePlaceholder}
            autoFocus
          />
          <Input
            recessed
            containerStyle={styles.editPriceInputContainer}
            value={editPrice}
            onChangeText={setEditPrice}
            placeholder={t.catalogueItemPricePlaceholder}
            keyboardType="decimal-pad"
            onSubmitEditing={commitEdit}
          />
          <PressableScale style={[styles.iconBtn, { backgroundColor: theme.good }]} onPress={commitEdit} hitSlop={HitSlop.tight} scaleTo={0.9}>
            <Ionicons name="checkmark" size={16} color={theme.textInverse} />
          </PressableScale>
          {/* Gated on the lock too — the row's own trash is hidden while locked, and leaving
              this one live would make "unlock to delete" a lie that costs one extra tap. */}
          {!locked && (
            <PressableScale
              style={[styles.iconBtn, { backgroundColor: theme.badSoft }]}
              onPress={() => { removeItem(item.id); heavy(); setEditingId(null); }}
              hitSlop={HitSlop.tight}
              accessibilityLabel={t.catalogueDeleteItemLabel}
              scaleTo={0.93}
            >
              <Ionicons name="trash-outline" size={16} color={theme.bad} />
            </PressableScale>
          )}
        </View>
      );
    }
    return (
      <CatalogueRow
        item={item}
        isFirst={isFirst}
        embedded={embedded}
        locked={locked}
        onStartEdit={startEdit}
        onRemove={handleRemove}
        onAddToList={handleAddToList}
        theme={theme}
        styles={styles}
        deleteLabel={t.catalogueDeleteItemLabel}
        addLabel={t.addDishPopupTitle(item.name)}
        screenHue={screenHue}
      />
    );
  };

  // ⚠️ **`shell` is gone (2026-08-20).** It wrapped each header box in a `Surface` on the real
  // screen and in a bare `View` when embedded. There are no header boxes left — the search
  // field draws its own single recessed well in both modes — so the helper had no callers, and
  // keeping it would have invited the next box straight back into the shape the maintainer
  // called "box in box".

  // Rendered in BOTH branches below — it is a <Modal>, so it costs nothing while shut and works
  // the same from inside Shopping's drawer as from the full screen.
  const addSheet = (
    <CatalogueAddSheet visible={addOpen} onClose={() => setAddOpen(false)} onSave={handleAdd} />
  );

  const listHeader = (
    <View style={[styles.listHeader, embedded && styles.listHeaderEmbedded]}>
      {header}
      {/* ⚠️ **Box 1 is GONE (2026-08-20).** It held a "By name / By type" SegmentedControl with
          the camera and the lock riding along in the same edge. The maintainer removed the
          sort control outright (*"just remove the tab slider for different filtering"*) and
          moved the two icons to the card's own header (*"the two buttons for camera and lock
          should be in the top part instead"*) — they are `CatalogueHeaderControls` now, drawn
          by whichever header this list sits under. With one control left there was no box left
          to draw: the field below IS the header. */}
      {/* ── The search field ── filters the catalogue by name (case-insensitive substring), and
          hides the A–Z scrubber while a query is active (the filtered list is short and no
          longer in a scannable A→Å run). The "+" opens components/CatalogueAddSheet.tsx; it
          sits inside the field because "find an item" and "add an item you couldn't find" are
          one errand.
          ⚠️ **It is ONE box in both modes now (2026-08-20)**, and that is the fix the
          maintainer asked for: *"Box in box (textbox) visual goes against guidelines and how
          other text boxes look like."* On the real screen it used to be a `Surface` (box) with
          a bordered field drawn inside it (box in box); embedded it was a bordered field with
          no Surface. Both draw the same single recessed well now — the shape
          components/FormControls.tsx's `recessed` Input gives every other in-card composer in
          the app (PadTypeRow, InlineAddItem), so this field finally matches them. `shell` is
          not used here at all any more; the well IS the box. */}
      {(
        <View
          style={[
            styles.searchRow,
            // The halo carries the radius it is cut to (getFieldGlow, 2026-08-19), so the well
            // and its light are one decision — the same `soft` resting glow every other in-card
            // field has worn since the 2026-08-16 tactile-glow pass.
            getFieldGlow(screenHue, 'soft'),
            { borderColor: searchFieldEdge, backgroundColor: searchRecess.paint },
          ]}
        >
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder={t.catalogueSearchPlaceholder}
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <PressableScale
              onPress={() => setQuery('')}
              hitSlop={HitSlop.base}
              scaleTo={0.9}
              accessibilityLabel={t.catalogueSearchClearLabel}
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </PressableScale>
          )}
          {/* No `color` override (2026-08-20). It passed `theme.textInverse` — near-black in
              dark mode — which was right while a tinted IconButton had a SOLID hue fill, and
              wrong from the 2026-08-17 matte-glass pass onward: the body is a ~14% wash of the
              hue now, so the glyph was black-on-near-black and the "+" simply did not render.
              `theme.text` (the default) is what every other filled control uses since that pass
              — "nothing is written ON a hue any more". */}
          <IconButton
            icon="add"
            label={t.catalogueAddNewBtn}
            onPress={() => setAddOpen(true)}
            tint={screenHue}
            size={IconSize.compact}
          />
        </View>
      )}
      {items.length === 0 && (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.catalogueEmpty}</Text>
      )}
      {items.length > 0 && displayItems.length === 0 && (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.catalogueNoMatches}</Text>
      )}
    </View>
  );

  // ── Embedded (Shopping's Catalogue drawer) ───────────────────────────────────────────
  // Same header, same rows, same edit row — a capped `.map()` instead of the FlatList, and
  // none of the screen shell: no notepad container (the drawer's card IS the container), no
  // grow-to-fill footer (there is no leftover viewport to soak up inside a drawer), no A–Z
  // rail. Rows keep the real screen's divider-separated continuous run rather than becoming
  // boxed PadRows: matching the destination is the entire point of mounting this here.
  if (embedded) {
    return (
      <View style={styles.embeddedRoot}>
        {listHeader}
        {/* **The list scrolls inside its own rounded box (2026-08-20)**, maintainer: *"the list
            should be rounded, and scrollable even when not in full screen."* This replaced a
            capped `.slice(EMBEDDED_ROWS)` plus an "and N more →" tail row that pushed you to the
            full screen — which was also the one place this card still navigated away, against
            the standing "never go to another page" rule. Now the whole catalogue is reachable
            here.
            ⚠️ **It is a plain ScrollView, NOT a FlatList, and that is forced.** A FlatList here
            is a VirtualizedList nested in Shopping's own ScrollView on the same axis, which
            breaks windowing and warns. The cost is that every row mounts at once rather than in
            a window; rows are memoised and cheap (a View and two Texts), and the height cap
            keeps the LAYOUT bounded even though the render is not. If this ever shows up as
            Shop-tab open latency, the fix is to gate the body on the card being expanded, not
            to reintroduce the tail row.
            `nestedScrollEnabled` is what makes the inner scroll win on Android; iOS handles
            nested scrolling natively. The rows are their OWN container with no gap: they are a
            continuous divider-ruled run, exactly as on the real screen, and `embeddedRoot`'s gap
            would push every row 8px off its own divider and turn the list into a ladder. */}
        <ScrollView
          style={[styles.embeddedList, { borderColor: theme.border }]}
          contentContainerStyle={styles.embeddedListContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {displayItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
              {renderItem({ item, index })}
            </React.Fragment>
          ))}
        </ScrollView>
        {addSheet}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Notepad container (2026-07-18, bordered 2026-07-24): the catalogue is clipped into a
          rounded, contained sheet that ends ABOVE the bottom nav (root's paddingBottom), so it
          reads like a notepad sitting within the screen instead of running flush under — and
          getting "bordered off" behind — the nav bar. Split into two views (cardOuter carries
          the themed border + shadow, unclipped; card is the overflow:hidden mask) so the whole
          container finally reads as a bordered/shadowed card like every other card in the app
          (WeekListCard/PlanTaskCard/HomeShoppingCard via Surface, TaskCard via this same
          getElevation recipe) instead of a bare unbordered clip — the previous "no domain
          border" note only ever meant no per-row accent edge, not "no border at all", but the
          card ended up with neither. overflow:hidden still rounds the bottom edge for a long,
          virtualized list (mid-scroll rows clip against the rounded corner rather than a hard
          cut against the nav). */}
      <View style={[styles.cardOuter, getElevation('raised', theme.shadow), { borderColor: screenHue }]}>
      <View style={styles.card}>
      <View style={styles.cardInner}>
      <FlatList
        ref={flatListRef}
        style={styles.flatList}
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        // extraData: re-render rows when edit mode toggles (editingId) or the theme changes,
        // since CatalogueRow is memoised and otherwise only re-renders on its own prop changes.
        extraData={`${editingId}|${theme.surface}`}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
        // listFiller: a themed, flex-growing spacer right after the last row. Visual-audit
        // 2026-07-17 — a short catalogue (most seeded rows deleted, or a fresh manual list)
        // left the FlatList's own unused flex:1 tail exposed as plain screen background between
        // the last row and the bottom nav, reading as a large "cut off" gap. Growing this filler
        // to consume that leftover space (flexGrow on both it and listContent below) keeps the
        // card's rounded-bottom silhouette flush near the nav instead of stopping short — the
        // real last row no longer carries rowLast itself (see renderItem/CatalogueRow above).
        ListFooterComponent={displayItems.length > 0 ? <View style={[styles.listFiller, { backgroundColor: theme.surface }]} /> : null}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        windowSize={11}
        maxToRenderPerBatch={20}
        removeClippedSubviews
        // A far scrub jump can target a row not yet realised (removeClippedSubviews + no
        // getItemLayout): seed an approximate offset, then retry the exact scroll once nearby
        // rows have mounted. Standard FlatList fallback.
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: false });
          setTimeout(() => {
            if (displayItems.length > info.index) {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
            }
          }, 60);
        }}
      />
      {/* ── A–Z scrubber ── hold-and-drag column reserved as a sibling gutter (not an overlay),
          so long row names never run underneath. onLayout feeds its height to the touch→letter math. */}
      {showScrubber && (
        <View
          style={styles.indexBar}
          onLayout={(e) => { barHeightRef.current = e.nativeEvent.layout.height; }}
          accessibilityLabel={t.catalogueIndexScrubLabel}
          {...panResponder.panHandlers}
        >
          {scrubData.letters.map((L) => (
            <Text
              key={L}
              style={[styles.indexLetter, { color: activeLetter === L ? theme.accent : theme.textMuted }]}
              allowFontScaling={false}
            >
              {L}
            </Text>
          ))}
        </View>
      )}
      </View>
      {/* Centered letter bubble shown while scrubbing (iOS-contacts feel). */}
      {activeLetter && (
        <View pointerEvents="none" style={styles.scrubBubble}>
          <Text style={[styles.scrubBubbleText, { color: theme.accentInk }]} allowFontScaling={false}>
            {activeLetter}
          </Text>
        </View>
      )}
      </View>
      </View>
      {addSheet}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // root owns the horizontal inset (was on listContent) so the clipping `card` aligns with the
  // rows, plus a bottom gap so the notepad's rounded bottom clears the nav with the colourful
  // field showing beneath it — "rounded within the screen", not tucked under the nav bar.
  // **No paddingTop as of 2026-08-19**, and for the same reason it had one: it matches the
  // `content` wrapper every screen uses, so this screen's header chrome starts the same distance
  // below the bar as everywhere else. That distance is now zero — components/ScreenScaffold.tsx
  // clips content flush to the chrome's glass, and a margin here is the blank strip that clip
  // exists to delete (visual-audit 2026-07-20, revised). The bottom keeps its gap: this style is
  // the non-embedded branch only, i.e. the pushed /catalogue screen, which reserves no bottom nav
  // — that edge is the safe area, not chrome.
  // ⚠️ **No `paddingHorizontal` (consistency audit, 2026-08-21).** It carried `Spacing.md`, and
  // BOTH of the non-embedded hosts already inset their body by the same amount —
  // `CenterModalScreen`'s `bodyContent` (`padding: Spacing.md`) on app/catalogue.tsx, and
  // `CardExpandHost`'s `bodyFlex` (`paddingHorizontal: Spacing.md`) in the expanded pane — so
  // the catalogue was the one surface in the app drawn at a 32px side inset. That is the
  // "three stacked horizontal paddings" shape the wrap audit keeps finding, and it is what
  // AGENTS.md's centre-modal rule already forbids ("a converted screen must NOT pad its own
  // content"); this style predates that conversion by a day and was simply never revisited.
  //   `paddingBottom` stays: `bodyFlex` has no bottom inset of its own, so removing it would
  //   run the list into the pane's edge in the expanded view. It does still double at the foot
  //   of the /catalogue pane — 16 from `bodyContent` plus this — which is a real but much
  //   smaller divergence, recorded in CONSISTENCY_AUDIT.md rather than fixed by giving one
  //   screen a bespoke prop.
  root: { flex: 1, paddingBottom: Spacing.md },
  // Outer shadow-casting layer (2026-07-24): border + shadow live here, NOT on `card` below —
  // `card`'s own overflow:hidden would otherwise clip the shadow (same reason Surface splits
  // border/shadow onto an outer view and clipping onto an inner mask). This is what makes the
  // catalogue read as one bordered/shadowed card like every other card in the app.
  cardOuter: { flex: 1, borderRadius: Radius.md, borderWidth: 1 },
  // The notepad sheet: fills the remaining height and rounds + clips all edges to match
  // cardOuter above. overflow:hidden is what turns a mid-scroll hard clip into a clean rounded
  // bottom on the long, virtualized list.
  card: { flex: 1, borderRadius: Radius.md, overflow: 'hidden' },
  // Wraps the FlatList + A–Z scrubber side by side; the scrubber is a reserved gutter, not an
  // overlay, so it never sits on top of a long row name.
  cardInner: { flex: 1, flexDirection: 'row' },
  flatList: { flex: 1 },
  listContent: { paddingBottom: Spacing.md, flexGrow: 1 },
  // No paddingBottom here (2026-07-21 fix): `card`/`cardInner` have no background fill — the
  // floating header chrome sits directly over the screen's ambient artwork by design
  // (see "Notepad container" note above), but a trailing gap after the LAST header card exposed
  // that same ambient background as a persistent seam between the chrome and the first solid
  // row. Barely visible at rest, it became a jarring blank strip once scrolled partway (the
  // chrome clips to a sliver while the seam stays full-size) — reported as "blank space under
  // the tab row". `gap` still spaces the header's own cards apart; only the trailing pad is gone,
  // so the last card now sits flush against the first row with no background showing through.
  // marginTop (2026-07-24): the header Surfaces below cast their own drop shadow
  // (getLayeredShadow). Without this inset they sit flush against `card`'s overflow:hidden
  // bounds and that shadow gets clipped clean off — the "shadow abnormality above the list"
  // bug report. This gives the shadow room to render before hitting the clip.
  //
  // **marginHorizontal is 0 as of 2026-08-14** (maintainer: *"the search field and the others
  // should not be slimmer than the catalogue itself"*). It was `Spacing.md`, for the same
  // shadow-clearance reason — but that inset a full-width control by 16px on each side inside
  // a card whose own rows run edge to edge, so the two boxes read as a narrower stack floating
  // on top of the list rather than as part of it. The side shadows clip at the card's own edge
  // now, which is invisible; a 32px width difference was not.
  listHeader: { gap: Spacing.md, marginTop: Spacing.md, marginHorizontal: 0 },
  // Embedded: the top margin exists on the real screen so the Surfaces' shadows clear the
  // FlatList's clip. There are no Surfaces and no clip inside the drawer.
  listHeaderEmbedded: { marginTop: 0 },
  embeddedRoot: { gap: Spacing.sm },
  // **ONE box, in both modes (2026-08-20)** — the fix for *"box in box (textbox) visual goes
  // against guidelines and how other text boxes look like."* This used to be `searchCard` (a
  // Surface) on the real screen with `searchRow` drawn inside it, and `searchRowEmbedded` (a
  // bordered field) with no Surface in the drawer: two different shapes, one of them doubled.
  // Now there is a single recessed well — a field-weight edge in the screen's hue over
  // `surfaceInset` — which is the shape components/FormControls.tsx's `recessed` Input gives
  // every other in-card composer (PadTypeRow, InlineAddItem), so this field finally matches
  // the rest of the app. `paddingRight` is smaller because the "+" key carries its own hit
  // padding out to MIN_TAP_TARGET. `sortCard`/`sortRow`/`sortControl` went with the sort
  // control itself.
  // No `borderRadius` here (2026-08-21): `getFieldGlow` supplies `FIELD_RADIUS` inline together
  // with the halo, so the well and its light cannot be cut to two different shapes — the same
  // arrangement components/AddRow.tsx and FormControls' Input use. It was a bare `Radius.sm`,
  // which happens to equal FIELD_RADIUS today and would not have followed it if it moved.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    borderWidth: BORDER_WIDTH.field,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
  },
  // `minWidth: 0` alongside `flex: 1` (2026-08-14): without it a flex child keeps its
  // intrinsic width, so the Norwegian placeholder ("Søk i katalogen…") refused to shrink and
  // shoved the new "+" 11px past the drawer's clip — caught by `npm run wraps -- --lang=no
  // --width=360` as a CLIPPED control, which is exactly the pair AGENTS.md's wrap-audit
  // lessons prescribe for an input sharing a row with a fixed-size control.
  // `FontSize.md`, matching every other field in the app (2026-08-21) — it was `sm`, the same
  // divergence components/AddRow.tsx carried until this pass.
  searchInput: { flex: 1, minWidth: 0, fontSize: FontSize.md, padding: 0 },
  // A–Z scrubber column: fills the card height so touch-Y ÷ height × letters maps uniformly.
  indexBar: { width: 22, justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: Spacing.xs },
  indexLetter: { fontSize: 11, lineHeight: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  // Centered floating letter shown while dragging the scrubber.
  scrubBubble: { position: 'absolute', alignSelf: 'center', top: '38%', width: 68, height: 68, borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  // `OpticalCenter` (2026-08-21): a Text whose box height is pinned by the circle around it,
  // which is the condition Android's asymmetric font padding breaks. Guarded by
  // lib/__tests__/designTokens.test.ts.
  scrubBubbleText: { fontSize: 34, fontFamily: Fonts.extrabold, ...OpticalCenter },
  empty: { fontSize: FontSize.sm, paddingVertical: Spacing.md, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: MIN_TAP_TARGET },
  rowFirst: { borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md },
  rowEmbedded: { paddingHorizontal: Spacing.sm },
  // The embedded list's own rounded, scrolling box (2026-08-20) — see the render-side note.
  // `overflow: 'hidden'` is what makes the radius actually clip the rows inside it; without it
  // the first and last row's square corners sit proud of the border. The edge is `border`, not
  // the screen hue: this is a container boundary, not a control.
  embeddedList: {
    maxHeight: EMBEDDED_MAX_HEIGHT,
    borderWidth: BORDER_WIDTH.card,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  embeddedListContent: { flexGrow: 1 },
  // listFiller: grows to soak up any leftover FlatList viewport height below the real rows
  // (see the ListFooterComponent note above) — the rounded bottom now lives here instead of
  // on whichever row happens to be last, so the card's bottom edge stays put near the nav
  // regardless of item count.
  listFiller: { flexGrow: 1, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md },
  itemNameTouch: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium, ...OpticalCenter },
  itemPrice: { fontSize: FontSize.sm, ...OpticalCenter },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  // Sizing only — the field's own fill/border/glow now comes from FormControls' `Input`
  // (`recessed`), the same recessed-well style every other in-card field uses. These two
  // used to be bare TextInputs with a flat `theme.surfaceMuted` fill and no border/glow at
  // all — the mismatch a 2026-08-20 pass fixed across Catalogue and Food.
  editNameInputContainer: { flex: 1 },
  editPriceInputContainer: { width: 76 },
  iconBtn: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowDivider: { height: 1 },
});
