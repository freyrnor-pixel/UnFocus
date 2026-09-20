/**
 * BoughlightBackdrop.tsx — the "canopy × halo" scenery layer, from the `Backdrop_Handoff`
 * design brief (2026-09-19). A halo is the light source; a bough is what breaks it into motes.
 *
 * Two variants, both drawn in the handoff's own 390×844 viewBox and edge-anchored:
 *   - **`hero`** — the full-frame read: top glow → three light shafts → a halo ring at (195,118)
 *     → a long bough from the top-right with eight leaves → motes along the ring, the gutters
 *     and the floor. For a screen with no card stack over the middle (onboarding, a focus view).
 *   - **`crown`** — the same pairing folded ABOVE a card stack: the halo sits at (205,−58) so
 *     only its lower crest clears the top edge, the bough is short and stays above y 100, and
 *     two floor hazes give the screen a bottom. Nothing but haze between y 100 and y 716, which
 *     is the band a list occupies.
 *
 * ⚠️ **THIS IS LINE ART, AND LINE ART WAS DELETED FROM THIS APP ONCE BEFORE.** Read this before
 * extending it. `components/ScreenBackground.tsx`'s header carries the 2026-08-17 ruling —
 * *"Delete the sharp, chaotic vine/line art. It is too distracting"* — and
 * `lib/__tests__/chromeRhythm.test.ts` §6 still forbids a `<Path>` or a `stroke=` in that file,
 * permanently. That rule is not evaded here; it is a rule about ScreenBackground, and this is a
 * different layer answering a newer brief. What makes this one a different proposition, and what
 * must stay true of it:
 *   1. **The variant that sits under cards never enters the card column.** The deleted art put
 *      branches where cards are. `crown` keeps the handoff's clear zone (x 84–306, y 236–612)
 *      empty of geometry — `lib/boughlight.ts`'s `clearZoneOffenders` is the arithmetic and
 *      `lib/__tests__/boughlight.test.ts` runs it, rather than this sentence being trusted.
 *      `hero` deliberately is NOT held to that: its bough falls through the middle, which is the
 *      brief's intent for a screen with no card stack. Mounting `hero` under a list is the
 *      mistake the two variants exist to prevent.
 *   2. **It is a third to a half the old art's strength.** The deleted branch drew at
 *      `branchOpacity` 0.42 in a `#3f74ff` blue; the strongest stroke here is 0.34 and most are
 *      0.17–0.28, under a per-theme master (`FIELD_OPACITY`) that halves the whole layer again
 *      in light.
 *   3. **It is gated off entirely by `reduceEffects`**, and its motion by `reducedMotion` — and
 *      the handoff is explicit that *"the static layer alone is a complete, finished backdrop"*,
 *      so the still path is the designed artwork, not a degraded one.
 *
 * **No SVG filter, on purpose.** The handoff's soft halo is an `feGaussianBlur` over a 10px
 * stroke. react-native-svg's filter support is uneven on Android and would rasterise a
 * full-screen layer, so the ring is drawn as a single circle filled with a radial gradient whose
 * stops PEAK at the ring's radius (`HALO_PEAK`) — a blurred ring and a ring-shaped falloff
 * are the same picture, and this one is a shader. Same reasoning, and the same conclusion, as
 * `ScreenBackground`'s `ORB_STOPS`; see that file's header for the longer version.
 *
 * **No `<G opacity>` anywhere.** Group opacity forces an offscreen buffer (again, see
 * `ScreenBackground`'s note at `OrbCanvas`), so every alpha here is a per-shape `opacity`,
 * `fillOpacity` or `strokeOpacity`, and the only group-level alpha is on an `Animated.View`
 * wrapping a whole `<Svg>` — which is a view composite, not a canvas buffer.
 *
 * Connections:
 *   Imports → react-native-svg, react-native (Animated — NOT Reanimated, see below),
 *             constants/motion (Duration),
 *             constants/theme (darken — light mode's inverted material, see below),
 *             lib/boughlight (all geometry + strength values — see that file for why the
 *             numbers live outside the component), lib/useAppTheme (useAppTheme, useIsDark,
 *             useAccessibility), lib/screenColor (getScreenColor),
 *             store/useSettingsStore (reduceEffects)
 *   Used by → app/(tabs)/_layout.tsx (one shared `crown` instance behind the whole pager, over
 *             ScreenBackground), components/ScreenScaffold.tsx (`crown` again, on the sub-tier
 *             `ownBackground` path, behind the same `decorative` gate as ParticleBackground),
 *             app/onboarding/_layout.tsx (`hero`, the whole flow's scenery)
 *   Data    → settings.reduceEffects; and, via lib/useGrowth, tasks + habits + habit_logs and
 *             settings.showGrowth/lifetimeGrowth — the streak that appends branches to the crown
 *
 * Edit notes:
 *   - Same render contract as every other backdrop layer: absolutely positioned,
 *     `pointerEvents="none"`, `zIndex: -1`. The z is NOT belt-and-braces — this mounts beside
 *     `zIndex: 99/100` chrome, and Android sorts the whole group the moment any sibling declares
 *     one. `lib/__tests__/chromeRhythm.test.ts` §6 lists this file and checks it.
 *   - **The tint is one `color` value, exactly as the handoff specifies.** Every path, leaf and
 *     mote takes the screen's hue; whites stay literal in dark so a mote core reads as LIGHT
 *     rather than as hue. **LIGHT inverts that material** — see the block at `tint`/`core` for the
 *     measurement behind it. That is the one place this layer departs from the brief, and it is
 *     the departure that makes light mode render at all.
 *   - ⚠️ **The two loops use RN's `Animated`, NOT Reanimated, and that is load-bearing for CI.**
 *     `scripts/screenshot-states.mjs --deterministic` freezes `Date.now()` and nothing else, so a
 *     Reanimated loop — which clocks off `requestAnimationFrame` — keeps running under it. This
 *     layer's first CI run proved what that costs: `settle()` (that file's two-identical-frames
 *     predicate) can never return "settled" on a screen with an endless animation, so it spends
 *     its budget and captures at whatever phase the MACHINE happened to reach, and 14 of 26
 *     baselines came back "changed" by 0.01–0.58% against locally-blessed ones. That is the exact
 *     machine-speed dependence `settle()` was written to remove, reintroduced one layer lower.
 *       RN's JS-driven `Animated.timing` clocks off the frozen `Date.now()`, so under
 *     `--deterministic` both loops sit at progress 0 and every capture is identical. This is not a
 *     new trick — it is precisely why `components/ParticleBackground.tsx` is invisible to the
 *     pixel gate, documented in that file's header. Both values are `useNativeDriver: true`
 *     transforms/opacity, so nothing is given up on device.
 *       The same fact is the standing caveat: **a clean pixel-gate run says nothing about whether
 *     this layer's motion works.** Check it on a device, or probe the DOM on a page without the
 *     deterministic override, the way ParticleBackground's header describes.
 *   - **Two moving elements, maximum, and they are both a whole layer.** The bough sways and the
 *     light breathes; nothing else animates, and the motes here are all STATIC (the crown's own
 *     note: *"No falling motes — the card stack would cross them"*). The app's drifting motion
 *     is `components/ParticleBackground.tsx`'s five dots and stays there.
 *     ANIMATION_GUIDELINES §6 counts simultaneous moving elements, so this layer's budget is 2.
 *   - The bough rotates about a point OFF its own centre (the branch's anchor at the screen
 *     edge), and RN rotates a view about its centre — so `swayStyle` builds the standard
 *     translate → rotate → un-translate triple. Don't "simplify" it to a bare `rotate`: the
 *     branch would detach from the edge it grows out of.
 *   - **Every number is in `lib/boughlight.ts`, and that is not tidiness.** The claim that makes
 *     this layer shippable is a containment property of the crown's coordinates; a property has
 *     to be testable, and a coordinate baked into JSX is not.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { darken } from '@/constants/theme';
import { Duration } from '@/constants/motion';
import {
  FIELD_OPACITY,
  FRAME,
  growthFrame,
  HALO_PEAK,
  LEAF_D,
  LEAF_RIB_D,
  MOTE_STOPS,
  SHAFTS,
  SWAY_DEG,
  VB,
  type BoughlightVariant,
  type Frame,
} from '@/lib/boughlight';
import { useAppTheme, useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { getScreenColor } from '@/lib/screenColor';
import { useGrowth } from '@/lib/useGrowth';
import { useSettingsStore } from '@/store/useSettingsStore';

export type { BoughlightVariant };

type Props = {
  /** Which of the handoff's two frames to draw. Default `crown` — the one that sits under a
   *  card stack, i.e. the shape every tab needs. */
  variant?: BoughlightVariant;
  /** The active tab's route file name, for the tint. Anything unknown (or a deliberately
   *  neutral screen like Home or Settings) falls back to the accent, which is what the handoff's
   *  `color: var(--c-accent)` means. */
  activeRoute?: string;
};

