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

describe('glass settings', () => {
  it('glassSurfaces defaults on so a fresh install shows glass', () => {
    const { useSettingsStore } = require('@/store/useSettingsStore');
    expect(useSettingsStore.getState().glassSurfaces).toBe(true);
  });

  it('glassBlur (Android backdrop blur) defaults OFF', () => {
    // 2026-07-18: the per-card dimezis backdrop blur was the heaviest glass cost and could
    // intercept taps on Android, so it now defaults off (users can re-enable in Settings).
    // Existing installs are flipped off by a one-time UPDATE migration in lib/db.ts.
    const { useSettingsStore } = require('@/store/useSettingsStore');
    expect(useSettingsStore.getState().glassBlur).toBe(false);
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
