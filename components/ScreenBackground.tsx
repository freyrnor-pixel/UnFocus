/**
 * ScreenBackground.tsx — the app's ambient backdrop behind a screen's content.
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
 * The whole thing is ONE react-native-svg canvas (base linear gradient + two radial glows +
 * branch paths + leaf dots) so it costs a single native view behind the pager — the gradients
 * live in objectBoundingBox space and the branch coordinates live in a 280×607 viewBox scaled to
 * cover the screen (`preserveAspectRatio="xMidYMid slice"`), so corners tuck slightly off-screen
 * on non-phone aspect ratios rather than distorting.
 *
 * Connections:
 *   Imports → lib/useAppTheme (useIsDark)
 *   Used by → app/(tabs)/_layout.tsx (one shared instance behind the whole pager); components/
 *             ScreenScaffold (its own first child, for sub-tier and non-pager site screens)
 *   Data    → —
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
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle, G } from 'react-native-svg';
import { useIsDark } from '@/lib/useAppTheme';

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

type Leaf = { cx: number; cy: number; r: number };

const LEAVES: Leaf[] = [
  // top-left
  { cx: 52, cy: 36, r: 4.5 }, { cx: 128, cy: 25, r: 5 }, { cx: 150, cy: 20, r: 4 },
  { cx: 144, cy: 75, r: 4 }, { cx: 128, cy: -6, r: 3.5 }, { cx: 178, cy: 93, r: 3.5 },
  { cx: 145, cy: 131, r: 4 },
  // top-right
  { cx: 238, cy: 70, r: 4.5 }, { cx: 250, cy: 81, r: 4 }, { cx: 232, cy: 57, r: 3.5 },
  { cx: 176, cy: 127, r: 3.5 }, { cx: 150, cy: 157, r: 4 },
  // bottom-left
  { cx: 42, cy: 565, r: 4.5 }, { cx: 48, cy: 559, r: 4 }, { cx: 62, cy: 575, r: 3.5 },
  { cx: 158, cy: 470, r: 4 }, { cx: 118, cy: 507, r: 3.5 },
];

// ─── Per-theme palette ──────────────────────────────────────────────────────────────────────

type Palette = {
  base: [string, string, string]; // vertical base gradient (top → mid → bottom)
  topGlow: string;                // upper-centre focal glow tint
  topGlowOpacity: number;
  botGlow: string;                // broad bottom glow tint
  botGlowOpacity: number;
  branch: string;                 // branch stroke colour
  leaf: string;                   // leaf fill colour
  branchOpacity: number;          // whole-cluster opacity (branches read stronger on dark)
};

const LIGHT: Palette = {
  base: ['#f7faff', '#eef3fc', '#e4ecfb'],
  topGlow: 'rgb(150,190,255)', topGlowOpacity: 0.28,
  botGlow: 'rgb(120,165,255)', botGlowOpacity: 0.22,
  branch: '#6f9aff', leaf: '#a9c4ff', branchOpacity: 0.5,
};

const DARK: Palette = {
  base: ['#0b1020', '#0a1330', '#071026'],
  topGlow: 'rgb(90,150,255)', topGlowOpacity: 0.55,
  botGlow: 'rgb(60,120,255)', botGlowOpacity: 0.4,
  branch: '#3f74ff', leaf: '#7fa8ff', branchOpacity: 0.7,
};

function ScreenBackground(_props: Props) {
  const isDark = useIsDark();
  const p = isDark ? DARK : LIGHT;

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

      {/* Corner branch-and-leaf accents — own opacity group so dimming them never touches the field. */}
      <G opacity={p.branchOpacity}>
        {BRANCHES.map((b, i) => (
          <Path key={i} d={b.d} stroke={p.branch} strokeWidth={b.w} strokeLinecap="round" fill="none" />
        ))}
        {LEAVES.map((l, i) => (
          <Circle key={i} cx={l.cx} cy={l.cy} r={l.r} fill={p.leaf} />
        ))}
      </G>
    </Svg>
  );
}

// Memoised: mounted behind the tabs pager, takes no meaningful props, but its parent re-renders on
// every tab change (it tracks the active route to cross-fade the hero). Without memo that reconciles
// this whole SVG each swipe boundary. useIsDark still re-renders it on a real theme change.
export default React.memo(ScreenBackground);
