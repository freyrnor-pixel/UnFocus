/**
 * boughlight.ts — the geometry and strength values for the "canopy × halo" backdrop, plus the
 * containment predicate that makes the whole layer safe to ship.
 *
 * Split out of the drawing for one reason: the claim that justifies
 * drawing line art in this app again is *"it never enters the card column"*, and a claim like
 * that has to be ARITHMETIC a test can run, not a sentence in a header. Everything here is pure
 * data and pure functions; the component imports it and draws it.
 *
 * Coordinates are the handoff's own 390×844 frame, copied verbatim from `Backdrop_Handoff`
 * (2026-09-19) so a placement can be diffed against the brief without re-deriving it.
 *
 * Connections:
 *   Imports → nothing
 *   Used by → components/CrownArt.tsx (draws all of it, as SVG children of the orb canvas),
 *             components/ScreenBackground.tsx (via CrownArt; owns the canvas),
 *             lib/__tests__/boughlight.test.ts (checks the containment claim)
 *   Growth  → `CROWN_GROWTH` + `growthFrame` express lib/growth.ts's `level` channel as
 *             appended branches; see that block for why the tint channel is NOT duplicated here
 *   Data    → none (pure constants + pure functions)
 *
 * Edit notes:
 *   - **Adding geometry to `CROWN` means re-running `clearZoneOffenders(CROWN)`.** The test does
 *     that for you and names the offending element; it is not a style check, it is the reason
 *     the crown is allowed under a card stack at all.
 *   - **Nothing here may animate, and that is a hard constraint rather than a style.** This
 *     art is composed into a canvas that is rasterised once and cached as a GPU texture; an
 *     animated value anywhere in it invalidates that texture every frame, which is precisely
 *     how #734 reached 20fps. `SWAY_DEG` and the breath periods are DELETED rather than left
 *     unused — see `CROWN_TO_ORB` and `LIGHT_REST`.
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
 * ⚠️ **CORRECTION (2026-09-25): this box is NOT this app's card column, and the sentence it keeps
 * getting quoted with — "the crown provably never enters the card column" — is false here.**
 *
 * Measured off the shipped dark baseline (`visual-baselines/dark/health-empty.png`, card border
 * hairline at x 17 and x 413 of a 430px shot, × 390/430):
 *
 * | | x-range, in this file's 390 frame |
 * |---|---|
 * | `CLEAR_ZONE`, i.e. what `clearZoneOffenders` checks | **84 – 306** |
 * | this app's REAL card column (`CARD_GUTTER` = `Spacing.md` = 16) | **15 – 375** |
 *
 * The zone is a narrow sub-box of the real column. It is the handoff MOCKUP's card width, and
 * that mockup gave its cards far bigger side margins than this app does.
 *
 * **What the guard is therefore worth, stated accurately.** It keeps art out of the MIDDLE of the
 * screen, which is still the thing the 2026-08-17 report was about and still worth checking. What
 * it cannot do is keep art from behind a card, because at a 16px gutter almost nothing is.
 *
 * **And behind a card is cheap, which is the other half.** The ambient pane transmits 25%, so a
 * stroke at o 0.19 composites to about 4.75% under a card and stays at full strength in the 12px
 * gaps between them. A descent is therefore a question of which gaps it crosses and how much
 * ghosting reads through the glass — a taste call — rather than a rule violation. See `DESCENTS`.
 */

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

