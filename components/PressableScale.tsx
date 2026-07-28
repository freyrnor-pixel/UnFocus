/**
 * PressableScale.tsx — Pressable with press feedback: a spring scale-bounce by default, or a
 * key-press sink into a base when `travel` is set.
 *
 * Drop-in replacement for Pressable that dips to ~0.94 scale over 80ms on press-in (bumped
 * from 60ms, 2026-07-21, so the press-down itself reads as a deliberate compression rather
 * than a snap — see ANIMATION_GUIDELINES.md §1) and springs back on release (~150ms,
 * near-critically-damped, no bounce — see constants/motion.ts's Spring.snappy comment for why),
 * giving every button tactile feedback. Also
 * dips opacity to 0.85 in sync with the scale (derived from the same shared value,
 * no extra tuning). Fires a light haptic on a completed press (onPress) by
 * default — not on press-in/touch-down, so a touch that starts on a button but
 * turns into a scroll (e.g. inside a ScrollView/FlatList) doesn't vibrate; only
 * an actual selected tap does. Honours the user's reduce-motion setting: when
 * set, the scale/opacity animation is skipped (haptics still fire unless
 * disabled).
 *
 * Connections:
 *   Imports → react-native-reanimated, lib/haptics, lib/useAppTheme, constants/theme,
 *             constants/motion (Spring)
 *   Used by → any screen button wanting press feedback
 *   Data    → reads reducedMotion via useAccessibility()
 *
 * Edit notes:
 *   - This is a shared primitive — keep its API a strict superset of Pressable so
 *     it can replace one without churn. Extra props: `haptic` (default true),
 *     `scaleTo` (default 0.94), `depth` (Purposeful Depth System, 2026-07-14),
 *     `releaseSpring` (default `Spring.snappy`; pass `Spring.calm` for a less bouncy
 *     release on repeatedly-tapped toggles like section/accordion headers).
 *   - Animation must stay gated behind useAccessibility().reducedMotion.
 *   - `depth` (optional `ElevationLevel`): when set, PressableScale OWNS the resting
 *     shadow for that tier (via `getElevation(depth, theme.shadow)`) and compresses it
 *     toward flat on press, driven off the same `scale` shared value the bounce already
 *     uses — mirrors DraggableTaskRow.tsx's animated-lift-shadow pattern in reverse.
 *     Callers passing `depth` must NOT also put shadow/elevation keys in `style` (same
 *     "owned" contract Surface.tsx uses for its material shadow) — they'd be fighting
 *     the animated style. Reduce-motion: shadow snaps to the resting tier, no compress
 *     animation (haptic still fires) — same contract the scale bounce already honors.
 *   - **`travel` + `sunk` — key-press mode (2026-07-28)**: pass a `Travel.*` px token and the
 *     control SINKS (translateY) into its base instead of scaling, with its resting shadow
 *     collapsing to nothing at the bottom of the travel. This is design-system v6's
 *     `handoff/BUTTONS.md` contract — "a cap sitting on a solid base… pressing sinks the cap
 *     into the base" — and it deliberately drops the opacity dip, since a key that dims on
 *     press reads as disabled. `sunk` is the "on" state ("Pressed = on"): the active tab, a
 *     ticked check, an engaged toggle REST at the bottom of the travel, so "selected" is
 *     legible as depth and not only as colour. `press` is seeded from `sunk`, so a control
 *     that mounts already on is drawn sunk on its first frame rather than animating down
 *     after paint. Both modes honour reduce-motion (the sink becomes instant, 1ms per v6).
 *     Callers that pass `travel` should ALSO give the element a visible base — see
 *     components/Button.tsx — or the cap sinks into nothing and the travel reads as a glitch.
 *   - `layout` (optional): passed straight through to the underlying AnimatedPressable
 *     so a PressableScale can join a sibling `LinearTransition` group (e.g.
 *     PlanTaskCard's footer button reflowing in sync with its rail/done-zone).
 */
import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { tap as hapticTap } from '@/lib/haptics';
import { ElevationLevel, getElevation } from '@/constants/theme';
import { Ease, PRESS_DURATION, Spring } from '@/constants/motion';

