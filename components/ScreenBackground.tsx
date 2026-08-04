/**
 * ScreenBackground.tsx — the app's ambient backdrop behind a screen's content.
 *
 * **Reverted 2026-07-31** back to this corner-branch design after a same-day detour through
 * a `constants/motifs.ts`-driven continuous five-panel tree strip (`screen-bg-strip`/
 * `screen-bg-calm`, PR #449) — that version didn't read as a settled backdrop while swiping
 * (the strip motion fought the pager's own swipe feel) and is out. `app/(tabs)/_layout.tsx`'s
 * `panelPosition` prop plumbing for it is reverted too; `ScreenBackground` is back to a single
 * static field on every tab, differentiated only by the particle layer
 * (`components/ParticleBackground.tsx`, unaffected by either version) and by growth. The
 * motif system itself (`constants/motifs.ts`, `components/Motif.tsx`) stays — SectionDivider,
 * StarterCard and onboarding still use it — only this file's own consumption of it is undone.
 *
 * **The leaf redraw SHIPPED 2026-08-04** (design comparison task 05, the one door the previous
 * pass left open). The corner leaves were plain filled `<Circle>` dots; they are now filled
 * leaf silhouettes taken from the design system's own `leaf-icon` path — see `leafD()` below —
 * and `GROWTH_LEAVES` was redrawn in the same vocabulary in the same edit, which was the
 * condition attached to taking this on: reward branches drawn as dots growing out of a canopy
 * of leaves would have been two languages in one picture. **Static, one field on every tab, no
 * per-tab variation**, exactly as scoped. Nothing about the growth contract changed — neutral
 * is still the floor, there is still no number and no "you broke it" state, and `intensity` 0
 * is still byte-for-byte the always-there art.
 *
 * **The REST of task 05 stays declined, and that part is not a docs-vs-design tie-break.** The
 * design system ships a per-screen-type backdrop set — `screen-bg-calm` (settings/detail),
 * `screen-bg-grow` (home/hub), `screen-bg-list` (scrollable lists) — held together by an edge
 * continuity rule (every file crosses the left edge at y=660 and the right at y=600) so
 * adjacent screens read as one line. That is out for the same reason PR #449 was reverted, and
 * the continuity rule does not address the reason: the revert was about MOTION, not art. A
 * backdrop that changes or slides per tab fights the pager's own swipe feel; a nicer picture on
 * the same mechanism re-runs a known failure. `screen-bg-strip`/`screen-bg-calm` stay in
 * `constants/motifs.ts` as **retained source art**, generated and tested but deliberately
 * mounted nowhere — a decision, not an oversight. The illustrated tree as a drop-in behind the
 * pager is out with it: `components/StarterCard.tsx` draws a growth-stage tree whenever it is
 * visible and `app/(tabs)/habits.tsx` draws an ambient one (task 03), so "one tree per screen"
 * already spends that budget elsewhere.
 *
 * As of 2026-07-19 this is the "abstract branch" background (maintainer handoff
 * `HANDOFF_ABSTRACT_TREE_BACKGROUND.md`): a soft blue gradient — a vertical base plus two
 * radial glows (upper-centre focal glow + a broad bottom glow) — with tapered branch-and-leaf
 * line accents tucked into the corners (top-left, top-right, bottom-left). The branches are
 * kept in the corners on purpose so nothing sits centre-screen where cards/content live. This
 * replaced the earlier flat neutral `theme.bg` fill (the "remove the background colour" pass);
 * the maintainer's new direction reintroduces a calm blue field as the app's identity, with the
 * branch motif standing in for the old centred watercolour-tree image.
 *
 * **It is also the app's reward surface (2026-07-31, lib/growth.ts).** It replaced the
 * one-day-old Bonsai/points card, and the whole point of moving the reward here is that it
 * shows NO NUMBER — the user never sees a streak count, a total or a level:
 *   - **Border branch growth.** GROWTH_STROKES adds branches around the border (starting with
 *     the bottom-right corner, the one the original art left empty) as `level` rises. Driven
 *     by a high-water mark, so branches that grew stay grown — nothing here can un-grow.
 *   - **A positive tint.** The whole cluster crossfades from the neutral blue toward green as
 *     `intensity` rises, and back to neutral as it fades. Neutral is the floor: a lapsed
 *     streak returns the app to exactly the backdrop it always had, never to a worse-looking
 *     one. Same floor-at-neutral shape as lib/goalStrength.ts.
 * Both are gated on settings.showGrowth (off by default) via lib/useGrowth.ts, which returns
 * a flat 0/0 when the feature is off — i.e. precisely the pre-2026-07-31 art.
 *
 * The whole thing is ONE react-native-svg canvas (base linear gradient + two radial glows +
 * branch paths + leaf dots) so it costs a single native view behind the pager — the gradients
 * live in objectBoundingBox space and the branch coordinates live in a 280×607 viewBox scaled to
 * cover the screen (`preserveAspectRatio="xMidYMid slice"`), so corners tuck slightly off-screen
 * on non-phone aspect ratios rather than distorting.
 *
 * Connections:
 *   Imports → react-native-reanimated, lib/useAppTheme (useIsDark, useAccessibility),
 *             lib/useGrowth, constants/motion (Duration, Ease)
 *   Used by → app/(tabs)/_layout.tsx (one shared instance behind the whole pager); components/
 *             ScreenScaffold (its own first child, for sub-tier and non-pager site screens)
 *   Data    → via lib/useGrowth: tasks + habits + habit_logs, settings.showGrowth/lifetimeGrowth
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the screen's
 *     SafeAreaView/ScrollView be transparent on top of it.
 *   - `activeRoute` is accepted for backwards-compatibility with callers (the pager passes the
 *     active tab) but is not used — the backdrop is the same field on every screen.
 *   - Branch/leaf palette + the whole-cluster opacity are theme-keyed (branches read stronger
 *     against the darker dark-mode field). The glow strengths are likewise per-theme.
 *   - Keep the branches wrapped in their own <G opacity> so lowering their presence never dims
 *     the base gradient/glows.
 *   - **The tint is a two-copy opacity crossfade, not an animated colour.** The cluster is
 *     drawn twice — neutral underneath, green on top at `intensity` — because opacity is the
 *     one SVG prop that is reliably animatable through Reanimated on both native and the web
 *     preview. Don't "simplify" this into an animated `stroke`/`fill` without testing both.
 *   - **Only the tint animates.** A level change adds branches with no transition, which is
 *     fine because `level` is derived from a streak that turns over between app sessions —
 *     you will effectively never watch one appear. Don't add per-tier reveal animation for a
 *     frame nobody sees.
 *   - Adding a growth stroke: keep it out of the centre box (roughly x 60–220, y 170–440) —
 *     that is where cards and content live, and it's the reason the original art is
 *     corners-only.
 *   - `React.memo` no longer buys much now that useGrowth subscribes to the task/habit
 *     stores; the intensity it returns is quantised so a single tick can't repaint the
 *     backdrop for a sub-step change. See lib/useGrowth.ts's edit notes.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useGrowth } from '@/lib/useGrowth';

const AnimatedG = Animated.createAnimatedComponent(G);

type Props = {
  /** Accepted for call-site compatibility (the pager passes the active tab); not used —
   *  the backdrop is a single shared field on every screen. */
  activeRoute?: string;
};

