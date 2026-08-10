/**
 * PressableScale.tsx — Pressable with press feedback: a key-press sink by default, or the
 * historical spring scale-bounce when `press="scale"` is asked for explicitly.
 *
 * Drop-in replacement for Pressable. **Key mode is the default as of 2026-08-10** (maintainer:
 * *"Pressing a button/text still gives too much bob, like something floating instead of a
 * keyboard Key"* → *"Sinks in, pops out, no bob"*): the control TRANSLATES DOWN by `travel` px
 * over `PRESS_DURATION` on the `Ease.press` curve and comes straight back on release, with no
 * spring, no overshoot and no opacity dip. Before this the default was `scale` mode — a dip to
 * ~0.94 plus a dim to 0.85 opacity, released with a spring — which is what read as floating;
 * only Button, IconButton and a tappable Surface had opted into the key. Now everything is a
 * key unless it says otherwise, so the app has ONE press language. Fires a light haptic on a
 * completed press (onPress) by default — not on press-in/touch-down, so a touch that starts on
 * a button but turns into a scroll (e.g. inside a ScrollView/FlatList) doesn't vibrate; only an
 * actual selected tap does. Honours the user's reduce-motion setting: when set, the movement is
 * instant (haptics still fire unless disabled).
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
 *     `press` (default `'key'`), `travel` (default `Travel.sm`), `sunk`,
 *     `scaleTo` (default 0.94, scale mode only), `depth` (Purposeful Depth System,
 *     2026-07-14), `releaseSpring` (scale mode only; default `Spring.snappy`, pass
 *     `Spring.calm` for a less bouncy release on repeatedly-tapped toggles).
 *   - **Don't reach for `press="scale"` to make something feel softer.** Two callers use it
 *     and both have a structural reason: a `ghost` Button/IconButton has no cap and no base to
 *     sink into, and the design lab's `button` control knob can be set to a non-`key` shape,
 *     which must keep behaving like the shape it names. Anything else gets the key.
 *   - Animation must stay gated behind useAccessibility().reducedMotion.
 *   - `depth` (optional `ElevationLevel`): when set, PressableScale OWNS the resting
 *     shadow for that tier (via `getElevation(depth, theme.shadow)`) and compresses it
 *     toward flat on press, driven off the same `scale` shared value the bounce already
 *     uses — mirrors DraggableTaskRow.tsx's animated-lift-shadow pattern in reverse.
 *     Callers passing `depth` must NOT also put shadow/elevation keys in `style` (same
 *     "owned" contract Surface.tsx uses for its material shadow) — they'd be fighting
 *     the animated style. Reduce-motion: shadow snaps to the resting tier, no compress
 *     animation (haptic still fires) — same contract the scale bounce already honors.
 *   - **`travel` + `sunk` — key-press mode (2026-07-28; made the default 2026-08-10)**: the
 *     control SINKS (translateY) by `travel` px instead of scaling, with its resting shadow
 *     collapsing to nothing at the bottom of the travel. This is design-system v6's
 *     `handoff/BUTTONS.md` contract — "a cap sitting on a solid base… pressing sinks the cap
 *     into the base" — and it deliberately drops the opacity dip, since a key that dims on
 *     press reads as disabled. `sunk` is the "on" state ("Pressed = on"): the active tab, a
 *     ticked check, an engaged toggle REST at the bottom of the travel, so "selected" is
 *     legible as depth and not only as colour. The shared value is seeded from `sunk`, so a
 *     control that mounts already on is drawn sunk on its first frame rather than animating
 *     down after paint. Both modes honour reduce-motion (the sink becomes instant, 1ms per v6).
 *     A caller with a real FILL should also draw a visible base — see components/Button.tsx's
 *     `keyBase` — so the cap has something to meet; a caller with no fill (a row, a chip, a
 *     text link) sinks against the surface behind it, which is the point of the default.
 *   - **`sunkRef` — why the release reads a ref and not the prop (2026-08-10)**. React Native
 *     only defers `onPressOut` past `onPress` for taps SHORTER than Pressability's
 *     `DEFAULT_MIN_PRESS_DURATION` (130ms). On a slower tap `onPressOut` fires FIRST, so the
 *     handler's closure still sees the pre-tap `sunk` — it animated the cap up over 90ms, and
 *     the effect below then animated it back down: a literal up-down bob on every unhurried
 *     tap of a nav tab, an active IconButton or a key Surface. This was the "goes down, but
 *     then up again instead of staying down" report. The release now reads `sunkRef` on the
 *     next tick, after React has flushed whatever `onPress` did, so a control that just turned
 *     ON never rises. Don't "simplify" this back to reading the prop directly — the old
 *     comment claiming the prop was enough was true only for fast taps.
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
import { Ease, PRESS_DURATION, Spring, Duration, Travel } from '@/constants/motion';

type Props = PressableProps & {
  /** Container style (animated). */
  style?: StyleProp<ViewStyle>;
  /** Fire a light haptic on press-in. Default true. */
  haptic?: boolean;
  /**
   * Which press language this control speaks. Default `'key'` — it sinks by `travel` px and
   * comes straight back, no spring and no dim. `'scale'` is the historical shrink-and-dim
   * bounce, kept for the two structural cases named in the Edit notes (a fill-less `ghost`
   * button, and the design lab's non-`key` button shapes). Prefer the default.
   */
  press?: 'key' | 'scale';
  /** Target scale at full press. Default 0.94. Scale mode only. */
  scaleTo?: number;
  /**
   * How far, in px, the cap sinks on press. Defaults to `Travel.sm` (3px) — the chip/row
   * distance, which is the right weight for the many small controls that inherit the default.
   * Pass a bigger `Travel.*` token for a bigger control; `Button`/`IconButton` already do.
   * Ignored in scale mode.
   */
  travel?: number;
  /**
   * Stays-sunk "on" state — the active tab, a ticked check, an engaged toggle
   * (design-system v6: "Pressed = on"). Key mode only. Rests at the bottom
   * of the travel so "selected" is legible as depth, not only as colour — which is the whole
   * point: it survives colour-blindness, glare, and a screenshot in greyscale.
   */
  sunk?: boolean;
  /** Press-out spring, scale mode only. Default `Spring.snappy`; pass `Spring.calm` for
   *  section/accordion toggle headers where the default bounce reads as too energetic. */
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
  press: pressMode = 'key',
  scaleTo = 0.94,
  travel = Travel.sm,
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
  const isKey = pressMode === 'key' && travel > 0;
  // 0 = fully raised, 1 = fully sunk. Seeded from `sunk` so a control that mounts already
  // "on" (a restored active tab, an already-ticked check) is drawn sunk on its first frame
  // rather than animating down after paint.
  const press = useSharedValue(sunk ? 1 : 0);
  // The release handler reads this rather than the `sunk` prop — see the sunkRef edit note.
  const sunkRef = React.useRef(sunk);
  const rest_ = depth ? getElevation(depth, theme.shadow) : undefined;

  // Follow the `sunk` prop whenever the caller flips it (tab changed, check toggled). Uses
  // the same press curve, so switching tabs looks like the new tab being pressed in.
  React.useEffect(() => {
    sunkRef.current = sunk;
    if (!isKey) return;
    press.value = reducedMotion
      ? (sunk ? 1 : 0)
      : withTiming(sunk ? 1 : 0, { duration: PRESS_DURATION, easing: Ease.press });
  }, [sunk, isKey, reducedMotion, press]);

  // Settle the cap to whatever "on" state the tap produced. Deferred a tick so React has
  // flushed `onPress`'s state update first: on a tap longer than RN's 130ms
  // DEFAULT_MIN_PRESS_DURATION, onPressOut runs BEFORE onPress, and reading `sunk` there
  // would raise a control that is about to be on — the bob this exists to remove.
  const settle = React.useCallback(() => {
    const to = sunkRef.current ? 1 : 0;
    press.value = reducedMotion
      ? to
      : withTiming(to, { duration: PRESS_DURATION, easing: Ease.press });
  }, [press, reducedMotion]);

  // Clear a pending settle on unmount so a row that is removed by its own tap (a completed
  // task leaving the list) can't write to a freed shared value.
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );

  const animStyle = useAnimatedStyle(() => {
    // Key-press mode: sink, don't shrink. No opacity dip either — a key that dims on press
    // reads as a disabled state, and the travel already carries the feedback.
    const base = isKey
      ? { transform: [{ translateY: press.value * travel }] }
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
          // Drop any settle still queued from the previous tap, or it would raise the cap
          // mid-way through this one.
          if (settleTimer.current) clearTimeout(settleTimer.current);
          press.value = reducedMotion ? 1 : withTiming(1, { duration: PRESS_DURATION, easing: Ease.press });
        } else if (!reducedMotion) {
          scale.value = withTiming(scaleTo, { duration: Duration.pressIn });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (isKey) {
          // Release returns to whatever the "on" state says — a toggle that just turned ON
          // stays down instead of popping back up. Deferred, because on a slow tap this
          // handler runs before onPress has told us what the new "on" state is.
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(settle, 0);
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
