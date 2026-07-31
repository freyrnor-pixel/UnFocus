/**
 * ScreenBackground.tsx — the app's ambient backdrop behind a screen's content.
 *
 * Three stacked layers, back to front:
 *
 *   1. **The colour field** — a soft blue vertical gradient plus two radial glows (an
 *      upper-centre focal glow and a broad bottom glow). Unchanged since the 2026-07-19
 *      "abstract branch" pass; this is the app's identity colour.
 *   2. **The tree** — the decorative motif art from constants/motifs.ts (2026-07-31, replacing
 *      the hand-authored corner branch clusters that used to live in this file). Two shapes:
 *        • Behind the tab pager, `screen-bg-strip` — the FIVE tab backdrops authored as one
 *          continuous 1950×844 run and SLID with the pager, so the branch never breaks at a
 *          seam and swiping reads as travelling along one tree. Pass `panelPosition` (the
 *          pager's live 0..4 node) to get this.
 *        • Everywhere else, `screen-bg-calm` — the standalone backdrop for sub-tier and
 *          non-pager screens, which have nothing to be continuous with.
 *      Both keep clear of the centre box (x 84–306, y 236–612 per 390-wide panel) where cards
 *      and content live. See constants/motifs.ts and scripts/author-screen-bgs.mjs.
 *   3. **The reward** — the growth cluster (lib/growth.ts), drawn on top and described below.
 *
 * **It is the app's reward surface (2026-07-31, lib/growth.ts).** It replaced the
 * one-day-old Bonsai/points card, and the whole point of moving the reward here is that it
 * shows NO NUMBER — the user never sees a streak count, a total or a level:
 *   - **Border branch growth.** GROWTH_STROKES adds branches around the border as `level`
 *     rises, driven by a high-water mark, so branches that grew stay grown — nothing here
 *     can un-grow.
 *   - **A positive tint.** The cluster crossfades from the neutral blue toward green as
 *     `intensity` rises, and back to neutral as it fades. Neutral is the floor: a lapsed
 *     streak returns the app to exactly the backdrop it always had, never to a worse-looking
 *     one. Same floor-at-neutral shape as lib/goalStrength.ts.
 * Both are gated on settings.showGrowth (off by default) via lib/useGrowth.ts, which returns
 * a flat 0/0 when the feature is off — i.e. the field and the tree, and nothing else.
 *
 * Connections:
 *   Imports → react-native-reanimated, react-native-svg, components/Motif,
 *             lib/useAppTheme (useIsDark, useAccessibility), lib/useGrowth,
 *             constants/motifs, constants/motion (Duration, Ease)
 *   Used by → app/(tabs)/_layout.tsx (one shared instance behind the whole pager, which is
 *             the only caller that passes `panelPosition`); components/ScreenScaffold (its
 *             own first child, for sub-tier and non-pager site screens)
 *   Data    → via lib/useGrowth: tasks + habits + habit_logs, settings.showGrowth/lifetimeGrowth
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the screen's
 *     SafeAreaView/ScrollView be transparent on top of it.
 *   - **`panelPosition` is what selects the strip.** Supplying it says "I am the tab pager
 *     and here is my live scroll position"; omitting it says "I am a single screen". There is
 *     deliberately no boolean variant prop — the two facts are the same fact.
 *   - `activeRoute` remains accepted for call-site compatibility and is still unused: which
 *     panel you see is a function of `panelPosition`, so the route name would be a second,
 *     staler source of truth for the same thing.
 *   - The growth cluster keeps its ORIGINAL 280×607 viewBox in its own <Svg>, deliberately
 *     NOT rescaled into the motif art's 390×844 space. Its tiers were hand-tuned against
 *     those coordinates, and stacking two `slice`-fitted SVGs aligns them proportionally
 *     anyway — so rescaling would risk retuning the reward for no visible gain.
 *   - Growth leaves are brush-daub ellipses, not plain circles, to match the motif
 *     vocabulary (`decorativemotifs.md`: "don't reintroduce plain circles"). Geometry only —
 *     tiers, the high-water mark and "never un-grow" are untouched.
 *   - Branch/leaf palette and the whole-cluster opacity are theme-keyed (branches read
 *     stronger against the darker dark-mode field), as are the glow strengths.
 *   - Keep the growth cluster wrapped in its own <G opacity> so lowering its presence never
 *     dims the base gradient/glows.
 *   - **The tint is a two-copy opacity crossfade, not an animated colour.** The cluster is
 *     drawn twice — neutral underneath, green on top at `intensity` — because opacity is the
 *     one SVG prop that is reliably animatable through Reanimated on both native and the web
 *     preview. Don't "simplify" this into an animated `stroke`/`fill` without testing both.
 *   - **Only the tint animates.** A level change adds branches with no transition, which is
 *     fine because `level` is derived from a streak that turns over between app sessions —
 *     you will effectively never watch one appear. Don't add per-tier reveal animation for a
 *     frame nobody sees.
 *   - Adding a growth stroke: keep it out of the centre box (roughly x 60–220, y 170–440 in
 *     the growth layer's own 280×607 space) — that is where cards and content live.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions, Animated as RNAnimated } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Ellipse, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useGrowth } from '@/lib/useGrowth';
import { MOTIFS } from '@/constants/motifs';
import Motif from '@/components/Motif';

const AnimatedG = Animated.createAnimatedComponent(G);

/** How many 390-wide panels the tab strip holds — one per tab, in bottom-nav order. */
const STRIP_PANELS = MOTIFS['screen-bg-strip'].w / MOTIFS['screen-bg-calm'].w;

