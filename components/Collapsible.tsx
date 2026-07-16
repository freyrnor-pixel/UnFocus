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
 *   - Closing (2026-07-16 fix): the inner child carries `exiting={FadeOut}`. Without it the
 *     child unmounted in one commit and the wrapper's height SNAPPED to 0 — a `layout`
 *     animation does not reliably animate a shrink caused by its own child being removed, so
 *     the collapse had no animation while the open (a grow the wrapper's `LinearTransition`
 *     catches) looked fine. With an `exiting` animation Reanimated pulls the leaving child out
 *     of layout flow WHILE it plays, so the outer wrapper folds shut via `LinearTransition`
 *     *at the same time* — the fold and a light fade overlap into one cohesive close that
 *     mirrors the open. (The #196 clip rewrite dropped the earlier `FadeOut` and lost the
 *     collapse animation entirely; this restores the exit without giving up the clip-unveil
 *     open.) The child is only rendered while `open`, so a collapsed instance renders no
 *     children (lazy mount preserved).
 *   - Mount-already-open (e.g. a new task card that starts expanded) shows content immediately:
 *     the wrapper mounts at its natural size with no prior frame to transition from, so there's
 *     no entrance animation; the reveal animates on subsequent toggles.
 *   - reducedMotion drops the layout animation entirely (instant mount/unmount).
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
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
        <Animated.View
          layout={LinearTransition.duration(Duration.card).easing(Ease.move)}
          exiting={FadeOut.duration(Duration.cardOut).easing(Ease.exit)}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
