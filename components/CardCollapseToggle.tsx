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
import AnimatedChevron from '@/components/AnimatedChevron';
import PressableScale from '@/components/PressableScale';
import { HitSlop, MIN_TAP_TARGET } from '@/constants/theme';
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
      hitSlop={HitSlop.base}
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
  btn: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
