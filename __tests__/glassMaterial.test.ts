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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { filledEdge, getGlassEdge, getGlassPane, getLayeredShadow, getGlow, getRecessedField, rgba, lighten } from '@/constants/theme';
import { THEMES, contrastRatio, IDENTITY_HUES } from '@/constants/colors';
import { badgeGlyphFor } from '@/lib/domainColor';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getTranslations } from '@/lib/i18n';

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
 * Every component/screen source, so an assertion about "nothing in the app does X" can actually
 * scan the app instead of a hand-listed pair of files that drifts the moment someone adds a third.
 */
const ALL_SOURCES: string[] = ['components', 'app'].flatMap(function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );
});

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

/**
 * An `rgba(...)` edge stop composited over an opaque `#rrggbb` ground, as a luminance.
 *
 * The two edge stops are not comparable as written — the lit one is white at a low alpha and
 * the shaded one is the boundary hue at a high alpha, so neither the alpha nor the hue alone
 * says which side of the pane is brighter. Only the composite does, and the composite is what
 * the eye sees.
 */
function compositeLuminance(stop: string, groundHex: string): number {
  const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(stop);
  if (!m) throw new Error(`compositeLuminance: not an rgba() stop: ${stop}`);
  const [r, g, b, a] = [m[1], m[2], m[3], m[4]].map(Number);
  const v = groundHex.replace('#', '');
  const ground = [0, 1, 2].map((i) => parseInt(v.slice(i * 2, i * 2 + 2), 16));
  const mixed = [r, g, b].map((c, i) => Math.round(c * a + ground[i] * (1 - a)));
  const hex = `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return relativeLuminance(hex);
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
  it('mounts NO BlurView anywhere, and the glass predicate is not a constant', () => {
    // ⚠️ REVERSED on 2026-08-16 (brief §2: "use expo-blur as the absolute foundation for every
    // card"). This used to assert the OPPOSITE — that an ambient card is excluded by an
    // explicit `surfaceContext !== 'ambient'` gate — on the reasoning that blurring a black
    // backdrop returns black. See the BlurView comment in Surface.tsx for why that lost.
    // ⚠️ NARROWED again on 2026-08-18: an `overlay` pane is opaque and mounts no blur. That is
    // the one context with the app's own CARDS behind it rather than the backdrop — see the
    // 'a sheet never lets the card behind it through' test below for the rule and the ruling.
    const surface = read('components/Surface.tsx');
    // ⚠️ **NARROWED AGAIN on 2026-08-29 — an ambient card in DARK mounts no blur, and this time
    // the ruling is a measurement rather than an argument.** Both previous rulings reasoned:
    // 2026-08-15 excluded ambient ("blurring black returns black"), 2026-08-16 reversed it.
    // The maintainer then reported "enabling visual effects now does nothing except for making
    // it go slow again", and the dark visual baselines — with the narrator pinned, which is the
    // harness the old `shadowStyle` note said this question needed — settle it: 15 of 21 screens
    // byte-identical with the blur AND the shadow off, the other six moving 0.05-0.07%.
    //   Those pixels are cards rendering 2-6/255 LIGHTER. On a black ground there is nothing to
    // blur, so the blur's only contribution was `expo-blur`'s `tint="dark"` darkening the pane —
    // i.e. it was making every card darker than `theme.surface`, the very token the contrast
    // assertions in this file measure. Removing it makes the drawn colour match the asserted one.
    //   LIGHT still blurs (a real gradient backdrop), and `overlay`/`nav` still blur in both
    // modes (the app's own cards are behind them). The gate is one hoisted predicate so the two
    // costs it governs cannot drift apart.
    //   ⚠️ **NARROWED ONCE MORE on 2026-09-06, and `flatDarkGround` is GONE.** Every ruling
    // above — 2026-08-15's "blurring black returns black", 2026-08-29's measurement — rests on
    // one premise: the dark backdrop under a card is flat black. `components/
    // ScreenBackground.tsx` now draws v2's three broad washes across the frame on a maintainer
    // ruling, so that premise is retired and the predicate named after it with it.
    //   Maintainer, same ruling: *"Just make it so backdrop colors don't pass through, but
    // maintain the visual."* An ambient card is OPAQUE now, in BOTH themes. That is the same
    // argument 2026-08-29 made about the blur, applied to the fill: this file's own
    // 'painted glass and measured composite agree' test derives `surfaceGlass`'s alpha from a
    // BLACK ground, so once the ground is lit a translucent pane composites to something other
    // than `#242424` while every assertion here goes on measuring `#242424`. Opaque makes the
    // drawn colour equal the asserted one on any ground, by construction.
    //   So the blur is off for ambient in both themes (nothing shows through an opaque pane, so
    // a BlurView under one is pure GPU cost), and the SHADOW is back in dark — it was withdrawn
    // only because it fell on flat black, and it now falls on a lit field, which is where v2
    // puts its own `0 8px 28px rgba(0,0,0,.4)`.
    expect(surface).not.toMatch(/flatDarkGround = /);
    // ⚠️ **There is NO `BlurView` in this app as of 2026-09-07, and this test now pins its
    // absence.** It used to assert the mount and its two intensities. That assertion passed for
    // a full day while the mount was UNREACHABLE — `glassOn` had gone constant-false (see the
    // predicate test below), so a source-text scan was reporting a feature the app could not
    // draw. Pinning the absence is honest; pinning a mount nothing reaches is not.
    //   What replaces the blur as the pane's material is transmission: dark's `surfaceGlass`
    // passes 86% of a backdrop that now has real light in it, bounded by `lib/glassBudget.ts`.
    // A blur is a per-frame render-effect pass per card on scrolling lists; transmission is
    // static paint. If a blur is ever wanted again, bring it back for ONE tier with a
    // measurement, and change this test deliberately.
    expect(surface).not.toMatch(/<BlurView/);
    expect(surface).not.toMatch(/from 'expo-blur'/);
    // The shadow is not gated on the ground being black.
    expect(surface).toMatch(/shadowLevel === 'flat' \|\| reduceEffects$/m);
    // Never a bare ambient exclusion — that is what took LIGHT mode down with it in 2026-09-06.
    expect(surface).not.toMatch(/surfaceContext !== 'ambient'/);
    expect(surface).not.toMatch(/&& !isAmbient;/);
    expect(surface).toMatch(/const isAmbient = surfaceContext === 'ambient';/);
    // Nothing else in the app may quietly become the new blur.
    const blurMounts = ALL_SOURCES.filter((f) => /<BlurView/.test(read(f)));
    expect(blurMounts).toEqual([]);
  });

  it('turns every bit of it off when the user asks for less transparency', () => {
    // `settings.glassSurfaces` went inert in the 2026-08-05 reset because everything was
    // already opaque — the state it was asking for. Now that translucency is back, the toggle
    // is load-bearing again, and this is the assertion that keeps it honest: the blur is gated
    // on it, and the fill falls back through getGlassFill to the opaque composite.
    // ⚠️ 2026-09-06: an ambient card is opaque unconditionally now (see the BlurView test), so
    // this switch governs the `overlay`/`nav` tiers and the ambient FILL path. `glassOn` false
    // still means no blur anywhere, which is the half that must not weaken.
    const surface = read('components/Surface.tsx');
    // ⚠️ **2026-09-15, second pass: `glassSurfaces` READS AGAIN, and this assertion is a truth
    // table rather than a source scan — which is the whole point of it.**
    //
    // The history in four steps, because the shape keeps repeating: the switch reached the FILL
    // while the fill was the material; #703 made every pane opaque, so it was repointed to the
    // card edge's lit/shaded diagonal; that diagonal turned out to be what forces Android off
    // its antialiased border path (see the uniform-edge test), so it went too, leaving the
    // switch inert and its row retired; and the frosted-glass pass then gave it a real job back
    // — `paneOn` decides whether a card is painted as a lit RAMP or as a flat fill.
    //
    // ⚠️ **`paneOn` is a four-term boolean, which is exactly the shape that went constant-false
    // on 2026-09-06 while three source-text assertions were updated to match it and passed.** A
    // regex can confirm the expression exists; only evaluating it can confirm it still yields
    // `true` for a real user. So this EXTRACTS the expression and runs it over every
    // combination of its inputs — the same technique the `glassOn` predicate test used before
    // that predicate stopped existing, applied to its successor.
    const expr = surface.match(/const paneOn = ([^;]+);/)?.[1];
    expect(expr).toBeTruthy();
    const paneOn = new Function('tint', 'staticPressed', 'reduceEffects', 'glassSurfaces',
      `return ${expr};`) as (t: unknown, p: boolean, r: boolean, g: boolean) => boolean;
    const bools = [false, true];
    const table = [undefined, '#ff0000'].flatMap((tint) =>
      bools.flatMap((pressed) => bools.flatMap((reduce) => bools.map((glass) => ({
        tint, pressed, reduce, glass, on: !!paneOn(tint, pressed, reduce, glass),
      })))));
    // It is not constant in either direction: the shipped defaults light the pane, and every
    // switch can individually put it out.
    expect(table.find((r) => !r.tint && !r.pressed && !r.reduce && r.glass)!.on).toBe(true);
    expect(table.some((r) => r.on)).toBe(true);
    expect(table.some((r) => !r.on)).toBe(true);
    // Each of the four terms is load-bearing ON ITS OWN — a term that never changes the answer
    // is a term that has silently been absorbed by another, which is how `&& !isAmbient` hid.
    expect(paneOn(undefined, false, false, true)).toBe(true);
    expect(paneOn('#ff0000', false, false, true)).toBe(false);   // a caller's colour wins
    expect(paneOn(undefined, true, false, true)).toBe(false);    // held reads as held
    expect(paneOn(undefined, false, true, true)).toBe(false);    // reduce visual effects
    expect(paneOn(undefined, false, false, false)).toBe(false);  // reduce transparency
    // The switch must actually be subscribed, or the truth table above describes a function
    // nothing calls with a real value.
    expect(surface).toMatch(/useSettingsStore\(\(s\) => s\.glassSurfaces\)/);
    // `opaqueCards` stays retired: a second, narrower switch over the same property is what
    // made the 2026-08-15 pair confusing enough to need retiring at all.
    expect(surface).not.toMatch(/\(s\) => s\.opaqueCards/);
    expect(surface).not.toMatch(/const litEdgeOn\b/);
    // Nothing may quietly reintroduce a translucent ambient fill — the ramp is opaque at BOTH
    // stops, which is what keeps the particle repaint chain cut (see Surface.tsx's block).
    expect(surface).toMatch(/const fill = staticPressed \? theme\.surfaceMuted : tint \?\? opaqueFill;/);
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      [p.glassTop, p.glassBottom, p.glassTopRaised, p.glassBottomRaised].forEach((stop) => {
        expect(stop).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  it('the painted glass and the measured composite agree', () => {
    // The load-bearing invariant of the whole material. `surfaceGlass` is what gets painted;
    // `surface` is the same colour already composited over the backdrop, and is what every
    // contrast assertion in lib/__tests__/colors.test.ts measures. If the two drift, those
    // assertions keep passing while measuring a colour the app no longer draws — the exact
    // shape of the "a comment asserted a safety property nothing checked" bug AGENTS.md
    // records from PR #540.
    //
    // ⚠️ **This is a token-DERIVATION check, and its ground is a reference, not a claim about
    // every pixel.** Dark's `base` is still three `#000000` stops, but since 2026-09-06 the
    // washes are lit across the card column, so a real card sits on a ground BRIGHTER than this
    // — that is the point of the material. What this test pins is that `surface` remains
    // exactly `surfaceGlass` over the unlit reference, so the two tokens cannot drift apart.
    // What bounds the lit case is `lib/__tests__/glassBudget.test.ts`, which measures the
    // composite over the real field; the two tests are complements and neither replaces the
    // other. Light's ground is the backdrop gradient's DARKEST stop.
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      expect(compositeOverGround(p.surfaceGlass, mode)).toBe(p.surface.toUpperCase());
    });
  });

  it('a sheet — and now the nav bar — never lets the card behind it through', () => {
    // Maintainer, 2026-08-18, against a screenshot of the per-card ⋮ sheet: *"Cards
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
    // ⚠️ **`overlapsCards` no longer gates a fill, because no tier has a translucent one
    // (2026-09-14).** It is kept because the DISTINCTION is still real and still load-bearing:
    // overlay/nav paint the raised rung, ambient the base one. The guarantee this test exists
    // for — a sheet never lets the card behind it through — is now structural rather than
    // conditional, so it is asserted directly on the fill instead of on a gate.
    expect(surface).toMatch(/const fill = staticPressed \? theme\.surfaceMuted : tint \?\? opaqueFill;/);
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
  it('light: the pane edge is the SAME colour on both sides, quieter where the light lands', () => {
    // ⚠️ **Reversed 2026-09-01, and the old assertion was pinning the defect.** It required the
    // lit stop to be `rgba(255, 255, 255, …)` — 95% white on a `#FDFEFF` card, i.e. nothing at
    // all — while the shaded stop carried `theme.border` at full alpha. That is a card with a
    // hard slate line on two sides and no boundary whatever on the other two, which is what
    // "edges look off" was reporting.
    //   White is the light source on a BLACK ground. On a white one the card is already the
    // brightest thing, so the same diagonal has to run the other way: one hue, held back on the
    // top-left, full on the bottom-right. The contrast promise is unchanged and is still only
    // ever the shaded side.
    const p = THEMES.default.light;
    const [lit, shade] = getGlassEdge(p.border, false).colors;
    expect(shade).toBe(rgba(p.border, 1));
    expect(lit).toBe(rgba(p.border, 0.3));
    expect(lit).not.toMatch(/^rgba\(255, 255, 255,/);
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
      // ⚠️ **This used to pin the literal `0.1x` alpha, and the literal was pinning a DEFECT.**
      // At `litDark: 0.16` the lit stop composited to rgb(71,71,71) on a `#242424` card while
      // the shade stop drew rgb(138,138,149) — the SHADED side was nearly twice as bright as
      // the LIT one, so the pane was lit from the bottom-right while every doc in the repo said
      // top-left. It read as a drawn frame, which is what the maintainer reported on 2026-09-12.
      //   So assert the PROPERTY the design promises, not the number that happened to be there:
      // the lit side is white, and it is brighter than the shaded side. A future retune is free
      // to move the value and can never silently re-invert the light source.
      expect(ramp.colors[0]).toMatch(/^rgba\(255, 255, 255, 0?\.\d+\)$/);
      expect(compositeLuminance(ramp.colors[0], p.surface)).toBeGreaterThan(
        compositeLuminance(ramp.colors[1], p.surface),
      );
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
    // ⚠️ The second half was `getGlassEdge(edgeHue, isDark, 'card'` until 2026-09-15. The ramp
    // is one flat colour now and `getGlassEdge` is not called from here at all — see the
    // uniform-edge test below for the property that replaced it, and why.
    expect(/colors: \[edgeHue, edgeHue\]/.test(src)).toBe(true);
  });

  /**
   * ⚠️ **The corner fix, stated as the property Android actually tests — not as a style.**
   *
   * React Native's `BorderDrawable` (ReactAndroid, `drawable/BorderDrawable.kt`) takes its
   * ANTIALIASED path — `canvas.drawRoundRect` with `Paint.ANTI_ALIAS_FLAG` — only when all four
   * border widths AND **all four border colours** are equal. Any per-side colour difference
   * falls to the `clipPath` + four-filled-quadrilaterals branch, and `clipPath` is not
   * antialiased on a hardware-accelerated canvas. The fill underneath IS antialiased
   * (`BackgroundDrawable`), so the result is a stair-stepped rim cutting across a smoothly-drawn
   * fill corner: the maintainer's *"borders look weird and corners are clipped"*.
   *
   * So the lit/shaded diagonal was never only a look — on Android it selected a rendering mode,
   * and it cost every card and the nav bar their corners, always. This pins that the four
   * `borderColor`s come from ONE value, which is the whole of what keeps the fast path.
   *
   * Not a source-text assertion about a predicate (the CLAUDE.md A2 lesson): it reads the four
   * assignments and asserts they are the SAME expression, so re-introducing a second colour
   * fails here no matter how it is spelled.
   */
  /**
   * ⚠️ **The same property, for every BUTTON — and this is the gap that let #706 ship half a fix.**
   *
   * #706 made the card's rim uniform and stopped there. `glassKey()` kept a lit top-left and a
   * shaded bottom-right, and it draws every `Button` in the app, `AppModal`'s keys and the sheet
   * done-buttons — so those corners stayed on Android's un-antialiased `clipPath` path while the
   * cards around them were fixed. The guard above could not see it because it only ever read
   * `Surface.tsx`.
   *
   * So the rule is asserted where the rule lives: any function that hands React Native four
   * `border*Color` keys has to hand it four of the SAME value.
   */
  it('gives every key the same four border colours, for the same reason a card does', () => {
    const src = read('constants/theme.ts');
    const body = /export function glassKey\([\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(body).not.toBe('');
    const sides = ['borderTopColor', 'borderLeftColor', 'borderBottomColor', 'borderRightColor']
      .map((side) => new RegExp(`${side}:\\s*([^,\\n]+)`).exec(body)?.[1]?.trim());
    expect(sides.every(Boolean)).toBe(true);
    expect(new Set(sides).size).toBe(1);
  });

  it('paints all four border sides from one colour, or Android stops antialiasing the corners', () => {
    const src = read('components/Surface.tsx');
    const sides = ['borderTopColor', 'borderLeftColor', 'borderBottomColor', 'borderRightColor']
      .map((side) => {
        const m = new RegExp(`${side}:\\s*([^,\\n]+)`).exec(src);
        expect(m).not.toBeNull();
        return m![1].trim();
      });
    // All four must resolve to the same ramp value. `ramp.colors[0]` and
    // `ramp.colors[ramp.colors.length - 1]` are only equal because the ramp is a flat pair, so
    // assert the ramp itself is flat rather than trusting the two indices to agree.
    expect(/colors: \[edgeHue, edgeHue\]/.test(src)).toBe(true);
    const distinct = new Set(sides);
    expect(distinct.size).toBeLessThanOrEqual(2);
    // …and if there are two spellings, they must be the two ends of that flat pair — never two
    // different stops of a ramp.
    for (const s of distinct) expect(s).toMatch(/ramp\.colors\[(0|ramp\.colors\.length - 1)\]/);
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
  // TWO since 2026-09-09, not three: the ambient cast pass (26px blur at `raised`, 42px at
  // `floating`) was dropped as a perf change — see getLayeredShadow's own comment for the
  // reasoning and for what to reach for first if the depth needs restoring.
  it('returns two shadow passes (contact / near)', () => {
    expect(getLayeredShadow('#000', 'raised')).toHaveLength(2);
  });

  it('floating tier is deeper than raised', () => {
    const raised = getLayeredShadow('#000', 'raised');
    const floating = getLayeredShadow('#000', 'floating');
    // Indexed to the LAST pass rather than a literal 2, so this keeps asserting the deepest
    // pass whatever the count becomes.
    const last = raised.length - 1;
    expect(floating[last].blurRadius).toBeGreaterThan(raised[last].blurRadius);
    expect(floating[last].offsetY).toBeGreaterThan(raised[last].offsetY);
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

  it('the reduce-transparency switch reaches something visible, and has its row back', () => {
    // ⚠️ **This test has been repointed four times, and the property it protects has never
    // changed: a settings toggle must be able to change something a user can see, and this
    // guard must be able to notice when it cannot.** It has been 'opaqueCards is scoped to
    // CARDS', then 'the reduce-transparency switch still does something visible', then — when
    // #703 left `glassSurfaces` with nothing to reduce and the row was retired — 'offers no
    // Settings row for a switch that reaches nothing'.
    //
    // That last version set an explicit condition for undoing itself: *"Don't re-add this row
    // without giving it something visible to do first."* The frosted-glass pass met it. A card
    // is painted as a lit ramp with a specular rim now (constants/theme.ts's `getGlassPane`),
    // and this switch paints it flat instead — the same "reduce transparency" job it always
    // had, stated in terms of the material the app actually draws. So the assertion inverts
    // again, and BOTH halves are checked: the row exists, and the thing it drives is real.
    const settingsSrc = read('app/settings.tsx');
    // The row is bound in both directions. A `checked` with no `onChange` is a switch that
    // cannot be moved; an `onChange` with no `checked` is one that never shows its own state.
    expect(settingsSrc).toMatch(/checked=\{settings\.glassSurfaces\}/);
    expect(settingsSrc).toMatch(/glassSurfaces: v/);
    // ...and it is subscribed, or the row renders a stale value forever. This is the specific
    // way app/settings.tsx can break: its selector is one typed pick, and a field missing from
    // it is not a type error at a `settings.x` read.
    expect(settingsSrc).toMatch(/glassSurfaces: s\.glassSurfaces/);
    // Copy in all three languages, or `tsc` would have caught it — but a row whose label is an
    // empty string would not be caught by anything else.
    (['en', 'no', 'is'] as const).forEach((lang) => {
      const a = getTranslations(lang).settings.accessibility;
      expect(a.glassSurfaces.length).toBeGreaterThan(0);
      expect(a.glassSurfacesHint.length).toBeGreaterThan(0);
    });
    // ⚠️ **The FIELD and its DB column stay whatever the row does** (never-drop rule — see
    // store/useSettingsStore.ts, lib/db.ts), and it defaults ON, so a new install gets the lit
    // pane rather than the flat fallback.
    expect(useSettingsStore.getState().glassSurfaces).toBe(true);

    // The other switch has to still be real, or this one just took over its job. `reduceEffects`
    // takes the card shadows and the backdrop's orb field — the per-frame GPU costs — and is a
    // strictly wider hammer than the material choice above.
    const surface = read('components/Surface.tsx');
    expect(surface).toMatch(/reduceEffects/);
    // The tier pairing survives all of it: ambient paints the base rung, overlay/nav the raised
    // one. This is the colour every contrast test in the repo measures, so it must keep
    // resolving through the pairing rather than picking a literal. The ramp added its own
    // parallel pairing (`glassTop`/`glassTopRaised`), asserted beside it.
    expect(surface).toMatch(/const opaqueFill = isAmbient \? theme\.surface : theme\.surfaceRaised;/);
    expect(surface).toMatch(/isAmbient \? theme\.glassTop : theme\.glassTopRaised/);
    expect(surface).toMatch(/isAmbient \? theme\.glassBottom : theme\.glassBottomRaised/);
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
  // ── 2026-08-26 (DESIGN_COMPARISON/19 phase 1, dark `surface`) ─────────────────────────────
  // Raising `surface` raised the well it is recessed FROM too: the composite (`getRecessedField`,
  // 35% toward black) moved `#141414` → `#171717` (via a rejected `#1D1D1D` at the phase's first
  // `#2C2C2C` surface attempt), and white text on it moved **18.42:1 → 17.93:1**. It did NOT
  // land under the primary 17:1 ceiling this time (unlike the rejected `#2C2C2C` attempt's
  // 16.86:1): the well is structurally darker than `surface`, so at `surface`'s corrected,
  // smaller lift (`#242424`, 15.52:1 on `surface` itself) the well still exceeds 17 (17.93:1),
  // which is exactly why this SEPARATE bound exists rather than folding into the 17:1 one — see
  // the reasoning below, now demonstrated rather than hypothetical.
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

describe('the pane is painted ON its fill, with nothing behind it', () => {
  /**
   * ⚠️ **The defect this exists for shipped for twelve days and every test in this file stayed
   * green through it** (2026-08-27, round 20; user report: *"This looks too stale, not like
   * glass."*).
   *
   * `components/Surface.tsx` drew its edge as a full-area `LinearGradient` with the fill mask
   * inside it, inset by the border width. That is a ring only while the mask is OPAQUE — which
   * the render site's own comment asserted it was, and which stopped being true on 2026-08-15
   * when the fill became `surfaceGlass`, 86% transparent. So the ramp washed the whole pane:
   * measured `rgb(75,70,82)` → `rgb(135,135,148)` across one card where this file's assertions
   * all assume a flat `#242424`.
   *
   * Every composite check in this file was therefore measuring a colour no card drew. At the
   * centre of a pane all five identity hues fail AA; at the bottom, white body text falls to
   * 3.55:1. **That is what a passing suite looked like.**
   *
   * ── Renamed 2026-09-15: the pane has a RAMP now, and that is not this bug ────────────────
   * The frosted-glass pass gave a card a gradient across its face, so "ONE flat fill" — which
   * is what this block used to be called — would now be a name for something the app has
   * deliberately stopped doing, sitting on top of assertions that still pass. That is the
   * green-but-stale shape this very file was written to catch, so the name moved to the
   * property that actually matters and has never changed:
   *
   *   **BEHIND the fill is where the bug lives; ON the fill is where the material lives.**
   *
   * A `<LinearGradient>` is a separate VIEW, and a view under a pane can only be seen by
   * shining through it — so mounting one is either invisible (opaque pane) or a wash across the
   * whole card (translucent pane), which is exactly what shipped. `getGlassPane`'s ramp is a
   * `backgroundImage` on the fill view ITSELF: it replaces what that one view paints rather
   * than adding a layer under it, both of its stops are opaque hexes, and nothing composites
   * through it. The two are not the same technique and the difference is the whole finding.
   */
  const surface = readFileSync(join(ROOT, 'components/Surface.tsx'), 'utf8');

  it('mounts no gradient VIEW behind the fill', () => {
    // A gradient view anywhere in this component is the shape of the bug: the only way one can
    // be drawn here is as a layer under or over the pane, and both wash it.
    expect(surface).not.toMatch(/<LinearGradient/);
    expect(surface).not.toMatch(/from 'expo-linear-gradient'/);
  });

  it('paints the ramp on the fill view itself, and both its stops are opaque', () => {
    // The structural half: the ramp is a background-image key, which is a property of the view
    // that already paints `fill`, not a child or a sibling of it.
    expect(surface).toMatch(/experimental_backgroundImage/);
    expect(surface).toMatch(/backgroundColor: fill,/);
    // The colour half, and the one that keeps the 2026-09-14 particle ruling intact: every stop
    // the ramp can paint is a six-digit hex. An `rgba()` stop here would reopen the repaint
    // chain (a card sampling the backdrop) while every assertion in this file went on measuring
    // an opaque composite — the same two-sided failure as the wash above.
    (['light', 'dark'] as const).forEach((mode) => {
      const p = THEMES.default[mode];
      [p.glassTop, p.glassBottom, p.glassTopRaised, p.glassBottomRaised].forEach((stop) => {
        expect(stop).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
    // ...and the rim is an inset shadow at ZERO blur, not a blurred one. A blur radius here is a
    // GPU pass per card per frame — the cost `getLayeredShadow` dropped a whole pass to avoid.
    const pane = getGlassPane('#3B3B45', '#232328', 'rgba(255,255,255,0.38)', 'rgba(0,0,0,0.55)');
    expect(pane.insets).toHaveLength(2);
    pane.insets.forEach((i) => {
      expect(i.blurRadius).toBe(0);
      expect(i.inset).toBe(true);
    });
    // Lit on top, shaded underneath — a pane lit from below is not a pane, it is a footlight.
    expect(pane.insets[0].offsetY).toBeGreaterThan(0);
    expect(pane.insets[1].offsetY).toBeLessThan(0);
  });

  it('draws the edge as per-side border colours, the way glassKey already does', () => {
    // All four sides from one ramp — see 'paints all four border sides from one colour' for why
    // Android requires them EQUAL, and why the lit/shaded diagonal had to leave the border and
    // come back as the inset rim asserted above.
    for (const side of ['borderTopColor', 'borderLeftColor', 'borderBottomColor', 'borderRightColor']) {
      expect(surface).toMatch(new RegExp(`${side}: ramp\\.colors\\[`));
    }
  });
});
