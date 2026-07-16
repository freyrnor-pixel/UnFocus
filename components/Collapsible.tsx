/**
 * Collapsible.tsx — controlled reveal for arbitrary content driven by a boolean.
 *
 * Wrap any block whose visibility is driven by a boolean and it will glide open and shut by
 * clip-unveiling — content is incrementally uncovered (open) or covered (close) from behind
 * an edge, instead of instantly mounting. Use it anywhere a `{open && <View/>}` block used
 * to pop in with no animation.
 *
 * Connections:
 *   Imports → react-native-reanimated (useSharedValue/useAnimatedStyle/withTiming/runOnJS),
 *             constants/motion (Duration, Ease), lib/useAppTheme (useAccessibility)
 *   Used by → components/TaskCard.tsx, components/PlanTaskCard.tsx, components/ExpandableCard.tsx,
 *             app/(tabs)/plans.tsx, app/task-form.tsx, app/health-form.tsx, app/habit-form.tsx,
 *             app/automations.tsx, app/(tabs)/health.tsx (filter reveals)
 *   Data    → none (controlled via the `open` prop)
 *
 * Edit notes:
 *   - **Measured-height clip (2026-07-16, supersedes the LinearTransition/FadeOut version):** the
 *     reveal now animates the wrapper's own `height` from `0 → contentHeight` (open) and back
 *     (close) via a `progress` shared value + `withTiming`, inside `overflow:'hidden'`. Content
 *     is uncovered/covered edge-by-edge with **no opacity fade** — a completed task tucked into
 *     a "Done" zone should feel *still there, just folded away*, not "gotten and faded" (an
 *     anxiety-/neurodivergent-friendly motion choice, ANIMATION_GUIDELINES.md §6).
 *   - **Why this replaces `LinearTransition` + `exiting={FadeOut}`:** that pair caused two
 *     bugs. (1) `FadeOut` literally fades the whole block on close. (2) an `exiting` animation
 *     pulls the leaving view OUT of layout flow and keeps painting it while the rows below
 *     collapse underneath — so the fading content spilled past the card edge / overlapped
 *     neighbors. Driving an explicit clipped height instead keeps content contained at every
 *     frame (no spill) and never touches opacity (no fade).
 *   - **Why a shared-value height works where PR #183's didn't:** #183 animated
 *     `height: interpolate(progress, [0,1], [0, contentH])` where `contentH` was a **stale JS
 *     closure** (0 at first paint, never re-read by the worklet), so the body stayed clipped
 *     at 0. Here the measured height lives in a `useSharedValue` set from `onLayout`, so the
 *     worklet always reads the current value. `AnimatedChevron.tsx` uses the same reliable
 *     `useSharedValue`+`withTiming`+`useAnimatedStyle` pattern.
 *   - The inner measuring `View` lays out at its natural content height regardless of the
 *     animated wrapper height (an explicit main-axis height doesn't shrink the child — it just
 *     clips it), so `onLayout` reports the real height to grow toward.
 *   - **Lazy mount preserved:** children render only while `open` OR while a close animation is
 *     still playing; the close `withTiming` completion callback unmounts them (`runOnJS`). A
 *     fully-collapsed instance renders no children (matters for long lists like WeekListCard
 *     history via ExpandableCard). `measured` persists across mounts, so a re-open starts
 *     cleanly clipped at 0.
 *   - Mount-already-open (e.g. an isNew task card that starts expanded) shows content
 *     immediately at natural height with no entrance animation (progress starts at 1).
 *   - reducedMotion drops the animation entirely (instant mount/unmount).
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
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

  // Children stay mounted while open OR while a close animation is still finishing, then the
  // withTiming completion callback unmounts them — preserving the old lazy-mount of the body.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);
  const measured = useSharedValue(0);
  // Only a card mounted ALREADY open uses auto height (show content immediately, no flash)
  // until its first measure; every subsequent open-from-closed starts cleanly clipped at 0,
  // so the common tap-to-expand never flashes full content before revealing.
  const initialAuto = useSharedValue(open);
  const firstRun = useRef(true);

  useEffect(() => {
    // Skip animating on the very first render: a mount-already-open instance shows its content
    // immediately (no entrance), and a mount-closed one is simply absent.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (open) setMounted(true);

    if (reducedMotion) {
      progress.value = open ? 1 : 0;
      if (!open) setMounted(false);
      return;
    }

    progress.value = withTiming(
      open ? 1 : 0,
      {
        duration: open ? Duration.card : Duration.cardOut,
        easing: open ? Ease.enter : Ease.exit,
      },
      (finished) => {
        // Unmount the (now-hidden) children once the close animation lands.
        if (finished && !open) runOnJS(setMounted)(false);
      }
    );
  }, [open, reducedMotion, progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    measured.value = e.nativeEvent.layout.height;
    initialAuto.value = false;
  };

  const clipStyle = useAnimatedStyle(() => ({
    // Mount-already-open: auto height for the first frame(s) so content shows immediately with
    // no flash. Otherwise drive the clip from the measured height (0 until laid out, which is
    // the correct closed state — the tap-to-expand path starts here and grows from 0).
    height: initialAuto.value ? undefined : progress.value * measured.value,
  }));

  if (reducedMotion) {
    return open ? <View style={style}>{children}</View> : null;
  }

  return (
    <Animated.View style={[styles.clip, style, clipStyle]}>
      {mounted ? <View onLayout={onLayout}>{children}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
