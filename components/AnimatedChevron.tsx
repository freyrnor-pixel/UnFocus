/**
 * AnimatedChevron.tsx — a chevron-down icon that rotates 0↔180° on an `open` prop.
 *
 * Drop-in replacement for the common `<Ionicons name={open ? 'chevron-up' : 'chevron-down'} />`
 * icon-swap so an expand/collapse affordance rotates smoothly instead of hard-swapping glyphs.
 *
 * Connections:
 *   Imports → react-native-reanimated, @expo/vector-icons, constants/motion (Duration, Ease),
 *             lib/useAppTheme (useAccessibility)
 *   Used by → components/TaskCard.tsx, components/PlanTaskCard.tsx (and any expand affordance)
 *   Data    → none (controlled via `open`)
 *
 * Edit notes:
 *   - reducedMotion snaps (duration 0). Rotation only — colour/size are static props.
 */
import React, { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  open: boolean;
  color: string;
  size?: number;
};

export default function AnimatedChevron({ open, color, size = 18 }: Props) {
  const { reducedMotion } = useAccessibility();
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: reducedMotion ? 0 : Duration.control,
      easing: Ease.enter,
    });
  }, [open, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}
