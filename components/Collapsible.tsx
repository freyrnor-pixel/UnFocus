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
 *   - **Auto-height fallback (2026-07-18) — the reveal no longer DEPENDS on measurement.** The
 *     "measured height stays 0" failure recurred (chevron rotates, body stays hidden) because
 *     under Fabric the child inside a `height:0`/`overflow:hidden` clip can itself measure 0, so
 *     `progress * 0` clips the body shut forever. Fix: the clip worklet now returns natural/auto
 *     height whenever the card is OPEN but has no valid measurement (`openSV` mirrors `open` onto
 *     the UI thread so it can tell that apart from "closed"), so an open body is ALWAYS visible
 *     even if `onLayout` never reports a real height. `onLayout` then snaps `progress` to 1 on
 *     the first measure-while-open (the body was already at full auto height — animating up from
 *     0 would flicker); later opens animate normally from the cached measured height.
 *   - **Lazy mount preserved:** children render only while `open` OR while a close animation is
 *     still playing; the close `withTiming` completion callback unmounts them (`runOnJS`). A
 *     fully-collapsed instance renders no children (matters for long lists like WeekListCard
 *     history via ExpandableCard). `measured` persists across mounts, so a re-open animates
 *     from the cached height.
 *   - Mount-already-open (e.g. an isNew task card that starts expanded) shows content
 *     immediately at natural height (the auto-height fallback), no entrance animation.
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
  // `open` mirrored onto the UI thread so the clip worklet can tell "open but not yet measured"
  // (must stay visible) apart from "closed" (height 0) — see clipStyle.
  const openSV = useSharedValue(open ? 1 : 0);
  const firstRun = useRef(true);

  useEffect(() => {
    openSV.value = open ? 1 : 0;
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
  }, [open, reducedMotion, progress, openSV]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    // First real measurement while open: the body was showing at auto height (the fallback
    // below), so snap progress to fully-open instead of animating up from 0 — otherwise the
    // clip would jump from full height down to `progress * h` and grow back, a visible flicker.
    // Later opens animate normally from the cached measured height.
    if (measured.value === 0 && open) progress.value = 1;
    measured.value = h;
  };

  const clipStyle = useAnimatedStyle(() => {
    // CRITICAL: never clip an OPEN body to 0. If there's no valid measurement yet — the first
    // open, or a Fabric layout where the child inside this height:0/overflow:hidden clip
    // measured 0 — fall back to natural/auto height so the content is ALWAYS visible. This is
    // the guard against the recurring "chevron rotates but the body stays hidden" bug: the
    // reveal no longer depends on measurement succeeding. Once measured, drive the clip height
    // from progress (0 = closed → measured = fully open) for the smooth grow/shrink.
    if (openSV.value === 1 && measured.value === 0) return { height: undefined };
    return { height: progress.value * measured.value };
  });

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
