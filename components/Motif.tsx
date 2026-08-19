/**
 * Motif.tsx — the one renderer for the decorative tree motifs in constants/motifs.ts.
 *
 * The motif geometry is stored without any colour (see constants/motifs.ts's header): every
 * `-light`/`-dark` SVG pair the design system ships is geometrically identical and differs
 * only in a single hex and in per-element opacity. So this component takes the colour as a
 * prop — a theme token from the caller — and picks the light or dark opacity per element.
 * That is what keeps raw hex out of components and lets the same geometry be tinted per tab
 * from lib/screenColor.ts without a second copy of the art.
 *
 * Connections:
 *   Imports → react-native-svg, constants/motifs, lib/useAppTheme (useIsDark)
 *   Used by → components/StageTree.tsx (the four
 *             tree-natural-* growth stages — and through it components/StarterCard.tsx and
 *             app/habits.tsx), components/TourSpotlight.tsx (halo-ring),
 *             app/onboarding/_layout.tsx (onboarding-triptych), components/HomeHabitsCard.tsx
 *             (leaf-icon corner accent, DESIGN_COMPARISON/04 option (b)),
 *             components/HabitLeading.tsx (leaf-icon as a habit row's leading mark,
 *             DESIGN_COMPARISON/04 option (a))
 *             — NOT components/ScreenBackground.tsx, which draws its own geometry directly and
 *             has never imported this (that line claimed the tab strip + calm backdrop until
 *             2026-08-04; both were reverted in PR #449 and this file's mount went with them),
 *             and NOT components/EnergyMeter.tsx, which an earlier version of this line credited
 *             with `halo-ring` — the real halo-ring caller is components/TourSpotlight.tsx:211.
 *   Data    → none — pure presentation
 *
 * Edit notes:
 *   - Always decorative: `pointerEvents="none"` is hard-coded, same contract as
 *     components/TreeWatermark.tsx. A motif must never eat a tap.
 *   - `fit` maps to SVG's preserveAspectRatio. Default 'slice' COVERS the box (edges tuck
 *     off-frame rather than distorting) — the right default for a full-bleed backdrop.
 *     Pass 'meet' for an inline mark that has to stay whole, like the divider or the
 *     empty-state branch.
 *   - `opacity` is a whole-motif multiplier layered on top of each element's own baked
 *     opacity. Use it to push a motif further back; don't use it to fix a motif that is too
 *     strong at source — change the SVG and regenerate, so every consumer benefits.
 *   - The generated data already encodes the design system's opacity budget (fills 0.1–0.3,
 *     strokes 0.4–0.85). Multiplying above 1 breaks it — the prop is clamped for that reason.
 *   - Rotated canopy ellipses carry `rot` in degrees about their OWN centre; that is how every
 *     delivered file is authored, so the transform origin never needs to be passed in.
 */
import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { MOTIFS, type MotifId } from '@/constants/motifs';
import { useIsDark } from '@/lib/useAppTheme';

type Props = {
  /** Which motif to draw. */
  id: MotifId;
  /**
   * Stroke/fill colour — a theme token, for the TINTABLE motifs, which carry no colour of
   * their own. Ignored by an illustration (one with its own `pal`), whose colours are its
   * own artwork; pass anything, or nothing, for those.
   */
  color?: string;
  /** Whole-motif opacity multiplier, clamped to [0,1]. Default 1. */
  opacity?: number;
  /** 'slice' covers the box (default, for backdrops); 'meet' fits it whole (inline marks). */
  fit?: 'slice' | 'meet';
  /** Override the viewBox — used to show one panel of a multi-panel strip. */
  viewBox?: string;
  style?: StyleProp<ViewStyle>;
};

function Motif({ id, color, opacity = 1, fit = 'slice', viewBox, style }: Props) {
  const isDark = useIsDark();
  const motif = MOTIFS[id];
  const group = Math.max(0, Math.min(1, opacity));
  const pal = motif.pal ? (isDark ? motif.pal.dark : motif.pal.light) : undefined;

  /**
   * An illustration paints from its own palette; a tintable motif takes the caller's token.
   * The `?? color` fallback matters: an element whose palette index somehow didn't resolve
   * draws in the caller's colour rather than vanishing into `undefined`.
   */
  const ink = (e: { c?: number }) => (pal && e.c !== undefined ? pal[e.c] ?? color : color);

  return (
    <Svg
      pointerEvents="none"
      style={style}
      viewBox={viewBox ?? `0 0 ${motif.w} ${motif.h}`}
      preserveAspectRatio={`xMidYMid ${fit}`}
    >
      <G opacity={group}>
        {motif.els.map((e, i) => {
          const o = isDark ? e.od : e.o;
          if (e.t === 'p') {
            // A filled path is a leaf or a slab of bark; a stroked one is a trunk/branch line.
            // Drawing the former with `fill="none"` — which this did before the illustrated
            // set landed — reduces every leaf to an invisible 1px hairline.
            return e.fill ? (
              <Path key={i} d={e.d} fill={ink(e)} opacity={o} />
            ) : (
              <Path key={i} d={e.d} stroke={ink(e)} strokeWidth={e.w} strokeLinecap="round" fill="none" opacity={o} />
            );
          }
          if (e.t === 'e') {
            return (
              <Ellipse
                key={i}
                cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry}
                fill={ink(e)} opacity={o}
                origin={`${e.cx}, ${e.cy}`}
                rotation={e.rot}
              />
            );
          }
          // A ring is stroked and unfilled; wash and dot are filled.
          return e.role === 'ring' ? (
            <Circle key={i} cx={e.cx} cy={e.cy} r={e.r} stroke={ink(e)} strokeWidth={e.w} fill="none" opacity={o} />
          ) : (
            <Circle key={i} cx={e.cx} cy={e.cy} r={e.r} fill={ink(e)} opacity={o} />
          );
        })}
      </G>
    </Svg>
  );
}

// Memoised: these sit behind live content and their props are primitives that rarely change,
// but their parents (ScreenBackground, list cards) re-render often.
export default React.memo(Motif);
