/**
 * BonsaiTree.tsx — procedural SVG bonsai illustration for the Bonsai/points reward system.
 *
 * Purely presentational: renders whatever (stage, health) it's given, no store access. Six
 * growth stages (lib/bonsai.ts's BonsaiStageKey) go from a bare seed to a full asymmetric
 * bonsai silhouette with three branches; each stage's trunk/branch paths and canopy anchor
 * points are hand-placed (STAGE_ART below), while the leaf clusters themselves are generated
 * procedurally per canopy (a golden-angle spiral of overlapping ellipses — canopyEllipses) so
 * "more leaves" doesn't mean hand-placing dozens of ellipses per stage.
 *
 * Foliage colour is the one thing `health` drives — `mix(theme.textMuted, theme.good,
 * health)` — so a well-tended tree reads vividly green and a long-neglected one reads grey,
 * WITHOUT ever changing stage/size: growth (points, permanent) and health (tending, decays
 * and recovers) are deliberately independent, matching lib/bonsai.ts's "no punishment"
 * design — a neglected tree greys, it never shrinks or resets. The seed stage has no
 * foliage to tint, so health is ignored there (nothing to neglect yet).
 *
 * Trunk/pot colours are deliberately fixed hex, not theme tokens — like
 * components/EnergyMeter.tsx's energy-token pip, this is naturalistic plant/clay material,
 * not a UI control, so it doesn't need to track the app's accent/surface palette.
 *
 * Connections:
 *   Imports → lib/bonsai (BonsaiStageKey), constants/theme (mix, darken, lighten)
 *   Used by → components/BonsaiCard.tsx
 *   Data    → none — presentational, props only
 */
import React, { useMemo } from 'react';
import Svg, { Path, Ellipse, Circle } from 'react-native-svg';
import type { BonsaiStageKey } from '@/lib/bonsai';
import { mix, darken, lighten } from '@/constants/theme';

type Props = {
  stage: BonsaiStageKey;
  /** 0 (grey, neglected) .. 1 (vivid, tended) — ignored at the 'seed' stage. */
  health: number;
  /** Tended-and-flourishing accent — small blossom dots, only drawn when health is decent. */
  goodColor: string;
  greyColor: string;
  size?: number;
};

const TRUNK = '#8B5E3C';
const TRUNK_STROKE = darken(TRUNK, 0.35);
const POT = '#B5652E';
const POT_STROKE = darken(POT, 0.3);
const SOIL = darken(TRUNK, 0.5);
const BLOSSOM = '#F0A6C4';

type TrunkPath = { d: string; width: number };
type Canopy = { cx: number; cy: number; count: number; baseR: number; spread: number };

const STAGE_ART: Record<BonsaiStageKey, { trunk: TrunkPath[]; canopies: Canopy[] }> = {
  seed: { trunk: [], canopies: [] },
  sprout: {
    trunk: [{ d: 'M60,96 C60,88 59,82 60,74', width: 3 }],
    canopies: [{ cx: 60, cy: 70, count: 3, baseR: 7, spread: 8 }],
  },
  sapling: {
    trunk: [{ d: 'M60,96 C60,84 57,70 58,56', width: 4 }],
    canopies: [{ cx: 58, cy: 50, count: 5, baseR: 8, spread: 12 }],
  },
  young: {
    trunk: [{ d: 'M60,96 C58,82 66,70 55,52 C51,45 53,38 57,32', width: 5 }],
    canopies: [{ cx: 55, cy: 30, count: 7, baseR: 9, spread: 15 }],
  },
  mature: {
    trunk: [
      { d: 'M60,96 C56,80 68,72 52,54 C44,44 48,32 38,24', width: 7 },
      { d: 'M52,54 C60,50 70,48 80,42', width: 4 },
    ],
    canopies: [
      { cx: 36, cy: 20, count: 9, baseR: 10, spread: 16 },
      { cx: 82, cy: 38, count: 6, baseR: 8, spread: 12 },
    ],
  },
  flourishing: {
    trunk: [
      { d: 'M60,96 C56,80 68,72 52,54 C44,44 48,32 38,24', width: 7 },
      { d: 'M52,54 C60,50 70,48 80,42', width: 4 },
      { d: 'M56,62 C50,66 44,72 34,74', width: 3 },
    ],
    canopies: [
      { cx: 34, cy: 18, count: 12, baseR: 11, spread: 18 },
      { cx: 84, cy: 36, count: 8, baseR: 9, spread: 14 },
      { cx: 30, cy: 70, count: 6, baseR: 8, spread: 12 },
    ],
  },
};

