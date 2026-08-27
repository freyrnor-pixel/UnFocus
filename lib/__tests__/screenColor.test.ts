/**
 * screenColor.test.ts — per-screen hue mapping (lib/screenColor.ts).
 *
 * **Rewritten 2026-08-05 for the card design reset.** This file previously pinned the
 * retired (2026-07-31, A.5) day-arc mapping — shopping=green, plans=indigo, home=blue,
 * health=teal, habits=violet — and asserted that unknown routes fell back to `accent`.
 * Both changed when the maintainer brought the per-screen hue back as the card border:
 * every screen now takes the token that matches its own domain, Home and Settings
 * deliberately have NO hue, and an unknown route lands on the neutral `theme.border`
 * rather than on the action colour.
 *
 * What's worth pinning here, and why each one is a real regression risk:
 *   - the exact screen → token mapping (a wrong pairing is invisible in review — every
 *     screen still looks "coloured", just wrong, exactly like the tab-order/backdrop-panel
 *     bug lib/__tests__/motifs.test.ts exists to catch);
 *   - that Home and Settings are neutral (the whole "Home is an index of the others"
 *     design collapses if Home grows a hue of its own);
 *   - that an unknown route is NEUTRAL and specifically not `accent` (the accent means
 *     "you can press this", so a card wearing it lies about being tappable);
 *   - that the hues are mutually distinct (two screens sharing a border colour is the
 *     failure this whole layer is meant to prevent).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, getThemePalette, type ThemePalette } from '@/constants/colors';
import { glassKey, mix } from '@/constants/theme';
import { getScreenColor } from '@/lib/screenColor';

const light = getThemePalette('default', false);
const dark = getThemePalette('default', true);

describe('getScreenColor', () => {
  it('maps each screen to its own domain token (light)', () => {
    expect(getScreenColor(light, 'plans').base).toBe(light.featTask);
    expect(getScreenColor(light, 'habits').base).toBe(light.featHabit);
    expect(getScreenColor(light, 'health').base).toBe(light.featHealth);
    expect(getScreenColor(light, 'shopping').base).toBe(light.featShop);
    expect(getScreenColor(light, 'notes').base).toBe(light.featNote);
    expect(getScreenColor(light, 'food').base).toBe(light.featMeal);
    expect(getScreenColor(light, 'scan').base).toBe(light.featScan);
    expect(getScreenColor(light, 'goals').base).toBe(light.featPlan);
  });

  it('maps the same way in dark mode', () => {
    expect(getScreenColor(dark, 'plans').base).toBe(dark.featTask);
    expect(getScreenColor(dark, 'shopping').base).toBe(dark.featShop);
    expect(getScreenColor(dark, 'goals').base).toBe(dark.featPlan);
  });

  it("'index' wears the TO-DO hue, because it is the to-do screen now", () => {
    // 2026-08-20, the 5→3 tab merge: app/(tabs)/index.tsx is the "I dag" tab and the day's
    // tasks and habits live on it, so it reads the same token app/plans.tsx does. It was
    // neutral while Home was an index of previews that each borrowed their source screen's
    // hue — those previews still borrow theirs for their BADGES, but the screen itself names
    // this key as of 2026-08-27 (round 20). It had not, which was the bug: `useScreenColor()`
    // was null for all of Home, so every categorical control on it fell back to `theme.accent`
    // and the Energy button glowed blue on the one tab the mockup draws gold.
    // The consumer that forced this is components/BottomNav.tsx: the active tab is marked by
    // its categorical hue and nothing else, and a neutral key falls back to `theme.accent`.
    expect(getScreenColor(light, 'index').base).toBe(light.featTask);
    expect(getScreenColor(dark, 'index').base).toBe(dark.featTask);
    expect(getScreenColor(light, 'index').neutral).toBeFalsy();
  });

  it("'home' and Settings deliberately have NO hue", () => {
    // 'home' is the legacy alias kept for callers that still pass it, and it is NOT an alias
    // for 'index' any more (it was until 2026-08-20 — both were null, so the distinction was
    // invisible). Settings is chrome, not a domain.
    for (const route of ['home', 'settings']) {
      expect(getScreenColor(light, route).base).toBe(light.border);
      expect(getScreenColor(light, route).neutral).toBe(true);
    }
  });

  it('the eight hued screens are all distinct', () => {
    const hues = ['plans', 'habits', 'health', 'shopping', 'notes', 'food', 'scan', 'goals']
      .map((r) => getScreenColor(light, r).base);
    expect(new Set(hues).size).toBe(8);
  });

  it('an unknown route is NEUTRAL, not the accent', () => {
    // `accent` means "you can act on this". A card border in the accent reads as tappable
    // when it isn't, which is why the old fallback was wrong and this one is not.
    for (const route of ['nonsense-route', undefined, null]) {
      const hue = getScreenColor(light, route);
      expect(hue.base).toBe(light.border);
      expect(hue.base).not.toBe(light.accent);
      expect(hue.neutral).toBe(true);
    }
  });

  it('a hued screen is not marked neutral', () => {
    expect(getScreenColor(light, 'shopping').neutral).toBe(false);
  });

  it('soft is a translucent tint of the base', () => {
    const { base, soft } = getScreenColor(light, 'shopping');
    expect(soft).toContain('rgba(');
    expect(soft).toContain('0.14');
    expect(base).toMatch(/^#/);
  });
});

/**
 * `useControlHue` — what a CONTROL lights up in, and why the answer differs by mode.
 *
 * Round 20's brief: *"Glow belongs to accent icons, the active chip and the primary button only,
 * and is always the card's own feature hue — never blue on a pink or cyan screen."* The helper
 * honours that in DARK and deliberately does not in LIGHT, and this block is the measurement that
 * decides it — including the light-mode FAILURE, pinned on purpose so that a later session
 * reading "the hue is categorical" cannot finish the job by extending it to light.
 *
 * The composite under test is the real one: an active key's body is `glassKey(hue).backgroundColor`
 * — a wash of the hue itself — over `theme.surface`, and the glyph on it is that same hue. The
 * alpha is read back OUT of `glassKey` rather than restated here, so this can never measure a
 * body the app has stopped drawing (the trap `__tests__/glassMaterial.test.ts` exists for).
 */
