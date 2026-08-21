/**
 * AnimatedChevron.tsx — a chevron-down icon that rotates 0↔180° on an `open` prop.
 *
 * Drop-in replacement for the common `<Ionicons name={open ? 'chevron-up' : 'chevron-down'} />`
 * icon-swap so an expand/collapse affordance rotates smoothly instead of hard-swapping glyphs.
 *
 * Connections:
 *   Imports → react-native-reanimated, @expo/vector-icons, constants/motion (Duration, Ease),
 *             lib/useAppTheme (useAccessibility)
 *   Used by → components/TaskCard.tsx, components/PlanTaskCard.tsx, components/ExpandableCard.tsx,
 *             components/FoodTab.tsx, app/(tabs)/shopping.tsx (the Monthly tab's
 *             purchased-this-month trip headers — they drew a bold ▲/▼ TEXT glyph and
 *             hard-swapped it until 2026-08-08, the last such affordance in the app)
 *             (and any expand affordance)
 *   Data    → none (controlled via `open`)
 *
 * Edit notes:
 *   - **⚠️ `size` and `color` DEFAULT, and a caller should almost never pass either
 *     (2026-08-21).** Both were required props, and the app shipped this glyph at **13, 14, 16
 *     and 18px** in three colours — `CONSISTENCY_AUDIT.md` §2, from the report *"Now some of
 *     them have different text size, some have icon while others not"*. The sizes were not
 *     chosen against each other; each call site picked one that looked right in isolation,
 *     which is what a required prop with no default asks every caller to do. Now: 18px in
 *     `theme.textMuted`, the same values `components/CardCollapseToggle.tsx` was already using,
 *     so a fold chevron is one glyph whichever of the two disclosure idioms draws it (see that
 *     file's header for the two).
 *       `lib/__tests__/cardAnatomy.test.ts` fails on a `size=` or `color=` passed here outside
 *     a named exception. There are two, both deliberate and both a different CONTROL rather
 *     than a differently-sized fold: `PadFooterToggle`'s (the pad cards' three-state size
 *     cycle, which is accent-coloured because it is a live action with a count beside it) and
 *     `TaskCard`'s "Advanced" disclosure inside the editor.
 *   - reducedMotion snaps (duration 0). Rotation only.
 *   - **It runs on the BODY's clock, not the control clock (2026-08-14).** This was
 *     `Duration.control` (150) with `Ease.enter` in both directions, while the thing it points
 *     at — `components/Collapsible.tsx` — runs 220/`Ease.enter` open and 200/`Ease.exit` close.
 *     So the arrow finished ~70ms early and, on close, decelerated into its stop while the body
 *     accelerated away from it: two halves of one gesture visibly disagreeing, which is part of
 *     what a device read as "expanding and collapsing animation does not look smooth". Every
 *     caller of this component is an expand/collapse affordance for a `Collapsible` body, so
 *     matching that pair is the right DEFAULT rather than a per-call-site prop — a prop would
 *     have to be passed correctly at each site to be worth anything, and the sites that forgot
 *     would be exactly the ones nobody looked at. If a non-collapse caller ever needs the
 *     shorter control timing, give it an override then; there is none today.
 */
import React, { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

/**
 * The one size a fold chevron is drawn at. Exported so the guard in
 * `lib/__tests__/cardAnatomy.test.ts` can assert against the real value rather than a copy.
 */
export const CHEVRON_SIZE = 18;

type Props = {
  open: boolean;
  /** Defaults to `theme.textMuted`. See the edit notes before passing one. */
  color?: string;
  /** Defaults to 18. See the edit notes before passing one. */
  size?: number;
};

export default function AnimatedChevron({ open, color, size = CHEVRON_SIZE }: Props) {
  const { reducedMotion } = useAccessibility();
  const theme = useAppTheme();
  const glyphColor = color ?? theme.textMuted;
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    // The same duration/easing PAIR components/Collapsible.tsx uses, so the arrow and the body
    // it points at start and land together — including the asymmetry (a close is faster than an
    // open, and eases the other way). See the edit note.
    progress.value = withTiming(open ? 1 : 0, {
      duration: reducedMotion ? 0 : open ? Duration.card : Duration.cardOut,
      easing: open ? Ease.enter : Ease.exit,
    });
  }, [open, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name="chevron-down" size={size} color={glyphColor} />
    </Animated.View>
  );
}
