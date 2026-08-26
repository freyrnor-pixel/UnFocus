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
import { filledEdge, getGlassEdge, getLayeredShadow, getGlow, getRecessedField, rgba, lighten } from '@/constants/theme';
import { THEMES, contrastRatio, IDENTITY_HUES } from '@/constants/colors';
import { badgeGlyphFor } from '@/lib/domainColor';
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

/**
 * What a glass token actually lands on. Dark's ground is genuinely `#000000` where a CARD sits —
 * components/ScreenBackground.tsx's DARK.base is three black stops, both of its full-canvas radial
 * glows are held at opacity 0, and its three ambient orbs (2026-08-17) are anchored at or outside
 * the corners with radii that reach zero before the middle of the canvas, so nothing lifts the
 * pixels under a pane. **That last clause is the load-bearing one and it is a claim about
 * geometry, not a promise in prose**: moving an orb inward, or growing one past the arithmetic in
 * that file's `ORBS` doc, would make this constant a fiction while every assertion below kept
 * passing — the exact shape of the PR #540 bug AGENTS.md records. Light's ground is the backdrop
 * gradient's DARKEST stop, so the real pane is never darker than the value these tests check.
 */
const GROUND = { light: '#e4ecfb', dark: '#000000' } as const;

/** `rgba(…)` painted over that ground, as the uppercase hex the palette should carry. */
function compositeOverGround(glass: string, mode: keyof typeof GROUND): string {
  const m = glass.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  expect(m).toBeTruthy();
  const [, r, g, b, a] = m!;
  const under = GROUND[mode].replace('#', '');
  const composite = [r, g, b].map((c, i) => {
    const u = parseInt(under.slice(i * 2, i * 2 + 2), 16);
    return Math.round(Number(c) * Number(a) + u * (1 - Number(a)));
  });
  return `#${composite.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** WCAG relative luminance — only used here to assert which of two rungs is the brighter one. */
function relativeLuminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 1, 2].map((i) => {
    const c = parseInt(v.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

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
  it('mounts a BlurView on every pane that is not an overlay, lighter for ambient cards', () => {
    // ⚠️ REVERSED on 2026-08-16 (brief §2: "use expo-blur as the absolute foundation for every
    // card"). This used to assert the OPPOSITE — that an ambient card is excluded by an
    // explicit `surfaceContext !== 'ambient'` gate — on the reasoning that blurring a black
    // backdrop returns black. See the BlurView comment in Surface.tsx for why that lost.
    // ⚠️ NARROWED again on 2026-08-18: an `overlay` pane is opaque and mounts no blur. That is
    // the one context with the app's own CARDS behind it rather than the backdrop — see the
    // 'a sheet never lets the card behind it through' test below for the rule and the ruling.
    const surface = read('components/Surface.tsx');
    expect(surface).toMatch(/<BlurView/);
    // Not gated on context any more, but still gated on the reduce-transparency setting.
    expect(surface).not.toMatch(/surfaceContext !== 'ambient'/);
    // The per-tier intensity is the cost mitigation and is the part worth pinning: ~59 ambient
    // cards to an overlay's one, so an ambient pass must stay the cheaper of the two.
    // `isAmbient` is `surfaceContext === 'ambient'`, hoisted on 2026-08-15 because the new
    // `opaqueCards` gate needs the same predicate. Both halves are asserted so the hoist can't
    // quietly become something else.
    expect(surface).toMatch(/const isAmbient = surfaceContext === 'ambient';/);
    expect(surface).toMatch(/intensity=\{isAmbient \? BLUR_AMBIENT : BLUR_STRONG\}/);
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
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      expect(compositeOverGround(p.surfaceGlass, mode)).toBe(p.surface.toUpperCase());
    });
  });

  it('a sheet — and now the nav bar — never lets the card behind it through', () => {
    // Maintainer, 2026-08-18, against a screenshot of components/CardMenuSheet.tsx: *"Cards
    // that overlap other cards should never be translucent."* The shot showed the Home
    // shopping card's title and badge legible THROUGH the menu, and the bottom nav's five
    // labels reading through the Done key on top of it.
    //
    // This narrows 2026-08-16's "every pane blurs" by exactly one context, and the boundary is
    // what each tier has BEHIND it rather than taste:
    //   · `overlay` — sheets and modals — has the app's own cards behind it by construction.
    //     Opaque, no blur.
    //   · `nav` JOINED IT on 2026-08-20. This bullet used to say the bar kept its frost because
    //     the 2026-08-18 clip window bounded content at the chrome's inner edges — true then,
    //     and the premise expired when the maintainer asked for the header and the bar to *"only
    //     have rounded corners"* with *"the corners show[ing] content behind it"*. That requires
    //     content to travel behind the bar, so the bar now has cards behind it exactly like a
    //     sheet, and takes the same answer. (components/ScreenHeader.tsx doesn't route through
    //     Surface and paints its own opaque fill; lib/__tests__/chromeRhythm.test.ts pins it.)
    //   · `ambient` keeps its frost: a card sits in a vertical list that never overlaps itself.
    // Invisible to a screenshot of any single surface and to the web preview alike, hence a
    // source scan plus the arithmetic below.
    const surface = read('components/Surface.tsx');
    expect(surface).toMatch(
      /const overlapsCards = surfaceContext === 'overlay' \|\| surfaceContext === 'nav';/,
    );
    // The frost gate must include it, or the fill goes opaque while a BlurView still smears
    // the card behind it over the top — the bug in a form that looks half-fixed.
    expect(surface).toMatch(/const glassOn = .*!overlapsCards/);
    expect(surface).toMatch(/const opaqueFill = isAmbient \? theme\.surface : theme\.surfaceRaised;/);
    // The same pairing `surface`/`surfaceGlass` have one rung down: the opaque token is the
    // translucent one already composited, so a sheet over empty backdrop is unchanged and the
    // two cannot drift into being different colours.
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      expect(compositeOverGround(p.surfaceGlassStrong, mode)).toBe(p.surfaceRaised.toUpperCase());
      // ...and it really is the brighter rung, or "raised" is a lie about which is on top.
      expect(relativeLuminance(p.surfaceRaised)).toBeGreaterThan(relativeLuminance(p.surface));
    });
  });

  it('an opaque sheet is still legible, and still under the halation ceiling', () => {
    // `surfaceRaised` is a NEW measurable rung, so it owes the same promises `surface` does.
    // The dark ceiling is DESIGN_RULES.md rule 10a's 16:1 — near-white text on a dark pane
    // blooms for astigmatic readers, and the sheet is now the app's brightest dark surface.
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      expect(contrastRatio(p.text, p.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
      // WCAG 1.4.11 — the rows inside a sheet draw their own borders on this fill.
      expect(contrastRatio(p.border, p.surfaceRaised)).toBeGreaterThanOrEqual(3);
    });
    expect(contrastRatio(THEMES.default.dark.text, THEMES.default.dark.surfaceRaised)).toBeLessThanOrEqual(16);
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

  // ── REVERSED 2026-08-26 (DESIGN_COMPARISON/19 phase 1, "the card surface") ────────────────
  // This test used to be "dark: a card edge is a top-left lip that fades out, with no
  // bottom-right frame" — brief §3's asymmetric card edge (borderTop/Left only,
  // borderBottom/Right dropped to a zero-alpha third gradient stop), the LOAD-BEARING half of
  // why the phase-1 doc says "a card had no boundary on two of its four sides": the fill step
  // alone (`bg`↔`surface`) was the only thing separating a card from the page, and this dropped
  // even the EDGE half on two sides. `constants/theme.ts`'s `GLASS_EDGE.card` no longer sets
  // `shadeDark`, so a dark card now gets the same closed 2-stop boundary `field`/`button`
  // already had — the shaded side no longer needs its own scope guard here, because it no
  // longer differs from them.
  it('dark: a card edge is a closed boundary on every side, like field and button', () => {
    const p = THEMES.default.dark;
    // Derived from the palette rather than written out as literal channels — see the removed
    // comment this replaced for why (a literal `rgba(r,g,b,` fails the moment `border` is
    // retuned for an unrelated reason).
    const [br, bg, bb] = [1, 3, 5].map((i) => parseInt(p.border.slice(i, i + 2), 16));
    (['card', 'field', 'button'] as const).forEach((weight) => {
      const ramp = getGlassEdge(p.border, true, weight);
      // Two stops, not three: the asymmetric fade-to-nothing branch is unreachable for any
      // weight at the default strength now that nothing sets `shadeDark`.
      expect(ramp.colors).toHaveLength(2);
      expect(ramp.colors[0]).toMatch(/^rgba\(255, 255, 255, 0\.1/);
      // `card`'s shade is full strength (1) — a real closed boundary, not a fractional one —
      // where `field`/`button` step down to 0.68/0.52; both are legitimate `shade` values.
      expect(ramp.colors[1]).toMatch(new RegExp(`^rgba\\(${br}, ${bg}, ${bb}, (0\\.|1\\))`));
      // Diagonal, unchanged by the reversal — the light still catches top-left.
      expect(ramp.start).toEqual({ x: 0, y: 0 });
      expect(ramp.end).toEqual({ x: 1, y: 1 });
    });
  });

  // The asymmetric 3-stop branch itself is not deleted — `getGlassEdge` still needs it for a
  // `strength: 0` design-lab knob on ANY weight, unrelated to the card-specific reversal above.
  it('the asymmetric fade-to-nothing branch still fires at strength 0, on any weight', () => {
    const p = THEMES.default.dark;
    (['card', 'field', 'button'] as const).forEach((weight) => {
      const ramp = getGlassEdge(p.border, true, weight, 0);
      expect(ramp.colors).toHaveLength(3);
      expect(ramp.colors[2]).toBe('rgba(255, 255, 255, 0)');
    });
  });
});

describe('the pane carries no screen colour (2026-08-20)', () => {
  // Maintainer, against three exported builds of the same screen: *"I do not like the yellow
  // card glass look. White glass with color elements might be better."* The 5% identity-hue
  // wash components/Surface.tsx painted over every pane is deleted — 5% of To-do's gold
  // `#FFD700` over black composites to olive across the whole card, and an alpha shared by all
  // five hues cannot be dropped far enough for the brightest rung without erasing the other
  // four. See SCREEN_TINT's obituary in constants/theme.ts.
  //
  // Every assertion here is a SOURCE SCAN, and that is not laziness: a wash is one absolutely
  // positioned View at 5% alpha. tsc cannot see it, no unit test measures a composited pixel,
  // and in a screenshot it is the difference between two very dark greys — which is precisely
  // how it survived a whole ladder recalibration while being the thing people disliked.

  it('SCREEN_TINT is gone from the token layer and no file imports it', () => {
    expect(/^export const SCREEN_TINT/m.test(read('constants/theme.ts'))).toBe(false);
    const files = ['components/Surface.tsx', 'components/CardAccent.tsx', 'components/Button.tsx'];
    const offenders = files.filter((f) => /\bSCREEN_TINT\b\s*[,;)]/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  // The wash's replacement would not have to be called SCREEN_TINT to be the same mistake, so
  // this asks the structural question instead: does the pane read a screen hue at all? It must
  // not — Surface stopped importing lib/screenColor entirely, which is what makes "no hue on
  // the card" a property of the file rather than of one deleted constant.
  it('Surface does not read the ambient screen hue', () => {
    const src = read('components/Surface.tsx');
    expect(/from '@\/lib\/screenColor'/.test(src)).toBe(false);
    expect(/useScreenColor\(/.test(src)).toBe(false);
  });

  // The `borderColor` prop's only job was feeding that wash a hue from a caller. It went with
  // it, and the scan covers the callers too: a prop passed to a component that no longer
  // declares it is a tsc error today, but the same hue re-appearing as an inline style on the
  // card is not.
  it('Surface declares no borderColor prop, and no card passes a hue as one', () => {
    expect(/^\s*borderColor\?: string;/m.test(read('components/Surface.tsx'))).toBe(false);
    const callers = [
      // HomeHabitsCard and HomeHealthCard left this list on 2026-08-22 — they were DELETED when
      // Habits and Health became bottom-nav tabs again, so their content is HabitsSurface and
      // HealthSurface, mounted by a screen instead of wrapped in a Home preview card.
      'components/PlanTaskCard.tsx', 'components/HomeNotesCard.tsx',
      'components/HomeShoppingCard.tsx', 'components/StarterCard.tsx', 'components/OpenEpisodeCard.tsx',
      'components/WeekListCard.tsx', 'app/scan.tsx',
    ];
    // A <Surface …> opening tag with a borderColor in it, across line breaks. Badge and View
    // both legitimately take a borderColor in these same files, so the tag has to be named.
    const offenders = callers.filter((f) => /<Surface\b[^>]*\bborderColor=/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  // A hue-coloured EDGE was exported beside the white pane and rejected in the same pass, so
  // the ramp stays neutral. Pinned because it is the cheap-looking thing to reach for next, and
  // because it does not even work as a gradient: the ring is a full-area LinearGradient behind
  // a translucent mask, so a saturated hue in it washes the pane instead of edging it — which
  // is what the first export drew.
  it('the card edge is theme.border, not a hue', () => {
    const src = read('components/Surface.tsx');
    expect(/const edgeHue = theme\.border;/.test(src)).toBe(true);
    expect(/getGlassEdge\(edgeHue, isDark, 'card'/.test(src)).toBe(true);
  });

  // The trade this accepts, stated as an assertion so it is not quietly walked back: a card
  // still says which screen it is on, via the badge glyph. That is the LOUD half of the
  // 2026-08-15 two-part system, and it is now the only half.
  it('the identity hue still reaches the badge', () => {
    const src = read('components/CardAccent.tsx');
    expect(/badgeGlyphFor\(/.test(src)).toBe(true);
    for (const { hue } of Object.values(IDENTITY_HUES)) {
      const glyph = badgeGlyphFor(hue, THEMES.default.dark.surface, true);
      expect(contrastRatio(glyph, THEMES.default.dark.surface)).toBeGreaterThanOrEqual(3);
    }
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

  it('opaqueCards defaults OFF — glass is the shipped look, this is the experiment', () => {
    // 2026-08-15, added so the card material can be A/B'd against a solid one. The default is
    // the whole point of the request ("how it looks as of now is default, but I want to
    // test"), so a migration or a defaults edit that flips it changes what every existing
    // install looks like on next launch. Its column DEFAULT is 0 for the same reason.
    expect(useSettingsStore.getState().opaqueCards).toBe(false);
  });

  it('opaqueCards is scoped to CARDS, and glassSurfaces still wins over it', () => {
    // The two switches are deliberately different sizes and this is what keeps them that way.
    // `glassSurfaces` is the global reduce-transparency mode; `opaqueCards` reaches ambient
    // panes only, so the card material can be judged on its own. Written as ONE boolean so the
    // precedence is readable in one line: glassSurfaces off ⇒ opaque everywhere regardless, and
    // `tint` still wins over both. 2026-08-18 added a fourth term, `!overlapsCards`, in the same
    // one-line boolean — the sheet rule, which 2026-08-20 widened to the nav bar (see 'a sheet —
    // and now the nav bar — never lets the card behind it through'). `opaqueCards` is still the
    // only one of the four scoped to ambient panes, which is what this test is about.
    const surface = read('components/Surface.tsx');
    expect(surface).toMatch(
      /const glassOn = glassPref && !tint && !overlapsCards && !\(isAmbient && opaqueCards\);/,
    );
    // A card drawn opaque must land on the SAME colour the frosted pane composites to, or
    // turning the switch on would change what lib/__tests__/colors.test.ts measures rather
    // than only what is drawn. getGlassFill's opaque arm is `opaqueFill`, which resolves to
    // `theme.surface` for exactly the ambient population this switch reaches — and to the
    // overlay tier's own composite otherwise. Both are asserted for real above; this pins that
    // the opaque path still routes through the pairing rather than picking a colour.
    expect(surface).toMatch(/const opaqueFill = isAmbient \? theme\.surface : theme\.surfaceRaised;/);
    expect(surface).toMatch(/getGlassFill\(glassFill, opaqueFill, glassOn\)/);
  });
});

describe('voice settings', () => {
  it('voiceNotesEnabled defaults ON so the task-form mic is available out of the box', () => {
    // 2026-07-18: enabled by default; existing installs flipped on by a one-time UPDATE
    // migration in lib/db.ts. Notes/Home mic buttons render regardless of this flag.
    expect(useSettingsStore.getState().voiceNotesEnabled).toBe(true);
  });
});

describe('getRecessedField — the inputs are sunk into the pane, not drawn on it', () => {
  // Brief §8, 2026-08-16: "recessed, indented fields within the glass surface... darker than
  // the glass card it sits on to simulate depth". Pinned here because a recess is a
  // relationship between two colours, and neither a screenshot nor the web preview can tell
  // "sunk by a measured amount" from "sunk by a hair" or "not sunk at all".

  it('is genuinely darker than the pane it sits in, in both modes', () => {
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      const { composite } = getRecessedField(p.surface, mode === 'dark');
      // A visible step, not a token difference nobody can see. Both land near 1.11.
      expect(contrastRatio(composite, p.surface)).toBeGreaterThanOrEqual(1.08);
    });
  });

  it('paints a translucent wash, so the glass still shows through the well', () => {
    // The point of an rgba over a token: the field is a dent IN the pane, not a tile ON it.
    // If this ever becomes an opaque hex, the BlurView under it stops reaching the field.
    (['light', 'dark'] as const).forEach((mode) => {
      expect(getRecessedField(THEMES.default[mode].surface, mode === 'dark').paint)
        .toMatch(/^rgba\(0, 0, 0, 0\./);
    });
  });

  it("light's recess is a fraction of dark's, or the field becomes a charcoal slab", () => {
    // The brief's literal rgba(0,0,0,0.4) is a dark-mode number. Over a near-white pane it
    // produces a different control, not a recessed one.
    const alpha = (mode: 'light' | 'dark') =>
      Number(getRecessedField(THEMES.default[mode].surface, mode === 'dark').paint.match(/([\d.]+)\)$/)![1]);
    expect(alpha('light')).toBeLessThan(alpha('dark') / 4);
  });

  it('keeps body text legible ON the well, not just on the pane', () => {
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      const { composite } = getRecessedField(p.surface, mode === 'dark');
      expect(contrastRatio(p.text, composite)).toBeGreaterThanOrEqual(4.5);
      // The placeholder is `textMuted` and is the one that can actually fail here.
      expect(contrastRatio(p.textMuted, composite)).toBeGreaterThanOrEqual(4.5);
    });
  });

  // ⚠️ A SECOND halation bound, for a surface the existing one does not cover.
  //
  // `colors.test.ts` caps `text` on `surface` at 17:1 (DESIGN_RULES.md rule 10a). A recessed
  // field is DARKER than `surface`, so white text measures higher on it than that test can
  // see — and the gap is exactly the shape of the bug AGENTS.md records from PR #540: an
  // assertion that keeps passing while measuring a colour the app no longer draws everywhere.
  // Rather than leave the new surface unmeasured, it gets its own explicit bound.
  //
  // ── 2026-08-26 (DESIGN_COMPARISON/19 phase 1, dark `surface` #1E1E1E → #2C2C2C) ───────────
  // Raising `surface` raised the well it is recessed FROM too: the composite (`getRecessedField`,
  // 35% toward black) moved `#141414` → `#1D1D1D`, and white text on it moved **18.42:1 →
  // 16.86:1** — this bound is no longer the tighter one. It happens to now sit UNDER the
  // primary 17:1 ceiling as well (13.97:1 on `surface` itself, 16.86:1 on the well), so the two
  // bounds that used to be "mutually exclusive" (see below) currently agree — a coincidence of
  // this specific pair of values, not a reason to delete the second bound: raise `surface`
  // again later and the well can separate from `surface` past 17 without this test knowing,
  // exactly the PR #540 shape this exists to catch.
  //
  // The ORIGINAL reasoning this bound was added for, still the reason it exists as its own
  // assertion rather than being folded into the 17:1 one: with `text` at pure #FFFFFF, a
  // recessed field is *structurally* darker than the surface it recesses from, so "recessed
  // field" and "one shared 17:1 ceiling" cannot both hold for every possible `surface` value —
  // there will always be some `surface` at which the well alone exceeds 17. And the contexts
  // genuinely differ: the halation ceiling defends sustained READING of body copy on a card,
  // where bloom accumulates over a paragraph; this is one line the user is actively typing
  // into, bounded by a 26px control and its own edge. If a real-device complaint ever arrives,
  // pull `text` back toward ~#D8DADF — which fixes both bounds at once — rather than lightening
  // the well and losing the recess.
  it('holds a documented halation bound of its own on the dark well', () => {
    const p = THEMES.default.dark;
    const { composite } = getRecessedField(p.surface, true);
    const ratio = contrastRatio(p.text, composite);
    expect(ratio).toBeGreaterThan(contrastRatio(p.text, p.surface));
    expect(ratio).toBeLessThanOrEqual(19);
  });

  it('gives every category a focus ring that is actually visible on the well', () => {
    // Brief §8's "adopt a subtle border... using the Categorical Color of its parent card".
    // The composers route that hue through `badgeGlyphFor`, which is what makes this hold in
    // LIGHT mode: the identity hues are mode-invariant neons, and a raw #FFD700 ring on a
    // #EDEEF1 field is 1.21:1 — a focus state you cannot see, i.e. DESIGN_RULES.md rule 18
    // with the cue missing. In dark the walk is a no-op and the raw hues already clear.
    (['light', 'dark'] as const).forEach((mode) => {
      const isDark = mode === 'dark';
      const p = THEMES.default[mode];
      const { composite } = getRecessedField(p.surface, isDark);
      (Object.keys(IDENTITY_HUES) as (keyof typeof IDENTITY_HUES)[]).forEach((key) => {
        const ring = badgeGlyphFor(IDENTITY_HUES[key].hue, composite, isDark);
        expect(`${mode}/${key}: ${contrastRatio(ring, composite) >= 3}`).toBe(`${mode}/${key}: true`);
      });
    });
  });
});