// ─── Branch + leaf geometry (viewBox 0 0 280 607, from the maintainer mock) ────────────────────
// One thicker tapering "main branch" per corner + 2–3 thinner sub-branches; filled circles = leaves.

type Stroke = { d: string; w: number };

const BRANCHES: Stroke[] = [
  // top-left
  { d: 'M-10 20 Q 55 35 85 80 Q 108 115 145 132', w: 3.2 },
  { d: 'M85 80 Q 90 48 122 30 Q 132 24 150 22', w: 1.8 },
  { d: 'M104 96 Q 118 78 145 72', w: 1.4 },
  { d: 'M122 30 Q 118 12 128 -6', w: 1.1 },
  { d: 'M145 132 Q 165 118 178 95', w: 1.1 },
  // top-right
  { d: 'M290 65 Q 225 78 198 118 Q 182 143 150 158', w: 3.2 },
  { d: 'M198 118 Q 212 90 248 82', w: 1.8 },
  { d: 'M222 100 Q 216 78 232 58', w: 1.2 },
  { d: 'M150 158 Q 168 148 176 128', w: 1.1 },
  // bottom-left
  { d: 'M-10 585 Q 65 562 95 518 Q 116 486 158 472', w: 3.2 },
  { d: 'M95 518 Q 82 548 48 560', w: 1.8 },
  { d: 'M70 532 Q 78 552 62 574', w: 1.2 },
  { d: 'M158 472 Q 148 496 118 508', w: 1.1 },
];

/**
 * A leaf. `r` is the radius of the dot this replaced, kept as the size unit so the cluster's
 * visual weight didn't shift when the shape changed; `a` is the rotation in degrees, 0 =
 * pointing straight up.
 */
type Leaf = { cx: number; cy: number; r: number; a: number };