// ─── Sub-layers ───────────────────────────────────────────────────────────────────────────────

/** Shared `<Svg>` setup: the handoff's frame, scaled to COVER so a phone of any aspect ratio
 *  tucks the edges further off-screen rather than distorting the art. */
function Frame390({ children }: { children: React.ReactNode }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {children}
    </Svg>
  );
}

/**
 * Everything that never moves: the glow, the halo, the leaves' fill def, the motes.
 *
 * One canvas, mounted once, `renderToHardwareTextureAndroid` on its parent — so on Android this
 * whole layer is rasterised to a GPU texture and every subsequent frame composites it rather
 * than re-running ~50 shaders. That matters here more than it would elsewhere: this sits behind
 * the tabs pager, which composites its backdrop group on every swipe frame.
 */
function StaticLayer({ frame, tint, core }: { frame: Frame; tint: string; core: string }) {
  return (
    <Frame390>
      <Defs>
        <RadialGradient id="bl-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={core} stopOpacity={0.6} />
          <Stop offset="42%" stopColor={tint} stopOpacity={0.17} />
          <Stop offset="100%" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
        {/* The blurred halo stroke, as a ring-shaped falloff — see HALO_PEAK. */}
        <RadialGradient id="bl-ring" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={tint} stopOpacity={0} />
          <Stop offset="70%" stopColor={tint} stopOpacity={0} />
          <Stop offset={`${HALO_PEAK * 100}%`} stopColor={tint} stopOpacity={frame.halo.soft} />
          <Stop offset="100%" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="bl-mote" cx="50%" cy="50%" r="50%">
          {MOTE_STOPS.map((s) => (
            <Stop
              key={s.offset}
              offset={s.offset}
              stopColor={s.color === 'core' ? core : tint}
              stopOpacity={s.alpha}
            />
          ))}
        </RadialGradient>
      </Defs>

      {/* The light source's bloom, behind everything. */}
      <Ellipse
        cx={frame.glow.cx}
        cy={frame.glow.cy}
        rx={frame.glow.rx}
        ry={frame.glow.ry}
        fill="url(#bl-glow)"
      />

      {/* The halo: a hairline that says "ring", and a soft band that says "light". */}
      <Circle
        cx={frame.halo.cx}
        cy={frame.halo.cy}
        r={frame.halo.r / HALO_PEAK}
        fill="url(#bl-ring)"
      />
      <Circle
        cx={frame.halo.cx}
        cy={frame.halo.cy}
        r={frame.halo.r}
        fill="none"
        stroke={core}
        strokeOpacity={frame.halo.ring}
        strokeWidth={1.5}
      />

      {/* Motes. Two circles each — the orb gradient, then a bright pip at its core, which is what
          keeps a mote reading as a point of light rather than as a soft blob. */}
      {frame.motes.map((m, i) => (
        <G key={`m${i}`}>
          <Circle cx={m.x} cy={m.y} r={50 * m.s} fill="url(#bl-mote)" />
          <Circle cx={m.x} cy={m.y} r={8 * m.s} fill={core} fillOpacity={0.92} />
        </G>
      ))}
    </Frame390>
  );
}

