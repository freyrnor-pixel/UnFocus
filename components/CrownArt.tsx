/**
 * CrownArt.tsx — the `Backdrop_Handoff` "canopy × halo" art, as SVG CHILDREN of a canvas
 * somebody else owns.
 *
 * ⚠️ **This is the re-land of #734, and the one thing that made #734 fail is the one thing this
 * file is shaped to make unspellable.** Read #735 before changing the shape here.
 *
 * #734 drew this same art and the maintainer reported *"the app is constantly slow again. Looks
 * like it is in 20fps all the time."* The revert named three causes, and **none of them is the
 * drawing**:
 *
 *   1. The bough was a full-screen `<Svg>` inside an `Animated.View` whose transform included
 *      `rotate`, so the GPU resampled the whole surface every frame — and
 *      `renderToHardwareTextureAndroid` made that *worse*, not better, because a texture whose
 *      transform changes per frame is re-uploaded rather than re-used.
 *   2. Two loops at 15s and 11s, deliberately not multiples of each other, so **the window never
 *      idled**.
 *   3. **Three** new full-screen layers, plus a **fourth instance per sub-tier screen**, on top
 *      of a backdrop stack that `components/ScreenBackground.tsx` already calls this GPU-bound
 *      app's largest fixed per-frame cost.
 *
 * So this file exports no component that renders a `View`, holds no `Animated.Value`, and starts
 * no loop. It returns `<Defs>` and a `<G>` — **shapes to be added to an existing raster**. The
 * canvas that adopts them (`ScreenBackground`'s neutral orb canvas) is rasterised once into a
 * hardware texture and composited thereafter, so the whole of this art costs **one rasterisation
 * at mount and nothing per frame**. That is #735's own re-land spec, one step further: it asked
 * for "one canvas instead of three", and this is zero.
 *
 * **What was dropped from the handoff, and why each is safe to drop:**
 *   · the ±1.4° sway — cause 1 above. The bough is drawn at rest.
 *   · the breath — cause 2. The light is drawn at the midpoint of its own travel
 *     (`LIGHT_REST`), which is the phase a viewer sees it in half the time anyway.
 *   · `<feGaussianBlur>` on the halo — react-native-svg's filter support is uneven on Android,
 *     and a blurred ring and a ring-shaped radial falloff are the same picture. See `HALO_PEAK`.
 *     This is the same substitution `ScreenBackground`'s `ORB_STOPS` already makes for its orbs.
 *
 * **The tint is the accent, NOT the active tab's hue, and that is load-bearing on web.** #734
 * took `getScreenColor(theme, activeRoute)` here. Two things go wrong with that now the art
 * lives inside a shared canvas: every `<Svg>` renders into the one document on web, so two
 * mounted instances (the pager's, plus a pushed sub-tier screen's) would both define `bl-glow`
 * and the second would silently win for both — and unlike the orb canvas's defs, these would
 * hold DIFFERENT colours, so the collision would be visible. Drawing the crown once in the
 * accent removes the collision, and costs nothing: `ScreenBackground`'s per-tab hue layers wash
 * over this art anyway, which is where the tab's colour already comes from. The handoff's own
 * root is `color: var(--c-accent)`, so this is also the more faithful reading.
 *
 * Connections:
 *   Imports → react-native-svg, lib/boughlight (all geometry + strengths), constants/theme
 *             (darken), lib/useAppTheme (useAppTheme, useIsDark)
 *   Used by → components/ScreenBackground.tsx — composed into the NEUTRAL orb canvas only, so
 *             the hue buffers and the growth-tint canvas do not each draw a copy
 *   Data    → none directly; the growth `level` is passed in by the caller (lib/useGrowth.ts)
 *
 * Edit notes:
 *   - ⚠️ **Do not add an `opacity` to the `<G>`.** Group opacity is not a per-shape alpha — the
 *     renderer draws the group into a scratch layer and composites, which on Android is a
 *     `saveLayer`, the classic Canvas performance cliff (`ScreenBackground`'s `OrbLayer` header
 *     records the same trap). `FIELD_OPACITY` is folded into each element's own alpha by `k()`
 *     instead, which produces the identical picture with no offscreen buffer.
 *   - ⚠️ **Do not re-introduce an `Animated` anything here.** `lib/__tests__/chromeRhythm.test.ts`
 *     §6 fails on a transform animated in any backdrop layer, and on an undeclared loop.
 *   - Adding geometry means re-running `clearZoneOffenders(CROWN)` — `lib/__tests__/
 *     boughlight.test.ts` does that for you and names the offending element.
 */
