/**
 * boughlight.test.ts — the backdrop's line art may not enter the card column.
 *
 * **Why this file exists, in one paragraph.** On 2026-08-17 the maintainer had line art deleted
 * from the backdrop — *"the sharp, chaotic vine/line art… is rendering ON TOP of the bottom
 * navigation and text… too distracting"* — and `lib/__tests__/chromeRhythm.test.ts` §6 still
 * forbids a `<Path>` or a `stroke=` in `components/ScreenBackground.tsx`, permanently. The
 * 2026-09-19 `Backdrop_Handoff` brief brings a bough back, in a different layer, and the ONLY
 * thing that makes that a different proposition rather than a repeat is a containment property:
 * the variant that sits under a card stack keeps its geometry out of the box the cards occupy.
 * A property nobody can check is a promise, and the last one cost a round trip. So it is
 * arithmetic here.
 *
 * **The second half of this file is about COST, and it was added by the re-land** (2026-09-20).
 * #734 drew this art and shipped a framerate regression; #735's post-mortem found the cause was
 * never the drawing but how it was mounted — an animated full-screen layer, two loops that never
 * idled, and a per-screen second instance. The final `describe` turns each of those three into a
 * property `components/CrownArt.tsx` cannot express. No harness in this repo measures frame
 * cost, so a source scan is the only instrument there is; see CLAUDE.md's A2 blind-class list.
 *
 * What this canNOT tell you: how the layer looks, or what it costs on a real panel. `npm run
 * visual` renders it on web, where shadow/font metrics are not native, and nothing here can see
 * Android's compositing of the backdrop over the pager. Both are device checks — see CLAUDE.md's
 * reporting contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROWTH_LEVELS } from '@/lib/growth';
import {
  CLEAR_ZONE,
  CROWN,
  CROWN_BASE,
  CROWN_GROWTH,
  DESCENT,
  FIELD_OPACITY,
  FRAME,
  HALO_PEAK,
  HERO,
  LEAF_RADIUS,
  SHAFTS,
  clearZoneOffenders,
  growthFrame,
  leafBox,
  moteBox,
  overlaps,
  strokeBox,
} from '@/lib/boughlight';

/**
 * A file's CODE, with comments removed — the same helper `lib/__tests__/chromeRhythm.test.ts`
 * uses, and for the same reason. Every guard in the last `describe` is of the form "this word
 * does not appear", and the files they guard explain AT LENGTH why that word must not appear.
 * Scanning raw source makes a guard fail on its own documentation, which teaches the next reader
 * to delete the explanation rather than keep the property.
 */
