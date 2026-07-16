/**
 * PressableScale.tsx — Pressable with a tactile spring scale-bounce on press.
 *
 * Drop-in replacement for Pressable that dips to ~0.94 scale on press-in and
 * springs back on release (~150ms), giving every button tactile feedback. Also
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
import { Spring } from '@/constants/motion';

type Props = PressableProps & {
  /** Container style (animated). */
  style?: StyleProp<ViewStyle>;
  /** Fire a light haptic on press-in. Default true. */
  haptic?: boolean;
  /** Target scale at full press. Default 0.94. */
  scaleTo?: number;
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
  const rest_ = depth ? getElevation(depth, theme.shadow) : undefined;

  const animStyle = useAnimatedStyle(() => {
    const base = {
      transform: [{ scale: scale.value }],
      opacity: disabled
        ? undefined
        : interpolate(scale.value, [scaleTo, 1], [0.85, 1], Extrapolation.CLAMP),
    };
    if (!rest_) return base;
    const compress = (from: number) => interpolate(scale.value, [scaleTo, 1], [from * 0.35, from], Extrapolation.CLAMP);
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
        if (!reducedMotion) scale.value = withTiming(scaleTo, { duration: 60 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) scale.value = withSpring(1, releaseSpring);
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