/** A fixed BLOSSOM_OFFSETS list of small accent dots relative to (0,0), only used at the
 *  'flourishing' stage — hand-placed rather than procedural since there are few of them. */
const BLOSSOM_OFFSETS = [
  { dx: -6, dy: -4 }, { dx: 5, dy: -6 }, { dx: -2, dy: 5 },
  { dx: 8, dy: 2 }, { dx: -8, dy: 1 }, { dx: 2, dy: -8 },
];

/** Deterministic "leaf cloud" — a golden-angle spiral of overlapping ellipses around
 *  (cx, cy), flattened vertically so it reads as a canopy silhouette rather than a circle. */
function canopyEllipses(canopy: Canopy): { cx: number; cy: number; rx: number; ry: number }[] {
  const GOLDEN_ANGLE = 137.5 * (Math.PI / 180);
  return Array.from({ length: canopy.count }, (_, i) => {
    const angle = i * GOLDEN_ANGLE;
    const r = canopy.spread * Math.sqrt(i / canopy.count);
    const rx = canopy.baseR * (0.8 + 0.4 * ((i % 3) / 2));
    return {
      cx: canopy.cx + r * Math.cos(angle),
      cy: canopy.cy + r * Math.sin(angle) * 0.6,
      rx,
      ry: rx * 0.72,
    };
  });
}

export default function BonsaiTree({ stage, health, goodColor, greyColor, size = 120 }: Props) {
  const art = STAGE_ART[stage];
  const foliageColor = stage === 'seed' ? greyColor : mix(greyColor, goodColor, health);
  const foliageStroke = darken(foliageColor, 0.18);
  const showBlossoms = stage === 'flourishing' && health > 0.5;

  const canopies = useMemo(
    () => art.canopies.map((c) => ({ anchor: c, leaves: canopyEllipses(c) })),
    // art is a stable lookup keyed by `stage`, so re-deriving only on stage change is correct.
    [stage] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Pot */}
      <Path d="M40,96 L80,96 L76,113 L44,113 Z" fill={POT} stroke={POT_STROKE} strokeWidth={1.5} />
      <Ellipse cx={60} cy={96} rx={20} ry={4} fill={lighten(POT, 0.12)} stroke={POT_STROKE} strokeWidth={1} />
      <Ellipse cx={60} cy={95.5} rx={16} ry={3} fill={SOIL} />

      {/* Seed stage: a small nub of new growth, no trunk yet. */}
      {stage === 'seed' && <Circle cx={60} cy={91} r={4} fill={mix(SOIL, goodColor, 0.5)} />}

      {/* Trunk + branches */}
      {art.trunk.map((t, i) => (
        <Path key={i} d={t.d} fill="none" stroke={TRUNK} strokeWidth={t.width} strokeLinecap="round" />
      ))}
      {art.trunk.map((t, i) => (
        <Path key={`s${i}`} d={t.d} fill="none" stroke={TRUNK_STROKE} strokeWidth={1} strokeOpacity={0.4} />
      ))}

      {/* Foliage — each canopy is a cloud of overlapping ellipses. */}
      {canopies.map(({ leaves }, ci) =>
        leaves.map((leaf, li) => (
          <Ellipse
            key={`${ci}-${li}`}
            cx={leaf.cx}
            cy={leaf.cy}
            rx={leaf.rx}
            ry={leaf.ry}
            fill={foliageColor}
            stroke={foliageStroke}
            strokeWidth={0.75}
          />
        ))
      )}

      {/* Flourishing-only blossom accents, scattered near the top canopy. */}
      {showBlossoms &&
        art.canopies[0] &&
        BLOSSOM_OFFSETS.map((b, i) => (
          <Circle
            key={i}
            cx={art.canopies[0].cx + b.dx}
            cy={art.canopies[0].cy + b.dy}
            r={1.6}
            fill={BLOSSOM}
          />
        ))}
    </Svg>
  );
}
