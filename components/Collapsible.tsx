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
 *   Used by → components/TaskCard.tsx, components/PlanTaskCard.tsx, components/DisclosureRow.tsx,
 *             components/PadSheet.tsx, app/plans.tsx, app/health-form.tsx,
 *             app/habit-form.tsx, app/automations.tsx,
 *             app/habits.tsx (person-filter reveal AND, since 2026-08-08, HabitCard's
 *             own WeekStrip/rest-day body), app/(tabs)/shopping.tsx (the Monthly tab's
 *             purchased-this-month trip groups, 2026-08-08)
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
 *   - **A fully-closed instance renders `null`, not a zero-height clip (2026-08-13).** An empty
 *     `Animated.View` is still a flex child, so in a `gap`-ed container it booked a whole gap
 *     slot for absent content — 8px of dead space under a collapsed Food meal section's header,
 *     which read as the title sitting above the card's centre. AGENTS.md documented this as
 *     "a closed Collapsible still books a gap slot" and two call sites worked around it by hand
 *     (plans.tsx's wrapped filter rows, habits.tsx's gated person filter); both are now
 *     redundant but harmless. It also settled a disagreement between the two motion settings —
 *     the `reducedMotion` branch has always returned null. Don't reintroduce the empty wrapper
 *     to "keep layout stable": there is nothing to keep stable at height 0.
 *   - **The open curve WAITS for the first measurement (2026-08-14).** `setMounted(true)` and
 *     the `withTiming` used to run on the same tick, so on a body that had never been opened
 *     the curve started against `measured === 0`: the clip held at `progress * 0` for the first
 *     frames, then jumped to `progress * measured` — already partway along — the moment React
 *     committed the child and `onLayout` fired. A hitch, then a catch-up, on every first
 *     expand, and worst exactly where it is most visible (Shopping's drawers mount the whole of
 *     `FoodTab`/`CatalogueTab`). An open with no height yet now sets `pendingOpen` instead, and
 *     a `useAnimatedReaction` on `measured` starts the reveal on the frame the height lands.
 *     Re-opens are unaffected — `measured` survives the unmount, so they take the immediate
 *     path. **Keep the reaction's body worklet-safe**: `runOpen` is `'worklet'`-marked and
 *     touches only shared values, and a plain JS call in there crashes on device while looking
 *     perfect in the web preview, which runs worklets on the JS thread (see AGENTS.md's
 *     Reanimated note and `__tests__/workletSafety.test.ts`).
 *   - **A height change while OPEN is animated too.** `onLayout` assigned `measured` straight
 *     through, and with `progress` already at 1 that re-rendered the clip at the new height in
 *     one frame — adding or removing a row inside an open card jumped. Deliberately scoped to
 *     the already-open, already-measured, not-reduced-motion case: the FIRST measurement must
 *     land instantly (the deferred reveal above is waiting on it), and a body resizing while it
 *     is still opening should ride its existing curve rather than start a competing one.
 *   - **Lazy mount preserved:** children render only while `open` OR while a close animation is
 *     still playing; the close `withTiming` completion callback unmounts them (`runOnJS`). A
 *     fully-collapsed instance renders no children (matters for long lists like WeekListCard
 *     history via DisclosureRow). `measured` persists across mounts, so a re-open animates
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
  useAnimatedReaction,
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
  /**
   * Set when an open was asked for but the body had no height yet, so the reveal has to WAIT
   * for the first measurement (see the "deferred open" edit note). Cleared the moment the
   * curve is actually started, by whichever of the two paths gets there first.
   */
  const pendingOpen = useSharedValue(false);

  /** The open curve. Shared by the effect and the deferred path so they cannot disagree. */
  function runOpen() {
    'worklet';
    pendingOpen.value = false;
    progress.value = withTiming(1, { duration: Duration.card, easing: Ease.enter });
  }

  useEffect(() => {
    // Skip animating on the very first render: a mount-already-open instance shows its content
    // immediately (no entrance), and a mount-closed one is simply absent.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (open) setMounted(true);

    if (reducedMotion) {
      pendingOpen.value = false;
      progress.value = open ? 1 : 0;
      if (!open) setMounted(false);
      return;
    }

    if (open) {
      // **Nothing starts until there is a height to grow to.** `setMounted(true)` above and this
      // curve used to fire on the SAME tick, so for a body that had never been opened `measured`
      // was still 0 when the timing began: the clip sat at `progress * 0` for the first frames,
      // and when React committed the child and `onLayout` landed, the height snapped straight to
      // wherever the curve had already got to. That hitch-then-catch-up is what a device read as
      // "expanding and collapsing animation does not look smooth", and it was worst on the heavy
      // bodies — Shopping's drawers mount the whole of FoodTab/CatalogueTab.
      if (measured.value > 0) runOpen();
      else pendingOpen.value = true;
      return;
    }

    pendingOpen.value = false;
    progress.value = withTiming(
      0,
      { duration: Duration.cardOut, easing: Ease.exit },
      (finished) => {
        // Unmount the (now-hidden) children once the close animation lands.
        if (finished) runOnJS(setMounted)(false);
      }
    );
  }, [open, reducedMotion, progress, measured, pendingOpen]);

  /**
   * The deferred half of the rule above: start the waiting reveal as soon as a real height
   * arrives. A reaction rather than a branch inside `onLayout` because `measured` is a shared
   * value — the UI thread owns it, and this keeps the decision on the same thread as the write,
   * so the curve begins on the very frame the height lands rather than a JS round-trip later.
   *
   * `runOpen` is marked `'worklet'` and touches only shared values. Nothing here may call a
   * plain JS function: an auto-workletized body that does takes the app down on device while
   * looking perfect on web (AGENTS.md's Reanimated note; `__tests__/workletSafety.test.ts`).
   */
  useAnimatedReaction(
    () => measured.value > 0 && pendingOpen.value,
    (ready) => {
      if (ready) runOpen();
    },
  );

  const onLayout = (e: LayoutChangeEvent) => {
    // The measuring child is absolutely positioned (styles.measure), so it lays out at its
    // natural height regardless of the clip's current (possibly 0) height — this always reports
    // the real content height, even while collapsed.
    const h = e.nativeEvent.layout.height;
    if (h <= 0 || h === measured.value) return;
    // **A height that changes while the card is OPEN is animated, not assigned.** `progress` is
    // already 1, so writing `measured` straight through re-renders the animated style at the new
    // numeric height in one frame — a row added to or removed from an open card jumped. Scoped
    // hard to the already-open, already-measured case: the first measurement of a reveal has to
    // land instantly (the curve is waiting on it), and a body that resizes while it is still
    // opening should follow its own curve rather than start a second one.
    if (progress.value === 1 && measured.value > 0 && !reducedMotion) {
      measured.value = withTiming(h, { duration: Duration.card, easing: Ease.enter });
      return;
    }
    measured.value = h;
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

  // Fully closed (not open, and the close animation has finished unmounting the children):
  // render NOTHING, not a zero-height clip. An empty `Animated.View` is still a flex child, so
  // in a `gap`-ed container — which since the 2026-08-08 spacing pass is every screen and most
  // cards — it books a full gap slot for content that isn't there. That is what put 8px of dead
  // space under a collapsed Food meal section's header, leaving its title visibly above the
  // card's centre (2026-08-13, user report: "Food containers text should be vertically
  // centered"). It also made the two motion settings disagree: the reducedMotion branch above
  // has always returned null here.
  //
  // Safe because it changes nothing about the measure/animate cycle: `mounted` is already false
  // in exactly this state, so the measuring child was not being rendered either and `measured`
  // was already 0 for a never-opened instance. The hooks above still run (this is a render-time
  // early return, not a conditional hook), so `progress`/`measured` survive across the gap and a
  // re-open animates from the cached height exactly as before.
  if (!open && !mounted) return null;

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
