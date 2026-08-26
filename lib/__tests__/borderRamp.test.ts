/**
 * borderRamp.test.ts — the card design reset's border tokens (constants/theme.ts).
 *
 * `computeBorderRamp` / `computeBorderTone` / `BORDER_WIDTH` replaced the glass rim as the
 * only place colour touches a card (2026-08-05). What matters about them isn't a specific
 * hex — those are tuning values and should be free to move — but the RELATIONSHIPS the
 * design depends on, which is what this pins:
 *
 *   - the ramp actually ramps (two different stops, so "green to light green" is visible);
 *   - the weight family is ordered card > field > button in both thickness and strength, so
 *     a card full of bordered rows and option cells reads as a hierarchy and not as a grid —
 *     this is the single most load-bearing property of the whole layer;
 *   - `computeBorderTone` sits inside its own weight's ramp, so a plain-bordered field
 *     (FormControls' Input) and a gradient-bordered row look like the same system;
 *   - dark mode LIGHTENS instead of darkening, since a darkened hue on a near-black surface
 *     is an invisible edge rather than a subtle one.
 *
 * **`getGlassEdge` joined them on 2026-08-15 (Tactile Glass) and is what the app now draws.**
 * `computeBorderRamp`/`computeBorderTone` are kept, still exported and still tested here —
 * what they lost is consumers, not correctness — because this repo records rather than
 * deletes, and because the weight family they established is the one property the new edge
 * inherits wholesale. The glass block at the bottom asserts exactly that inheritance, plus the
 * two things that are new: the edge is DIAGONAL (it lights the top-left corner, not the top
 * edge), and its two sides do different jobs — a near-invisible white catch on one, and the
 * real WCAG 1.4.11 boundary on the other. See DESIGN_RULES.md rule 10b for why the boundary
 * had to move onto the edge at all.
 */
import {
  BORDER_WIDTH,
  computeBorderRamp,
  computeBorderTone,
  getGlassEdge,
  type BorderWeight,
} from '@/constants/theme';

/** Pull the mean channel value out of an `rgba(r, g, b, a)` string — a crude lightness proxy. */
function lightnessOf(rgba: string): number {
  const nums = rgba.replace(/[^\d.,]/g, '').split(',').map(Number);
  const [r, g, b] = nums;
  return (r + g + b) / 3;
}

function alphaOf(rgba: string): number {
  const nums = rgba.replace(/[^\d.,]/g, '').split(',').map(Number);
  return nums[3];
}

// featShop green — the maintainer's own "green to light green" example. Kept in step with the
// real token (2026-08-10 cinematic retune, was #3DAF6F); this is a fixture, not an assertion
// about the palette, so the tests below pass either way. Keeping it true just means the worked
// example in this file matches what the app actually draws.
const HUE = '#15803D';

describe('computeBorderRamp', () => {
  it('ramps: the two stops are different colours', () => {
    const { colors } = computeBorderRamp(HUE, false, 'card');
    expect(colors[0]).not.toBe(colors[1]);
  });

  it('runs deep → light down the edge in light mode', () => {
    const { colors } = computeBorderRamp(HUE, false, 'card');
    expect(lightnessOf(colors[0])).toBeLessThan(lightnessOf(colors[1]));
  });

  it('lightens rather than darkens in dark mode', () => {
    // A darkened hue on a near-black surface is an invisible edge. Both dark-mode stops must
    // sit above their light-mode counterparts, or a dark card has no visible border at all.
    const lightRamp = computeBorderRamp(HUE, false, 'card');
    const darkRamp = computeBorderRamp(HUE, true, 'card');
    expect(lightnessOf(darkRamp.colors[0])).toBeGreaterThan(lightnessOf(lightRamp.colors[0]));
    expect(lightnessOf(darkRamp.colors[1])).toBeGreaterThan(lightnessOf(lightRamp.colors[1]));
  });

  it('spans the full edge', () => {
    const { locations } = computeBorderRamp(HUE, false, 'card');
    expect(locations[0]).toBe(0);
    expect(locations[locations.length - 1]).toBe(1);
  });

  it('is a valid LinearGradient input at every weight', () => {
    for (const weight of ['card', 'field', 'button'] as const) {
      const ramp = computeBorderRamp(HUE, false, weight);
      // expo-linear-gradient requires ≥2 stops and matching lengths.
      expect(ramp.colors.length).toBeGreaterThanOrEqual(2);
      expect(ramp.locations.length).toBe(ramp.colors.length);
    }
  });
});

