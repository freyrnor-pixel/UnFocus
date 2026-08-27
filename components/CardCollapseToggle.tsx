/**
 * CardCollapseToggle.tsx — the chevron that folds a content card away.
 *
 * One control, so the eleven cards that gained a collapse on 2026-08-14 don't each hand-roll a
 * chevron with its own tap target, its own accessibility wording and its own idea of which way
 * "open" points. Maintainer: *"Every card should be collapsable"*, remembered across launches.
 *
 * ⚠️ **There are TWO disclosure idioms, both correct, and which one a card uses is decided by
 * its header rather than by taste (written down 2026-08-21).**
 *
 *   1. **The chevron is the button** — this component. Use it when the header carries anything
 *      ELSE that is tappable: a ⋯ menu, a ⤢, a reminder bell, a name that navigates. A header
 *      with other controls cannot itself be one big button, because a pressable inside a
 *      pressable swallows the inner one's touches.
 *   2. **The header is the button** — a `PressableScale` around the whole naming row with a
 *      passive `components/AnimatedChevron.tsx` in it. Use it when the chevron is the only
 *      thing to tap. It gives a far bigger target than a 48px box, which is why it is not
 *      merely tolerated. `FoodTab`'s meal sections, the done/checked zones on the pad cards and
 *      To-do's "The rest" all take this shape.
 *
 * `CONSISTENCY_AUDIT.md` §2 counted fourteen collapsed-header variants, and the two idioms were
 * NOT the reason — the sizes were. The same glyph shipped at 13, 14, 16 and 18px in three
 * colours, because `AnimatedChevron` had a required `size` and a required `color`, so every
 * call site answered the question separately. Both default now, to this component's values, and
 * the guard fails on an override. Idiom 2 is not a second-class fallback; it is the right answer
 * for a bare header, and it now looks identical to idiom 1.
 *
 * Drop it in the card's existing header cluster, at the trailing edge, and wrap the card's body
 * in `components/Collapsible.tsx`:
 *
 *   const [collapsed, toggleCollapsed] = useCollapsedCard('healthWeek');
 *   …
 *   <CardCollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} />
 *   <Collapsible open={!collapsed}>{body}</Collapsible>
 *
 * Connections:
 *   Imports → components/PressableScale, components/AnimatedChevron, constants/theme
 *             (MIN_TAP_TARGET, HitSlop), lib/useAppTheme, lib/i18n, lib/haptics
 *   Used by → the tab screens' content cards — app/(tabs)/index.tsx, plans.tsx, habits.tsx,
 *             health.tsx, shopping.tsx — always paired with lib/useCollapsedCard.ts
 *   Data    → none (controlled; the hook owns the state)
 *
 * Edit notes:
 *   - **Takes `collapsed`, not `open`.** The stored value is "is this folded away" (see
 *     lib/collapsedCards.ts — absent means open), and the surrounding `Collapsible` takes
 *     `open`. Flipping the sense once, here, is better than every call site remembering to.
 *     `AnimatedChevron` is handed `!collapsed` for the same reason: its `open` points UP.
 *   - **Reuses `t.collapseListLabel` / `t.expandListLabel`**, the strings
 *     `components/CollapsedSection.tsx` already uses for the same gesture. Deliberately not new
 *     keys: two wordings for one action is how a screen reader ends up describing the same
 *     control two ways on two cards.
 *   - `tap()`, not `selection()`. Selection is the haptic for picking one of several
 *     (`FormControls`, `TabSlider`); this is a plain state flip on one thing.
 *   - ⚠️ **The glyph is CENTRED in the 48px box (consistency audit, 2026-08-21).** It used to
 *     align `flex-end`, so the chevron sat hard against the box's trailing edge while the target
 *     extended inward — the maintainer's report names this shape exactly: *"Elements within
 *     buttons must be centered in the middle, except for the box itself, which is located where
 *     it is meant to be."* The box's POSITION is unchanged (`SectionRail`'s `right` slot still
 *     pushes it to the card's trailing edge with `marginLeft: 'auto'`); only the glyph inside it
 *     moved. `CollapsedSection`'s `chevronBtn` — the control this generalises, and which had a
 *     byte-identical copy of the old style — moved in the same edit, so the two still agree.
 *   - No `Surface`, no border, no fill: this goes INSIDE a card header that already has all
 *     three. If it ever needs to stand alone, it needs a housing, not a variant here.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import AnimatedChevron, { CHEVRON_SIZE } from '@/components/AnimatedChevron';
import PressableScale from '@/components/PressableScale';
import { hitSlopFor, IconSize, MIN_TAP_TARGET } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** True when the card is folded away — the stored sense. See the edit notes. */
  collapsed: boolean;
  onToggle: () => void;
  /**
   * Names the card in the accessibility label, so a screen reader hears which one it is about
   * to fold. Omit only where the card has no name of its own.
   */
  cardLabel?: string;
};

