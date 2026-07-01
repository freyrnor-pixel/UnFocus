/**
 * CompletionGlow.tsx — one-shot colour bloom overlay for task/habit completion.
 *
 * Absolutely-fills its (relatively-positioned) parent card and, whenever `trigger`
 * flips to a new truthy value, blooms a soft colour glow that fades out within ~1s.
 * Purely decorative and pointer-transparent. Respects reduce-motion: when set, it
 * renders nothing (no flash). Pure View/opacity/scale animation — no native SVG or
 * gradient dependency needed (Decision 007's install-only-when-needed rule doesn't
 * apply here).
 *
 * Usage:
 *   <View style={{ position: 'relative' }}>
 *     ...card content...
 *     <CompletionGlow trigger={done} />
 *   </View>
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/theme, lib/useAppTheme
 *   Used by → (not yet mounted — Phase 3a foundational port; TaskItem/habit completion flows wire this in later)
 *   Data    → reads reducedMotion via useAccessibility(); colour from useAppTheme().good
 *
 * Edit notes:
 *   - Parent must be position:relative (or have a defined box) for the absolute fill.
 *   - `trigger` should be a value that CHANGES on completion (e.g. a boolean or a
 *     counter). The glow runs on rising edges only, never on mount.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Radius } from '@/constants/theme';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';

type Props = {
  /** Changes value on completion; the glow runs on each rising edge. */
  trigger: boolean | number;
  /** Override the glow colour (defaults to the theme's `good` token). */
  color?: string;
  /** Corner radius to match the parent card. */
  radius?: number;
};

export default function CompletionGlow({ trigger, color, radius = Radius.md }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);
  const mounted = useSharedValue(false);

  useEffect(() => {
    // Skip the very first run (mount) and honour reduce-motion.
    if (!mounted.value) {
      mounted.value = true;
      return;
    }
    if (reducedMotion) return;
    if (!trigger) return;

    // Per design spec: bloom grows from 1→1.05 over 300ms ease-out,
    // opacity fades 1→0.7→0 over 400ms ease-out.
    opacity.value = withSequence(
      withTiming(0.7, { duration: 300, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
    );
    scale.value = withTiming(1.05, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [trigger, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (reducedMotion) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color ?? theme.good, borderRadius: radius },
        animStyle,
      ]}
    />
  );
}