/**
 * The bough, in its own canvas so the sway is a VIEW transform on a rasterised texture rather
 * than an animated SVG prop. `useAnimatedProps` on an `<AnimatedG>` re-runs the whole canvas's
 * layout on the UI thread every frame; an `Animated.View` transform does not. Same conclusion,
 * and the same measurement, as `ScreenBackground`'s `OrbCanvas`.
 */
function BoughLayer({
  frame,
  tint,
  style,
}: {
  frame: Frame;
  tint: string;
  style: React.ComponentProps<typeof Animated.View>['style'];
}) {
  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[styles.layer, style]}
    >
      <Frame390>
        <Defs>
          <LinearGradient id="bl-leaf" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.26} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0.09} />
          </LinearGradient>
        </Defs>
        {frame.bough.strokes.map((b, i) => (
          <Path
            key={`b${i}`}
            d={b.d}
            fill="none"
            stroke={tint}
            strokeOpacity={b.o}
            strokeWidth={b.w}
            strokeLinecap="round"
          />
        ))}
        {frame.bough.leaves.map((l, i) => (
          // The handoff's own `transform="translate(x,y) rotate(r) scale(s)"`, verbatim. A
          // transform STRING rather than react-native-svg's `x`/`rotation`/`scale` props: those
          // are deprecated in v15 in favour of exactly this, and keeping the string means a leaf
          // placement can be copied between the brief and this file without re-deriving it.
          <G key={`l${i}`} transform={`translate(${l.x},${l.y}) rotate(${l.rot}) scale(${l.s})`}>
            <Path d={LEAF_D} fill="url(#bl-leaf)" />
            <Path d={LEAF_RIB_D} fill="none" stroke={tint} strokeOpacity={0.22} strokeWidth={1} />
          </G>
        ))}
      </Frame390>
    </Animated.View>
  );
}

