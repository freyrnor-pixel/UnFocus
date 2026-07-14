/**
 * Collapsible.tsx — controlled measured-height reveal for arbitrary content.
 *
 * Wrap any block whose visibility is driven by a boolean and it will glide open/closed
 * (height 0↔natural, plus a fade and an 8px slide-up) instead of instantly mounting.
 * This is the reusable extraction of the measured-height reveal proven in ExpandableCard
 * (the canonical pattern per ANIMATION_GUIDELINES.md §1) — use it anywhere a
 * `{open && <View/>}` block used to pop in with no animation.
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/motion (Duration, Ease), lib/useAppTheme (useAccessibility)
 *   Used by → components/TaskCard.tsx, components/PlanTaskCard.tsx, app/(tabs)/plans.tsx,
 *             app/task-form.tsx, app/health-form.tsx, app/habit-form.tsx, app/automations.tsx,
 *             app/(tabs)/health.tsx (filter reveals)
 *   Data    → none (controlled via the `open` prop)
 *
 * Edit notes:
 *   - Measured-height reveal is the RN-correct equivalent of a web height:auto transition:
 *     the always-laid-out inner view reports its natural height via onLayout into `contentH`,
 *     and the outer clip interpolates 0→contentH as `progress` runs. Content also fades and
 *     slides up 8px. Timings from motion.ts: card enter / cardOut exit.
 *   - Body stays mounted through the close animation, then unmounts (`rendered` flips false in
 *     the withTiming completion callback) — a collapsed instance renders null (lazy mount).
 *   - First-open deferral: because the body only mounts when `rendered` flips true, on the very
 *     first open `contentH` is still 0; starting withTiming then would interpolate height 0→0 and
 *     snap. The open is deferred (`pendingOpenRef`) until onBodyLayout reports the natural height.
 *   - reducedMotion runs the same timings with duration 0 (instant snap) — single code path.
 *   - Mount already-open (e.g. a new task card that starts expanded) shows content immediately
 *     with no animation; the reveal animates on subsequent toggles. Matches ExpandableCard.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  open: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Collapsible({ open, children, style }: Props) {
  const { reducedMotion } = useAccessibility();

  // 0 = collapsed, 1 = expanded. Drives clip height, opacity, slide.
  const progress = useSharedValue(open ? 1 : 0);
  // Natural height of the content, reported by the inner view's onLayout.
  const contentH = useSharedValue(0);
  // Keep the body mounted while collapsing so height can animate back to 0, then unmount.
  const [rendered, setRendered] = useState(open);
  const mountedRef = useRef(false);
  // True while an open waits for the body's first layout (see header — first-open deferral).
  const pendingOpenRef = useRef(false);

  function animateOpen() {
    progress.value = withTiming(1, {
      duration: reducedMotion ? 0 : Duration.card,
      easing: Ease.enter,
    });
  }

  useEffect(() => {
    // Skip the first run: progress/rendered already reflect the initial `open`.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (open) {
      setRendered(true);
      if (contentH.value > 0) {
        animateOpen();
      } else {
        pendingOpenRef.current = true;
      }
    } else {
      pendingOpenRef.current = false;
      progress.value = withTiming(
        0,
        { duration: reducedMotion ? 0 : Duration.cardOut, easing: Ease.exit },
        (finished) => {
          if (finished) runOnJS(setRendered)(false);
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion]);

  function onBodyLayout(e: LayoutChangeEvent) {
    contentH.value = e.nativeEvent.layout.height;
    if (pendingOpenRef.current) {
      pendingOpenRef.current = false;
      animateOpen();
    }
  }

  const clipStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, contentH.value]),
    opacity: progress.value,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
  }));

  if (!rendered) return null;

  return (
    <Animated.View style={[styles.clip, clipStyle, style]}>
      <Animated.View style={innerStyle} onLayout={onBodyLayout}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Outer clip: its animated `height` reveals/hides the body; overflow hidden masks the
  // always-laid-out inner content while collapsed/animating.
  clip: { overflow: 'hidden' },
});