type Props = {
  /** Accepted for call-site compatibility; not used — see this file's edit notes. */
  activeRoute?: string;
  /**
   * The tab pager's live scroll position (0..4). Supplying it draws the continuous five-panel
   * tab strip and slides it to match; omitting it draws the standalone `screen-bg-calm`.
   */
  panelPosition?: RNAnimated.Value | RNAnimated.AnimatedInterpolation<number>;
};

// ─── Growth geometry (lib/growth.ts `level` — 2026-07-31) ──────────────────────────────────
// Branches that grow in around the BORDER as the user's best streak climbs, in this layer's
// own 280×607 space. `tier` is the growth level at which a stroke first appears; everything at
// or below the current level is drawn. Level 1 opens the bottom-right corner — the most
// visible place for a first reward to land. Later tiers work along the left, right, top and
// bottom edges. Nothing enters the centre box (x 60–220, y 170–440) where cards sit.

type GrowthStroke = { tier: number; d: string; w: number };
/** A brush daub: `rot` degrees about its own centre, matching the motif vocabulary. */
type GrowthLeaf = { tier: number; cx: number; cy: number; r: number; rot: number };

const GROWTH_STROKES: GrowthStroke[] = [
  // tier 1 — bottom-right corner opens
  { tier: 1, d: 'M290 545 Q 238 530 208 496', w: 2.8 },
  { tier: 1, d: 'M238 530 Q 246 556 268 566', w: 1.4 },
  // tier 2 — left edge, lower-middle
  { tier: 2, d: 'M-8 430 Q 30 424 52 400', w: 2.2 },
  { tier: 2, d: 'M30 424 Q 26 448 36 466', w: 1.2 },
  // tier 3 — right edge, upper-middle
  { tier: 3, d: 'M288 300 Q 250 292 232 268', w: 2.2 },
  { tier: 3, d: 'M250 292 Q 254 268 244 250', w: 1.2 },
  // tier 4 — top and bottom edges
  { tier: 4, d: 'M118 -8 Q 132 22 162 34', w: 1.6 },
  { tier: 4, d: 'M96 615 Q 118 592 148 588', w: 1.6 },
  // tier 5 — long runs tying the corners along the edges
  { tier: 5, d: 'M-8 120 Q 18 140 30 172', w: 1.4 },
  { tier: 5, d: 'M288 400 Q 268 424 262 452', w: 1.4 },
  { tier: 5, d: 'M208 496 Q 190 520 186 548', w: 1.2 },
];