const code = (...parts: string[]) =>
  readFileSync(join(__dirname, ...parts), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('the crown never enters the card column', () => {
  // The headline property. `clearZoneOffenders` bounds every stroke by its control-point hull
  // (a bézier is contained in it), every leaf by a disc of LEAF_RADIUS*scale about its origin
  // (which holds at ANY rotation, so editing a `rot` cannot silently invalidate this), and every
  // mote by its own r-50*scale orb. All three are conservative — this can over-report an
  // intrusion, never miss one, which is the direction a guard should err in.
  // ⚠️ **THE CROWN ENTERS THE ZONE NOW, ON PURPOSE (2026-09-26), AND THIS RULE IS REWRITTEN
  // RATHER THAN RELAXED.** The maintainer asked for the branch to come down; `DESCENT` is that
  // limb, and it crosses the box.
  //
  // Deleting the rule was not an option and neither was keeping it, because its PREMISE turned
  // out to be wrong independently of the descent: `CLEAR_ZONE` is x 84–306 and this app's real
  // card column is **x 15–375** (measured off the shipped baseline — see the correction at
  // `CLEAR_ZONE`). At a 16px gutter there is no placement that avoids the cards, so "keeps art
  // out of the card column" was never what this checked. What it really protects is the MIDDLE
  // of the screen, which is still worth protecting.
  //
  // So it becomes a BOUNDED INTRUSION rule, which is strictly stronger than the old one for
  // everything except the one named limb:
  //   · the canopy — halo, glow, motes, the original bough — is still FULLY clear, and
  //   · only elements of `DESCENT` may cross, and only while they stay quiet.
  it('keeps the canopy out of the card column entirely', () => {
    expect(clearZoneOffenders(CROWN_BASE)).toEqual([]);
  });

  it('lets ONLY the descent cross, and only while it stays quiet', () => {
    // Every intruder must be one of the descent's own elements. `clearZoneOffenders` names what
    // it finds, so this compares the names rather than a count — a new mote drifting into the
    // box would be caught even if the total happened to match.
    const offenders = clearZoneOffenders(CROWN);
    const base = CROWN_BASE.bough;
    const descentStrokeIdx = DESCENT.strokes.map((_, i) => base.strokes.length + i);
    const descentLeafIdx = DESCENT.leaves.map((_, i) => base.leaves.length + i);
    const allowed = (name: string) =>
      descentStrokeIdx.some((i) => name.startsWith(`stroke ${i}:`)) ||
      descentLeafIdx.some((i) => name.startsWith(`leaf ${i} `));
    expect(offenders.filter((o) => !allowed(o))).toEqual([]);
    // ...and it does cross, or this whole block is describing a limb that is not there.
    expect(offenders.length).toBeGreaterThan(0);

    // The ceiling that makes the intrusion acceptable: quieter than the base bough's trunk, and
    // thin. At 45% transmission (#737's tinted veil) `o 0.28` composites to ~12.6% of the tint
    // behind a card — present, and nowhere near the 0.42 the 2026-08-17 art was pulled at.
    for (const b of DESCENT.strokes) {
      expect(b.o).toBeLessThanOrEqual(0.28);
      expect(b.w).toBeLessThanOrEqual(5);
    }
  });

  // ⚠️ The hero is exempt and that is the brief's own intent, not an oversight — see
  // `CLEAR_ZONE`'s note in lib/boughlight.ts, where the handoff's prose ("in both") and its own
  // hero art disagree. This assertion pins the exemption as a KNOWN fact rather than leaving it
  // as an absence: if someone ever tames the hero bough out of the middle, this fails and they
  // are made to decide whether the two variants still need to be two.
  it('the hero is deliberately not contained — it is for screens with no card stack', () => {
    expect(clearZoneOffenders(HERO).length).toBeGreaterThan(0);
  });

  // The crown's containment is not a near miss, and it should not be allowed to become one. The
  // nearest element is checked against a MARGIN, so a leaf creeping 20px down the frame trips
  // this before it trips the rule above.
  it('keeps a real margin, not a hairline, above the card column', () => {
    const grown = {
      x0: CLEAR_ZONE.x0 - 24,
      y0: CLEAR_ZONE.y0 - 24,
      x1: CLEAR_ZONE.x1 + 24,
      y1: CLEAR_ZONE.y1 + 24,
    };
    // `CROWN_BASE`, not `CROWN`: the descent crosses the zone by design, so the margin is a
    // property of the CANOPY — it is what keeps the canopy from creeping down to the card column
    // a pixel at a time. The descent's own ceiling is asserted above.
    expect(clearZoneOffenders(CROWN_BASE, grown)).toEqual([]);
  });
});

describe('the bounding helpers are conservative', () => {
  it('bounds a bézier by its control hull, padded by half the stroke width', () => {
    const box = strokeBox({ d: 'M390 14 C 330 26 288 50 258 84', w: 6.5, o: 0.32 });
    // x runs 258..390, y runs 14..84, each grown by 3.25.
    expect(box).toEqual({ x0: 254.75, y0: 10.75, x1: 393.25, y1: 87.25 });
  });

  it('bounds a leaf by a rotation-independent disc', () => {
    const a = leafBox({ x: 100, y: 100, rot: 0, s: 1 });
    const b = leafBox({ x: 100, y: 100, rot: 137, s: 1 });
    // Same box whatever the rotation — that is the whole point of using a disc.
    expect(a).toEqual(b);
    expect(a).toEqual({ x0: 100 - LEAF_RADIUS, y0: 40, x1: 160, y1: 160 });
  });

  it('bounds a mote by the handoff r-50 orb times its scale', () => {
    expect(moteBox({ x: 50, y: 60, s: 0.4 })).toEqual({ x0: 30, y0: 40, x1: 70, y1: 80 });
  });

  it('treats a touching edge as clear, not as overlap', () => {
    const a = { x0: 0, y0: 0, x1: 10, y1: 10 };
    const b = { x0: 10, y0: 0, x1: 20, y1: 10 };
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, { ...b, x0: 9.9 })).toBe(true);
  });
});

