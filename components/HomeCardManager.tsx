/**
 * HomeCardManager.tsx — reorderable wrapper for the Home tab's preview cards, plus the
 * "Retired" shelf that every hidden one falls to.
 *
 * **This component defines what "reorderable" means on Me, by omission.** Only the kinds
 * Home passes in `order` (`HOME_CARD_KINDS` in lib/homeCards.ts — plans/notes/shopping)
 * can be dragged or retired. The Energy strip, the incoming-Shared card and the cumulative
 * "you've done N things" line are rendered as SIBLINGS of this component, never as entries in
 * it, which is exactly what makes them fixed — there is no flag to check and no way for a
 * corrupt `homeCardOrder` to move them. Keep it that way: making one of them reorderable means
 * adding it to that set, not adding a special case here.
 *
 * Long-pressing ANY card starts a drag-to-reorder — no mode to enter first, matching what
 * long-press means everywhere else in the app (WeekListCard, Shopping's DraggableTaskRow rows).
 * Mirrors DraggableTaskRow's "owns no data" contract: reorder/restore are bubbled to the parent
 * via callbacks, and the drag math itself lives in lib/useDragReorder.ts (this file's
 * hand-rolled measure/reorder/commit block WAS that hook — extracted verbatim on 2026-08-01 so
 * notes, habits and the Whenever list could share the gesture instead of keeping a fourth copy).
 *
 * Connections:
 *   Imports → components/CollapsedSection (the Retired drawer), components/DraggableTaskRow,
 *             components/PressableScale, constants/theme, lib/haptics, lib/i18n,
 *             lib/screenColor (the drawer wears the host screen's hue), lib/useDragReorder,
 *             lib/useAppTheme
 *   Used by → app/(tabs)/index.tsx (the Home tab's Today/Notes/Shopping preview stack)
 *   Data    → none — pure presentational, all mutations bubbled up via callbacks
 *
 * Edit notes:
 *   - **⚠️ There is no edit mode any more (2026-08-20, UI-consistency pass).** Maintainer:
 *     *"In home, remove the 'Edit cards' button as well, and when a card is hidden it just goes
 *     to a totally collapsed state at the bottom in a section called 'Retired'."* So the
 *     `editMode` prop, the per-card × remove badge, the dashed "Add a card" tile and the
 *     `<Modal>` add-picker behind it are all DELETED, along with `onRemove` (hiding is the
 *     card's own ⋮ menu now, which writes `homeCardOrder` in app/(tabs)/index.tsx and never
 *     went through here). What replaces the picker is the **Retired** drawer below: a
 *     components/CollapsedSection.tsx at the foot of the stack, shut by default, listing every
 *     kind in `labels` that is missing from `order`, each row a one-tap restore.
 *     The reason the mode could go without taking a capability with it is that its two jobs
 *     were already covered: the drag was never gated on it (see the next note), and hiding had
 *     moved to the ⋮ menu on 2026-08-12. All it still owned was the way BACK, and a permanent
 *     shelf is a better one than a mode you have to know to turn on.
 *   - **The drag was always independent of the mode**, which is why removing it changed
 *     nothing about reordering: a long-press-drag committed via `onReorder` whether or not the
 *     delete/add chrome was showing. Don't reintroduce a mode to "protect" the drag.
 *   - **The shelf is absent, not empty, when nothing is retired.** A permanently visible
 *     "Retired (0)" card at the foot of every Home tab is a row of furniture about a state the
 *     user is not in. It appears the moment the first card is hidden and leaves with the last
 *     restore.
 *   - **Every kind can now STAY retired** (2026-08-23). `sanitizeHomeCardOrder()`
 *     (lib/homeCards.ts) used to APPEND some kinds on every read — correct while those were
 *     cards with no other surface in the app ('habits', 'health'), and wrong the moment the
 *     list held cards that preview a TAB, because then hiding one only moved it to the bottom
 *     of the stack and this shelf never saw it. The repair is scoped to legacy rows now. If a
 *     kind ever again has nowhere else to live, that changes in the sanitizer, not by
 *     special-casing a kind in this file.
 *   - Drag is always enabled per row (no `isOpen` lift from the wrapped cards' own internal
 *     expand/collapse state — the cards manage that privately). Dragging a card while it is
 *     expanded works but reflows a larger block; accepted trade-off vs. threading expand state
 *     through three separately-owned card components.
 *   - Relies on the Android LayoutAnimation global enable that DraggableTaskRow.tsx documents.
 *     ⚠️ It used to name HintCard.tsx as the file that set it at module scope; that component
 *     was deleted in the same 2026-08-20 pass, so if a restore ever animates as a snap on
 *     Android, the missing `setLayoutAnimationEnabledExperimental` is the first thing to check.
 */
