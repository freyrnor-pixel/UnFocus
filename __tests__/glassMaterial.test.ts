/**
 * glassMaterial.test.ts — the card material, and which of its promises survive each rewrite.
 *
 * **The glass came back on 2026-08-15 (Tactile Glass), by maintainer ruling.** This file has
 * now guarded three different materials under one name, and keeping it under that name is
 * deliberate — its git history is the record of how the card has been argued about, and a
 * fresh file would throw that away. The three:
 *   1. 2026-07-18 → 08-05: a frosted-glass system (BlurView, wash, face-lift scrim, beveled
 *      rim, inner line) with `getMaterialStyle` + `components/GlassFill.tsx`.
 *   2. 2026-08-05 → 08-15: the card reset. All of it deleted; a flat opaque page with one
 *      hue-ramped border. This file became a SOURCE SCAN asserting the frost stayed gone.
 *   3. 2026-08-15 →: Tactile Glass. A translucent pane, a light-catching edge, and a BlurView
 *      where — and only where — there is content behind it worth blurring.
 *
 * **Two of (2)'s promises were reversed here and one was not, and the difference matters.**
 * `DESIGN_COMPARISON/16-solid-pressable-materials.md` §2 required a maintainer conversation and
 * a separate PR before either the frost or the specular highlight could return; that happened,
 * and this is that PR — so the BlurView assertion is rewritten in place, with its history in
 * the comment above it. **The specular/gloss ban STANDS and is untouched.** "Hard and solid"
 * was never the same request as "glossy", and neither is "frosted": a translucent fill and a
 * lit EDGE are not a shine on the FACE. Don't read this pass as licence to re-add one.
 *
 * The rest of the file still guards what anything still calls — `filledEdge`, `getGlow`,
 * `getLayeredShadow` — and `GlassFill.tsx` stays deleted: the new material is ~15 lines inside
 * `Surface`, not a resurrected component.
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { filledEdge, getGlassEdge, getLayeredShadow, getGlow, rgba, lighten } from '@/constants/theme';
import { THEMES } from '@/constants/colors';
import { useSettingsStore } from '@/store/useSettingsStore';

// Keep the settings-store import DB-free: the module reaches @/lib/db via dataAccess at
// import time, and load() isn't called here, so a minimal stub is enough.
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
    execSync: jest.fn(),
  },
}));

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('filledEdge — the one surviving piece of the material recipe', () => {
  const base = '#3366CC';

  it('returns a translucent, lightened version of the fill it is given', () => {
    const edge = filledEdge(base, false);
    expect(edge).toMatch(/^rgba\(/);
    expect(edge).toBe(rgba(lighten(base, 0.06), 0.65));
  });

  it('reads more present in light mode than dark, so the edge stays calm on near-black', () => {
    const lightAlpha = Number(filledEdge(base, false).match(/,\s*([\d.]+)\)$/)![1]);
    const darkAlpha = Number(filledEdge(base, true).match(/,\s*([\d.]+)\)$/)![1]);
    expect(lightAlpha).toBeGreaterThan(darkAlpha);
  });

  it('derives from the fill, so two different fills get two different edges', () => {
    // This is the whole reason a filled control cannot just wear the screen hue: an
    // accent-filled button on a green screen would otherwise grow a green rim.
    expect(filledEdge('#3366CC', false)).not.toBe(filledEdge('#CC3333', false));
  });
});

describe('the material system stays deleted, and stays matte', () => {
  // DESIGN_COMPARISON/16 §2: "do not re-add the specular highlight… Get solidity from borders,
  // bases and travel instead. If you conclude the highlight is genuinely required, that is a
  // maintainer conversation and a separate PR — not a quiet test edit." Same for the frost.
  it('no specular / gloss token anywhere in the theme or the components', () => {
    const files = ['constants/theme.ts', 'components/Surface.tsx', 'components/Button.tsx', 'components/AddFAB.tsx'];
    const offenders = files.filter((f) => /\bspecular\b\s*[:=]/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  // Matches real USAGE — an import or a mounted element — never a mention. These files
  // legitimately explain in prose that they used to draw a GlassFill and no longer do, and a
  // scan that trips on the explanation makes deleting the explanation the cheapest way to
  // green. Exactly the trap lib/__tests__/designTokens.test.ts's readCode() documents.
  it('GlassFill is gone and nothing imports or mounts it', () => {
    expect(existsSync(join(ROOT, 'components/GlassFill.tsx'))).toBe(false);
    const files = ['components/Surface.tsx', 'components/Button.tsx', 'components/AddFAB.tsx'];
    const offenders = files.filter((f) => /(from '@\/components\/GlassFill'|<GlassFill)/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  // ⚠️ **REVERSED BY MAINTAINER RULING, 2026-08-15 (Tactile Glass).** This assertion used to
  // read "the three flat surfaces mount no BlurView" and was the CI half of the 2026-08-05 card
  // reset. `DESIGN_COMPARISON/16-solid-pressable-materials.md` §2 said re-adding the frost "is
  // a maintainer conversation and a separate PR — not a quiet test edit"; that conversation
  // happened and this is that PR, so the assertion is rewritten rather than deleted, and the
  // history stays here where the next session will find it.
  //
  // What replaced it is narrower and says more. "Mounts a BlurView" was never the property
  // worth protecting — WHERE it mounts is:
  //   · an overlay/nav surface has real scrolling content behind it, so the blur does visible
  //     work and is what the brief actually describes;
  //   · an ambient content card has the BACKDROP behind it, which in dark mode is pure black.
  //     Blurring black returns black, so a BlurView under all ~59 cards would be pure GPU cost
  //     on every scrolling list for no visible difference.
  // That distinction is invisible to a screenshot and to the web preview alike (Chromium
  // renders `backdrop-filter` on both paths), which is exactly why it needs a source scan.
  it('mounts a BlurView on every pane, at a lighter intensity for ambient cards', () => {
    // ⚠️ REVERSED on 2026-08-16 (brief §2: "use expo-blur as the absolute foundation for every
    // card"). This used to assert the OPPOSITE — that an ambient card is excluded by an
    // explicit `surfaceContext !== 'ambient'` gate — on the reasoning that blurring a black
    // backdrop returns black. See the BlurView comment in Surface.tsx for why that lost.
    const surface = read('components/Surface.tsx');
    expect(surface).toMatch(/<BlurView/);
    // Not gated on context any more, but still gated on the reduce-transparency setting.
    expect(surface).not.toMatch(/surfaceContext !== 'ambient'/);
    // The per-tier intensity is the cost mitigation and is the part worth pinning: ~59 ambient
    // cards to an overlay's one, so an ambient pass must stay the cheaper of the two.
    expect(surface).toMatch(/surfaceContext === 'ambient' \? BLUR_AMBIENT : BLUR_STRONG/);
    const ambient = Number(surface.match(/const BLUR_AMBIENT = (\d+)/)?.[1]);
    const strong = Number(surface.match(/const BLUR_STRONG = (\d+)/)?.[1]);
    expect(ambient).toBeGreaterThan(0);
    expect(ambient).toBeLessThan(strong);
    // Buttons stay solid — a translucent primary action would take its own accent down toward
    // whatever it happens to sit on, which is the opposite of "one obvious action".
    const solid = ['components/Button.tsx', 'components/AddFAB.tsx'];
    expect(solid.filter((f) => /<BlurView/.test(read(f)))).toEqual([]);
  });

  it('turns every bit of it off when the user asks for less transparency', () => {
    // `settings.glassSurfaces` went inert in the 2026-08-05 reset because everything was
    // already opaque — the state it was asking for. Now that translucency is back, the toggle
    // is load-bearing again, and this is the assertion that keeps it honest: the blur is gated
    // on it, and the fill falls back through getGlassFill to the opaque composite.
    const surface = read('components/Surface.tsx');
    expect(surface).toMatch(/glassSurfaces/);
    expect(surface).toMatch(/\{glassOn \?/);
    expect(surface).toMatch(/getGlassFill\(/);
  });

  it('the painted glass and the measured composite agree', () => {
    // The load-bearing invariant of the whole material. `surfaceGlass` is what gets painted;
    // `surface` is the same colour already composited over the backdrop, and is what every
    // contrast assertion in lib/__tests__/colors.test.ts measures. If the two drift, those
    // assertions keep passing while measuring a colour the app no longer draws — the exact
    // shape of the "a comment asserted a safety property nothing checked" bug AGENTS.md
    // records from PR #540.
    //
    // Dark's ground is genuinely #000000 (ScreenBackground's DARK.base is three black stops
    // with both glows at 0). Light's is the backdrop gradient's DARKEST stop, so the real pane
    // is never darker than the value the tests check.
    const GROUND = { light: '#e4ecfb', dark: '#000000' } as const;
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      const m = p.surfaceGlass.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      expect(m).toBeTruthy();
      const [, r, g, b, a] = m!;
      const under = GROUND[mode].replace('#', '');
      const composite = [r, g, b].map((c, i) => {
        const u = parseInt(under.slice(i * 2, i * 2 + 2), 16);
        return Math.round(Number(c) * Number(a) + u * (1 - Number(a)));
      });
      const hex = `#${composite.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      expect(hex).toBe(p.surface.toUpperCase());
    });
  });

  // getGlassEdge's two sides do different jobs and only one of them is a contrast promise.
  // Pinned here as well as in borderRamp.test.ts because THIS is the file that documents the
  // material as a whole, and the boundary half is what pays for DESIGN_RULES.md rule 10b's
  // relaxed fill step in light mode.
  //
  // The two modes diverged on 2026-08-16 (brief §3) and now assert opposite things, which is
  // the point rather than an inconsistency — see constants/theme.ts's GLASS_EDGE block.
  it('light: the pane edge catches light on one side and is a real boundary on the other', () => {
    const p = THEMES.default.light;
    const [lit, shade] = getGlassEdge(p.border, false).colors;
    expect(lit).toMatch(/^rgba\(255, 255, 255,/);
    expect(shade).toBe(rgba(p.border, 1));
  });

  it('dark: a card edge is a top-left lip that fades out, with no bottom-right frame', () => {
    // Brief §3 asks for borderTop/Left only and borderBottom/Right at zero. Implemented as a
    // third gradient stop at zero alpha rather than per-side widths (a 1px→0px step cuts
    // visibly at a rounded corner; the ring is a LinearGradient for that same reason).
    const p = THEMES.default.dark;
    const ramp = getGlassEdge(p.border, true);
    expect(ramp.colors).toHaveLength(3);
    // Fades to transparent WHITE, not to the boundary colour and not to a named `transparent`
    // — interpolating a named transparent goes through black on Android and smudges the
    // bottom-right rather than leaving it clean.
    expect(ramp.colors[2]).toBe('rgba(255, 255, 255, 0)');
    expect(ramp.colors[0]).toMatch(/^rgba\(255, 255, 255, 0\.1/);
    // Diagonal, or the "top AND left" the trick depends on becomes "top only".
    expect(ramp.start).toEqual({ x: 0, y: 0 });
    expect(ramp.end).toEqual({ x: 1, y: 1 });
    // ⚠️ Scope guard, and the reason this test is worth its length: the boundary is dropped for
    // CARDS only. A field or a button identifies a CONTROL, so WCAG 1.4.11's 3:1 still applies
    // to it and its shaded side must survive. A card is a container, separated on black by its
    // own fill and its shadow.
    (['field', 'button'] as const).forEach((weight) => {
      const w = getGlassEdge(p.border, true, weight);
      expect(w.colors).toHaveLength(2);
      expect(w.colors[1]).toMatch(new RegExp(`^rgba\\(120, 120, 130,`));
    });
  });
});

describe('getGlow', () => {
  const color = '#3366CC';

  // Alphas raised for the black canvas on 2026-08-16 (brief §4). 0.34/0.55 were tuned against
  // a PALE backdrop, where a halo only has to tint a light surface to read; on `#000000` what
  // reaches the eye is just `alpha × colour`, so a third of an accent is a dark smudge. `strong`
  // takes the brief's stated 0.8; `soft` inherits what `strong` used to be, which keeps the two
  // rungs a real step apart instead of collapsing them.
  it('returns a two-pass boxShadow halo tinted with the passed color', () => {
    const glow = getGlow(color, 'soft');
    expect(glow.boxShadow).toHaveLength(2);
    expect(glow.boxShadow[0].color).toBe(rgba(color, 0.55));
    // The outer bloom is always half the inner pass's alpha — that ratio is what makes it read
    // as one light falling off, rather than as two rings.
    expect(glow.boxShadow[1].color).toBe(rgba(color, 0.275));
  });

  it("'strong' has a larger radius and higher alpha than 'soft'", () => {
    const soft = getGlow(color, 'soft');
    const strong = getGlow(color, 'strong');
    expect(strong.boxShadow[0].blurRadius).toBeGreaterThan(soft.boxShadow[0].blurRadius);
    expect(strong.boxShadow[0].color).toBe(rgba(color, 0.8));
  });
});

describe('getLayeredShadow', () => {
  it('returns three shadow passes (contact / near / cast)', () => {
    expect(getLayeredShadow('#000', 'raised')).toHaveLength(3);
  });

  it('floating tier is deeper than raised', () => {
    const raised = getLayeredShadow('#000', 'raised');
    const floating = getLayeredShadow('#000', 'floating');
    expect(floating[2].blurRadius).toBeGreaterThan(raised[2].blurRadius);
    expect(floating[2].offsetY).toBeGreaterThan(raised[2].offsetY);
  });

  it('tints the shadow with the passed colour', () => {
    const [contact] = getLayeredShadow('#112233');
    expect(contact.color).toMatch(/rgba\(17, 34, 51/);
  });
});

describe('glass settings', () => {
  it('glassSurfaces still defaults on, and is LIVE again', () => {
    // It is the reduce-transparency a11y toggle. It was inert from 2026-08-05 to 2026-08-15,
    // because every surface it could reduce was already opaque — the state it was asking for —
    // and this assertion existed only to stop a migration quietly flipping a dead column. With
    // Tactile Glass it drives real behaviour again (see the two assertions above), so the
    // default matters for what a new install actually LOOKS like, not just for tidiness.
    // No new copy was needed: the shipped EN/NO strings already say "Frosted glass finish on
    // cards, buttons and the add button. Turn off for plain, solid surfaces."
    expect(useSettingsStore.getState().glassSurfaces).toBe(true);
  });
});

describe('voice settings', () => {
  it('voiceNotesEnabled defaults ON so the task-form mic is available out of the box', () => {
    // 2026-07-18: enabled by default; existing installs flipped on by a one-time UPDATE
    // migration in lib/db.ts. Notes/Home mic buttons render regardless of this flag.
    expect(useSettingsStore.getState().voiceNotesEnabled).toBe(true);
  });
});