/**
 * The illustrated leaf silhouette, in the design system's own vocabulary — two symmetric
 * quadratic curves from base to tip, taken directly from `leaf-icon`'s path
 * (`M12,20 Q18.9,14.8 12,5 Q5.1,14.8 12,20 Z` in a 24×24 box) and re-expressed in terms of a
 * leaf's length. Normalised: length 15 of that box, control points 6.9 out and 2.3 below
 * centre → half-width 0.46L, control offset 0.153L.
 *
 * Length is 2.6r so a leaf reads at about the mass of the r-radius dot it replaced. The
 * source art also carries a midrib stroke at 0.4 opacity; it is deliberately dropped here —
 * these leaves are 7–13px tall once the 280-wide viewBox is scaled to a phone, where a
 * 0.8-width rib is sub-pixel noise rather than detail.
 */
function leafD(cx: number, cy: number, r: number): string {
  const half = 1.3 * r;      // tip and base, either side of centre
  const wide = 1.196 * r;    // 0.46 × length, the control points' half-width
  const bulge = 0.398 * r;   // 0.153 × length, how far below centre they sit
  return (
    `M${cx},${cy + half} ` +
    `Q${cx + wide},${cy + bulge} ${cx},${cy - half} ` +
    `Q${cx - wide},${cy + bulge} ${cx},${cy + half} Z`
  );
}

// Angles fan each leaf outward from the middle of the screen, so a corner cluster opens into
// its own corner rather than every leaf leaning the same way. Hand-varied around that
// baseline — a canopy of identically-angled marks reads as a pattern, not as foliage.
const LEAVES: Leaf[] = [
  // top-left
  { cx: 52, cy: 36, r: 4.5, a: -35 }, { cx: 128, cy: 25, r: 5, a: -12 }, { cx: 150, cy: 20, r: 4, a: 14 },
  { cx: 144, cy: 75, r: 4, a: 28 }, { cx: 128, cy: -6, r: 3.5, a: -6 }, { cx: 178, cy: 93, r: 3.5, a: 42 },
  { cx: 145, cy: 131, r: 4, a: 24 },
  // top-right
  { cx: 238, cy: 70, r: 4.5, a: 30 }, { cx: 250, cy: 81, r: 4, a: 18 }, { cx: 232, cy: 57, r: 3.5, a: 8 },
  { cx: 176, cy: 127, r: 3.5, a: 46 }, { cx: 150, cy: 157, r: 4, a: 62 },
  // bottom-left
  { cx: 42, cy: 565, r: 4.5, a: -152 }, { cx: 48, cy: 559, r: 4, a: -168 }, { cx: 62, cy: 575, r: 3.5, a: -140 },
  { cx: 158, cy: 470, r: 4, a: 152 }, { cx: 118, cy: 507, r: 3.5, a: 166 },
];

// ─── Growth geometry (lib/growth.ts `level` — 2026-07-31) ──────────────────────────────────
// Branches that grow in around the BORDER as the user's best streak climbs. `tier` is the
// growth level at which a stroke first appears; everything at or below the current level is
// drawn. Level 1 opens the bottom-right corner, which the original three-corner art left
// empty — that hole is the most visible place for the first reward to land. Later tiers work
// along the left, right, top and bottom edges. Nothing enters the centre box (x 60–220,
// y 170–440) where cards sit.

type GrowthStroke = { tier: number; d: string; w: number };
type GrowthLeaf = Leaf & { tier: number };

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

// Same leaf shape and the same outward fan as the base cluster — the reward branches have to
// speak the illustrated vocabulary too, or growth ends up drawn in a different language from
// the art it grows out of. (That is the condition this file's header attached to the redraw.)
const GROWTH_LEAVES: GrowthLeaf[] = [
  { tier: 1, cx: 268, cy: 566, r: 4, a: 148 }, { tier: 1, cx: 208, cy: 495, r: 3.5, a: 168 },
  { tier: 1, cx: 246, cy: 556, r: 3, a: 136 },
  { tier: 2, cx: 52, cy: 399, r: 4, a: -128 }, { tier: 2, cx: 36, cy: 466, r: 3.5, a: -156 },
  { tier: 3, cx: 232, cy: 267, r: 4, a: 62 }, { tier: 3, cx: 244, cy: 249, r: 3.5, a: 78 },
  { tier: 4, cx: 162, cy: 34, r: 3.5, a: 18 }, { tier: 4, cx: 148, cy: 587, r: 3.5, a: 170 },
  { tier: 5, cx: 30, cy: 173, r: 3, a: -48 }, { tier: 5, cx: 262, cy: 453, r: 3, a: 132 },
  { tier: 5, cx: 186, cy: 549, r: 3, a: 160 },
];

// ─── Per-theme palette ──────────────────────────────────────────────────────────────────────

type Palette = {
  base: [string, string, string]; // vertical base gradient (top → mid → bottom)
  topGlow: string;                // upper-centre focal glow tint
  topGlowOpacity: number;
  botGlow: string;                // broad bottom glow tint
  botGlowOpacity: number;
  branch: string;                 // branch stroke colour (neutral — the always-there state)
  leaf: string;                   // leaf fill colour (neutral)
  growthBranch: string;           // branch stroke at full growth intensity
  growthLeaf: string;             // leaf fill at full growth intensity
  branchOpacity: number;          // whole-cluster opacity (branches read stronger on dark)
};