describe('the strength ladder stays under the art that was deleted', () => {
  // 2026-08-17's line art drew at `branchOpacity` 0.42 in a saturated blue, and was pulled for
  // being the loudest thing on the screen. Every stroke here is quieter than that, in BOTH
  // frames, and this is the number that must not drift back up — a bough at 0.42 is the same
  // report arriving again.
  const DELETED_ART_OPACITY = 0.42;

  it('draws no stroke at or above the opacity the old art was pulled for', () => {
    const loudest = Object.values(FRAME).flatMap((f) => f.bough.strokes.map((b) => b.o));
    expect(Math.max(...loudest)).toBeLessThan(DELETED_ART_OPACITY);
  });

  it('keeps each LIMB ordered trunk-to-twig', () => {
    // A bough reads as a bough because the strokes thin and fade outward together.
    //
    // ⚠️ **PER LIMB since 2026-09-26, and the change is the guard being wrong rather than the
    // drawing.** This ran over `frame.bough.strokes` as ONE list, which models a bough as a
    // CHAIN. A bough with two limbs of different lengths is a TREE: the crown is a canopy
    // (6.5 → 4.2 → 3.0) plus a descent (5.0 → 3.6 → 2.4), and no ordering of those six is
    // monotonic — the descent's trunk is legitimately thicker than the canopy's outermost twig,
    // because it is a different limb.
    //   The cost of the old model was paid in the drawing: the descent's first draft was drawn at
    // w 2.8 to fit under the flat ladder, rendered, and MEASURED INVISIBLE (0.3–0.5% of pixels).
    // Making the drawing wrong to keep the model right is the wrong way round.
    const limbs: [string, { w: number; o: number }[]][] = [
      ['hero', HERO.bough.strokes],
      ['crown canopy', CROWN_BASE.bough.strokes],
      ['crown descent', DESCENT.strokes],
    ];
    for (const [name, strokes] of limbs) {
      const widths = strokes.map((b) => b.w);
      const alphas = strokes.map((b) => b.o);
      expect({ name, widths }).toEqual({ name, widths: [...widths].sort((a, b) => b - a) });
      expect({ name, alphas }).toEqual({ name, alphas: [...alphas].sort((a, b) => b - a) });
    }
  });

  it('holds light under dark, where a tinted stroke is a mark rather than a light', () => {
    // ⚠️ The gap is a fifth, not a half — light started at 0.5 and went to 0.8 when the first
    // render showed the layer was simply invisible there. See `FIELD_OPACITY`'s note. What this
    // pins is the ORDER, which is the part that has a reason behind it; the size of the gap is a
    // measured taste call and is allowed to move.
    expect(FIELD_OPACITY.light).toBeLessThan(FIELD_OPACITY.dark);
    expect(FIELD_OPACITY.dark).toBe(1);
  });
});