describe('useControlHue: the categorical control hue is dark-mode only', () => {
  const HUE_KEYS = ['featTask', 'featHabit', 'featHealth', 'featShop', 'featNote'] as const;

  /** The colour an active key's glyph is actually read against: its own hue at the key body's
   *  alpha, composited over the card behind it. */
  function activeBody(theme: ThemePalette, hue: string, isDark: boolean): string {
    const wash = glassKey(hue, isDark, 'key').backgroundColor;
    const alpha = Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(wash)?.[1]);
    expect(Number.isFinite(alpha)).toBe(true);
    return mix(theme.surface, hue, alpha);
  }

  it('DARK: every identity hue clears the 3:1 non-text floor as glyph ink on its own key', () => {
    // WCAG 1.4.11 — an icon is a non-text graphic, so 3:1, not 4.5:1. Measured 3.79–7.77:1.
    for (const key of HUE_KEYS) {
      const hue = dark[key];
      expect(contrastRatio(hue, activeBody(dark, hue, true))).toBeGreaterThanOrEqual(3);
    }
  });

  it('DARK: swapping the accent for a hue costs no contrast worth having', () => {
    // The point of the assertion is that this is not a trade. Four of the five GAIN on the blue
    // they replace; Notes' violet is a wash with it (3.79 vs 3.82), which is why "no worse than
    // the accent, within a tenth" is the honest bound rather than a flat "better".
    const accent = contrastRatio(dark.accent, activeBody(dark, dark.accent, true));
    for (const key of HUE_KEYS) {
      const hue = dark[key];
      expect(contrastRatio(hue, activeBody(dark, hue, true))).toBeGreaterThan(accent - 0.1);
    }
  });

  it('LIGHT: at least one hue FAILS the same floor — this is why light keeps the accent', () => {
    // Light's `feat*` octet is the 2026-08-10 cinematic mid-tone set, NOT the neon ladder, and
    // nothing about it was tuned to be read as ink. Notes' violet measures 2.48:1 here. If this
    // assertion ever starts failing because light's octet was re-tuned, that is the moment to
    // reconsider the split — not before, and not by deleting this test.
    const failures = HUE_KEYS.filter(
      (key) => contrastRatio(light[key], activeBody(light, light[key], false)) < 3,
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures).toContain('featNote');
  });

  it('LIGHT: the accent it keeps instead clears the floor comfortably', () => {
    expect(contrastRatio(light.accent, activeBody(light, light.accent, false))).toBeGreaterThan(4);
  });
});

