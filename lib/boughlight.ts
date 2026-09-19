/**
 * boughlight.ts — the geometry and strength values for the "canopy × halo" backdrop, plus the
 * containment predicate that makes the whole layer safe to ship.
 *
 * Split out of `components/BoughlightBackdrop.tsx` for one reason: the claim that justifies
 * drawing line art in this app again is *"it never enters the card column"*, and a claim like
 * that has to be ARITHMETIC a test can run, not a sentence in a header. Everything here is pure
 * data and pure functions; the component imports it and draws it.
 *
 * Coordinates are the handoff's own 390×844 frame, copied verbatim from `Backdrop_Handoff`
 * (2026-09-19) so a placement can be diffed against the brief without re-deriving it.
 *
 * Connections:
 *   Imports → nothing
 *   Used by → components/BoughlightBackdrop.tsx (draws all of it),
 *             lib/__tests__/boughlight.test.ts (checks the containment claim)
 *   Growth  → `CROWN_GROWTH` + `growthFrame` express lib/growth.ts's `level` channel as
 *             appended branches; see that block for why the tint channel is NOT duplicated here
 *   Data    → none (pure constants + pure functions)
 *
 * Edit notes:
 *   - **Adding geometry to `CROWN` means re-running `clearZoneOffenders(CROWN)`.** The test does
 *     that for you and names the offending element; it is not a style check, it is the reason
 *     the crown is allowed under a card stack at all.
 *   - `HERO` is DELIBERATELY not held to that. Its bough falls to y 382 straight through the
 *     middle of the frame, which is the handoff's intent — hero is *"onboarding, empty states,
 *     focus session — any screen with no card stack over the middle"*. Mounting `hero` under a
 *     list is the mistake the two variants exist to prevent.
 */

/** The handoff's frame. Every number in this file is in these units. */
export const VB = { w: 390, h: 844 } as const;

/**
 * The box the handoff keeps empty — *"the centre box (x 84–306, y 236–612) stays clear"*, which
 * is the dashed overlay its `showClearZone` prop draws.
 *
 * ⚠️ **This binds `CROWN` only, and the handoff's own hero art is why.** The brief says "in
 * both", and then `HERO`'s fourth branch runs `M192 280 … 184 382` and two of its leaves sit at
 * (194,306) and (182,372) — i.e. through the middle of that box. The prose and the art disagree
 * and the ART is the deliverable, so the rule is read the way the two variants' own "Use" lines
 * read it: the clear zone is what lets a CARD STACK sit on the crown, and hero is for screens
 * that have no card stack. `clearZoneOffenders` is applied to the crown and not to the hero for
 * exactly that reason — see `lib/__tests__/boughlight.test.ts`.
 */
export const CLEAR_ZONE = { x0: 84, x1: 306, y0: 236, y1: 612 } as const;

/**
 * A master alpha on the whole layer, per theme.
 *
 * DARK takes the handoff's own numbers un-scaled: it is a dark-mode brief, and its strongest
 * stroke (0.34) already sits below the 0.42 the line art deleted on 2026-08-17 drew at.
 *
 * LIGHT is held below it, and that is an adaptation rather than a taste call — the same one
 * `components/ScreenBackground.tsx` records for its orbs. On a `#f7faff`–`#e4ecfb` ground a
 * tinted stroke is a mark ON something rather than a light in the dark, so it reaches the point
 * where it competes with a card far sooner. The handoff has no light mode to be faithful to.
 *
 * ⚠️ **0.5 → 0.8, measured on the first render rather than reasoned about.** At 0.5 the whole
 * layer was invisible in light: the bough read as a smudge behind the header and the motes did
 * not resolve at all, i.e. it was a full-screen SVG costing a composite per pager frame and
 * drawing nothing anyone could see. That is the same shape as the 2026-09-01 correction to
 * `ScreenBackground`'s own light orbs (0.10 → 0.18, reported as *"backdrop is too empty"*) and it
 * lands the same way. It stays under DARK because light's headroom really is smaller — the gap is
 * now a fifth rather than a half, which is the honest size of it.
 */
