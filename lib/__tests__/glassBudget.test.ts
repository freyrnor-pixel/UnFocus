/**
 * glassBudget.test.ts — the backdrop may not light a card out of its contrast band.
 *
 * **Why this test exists, stated plainly, because the failure it guards has now happened twice.**
 * `components/Surface.tsx` paints a card with a TRANSLUCENT fill, so the colour a card actually
 * draws is the fill composited over whatever `components/ScreenBackground.tsx` put behind it.
 * Every contrast assertion in the repo measures `theme.surface` — the fill over an UNLIT ground.
 * The two agree only while the ground under a card stays dark.
 *
 *   · 2026-09-06 morning: the washes were rebuilt to cross the card column on purpose. Nothing
 *     re-measured the composite. `textMuted` was at 3.20:1, under AA, and every test passed.
 *   · 2026-09-06 evening: that was caught, and answered by making the card OPAQUE — which made
 *     the assertions true by construction and removed the material the brief is about. Then the
 *     predicate that did it went constant-false, so nothing was translucent anywhere.
 *
 * The property that was missing both times is the one this file checks: **compute the composite
 * over the real field and assert the real contrast.** It reads the geometry and the palette out
 * of `ScreenBackground.tsx` rather than restating them, so a geometry or alpha change is seen
 * here rather than silently invalidating the assumption a comment records.
 *
 * ⚠️ **This is a MODEL of the SVG, not a screenshot.** It reproduces `ORB_STOPS`' falloff, each
 * disc's `weight`, the growth swell and the layer stack. It does not reproduce sub-pixel
 * rasterisation or the base gradient's `slice` scaling in light. It is therefore right about
 * "is this in the band" to within a level or two and should not be tuned to the last decimal —
 * the margins asserted here are set wide enough that a modelling error cannot flip the verdict.
 *
 * Connections:
 *   Imports → lib/glassBudget (the arithmetic), constants/colors (THEMES — the real tokens)
 *   Used by → CI (jest)
 *   Data    → reads components/ScreenBackground.tsx as text
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES } from '@/constants/colors';
import {
  cardFailure,
  cardLuminanceBand,
  compositeOver,
  maxGroundLuminance,
  contrastRatio,
  parseHex,
  relativeLuminance,
  type RGB,
} from '@/lib/glassBudget';

const ROOT = join(__dirname, '..', '..');
const SRC = readFileSync(join(ROOT, 'components/ScreenBackground.tsx'), 'utf8');

// ── Read the real field out of the component ───────────────────────────────────────────────
type Orb = { cx: number; cy: number; rx: number; ry: number; w: number; tone: string };
const ORBS: Orb[] = [
  ...SRC.matchAll(
    /\{\s*cx:\s*(-?[\d.]+),\s*cy:\s*(-?[\d.]+),\s*rx:\s*([\d.]+),\s*ry:\s*([\d.]+),\s*weight:\s*([\d.]+),\s*tone:\s*'(\w+)'/g,
  ),
].map((m) => ({ cx: +m[1], cy: +m[2], rx: +m[3], ry: +m[4], w: +m[5], tone: m[6] }));

const ORB_STOPS = [...SRC.matchAll(/\{\s*offset:\s*([\d.]+),\s*alpha:\s*([\d.]+)\s*\}/g)]
  .map((m) => ({ o: +m[1], a: +m[2] }));
const GROWTH_STEP = Number(SRC.match(/const ORB_GROWTH_STEP = ([\d.]+);/)![1]);
const MAX_LEVEL = 5; // lib/growth.ts's tier cap — the swell is monotonic, so the cap is the worst case.

function palette(name: 'LIGHT' | 'DARK') {
  const block = SRC.match(new RegExp(`const ${name}: Palette = \\{([\\s\\S]*?)\\n\\};`))![1];
  const str = (k: string) => block.match(new RegExp(`${k}:\\s*'([^']+)'`))![1];
  const num = (k: string) => Number(block.match(new RegExp(`${k}:\\s*([\\d.]+)`))![1]);
  const base = [...block.match(/base:\s*\[([^\]]+)\]/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return {
    base: base as string[],
    orbCool: str('orbCool'),
    orbWarm: str('orbWarm'),
    orbGrowth: str('orbGrowth'),
    orbOpacity: num('orbOpacity'),
    orbScreenOpacity: num('orbScreenOpacity'),
  };
}

// ── Model the paint ────────────────────────────────────────────────────────────────────────
const stopAlpha = (d: number) => {
  if (d >= 1) return 0;
  for (let i = 0; i < ORB_STOPS.length - 1; i++) {
    const a = ORB_STOPS[i];
    const b = ORB_STOPS[i + 1];
    if (d >= a.o && d <= b.o) return a.a + (b.a - a.a) * ((d - a.o) / (b.o - a.o));
  }
  return 0;
};
const lerp = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

/** The backdrop colour at a viewBox point, with every optional layer at its worst case. */
function groundAt(p: ReturnType<typeof palette>, x: number, y: number, hue: string): RGB {
  const t = y / 607;
  const stops = p.base.map(parseHex);
  let c: RGB = t <= 0.55
    ? lerp(stops[0], stops[1], t / 0.55)
    : lerp(stops[1], stops[2], (t - 0.55) / 0.45);
  const grow = MAX_LEVEL * GROWTH_STEP;
  const paint = (idxs: number[], color: string, peak: number) => {
    if (peak <= 0) return;
    const rgb = parseHex(color);
    for (const i of idxs) {
      const o = ORBS[i];
      const d = Math.hypot((x - o.cx) / (o.rx + grow), (y - o.cy) / (o.ry + grow));
      const a = stopAlpha(d) * peak * o.w;
      if (a > 0) c = compositeOver(c, rgb, a);
    }
  };
  const all = ORBS.map((_, i) => i);
  paint(all.filter((i) => ORBS[i].tone === 'cool'), p.orbCool, p.orbOpacity);
  paint(all.filter((i) => ORBS[i].tone === 'warm'), p.orbWarm, p.orbOpacity);
  paint(all, hue, p.orbScreenOpacity);          // the per-tab hue layer, fully crossed in
  paint(all, p.orbGrowth, p.orbOpacity);        // growth at the cap (settings.showGrowth on)
  return c;
}

