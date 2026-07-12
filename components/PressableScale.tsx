/**
 * PressableScale.tsx — Pressable with a tactile spring scale-bounce on press.
 *
 * Drop-in replacement for Pressable that dips to ~0.94 scale on press-in and
 * springs back on release (~150ms), giving every button tactile feedback. Also
 * dips opacity to 0.85 in sync with the scale (derived from the same shared value,
 * no extra tuning). Fires a light haptic on press by default. Honours the user's
 * reduce-motion setting: when set, the scale/opacity animation is skipped (haptics
 * still fire unless disabled).
 *
 * Connections:
 *   Imports → react-native-reanimated, lib/haptics, lib/useAppTheme
 *   Used by → any screen button wanting press feedback
 *   Data    → reads reducedMotion via useAccessibility()
 *
 * Edit notes:
 *   - This is a shared primitive — keep its API a strict superset of Pressable so
 *     it can replace one without churn. Extra props: `haptic` (default true),
 *     `scaleTo` (default 0.94).
 *   - Animation must stay gated behind useAccessibility().reducedMotion.
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
import { useAccessibility } from '@/lib/useAppTheme';
import { tap as hapticTap } from '@/lib/haptics';

type Props = PressableProps & {
  /** Container style (animated). */
  style?: StyleProp<ViewStyle>;
  /** Fire a light haptic on press-in. Default true. */
  haptic?: boolean;
  /** Target scale at full press. Default 0.94. */
  scaleTo?: number;
  children?: React.ReactNode;
};

export default function PressableScale({
  style,
  haptic = true,
  scaleTo = 0.94,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const { reducedMotion } = useAccessibility();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled
      ? undefined
      : interpolate(scale.value, [scaleTo, 1], [0.85, 1], Extrapolation.CLAMP),
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animStyle]}
      onPressIn={(e) => {
        if (haptic) hapticTap();
        if (!reducedMotion) scale.value = withTiming(scaleTo, { duration: 60 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) scale.value = withSpring(1, { damping: 18, stiffness: 320 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