// The growth greens sit in the same hue family as constants/colors.ts's `good` (#177E56,
// h≈162) so the reward reads as the app's existing "positive", but lighter and less
// saturated than that token — it is scenery behind content, not a status colour on text.
const LIGHT: Palette = {
  base: ['#f7faff', '#eef3fc', '#e4ecfb'],
  topGlow: 'rgb(150,190,255)', topGlowOpacity: 0.28,
  botGlow: 'rgb(120,165,255)', botGlowOpacity: 0.22,
  branch: '#6f9aff', leaf: '#a9c4ff', branchOpacity: 0.5,
  growthBranch: '#3f9e7a', growthLeaf: '#8ed3b4',
};

const DARK: Palette = {
  base: ['#0b1020', '#0a1330', '#071026'],
  topGlow: 'rgb(90,150,255)', topGlowOpacity: 0.55,
  botGlow: 'rgb(60,120,255)', botGlowOpacity: 0.4,
  branch: '#3f74ff', leaf: '#7fa8ff', branchOpacity: 0.7,
  growthBranch: '#2f9b74', growthLeaf: '#63c49c',
};

/**
 * One full copy of the branch cluster — the original corner art plus every growth stroke up
 * to `level` — in a single colour pair. Rendered twice by ScreenBackground (neutral
 * underneath, growth-green on top at `intensity`) so the tint is an opacity crossfade rather
 * than an animated colour; see this file's edit notes.
 */
function Cluster({ branch, leaf, level }: { branch: string; leaf: string; level: number }) {
  return (
    <>
      {BRANCHES.map((b, i) => (
        <Path key={`b${i}`} d={b.d} stroke={branch} strokeWidth={b.w} strokeLinecap="round" fill="none" />
      ))}
      {GROWTH_STROKES.filter((g) => g.tier <= level).map((g, i) => (
        <Path key={`g${i}`} d={g.d} stroke={branch} strokeWidth={g.w} strokeLinecap="round" fill="none" />
      ))}
      {/* Filled leaf silhouettes, rotated about their own centre — same `rotation`/`origin`
          pair components/Motif.tsx uses for the canopy ellipses, which is the shape of
          transform react-native-svg handles identically on native and in the web preview.
          Still a plain `fill`, so the two-copy tint crossfade below is unaffected. */}
      {LEAVES.map((l, i) => (
        <Path key={`l${i}`} d={leafD(l.cx, l.cy, l.r)} fill={leaf} rotation={l.a} origin={`${l.cx}, ${l.cy}`} />
      ))}
      {GROWTH_LEAVES.filter((g) => g.tier <= level).map((g, i) => (
        <Path key={`gl${i}`} d={leafD(g.cx, g.cy, g.r)} fill={leaf} rotation={g.a} origin={`${g.cx}, ${g.cy}`} />
      ))}
    </>
  );
}

function ScreenBackground(_props: Props) {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const { level, intensity } = useGrowth();
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
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 280 607"
      // Scale the 280×607 mock canvas to COVER the real screen: the corner branches tuck slightly
      // off-screen on non-phone aspect ratios instead of stretching/distorting.
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="sbBase" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.base[0]} />
          <Stop offset="0.55" stopColor={p.base[1]} />
          <Stop offset="1" stopColor={p.base[2]} />
        </LinearGradient>
        {/* Upper-centre focal glow (mock: 60%×42% ellipse at 50%/38%). */}
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
      </Defs>

      <Rect x="0" y="0" width="280" height="607" fill="url(#sbBase)" />
      <Rect x="0" y="0" width="280" height="607" fill="url(#sbTopGlow)" />
      <Rect x="0" y="0" width="280" height="607" fill="url(#sbBotGlow)" />

      {/* Corner branch-and-leaf accents — own opacity group so dimming them never touches the
          field. This neutral copy is always at full cluster opacity; the growth tint is the
          green copy fading in over it, so intensity 0 leaves exactly the original art. */}
      <G opacity={p.branchOpacity}>
        <Cluster branch={p.branch} leaf={p.leaf} level={level} />
      </G>
      <AnimatedG animatedProps={tintProps}>
        <Cluster branch={p.growthBranch} leaf={p.growthLeaf} level={level} />
      </AnimatedG>
    </Svg>
  );
}

// Memoised: mounted behind the tabs pager, takes no meaningful props, but its parent re-renders on
// every tab change (it tracks the active route to cross-fade the hero). Without memo that reconciles
// this whole SVG each swipe boundary. useIsDark still re-renders it on a real theme change.
export default React.memo(ScreenBackground);
