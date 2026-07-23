/**
 * GlowPulse.tsx — breathing / static coloured halo for state & action indication.
 *
 * A pointer-transparent, absolute-fill sibling (place inside a position:relative parent, same
 * pattern as CompletionGlow) that draws a soft coloured halo via getGlow's boxShadow.
 * mode="breathe" gently loops opacity (~2.4s cycle) to mark the SINGLE active/focal element on
 * a screen; mode="static" is a steady halo for persistent or repeated states. Under
 * reduce-motion, breathe falls back to static (keeps the cue, drops the motion).
 *
 * Usage:
 *   <View style={{ position: 'relative' }}>
 *     ...content...
 *     <GlowPulse active={isNow} color={accent} mode="breathe" radius={Radius.md} />
 *   </View>
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/theme (getGlow, Radius), lib/useAppTheme
 *   Used by → components/PlanTaskCard.tsx, components/TaskCard.tsx, components/Button.tsx,
 *             app/(tabs)/habits.tsx
 *   Data    → reads reducedMotion via useAccessibility()
 *
 * Edit notes:
 *   - Parent must be position:relative and MUST NOT clip (no overflow:'hidden'), or the halo
 *     boxShadow is cut off. For habitCard / glass Button, wrap OUTSIDE the clipped element.
 *   - Only ONE mode="breathe" halo should be visible per screen (guidelines §6/§9). Use
 *     mode="static" for lists where several items share a state.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { getGlow, Radius } from '@/constants/theme';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  /** Whether the halo is shown at all. */
  active: boolean;
  /** Halo colour (hex). */
  color: string;
  /** breathe = single focal element (loops); static = persistent/repeated state. */
  mode?: 'breathe' | 'static';
  /** getGlow strength. */
  level?: 'soft' | 'strong';
  /** Corner radius to match the parent. */
  radius?: number;
};

const LOW = 0.45;    // dimmest point of the breath
const HIGH = 1;      // brightest point
const LEG_MS = 1200; // one direction of the breath (~2.4s full cycle) — a true slow breath

export default function GlowPulse({ active, color, mode = 'breathe', level = 'soft', radius = Radius.md }: Props) {
  const { reducedMotion } = useAccessibility();
  const breathe = mode === 'breathe' && !reducedMotion;
  const opacity = useSharedValue(breathe ? LOW : 1);

  useEffect(() => {
    cancelAnimation(opacity);
    if (!active) return;
    if (breathe) {
      opacity.value = LOW;
      opacity.value = withRepeat(
        withTiming(HIGH, { duration: LEG_MS, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(opacity);
  }, [active, breathe]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius }, getGlow(color, level), animStyle]}
    />
  );
}
