/**
 * ScreenBackground.tsx — the app's ambient backdrop behind a screen's content.
 *
 * **AMBIENT ORBS, AND THE BACKDROP IS PINNED TO THE BOTTOM LAYER (2026-08-17).** Maintainer:
 * *"The current blue line-art background is causing severe visual interference. It is rendering
 * ON TOP of the bottom navigation and text… Delete the sharp, chaotic vine/line art. It is too
 * distracting."* Two instructions, and they are separate fixes — read both before undoing either.
 *
 *   1. **`zIndex: -1`, explicitly, on every backdrop layer.** This component, and its two
 *      siblings in the same group (`HomeHeroBackground`), used to rely on
 *      being the FIRST child of their container and on nothing else declaring a z. That is a
 *      convention, not a guarantee: `app/(tabs)/_layout.tsx` mounts the group beside a
 *      `zIndex: 100` nav overlay and a pager, and `ScreenScaffold` mounts it beside two
 *      `zIndex: 99/100` chrome blocks — and the moment ANY sibling declares a z, Android sorts
 *      the whole group rather than drawing it in document order. A negative z states the
 *      intent instead of inheriting it: the backdrop cannot be raised above the header, the
 *      bottom nav, a sticky bar or content, whatever a future sibling declares.
 *   2. **Corner ORBS, not line art.** *"Create an ambient glow effect by placing 2 or 3 large,
 *      absolutely positioned circles in the background corners… deeply muted, dark versions of
 *      our neon palette… a massive blur… opacity to 10-15%. This creates a soft, distant
 *      'bioluminescent' glow that pure black OLED can contrast against."* So: three discs, two
 *      of them anchored just OFF the canvas at the top-right and bottom-left corners the brief
 *      names, in a deep cyan and a deep violet taken down from `IDENTITY_HUES`' habits/notes
 *      rungs.
 *
 * **The blur is a radial falloff, and that is the implementation, not an approximation.** RN has
 * no `filter: blur` for a View on native, and `expo-blur`'s `BlurView` blurs what is BEHIND it
 * rather than itself — so a literal `blurRadius={90}` has nothing to attach to here. A Gaussian
 * blur of a flat disc IS a radial alpha falloff, so `ORB_STOPS` draws one directly: a solid core
 * out to 30% of the radius, then a smooth run to zero. `<FeGaussianBlur>` was the other option
 * and is deliberately not taken — react-native-svg's filter support is uneven on Android and it
 * would rasterise three full-screen layers every frame the tint animates, for a result this
 * matches exactly. Each orb's radius already INCLUDES the blur spread, which is why the numbers
 * are much larger than the brief's literal 300px.
 *
 * **The centre of the screen stays true black, by construction.** Every orb centre sits at or
 * outside a corner and every radius is short of the middle, so at the centre of the canvas all
 * three gradients have already reached zero — see `ORBS` for the arithmetic. That is what keeps
 * the OLED promise (an unlit pixel draws no power) AND what keeps `__tests__/glassMaterial.test.ts`'s
 * dark ground honest: a card is measured against the black under it, and there is nothing else
 * under it. **Don't move an orb inward.** A glow that reaches the middle relights every pixel a
 * card sits on and takes both properties with it. `lib/__tests__/chromeRhythm.test.ts` §6 is what
 * makes that a checked property rather than a promise in this comment.
 *
 * **What this replaced**: a tapered branch-and-leaf line drawing tucked into three corners
 * (2026-07-19 "abstract branch" handoff, leaves redrawn 2026-08-04), at `branchOpacity` 0.42 in
 * a `#3f74ff` blue. That art's own note flagged the risk and left the call to a real panel:
 * against the old navy field the branch shared a hue family and sat in it as texture, and
 * against `#000000` it became the only chromatic thing in a large empty area. The panel has now
 * ruled. `BRANCHES`/`LEAVES`/`GROWTH_STROKES`/`GROWTH_LEAVES`/`leafD`/`Cluster` are DELETED, not
 * unmounted — nothing can be quietly rewired back. The motif system (`constants/motifs.ts`,
 * `components/Motif.tsx`) is untouched and still draws `trunk-divider` and `StarterCard`'s
 * watermark; only this file's own vocabulary changed.
 *
 * **It is still the app's reward surface (lib/growth.ts), re-expressed in the new vocabulary.**
 * The two channels and their contract are unchanged — the user still sees NO NUMBER anywhere, no
 * streak count, no total, no level:
 *   - **`level` swells the orbs.** `ORB_GROWTH_STEP` per tier, from a high-water mark, so an orb
 *     that grew stays grown. It replaces "extra branches grow in around the border"; the same
 *     never-un-grows property, in the one dimension a disc has.
 *   - **`intensity` tints them green.** A second copy of the same three orbs in the growth hue,
 *     fading in over the neutral pair. Neutral is still the floor: a lapsed streak returns the
 *     backdrop to exactly the art the app always had, never to a visibly worse one — same
 *     floor-at-neutral shape as lib/goalStrength.ts.
 * Both are gated on settings.showGrowth (off by default) via lib/useGrowth.ts, which returns a
 * flat 0/0 when the feature is off — i.e. precisely the always-there three-orb field.
 *
 * **What it COSTS, and how that was cut (2026-08-29).** This was one react-native-svg canvas
 * holding everything — base gradient, the two legacy radial glows, six circles. The maintainer's
 * HWUI trace showed the app is GPU-bound and this is its largest fixed per-frame cost, because
 * the canvas TRANSLATES with the pager while two of its groups cross-fade. In DARK — the default
 * theme — three of those layers were drawing nothing: `base` is three identical `#000000` stops
 * (a gradient shader painting a flat black) and both glow opacities are 0 (two fully transparent
 * full-canvas rects). All three are now conditional, so dark draws a plain `View` and the orbs,
 * and dark + `reduceEffects` mounts no `<Svg>` at all. LIGHT is untouched and deliberately so —
 * see the measured refusal in the block above the return. The canvas is a
 * 280×607 viewBox scaled to COVER the screen (`preserveAspectRatio="xMidYMid slice"`), so a corner
 * orb tucks further off-screen on non-phone aspect ratios rather than distorting.
 *
 * Connections:
 *   Imports → react-native-reanimated, lib/useAppTheme (useIsDark, useAccessibility),
 *             lib/useGrowth, constants/motion (Duration, Ease)
 *   Used by → app/(tabs)/_layout.tsx (one shared instance behind the whole pager); components/
 *             ScreenScaffold (its own first child, for sub-tier and non-pager site screens);
 *             app/onboarding/_layout.tsx (the whole onboarding flow's backdrop)
 *   Data    → via lib/useGrowth: tasks + habits + habit_logs, settings.showGrowth/lifetimeGrowth
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the screen's
 *     SafeAreaView/ScrollView be transparent on top of it. The `zIndex: -1` is belt-and-braces
 *     for that ordering, not a replacement for it — keep doing both.
 *   - `activeRoute` is accepted for backwards-compatibility with callers (the pager passes the
 *     active tab) but is not used — the backdrop is the same field on every screen.
 *   - **The orb palette is per-theme and the two modes are not the same picture.** DARK is the
 *     one the brief is about: a black field with three dark-neon glows. LIGHT keeps its blue
 *     base gradient and the two broad `topGlow`/`botGlow` ellipses that have always been its
 *     ambient layer, and takes the orbs at a lower alpha on top — a DARK orb on a pale field
 *     reads as a smudge, so the light values are lifted toward its own blues rather than
 *     darkened. The `topGlow`/`botGlow` machinery is kept for exactly that reason; it is at
 *     opacity 0 in DARK and deliberately so (a radial lift on pure black is what destroys the
 *     OLED benefit — the orbs earn their lift by staying in the corners, a full-canvas ellipse
 *     could not).
 *   - **The tint is a two-copy opacity crossfade, not an animated colour.** The orbs are drawn
 *     twice — neutral underneath, green on top at `intensity` — because opacity is the one SVG
 *     prop that is reliably animatable through Reanimated on both native and the web preview.
 *     Don't "simplify" this into an animated `fill`/`stopColor` without testing both.
 *   - **Only the tint animates.** A level change resizes the orbs with no transition, which is
 *     fine because `level` is derived from a streak that turns over between app sessions — you
 *     will effectively never watch one grow. Don't add a reveal animation for a frame nobody sees.
 *   - An objectBoundingBox gradient is relative to each shape's own box, so ONE `<RadialGradient>`
 *     per colour serves every orb whatever its size or position. Don't mint a def per orb, and
 *     don't switch these to `userSpaceOnUse` — that would need one def per orb AND is the less
 *     portable of the two forms across react-native-svg and react-native-web.
 *   - `React.memo` no longer buys much now that useGrowth subscribes to the task/habit stores;
 *     the intensity it returns is quantised so a single tick can't repaint the backdrop for a
 *     sub-step change. See lib/useGrowth.ts's edit notes.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useGrowth } from '@/lib/useGrowth';
import { useAppTheme } from '@/lib/useAppTheme';
import { getScreenColor, type ScreenKey } from '@/lib/screenColor';

const AnimatedG = Animated.createAnimatedComponent(G);

type Props = {
  /**
   * The active tab's route file name — `index`, `plans`, `shopping`, `habits`, `health`.
   *
   * ⚠️ **Live since 2026-08-27 (round 20); it was accepted and ignored before that**, with a
   * comment saying the backdrop is one shared field on every screen. It still is one field — the
   * pager mounts exactly one — but the field now takes the ACTIVE SCREEN'S HUE, which is the
   * mockups' *"three soft accent washes per tab"* held to a strength that keeps the card band
   * dark (see `SCREEN_HUE_ORBS` and the palette's `orbScreenOpacity`).
   */
  activeRoute?: string;
};