import React from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { darken } from '@/constants/theme';
import {
  CROWN_TO_ORB,
  FIELD_OPACITY,
  FRAME,
  growthFrame,
  HALO_PEAK,
  LEAF_D,
  LEAF_RIB_D,
  LIGHT_REST,
  MOTE_STOPS,
  SHAFTS,
  type BoughlightVariant,
} from '@/lib/boughlight';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

export type { BoughlightVariant };

type Props = {
  /** Which of the handoff's two frames to draw. `crown` sits under a card stack and is held to
   *  `CLEAR_ZONE`; `hero` is for screens with nothing over the middle (onboarding). */
  variant: BoughlightVariant;
  /** `lib/useGrowth.ts`'s level — appends branches off the bough. 0 when growth is off. */
  level: number;
};

/**
 * The art's palette, derived once from the theme.
 *
 * ⚠️ **LIGHT INVERTS THE MATERIAL, and this is the handoff's one real departure — measured on
 * #734's first light render, not reasoned about.** Every alpha in the brief was chosen against
 * `#060C18`, where a hue at 0.3 is a LIGHT mark on a dark ground. The same hue at the same alpha
 * on `#f7faff` is a light mark on a lighter ground, i.e. nothing at all — the bough read as a
 * smudge behind the header and the motes did not resolve. Raising `FIELD_OPACITY.light` alone
 * does not fix that, because the problem is direction, not amount.
 *   So light draws the scene as a DARKER mark: the tint is the accent taken down, and the mote
 * core taken down further, which preserves the handoff's own relationship (a core reads against
 * its own glow) with the contrast running the other way. DARK is the brief verbatim — the hue is
 * the hue and the cores stay literally white, so a mote reads as light rather than as colour.
 */
function useCrownPalette() {
  const theme = useAppTheme();
  const isDark = useIsDark();
  return {
    tint: isDark ? theme.accent : darken(theme.accent, 0.3),
    core: isDark ? '#FFFFFF' : darken(theme.accent, 0.55),
    /** The whole-layer master alpha, folded per element — see this file's edit notes. */
    field: isDark ? FIELD_OPACITY.dark : FIELD_OPACITY.light,
  };
}

/**
 * The crown's `<Defs>`. Separate from the shapes because react-native-svg wants gradient defs as
 * direct children of a `<Defs>`, and the canvas that adopts this already has one of its own —
 * two `<Defs>` in one `<Svg>` is valid SVG and both platforms collect them.
 *
 * Every id is `bl-`-prefixed and appears exactly once in the app, because only the neutral orb
 * canvas draws the crown. See the header for why that matters on web.
 */
export function CrownDefs({ variant, level }: Props) {
  const { tint, core, field } = useCrownPalette();
  const frame = growthFrame(FRAME[variant], variant, level);
  const k = (a: number) => a * field;
  return (
    <Defs>
      {/* The light source's bloom. */}
      <RadialGradient id="bl-glow" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={core} stopOpacity={k(0.6)} />
        <Stop offset="42%" stopColor={tint} stopOpacity={k(0.17)} />
        <Stop offset="100%" stopColor={tint} stopOpacity={0} />
      </RadialGradient>
      {/* The blurred halo stroke, as a ring-shaped falloff — see HALO_PEAK. */}
      <RadialGradient id="bl-ring" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={tint} stopOpacity={0} />
        <Stop offset="70%" stopColor={tint} stopOpacity={0} />
        <Stop offset={`${HALO_PEAK * 100}%`} stopColor={tint} stopOpacity={k(frame.halo.soft)} />
        <Stop offset="100%" stopColor={tint} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="bl-mote" cx="50%" cy="50%" r="50%">
        {MOTE_STOPS.map((s) => (
          <Stop
            key={s.offset}
            offset={s.offset}
            stopColor={s.color === 'core' ? core : tint}
            stopOpacity={k(s.alpha)}
          />
        ))}
      </RadialGradient>
      <RadialGradient id="bl-haze" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={tint} stopOpacity={k(0.28)} />
        <Stop offset="100%" stopColor={tint} stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id="bl-leaf" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor={tint} stopOpacity={k(0.26)} />
        <Stop offset="100%" stopColor={tint} stopOpacity={k(0.09)} />
      </LinearGradient>
      <LinearGradient id="bl-shaft" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={core} stopOpacity={k(0.58)} />
        <Stop offset="55%" stopColor={tint} stopOpacity={k(0.12)} />
        <Stop offset="100%" stopColor={tint} stopOpacity={0} />
      </LinearGradient>
    </Defs>
  );
}

