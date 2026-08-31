/**
 * ManageCardsSheet.tsx — "which cards do I want on this screen, and in what order", scoped to
 * ONE screen.
 *
 * Maintainer, 2026-08-30, asked whether hiding should be a per-card "⋮" (matching Home) or one
 * control per screen: *"One for each screen, not per card."* So this opens from a single header
 * icon (`ScreenScaffold`'s `onManageCardsPress`, the same shape as `onLayoutPress`) and lists
 * every card the registry declares for that screen with a switch each.
 *
 * ⚠️ **Hiding AND restoring both happen here, which is why these screens need no "Retired"
 * shelf.** Home has one because its only hide affordance is per-card, so something else has to
 * name what is gone; here the entry point already lists everything, present or not. Don't add a
 * shelf to a screen that has this sheet — it would be a second place saying the same thing.
 *
 * ⚠️ **It REORDERS as well, since 2026-09-01, and that was the other half of the original ask.**
 * Maintainer, on the shipped 2026-08-30 version: *"One button per screen for reordering and/or
 * hiding cards instead of the three dots was disregarded, and now it's not how we agreed to do
 * it."* Hiding shipped; reorder was deferred because the data model was never the missing piece
 * — `cardsForScreen()` had no consumer at all and every screen's cards were hardcoded JSX. The
 * four tab surfaces render `useOrderedCards()` now, so this sheet can move them.
 *
 * ⚠️ **Two ways to move a card, and the second one is not a convenience.** Drag (hold ~400ms,
 * lib/useDragReorder.ts) is the app's one reorder gesture and belongs here; the ↑/↓ buttons are
 * what makes the capability CHECKABLE at all. Playwright cannot activate
 * `Gesture.Pan().activateAfterLongPress(400)` in the web build — measured against the app's own
 * shipped drag, not assumed (AGENTS.md) — so a drag-only control is one no harness in this repo
 * can reach. They are also the accessible path: a hold-and-drag is not operable by a
 * screen-reader user. Don't delete them to tidy the row.
 *
 * Originally modelled on components/LayoutPickerSheet.tsx (deleted 2026-09-01 with the layout
 * picker), which was the same shape of thing: opened from a surface's own header so the choice
 * is made while looking at what it changes, applying immediately, with a trailing DISMISS rather
 * than a commit — backing out never silently discards a change the user already watched happen.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/DraggableTaskRow (the app's one
 *             hold-to-drag row), components/FormControls (Switch — rule 19a's one boolean
 *             shape), components/IconButton, components/PressableScale, components/Surface,
 *             constants/theme, lib/cardRegistry (cardSpec — a card is NAMED, never described),
 *             lib/haptics, lib/i18n, lib/useAppTheme, lib/useCardOrder, lib/useDragReorder,
 *             lib/useHiddenCard
 *   Used by → app/(tabs)/index.tsx, shopping.tsx, plans.tsx, habits.tsx, health.tsx — all five
 *             screens as of 2026-09-01
 *   Data    → settings.hiddenCards via lib/useHiddenCard.ts and settings.cardOrder via
 *             lib/useCardOrder.ts. Writes nothing else — neither hiding nor moving a card
 *             changes what the app DOES with its rows: reminders still fire, counts still
 *             count. See lib/hiddenCards.ts and lib/cardOrder.ts.
 *
 * Edit notes:
 *   - ⚠️ **Home IS a caller now (2026-09-01), reversing the note this replaced.** That note read:
 *     *"Home is deliberately not a caller — its cards are previews of other tabs and carry a
 *     forced-restore rule (RESTORED_KINDS in lib/homeCards.ts) that exists precisely because
 *     they are previews."* True while Home had its own per-card ⋮ and its own order column, and
 *     the maintainer's ruling is that it should not have had those: one control per screen, on
 *     every screen. `settings.homeCardOrder`, `components/CardMenuSheet.tsx` and the `homeRetired`
 *     shelf are all gone, so there is no second mechanism left for this one to disagree with —
 *     which was the whole content of the old objection.
 *   - **There is no floor of one visible card.** A screen can be emptied, and that is safe here
 *     in a way it was not for Home's old "Edit cards" mode: this entry point is permanent header
 *     chrome, so the cards are always one tap from coming back.
 *   - Card titles come from the registry (`cardSpec(key).title(t)`), never restated here — a
 *     card is NAMED, not described, which is the whole contract lib/cardRegistry.ts exists for.
 *   - **The list is `useCardOrder`'s, not `cardsForScreen`'s.** It has to be the same list the
 *     screen draws, or the sheet reorders one order and the screen reads another. A hidden card
 *     keeps its POSITION in it, which is what makes turning one back on put it where it was
 *     rather than at the end.
 *   - Decision 044b applies: the shell is AnimatedBottomSheet so it plays a real exit animation.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import IconButton from '@/components/IconButton';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Switch } from '@/components/FormControls';
import { Fonts, FontSize, glassKey, IconSize, Radius, Spacing, MIN_TAP_TARGET } from '@/constants/theme';
import { CardScreen, cardSpec } from '@/lib/cardRegistry';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { useCardOrder } from '@/lib/useCardOrder';
import { useDragReorder } from '@/lib/useDragReorder';
import { useHiddenCard } from '@/lib/useHiddenCard';
import type { CardKey } from '@/lib/cardRegistry';
import type { DragRowProps } from '@/lib/useDragReorder';

type Props = {
  visible: boolean;
  screen: CardScreen;
  onClose: () => void;
};

/**
 * One row. Split into its own component because `useHiddenCard` is a hook and the list is a
 * `.map()` — the same reason components/SettingRow.tsx exists rather than inlining a switch.
 *
 * The row is `[≡ label] [↑] [↓] [switch]` — the drag handle glyph is a MARK, not a control (the
 * whole row is the drag target, per the app's one reorder gesture), so it costs no tap target.
 * The arrows are `IconSize.compact`, which `IconButton` still floors at `MIN_TAP_TARGET`.
 */