/**
 * Route file name → the `ScreenKey` whose hue the backdrop wears.
 *
 * Only the five tabs, because only the pager passes an `activeRoute`; anything else falls
 * through to `null` and draws the neutral field alone, which is what every non-tab screen did
 * before this existed and still does.
 */
const ROUTE_HUE: Record<string, ScreenKey> = {
  index: 'index',
  plans: 'plans',
  shopping: 'shopping',
  habits: 'habits',
  health: 'health',
};

// ─── Orb geometry (viewBox 0 0 280 607) ────────────────────────────────────────────────────────

/**
 * One ambient glow. `cx`/`cy` are in viewBox units and sit at or OUTSIDE a corner — an orb is
 * meant to read as a light source somewhere off the edge of the phone, not as a circle drawn on
 * the screen. `r` is the full visible extent INCLUDING the blur spread (see `ORB_STOPS`), which
 * is why these are roughly double the brief's literal 300px disc.
 *
 * `tone` picks which of the palette's two hues the orb draws in; the growth copy overrides both
 * with a single green, so an orb's tone is a neutral-state property only.
 */
type Orb = { cx: number; cy: number; r: number; tone: 'cool' | 'warm' };

/**
 * Three orbs — the top of the brief's "2 or 3", at the two corners it names plus a quieter
 * third for balance.
 *
 * **The bottom-RIGHT corner is deliberately empty**, which is the one placement decision not
 * taken straight from the brief. The report is that the old art interfered with the bottom
 * navigation; the nav card is opaque so nothing can literally show through it, but its two
 * rounded top corners are notches that content and backdrop both show in, and stacking a second
 * glow along that edge would put the brightest part of the field in the exact place that was
 * complained about. One orb reaches the bottom edge, from the far side, and that is enough for
 * the screen to have a floor.
 *
 * **The centre stays black.** At the canvas centre (140, 300) the distance to each centre is 296 /
 * 298 / 290 units against radii of 200 / 210 / 132 — every gradient has reached zero well before
 * it, at every growth level (`ORB_GROWTH_STEP` × the level cap adds 45 at most). The nearest any
 * orb gets to the protected card box (x 60–220, y 170–440) is its corner, where the falloff is
 * down around 2-3% of an already-14% peak. See this file's header for why that matters, and
 * `lib/__tests__/chromeRhythm.test.ts` §6 for the check that keeps it true.
 */
