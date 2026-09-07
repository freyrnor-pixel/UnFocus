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

function worstCase(mode: 'light' | 'dark') {
  const p = palette(mode === 'dark' ? 'DARK' : 'LIGHT');
  const theme = THEMES.default[mode];
  const tokens = { text: theme.text, textMuted: theme.textMuted, border: theme.border };
  const alpha = Number(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(theme.surfaceGlass)![1]);
  const fill = parseHex(mode === 'dark' ? '#FFFFFF' : '#FFFFFF');
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
  it.each(['dark', 'light'] as const)(
    '%s: every point in the card column keeps the composite inside the band',
    (mode) => {
      const { worst } = worstCase(mode);
      // The message names the point and the colour, so a failure is diagnosable without
      // re-deriving the model: "which pixel, what did the card paint, which rule broke".
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
    const ceiling = maxGroundLuminance(alpha, tokens);
    // Dark transmits ~86%, so the ceiling on the GROUND is only a little above the band's top.
    expect(ceiling).toBeGreaterThan(20);
    expect(ceiling).toBeLessThan(60);
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
    const loud = { ...p, orbOpacity: 0.26, orbScreenOpacity: 0.18 };
    let failed = false;
    for (const hue of HUES) {
      for (let x = BAND.x0; x <= BAND.x1 && !failed; x += STEP) {
        for (let y = BAND.y0; y <= BAND.y1 && !failed; y += STEP) {
          const card = compositeOver(groundAt(loud, x, y, hue), [255, 255, 255], alpha);
          if (cardFailure(card, tokens)) failed = true;
        }
      }
    }
    expect(failed).toBe(true);
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
