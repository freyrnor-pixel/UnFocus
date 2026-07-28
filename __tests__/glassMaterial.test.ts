/**
 * glassMaterial.test.ts — the glass model's pure token logic (frost + wash + glow + the
 * "Glass, take two" static rim/scrim/specular/fillGradient, 2026-07-18): getMaterialStyle's
 * MaterialStyle + card-vs-button + light-vs-dark tuning, getLayeredShadow's three-pass depth,
 * getGlow's colored halo, and the glassSurfaces setting default. Native/visual rendering
 * (GlassFill's blur/gradient/svg layers) is out of scope here — that needs a device or the web
 * preview.
 */
import { getMaterialStyle, getLayeredShadow, getGlow, rgba, lighten, darken, MaterialVariant } from '@/constants/theme';
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
    // The face lift passes through fully transparent so text under it isn't washed out.
    expect(mat.scrim.colors[1]).toBe(rgba('#FFFFFF', 0));
  });

  it('keeps the cap MATTE — a faint lift, gone by 42%, and a barely-there bottom shade', () => {
    // Guards the 2026-07-28 matte pass. design-system v6 `handoff/BUTTONS.md`: "matte, not
    // glossy… no specular highlight, no white gloss arc." The old finish was white at 0.22
    // fading across HALF the height, which read as a glossy dome; if these numbers creep back
    // up, the gloss is back.
    const light = getMaterialStyle(base, 'card', 'light');
    const topAlpha = Number(light.scrim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    expect(topAlpha).toBeLessThanOrEqual(0.1);
    // Gone by 42% of the height — a lift that stops reads as a flat lit face; one that fades
    // across the whole surface reads as curvature.
    expect(light.scrim.locations[1]).toBeLessThanOrEqual(0.42);
    // Bottom shade is a 4% black, not another white stop.
    expect(light.scrim.colors[light.scrim.colors.length - 1]).toBe(rgba('#000000', 0.04));
  });

  it('has no specular highlight at all', () => {
    // Removed 2026-07-28 — the soft white radial blob on top of the face lift was the gloss.
    // This asserts the token is GONE, not merely dimmed, so it can't be quietly reintroduced.
    expect('specular' in getMaterialStyle(base, 'card', 'light')).toBe(false);
  });

  it('rim is a flat moulded top edge, not a bright domed chamfer', () => {
    // 2026-07-28 matte pass. The top stop used to be lighten(base, 0.42) at 0.85 alpha — a
    // near-white band that read as a wet, domed edge curving toward the viewer. v6's
    // `handoff/BUTTONS.md` puts the whole lift in `inset 0 1px 0 rgba(255,255,255,.22)`.
    const light = getMaterialStyle(base, 'card', 'light');
    expect(light.rim.colors[0]).toBe(rgba('#FFFFFF', 0.22));
    // It STOPS rather than fading — a stop within the first eighth of the height reads as a
    // chamfer; a long fade reads as curvature.
    expect(light.rim.locations[1]).toBeLessThanOrEqual(0.15);
    expect(light.rim.colors[1]).toBe(rgba('#FFFFFF', 0));
    // The bottom stop stays a soft hue-dark line — that's the moulded base edge under the cap,
    // which is what makes the press travel legible. It is NOT a shadow and NOT white.
    expect(light.rim.colors[light.rim.colors.length - 1]).toBe(rgba(darken(base, 0.16), 0.38));
  });

  it('dark mode dims the rim vs light (no harsh streak on near-black)', () => {
    const light = getMaterialStyle(base, 'card', 'light');
    const dark = getMaterialStyle(base, 'card', 'dark');
    const lightTopAlpha = Number(light.rim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    const darkTopAlpha = Number(dark.rim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    expect(darkTopAlpha).toBeLessThan(lightTopAlpha);
    const lightLift = Number(light.scrim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    const darkLift = Number(dark.scrim.colors[0].match(/,\s*([\d.]+)\)$/)![1]);
    expect(darkLift).toBeLessThan(lightLift);
  });

  it('exposes a hue-tinted innerLine (the "double keycap" second edge), brighter in light mode', () => {
    const light = getMaterialStyle(base, 'card', 'light');
    const dark = getMaterialStyle(base, 'card', 'dark');
    // Present, and a parsable rgba() (Surface/Button/AddFAB draw it as the inner mask border).
    expect(light.innerLine).toMatch(/^rgba\(/);
    expect(dark.innerLine).toMatch(/^rgba\(/);
    // Hue-tinted, not neutral grey/white — derived from the base.
    // (0.65, not 0.5 — bumped by the 2026-07-24 contrast pass, #338.)
    expect(light.innerLine).toBe(rgba(lighten(base, 0.06), 0.65));
    // Light mode reads more present than dark (higher alpha) so the edge stays calm on near-black.
    const lightAlpha = Number(light.innerLine.match(/,\s*([\d.]+)\)$/)![1]);
    const darkAlpha = Number(dark.innerLine.match(/,\s*([\d.]+)\)$/)![1]);
    expect(lightAlpha).toBeGreaterThan(darkAlpha);
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