const ORBS: Orb[] = [
  // top-right — the brief's first named corner, centred off the right edge
  { cx: 292, cy: 46, r: 200, tone: 'cool' },
  // bottom-left — its second, centred off the left edge
  { cx: -12, cy: 556, r: 210, tone: 'warm' },
  // top-left — the quiet third, so the top of the screen isn't lit from one side only
  { cx: 24, cy: 34, r: 132, tone: 'warm' },
];

/**
 * The falloff, as fractions of an orb's radius. This is the blur: a flat disc convolved with a
 * wide Gaussian has a solid core, a long shoulder and no hard edge anywhere, and these four
 * stops are that curve. Alphas are fractions of the palette's `orbOpacity` peak, so the whole
 * field brightens or dims from one number.
 */
/**
 * Which orbs take the screen's hue (2026-08-27, round 20).
 *
 * The two the round 20 mockups name — top-right and bottom-left — and NOT the quiet third. All
 * three would make the whole field one colour, which on the gold To-do tab reads as a tint over
 * the app rather than as light coming from somewhere; two leaves the top-left corner neutral and
 * the hue reads as a direction.
 *
 * ⚠️ **The geometry is `ORBS`', unchanged, and that is load-bearing outside this file.** These
 * are the same discs at the same centres and radii, so every one of them still reaches zero well
 * before the middle of the canvas — which is what `__tests__/glassMaterial.test.ts` depends on
 * when it measures every glass token against a `#000000` ground, and what
 * `lib/__tests__/chromeRhythm.test.ts` §6 checks. Adding a hue must not become adding a disc.
 */