export const FIELD_OPACITY = { dark: 1, light: 0.8 } as const;

/**
 * Where the halo's ring band lands as a fraction of the circle that carries it.
 *
 * The handoff draws the soft halo as a 10px stroke under `feGaussianBlur stdDeviation=10`. There
 * is no filter here (react-native-svg's support is uneven on Android and it would rasterise a
 * full-screen layer every frame), so the ring is one circle filled with a radial gradient whose
 * stops peak at this offset: size the circle to `r / HALO_PEAK` and the band centres on `r`. A
 * blurred ring and a ring-shaped falloff are the same picture, and this one is a shader.
 */
export const HALO_PEAK = 0.84;

/** ±1.4°, the handoff's sway amplitude. */
export const SWAY_DEG = 1.4;

/** The handoff's `#h-orb` gradient, verbatim. `core` is white in dark, the tint in light. */
export const MOTE_STOPS: { offset: string; color: 'core' | 'tint'; alpha: number }[] = [
  { offset: '0%', color: 'core', alpha: 1 },
  { offset: '15%', color: 'core', alpha: 0.76 },
  { offset: '32%', color: 'tint', alpha: 0.46 },
  { offset: '60%', color: 'tint', alpha: 0.15 },
  { offset: '100%', color: 'tint', alpha: 0 },
];

/** The handoff's leaf at its own origin — the blade, then its midrib. */
export const LEAF_D = 'M0 0 C 22 -6 44 6 52 30 C 28 38 6 26 0 0 Z';
export const LEAF_RIB_D = 'M0 0 C 18 8 34 18 52 30';

/**
 * The leaf's bounding radius from its own origin, before scaling. The blade's farthest point is
 * its tip at (52,30) — `hypot(52,30) ≈ 59.9` — and no control point reaches further, so a disc
 * of this radius contains the leaf at ANY rotation. That is what makes `leafBox` exact without
 * evaluating a rotated bézier.
 */
export const LEAF_RADIUS = 60;

export type BoughlightVariant = 'hero' | 'crown';

/** One mote: centre, and the handoff's `scale` on its r-50 orb, so the drawn radius is `50 * s`. */
export type Mote = { x: number; y: number; s: number };

/** One leaf placement: the handoff's `translate(x,y) rotate(rot) scale(s)`. */
export type Leaf = { x: number; y: number; rot: number; s: number };

/** One branch stroke, as an SVG path plus its width and alpha. */
export type Branch = { d: string; w: number; o: number };

export type Frame = {
  /** The top bloom the halo sits in. */
  glow: { cx: number; cy: number; rx: number; ry: number };
  /** Halo centre and radius, plus the two alphas: the `#fff` hairline and the soft band. */
  halo: { cx: number; cy: number; r: number; ring: number; soft: number };
  /** The bough: where it pivots as it sways, and what hangs off it. */
  bough: { px: number; py: number; strokes: Branch[]; leaves: Leaf[] };
  motes: Mote[];
};

/**
 * `hero` — the full-frame read. Halo at (195,118) r 126, a long bough falling from (390,22) to
 * y 322, eight leaves, and 18 motes threading the ring, both gutters and the floor.
 *
 * For a screen with nothing over the middle. See `CLEAR_ZONE` for why this one is exempt from
 * the containment rule rather than failing it.
 */