const GROWTH_LEAVES: GrowthLeaf[] = [
  { tier: 1, cx: 268, cy: 566, r: 4, rot: -18 }, { tier: 1, cx: 208, cy: 495, r: 3.5, rot: 8 },
  { tier: 1, cx: 246, cy: 556, r: 3, rot: -10 },
  { tier: 2, cx: 52, cy: 399, r: 4, rot: 20 }, { tier: 2, cx: 36, cy: 466, r: 3.5, rot: -6 },
  { tier: 3, cx: 232, cy: 267, r: 4, rot: 4 }, { tier: 3, cx: 244, cy: 249, r: 3.5, rot: 15 },
  { tier: 4, cx: 162, cy: 34, r: 3.5, rot: -12 }, { tier: 4, cx: 148, cy: 587, r: 3.5, rot: 10 },
  { tier: 5, cx: 30, cy: 173, r: 3, rot: -4 }, { tier: 5, cx: 262, cy: 453, r: 3, rot: 18 },
  { tier: 5, cx: 186, cy: 549, r: 3, rot: -8 },
];

// ─── Per-theme palette ──────────────────────────────────────────────────────────────────────

type Palette = {
  base: [string, string, string]; // vertical base gradient (top → mid → bottom)
  topGlow: string;                // upper-centre focal glow tint
  topGlowOpacity: number;
  botGlow: string;                // broad bottom glow tint
  botGlowOpacity: number;
  motif: string;                  // the tree motif colour (matches the design system's pair)
  branch: string;                 // growth branch stroke at neutral (the always-there state)
  leaf: string;                   // growth leaf fill at neutral
  growthBranch: string;           // growth branch stroke at full intensity
  growthLeaf: string;             // growth leaf fill at full intensity
  branchOpacity: number;          // whole-cluster opacity (branches read stronger on dark)
};

// The growth greens sit in the same hue family as constants/colors.ts's `good` (#177E56,
// h≈162) so the reward reads as the app's existing "positive", but lighter and less
// saturated than that token — it is scenery behind content, not a status colour on text.
const LIGHT: Palette = {
  base: ['#f7faff', '#eef3fc', '#e4ecfb'],
  topGlow: 'rgb(150,190,255)', topGlowOpacity: 0.28,
  botGlow: 'rgb(120,165,255)', botGlowOpacity: 0.22,
  motif: '#3B82F6',
  branch: '#6f9aff', leaf: '#a9c4ff', branchOpacity: 0.5,
  growthBranch: '#3f9e7a', growthLeaf: '#8ed3b4',
};

const DARK: Palette = {
  base: ['#0b1020', '#0a1330', '#071026'],
  topGlow: 'rgb(90,150,255)', topGlowOpacity: 0.55,
  botGlow: 'rgb(60,120,255)', botGlowOpacity: 0.4,
  motif: '#60A5FA',
  branch: '#3f74ff', leaf: '#7fa8ff', branchOpacity: 0.7,
  growthBranch: '#2f9b74', growthLeaf: '#63c49c',
};

/**
 * One full copy of the growth cluster — every stroke up to `level` — in a single colour pair.
 * Rendered twice by ScreenBackground (neutral underneath, growth-green on top at `intensity`)
 * so the tint is an opacity crossfade rather than an animated colour; see the edit notes.
 */
function Cluster({ branch, leaf, level }: { branch: string; leaf: string; level: number }) {
  return (
    <>
      {GROWTH_STROKES.filter((g) => g.tier <= level).map((g, i) => (
        <Path key={`g${i}`} d={g.d} stroke={branch} strokeWidth={g.w} strokeLinecap="round" fill="none" />
      ))}
      {GROWTH_LEAVES.filter((g) => g.tier <= level).map((g, i) => (
        <Ellipse
          key={`gl${i}`}
          cx={g.cx} cy={g.cy} rx={g.r * 1.7} ry={g.r}
          fill={leaf}
          origin={`${g.cx}, ${g.cy}`}
          rotation={g.rot}
        />
      ))}
    </>
  );
}