const SCREEN_HUE_ORB_INDEXES = [0, 1] as const;

const ORB_STOPS: { offset: number; alpha: number }[] = [
  { offset: 0, alpha: 1 },
  { offset: 0.3, alpha: 0.82 },
  { offset: 0.62, alpha: 0.34 },
  { offset: 1, alpha: 0 },
];

/**
 * How much each growth tier swells an orb, in viewBox units. Five tiers × 9 = 45 at the cap,
 * i.e. a little over 20% on the large orbs — enough to notice across weeks, nowhere near enough
 * to push a glow into the centre box (see `ORBS`). This is the whole of `level`'s expression:
 * there is no extra orb at a higher tier, because "2 or 3" is the brief's cap and a fourth
 * circle appearing would read as a new element rather than as growth.
 */
const ORB_GROWTH_STEP = 9;

// ─── Per-theme palette ──────────────────────────────────────────────────────────────────────

type Palette = {
  base: [string, string, string]; // vertical base gradient (top → mid → bottom)
  topGlow: string;                // upper-centre focal glow tint (LIGHT only — 0 in DARK)
  topGlowOpacity: number;
  botGlow: string;                // broad bottom glow tint (LIGHT only — 0 in DARK)
  botGlowOpacity: number;
  orbCool: string;                // the cyan orb (neutral — the always-there state)
  orbWarm: string;                // the violet orb (neutral)
  orbGrowth: string;              // both orbs at full growth intensity
  orbOpacity: number;             // peak alpha at an orb's core (the brief's 10-15%)
  /**
   * Peak alpha for the SCREEN-HUE copy of the orb field (2026-08-27, round 20).
   *
   * Deliberately lower than `orbOpacity`: this layer is drawn OVER the neutral pair, so the two
   * add, and the neutral pair is what the app's whole contrast story is measured against. Round
   * 20's mockups lit the backdrop far harder — enough to take three of the five identity hues
   * under AA when a card composited over it (see DESIGN_COMPARISON/20-MEASUREMENTS.md §6) — and
   * the maintainer's ruling was to keep five hues and dim the wash. This is that dimming.
   */
  orbScreenOpacity: number;
};

// The growth green sits in the same hue family as constants/colors.ts's `good` (#177E56,
// h≈162) so the reward reads as the app's existing "positive", but muted the same way the two
// neutral orbs are — it is scenery behind content, not a status colour on text.
const LIGHT: Palette = {
  base: ['#f7faff', '#eef3fc', '#e4ecfb'],
  topGlow: 'rgb(150,190,255)', topGlowOpacity: 0.28,
  botGlow: 'rgb(120,165,255)', botGlowOpacity: 0.22,
  // Lifted, not darkened. On a pale blue field a "deeply muted dark" orb is a dirty smudge, so
  // light takes the same two hues at a lightness that sits ON its field — a cyan and a violet
  // in the same register as the two glows above — and at the bottom of the brief's alpha range,
  // since light mode has far less headroom before an ambient wash starts competing with a card.
  orbCool: '#4FB6C4', orbWarm: '#9E7BD6',
  orbGrowth: '#5FB899',
  orbOpacity: 0.1,
  // Light has far less headroom before an ambient wash competes with a card, so the hue layer
  // is barely there — it says which screen you are on, it does not light anything.
  orbScreenOpacity: 0.05,
};