export const HERO: Frame = {
  glow: { cx: 195, cy: 36, rx: 250, ry: 180 },
  halo: { cx: 195, cy: 118, r: 126, ring: 0.26, soft: 0.13 },
  bough: {
    px: 372,
    py: 16,
    strokes: [
      { d: 'M390 22 C 320 42 262 96 228 162 C 202 214 190 268 186 322', w: 7, o: 0.34 },
      { d: 'M296 60 C 268 36 238 26 200 28', w: 4.5, o: 0.28 },
      { d: 'M234 156 C 206 152 176 164 152 188', w: 3.4, o: 0.24 },
      { d: 'M192 280 C 204 318 202 350 184 382', w: 2.4, o: 0.17 },
    ],
    leaves: [
      { x: 300, y: 56, rot: 34, s: 0.9 },
      { x: 246, y: 110, rot: -14, s: 0.74 },
      { x: 338, y: 26, rot: 72, s: 0.66 },
      { x: 208, y: 32, rot: 158, s: 0.8 },
      { x: 196, y: 182, rot: 120, s: 0.62 },
      { x: 156, y: 196, rot: 196, s: 0.54 },
      { x: 194, y: 306, rot: 46, s: 0.5 },
      { x: 182, y: 372, rot: 132, s: 0.44 },
    ],
  },
  motes: [
    { x: 195, y: -8, s: 0.32 },
    { x: 104, y: 56, s: 0.3 },
    { x: 68, y: 146, s: 0.4 },
    { x: 88, y: 236, s: 0.2 },
    { x: 318, y: 150, s: 0.24 },
    { x: 288, y: 222, s: 0.18 },
    { x: 148, y: 246, s: 0.16 },
    { x: 12, y: 330, s: 0.18 },
    { x: 378, y: 346, s: 0.22 },
    { x: 6, y: 468, s: 0.14 },
    { x: 384, y: 540, s: 0.18 },
    { x: 14, y: 622, s: 0.24 },
    { x: 370, y: 672, s: 0.28 },
    { x: 52, y: 752, s: 0.4 },
    { x: 146, y: 802, s: 0.22 },
    { x: 248, y: 776, s: 0.28 },
    { x: 344, y: 816, s: 0.44 },
    { x: 196, y: 834, s: 0.18 },
  ],
};

/**
 * `crown` — the default, under a card stack. The halo's centre is 58px ABOVE the top edge, so
 * the screen sees only its lower crest; the bough is three short strokes and five leaves, all in
 * the crown band; and every mote sits in the crown, a gutter, or the floor.
 *
 * ⚠️ **Nothing may be added inside `CLEAR_ZONE`.** That box is the card column on every tab, and
 * keeping it empty is the entire argument for this layer existing (see the component's header
 * for the line art that was deleted for failing exactly this). `clearZoneOffenders` is the check
 * and `lib/__tests__/boughlight.test.ts` runs it. Put a new branch on the bough, or take it to
 * `HERO`.
 */
export const CROWN: Frame = {
  glow: { cx: 205, cy: 10, rx: 240, ry: 120 },
  halo: { cx: 205, cy: -58, r: 132, ring: 0.22, soft: 0.12 },
  bough: {
    px: 380,
    py: 8,
    strokes: [
      { d: 'M390 14 C 330 26 288 50 258 84', w: 6.5, o: 0.32 },
      { d: 'M304 44 C 282 26 258 18 226 20', w: 4.2, o: 0.26 },
      { d: 'M262 82 C 236 82 212 74 192 58', w: 3, o: 0.2 },
    ],
    leaves: [
      { x: 342, y: 20, rot: 62, s: 0.68 },
      { x: 300, y: 40, rot: 28, s: 0.8 },
      { x: 232, y: 22, rot: 160, s: 0.7 },
      { x: 258, y: 78, rot: 112, s: 0.56 },
      { x: 196, y: 56, rot: 190, s: 0.5 },
    ],
  },
  motes: [
    { x: 44, y: 44, s: 0.36 },
    { x: 122, y: 24, s: 0.2 },
    { x: 8, y: 118, s: 0.18 },
    { x: 372, y: 70, s: 0.24 },
    { x: 6, y: 212, s: 0.26 },
    { x: 384, y: 262, s: 0.22 },
    { x: 4, y: 344, s: 0.15 },
    { x: 388, y: 410, s: 0.19 },
    { x: 6, y: 478, s: 0.13 },
    { x: 386, y: 552, s: 0.17 },
    { x: 10, y: 616, s: 0.22 },
    { x: 382, y: 678, s: 0.3 },
    { x: 56, y: 748, s: 0.36 },
    { x: 152, y: 788, s: 0.22 },
    { x: 254, y: 766, s: 0.28 },
    { x: 342, y: 810, s: 0.42 },
    { x: 202, y: 830, s: 0.18 },
  ],
};

