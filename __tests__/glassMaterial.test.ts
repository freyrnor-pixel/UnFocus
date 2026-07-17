/**
 * glassMaterial.test.ts — "Glass, take two" token logic + the glassSurfaces setting default.
 *
 * Covers the pure, headless bits of the surface-material overhaul: getMaterialStyle's
 * card-vs-button tuning, getLayeredShadow's three-pass depth, and that the new
 * glassSurfaces toggle defaults on (a fresh install shows glass). Native/visual rendering
 * (GlassFill's blur/rim/specular) is out of scope here — that needs a device.
 */
import { getMaterialStyle, getLayeredShadow } from '@/constants/theme';

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

  it('exposes the take-two layer tokens', () => {
    const mat = getMaterialStyle(base);
    expect(mat.rimColors).toHaveLength(3);
    expect(mat.specularColor).toMatch(/rgba\(255, 255, 255/);
    expect(mat.scrimColor).toMatch(/rgba\(/);
    expect(mat.driftSheenColor).toMatch(/rgba\(/);
    expect(typeof mat.washAlpha).toBe('number');
    // Back-compat: existing keys still present for FoodTab's direct consumer.
    expect(mat.contrastBase).toMatch(/^#/);
  });

  it('button variant is denser (higher wash, stronger scrim) than card for CTA contrast', () => {
    const card = getMaterialStyle(base, 'card');
    const btn = getMaterialStyle(base, 'button');
    expect(btn.washAlpha).toBeGreaterThan(card.washAlpha);
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

describe('glassSurfaces setting', () => {
  it('defaults on so a fresh install shows glass', () => {
    const { useSettingsStore } = require('@/store/useSettingsStore');
    expect(useSettingsStore.getState().glassSurfaces).toBe(true);
  });
});