describe('the weight family (card → field → button)', () => {
  it('steps DOWN in strength as the element gets smaller', () => {
    // This is the "green → light green across elements" half of the maintainer's spec, and
    // the reason a card containing five bordered rows doesn't read as a table. If this ever
    // inverts, the rows shout louder than the card that holds them.
    const card = alphaOf(computeBorderTone(HUE, false, 'card'));
    const field = alphaOf(computeBorderTone(HUE, false, 'field'));
    const button = alphaOf(computeBorderTone(HUE, false, 'button'));
    expect(card).toBeGreaterThan(field);
    expect(field).toBeGreaterThan(button);
  });

  it('steps DOWN in thickness the same way', () => {
    expect(BORDER_WIDTH.card).toBeGreaterThan(BORDER_WIDTH.field);
    expect(BORDER_WIDTH.field).toBeGreaterThanOrEqual(BORDER_WIDTH.button);
  });

  it('keeps every rung visible — no weight collapses to nothing', () => {
    for (const weight of ['card', 'field', 'button'] as const) {
      expect(BORDER_WIDTH[weight]).toBeGreaterThan(0);
      expect(alphaOf(computeBorderTone(HUE, false, weight))).toBeGreaterThan(0.25);
    }
  });
});

describe('computeBorderTone', () => {
  it('sits between its own weight’s two ramp stops', () => {
    // A flat-bordered field (FormControls' Input, a chip) has to look like it belongs to the
    // same system as a gradient-bordered row, which only holds if the flat tone samples that
    // same ramp rather than being tuned separately.
    const { colors } = computeBorderRamp(HUE, false, 'field');
    const tone = lightnessOf(computeBorderTone(HUE, false, 'field'));
    expect(tone).toBeGreaterThan(lightnessOf(colors[0]));
    expect(tone).toBeLessThan(lightnessOf(colors[1]));
  });

  it('matches its ramp’s alpha at the same weight', () => {
    for (const weight of ['card', 'field', 'button'] as const) {
      const ramp = computeBorderRamp(HUE, false, weight);
      expect(alphaOf(computeBorderTone(HUE, false, weight))).toBeCloseTo(alphaOf(ramp.colors[0]), 5);
    }
  });

  it('returns an rgba string, not a bare hex', () => {
    // Callers pass this straight to a View's `borderColor`; a bare hex would silently drop
    // the per-weight alpha that carries the whole family gradation.
    expect(computeBorderTone(HUE, false, 'card')).toMatch(/^rgba\(/);
  });

  it('defaults to the card weight', () => {
    expect(computeBorderTone(HUE, false)).toBe(computeBorderTone(HUE, false, 'card'));
  });
});

// ── Tactile Glass, 2026-08-15 ────────────────────────────────────────────────
// `theme.border` in both modes — the contrast-tuned control-boundary token, which is what
// getGlassEdge takes as its shade stop. A fixture, not a claim about the palette.
const BORDER_LIGHT = '#7284A2';
const BORDER_DARK = '#787882';

describe('getGlassEdge — the light-catching pane edge', () => {
  const WEIGHTS: BorderWeight[] = ['card', 'field', 'button'];

  it('runs DIAGONALLY, so it lights the top-left corner rather than the top edge', () => {
    // The whole reason RimGradient grew start/end. A vertical sweep lights the top edge and
    // leaves the left one dark, which is not how a pane catches a light source above-left of
    // it — and the brief asks specifically for "the top and left edges".
    const edge = getGlassEdge(BORDER_DARK, true);
    expect(edge.start).toEqual({ x: 0, y: 0 });
    expect(edge.end).toEqual({ x: 1, y: 1 });
  });

  // ⚠️ **Rewritten 2026-08-26 (DESIGN_COMPARISON/19 phase 1)** — was "is lit at the start and
  // never lit at the end, in either mode", comparing `lightnessOf(c) * alphaOf(c)` between the
  // first and last stop. That formula only worked for `card` in dark mode by ACCIDENT: it was
  // the one weight whose last stop used to be the same white as the first, faded to zero alpha,
  // so "weighted brightness decreases" and "the last stop is not a light source" were the same
  // claim. `card` no longer has that shape (its `shadeDark` override is gone — see
  // `constants/theme.ts`'s `GLASS_EDGE` block) — its last stop, like `field`'s and `button`'s
  // always did, is the passed BOUNDARY colour at a real alpha, which is not "less bright", it
  // is a *different colour entirely* (grey, not white), and a highly-opaque mid-grey can
  // outweigh a faint white highlight on this formula without the ramp being lit "from below" in
  // any visual sense. The two shapes need two different, HONEST assertions instead of one
  // formula stretched to cover both:
  it('the lit stop is a highlight, never inverted by the strength knob', () => {
    // Guards the thing "brighter at the end" actually used to catch for the SAME shape: scaling
    // `strength` down must fade the highlight, never brighten it past where it started.
    for (const isDark of [false, true]) {
      const full = alphaOf(getGlassEdge(isDark ? BORDER_DARK : BORDER_LIGHT, isDark).colors[0]);
      const half = alphaOf(
        getGlassEdge(isDark ? BORDER_DARK : BORDER_LIGHT, isDark, 'card', 0.5).colors[0],
      );
      expect(half).toBeLessThan(full);
    }
  });

  it('the asymmetric (strength-0) shape is a three-stop white fade, not a two-stop boundary', () => {
    // At `strength: 0` every alpha in the ramp is zero by construction — `lit` and `shadeAlpha`
    // are both `<value> * 0` — so there is no non-degenerate brightness comparison to make
    // between its stops (unlike the old card-only shape, whose `lit` stayed non-zero while only
    // the SHADE side zeroed out). What is still real and worth pinning: the SHAPE — three white
    // stops at the documented locations, none of them the boundary colour — because that shape
    // is what a non-zero-but-still-`shadeAlpha === 0` future weight would also produce, and it
    // must not silently become a two-stop ramp.
    for (const isDark of [false, true]) {
      const edge = getGlassEdge(isDark ? BORDER_DARK : BORDER_LIGHT, isDark, 'card', 0);
      expect(edge.colors).toHaveLength(3);
      expect(edge.locations).toEqual([0, 0.34, 1]);
      edge.colors.forEach((c) => expect(c).toMatch(/^rgba\(255, 255, 255, 0\)$/));
    }
  });

  it('the closed-boundary shape ends on the real shade colour, not a faded highlight', () => {
    // The complementary claim for the shape every weight now uses at the default strength: the
    // last stop is not "dimmer white", it is `shade` itself — asserted by colour, not by a
    // brightness formula that can't distinguish "a different hue" from "less light".
    for (const isDark of [false, true]) {
      const border = isDark ? BORDER_DARK : BORDER_LIGHT;
      const [br, bg, bb] = [1, 3, 5].map((i) => parseInt(border.slice(i, i + 2), 16));
      const edge = getGlassEdge(border, isDark);
      const last = edge.colors[edge.colors.length - 1];
      expect(last).toMatch(new RegExp(`^rgba\\(${br}, ${bg}, ${bb}, `));
    }
  });

  it('the lit side is white in both modes — the light source is not themed', () => {
    for (const isDark of [false, true]) {
      const [lit] = getGlassEdge(isDark ? BORDER_DARK : BORDER_LIGHT, isDark).colors;
      expect(lit).toMatch(/^rgba\(255, 255, 255,/);
    }
  });

  it('light: inherits the card > field > button family from the ramp it replaced', () => {
    // The single most load-bearing property of the old layer, carried over intact: a card
    // holding five bordered controls must read as a hierarchy, not as a grid of equal lines.
    const alphas = WEIGHTS.map((w) => alphaOf(getGlassEdge(BORDER_LIGHT, false, w).colors[1]));
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
    alphas.forEach((a) => expect(a).toBeGreaterThan(0.25));
  });

  it('dark: the card drops out of the shade family; field > button still holds', () => {
    // 2026-08-16, brief §3. A dark card has NO shaded side at all — it is a top-left lip that
    // fades to nothing — so it cannot take part in a shade-alpha ordering. The hierarchy still
    // has to hold among the rungs that DO have one, which is the part that stops a card full
    // of bordered controls reading as a grid.
    const field = alphaOf(getGlassEdge(BORDER_DARK, true, 'field').colors[1]);
    const button = alphaOf(getGlassEdge(BORDER_DARK, true, 'button').colors[1]);
    expect(field).toBeGreaterThan(button);
    expect(button).toBeGreaterThan(0.25);
  });

  it('light: keeps the shade stop at FULL border strength on a card', () => {
    // Load-bearing IN LIGHT MODE, and the half that makes rule 10b's relaxed fill step a trade
    // rather than a loss: the card edge IS `theme.border`, undiluted, so
    // lib/__tests__/colors.test.ts's "the card edge is a real boundary on both sides"
    // (≥3:1 vs bg AND vs surface) is a statement about what actually gets painted. Fading this
    // fades the boundary with it.
    //
    // ⚠️ Dark mode deliberately does NOT have this any more (2026-08-16). It can afford not to:
    // the pane is lighter than a `#000000` ground and carries a getLayeredShadow underneath,
    // where light's pane sits on `#E2EAF5` at a 1.17 fill step with nothing else to separate
    // them. `field`/`button` keep their shade in BOTH modes because those identify controls.
    expect(alphaOf(getGlassEdge(BORDER_LIGHT, false, 'card').colors[1])).toBe(1);
  });

  // ⚠️ **REVERSED 2026-08-26** — was "dark: a card edge ends fully transparent instead of
  // closing into a frame". `GLASS_EDGE.card` no longer sets `shadeDark`, so a dark card closes
  // into a real boundary now, exactly like `field` and `button` always did — see
  // `constants/theme.ts`'s `GLASS_EDGE` block for why (the phase-1 fix for "a card had no
  // boundary on two of its four sides"). The 3-stop fade-to-nothing shape this used to assert
  // is still real — see "the asymmetric (strength-0) shape fades its light stop all the way to
  // nothing" above — it just no longer fires for `card` at the default strength.
  it('dark: a card edge closes into a real boundary, not a fade to nothing', () => {
    const ramp = getGlassEdge(BORDER_DARK, true, 'card');
    expect(ramp.colors).toHaveLength(2);
    expect(alphaOf(ramp.colors[1])).toBe(1); // card's `shade` is full strength — see GLASS_EDGE
    const [br, bg, bb] = [1, 3, 5].map((i) => parseInt(BORDER_DARK.slice(i, i + 2), 16));
    expect(ramp.colors[1]).toBe(`rgba(${br}, ${bg}, ${bb}, 1)`);
  });

  it('the lit catch is far weaker in dark mode than in light', () => {
    // A 95%-white lip on a near-white pane is a highlight; the same lip on near-black would
    // be a bright outline, which is the "glowing rim" look the flat-rim pass rejected.
    const light = alphaOf(getGlassEdge(BORDER_LIGHT, false).colors[0]);
    const dark = alphaOf(getGlassEdge(BORDER_DARK, true).colors[0]);
    expect(dark).toBeLessThan(light / 3);
  });

  it('scales both sides together under the design lab’s strength knob', () => {
    // Scaling one side alone tilts the light source rather than quieting the edge.
    const full = getGlassEdge(BORDER_DARK, true, 'card', 1);
    const half = getGlassEdge(BORDER_DARK, true, 'card', 0.5);
    expect(alphaOf(half.colors[0])).toBeCloseTo(alphaOf(full.colors[0]) / 2, 5);
    expect(alphaOf(half.colors[1])).toBeCloseTo(alphaOf(full.colors[1]) / 2, 5);
  });

  it('defaults to the card weight', () => {
    expect(getGlassEdge(BORDER_DARK, true)).toEqual(getGlassEdge(BORDER_DARK, true, 'card'));
  });
});
