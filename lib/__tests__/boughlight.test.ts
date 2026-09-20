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
 * What this canNOT tell you: how the layer looks. `npm run visual` renders it on web, where the
 * sway and breath are real but shadow/font metrics are not, and no harness in this repo can see
 * Android's compositing of a translucent SVG over the pager. Appearance is a device check — see
 * CLAUDE.md's reporting contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROWTH_LEVELS } from '@/lib/growth';
import {
  CLEAR_ZONE,
  CROWN,
  CROWN_GROWTH,
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

describe('the crown never enters the card column', () => {
  // The headline property. `clearZoneOffenders` bounds every stroke by its control-point hull
  // (a bézier is contained in it), every leaf by a disc of LEAF_RADIUS*scale about its origin
  // (which holds at ANY rotation, so editing a `rot` cannot silently invalidate this), and every
  // mote by its own r-50*scale orb. All three are conservative — this can over-report an
  // intrusion, never miss one, which is the direction a guard should err in.
  it('has no stroke, leaf or mote inside CLEAR_ZONE', () => {
    expect(clearZoneOffenders(CROWN)).toEqual([]);
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
    expect(clearZoneOffenders(CROWN, grown)).toEqual([]);
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

  it('keeps each bough ordered trunk-to-twig', () => {
    // A bough reads as a bough because the strokes thin and fade outward together. Both frames
    // list theirs from the trunk out, so both sequences must be monotonically decreasing in
    // width AND in alpha — which is a real property of the drawing, not a coding convention.
    for (const [name, frame] of Object.entries(FRAME)) {
      const widths = frame.bough.strokes.map((b) => b.w);
      const alphas = frame.bough.strokes.map((b) => b.o);
      expect({ name, widths }).toEqual({ name, widths: [...widths].sort((a, b) => b - a) });
      expect({ name, alphas }).toEqual({ name, alphas: [...alphas].sort((a, b) => b - a) });
    }
  });

  it('halves the whole layer in light, where a tinted stroke is a mark rather than a light', () => {
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
    for (let level = 0; level <= CROWN_GROWTH.length; level++) {
      const grown = growthFrame(CROWN, 'crown', level);
      expect({ level, offenders: clearZoneOffenders(grown, margin) }).toEqual({ level, offenders: [] });
    }
  });

  it('thickens the canopy without making the drawing louder', () => {
    // Every growth stroke is thinner and fainter than the base bough's faintest, so a maxed-out
    // streak adds density, never weight. Without this a tier could quietly out-shout the trunk.
    const quietestBase = Math.min(...CROWN.bough.strokes.map((b) => b.o));
    const thinnestBase = Math.min(...CROWN.bough.strokes.map((b) => b.w));
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

describe('the ambient loops stay invisible to the pixel gate', () => {
  // ⚠️ **This is a CI-determinism guard, not a style rule, and it was written from a real red
  // run.** `scripts/screenshot-states.mjs --deterministic` freezes `Date.now()` and nothing
  // else. Its `settle()` predicate — two byte-identical frames — can never return "settled" on a
  // screen carrying an endless animation, so it spends its budget and captures at whatever phase
  // the MACHINE reached. The first CI run of this layer used Reanimated, which clocks off
  // `requestAnimationFrame`, and 14 of 26 light baselines came back "changed" by 0.01–0.58%
  // against locally-blessed ones — the exact machine-speed dependence `settle()` exists to
  // remove, reintroduced one layer lower.
  //   RN's JS-driven `Animated.timing` clocks off the frozen `Date.now()` instead, so both loops
  // sit at progress 0 under the harness and every capture is identical. That is the same reason
  // `components/ParticleBackground.tsx` is invisible to the gate, documented in its header.
  //
  // A source scan, because there is nothing else that can see this: `tsc` is happy either way,
  // and a green pixel gate is precisely the symptom of the mechanism working.
  const src = readFileSync(
    join(__dirname, '..', '..', 'components', 'BoughlightBackdrop.tsx'),
    'utf8'
  );

  it('drives the sway and the breath from react-native Animated', () => {
    expect(src).toMatch(/import \{[^}]*\bAnimated\b[^}]*\} from 'react-native'/);
    expect(src).toMatch(/Animated\.loop\(/);
    expect(src).toMatch(/useNativeDriver: true/);
  });

  it('does not reach for Reanimated in this file', () => {
    // Reanimated is the right tool almost everywhere else in this app; it is the wrong one here,
    // and only here, for the reason above. If a future change genuinely needs it, the harness
    // has to learn to freeze rAF first — deleting this test is not the fix.
    expect(src).not.toMatch(/from 'react-native-reanimated'/);
  });

  it('rests both loops at progress 0, which is the phase every baseline shows', () => {
    expect(src).toMatch(/new Animated\.Value\(0\)/);
    // The still path (reducedMotion / reduceEffects) has to land on that same phase, or the
    // gate's picture and a reduced-motion user's picture would be two different drawings.
    expect(src).toMatch(/sway\.setValue\(0\)/);
    expect(src).toMatch(/breath\.setValue\(0\)/);
  });
});