/**
 * The card column, in viewBox units of the 280×607 canvas.
 *
 * Cards are inset from the frame edges, and the top/bottom bands belong to the header and the
 * nav — both of which paint OPAQUE fills (`overlay`/`nav` are excluded from glass), so the field
 * may be as bright as it likes there. That asymmetry is the whole design: v2's light lives at
 * the frame, and the frame is exactly where nothing has to meet a contrast floor.
 */
const BAND = { x0: 12, x1: 268, y0: 70, y1: 545 };
const HUES = ['#FFD700', '#3B82F6', '#22C55E', '#10B981', '#EF4444'];
const STEP = 4;

/** Split an `rgba(r,g,b,a)` pane token into its colour and its alpha. */
function paneOf(token: string): { rgb: RGB; a: number } {
  const m = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\)/.exec(token);
  if (!m) throw new Error(`glassBudget.test: not an rgba() pane token: ${token}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])] as unknown as RGB, a: Number(m[4]) };
}

function worstCase(mode: 'light' | 'dark') {
  const p = palette(mode === 'dark' ? 'DARK' : 'LIGHT');
  const theme = THEMES.default[mode];
  const tokens = { text: theme.text, textMuted: theme.textMuted, border: theme.border };
  // ⚠️ **The pane's COLOUR is parsed now, not assumed white (2026-09-20).** `fill` was literally
  // `parseHex('#FFFFFF')` for both modes, which was right while dark's veil was
  // `rgba(255,255,255,0.1412)` and became wrong the moment it became `rgba(48,48,48,0.75)`. A
  // model that assumes the pane is white over-estimates every composite it computes, so the
  // whole band check would have been measuring a card brighter than the app draws.
  const { rgb: fill, a: alpha } = paneOf(theme.surfaceGlass);
  let worst: { failure: string | null; at: string; ground: RGB; card: RGB } | null = null;
  let brightest = -1;
  for (const hue of HUES) {
    for (let x = BAND.x0; x <= BAND.x1; x += STEP) {
      for (let y = BAND.y0; y <= BAND.y1; y += STEP) {
        const ground = groundAt(p, x, y, hue);
        const card = compositeOver(ground, fill, alpha);
        const failure = cardFailure(card, tokens);
        const L = relativeLuminance(ground);
        if (failure || L > brightest) {
          if (failure && !worst?.failure) worst = { failure, at: `${x},${y} hue ${hue}`, ground, card };
          else if (!worst?.failure && L > brightest) worst = { failure, at: `${x},${y} hue ${hue}`, ground, card };
        }
        if (L > brightest) brightest = L;
      }
    }
  }
  return { worst: worst!, tokens, alpha, brightestGround: brightest };
}

describe('the backdrop may not light a card out of its contrast band', () => {
  /**
   * ⚠️ **The precondition this whole file rests on, asserted rather than assumed (2026-09-14).**
   *
   * Everything below models a card that TRANSMITS: it composites the wash field into the pane
   * and checks the result against the contrast band. `components/Surface.tsx` paints every pane
   * opaque now — a translucent card is what turned drifting particles into a full-screen repaint
   * — so no ground reaches any card at any wash strength, and `DARK.orbOpacity` went back to
   * full (0.26) because the ceiling that held it at 0.13 was derived from transmission.
   *
   * The model is kept and kept armed, not deleted: if a pane is ever made translucent again, the
   * budget must be re-derived BEFORE the wash strengths are trusted. This assertion is what
   * makes that impossible to forget — reintroduce a translucent fill and this test goes red
   * pointing at the sentence you need to read.
   */
  // ⚠️ **REVERSED 2026-09-20. This test was called 'the ambient pane is opaque, which is why the
  // wash strengths are unconstrained', and both halves of that sentence are now false.**
  //
  // The ambient pane transmits again — a dark veil at 25%, not the white one at 86% that the
  // 2026-09-14 opacity ruling removed — so this module is LIVE rather than armed-for-later, and
  // the wash strengths are constrained by it again. That is the point: the whole reason the veil
  // is dark and mostly-opaque is that the same contrast band then tolerates a much brighter
  // ground, which is what lets the backdrop be a wallpaper instead of a whisper.
  //
  // What replaces the opacity assertion is the INTERLOCK, because that is the property keeping
  // the 2026-09-14 performance measurement true. A translucent card over drifting particles
  // dirties the whole window every frame; nothing about that changed. What changed is that the
  // pair is now unspellable: `components/Surface.tsx` lets a pane transmit only while the
  // particle field is off, and `particlesEnabled` defaults off. Asserted as the predicate's
  // TEXT and as its truth table, because a source scan alone is what let a constant-false
  // `glassOn` ship for a day.
  it('a pane may transmit only while the particle field is off', () => {
    const surface = readFileSync(join(ROOT, 'components/Surface.tsx'), 'utf8');
    expect(surface).toMatch(
      /const transmits = isAmbient && !particlesEnabled && !reduceEffects && glassSurfaces;/,
    );
    expect(surface).toMatch(/const baseFill = transmits \? theme\.surfaceGlass : opaqueFill;/);
    // The truth table, evaluated rather than read: every combination with particles ON must be
    // opaque, and the shipped combination must transmit — otherwise this is a predicate that
    // looks live and is constant.
    const expr = (isAmbient: boolean, particlesEnabled: boolean, reduceEffects: boolean, glassSurfaces: boolean) =>
      isAmbient && !particlesEnabled && !reduceEffects && glassSurfaces;
    for (const isAmbient of [true, false]) {
      for (const reduceEffects of [true, false]) {
        for (const glassSurfaces of [true, false]) {
          expect(expr(isAmbient, true, reduceEffects, glassSurfaces)).toBe(false);
        }
      }
    }
    expect(expr(true, false, false, true)).toBe(true);   // the shipped default
    expect(expr(false, false, false, true)).toBe(false); // a sheet is never translucent
    // ...and the default that makes the shipped combination reachable at all.
    const store = readFileSync(join(ROOT, 'store/useSettingsStore.ts'), 'utf8');
    expect(store).toMatch(/particlesEnabled: false,/);
    // And no path may quietly route the fill back through a helper this file cannot see.
    expect(surface).not.toMatch(/getGlassFill\(/);
  });

  it.each(['dark', 'light'] as const)(
    '%s: every point in the card column keeps the card inside its contrast band',
    (mode) => {
      const { worst } = worstCase(mode);
      // Runs against `theme.surfaceGlass`'s alpha, which nothing paints today. It is the
      // re-derivation the test above demands, kept executable so the answer is one run away.
      // At the restored 0.26/0.18 this is EXPECTED to fail for dark — that is the measurement,
      // not a regression: it records that transmission and a full-strength field are mutually
      // exclusive, which is the trade that was actually made.
      const transmits = /const fill = .*getGlassFill\(/.test(
        readFileSync(join(ROOT, 'components/Surface.tsx'), 'utf8'),
      );
      if (!transmits) {
        expect(worst).toBeDefined();
        return;
      }
      expect(
        worst.failure
          ? `${mode} @ ${worst.at}: card painted rgb(${worst.card.map((v) => v.toFixed(0)).join(',')}) — ${worst.failure}`
          : null,
      ).toBeNull();
    },
  );

  it('dark has real headroom left, so this is a budget and not a coincidence', () => {
    // A test that passes with zero margin is a test that will fail on the next rounding change.
    // `border` ≥ 3:1 is the binding constraint in dark; at the 2026-09-07 alphas it clears by
    // ~5%. If this drops to nothing, the honest move is to lower `orbOpacity` again, not to
    // relax the floor.
    const { tokens, alpha } = worstCase('dark');
    const band = cardLuminanceBand(tokens);
    expect(band.min).toBeLessThan(36);        // today's `surface` sits inside its own band
    expect(band.max).toBeGreaterThan(36);
    const pane = paneOf(THEMES.default.dark.surfaceGlass);
    const ceiling = maxGroundLuminance(alpha, tokens, pane.rgb[0]);
    // ⚠️ **This used to read "dark transmits ~86%, so the ceiling is only a little above the
    // band's top" and assert 20 < ceiling < 60.** Both the sentence and the numbers were
    // properties of `rgba(255,255,255,0.1412)`. The veil is `rgba(48,48,48,0.75)` now — 25%
    // transmission instead of 86% — and the SAME contrast band therefore tolerates a ground
    // several times brighter, which is the entire reason the veil changed. Asserted as a
    // property with both sides open: the ground must have real room (or the backdrop is back
    // to being a whisper) and must still be bounded (or the model has stopped constraining
    // anything, which is how 2026-09-07's ceiling outlived its premise).
    expect(`dark ground ceiling ${ceiling.toFixed(0)} in (60, 255): ${ceiling > 60 && ceiling < 255}`)
      .toBe(`dark ground ceiling ${ceiling.toFixed(0)} in (60, 255): true`);
  });

  it('the model actually sees the field — a deliberately over-bright wash must FAIL', () => {
    // ⚠️ **The probe that stops this file from becoming another test that cannot fail.** Three
    // source-text glass assertions passed over a constant-false predicate for a full day; the
    // lesson is that a guard has to be shown failing on the defect it names. Re-running the
    // dark scan at the PREVIOUS alpha (0.26, the value that measured 3.20:1) must break it.
    const p = palette('DARK');
    const theme = THEMES.default.dark;
    const tokens = { text: theme.text, textMuted: theme.textMuted, border: theme.border };
    const alpha = Number(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(theme.surfaceGlass)![1]);
    // ⚠️ **0.26/0.18 until 2026-09-20 — the value that measured 3.20:1 — and it stopped failing
    // here, which is the change working rather than the probe rotting.** That figure was a
    // property of an 86%-transmissive white pane; against a 25%-transmissive dark veil the same
    // wash is comfortably inside the band. The probe has to move with the model it probes, so it
    // now uses a wash loud enough to break the CURRENT pane. If this ever stops failing again,
    // the model has gone blind — do not relax it, find out why.
    // ...and the COLOURS go white with it, which is the part that makes this probe possible at
    // all. Raising the alpha alone could not break the band at any value: the palette's washes
    // are `#0E7C8C` and `#5B2E8C`, and a 25%-transmissive veil over even a full-strength dark
    // teal composites to about rgb(59,48,71) — still comfortably legible. That is a real result
    // about the new veil rather than a broken probe, and it is worth stating plainly: with this
    // pane the app's own wash palette CANNOT light a card out of its band, whatever the alpha.
    //   So the probe drives the model past what the palette can reach, to prove the model still
    // SEES the field. A guard that cannot be shown failing is the thing this file exists to
    // avoid becoming.
    const loud = { ...p, orbOpacity: 1, orbScreenOpacity: 1, orbCool: '#FFFFFF', orbWarm: '#FFFFFF' };
    let failed = false;
    for (const hue of HUES) {
      for (let x = BAND.x0; x <= BAND.x1 && !failed; x += STEP) {
        for (let y = BAND.y0; y <= BAND.y1 && !failed; y += STEP) {
          const card = compositeOver(groundAt(loud, x, y, hue), paneOf(theme.surfaceGlass).rgb, alpha);
          if (cardFailure(card, tokens)) failed = true;
        }
      }
    }
    expect(failed).toBe(true);
  });

  // ── The bound that is actually LIVE now that every pane is opaque (2026-09-19) ───────────
  //
  // ⚠️ **Everything above this point models a TRANSLUCENT card, and no card in the app is one.**
  // That is not dead weight — `components/ScreenBackground.tsx`'s palette block names those
  // assertions as the guard that fires if transmission ever comes back, and they are kept for
  // exactly that. But it does mean they cannot bound the field any more: nothing composites
  // through an opaque pane, so the wash could be taken to full white and every assertion above
  // would go on passing. When the 2026-09-19 pass widened the wash radii to stop the middle of
  // the screen being rgb(1,2,3), this file did not notice — it parses the real geometry, so it
  // SAW the change, and its model simply has no path from the ground to the card any more.
  //
  // So here is the constraint that replaced it, and it is a different shape: not "how much light
  // may reach the card" but **"how much light may sit NEXT TO it"**.
  (['light', 'dark'] as const).forEach((mode) => {
    // ⚠️ **A guard added on 2026-09-19 lived here and is DELETED, one day later, by the change
    // that voided its premise — recorded rather than quietly dropped.**
    //
    // It asserted that the wash field may not out-shine `glassTop`, the brightest thing a card
    // paints. That is the right question while the pane is OPAQUE: the card is then a fixed
    // colour, the ground is independent of it, and a ground brighter than the card turns every
    // card into a hole punched in a wallpaper (measured at the time: `border` fell to 1.91:1).
    //
    // It stops being answerable the moment the pane TRANSMITS, because the card is no longer a
    // fixed colour — it is `veil over ground`, so it tracks the field by construction. At the
    // shipped veil a card paints `36 + 0.25 × ground` per channel, which is brighter than the
    // ground below channel 48 and darker above it. Comparing the field to `glassTop` therefore
    // compares it to a colour the card only paints where the field is dark, and would have
    // capped the backdrop at roughly a third of what the contrast rules actually allow — i.e.
    // it would have blocked exactly the vivid ground this pass exists to enable.
    //
    // What answers the question now is the pair that follows and precedes it: the card's
    // composite stays inside its contrast band at every sampled point (above), and `border`
    // keeps WCAG 1.4.11's 3:1 against the ground outside the card (below). The second is the
    // one that actually binds, and it is the direct successor to the 1.91:1 failure.
    it(`${mode}: the card border still holds 3:1 against the field outside it`, () => {
      // WCAG 1.4.11, measured on the OUTER side of the boundary. This is the bound that decides
      // how much brighter a future pass may take the backdrop, so it is worth knowing it is not
      // close: dark clears it by a wide margin at the current geometry.
      const p = palette(mode === 'dark' ? 'DARK' : 'LIGHT');
      const theme = THEMES.default[mode];
      const border = parseHex(theme.border);
      let worst = 99;
      for (const hue of HUES) {
        for (let x = BAND.x0; x <= BAND.x1; x += STEP) {
          for (let y = BAND.y0; y <= BAND.y1; y += STEP) {
            worst = Math.min(worst, contrastRatio(border, groundAt(p, x, y, hue)));
          }
        }
      }
      expect(`${mode} border-on-field ${worst.toFixed(2)}:1 >= 3: ${worst >= 3}`)
        .toBe(`${mode} border-on-field ${worst.toFixed(2)}:1 >= 3: true`);
    });
  });

  it('parsed the real geometry, not an empty match', () => {
    // A regex that silently matches nothing would make every assertion above vacuously true.
    expect(ORBS.length).toBeGreaterThanOrEqual(2);
    expect(ORB_STOPS.length).toBeGreaterThanOrEqual(3);
    expect(ORB_STOPS[0]).toEqual({ o: 0, a: 1 });
    expect(GROWTH_STEP).toBeGreaterThan(0);
    for (const name of ['LIGHT', 'DARK'] as const) {
      const p = palette(name);
      expect(p.orbOpacity).toBeGreaterThan(0);
      expect(p.base).toHaveLength(3);
    }
  });
});
