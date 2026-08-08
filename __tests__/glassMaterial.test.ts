/**
 * glassMaterial.test.ts — what is LEFT of the glass model, and the promises that outlived it.
 *
 * The frosted-glass system this file was written for is gone: `Surface` and `Button` dropped it
 * in the 2026-08-05 card reset, `AddFAB` (the last `GlassFill` mount) was flattened on
 * 2026-08-08, and `getMaterialStyle` + `components/GlassFill.tsx` were deleted with it. What
 * survives here is the part anything still calls — `filledEdge`, `getGlow`, `getLayeredShadow`
 * — plus a SOURCE SCAN standing in for the assertions that used to guard the deleted recipe.
 *
 * That scan is the point of keeping this file. `DESIGN_COMPARISON/16-solid-pressable-materials.md`
 * §2 says, in as many words, "do not re-add the specular highlight — glassMaterial.test.ts will
 * fail, and correctly". It used to fail via `expect('specular' in getMaterialStyle(...))`, which
 * is vacuous once the function is gone, so the promise is enforced against the source instead.
 * "Hard and solid" was never the same request as "glossy".
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { filledEdge, getLayeredShadow, getGlow, rgba, lighten } from '@/constants/theme';
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

  it('the three flat surfaces mount no BlurView', () => {
    const files = ['components/Surface.tsx', 'components/Button.tsx', 'components/AddFAB.tsx'];
    const offenders = files.filter((f) => /<BlurView/.test(read(f)));
    expect(offenders).toEqual([]);
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
  it('glassSurfaces still defaults on, and is now inert everywhere', () => {
    // It was the reduce-transparency a11y toggle. Every surface it could reduce is already
    // opaque unconditionally — Surface and Button since 2026-08-05, AddFAB (the last holdout)
    // since 2026-08-08 — so the app now behaves as if it were permanently ON, which is what
    // that toggle was asking for. The setting and its DB column stay: this repo never drops
    // columns, and the default is pinned here so a migration can't quietly flip it.
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