// ⚠️ TRUE BLACK, and this block is still the reason `theme.bg` alone was never enough. This
// gradient is painted over the page background on every screen that isn't `plainBackground`, so
// whatever it says IS dark mode, regardless of the palette. All three base stops are #000000 and
// both legacy radial glows stay OFF: a full-canvas radial lift on pure black is precisely what
// destroys the OLED benefit (an unlit pixel draws no power and gives infinite local contrast),
// and a faint one reads as screen-uniformity haze rather than as decoration.
//
// **The orbs are not a reversal of that** — they are the reason it can hold. A glow that stays in
// a corner leaves the middle of the screen, where every card and every line of text sits, at a
// true zero; the two ellipses above could not, which is why they were switched off rather than
// dimmed and why they stay off. Read `ORBS` for the arithmetic that keeps it true.
//
// The two hues are `IDENTITY_HUES.habits` (#05D9E8 cyan) and `IDENTITY_HUES.notes` (#B45CFF
// violet) taken a long way down toward black — the brief's "deeply muted, dark versions of our
// neon palette". They are hand-picked rather than computed from those tokens on purpose: this is
// scenery, it must not move when a categorical hue is recalibrated, and an identity hue is a
// SIGNAL that means "this is Habits" everywhere it appears at strength. At the 0.13 peak (down
// from 0.14, see the ⚠️ note just below) these composite to roughly #021012 and #0C0612 over
// black — visible on an OLED panel, well below anything that could be mistaken for a card.
//
// ⚠️ **0.13, not 0.14 (2026-08-26, DESIGN_COMPARISON/19 phase 2, "the glow budget").** The
// prototype's own CSS measures the two corner orbs at 13%/12% respectively — a single scalar
// here can't split them by orb, so 0.13 is the midpoint, still inside the brief's 10–15% range
// and the same direction of travel the phase asks for across the whole file: nothing that is
// text, a border or a background gets to glow, and an always-on ambient field is the closest
// thing this file has to a "background", so it takes the gentler end of its own range rather
// than the brighter one. LIGHT is untouched — its 0.10 already sits below this band.
const DARK: Palette = {
  base: ['#000000', '#000000', '#000000'],
  topGlow: 'rgb(90,150,255)', topGlowOpacity: 0,
  botGlow: 'rgb(60,120,255)', botGlowOpacity: 0,
  orbCool: '#0E7C8C', orbWarm: '#5B2E8C',
  orbGrowth: '#1E7A5E',
  orbOpacity: 0.13,
  orbScreenOpacity: 0.09,
};

/**
 * The stop list for one orb colour. A plain function returning an ARRAY, not a component
 * returning a fragment: react-native-svg types a gradient's children as `ReactElement[]`, so a
 * `<Fragment>` in that slot is a type error (and, on some versions, silently drops the stops).
 * Split out because the neutral pair and the growth copy all use the identical curve — the only
 * thing that differs between the three defs is the colour.
 */
function orbStops(color: string, peak: number) {
  return ORB_STOPS.map((s) => (
    <Stop key={s.offset} offset={s.offset} stopColor={color} stopOpacity={peak * s.alpha} />
  ));
}

/**
 * One full copy of the orb field — all three discs at their current growth radius — filled from
 * the given gradient ids. Rendered twice by ScreenBackground (neutral underneath, growth-green on
 * top at `intensity`) so the tint is an opacity crossfade rather than an animated colour; see this
 * file's edit notes.
 *
 * `cool`/`warm` take a gradient id each, which is what lets the growth copy paint all three orbs
 * in one colour while the neutral copy paints two.
 */
function OrbField({ cool, warm, level }: { cool: string; warm: string; level: number }) {
  const grow = level * ORB_GROWTH_STEP;
  return (
    <>
      {ORBS.map((o, i) => (
        <Circle
          key={i}
          cx={o.cx}
          cy={o.cy}
          r={o.r + grow}
          fill={`url(#${o.tone === 'cool' ? cool : warm})`}
        />
      ))}
    </>
  );
}

/** The screen-hue copy: the same discs as `OrbField`, but only the two `SCREEN_HUE_ORB_INDEXES`
 *  names, all filled from one gradient. */