import React from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/Card';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, MIN_TAP_TARGET, SCREEN_GAP, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useDragReorder } from '@/lib/useDragReorder';

type Props = {
  /** Ordered, currently-visible kind ids (e.g. ['notes', 'shopping']). */
  order: string[];
  /** Full known kind set → label. Whatever is here and NOT in `order` is what the shelf lists. */
  labels: Record<string, string>;
  onReorder: (order: string[]) => void;
  /** Restore a retired kind — appends it to `order`. */
  onAdd: (kind: string) => void;
  renderCard: (kind: string) => React.ReactNode;
};

export default function HomeCardManager({ order, labels, onReorder, onAdd, renderCard }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();

  // The shared long-press-drag mechanic (lib/useDragReorder) — the same one the notes screen,
  // the habit list and the Whenever list use. This file used to hold that logic itself.
  const drag = useDragReorder(order, onReorder);

  // Everything the app knows about, minus what is on screen. See the header: this is the
  // shelf's whole contents, and it being empty is what makes the shelf absent.
  const retiredKinds = Object.keys(labels).filter((k) => !order.includes(k));

  function handleRestore(kind: string) {
    tap();
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onAdd(kind);
  }

  return (
    <View style={styles.cardList}>
      {drag.order.map((kind) => (
        <DraggableTaskRow key={kind} isOpen={false} {...drag.rowProps(kind)}>
          <View>{renderCard(kind)}</View>
        </DraggableTaskRow>
      ))}

      {/* The Retired shelf. Absent rather than empty when nothing is hidden — see the header.
          A CollapsedSection rather than a hand-rolled drawer so it folds, counts and reads
          exactly like Goals, Earlier days and Washed away do elsewhere; it passes no
          `onTitlePress`, so the header is ONE tap target (there is no screen behind it to
          open). It sits INSIDE the gapped list so the screen's own SCREEN_GAP separates it
          from the last card, rather than carrying a margin of its own. */}
      {retiredKinds.length > 0 && (
        <Card id="homeRetired" count={retiredKinds.length}>
          {retiredKinds.map((kind) => (
            <PressableScale
              key={kind}
              style={styles.retiredRow}
              onPress={() => handleRestore(kind)}
              accessibilityRole="button"
              accessibilityLabel={t.home.retired.restore(labels[kind] ?? kind)}
            >
              <Text style={[styles.retiredName, { color: theme.text }]} numberOfLines={1}>
                {labels[kind] ?? kind}
              </Text>
              {/* The one control on the row, and the row itself is the target — a separate
                  button beside a tappable row is two ways to do one thing. */}
              <Ionicons name="add" size={20} color={theme.textMuted} />
            </PressableScale>
          ))}
        </Card>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // The one rhythm between the Home tab's preview cards (2026-08-08). Each card used to carry
  // its own `marginBottom: Spacing.sm`, which is how this screen ended up at an 8px rhythm
  // while the list screens ran at 32 — see SCREEN_GAP in constants/theme.ts.
  cardList: { gap: SCREEN_GAP },
  // Flush and ruleless, like every other row since the 2026-08-15 PadSheet pass — the gap is
  // the separation. `minHeight` rather than padding alone so the whole row clears the tap
  // target even at the smallest text size.
  retiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: Spacing.xs,
  },
  retiredName: { flex: 1, minWidth: 0, fontSize: FontSize.md, fontFamily: Fonts.medium },
});