function CardRow({
  id,
  rowProps,
  isFirst,
  isLast,
  onMove,
}: {
  id: CardKey;
  rowProps: DragRowProps;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: CardKey, direction: -1 | 1) => void;
}) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [hidden, setHidden] = useHiddenCard(id);
  const label = cardSpec(id).title(t);

  return (
    <DraggableTaskRow isOpen={false} {...rowProps}>
      <View style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="reorder-three-outline" size={18} color={theme.textMuted} />
        <Text style={[styles.optionLabel, { color: theme.text }]} numberOfLines={1}>
          {label}
        </Text>
        {/* ⚠️ **Arrows, not chevrons.** A chevron means FOLD everywhere else in this app
            (components/CardCollapseToggle.tsx is the only thing that draws one, and
            lib/__tests__/cardAnatomy.test.ts fails any other file that hand-rolls one), so a
            ⌃/⌄ pair on a card row would say "open me" while doing something else entirely.
            Disabled rather than absent at the ends: a row whose control set changes with its
            position makes the whole list twitch as cards move past each other. */}
        <IconButton
          icon="arrow-up"
          label={t.manageCards.moveUp(label)}
          size={IconSize.compact}
          disabled={isFirst}
          onPress={() => onMove(id, -1)}
        />
        <IconButton
          icon="arrow-down"
          label={t.manageCards.moveDown(label)}
          size={IconSize.compact}
          disabled={isLast}
          onPress={() => onMove(id, 1)}
        />
        <Switch
          checked={!hidden}
          onChange={(next) => {
            selection();
            setHidden(!next);
          }}
          accessibilityLabel={label}
        />
      </View>
    </DraggableTaskRow>
  );
}

export default function ManageCardsSheet({ visible, screen, onClose }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  // The same list the screen itself draws — `useOrderedCards` under both, so the sheet cannot
  // reorder one order while the screen reads another. Hidden cards are IN it and keep their
  // position, which is what puts a restored card back where it was.
  const { ids, move, setOrder } = useCardOrder(screen);
  // Render in `drag.order`, never in `ids` — that is what moves under the finger. It falls back
  // to `ids` whenever no drag is running, so the arrows and the drag write the same list.
  const drag = useDragReorder(ids, (next) => setOrder(next as CardKey[]));

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.manageCards.title}</Text>
        {/* One short line, because "off" here is not "deleted" and that is the one thing a user
            could reasonably fear. */}
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.manageCards.hint}</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.manageCards.reorderHint}</Text>

        {drag.order.map((id, index) => (
          <CardRow
            key={id}
            id={id as CardKey}
            rowProps={drag.rowProps(id)}
            isFirst={index === 0}
            isLast={index === drag.order.length - 1}
            onMove={move}
          />
        ))}

        <PressableScale
          style={[styles.doneBtn, glassKey(theme.accent, isDark)]}
          onPress={onClose}
          scaleTo={0.95}
          accessibilityRole="button"
        >
          <Text style={[styles.doneBtnText, { color: theme.text }]}>{t.manageCards.close}</Text>
        </PressableScale>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  hint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    // xs, not sm: this row carries four things (handle, label, two arrows, switch) where it
    // used to carry two, and `npm run wraps` at 360 is what the extra 12px buys.
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
  },
  // `flex: 1` + `minWidth: 0` together, never `flex: 1` alone — see components/TaskCard.tsx's
  // note: without the minWidth a long title refuses to shrink and pushes the switch out.
  optionLabel: { flex: 1, minWidth: 0, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  doneBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