function ScreenHueField({ gradient, level }: { gradient: string; level: number }) {
  const grow = level * ORB_GROWTH_STEP;
  return (
    <>
      {SCREEN_HUE_ORB_INDEXES.map((i) => (
        <Circle key={i} cx={ORBS[i].cx} cy={ORBS[i].cy} r={ORBS[i].r + grow} fill={`url(#${gradient})`} />
      ))}
    </>
  );
}

function ScreenBackground({ activeRoute }: Props) {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const { level, intensity } = useGrowth();
  // See the gate at the orb field below. Read unconditionally (a hook cannot sit behind a
  // branch) and cheap for anyone who never turns it on.
  const reduceEffects = useSettingsStore((st) => st.reduceEffects);
  const p = isDark ? DARK : LIGHT;

  // The green copy's opacity, which IS `intensity` — the peak alpha lives in the gradient stops
  // now, so both copies are drawn at the same strength and the crossfade is a plain 0→1. (It used
  // to be `intensity * branchOpacity`, because the neutral copy sat inside a `<G opacity>` the
  // green one had to match.) Starts at its real value so a cold launch shows the earned tint
  // immediately instead of fading up into it every time the app opens.
  const tint = useSharedValue(intensity);

  useEffect(() => {
    tint.value = reducedMotion
      ? intensity
      : withTiming(intensity, { duration: Duration.ambient, easing: Ease.move });
  }, [intensity, reducedMotion, tint]);

  const tintProps = useAnimatedProps(() => ({ opacity: tint.value }));

  /**
   * The screen-hue field, double-buffered (2026-08-27, round 20).
   *
   * Two gradient defs, A and B, and a shared value crossfading between them. A tab change writes
   * the incoming hue into whichever buffer is currently hidden and then animates across — the
   * standard double-buffer, and the reason it is needed here rather than just animating a colour
   * is that `react-native-svg` gives no reliable animated `stopColor` on both platforms, so the
   * thing that animates has to be an opacity.
   *
   * The pager mounts ONE background for all five tabs and it does not slide, so without the
   * crossfade a swipe would pop the whole field from gold to green mid-gesture.
   */
  const theme = useAppTheme();
  const screenKey = activeRoute ? ROUTE_HUE[activeRoute] : undefined;
  const screenHue = screenKey ? getScreenColor(theme, screenKey).base : null;
  const [buffers, setBuffers] = useState<[string | null, string | null]>([screenHue, null]);
  const [showB, setShowB] = useState(false);
  const cross = useSharedValue(0);
  useEffect(() => {
    const current = showB ? buffers[1] : buffers[0];
    if (screenHue === current) return;
    // Write into the hidden buffer, then cross to it. Both halves in one effect so a rapid swipe
    // cannot leave the visible buffer holding a colour nothing is animating toward.
    setBuffers((prev) => (showB ? [screenHue, prev[1]] : [prev[0], screenHue]));
    const next = !showB;
    setShowB(next);
    cross.value = reducedMotion
      ? (next ? 1 : 0)
      : withTiming(next ? 1 : 0, { duration: Duration.ambient, easing: Ease.move });
  }, [screenHue, showB, buffers, cross, reducedMotion]);
  const hueAProps = useAnimatedProps(() => ({ opacity: 1 - cross.value }));
  const hueBProps = useAnimatedProps(() => ({ opacity: cross.value }));

  // ── The base layer left the SVG (2026-08-29, the GPU pass) ──────────────────────────────
  //
  // The maintainer's HWUI trace settled that this app is GPU-bound, and this file is its single
  // largest FIXED per-frame cost: a full-screen SVG inside a layer that TRANSLATES with the
  // pager while two of its groups cross-fade. #652 added `reduceEffects` to drop the orb field,
  // and the report came back "improved, but not enough" — because THREE full-canvas gradient
  // Rects survived that switch and were being painted on every screen regardless.
  //
  // What they were actually drawing on the DEFAULT theme is the point: dark's `base` is three
  // identical `#000000` stops (a gradient from black to black to black) and both glow opacities
  // are **0**. So the app was rasterising one pointless gradient shader and two fully
  // transparent full-screen rects, in SVG, on every frame of every swipe.
  //
  //   · when the three base stops are EQUAL — which is dark, the default theme — the "gradient"
  //     is a flat fill, and it is drawn as a plain `View` with a `backgroundColor`. No shader,
  //     no SVG, no rect.
  //   · the two glows are RADIAL, which has no native equivalent, so they stay SVG — but they
  //     are only rendered when their opacity is non-zero, i.e. never in dark.
  //   · the `<Svg>` itself is only mounted when something inside it will actually draw. In dark
  //     with `reduceEffects` on, that is nothing: the whole canvas is gone.
  //
  // ⚠️ **LIGHT MODE'S BASE DELIBERATELY STAYS IN SVG, and this is a measured refusal, not an
  // oversight.** The first cut drew it with `expo-linear-gradient` and `npm run visual` failed on
  // the three Settings screens — ~46–51k pixels differing across the whole content area, from the
  // first row of content down, reproducibly across two runs. A native gradient fills its own box
  // where the SVG is a 280×607 viewBox scaled to COVER (`preserveAspectRatio="slice"`), so the
  // stops land at different heights, and every translucent glass card composited over it shifts a
  // value or two. The visible cost of getting that wrong is spread across every card on the
  // screen, which is exactly the kind of change that ships unnoticed.
  //
  // So the win is taken only where it is provably free: a flat fill is a flat fill at any size.
  // Dark is the default theme, so that is most users, and it is also the mode the whole
  // OLED/glass design is tuned for. Light keeps one SVG rect.
  const glowsVisible = p.topGlowOpacity > 0 || p.botGlowOpacity > 0;
  const flatBase = p.base[0] === p.base[1] && p.base[1] === p.base[2];
  const svgHasContent = glowsVisible || !flatBase || !reduceEffects;

  return (
    <>
      {/* `zIndex: -1` is the fix for "the background renders on top of the bottom navigation" —
          see instruction 1 in this file's header. It is deliberately on the component rather than
          left to each caller: there are three of them and a fourth would inherit the bug. BOTH
          layers carry it, and the base is written first so it sits under the orbs — among
          siblings sharing one z, document order decides. */}
      {flatBase && <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: p.base[0] }]} />}
      {svgHasContent && (
    <Svg
      pointerEvents="none"
      style={styles.backdrop}
      viewBox="0 0 280 607"
      // Scale the 280×607 canvas to COVER the real screen: a corner orb tucks further off-screen
      // on non-phone aspect ratios instead of stretching into an ellipse.
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="sbBase" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.base[0]} />
          <Stop offset="0.55" stopColor={p.base[1]} />
          <Stop offset="1" stopColor={p.base[2]} />
        </LinearGradient>
        {/* Upper-centre focal glow (mock: 60%×42% ellipse at 50%/38%). LIGHT only — DARK holds
            both of these at opacity 0; see the ⚠️ block above the DARK palette. */}
        <RadialGradient id="sbTopGlow" cx="50%" cy="38%" rx="62%" ry="44%">
          <Stop offset="0" stopColor={p.topGlow} stopOpacity={p.topGlowOpacity} />
          <Stop offset="0.62" stopColor={p.topGlow} stopOpacity={p.topGlowOpacity * 0.36} />
          <Stop offset="1" stopColor={p.topGlow} stopOpacity="0" />
        </RadialGradient>
        {/* Broad bottom glow, centred just below the screen (mock: 120%×60% at 50%/118%). */}
        <RadialGradient id="sbBotGlow" cx="50%" cy="112%" rx="95%" ry="52%">
          <Stop offset="0" stopColor={p.botGlow} stopOpacity={p.botGlowOpacity} />
          <Stop offset="1" stopColor={p.botGlow} stopOpacity="0" />
        </RadialGradient>
        {/* The three orb gradients. Default (objectBoundingBox) units, so each is relative to the
            circle it fills — one def per COLOUR serves any number of orbs at any size. */}
        <RadialGradient id="sbOrbCool" cx="50%" cy="50%" r="50%">
          {orbStops(p.orbCool, p.orbOpacity)}
        </RadialGradient>
        <RadialGradient id="sbOrbWarm" cx="50%" cy="50%" r="50%">
          {orbStops(p.orbWarm, p.orbOpacity)}
        </RadialGradient>
        <RadialGradient id="sbOrbGrowth" cx="50%" cy="50%" r="50%">
          {orbStops(p.orbGrowth, p.orbOpacity)}
        </RadialGradient>
        {/* The two screen-hue buffers. Drawn at `orbScreenOpacity`, which is lower than the
            neutral peak because this layer sits OVER that one and the two add. */}
        <RadialGradient id="sbOrbHueA" cx="50%" cy="50%" r="50%">
          {orbStops(buffers[0] ?? p.orbCool, buffers[0] ? p.orbScreenOpacity : 0)}
        </RadialGradient>
        <RadialGradient id="sbOrbHueB" cx="50%" cy="50%" r="50%">
          {orbStops(buffers[1] ?? p.orbCool, buffers[1] ? p.orbScreenOpacity : 0)}
        </RadialGradient>
      </Defs>

      {/* Drawn only where the base is a REAL gradient (light). In dark all three stops are
          `#000000`, so this rect was a gradient shader painting a flat black — a native View
          above does it for free. See the block above the return. */}
      {!flatBase && <Rect x="0" y="0" width="280" height="607" fill="url(#sbBase)" />}
      {/* These two are radial and have no native equivalent, so they stay — but only where they
          draw anything at all: both are opacity 0 in dark, which is the default theme, so this is
          two full-canvas paints removed from every frame for most users. */}
      {glowsVisible && (
        <>
          <Rect x="0" y="0" width="280" height="607" fill="url(#sbTopGlow)" />
          <Rect x="0" y="0" width="280" height="607" fill="url(#sbBotGlow)" />
        </>
      )}

      {/* ── "Reduce visual effects" drops the whole orb field (2026-08-29) ────────────────
          This SVG is the app's single largest fixed per-frame GPU cost, and unlike a card it is
          paid on every screen whether or not anything is on it: 3 full-canvas gradient Rects
          plus THIRTEEN gradient-filled shapes, inside a layer that TRANSLATES with the pager
          while two of its groups CROSS-FADE — so during a swipe, the one gesture the user
          reported, the whole thing re-renders every frame while also moving.
            The base gradient Rects stay: they are the page's colour, not an effect, and
          removing them would leave a bare `theme.bg`. What goes is the decorative field —
          the orbs, the screen hue and the growth tint. Growth going with it is the honest
          consequence and is stated in lib/growth.ts's terms: the backdrop IS the reward
          surface, so a user who turns effects off is choosing not to see it. Nothing is
          un-earned — `lifetimeGrowth` keeps accruing (see lib/useGrowth.ts). */}
      {reduceEffects ? null : (
        <>
      <G>
        <OrbField cool="sbOrbCool" warm="sbOrbWarm" level={level} />
      </G>
      {/* The screen's own hue, over the neutral pair and UNDER the growth tint — growth is the
          thing the user earned and stays the top note. Only two of the three discs take it; see
          SCREEN_HUE_ORB_INDEXES. */}
      <AnimatedG animatedProps={hueAProps}>
        <ScreenHueField gradient="sbOrbHueA" level={level} />
      </AnimatedG>
      <AnimatedG animatedProps={hueBProps}>
        <ScreenHueField gradient="sbOrbHueB" level={level} />
      </AnimatedG>
      <AnimatedG animatedProps={tintProps}>
        <OrbField cool="sbOrbGrowth" warm="sbOrbGrowth" level={level} />
      </AnimatedG>
        </>
      )}
    </Svg>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Spelled out rather than spread from `StyleSheet.absoluteFill` — that export is a registered
  // style ID, not an object, so it can only be COMBINED with (in an array), never merged into,
  // a style carrying a z. One object keeps the fill and the layer as a single declaration.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // The absolute bottom layer. Every container this mounts into has at least one sibling that
    // declares a z (ScreenScaffold's header/sticky/bottom blocks at 99–100, the pager layout's
    // nav overlay at 100), and once any sibling declares one, Android sorts the whole group
    // instead of drawing it in document order. Saying -1 out loud means no future sibling — and
    // no reordering of the JSX — can lift the backdrop over the chrome or the content again.
    zIndex: -1,
  },
});

// Memoised: mounted behind the tabs pager, takes no meaningful props, but its parent re-renders on
// every tab change (it tracks the active route to cross-fade the hero). Without memo that reconciles
// this whole SVG each swipe boundary. useIsDark still re-renders it on a real theme change.
export default React.memo(ScreenBackground);