/**
 * The rule as a BAN, not an allowlist — same shape as `lib/__tests__/glowBudget.test.ts`'s.
 *
 * The measurements above say which colour is *safe*; nothing in them says the app actually uses
 * it. That gap is the whole reason this drifted: `theme.accent` is the obvious thing to reach for
 * in a component that has no idea which screen it is on, it typechecks, and a blue halo looks
 * deliberate in isolation — the defect only exists beside the rose tab it is sitting on, which no
 * unit test and no single screenshot ever sees. So the converted controls have to prove they read
 * the screen, and the two that legitimately cannot have to keep saying why.
 */
describe('the glow-bearing controls wear the screen hue, and the exceptions say why', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

  /** Every control whose active/lit colour must come from the screen, not from the accent. */
  const CONVERTED = [
    'components/IconButton.tsx',   // ← the Medisin bell, via components/ReminderBell.tsx
    'components/VoiceNoteFAB.tsx', // ← the Notater mic
    'components/NewSinceGlow.tsx',
  ];

  it.each(CONVERTED)('%s resolves its lit colour from the screen', (rel) => {
    const src = read(rel);
    expect(src).toContain('useControlHue');
    // The three ways a lit colour is spelled in this codebase. None of them may name the accent
    // in these files: a body tinted one colour and lit another is the thing `Button.tsx` derives
    // everything from a single `hue` to make unspellable.
    expect(src).not.toMatch(/glow=\{[^}]*theme\.accent/);
    expect(src).not.toMatch(/getGlow\(\s*theme\.accent/);
    expect(src).not.toMatch(/glassKey\(\s*theme\.accent/);
  });

  /** The two that keep the accent, and the reason each must go on saying so. */
  const EXCEPTIONS: [string, RegExp][] = [
    // A SOLID accent fill with `accentInk` on it — two of the five hues admit no AA-contrast ink,
    // so a categorical body ships an unreadable glyph on at least one screen.
    ['components/AddFAB.tsx', /accentInk/],
    // A solid accent track with a white thumb on it — same case.
    ['components/FormControls.tsx', /solid accent fill|solid accent track/i],
  ];

  it.each(EXCEPTIONS)('%s still records why it keeps the accent', (rel, reason) => {
    const src = read(rel);
    expect(src).toMatch(reason);
    // The exception is the FILL, so the accent must still be what it is made of — an exception
    // that quietly lost its own justification is a file nobody will re-check.
    expect(src).toContain('theme.accent');
  });

  it('Home names a screen hue, so its controls have one to read', () => {
    // The gap that produced the blue Energy button: the scaffold passed no key at all, so
    // `useScreenColor()` was null for the whole screen. `SCREEN_TOKEN.index` had said `featTask`
    // since the 5→3 merge; only the second half was missing. components/BottomNav.tsx has been
    // drawing this tab gold the whole time, so the screen and its own tab disagreed.
    expect(read('app/(tabs)/index.tsx')).toMatch(/screenKey="index"/);
  });

  it('a deliberately-neutral screen key reaches the context as null, not as grey', () => {
    // Both scaffolds collapse `.neutral` to null. Every consumer reads `?? theme.border`, which
    // is the value a neutral key resolved to anyway — so nothing drawn changes — but `null` now
    // means "no hue" rather than "grey", which is the distinction `useControlHue` turns on: a
    // halo in the neutral border colour is a smudge, not an identity.
    for (const rel of ['components/ScreenScaffold.tsx', 'components/CenterModalScreen.tsx']) {
      expect(read(rel)).toMatch(/hue\.neutral \? null : hue\.base/);
    }
  });
});