/**
 * The scale that composes this 390×844 frame into `components/ScreenBackground.tsx`'s 280×607
 * orb canvas, so the crown draws inside the `<Svg>` that already exists instead of adding one.
 *
 * ⚠️ **The whole point of this constant is that there is no second canvas.** #734 shipped this
 * art as three new full-screen layers plus a fourth instance per sub-tier screen, and #735
 * reverted it at 20fps. A layer the compositor has to blend every frame is the cost; the
 * drawing is not. Composed in here the art is extra *shapes in an existing raster*, so the
 * per-frame layer count on every screen is exactly what it was before.
 *
 * **Why one uniform number is enough.** 280/390 = 0.71795 and 607/844 = 0.71919 — the two
 * frames agree on aspect to within 0.2%, because both are phone frames. Taking the HEIGHT ratio
 * maps y exactly (844 → 607), which is the axis that matters: `CLEAR_ZONE`'s y-band is the card
 * column, and the containment claim below is only meaningful if it lands where the cards do.
 * The 0.17% that x overflows tucks off the right edge, which is what the canvas's own
 * `preserveAspectRatio="xMidYMid slice"` does to that edge anyway.
 */
export const CROWN_TO_ORB = 607 / 844;

/**
 * The light's resting alpha, per variant — the midpoint of the handoff's breath.
 *
 * The brief breathes the hero's shafts .35→.80 and the crown's haze .50→.95, and #734 drew both
 * with an `Animated.loop`. That loop is one of the two #735 named: *"Two loops, 15s and 11s,
 * deliberately not multiples of each other, so the window is always dirty."* The breath is gone
 * and the light is drawn at the midpoint of its own travel — the same picture, at the phase a
 * viewer would see it in half the time, for no frames at all.
 */
