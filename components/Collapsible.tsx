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
 *   - **Clip reveal, not a fade (2026-07-16):** the body is *unveiled* — an outer, always-mounted
 *     wrapper with `overflow:'hidden'` grows/shrinks as its child mounts/unmounts, and
 *     `layout={LinearTransition}` animates that size change, so content is revealed from behind
 *     an edge instead of fading in. Deliberately NO opacity fade and NO slide-from-above
 *     (the old `FadeInDown`/`FadeOut`): a completed task tucked into a "Done" zone should feel
 *     like it's *still there, just folded away*, not "gotten and faded" — a neurodivergent-/
 *     anxiety-friendly motion choice (see ANIMATION_GUIDELINES.md §6 and the Tasks screen).
 *   - **Why layout animations, not a measured `height` interpolation:** an earlier version
 *     animated `height: interpolate(progress, [0,1], [0, contentH])` inside a `useAnimatedStyle`.
 *     Under Reanimated 4 + the New Architecture, animating layout props (`height`/`width`)
 *     through `useAnimatedStyle` does NOT drive a visible reveal — the chevron rotated but the
 *     body stayed clipped at height 0 (PR #183). Only transform/opacity and the
 *     entering/exiting/`layout` layout-animation primitives are reliable here; `LinearTransition`
 *     (a `layout` animation) drives the size change dependably, which is what the clip reveal
 *     leans on. No `height` math, no onLayout measurement.
 *   - Closing: `open` flips false → the inner child unmounts → the outer wrapper shrinks to 0
 *     via `LinearTransition` (a smooth fold-away, no fade). The child is only rendered while
 *     `open`, so a collapsed instance renders no children (lazy mount preserved).
 *   - Mount-already-open (e.g. a new task card that starts expanded) shows content immediately:
 *     the wrapper mounts at its natural size with no prior frame to transition from, so there's
 *     no entrance animation; the reveal animates on subsequent toggles.
 *   - reducedMotion drops the layout animation entirely (instant mount/unmount).
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  open: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Collapsible({ open, children, style }: Props) {
  const { reducedMotion } = useAccessibility();

  if (reducedMotion) {
    return open ? <View style={style}>{children}</View> : null;
  }

  // Outer wrapper is always mounted; `overflow:'hidden'` clips the child so it appears to be
  // unveiled from behind an edge as the wrapper grows (open) or fold away as it shrinks (close).
  // LinearTransition animates the wrapper's own size change when the child mounts/unmounts.
  return (
    <Animated.View
      style={[styles.clip, style]}
      layout={LinearTransition.duration(Duration.card).easing(Ease.move)}
    >
      {open ? (
        <Animated.View layout={LinearTransition.duration(Duration.card).easing(Ease.move)}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