/**
 * The breathing light — the hero's three shafts, or the crown's full-frame haze. One canvas
 * whose OPACITY animates, which is the one thing that is cheap to animate over a whole layer.
 */
function LightLayer({
  variant,
  tint,
  core,
  style,
}: {
  variant: BoughlightVariant;
  tint: string;
  core: string;
  style: React.ComponentProps<typeof Animated.View>['style'];
}) {
  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[styles.layer, style]}
    >
      <Frame390>
        <Defs>
          <LinearGradient id="bl-shaft" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={core} stopOpacity={0.58} />
            <Stop offset="55%" stopColor={tint} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="bl-haze" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {variant === 'hero'
          ? SHAFTS.map((s, i) => (
              <Path key={`s${i}`} d={s.d} fill="url(#bl-shaft)" opacity={s.o} />
            ))
          : // The crown's floor: two hazes that give the bottom of the screen a ground, plus the
            // slow full-frame breath. The floor pair is what answers "the lower half is dead
            // black" for this layer, the same report `ScreenBackground`'s wash 3 was re-aimed for.
            [
              <Ellipse key="f1" cx={340} cy={826} rx={230} ry={180} fill="url(#bl-haze)" opacity={0.8} />,
              <Ellipse key="f2" cx={12} cy={770} rx={170} ry={160} fill="url(#bl-haze)" opacity={0.5} />,
              <Ellipse key="f3" cx={195} cy={440} rx={290} ry={410} fill="url(#bl-haze)" opacity={0.26} />,
            ]}
      </Frame390>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────────────────────