export const LIGHT_REST = { hero: 0.575, crown: 0.725 } as const;

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
 *
 * ⚠️ **NOTHING IN THE APP MOUNTS THIS TODAY, and that is a finding rather than an oversight
 * (2026-09-20).** The re-land's one candidate was onboarding — the flow with no card stack — and
 * it turns out to be the single worst place for an uncontained frame: it is the one screen where
 * full-bleed art sits DIRECTLY UNDER the controls rather than around a protected centre box, and
 * `lib/__tests__/stableLayout.test.ts` already forbids exactly that, from a report about trunk
 * strokes reading as lines drawn on the controls. Onboarding takes `CROWN` like everything else.
 *   It is kept because it is the brief's other deliverable and its geometry is pinned below, not
 * because something is expected to switch to it. A future full-bleed screen with no controls in
 * the middle (a focus session, a full-screen empty state) is what it is for. If that screen never
 * arrives, delete this rather than leave it looking like a feature that is merely switched off.
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
const CROWN_BASE: Frame = {
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
 * ⚠️ **OFF, AND AWAITING A DECISION — not scratch, and not a feature that was tried and dropped
 * (2026-09-25).** `DESCENT` is `'none'`, so this file draws exactly what shipped in #736 and this
 * block changes no pixel. It is here because the geometry was built, rendered and sent as mockups,
 * and the choice is the maintainer's to make.
 *
 * Maintainer, after the crown shipped: *"Works like a charm. Only missing the particles and
 * branch going down."* The particles were a regression (see `components/ParticleBackground.tsx`);
 * the branch is this. Crown's bough stops at (258,84) — three short strokes, all above y 100 —
 * because that is the frame the handoff drew for a screen with a card stack over the middle.
 *
 * **When a variant is picked:** set `DESCENT` to it, delete the other, delete this switch, and do
 * the guard work the chosen one needs (see the ⚠️ on `DESCENTS` — the ordering guard models a
 * bough as a chain and a two-limbed bough is a tree). **If the answer is "none of them", delete
 * this whole block** rather than leaving a switch nobody is going to turn.
 */
export type Descent = 'none' | 'limb' | 'fall';
export const DESCENT: Descent = 'none';

/**
 * What a descent adds to the crown's bough.
 *
 * ⚠️ **Both are a TAPERING CONTINUATION OF THE TRUNK (w 5.0 → 3.6 → 2.4, o 0.28 → 0.22 → 0.17),
 * and the first draft of them was not — it was a twig at w 2.8 / o 0.19, and it was MEASURED
 * INVISIBLE.** Rendered against the shipped frame it moved 0.3–0.5% of the pixels, i.e. it did
 * not answer *"branch going down"* at all. The reason it was drawn that thin is worth keeping:
 * `lib/__tests__/boughlight.test.ts` requires a bough's strokes to thin and fade monotonically
 * trunk-to-twig, the crown's ladder ends at w 3.0 / o 0.20, and anything APPENDED therefore has
 * to sit under it.
 *   ⚠️ **That guard models a bough as a CHAIN, and a bough with two limbs of different lengths is
 * a TREE** — no single ordering of {trunk 6.5, side 4.2, side 3.0, descent 5.0, 3.6, 2.4} is
 * monotonic, whichever end the descent is spliced onto. So the guard fails on these by
 * construction, and the fix when a variant is chosen is to order PER LIMB rather than over one
 * flat list. Making the drawing wrong to keep the model right is the wrong way round.
 *
 * ⚠️ **`fall` KNOWINGLY BREAKS `clearZoneOffenders`, and `limb` is split in two to avoid it.**
 * `strokeBox` bounds a bézier by its control hull, which is conservative: a single curve from
 * (258,84) to (336,336) has a hull of x 258–340 × y 84–336 and overlaps the zone even though no
 * point of the actual curve below y 236 is left of x 335. Splitting it at y≈228 gives two hulls
 * that each clear it honestly. `fall` makes no such attempt — it goes down the middle on purpose.
 *
 * ⚠️ **And `CLEAR_ZONE` is NOT this app's card column** — see the correction at that constant.
 * Measured off the shipped dark baseline, the real column is x 15–375 against the zone's 84–306,
 * so a descent is behind a card wherever it goes. At 25% transmission a stroke at o 0.19
 * composites to about **4.75%** under a card and stays crisp in the 12px gaps between them, which
 * is the actual difference between the two variants: not "clear vs. not", but which gaps it
 * crosses.
 */
export const DESCENTS: Record<Exclude<Descent, 'none'>, { strokes: Branch[]; leaves: Leaf[] }> = {
  // Down the right gutter, clearing the zone with the split described above.
  limb: {
    strokes: [
      { d: 'M258 84 C 296 132 318 180 322 228', w: 5, o: 0.28 },
      { d: 'M322 228 C 336 270 342 304 336 352', w: 3.6, o: 0.22 },
      { d: 'M336 352 C 344 390 340 418 330 446', w: 2.4, o: 0.17 },
    ],
    leaves: [
      { x: 344, y: 200, rot: 84, s: 0.5 },
      { x: 342, y: 300, rot: 128, s: 0.48 },
      { x: 334, y: 400, rot: 62, s: 0.44 },
    ],
  },
  // Down the middle, the closest reading of the handoff's hero descent.
  fall: {
    strokes: [
      { d: 'M258 84 C 232 138 210 210 202 292', w: 5, o: 0.28 },
      { d: 'M202 292 C 214 332 212 366 196 402', w: 3.6, o: 0.22 },
      { d: 'M196 402 C 186 436 188 466 198 496', w: 2.4, o: 0.17 },
    ],
    leaves: [
      { x: 208, y: 196, rot: 104, s: 0.56 },
      { x: 198, y: 300, rot: 46, s: 0.52 },
      { x: 190, y: 392, rot: 132, s: 0.46 },
      { x: 198, y: 486, rot: 20, s: 0.4 },
    ],
  },
};

/** A frame with a descent appended to its bough. Identity-stable when there is nothing to add. */
export function withDescent(frame: Frame, descent: Descent): Frame {
  if (descent === 'none') return frame;
  const d = DESCENTS[descent];
  return {
    ...frame,
    bough: {
      ...frame.bough,
      strokes: [...frame.bough.strokes, ...d.strokes],
      leaves: [...frame.bough.leaves, ...d.leaves],
    },
  };
}

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

/** The crown as drawn — its base frame plus whichever descent `DESCENT` selects. */
export const CROWN: Frame = withDescent(CROWN_BASE, DESCENT);

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
