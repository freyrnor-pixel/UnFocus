/**
 * Collapsible.tsx — controlled reveal for arbitrary content driven by a boolean.
 *
 * Wrap any block whose visibility is driven by a boolean and it will glide open (fade +
 * slide-down into place) and fade out on close, instead of instantly mounting. Use it
 * anywhere a `{open && <View/>}` block used to pop in with no animation.
 *
 * Connections:
 *   Imports → react-native-reanimated (FadeInDown/FadeOut/LinearTransition), constants/motion
 *             (Duration, Ease), lib/useAppTheme (useAccessibility)
 *   Used by → components/TaskCard.tsx, components/PlanTaskCard.tsx, app/(tabs)/plans.tsx,
 *             app/task-form.tsx, app/health-form.tsx, app/habit-form.tsx, app/automations.tsx,
 *             app/(tabs)/health.tsx (filter reveals)
 *   Data    → none (controlled via the `open` prop)
 *
 * Edit notes:
 *   - **Why layout animations, not a measured `height` interpolation (2026-07-15 fix):** the
 *     previous version animated `height: interpolate(progress, [0,1], [0, contentH])` inside a
 *     `useAnimatedStyle`. Under Reanimated 4 + the New Architecture, animating layout props
 *     (`height`/`width`) through `useAnimatedStyle` does NOT drive a visible reveal — the
 *     chevron (a `transform` animation) rotated but the body stayed clipped at height 0, so
 *     cards never expanded (PR #183 bug report: "arrow works, not the expansion"). Only
 *     transform/opacity and the entering/exiting/`layout` layout-animation primitives are
 *     reliable here — the same house pattern proven in AnimatedListItem/ShoppingRow. This file
 *     now uses those exclusively: no `height` math, no onLayout measurement, no first-open
 *     deferral needed. `ExpandableCard` still carries the old `height`-interpolation approach
 *     and shares this latent bug — migrate it the same way if its accordions misbehave.
 *   - Closing: when `open` flips false the Animated.View is removed from render; Reanimated
 *     plays `exiting` (FadeOut) before actually unmounting, so a collapsed instance renders
 *     null (lazy mount preserved).
 *   - `layout={LinearTransition}` lets the card's own size change animate smoothly instead of
 *     snapping when the body appears/disappears — recovers the "glide" feel without measuring.
 *   - Mount-already-open (e.g. a new task card that starts expanded) shows content immediately
 *     with no entrance animation; the reveal animates on subsequent toggles. Matches the prior
 *     contract via `firstOpenRef`.
 *   - reducedMotion drops entering/exiting/layout entirely (instant snap) — single code path.
 */
import React, { useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  open: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Collapsible({ open, children, style }: Props) {
  const { reducedMotion } = useAccessibility();
  // Was this the component's very first render? A card mounted already-open (e.g. a new task
  // card) then shows its content instantly with no entrance; a card mounted collapsed animates
  // on its first (and every later) open. Consumed on the mount render regardless of `open`.
  const firstRenderRef = useRef(true);
  const mountedOpen = firstRenderRef.current && open;
  firstRenderRef.current = false;

  if (!open) return null;

  if (reducedMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={style}
      entering={mountedOpen ? undefined : FadeInDown.duration(Duration.card).easing(Ease.enter)}
      exiting={FadeOut.duration(Duration.cardOut).easing(Ease.exit)}
      layout={LinearTransition.duration(Duration.card).easing(Ease.move)}
    >
      {children}
    </Animated.View>
  );
}