describe('the frames are the two the handoff specifies', () => {
  it('puts the crown halo above the top edge and the hero halo on screen', () => {
    // The crown's whole trick: only the lower crest of the ring clears y 0, so a list sits on a
    // curve of light rather than on a circle drawn behind it. If this centre ever comes down,
    // the crown has become the hero and the card column has a ring through it.
    expect(CROWN.halo.cy + CROWN.halo.r).toBeLessThan(CLEAR_ZONE.y0);
    expect(CROWN.halo.cy).toBeLessThan(0);
    expect(HERO.halo.cy).toBeGreaterThan(0);
  });

  it('gives the shafts to the hero only', () => {
    // Shafts run from y 0 to y ~340, i.e. straight through the top of any card stack. They are
    // a hero element by construction; the crown's light is haze, which the brief does allow in
    // that band. This asserts the shaft geometry really is what disqualifies it.
    const deep = SHAFTS.map((s) => Math.max(...(s.d.match(/\d+/g) ?? []).map(Number)));
    expect(Math.max(...deep)).toBeGreaterThan(CLEAR_ZONE.y0);
  });

  it('sizes the halo carrier so its gradient band centres on the ring radius', () => {
    // The component fills a circle of `r / HALO_PEAK` with a gradient that peaks at HALO_PEAK,
    // which puts the band back on `r`. Asserting the identity here is what stops someone
    // "simplifying" the carrier to `r` and flattening the halo into a filled disc.
    for (const frame of Object.values(FRAME)) {
      expect((frame.halo.r / HALO_PEAK) * HALO_PEAK).toBeCloseTo(frame.halo.r, 6);
    }
    expect(HALO_PEAK).toBeGreaterThan(0.5);
    expect(HALO_PEAK).toBeLessThan(1);
  });
});

describe('the growth channel', () => {
  // The handoff's crown grows: *"New branches append off the (390,14) bough and stay inside the
  // crown band; they never un-grow."* That maps onto lib/growth.ts's `level`, and the mapping is
  // only safe if the grown frame keeps every property the base frame was allowed to ship on.

  it('has one branch per tier above zero', () => {
    // GROWTH_LEVELS is [0, 3, 7, 14, 30, 60] — six rungs, five of them above the floor. A
    // mismatch means either a tier that grows nothing or a branch no streak can ever reach.
    expect(CROWN_GROWTH).toHaveLength(GROWTH_LEVELS.length - 1);
  });

  it('stays out of the card column at every tier, with the same margin', () => {
    const margin = {
      x0: CLEAR_ZONE.x0 - 24,
      y0: CLEAR_ZONE.y0 - 24,
      x1: CLEAR_ZONE.x1 + 24,
      y1: CLEAR_ZONE.y1 + 24,
    };
    // Growth branches hang off the CANOPY, so the canopy plus every tier of them is what has to
    // stay clear. Taken with 'lets ONLY the descent cross' above, that covers the rendered frame:
    // canopy + growth is empty here, and the descent is the only thing that ever intrudes there.
    for (let level = 0; level <= CROWN_GROWTH.length; level++) {
      const grown = growthFrame(CROWN_BASE, 'crown', level);
      expect({ level, offenders: clearZoneOffenders(grown, margin) }).toEqual({ level, offenders: [] });
    }
  });

  it('thickens the canopy without making the drawing louder', () => {
    // Every growth stroke is thinner and fainter than the base bough's faintest, so a maxed-out
    // streak adds density, never weight. Without this a tier could quietly out-shout the trunk.
    // ⚠️ **`CROWN_BASE`, not `CROWN` (2026-09-26).** Growth appends to the CANOPY, so the rung it
    // must stay under is the canopy's faintest (w 3.0 / o 0.20) — not the descent's outermost
    // twig (w 2.4 / o 0.17), which is a different limb and legitimately thinner. Measuring
    // against the whole bough would force every growth tier under the descent's tip and quietly
    // shrink the reward channel to nothing.
    const quietestBase = Math.min(...CROWN_BASE.bough.strokes.map((b) => b.o));
    const thinnestBase = Math.min(...CROWN_BASE.bough.strokes.map((b) => b.w));
    for (const [i, g] of CROWN_GROWTH.entries()) {
      expect({ i, o: g.branch.o < quietestBase }).toEqual({ i, o: true });
      expect({ i, w: g.branch.w < thinnestBase }).toEqual({ i, w: true });
    }
  });

  it('is prefix-stable, so a new tier never redraws the ones below it', () => {
    // "Never un-grows" is enforced upstream (useGrowth feeds a high-water mark). What THIS file
    // has to guarantee is that branch 3 is always branch 3 — otherwise reaching a tier would
    // rearrange the canopy rather than extend it.
    for (let level = 1; level <= CROWN_GROWTH.length; level++) {
      const prev = growthFrame(CROWN, 'crown', level - 1).bough.strokes;
      const next = growthFrame(CROWN, 'crown', level).bough.strokes;
      expect(next.slice(0, prev.length)).toEqual(prev);
      expect(next).toHaveLength(prev.length + 1);
    }
  });

  it('is a no-op for the hero and for level 0, by identity', () => {
    // Returning the SAME object matters: this frame feeds a full-screen SVG behind the tabs
    // pager, and a fresh object on an unrelated render is the cost lib/useGrowth.ts was
    // rewritten to avoid. `toBe`, not `toEqual` — equality would pass on a new copy.
    expect(growthFrame(HERO, 'hero', 5)).toBe(HERO);
    expect(growthFrame(CROWN, 'crown', 0)).toBe(CROWN);
  });

  it('clamps a level past the last tier instead of overrunning', () => {
    const maxed = growthFrame(CROWN, 'crown', CROWN_GROWTH.length);
    expect(growthFrame(CROWN, 'crown', 99)).toEqual(maxed);
    expect(growthFrame(CROWN, 'crown', -3)).toBe(CROWN);
  });
});