function BoughlightBackdrop({ variant = 'crown', activeRoute }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  // Same third term as `ParticleBackground`: this is an always-mounted full-screen layer the
  // pager composites on every swipe frame, which is exactly the class of per-frame cost that
  // switch exists to remove. A user who asked for fewer effects gets none of this.
  const reduceEffects = useSettingsStore((s) => s.reduceEffects);

  const still = reducedMotion || reduceEffects;
  // 0 → 1 → 0, driven by RN's `Animated` so the frozen clock in `--deterministic` pins both at 0.
  // See the header's note on why this is not Reanimated; it is a CI-determinism constraint, not a
  // preference. Starting (and resting) at 0 is deliberate too: that is the phase every harness
  // capture sees, so the blessed baselines show the bough at one end of its travel rather than at
  // an arbitrary point in it.
  const sway = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      sway.setValue(0);
      breath.setValue(0);
      return;
    }
    // One leg out, one leg back, so a `swayLong` of 7500ms is the handoff's 15s round trip.
    // `Easing.inOut(Easing.quad)` is `Ease.move`'s shape in RN's own easing vocabulary — the
    // Reanimated `Ease` tokens are not interchangeable with this API, which is the one thing the
    // port had to restate rather than reuse.
    const loop = (value: Animated.Value, leg: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: leg,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: leg,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
    // The two periods are deliberately not multiples of each other (see Duration.swayLong /
    // Duration.breathe) — a bough and the light it hangs in must never fall into lockstep.
    const swayLoop = loop(sway, Duration.swayLong);
    const breathLoop = loop(breath, Duration.breathe);
    swayLoop.start();
    breathLoop.start();
    return () => {
      swayLoop.stop();
      breathLoop.stop();
    };
  }, [still, sway, breath]);

  // **The reward channel** (2026-09-19). The handoff: *"New branches append off the (390,14)
  // bough and stay inside the crown band; they never un-grow. […] No number, anywhere."* That is
  // the contract `lib/growth.ts` already implements, so this reads it rather than inventing a
  // second one. `useGrowth` returns a flat 0 when `settings.showGrowth` is off (the default), and
  // its `level` comes off a high-water mark — so a lapsed streak leaves the canopy standing,
  // which is the "never un-grow" half.
  //   The crown's TINT channel is deliberately not drawn here; `components/ScreenBackground.tsx`
  // already greens its washes off the same `intensity`, over the same screen, and one streak
  // must not read as two rewards. See `CROWN_GROWTH` in lib/boughlight.ts.
  const { level } = useGrowth();
  // ⚠️ No transition on a new branch, and that matches `ScreenBackground`'s own ruling for this
  // channel: `level` is derived from a streak that turns over BETWEEN app sessions, so nobody is
  // ever watching at the frame it changes. A reveal animation here would be a frame nobody sees.
  const frame = growthFrame(FRAME[variant], variant, level);

  // The bough's pivot is its anchor at the screen edge, not the layer's centre, and RN rotates a
  // view about its centre. translate → rotate → un-translate moves the pivot; the offsets are the
  // pivot's distance from the layer centre, in the same viewBox units the layer is drawn in,
  // which is exact because the canvas covers the layer 1:1 before the `slice` scale.
  const pivotX = frame.bough.px - VB.w / 2;
  const pivotY = frame.bough.py - VB.h / 2;

  const swayStyle = {
    transform: [
      { translateX: pivotX },
      { translateY: pivotY },
      {
        rotate: sway.interpolate({
          inputRange: [0, 1],
          outputRange: [`${-SWAY_DEG}deg`, `${SWAY_DEG}deg`],
        }),
      },
      { translateX: -pivotX },
      { translateY: -pivotY },
    ],
  };

  // The handoff's two breaths: the hero's shafts .35→.80, the crown's full-frame haze .50→.95.
  const lo = variant === 'hero' ? 0.35 : 0.5;
  const hi = variant === 'hero' ? 0.8 : 0.95;
  const lightStyle = { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [lo, hi] }) };

  if (reduceEffects) return null;

  const hue = getScreenColor(theme, activeRoute);
  // The handoff's single `color` on the svg root. A neutral screen (Home, Settings, onboarding)
  // resolves to the border grey, which is correct for a card edge and dead as scenery — so
  // scenery falls back to the accent, which is what `var(--c-accent)` meant in the brief.
  const hueBase = hue.neutral ? theme.accent : hue.base;

  // ⚠️ **LIGHT INVERTS THE MATERIAL, and this is the one real departure from the brief.**
  // Measured, not reasoned about: the first light render of this layer was invisible — a smudge
  // behind the header and no motes at all — and raising `FIELD_OPACITY.light` alone did not fix
  // it, because the problem is not alpha. Every alpha in the handoff was chosen against
  // `#060C18`, where a hue at 0.3 is a LIGHT mark on a dark ground. Put the same hue at the same
  // alpha on `#f7faff` and it is a light mark on a lighter ground, i.e. nothing.
  //   So in light the scene is drawn as a DARKER mark instead: the tint is the screen's hue taken
  // down, and the mote core is taken down further still, which keeps the handoff's own
  // relationship (the core reads against its own glow) with the contrast running the other way.
  // In DARK nothing changes — the hue is the hue and the cores stay literally white, so a mote
  // reads as light rather than as colour, exactly as the brief specifies.
  const tint = isDark ? hueBase : darken(hueBase, 0.3);
  const core = isDark ? '#FFFFFF' : darken(hueBase, 0.55);

  return (
    <View
      style={[styles.backdrop, { opacity: isDark ? FIELD_OPACITY.dark : FIELD_OPACITY.light }]}
      pointerEvents="none"
      renderToHardwareTextureAndroid
    >
      <View style={styles.layer} pointerEvents="none" renderToHardwareTextureAndroid>
        <StaticLayer frame={frame} tint={tint} core={core} />
      </View>
      <LightLayer variant={variant} tint={tint} core={core} style={lightStyle} />
      <BoughLayer frame={frame} tint={tint} style={swayStyle} />
    </View>
  );
}

// Memoised for the same reason `ParticleBackground` is: it is mounted in the tabs pager's
// backdrop group, whose parent re-renders on every tab change to cross-fade the hero glow.
// `activeRoute` is the one prop that legitimately changes it.
export default React.memo(BoughlightBackdrop);

const styles = StyleSheet.create({
  // The backdrop-group contract, stated rather than inherited: this mounts beside
  // `zIndex: 99/100` chrome blocks, and Android sorts the whole group the moment any sibling
  // declares a z. A bough must never be able to draw over a nav icon.
  // `lib/__tests__/chromeRhythm.test.ts` §6 lists this file and checks for this exact line.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