/**
 * The crown's GROWTH branches — the handoff's *"New branches append off the (390,14) bough and
 * stay inside the crown band; they never un-grow"*, wired to the reward system the app already
 * has (`lib/growth.ts` → `lib/useGrowth.ts`).
 *
 * One entry per tier above zero, so `GROWTH_LEVELS`' six rungs (0/3/7/14/30/60-day best streak)
 * map onto five appended branches. Each is a stroke plus the leaf on its tip, and they reach
 * progressively LEFT across the crown — a canopy filling in over weeks, rather than one twig
 * getting longer.
 *
 * Three properties hold and all three are checked in `lib/__tests__/boughlight.test.ts`:
 *   - **Never un-grows.** Not enforced here — `useGrowth` feeds a high-water mark, so `level`
 *     is monotonic by construction. This file just has to be a prefix-stable list: branch 3 is
 *     always branch 3, so a tier arriving never redraws the ones below it.
 *   - **Stays in the crown band**, i.e. out of `CLEAR_ZONE` with the same margin the base bough
 *     keeps. A reward that grows into the card column is the 2026-08-17 report arriving again,
 *     only earned.
 *   - **Quieter than the trunk it hangs off.** Every growth stroke is thinner and fainter than
 *     the base bough's faintest, so the canopy thickens rather than the drawing getting louder.
 *
 * ⚠️ **No tint channel here, deliberately.** The handoff names two channels (branches and a
 * green tint); `components/ScreenBackground.tsx` already draws the tint one, over the same
 * screen, off the same `intensity`. Drawing it twice would make one streak read as two rewards.
 * Branches are this layer's channel; the tint stays where it is.
 *
 * ⚠️ **Crown only.** `HERO` is the onboarding/empty-screen frame, and a user seeing it has no
 * streak to show. `growthFrame` is a no-op on any frame with no growth list.
 */
export const CROWN_GROWTH: { branch: Branch; leaf: Leaf }[] = [
  { branch: { d: 'M338 24 C 316 8 292 2 266 4', w: 2.8, o: 0.19 }, leaf: { x: 266, y: 4, rot: 200, s: 0.46 } },
  { branch: { d: 'M290 62 C 270 78 246 88 218 90', w: 2.6, o: 0.18 }, leaf: { x: 218, y: 90, rot: 92, s: 0.44 } },
  { branch: { d: 'M226 20 C 200 14 176 20 156 34', w: 2.4, o: 0.17 }, leaf: { x: 156, y: 34, rot: 214, s: 0.42 } },
  { branch: { d: 'M192 58 C 170 66 150 62 132 50', w: 2.2, o: 0.16 }, leaf: { x: 132, y: 50, rot: 250, s: 0.4 } },
  { branch: { d: 'M156 34 C 134 26 112 30 94 44', w: 2, o: 0.15 }, leaf: { x: 94, y: 44, rot: 232, s: 0.38 } },
];

/** Which frames grow, and what they grow. A frame absent here simply never changes. */
export const GROWTH: Partial<Record<BoughlightVariant, { branch: Branch; leaf: Leaf }[]>> = {
  crown: CROWN_GROWTH,
};

/**
 * A frame with `level` growth branches appended to its bough.
 *
 * Returns the SAME object when nothing is appended, so the common case (growth off, or level 0)
 * allocates nothing and `React.memo` downstream keeps its identity — the component this feeds is
 * a full-screen SVG behind the tabs pager, and re-creating its geometry on an unrelated render
 * is the exact cost `lib/useGrowth.ts` was rewritten to avoid.
 */
