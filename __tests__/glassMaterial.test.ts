/**
 * glassMaterial.test.ts — the simplified glass model's pure token logic (frost + wash + glow,
 * 2026-07-18): getMaterialStyle's trimmed MaterialStyle + card-vs-button tuning,
 * getLayeredShadow's three-pass depth, getGlow's colored halo, and the glassSurfaces setting
 * default. Native/visual rendering (GlassFill's blur/wash) is out of scope here — that needs
 * a device or the web preview.
 */
import { getMaterialStyle, getLayeredShadow, getGlow, rgba, MaterialVariant } from '@/constants/theme';

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