/**
 * The crown's shapes, in one `<G>` that rescales the handoff's 390×844 frame onto the adopting
 * canvas's 280×607 one. See `CROWN_TO_ORB` for why a single uniform factor is exact enough.
 *
 * Draw order is the handoff's: bloom → halo → floor haze → bough → leaves → motes, so the light
 * is behind what it lights and the motes read as points in front of everything.
 */
export function CrownArt({ variant, level }: Props) {
  const { tint, core, field } = useCrownPalette();
  const frame = growthFrame(FRAME[variant], variant, level);
  const k = (a: number) => a * field;
  const rest = LIGHT_REST[variant];
  return (
    <G transform={`scale(${CROWN_TO_ORB})`}>
      {/* The light source's bloom, behind everything. */}
      <Ellipse cx={frame.glow.cx} cy={frame.glow.cy} rx={frame.glow.rx} ry={frame.glow.ry} fill="url(#bl-glow)" />

      {/* The halo: a soft band that says "light", then a hairline that says "ring". */}
      <Circle cx={frame.halo.cx} cy={frame.halo.cy} r={frame.halo.r / HALO_PEAK} fill="url(#bl-ring)" />
      <Circle
        cx={frame.halo.cx}
        cy={frame.halo.cy}
        r={frame.halo.r}
        fill="none"
        stroke={core}
        strokeOpacity={k(frame.halo.ring)}
        strokeWidth={1.5}
      />

      {/* The light that used to breathe, drawn at `LIGHT_REST` — the hero's three shafts, or the
          crown's floor pair plus its full-frame haze. The crown's floor is what answers "the
          lower half is dead black" for this art, the same report ScreenBackground's wash 3 was
          re-aimed for. */}
      {variant === 'hero' ? (
        SHAFTS.map((s, i) => <Path key={`s${i}`} d={s.d} fill="url(#bl-shaft)" opacity={s.o * rest} />)
      ) : (
        <>
          <Ellipse cx={340} cy={826} rx={230} ry={180} fill="url(#bl-haze)" opacity={0.8 * rest} />
          <Ellipse cx={12} cy={770} rx={170} ry={160} fill="url(#bl-haze)" opacity={0.5 * rest} />
          <Ellipse cx={195} cy={440} rx={290} ry={410} fill="url(#bl-haze)" opacity={0.26 * rest} />
        </>
      )}

      {/* The bough. Drawn at rest — see the header for what used to move it and what that cost. */}
      {frame.bough.strokes.map((b, i) => (
        <Path
          key={`b${i}`}
          d={b.d}
          fill="none"
          stroke={tint}
          strokeOpacity={k(b.o)}
          strokeWidth={b.w}
          strokeLinecap="round"
        />
      ))}
      {frame.bough.leaves.map((l, i) => (
        // The handoff's own `transform="translate(x,y) rotate(r) scale(s)"`, verbatim. A transform
        // STRING rather than react-native-svg's `x`/`rotation`/`scale` props: those are deprecated
        // in v15 in favour of exactly this, and keeping the string means a leaf placement can be
        // copied between the brief and this file without re-deriving it.
        <G key={`l${i}`} transform={`translate(${l.x},${l.y}) rotate(${l.rot}) scale(${l.s})`}>
          <Path d={LEAF_D} fill="url(#bl-leaf)" />
          <Path d={LEAF_RIB_D} fill="none" stroke={tint} strokeOpacity={k(0.22)} strokeWidth={1} />
        </G>
      ))}

      {/* Motes. Two circles each — the orb gradient, then a bright pip at its core, which is what
          keeps a mote reading as a point of light rather than as a soft blob. */}
      {frame.motes.map((m, i) => (
        <G key={`m${i}`}>
          <Circle cx={m.x} cy={m.y} r={50 * m.s} fill="url(#bl-mote)" />
          <Circle cx={m.x} cy={m.y} r={8 * m.s} fill={core} fillOpacity={k(0.92)} />
        </G>
      ))}
    </G>
  );
}
