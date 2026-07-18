/**
 * glassMaterial.test.ts — the glass model's pure token logic (frost + wash + glow + the
 * "Glass, take two" static rim/scrim/specular/fillGradient, 2026-07-18): getMaterialStyle's
 * MaterialStyle + card-vs-button + light-vs-dark tuning, getLayeredShadow's three-pass depth,
 * getGlow's colored halo, and the glassSurfaces setting default. Native/visual rendering
 * (GlassFill's blur/gradient/svg layers) is out of scope here — that needs a device or the web
 * preview.
 */
import { getMaterialStyle, getLayeredShadow, getGlow, rgba, lighten, darken, MaterialVariant } from '@/constants/theme';

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

describe('getMaterialStyle', () => {
  const base = '#3366CC';

  it.each<MaterialVariant>(['card', 'button'])('%s variant returns the trimmed MaterialStyle with sane values', (variant) => {
    const mat = getMaterialStyle(base, variant);
    expect(mat.backgroundColor).toMatch(/^rgba\(/);
    expect(mat.borderWidth).toBeGreaterThan(0);
    expect(mat.borderColor).toMatch(/^rgba\(/);
    expect(mat.borderTopColor).toMatch(/^rgba\(/);
    expect(mat.borderBottomColor).toMatch(/^rgba\(/);
    expect(mat.shadowOpacity).toBeGreaterThan(0);
    expect(mat.shadowRadius).toBeGreaterThan(0);
    expect(mat.elevation).toBeGreaterThan(0);
    // Back-compat: contrastBase is the opaque hex equivalent — FoodTab's direct consumer
    // (and contrastOn() callers generally) need a parsable hex, not the translucent fill.
    expect(mat.contrastBase).toMatch(/^#/);
    expect(mat.washAlpha).toBeGreaterThan(0);
    expect(mat.washAlpha).toBeLessThanOrEqual(1);
  });

  it('button variant is denser (higher wash) than card for CTA contrast', () => {
    const card = getMaterialStyle(base, 'card');
    const btn = getMaterialStyle(base, 'button');
    expect(btn.washAlpha).toBeGreaterThan(card.washAlpha);
  });

  it('ambient card wash sits at the bumped 0.66 base (Glass, take two)', () => {
    expect(getMaterialStyle(base, 'card').washAlpha).toBeCloseTo(0.66);
  });
});

describe('getMaterialStyle — take-two static layers', () => {
  const base = '#3366CC';

  it('rim/scrim gradients have matching-length colour + location stops (expo-linear-gradient contract)', () => {
    const mat = getMaterialStyle(base, 'card', 'light');
    expect(mat.rim.colors.length).toBeGreaterThanOrEqual(2);
    expect(mat.rim.colors.length).toBe(mat.rim.locations.length);
    expect(mat.scrim.colors.length).toBe(mat.scrim.locations.length);
    // Scrim fades to fully transparent white so text below it isn't washed out.
    expect(mat.scrim.colors[mat.scrim.colors.length - 1]).toBe(rgba('#FFFFFF', 0));
  });

  it('raised-keycap rim is hue-tinted (not pure white) with a crisp top-weighted lit band', () => {
    const light = getMaterialStyle(base, 'card', 'light');
    // Rim top stop is derived from the base hue (lighten), NOT a pure-white streak — so the edge
    // tints to the surface's own colour (2026-07-18 retune). base #3366CC → lighten keeps a blue cast.
    expect(light.rim.colors[0]).toBe(rgba(lighten(base, 0.42), 0.85));
    expect(light.rim.colors[0]).not.toBe(rgba('#FFFFFF', 0.85));
    // Bright band pushed to the top edge (crisp lit lip, not a half-height fade): mid stop ≤ 0.25.
    expect(light.rim.locations[1]).toBeLessThanOrEqual(0.25);
    // Bottom rim stop is a soft dark hue-shadow (the chamfer's shadowed edge), not white.
    expect(light.rim.colors[light.rim.colors.length - 1]).toBe(rgba(darken(base, 0.14), 0.34));
  });

  it('dark mode dims the rim + specular vs light (no harsh streak on near-black)', () => {
    const light = getMaterialStyle(base, 'card', 'light');
    const dark = getMaterialStyle(base, 'card', 'dark');
    // Dark-mode rim top lip is lower-alpha than light so it doesn't glare on near-black.
    const lightTopAlpha = Number(light.rim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    const darkTopAlpha = Number(dark.rim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    expect(darkTopAlpha).toBeLessThan(lightTopAlpha);
    expect(dark.specular.centerOpacity).toBeLessThan(light.specular.centerOpacity);
  });

  it('exposes a hue-tinted innerLine (the "double keycap" second edge), brighter in light mode', () => {
    const light = getMaterialStyle(base, 'card', 'light');
    const dark = getMaterialStyle(base, 'card', 'dark');
    // Present, and a parsable rgba() (Surface/Button/AddFAB draw it as the inner mask border).
    expect(light.innerLine).toMatch(/^rgba\(/);
    expect(dark.innerLine).toMatch(/^rgba\(/);
    // Hue-tinted, not neutral grey/white — derived from the base.
    expect(light.innerLine).toBe(rgba(lighten(base, 0.06), 0.5));
    // Light mode reads more present than dark (higher alpha) so the edge stays calm on near-black.
    const lightAlpha = Number(light.innerLine.match(/,\s*([\d.]+)\)$/)![1]);
    const darkAlpha = Number(dark.innerLine.match(/,\s*([\d.]+)\)$/)![1]);
    expect(lightAlpha).toBeGreaterThan(darkAlpha);
  });

  it('specular is a wide, diffuse top sheen (frosted, not a tight glossy bead)', () => {
    const { specular } = getMaterialStyle(base, 'card', 'light');
    // Anchored toward the top, widened + dimmed vs the old sharp top-left bead (cx16/cy6/0.6).
    expect(specular.cx).toBe('28%');
    expect(specular.cy).toBe('8%');
    expect(specular.edgeOffset).toBe('82%');
    expect(specular.centerOpacity).toBeLessThan(0.2);
  });

  it('button fillGradient runs light→base→dark, pre-alpha`d to the button wash', () => {
    const mat = getMaterialStyle('#3366CC', 'button', 'light');
    expect(mat.fillGradient).toHaveLength(3);
    // Every stop carries the button wash alpha (0.9) so it drops in for the flat wash.
    mat.fillGradient.forEach((c) => expect(c).toContain(', 0.9)'));
    // Middle stop is the base hue itself.
    expect(mat.fillGradient[1]).toBe(rgba('#3366CC', 0.9));
  });
});

describe('getGlow', () => {
  const color = '#3366CC';

  it('returns a two-pass boxShadow halo tinted with the passed color', () => {
    const glow = getGlow(color, 'soft');
    expect(glow.boxShadow).toHaveLength(2);
    expect(glow.boxShadow[0].color).toBe(rgba(color, 0.34));
    expect(glow.boxShadow[1].color).toBe(rgba(color, 0.17));
  });

  it("'strong' has a larger radius and higher alpha than 'soft'", () => {
    const soft = getGlow(color, 'soft');
    const strong = getGlow(color, 'strong');
    expect(strong.boxShadow[0].blurRadius).toBeGreaterThan(soft.boxShadow[0].blurRadius);
    expect(strong.boxShadow[0].color).toBe(rgba(color, 0.55));
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
  it('glassSurfaces defaults on so a fresh install shows glass', () => {
    // glassBlur (the Android backdrop-blur toggle) was removed in the 2026-07-18
    // simplification along with the BlurTarget system it gated — glassSurfaces (the
    // reduce-transparency a11y toggle) is the only glass setting left.
    const { useSettingsStore } = require('@/store/useSettingsStore');
    expect(useSettingsStore.getState().glassSurfaces).toBe(true);
  });
});

describe('voice settings', () => {
  it('voiceNotesEnabled defaults ON so the task-form mic is available out of the box', () => {
    // 2026-07-18: enabled by default; existing installs flipped on by a one-time UPDATE
    // migration in lib/db.ts. Notes/Home mic buttons render regardless of this flag.
    const { useSettingsStore } = require('@/store/useSettingsStore');
    expect(useSettingsStore.getState().voiceNotesEnabled).toBe(true);
  });
});
