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
 *     `pressFill` (the cap's rest → pressed fill), `scaleTo` (default 0.94, scale mode only),
 *     `depth` (Purposeful Depth System,
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
 *   - **`pressFill` — the cap darkens as it lands (2026-08-12)**: an optional
 *     `{ rest, pressed }` pair interpolated off the SAME `press` shared value as the sink, so
 *     the colour change and the travel are one gesture on one curve rather than two effects
 *     that can disagree. It exists because travel alone reads weakly on a wide button — the
 *     3–5px is easy to miss — while a fill moving toward its own base's shade says "this has
 *     moved away from the light". Key mode only (`press.value` never moves in scale mode).
 *     **A caller passing `pressFill` must NOT also put `backgroundColor` in `style`** — same
 *     "owned property" contract as `depth` and the shadow keys. Reduce-motion needs no branch:
 *     `press.value` is assigned instantly there, so the fill snaps with the sink.
 *     Note the free consequence, in case you want it: a caller that ALSO passes `sunk` rests
 *     at the pressed fill while it is "on", which is consistent with "Pressed = on". No
 *     current caller does both — components/Button.tsx passes `pressFill` and never `sunk`.
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
import { Pressable, PressableProps, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { tap as hapticTap } from '@/lib/haptics';
import {
  ElevationLevel,
  getElevation,
  getGlow,
  getInnerShade,
  getTopHighlight,
  KEY_FACE_STOPS,
} from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
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
  /**
   * Rest → pressed fill, interpolated off the same `press` value as the sink so the darken
   * lands exactly as the cap meets its base. Key mode only. A caller passing this must NOT
   * also set `backgroundColor` in `style` — PressableScale owns that property here, the same
   * way it owns the shadow keys when `depth` is set. See the Edit notes.
   */
  pressFill?: { rest: string; pressed: string };
  /**
   * Tactile Glass (2026-08-15): draw the cap's FACE — a white highlight along its top edge at
   * rest, cross-fading to a dark inner shade as it sinks into its housing. The brief's
   * "subtle top-edge highlight (inner shadow)" and "a dark inner shadow must be applied to
   * simulate the button being depressed into the hardware casing".
   *
   * **Opt-in, and it should stay that way.** Only a control with a real FILL and a real base
   * is a hardware key — Button, IconButton and AddFAB pass this. The other ~320 PressableScale
   * call sites are rows, chips and text links that sink against the surface behind them; a lit
   * face on those would be the "everything is emphasized" failure DESIGN_RULES.md rule 15
   * names. Needs the caller's `radius` because the gradients are clipped to the cap's shape
   * and PressableScale has no other way to know it.
   */
  face?: { radius: number };
  /**
   * Tactile Glass (2026-08-15): a resting coloured halo that goes out as the key is pressed —
   * the brief's "colored drop shadow (a 'glow') to make them look illuminated and raised",
   * and "the outer glow must disappear" on press.
   *
   * **Scope this narrowly.** DESIGN_RULES.md rule 15 governs `getGlow`: "the purposeful halo
   * is for the one active/focused surface, never decoration", and rule 6 allows exactly one
   * primary action per screen. Today: `primary`/`danger` Button, AddFAB, and a HardwareToggle
   * that is ON. Never a card, never a `ghost`/`secondary` button, and never breathing —
   * `components/GlowPulse.tsx` still owns the one-at-a-time animated halo and is untouched.
   *
   * `level` is `getGlow`'s own, defaulting to `'soft'`; AddFAB passes `'strong'` because it is
   * the one control that floats free over scrolling content.
   */
  glow?: { color: string; level?: 'soft' | 'strong' };
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
  pressFill,
  face,
  glow,
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

  // Captured as two primitives rather than the object, so the worklet closes over strings
  // (AGENTS.md's worklet rule: prefer capturing primitives) and a caller re-rendering with a
  // fresh `{ rest, pressed }` literal doesn't invalidate the style every frame.
  const fillRest = pressFill?.rest;
  const fillPressed = pressFill?.pressed;

  // ── The cap's face and its halo (Tactile Glass, 2026-08-15) ──────────────────────────────
  // Both colour tuples are built HERE, on the JS thread, and only their opacity is animated.
  // That is deliberate and not just tidiness: `getTopHighlight`/`getInnerShade`/`getGlow` are
  // ordinary JS functions, and calling one from inside a worklet throws "tried to synchronously
  // call a non-worklet function on the UI thread" and takes the app down on device while
  // looking perfect in the web preview (AGENTS.md's Reanimated gotcha;
  // __tests__/workletSafety.test.ts is the guard). Cross-fading two STATIC gradients also
  // avoids interpolating colour inside a gradient, which Reanimated cannot do at all.
  const highlightColors = React.useMemo(() => getTopHighlight(), []);
  const shadeColors = React.useMemo(() => getInnerShade(), []);
  const glowColor = glow?.color;
  const glowLevel = glow?.level ?? 'soft';
  const glowShadow = React.useMemo(
    () => (glowColor ? getGlow(glowColor, glowLevel) : null),
    [glowColor, glowLevel]
  );

  // Rest → pressed: the highlight goes out as the shade comes in, both off the same `press`
  // value as the sink and the fill darken. Four cues, one curve, and reduced motion needs no
  // branch because `press` is assigned instantly there.
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  // "The outer glow must disappear" — and it is gone well before the cap lands, so the key
  // reads as having been switched off by the press rather than dimming with it.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
  }));

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
    // The face darkens as the cap goes down. This is NOT the opacity dip the note above
    // rejects — a dim reads as disabled, whereas a fill moving toward its own base's shade
    // reads as a surface that has moved away from the light. It exists because 3–5px of
    // travel is easy to miss on a wide button, and it rides the same `press` value as the
    // sink so the two can never disagree.
    const fill =
      isKey && fillRest && fillPressed
        ? { backgroundColor: interpolateColor(press.value, [0, 1], [fillRest, fillPressed]) }
        : null;
    if (!rest_) return { ...base, ...fill };
    // The cap's shadow goes to nothing at the bottom of the travel — that's what says it has
    // met the base, rather than floating lower.
    const compress = isKey
      ? (from: number) => interpolate(press.value, [0, 1], [from, 0], Extrapolation.CLAMP)
      : (from: number) => interpolate(scale.value, [scaleTo, 1], [from * 0.35, from], Extrapolation.CLAMP);
    return {
      ...base,
      ...fill,
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
      {/* The halo sits at absoluteFill INSIDE the cap, so it travels with it, but its
          `boxShadow` renders outside those bounds (nothing here sets overflow:'hidden' on the
          pressable itself) — which is what makes it a halo around the key rather than a fill
          behind it. Drawn first so it is under the face and the children. */}
      {glowShadow ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            glowShadow,
            face ? { borderRadius: face.radius } : null,
            glowStyle,
          ]}
        />
      ) : null}
      {/* The face. Clipped to the cap's own radius — this is the ONE place overflow:'hidden'
          appears, and it must stay on this wrapper rather than on the pressable, or it would
          clip the halo above and every caller's shadow with it. */}
      {face ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: face.radius, overflow: 'hidden' }]}
        >
          <AnimatedLinearGradient
            colors={highlightColors}
            locations={KEY_FACE_STOPS}
            style={[StyleSheet.absoluteFill, highlightStyle]}
          />
          <AnimatedLinearGradient
            colors={shadeColors}
            locations={KEY_FACE_STOPS}
            style={[StyleSheet.absoluteFill, shadeStyle]}
          />
        </View>
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