export default function CardCollapseToggle({ collapsed, onToggle, cardLabel }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const action = collapsed ? t.expandListLabel : t.collapseListLabel;

  return (
    <PressableScale
      onPress={() => { tap(); onToggle(); }}
      hitSlop={hitSlopFor(CHEVRON_SIZE)}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={cardLabel ? `${cardLabel}: ${action}` : action}
      accessibilityState={{ expanded: !collapsed }}
    >
      <View pointerEvents="none">
        <AnimatedChevron open={!collapsed} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /**
   * ⚠️ **The BOX is glyph-sized; the TARGET comes from `hitSlopFor` (2026-08-21).**
   *
   * It was `minWidth: MIN_TAP_TARGET` **and** a `HitSlop.base` — belt and braces, and the belt
   * cost 30px of every card header's width for an 18px glyph. `MIN_TAP_TARGET`'s own doc says
   * to pick one: *"don't grow the art — expand the touch area instead, either with a
   * minHeight/minWidth of MIN_TAP_TARGET **or** with a HitSlop token."*
   *
   * That 30px was measurable, not theoretical. With it, To-do's "Når som helst" header had 136px
   * for a 159px title at 360px in Norwegian, and Shop's Catalogue card truncated to "Catal…" —
   * a card header spent half its width on controls. `hitSlopFor(CHEVRON_SIZE)` derives the pad
   * from the glyph rather than naming a token that happens to suit, so the target stays exactly
   * 48 if the glyph ever moves.
   *
   * The HEIGHT keeps `MIN_TAP_TARGET`: vertical room in a header row is free, and it is what
   * keeps a folded card's header the same height as an open one's.
   *
   * ⚠️ **The WIDTH came back as `IconSize.action` on 2026-08-22, and it is an alignment fix, not
   * a target fix** (maintainer: *"Move other buttons to fit, and make sure they are aligned
   * (they are not now)."*). A caller's header controls are `IconButton`s, whose visible cap is
   * `IconSize.action` wide; this glyph is 18. Flush-right in the same row, the button's centre
   * sat 18px from the card's edge and the chevron's sat 9 — so the trailing control landed in a
   * different place depending on whether the card had one, and a column of cards had a ragged
   * right margin. Matching the cap width puts every trailing glyph on one vertical line.
   *
   * This does NOT reopen the 2026-08-21 width argument, because that pass was paying 30px for a
   * `MIN_TAP_TARGET` (48) box on a header that also carried a 36px ⤢. The target still comes
   * from `hitSlopFor`, per `MIN_TAP_TARGET`'s "pick one" rule — this is a cap width, not a tap
   * target, and the slop is what makes it 48.
   *
   * ⚠️ **`compact` (30), not `action` (36), since 2026-08-27 (round 20).** The width tracks
   * whatever the TRAILING control's cap is, because that is the whole point of it — and round 20
   * moved both: `CardExpandButton` draws at `IconSize.compact` now, and the cluster reordered so
   * the ⤢ is the outermost item rather than this chevron. On a card with no ⤢ and no caller
   * controls the chevron IS the trailing item, so it has to be the same width as the ⤢ or those
   * two kinds of card get a ragged right margin against each other — which is the exact defect
   * the 2026-08-22 note above was written about, one size down.
   */
  btn: {
    minWidth: IconSize.compact,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