type Props = PressableProps & {
  /** Container style (animated). */
  style?: StyleProp<ViewStyle>;
  /** Fire a light haptic on press-in. Default true. */
  haptic?: boolean;
  /** Target scale at full press. Default 0.94. Ignored when `travel` is set. */
  scaleTo?: number;
  /**
   * Key-press mode (2026-07-28): how far, in px, the cap sinks into its base on press.
   * Pass a `Travel.*` token from constants/motion. When set, the control TRANSLATES DOWN
   * instead of scaling — a physical key sinks into its housing, it doesn't shrink — and its
   * resting shadow collapses to nothing at the bottom of the travel, so the cap reads as
   * having met the base. Omit for the historical scale-bounce; every existing caller keeps
   * exactly what it had.
   */
  travel?: number;
  /**
   * Stays-sunk "on" state — the active tab, a ticked check, an engaged toggle
   * (design-system v6: "Pressed = on"). Only meaningful with `travel`. Rests at the bottom
   * of the travel so "selected" is legible as depth, not only as colour — which is the whole
   * point: it survives colour-blindness, glare, and a screenshot in greyscale.
   */
  sunk?: boolean;
  /** Press-out spring. Default `Spring.snappy`; pass `Spring.calm` for section/accordion
   *  toggle headers where the default bounce reads as too energetic. */
  releaseSpring?: { damping: number; stiffness: number };
  /** Resting elevation tier; PressableScale owns the shadow and compresses it toward
   *  flat on press. Omit for current no-shadow behavior. See Edit notes. */
  depth?: ElevationLevel;
  /** Reanimated layout-transition passthrough (e.g. `LinearTransition`) — forwarded
   *  as-is to the underlying AnimatedPressable so callers can keep this element in
   *  sync with sibling layout animations. */
  layout?: React.ComponentProps<typeof AnimatedPressable>['layout'];
  children?: React.ReactNode;
};

export default function PressableScale({
  style,
  haptic = true,
  scaleTo = 0.94,
  travel,
  sunk = false,
  releaseSpring = Spring.snappy,
  depth,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...rest
}: Props) {
  const { reducedMotion } = useAccessibility();
  const theme = useAppTheme();
  const scale = useSharedValue(1);
  const isKey = travel != null && travel > 0;
  // 0 = fully raised, 1 = fully sunk. Seeded from `sunk` so a control that mounts already
  // "on" (a restored active tab, an already-ticked check) is drawn sunk on its first frame
  // rather than animating down after paint.
  const press = useSharedValue(sunk ? 1 : 0);
  const rest_ = depth ? getElevation(depth, theme.shadow) : undefined;

  // Follow the `sunk` prop whenever the caller flips it (tab changed, check toggled). Uses
  // the same press curve, so switching tabs looks like the new tab being pressed in.
  React.useEffect(() => {
    if (!isKey) return;
    press.value = reducedMotion
      ? (sunk ? 1 : 0)
      : withTiming(sunk ? 1 : 0, { duration: PRESS_DURATION, easing: Ease.press });
  }, [sunk, isKey, reducedMotion, press]);

  const animStyle = useAnimatedStyle(() => {
    // Key-press mode: sink, don't shrink. No opacity dip either — a key that dims on press
    // reads as a disabled state, and the travel already carries the feedback.
    const base = isKey
      ? { transform: [{ translateY: press.value * travel! }] }
      : {
          transform: [{ scale: scale.value }],
          opacity: disabled
            ? undefined
            : interpolate(scale.value, [scaleTo, 1], [0.85, 1], Extrapolation.CLAMP),
        };
    if (!rest_) return base;
    // The cap's shadow goes to nothing at the bottom of the travel — that's what says it has
    // met the base, rather than floating lower.
    const compress = isKey
      ? (from: number) => interpolate(press.value, [0, 1], [from, 0], Extrapolation.CLAMP)
      : (from: number) => interpolate(scale.value, [scaleTo, 1], [from * 0.35, from], Extrapolation.CLAMP);
    return {
      ...base,
      shadowColor: rest_.shadowColor,
      shadowOpacity: compress(rest_.shadowOpacity),
      shadowRadius: compress(rest_.shadowRadius),
      shadowOffset: { width: 0, height: compress(rest_.shadowOffset.height) },
      elevation: compress(rest_.elevation),
    };
  });

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animStyle]}
      onPressIn={(e) => {
        if (isKey) {
          press.value = reducedMotion ? 1 : withTiming(1, { duration: PRESS_DURATION, easing: Ease.press });
        } else if (!reducedMotion) {
          scale.value = withTiming(scaleTo, { duration: 80 });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (isKey) {
          // Release returns to whatever the "on" state says — a toggle that just turned ON
          // stays down instead of popping back up and then being re-sunk by the effect above.
          press.value = reducedMotion
            ? (sunk ? 1 : 0)
            : withTiming(sunk ? 1 : 0, { duration: PRESS_DURATION, easing: Ease.press });
        } else if (!reducedMotion) {
          scale.value = withSpring(1, releaseSpring);
        }
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) hapticTap();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