function ScreenBackground({ panelPosition }: Props) {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const { level, intensity } = useGrowth();
  const { width } = useWindowDimensions();
  const p = isDark ? DARK : LIGHT;

  // The green copy's opacity. Starts at its real value so a cold launch shows the earned
  // tint immediately instead of fading up into it every time the app opens.
  const tint = useSharedValue(intensity * p.branchOpacity);
  const target = intensity * p.branchOpacity;

  useEffect(() => {
    tint.value = reducedMotion
      ? target
      : withTiming(target, { duration: Duration.ambient, easing: Ease.move });
  }, [target, reducedMotion, tint]);

  const tintProps = useAnimatedProps(() => ({ opacity: tint.value }));

  return (
    <>
      {/* Layer 1 — the colour field. Gradients live in objectBoundingBox space, so the
          viewBox here only has to have the right aspect, not the motif's coordinates. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sbBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.base[0]} />
            <Stop offset="0.55" stopColor={p.base[1]} />
            <Stop offset="1" stopColor={p.base[2]} />
          </LinearGradient>
          {/* Upper-centre focal glow. */}
          <RadialGradient id="sbTopGlow" cx="50%" cy="38%" rx="62%" ry="44%">
            <Stop offset="0" stopColor={p.topGlow} stopOpacity={p.topGlowOpacity} />
            <Stop offset="0.62" stopColor={p.topGlow} stopOpacity={p.topGlowOpacity * 0.36} />
            <Stop offset="1" stopColor={p.topGlow} stopOpacity="0" />
          </RadialGradient>
          {/* Broad bottom glow, centred just below the screen. */}
          <RadialGradient id="sbBotGlow" cx="50%" cy="112%" rx="95%" ry="52%">
            <Stop offset="0" stopColor={p.botGlow} stopOpacity={p.botGlowOpacity} />
            <Stop offset="1" stopColor={p.botGlow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="390" height="844" fill="url(#sbBase)" />
        <Rect x="0" y="0" width="390" height="844" fill="url(#sbTopGlow)" />
        <Rect x="0" y="0" width="390" height="844" fill="url(#sbBotGlow)" />
      </Svg>

      {/* Layer 2 — the tree. Behind the pager this is one continuous strip five screens wide,
          translated so the active panel sits in frame; the branch therefore runs unbroken
          across every swipe instead of being swapped per tab. Elsewhere it's the standalone
          calm backdrop, which has no neighbour to be continuous with. */}
      {panelPosition ? (
        // The clip is load-bearing, not tidiness: the inner layer is FIVE screens wide, and
        // without `overflow: 'hidden'` it paints (and, on web, widens the document) far past
        // the screen edge. React Native does not clip overflow by default.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
          <RNAnimated.View
            pointerEvents="none"
            style={[
              styles.strip,
              {
                width: width * STRIP_PANELS,
                transform: [{ translateX: RNAnimated.multiply(panelPosition, -width) }],
              },
            ]}
          >
            <Motif id="screen-bg-strip" color={p.motif} style={StyleSheet.absoluteFill} fit="slice" />
          </RNAnimated.View>
        </View>
      ) : (
        <Motif id="screen-bg-calm" color={p.motif} style={StyleSheet.absoluteFill} fit="slice" />
      )}

      {/* Layer 3 — the reward, in its own 280×607 space (see edit notes). */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 280 607" preserveAspectRatio="xMidYMid slice">
        <G opacity={p.branchOpacity}>
          <Cluster branch={p.branch} leaf={p.leaf} level={level} />
        </G>
        <AnimatedG animatedProps={tintProps}>
          <Cluster branch={p.growthBranch} leaf={p.growthLeaf} level={level} />
        </AnimatedG>
      </Svg>
    </>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // Pinned top/bottom/left with an explicit width set inline — the width is five screens, so
  // it cannot come from absoluteFill.
  strip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});

// Memoised: mounted behind the tabs pager, takes near-static props, but its parent re-renders on
// every tab change. Without memo that reconciles the whole backdrop each swipe boundary.
// useIsDark still re-renders it on a real theme change.
export default React.memo(ScreenBackground);
