/**
 * splashHandoff.test.ts — the native splash and its JS continuation cannot drift apart.
 *
 * A cold start is drawn by two things that can't see each other: app.json's expo-splash-screen
 * block (baked into the build) and components/LaunchReveal.tsx (ships OTA). The reveal works
 * only because its first frame is IDENTICAL to the splash's last one — same field colour, same
 * logo, same rendered width — and nothing in tsc, in a screenshot or in the web preview can see
 * a mismatch, because the web preview has no native splash to compare against at all. So the
 * agreement is asserted here, over constants/splash.ts as the single description both copy.
 *
 * Same shape as lib/widgets/__tests__/widgetPalette.test.ts: a hand-copied constant with a
 * comment telling you to keep it in step is not a mechanism.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  LAUNCH_LOGO_LIFT,
  LAUNCH_NAME_RISE,
  SPLASH_BACKGROUND,
  SPLASH_IMAGE_WIDTH,
  SPLASH_INK,
  SPLASH_WORDMARK,
} from '@/constants/splash';
import { Duration } from '@/constants/motion';

// constants/motion.ts pulls reanimated's `Easing` to build its `Ease` presets, and reanimated's
// worklets half throws on require in the node env. Only `Duration` (plain numbers) is read here,
// so a bare stub is enough — same approach as lib/__tests__/designTokens.test.ts. babel-jest
// hoists this above the imports, so it is in place before they evaluate.
jest.mock('react-native-reanimated', () => ({
  Easing: { out: () => null, in: () => null, inOut: () => null, cubic: null, bezier: () => null },
}));

const ROOT = join(__dirname, '..', '..');
const appJson = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
const reveal = readFileSync(join(ROOT, 'components', 'LaunchReveal.tsx'), 'utf8');

function splashPlugin(): Record<string, any> {
  const entry = appJson.expo.plugins.find(
    (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen',
  );
  expect(entry).toBeDefined();
  return entry[1];
}

describe('app.json agrees with constants/splash.ts', () => {
  const splash = splashPlugin();

  test('the field is the logo colour in both appearances', () => {
    // BOTH, and they are the same: the field belongs to the LOGO, not to the app's theme, so a
    // dark-mode install gets the same white card-less field a light one does. Setting `dark`
    // to the app's black would put the sticker-on-black look back for most users, since dark
    // is the default appearance (2026-08-16).
    expect(splash.backgroundColor).toBe(SPLASH_BACKGROUND);
    expect(splash.dark.backgroundColor).toBe(SPLASH_BACKGROUND);
  });

  test('the logo is the same asset at the same width on both sides of the handoff', () => {
    expect(splash.image).toBe('./assets/icon.png');
    expect(splash.dark.image).toBe(splash.image);
    expect(splash.imageWidth).toBe(SPLASH_IMAGE_WIDTH);
    // `contain` on a square image is what makes imageWidth the rendered box, which is the
    // number LaunchReveal's `mark` style reproduces.
    expect(splash.resizeMode).toBe('contain');
    expect(reveal).toContain("require('../assets/icon.png')");
  });

  test('the wordmark is the app name, not a second spelling of it', () => {
    expect(SPLASH_WORDMARK).toBe(appJson.expo.name);
  });
});

describe('the launch field is legible and stays a handoff', () => {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  test('the wordmark clears WCAG AA on the field', () => {
    const [a, b] = [luminance(SPLASH_INK), luminance(SPLASH_BACKGROUND)].sort((x, y) => y - x);
    // 7.38:1 as shipped. Asserted at the AA floor so a future "nicer" blue sampled off the
    // canopy (which is pale — 1.5:1 territory) fails here rather than on a device.
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  test('the reveal moves the mark, it does not relocate it', () => {
    // The lift re-centres logo+name as a pair; a big one would mean the logo is somewhere else
    // than the splash left it, which is the jump this whole component exists to avoid.
    expect(LAUNCH_LOGO_LIFT).toBeGreaterThan(0);
    expect(LAUNCH_LOGO_LIFT).toBeLessThanOrEqual(SPLASH_IMAGE_WIDTH / 8);
    expect(LAUNCH_NAME_RISE).toBeGreaterThan(0);
    expect(LAUNCH_NAME_RISE).toBeLessThanOrEqual(LAUNCH_LOGO_LIFT);
  });

  test('the reveal is timed from Duration tokens, with no raw milliseconds', () => {
    expect(reveal).toContain('Duration.launchName');
    expect(reveal).toContain('Duration.launchHold');
    expect(reveal).toContain('Duration.launchOut');
    // DESIGN_RULES.md rule 21 — no bare ms in animated code.
    expect(reveal).not.toMatch(/duration:\s*\d/);
  });

  test('the exit\'s three phases do not overlap', () => {
    // The opaque white logo card must be gone BEFORE the field starts darkening, or it
    // reappears as a sticker on the way out — see components/LaunchReveal.tsx's MARK_OUT_AT.
    const src = reveal.match(/const MARK_OUT_AT = ([\d.]+);[\s\S]*?const FIELD_TO_APP_AT = ([\d.]+);/);
    expect(src).not.toBeNull();
    const [markOut, fieldToApp] = [Number(src![1]), Number(src![2])];
    expect(markOut).toBeGreaterThan(0);
    expect(fieldToApp).toBeGreaterThan(markOut);
    expect(fieldToApp).toBeLessThan(1);
  });

  test('the whole launch stays under a second (ANIMATION_GUIDELINES §1)', () => {
    const total = Duration.launchName + Duration.launchHold + Duration.launchOut;
    expect(total).toBeLessThan(1000);
    // Exits are faster than entrances.
    expect(Duration.launchOut).toBeLessThan(Duration.launchName);
  });
});
