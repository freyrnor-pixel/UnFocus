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
 *   - **Absolute-positioned measurer (2026-07-18, supersedes the "auto-height fallback").** The
 *     "measured height stays 0" failure kept recurring (chevron rotates, body stays hidden) for
 *     two compounding Fabric/Reanimated-4 reasons: (1) a child inside a `height:0`/`overflow:hidden`
 *     clip itself measures 0, so `onLayout` never reports a real height; and (2) animating a
 *     layout prop TO `height: undefined` from `useAnimatedStyle` does NOT reset the view to auto —
 *     it retains the last committed numeric value (0), so the old "return `{height: undefined}`
 *     when open-but-unmeasured" fallback never actually revealed anything. Fix: the measuring
 *     child is now `position:'absolute'` (left/right:0, no vertical constraint), so it lays out at
 *     its NATURAL height even while the clip is collapsed to 0 — `onLayout` always reports the real
 *     height. The clip height is then driven by a numeric `progress * measured`, and the reveal
 *     animates a real 0 → measured grow — no `openSV` mirror needed. The one remaining
 *     `height: undefined` branch is narrow and safe: it fires ONLY for a mount-already-open,
 *     never-measured card (its initial committed value, so it shows instantly instead of flashing
 *     collapsed), and hands off to the numeric branch the instant `measured` is set. It is never
 *     reached as an animated transition TO undefined (the case Fabric ignores), so it can't get
 *     stuck the way the old closed→open fallback did.
 *   - **Lazy mount preserved:** children render only while `open` OR while a close animation is
 *     still playing; the close `withTiming` completion callback unmounts them (`runOnJS`). A
 *     fully-collapsed instance renders no children (matters for long lists like WeekListCard
 *     history via ExpandableCard). `measured` persists across mounts, so a re-open animates
 *     from the cached height.
 *   - Mount-already-open (e.g. an isNew task card that starts expanded) shows content
 *     immediately at natural height (the narrow mount-open `height: undefined` branch), no
 *     entrance animation.
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
    // The measuring child is absolutely positioned (styles.measure), so it lays out at its
    // natural height regardless of the clip's current (possibly 0) height — this always reports
    // the real content height, even while collapsed. The reveal then animates 0 → measured off
    // `progress`, so there's nothing to snap here.
    const h = e.nativeEvent.layout.height;
    if (h > 0) measured.value = h;
  };

  const clipStyle = useAnimatedStyle(() => {
    // Mount-already-open, not yet measured (an isNew/defaultOpen card): show at natural/auto
    // height for the first frame(s) so it doesn't flash collapsed before onLayout reports its
    // height. This is safe — it's the INITIAL committed value, never an animated transition TO
    // undefined (which Fabric ignores, the bug that broke the old closed→open fallback) — and it
    // hands off seamlessly to the numeric branch the instant `measured` is set. progress starts
    // at exactly 1 only for a mount-open card and only changes via withTiming on a later toggle.
    if (progress.value === 1 && measured.value === 0) return { height: undefined };
    // Every other case — crucially the closed→open reveal — drives the clip height off a numeric
    // progress * measured (0 = closed, measured = fully open), animating a real 0 → height grow.
    // The absolute-positioned measurer guarantees `measured` becomes a real value, so this never
    // gets stuck at 0 the way the old measure-inside-the-clip approach did.
    return { height: progress.value * measured.value };
  });

  if (reducedMotion) {
    return open ? <View style={style}>{children}</View> : null;
  }

  return (
    <Animated.View style={[styles.clip, style, clipStyle]}>
      {mounted ? <View style={styles.measure} onLayout={onLayout}>{children}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // left/right:0 gives full width; no bottom/height means natural content height, unconstrained
  // by the parent's animated (possibly 0) height — so onLayout always reports the real height,
  // even while collapsed. position:'absolute' also removes it from flow, so the clip's height is
  // driven solely by clipStyle (the numeric progress * measured).
  measure: { position: 'absolute', left: 0, right: 0, top: 0 },
});