export function growthFrame(
  frame: Frame,
  variant: BoughlightVariant,
  level: number
): Frame {
  const steps = GROWTH[variant];
  const n = Math.max(0, Math.min(level, steps?.length ?? 0));
  if (!steps || n === 0) return frame;
  const grown = steps.slice(0, n);
  return {
    ...frame,
    bough: {
      ...frame.bough,
      strokes: [...frame.bough.strokes, ...grown.map((g) => g.branch)],
      leaves: [...frame.bough.leaves, ...grown.map((g) => g.leaf)],
    },
  };
}

export const FRAME: Record<BoughlightVariant, Frame> = { hero: HERO, crown: CROWN };

/** The hero's three light shafts — the only element either variant has that the other doesn't. */
export const SHAFTS: { d: string; o: number }[] = [
  { d: 'M150 0 L 112 320 L 180 320 L 180 0 Z', o: 0.5 },
  { d: 'M216 0 L 244 340 L 298 328 L 250 0 Z', o: 0.36 },
  { d: 'M52 0 L 24 232 L 58 242 L 88 0 Z', o: 0.26 },
];

// ─── Containment ──────────────────────────────────────────────────────────────────────────────

/** An axis-aligned box in frame units. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Every number in an SVG path `d`, as a flat list of numbers. */
function pathNumbers(d: string): number[] {
  return (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
}

/**
 * A stroke's bounding box, taken over its path's CONTROL POINTS and grown by half its width.
 *
 * A bézier is contained in the convex hull of its control points, so the hull's bounding box
 * bounds the curve — conservatively, which is the direction that matters: this can only ever
 * over-report an intrusion, never miss one.
 */
export function strokeBox(b: Branch): Box {
  const n = pathNumbers(b.d);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  const pad = b.w / 2;
  return {
    x0: Math.min(...xs) - pad,
    y0: Math.min(...ys) - pad,
    x1: Math.max(...xs) + pad,
    y1: Math.max(...ys) + pad,
  };
}

/**
 * A leaf's bounding box: a disc of `LEAF_RADIUS * s` about its origin, which contains the blade
 * at any rotation — so this needs no trigonometry and stays correct if a `rot` is edited.
 */
export function leafBox(l: Leaf): Box {
  const r = LEAF_RADIUS * l.s;
  return { x0: l.x - r, y0: l.y - r, x1: l.x + r, y1: l.y + r };
}

/** A mote's bounding box: the handoff's orb is `r 50` before its own `scale`. */
export function moteBox(m: Mote): Box {
  const r = 50 * m.s;
  return { x0: m.x - r, y0: m.y - r, x1: m.x + r, y1: m.y + r };
}

/** Whether two axis-aligned boxes overlap at all. Touching edges do not count as overlap. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * Every element of a frame that reaches into `CLEAR_ZONE`, named so a failure says WHICH branch
 * or leaf moved rather than just that one did.
 *
 * The frame's `glow`, `halo` and the crown's hazes are deliberately NOT checked: they are soft
 * radial washes with no edge, and the handoff's own rule for the band a card sits in is
 * *"nothing but haze"*. Haze is allowed there; geometry is not.
 */
export function clearZoneOffenders(frame: Frame, zone: Box = CLEAR_ZONE): string[] {
  const out: string[] = [];
  frame.bough.strokes.forEach((b, i) => {
    if (overlaps(strokeBox(b), zone)) out.push(`stroke ${i}: ${b.d}`);
  });
  frame.bough.leaves.forEach((l, i) => {
    if (overlaps(leafBox(l), zone)) out.push(`leaf ${i} at (${l.x},${l.y}) scale ${l.s}`);
  });
  frame.motes.forEach((m, i) => {
    if (overlaps(moteBox(m), zone)) out.push(`mote ${i} at (${m.x},${m.y}) scale ${m.s}`);
  });
  return out;
}
