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
 *   Imports → react-native-reanimated (FadeInDown/FadeOutDown/LinearTransition), constants/motion,
 *             lib/useAppTheme (useAccessibility)
 *   Used by → app/notes.tsx, app/(tabs)/health.tsx, app/health-log.tsx
 *   Data    → none (driven by props)
 *
 * Edit notes:
 *   - reducedMotion drops entering/exiting/layout entirely (instant).
 *   - layout stays on whenever motion is allowed (even when `enabled` is false) so reflow on
 *     reorder/removal is smooth from the first frame; only the entrance is gated by `enabled`.
 *   - **Easing (2026-07-15)**: entering/exiting/layout now call `.easing(Ease.enter/exit/move)`
 *     explicitly, matching Collapsible.tsx's house pattern — previously these fell back to
 *     Reanimated's default curve, which read as visually disconnected from the rest of the
 *     app's `Ease.move`-timed reflows (surfaced via PlanTaskCard's expand/collapse feeling
 *     "fragmented"; fixed there and here + ShoppingRow.tsx for consistency).
 *   - **Exit direction (2026-07-15)**: `FadeOutDown` (not a static in-place `FadeOut`) so a
 *     removed row reads as sliding away, not blinking out of existence — this app's motion
 *     goal for a neurodivergent audience is that things retreat somewhere, they don't just
 *     vanish (see PlanTaskCard.tsx's "Collapse feel" note for the fuller rationale).
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
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
      entering={entrance ? FadeInDown.duration(Duration.listIn).easing(Ease.enter) : undefined}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(Duration.cardOut).easing(Ease.exit)}
      layout={reducedMotion ? undefined : LinearTransition.duration(Duration.listMove).easing(Ease.move)}
    >
      {children}
    </Animated.View>
  );
}