describe('the crown is shapes in somebody else\'s canvas, and it does not move', () => {
  // ⚠️ **This is the guard that makes the re-land a different proposition from #734, and it is
  // the one to read before "simplifying" `components/CrownArt.tsx` back into a component.**
  //
  // #734 drew this same art and shipped a framerate regression the maintainer measured as
  // *"20fps all the time"*. #735's post-mortem named three causes and **none of them was the
  // drawing**: a full-screen `<Svg>` inside an `Animated.View` whose transform included `rotate`
  // (so the GPU resampled the whole surface every frame, and `renderToHardwareTextureAndroid`
  // made it worse by re-uploading rather than re-using the texture); two loops at deliberately
  // non-multiple periods, so the window never idled; and three new full-screen layers plus a
  // fourth instance per sub-tier screen.
  //
  // The re-land's answer is structural rather than tuned: the art is composed into the orb
  // canvas `components/ScreenBackground.tsx` already builds and already caches, so it is extra
  // SHAPES IN AN EXISTING RASTER — one rasterisation at mount, and nothing per frame. Every
  // assertion below is one of #735's three causes made unspellable in this file.
  //
  // A source scan, because there is nothing else that can see it. `tsc` is happy either way, and
  // a green pixel gate is exactly the symptom of the mechanism working — CLAUDE.md's A2 list has
  // per-frame GPU cost as a blind class, and this repo has no harness that measures it.
  const src = code('..', '..', 'components', 'CrownArt.tsx');

  it('adds no layer — it renders no View and owns no canvas', () => {
    // Cause 3. A `<View>` or an `<Svg>` here is a new full-screen surface for the compositor to
    // blend on every frame of every swipe, which is the cost that was reverted. The art has to
    // arrive as children of a canvas that already exists.
    expect(src).not.toMatch(/\bfrom 'react-native'/);
    expect(src).not.toMatch(/<View\b/);
    expect(src).not.toMatch(/<Svg\b/);
    expect(src).not.toMatch(/StyleSheet/);
  });

  it('never asks for a hardware texture, because it has no view to cache', () => {
    // The prop is only ever correct on a view whose CONTENTS are static and which ITSELF
    // animates. #734 put it on a view whose transform changed every frame, and
    // `components/ParticleBackground.tsx` had the identical mistake one layer down. Neither
    // shape can exist here, so the prop has nothing to mean.
    expect(src).not.toMatch(/renderToHardwareTextureAndroid/);
  });

  it('holds no animated value and starts no loop', () => {
    // Causes 1 and 2. The handoff's sway and breath are DROPPED, not slowed: the bough is drawn
    // at rest and the light at `LIGHT_REST`, the midpoint of its own travel.
    expect(src).not.toMatch(/\bAnimated\b/);
    expect(src).not.toMatch(/from 'react-native-reanimated'/);
    expect(src).not.toMatch(/useSharedValue|withRepeat|withTiming|\.loop\(/);
  });

  it('keeps the sway constant DELETED rather than unused', () => {
    // An unused export reads as a feature that is merely switched off, which is how the next
    // reader puts it back. `SWAY_DEG` and the two breath durations are gone from the module.
    const geom = code('..', 'boughlight.ts');
    expect(geom).not.toMatch(/SWAY_DEG/);
  });

  it('folds the field alpha per element rather than onto the group', () => {
    // A `<G opacity>` is not a per-shape alpha — the renderer draws the group into a scratch
    // layer and composites it, which on Android is a `saveLayer`, the classic Canvas cliff.
    // `components/ScreenBackground.tsx`'s own `OrbLayer` header records the same trap costing
    // three offscreen buffers per draw. `k()` multiplies `FIELD_OPACITY` into each element's own
    // alpha, which is the identical picture with no buffer.
    expect(src).toMatch(/const k = \(a: number\) => a \* field/);
    expect(src).not.toMatch(/<G transform=\{`scale\([^`]*\)`\} opacity/);
  });

  it('is reachable, and every escape hatch can individually put it out', () => {
    // ⚠️ **A boolean's TRUTH TABLE, not its source text — CLAUDE.md's A2 rule, from a measured
    // failure.** On 2026-09-06 `Surface.tsx`'s `glassOn` gained a term that made it `false` for
    // every surface in the app; `tsc` passed, 2490 jest tests passed, and **three separate
    // source-text assertions were updated to match the new string and passed too**. A regex can
    // confirm code exists but never that it runs.
    //   This art is gated by two expressions in two places, and the failure mode it is exposed
    // to is the same one: a crown that draws for nobody would look, from every harness here,
    // exactly like a crown that draws. So both expressions are extracted and EVALUATED over
    // every combination of their inputs.
    const sb = code('..', '..', 'components', 'ScreenBackground.tsx');
    const skip = sb.match(/\{(reduceEffects \|\| !decorative) \? null :/)?.[1];
    const pass = sb.match(/crown=\{([^}]+)\}/)?.[1];
    expect({ skip: !!skip, pass: !!pass }).toEqual({ skip: true, pass: true });

    const draws = new Function(
      'reduceEffects',
      'decorative',
      'crown',
      `return !(${skip}) && (${pass}) !== undefined;`
    ) as (r: boolean, d: boolean, c: string) => boolean;

    const bools = [false, true];
    const table = bools.flatMap((reduceEffects) =>
      bools.flatMap((decorative) =>
        (['crown', 'hero', 'none'] as const).map((crown) => ({
          reduceEffects,
          decorative,
          crown,
          on: !!draws(reduceEffects, decorative, crown),
        }))
      )
    );

    // It is not constant in either direction. The shipped defaults draw it...
    expect(table.find((r) => !r.reduceEffects && r.decorative && r.crown === 'crown')!.on).toBe(true);
    // ...onboarding's hero frame draws too...
    expect(table.find((r) => !r.reduceEffects && r.decorative && r.crown === 'hero')!.on).toBe(true);
    // ...and each of the three switches can individually put it out, which is what makes the
    // revert a one-word change and the accessibility promise a real one.
    expect(table.filter((r) => r.reduceEffects).every((r) => !r.on)).toBe(true);
    expect(table.filter((r) => !r.decorative).every((r) => !r.on)).toBe(true);
    expect(table.filter((r) => r.crown === 'none').every((r) => !r.on)).toBe(true);
  });

  it('composes the handoff frame onto the orb canvas with one uniform scale', () => {
    // Non-uniform scaling would distort the art; a second canvas would reinstate cause 3. The
    // two frames agree on aspect to within 0.2% (280/390 = 0.71795, 607/844 = 0.71919), which is
    // what makes one number exact enough — see CROWN_TO_ORB.
    expect(src).toMatch(/scale\(\$\{CROWN_TO_ORB\}\)/);
    expect(Math.abs(280 / 390 - 607 / 844)).toBeLessThan(0.002);
  });
});
