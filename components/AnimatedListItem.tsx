/**
 * AnimatedListItem.tsx — wraps a list row so it fades/slides in when added and fades out
 * when removed, and siblings reflow smoothly (the ShoppingRow house pattern, generalised).
 *
 * Wrap each mapped row: `<AnimatedListItem key={id} enabled={hasMounted}>…</AnimatedListItem>`.
 * `enabled` should be false on the list's very first mount and true afterwards, so the initial
 * set doesn't all fade in on every navigation — only rows added later animate in. Keep a
 * `useRef(false)` in the screen, flip it true in a mount `useEffect`, and pass `.current`.
 *
 * Connections:
 *   Imports → react-native-reanimated (FadeInDown/FadeOut/LinearTransition), constants/motion,
 *             lib/useAppTheme (useAccessibility)
 *   Used by → app/notes.tsx, app/(tabs)/health.tsx, app/inventory-edit.tsx, app/health-log.tsx
 *   Data    → none (driven by props)
 *
 * Edit notes:
 *   - reducedMotion drops entering/exiting/layout entirely (instant).
 *   - layout stays on whenever motion is allowed (even when `enabled` is false) so reflow on
 *     reorder/removal is smooth from the first frame; only the entrance is gated by `enabled`.
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Duration } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  children: React.ReactNode;
  /** true once the list has mounted — gates the entrance so the initial set doesn't fade in. */
  enabled: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AnimatedListItem({ children, enabled, style }: Props) {
  const { reducedMotion } = useAccessibility();
  const entrance = enabled && !reducedMotion;
  return (
    <Animated.View
      style={style}
      entering={entrance ? FadeInDown.duration(Duration.listIn) : undefined}
      exiting={reducedMotion ? undefined : FadeOut.duration(Duration.cardOut)}
      layout={reducedMotion ? undefined : LinearTransition.duration(Duration.listMove)}
    >
      {children}
    </Animated.View>
  );
}
