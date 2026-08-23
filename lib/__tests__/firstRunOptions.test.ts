/**
 * firstRunOptions.test.ts — the invariants FIRST_RUN_PERSONALIZATION_HANDOFF.md calls
 * "not suggestions, the whole point", pinned where they're actually decidable.
 *
 * app/onboarding/basics.tsx's safety comes almost entirely from this module: if every option
 * is a member of a fixed set, the commit patch always covers every row plus the gate, and
 * picks ⇄ settings round-trips, then no sequence of taps can leave the app in a state it
 * couldn't already have been in. Those are the properties tested here. What is NOT
 * testable headlessly (and stays a device check): that the screen's live preview redraws,
 * and that the pager actually opens on the chosen tab.
 *
 * 2026-07-31: the four wizard steps plus the separate language screen became six rows on one
 * screen, so the cross product these tests sweep grew from 81 to 324.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BASICS_ROWS,
  DARK_MODE_CHOICES,
  FONT_SIZE_CHOICES,
  FirstRunPicks,
  FirstRunSettings,
  HANDEDNESS_CHOICES,
  LANGUAGE_CHOICES,
  MOTION_CHOICES,
  MOTION_SETTINGS,
  motionChoiceOf,
  picksFromSettings,
  settingsPatchFromPicks,
} from '@/lib/firstRunOptions';
import { START_TAB_ROUTE, START_TAB_ROUTE_PATH, TAB_ROUTE_NAME } from '@/lib/siteNav';

/** Every pick the screen can possibly hold — 2 × 3 × 3 × 3 × 2 = 108 combinations. */
function everyPick(): FirstRunPicks[] {
  const out: FirstRunPicks[] = [];
  for (const language of LANGUAGE_CHOICES)
    for (const motion of MOTION_CHOICES)
      for (const fontSize of FONT_SIZE_CHOICES)
        for (const darkMode of DARK_MODE_CHOICES)
          for (const handedness of HANDEDNESS_CHOICES)
            out.push({ language, motion, fontSize, darkMode, handedness });
  return out;
}

describe('anti-overwhelm: one screen, each row with 2–4 options', () => {
  test('at most six rows, no more, and no duplicates', () => {
    // The old cap was four WIZARD STEPS; the rule it encoded — don't make getting started a
    // long walk — is now "one screen". Six rows of pills fit one; a seventh thing goes to
    // Settings. Raising this number should mean re-checking the screen still fits, not just
    // editing the assertion. (There are FIVE rows since 2026-08-21 — `startScreen` left when
    // the app stopped offering a choice about where it opens. The cap is unchanged.)
    expect(BASICS_ROWS.length).toBeLessThanOrEqual(6);
    expect(new Set(BASICS_ROWS).size).toBe(BASICS_ROWS.length);
  });

  test('every row is backed by a choice list, and vice versa', () => {
    // A row with no options renders an empty pill strip; a choice list with no row is dead
    // code. Neither shows up in a typecheck.
    expect([...BASICS_ROWS].sort()).toEqual(
      ['appearance', 'handedness', 'language', 'motion', 'textSize'].sort(),
    );
  });

  test.each([
    ['language', LANGUAGE_CHOICES],
    ['motion', MOTION_CHOICES],
    ['text size', FONT_SIZE_CHOICES],
    ['appearance', DARK_MODE_CHOICES],
    ['handedness', HANDEDNESS_CHOICES],
  ])('%s offers 2–4 distinct options', (_name, choices) => {
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeLessThanOrEqual(4);
    expect(new Set(choices).size).toBe(choices.length);
  });
});

describe('invariant 2: no pick can produce an invalid state', () => {
  test('every motion choice maps to a fully-specified pair of booleans', () => {
    for (const choice of MOTION_CHOICES) {
      const s = MOTION_SETTINGS[choice];
      expect(typeof s.reducedMotion).toBe('boolean');
      expect(typeof s.particlesEnabled).toBe('boolean');
    }
  });

  test('the motion ladder only ever removes movement', () => {
    // full → reduced → none must be monotonic: each step down keeps every reduction the
    // one above it made. This is what lets the OS reduce-motion flag be treated as a floor.
    const weight = (c: (typeof MOTION_CHOICES)[number]) =>
      (MOTION_SETTINGS[c].reducedMotion ? 2 : 0) + (MOTION_SETTINGS[c].particlesEnabled ? 0 : 1);
    expect(weight('full')).toBeLessThan(weight('reduced'));
    expect(weight('reduced')).toBeLessThan(weight('none'));
  });

  test('the fixed start tab names a real tab route and a real path', () => {
    // ⚠️ **This used to check all three CHOICES; there is no choice since 2026-08-21.** The app
    // always opens on the centre tab (`START_TAB_ROUTE`, lib/siteNav.ts) — see that constant's
    // doc and CONSISTENCY_AUDIT.md §4. What the assertion is FOR is unchanged, and is the more
    // important half: an `initialRouteName` the navigator doesn't have is silently ignored and
    // the app opens on the first tab (Shop) instead, with no error anywhere.
    // ⚠️ 'health' sat in the old list until 2026-08-19, months after Health stopped being a tab,
    // and that is exactly the failure it shipped. Read the target off the navigator, never off a
    // memory of which screens exist.
    const layout = readFileSync(
      join(__dirname, '..', '..', 'app', '(tabs)', '_layout.tsx'),
      'utf8'
    );
    const tabs = [...layout.matchAll(/<TopTabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
    expect(tabs).toContain(START_TAB_ROUTE);
    expect(TAB_ROUTE_NAME[START_TAB_ROUTE_PATH]).toBe(START_TAB_ROUTE);

    // **It is the MIDDLE one, and that is the whole requirement** ("Middle screen is to be the
    // Main one where app always starts"). Derived from the navigator's own declaration order, so
    // re-ordering the tabs without re-deciding the start screen fails here rather than shipping.
    // ⚠️ **Five tabs since 2026-08-22, so the middle index is 2, not 1.** Derived rather than
    // written down: `Math.floor(n / 2)` is "the middle one" for any odd tab count, so the day the
    // nav changes size again this keeps asserting the requirement instead of a stale index. An
    // EVEN count has no middle, which is why that is a failure here rather than a rounded guess.
    expect(tabs.length % 2).toBe(1);
    expect(tabs[Math.floor(tabs.length / 2)]).toBe(START_TAB_ROUTE);

    // The deep-link back target and the navigator's initial route must be the SAME tab. They
    // were two separately-written values until 2026-08-21, so a back press landed on Home even
    // for a user who opened elsewhere.
    expect(layout).toMatch(/unstable_settings = \{ initialRouteName: START_TAB_ROUTE \}/);
  });

  test('a cold start is redirected to the start tab, exactly once', () => {
    // ⚠️ **`initialRouteName` does not decide where a launch lands, and the audit's §4 fix set
    // only that.** expo-router builds navigation state from the URL; a cold start's URL is `/`,
    // which is `app/(tabs)/index.tsx` — the Me tab. So the app went on opening on Me while both
    // constants above said `plans`, and every test here passed. The redirect in `app/_layout.tsx`
    // is what actually implements the requirement, and it has to be one-shot: `/` is also where
    // the Me TAB navigates, so a standing redirect would bounce the user off it on every tap.
    const root = readFileSync(join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf8');
    const code = root.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/router\.replace\(START_TAB_ROUTE_PATH\)/);
    // The one-shot latch, and the index-route test that scopes it to a launch rather than to
    // every visit to `/`.
    expect(code).toMatch(/landedOnStartTab\.current = true/);
    expect(code).toMatch(/segments\.length > 1/);
  });

  test('nothing reads settings.startScreen any more', () => {
    // The column and the Settings field survive (this repo never drops columns), but no surface
    // may consume them: a picker that governs launch while being hidden at first run is exactly
    // what this pass removed. A future session wiring a new control to the inert field is the
    // realistic regression, and it would typecheck perfectly.
    const files = ['app/(tabs)/_layout.tsx', 'app/settings.tsx', 'app/onboarding/basics.tsx',
                   'components/TourSpotlight.tsx', 'lib/firstRunOptions.ts'];
    for (const f of files) {
      const src = readFileSync(join(__dirname, '..', '..', ...f.split('/')), 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect({ file: f, hit: /\bstartScreen\b/.test(code) }).toEqual({ file: f, hit: false });
    }
  });
});

describe('invariant 5: the commit is one atomic, complete patch', () => {
  test('every patch carries all six rows AND the gate', () => {
    for (const picks of everyPick()) {
      const patch = settingsPatchFromPicks(picks);
      // If firstRunComplete could ever be written without the selections, a crash between
      // the two writes would leave the flow "done" with nothing applied. One object, so it
      // can't be.
      expect(Object.keys(patch).sort()).toEqual(
        [
          'darkMode', 'firstRunComplete', 'fontSize', 'language', 'leftHanded',
          'particlesEnabled', 'reducedMotion',
        ].sort(),
      );
      expect(patch.firstRunComplete).toBe(true);
    }
  });
});

describe('re-running the flow is idempotent (invariant 3 / "Re-run setup")', () => {
  test('picks → settings → picks is the identity for every reachable pick', () => {
    for (const picks of everyPick()) {
      const applied = settingsPatchFromPicks(picks);
      expect(picksFromSettings(applied)).toEqual(picks);
    }
  });

  test('settings → picks → settings changes nothing, for every settings row', () => {
    // The real "re-run and press straight through" case: whatever a user's current
    // settings are, seeding the flow from them and committing writes them back unchanged.
    for (const reducedMotion of [false, true])
      for (const particlesEnabled of [false, true])
        for (const fontSize of FONT_SIZE_CHOICES)
          for (const darkMode of DARK_MODE_CHOICES)
            for (const language of LANGUAGE_CHOICES)
              for (const leftHanded of [false, true]) {
              const current: FirstRunSettings = {
                reducedMotion,
                particlesEnabled,
                fontSize,
                darkMode,
                language,
                leftHanded,
              };
              const { firstRunComplete, ...writtenBack } = settingsPatchFromPicks(picksFromSettings(current));
              expect(firstRunComplete).toBe(true);
              expect(writtenBack.fontSize).toBe(current.fontSize);
              expect(writtenBack.darkMode).toBe(current.darkMode);
              expect(writtenBack.language).toBe(current.language);
              expect(writtenBack.leftHanded).toBe(current.leftHanded);
              // Motion is the one lossy axis: reducedMotion=true with particles on isn't a
              // state the three cards can express, so it normalises to 'none' (particles
              // off). That direction is deliberate — it removes movement, never adds it.
              expect(writtenBack.reducedMotion).toBe(current.reducedMotion);
              if (!current.reducedMotion) {
                expect(writtenBack.particlesEnabled).toBe(current.particlesEnabled);
              } else {
                expect(writtenBack.particlesEnabled).toBe(false);
              }
            }
  });
});

describe('motionChoiceOf pre-selects honestly', () => {
  test('reducedMotion wins outright, whatever particles says', () => {
    // A user who turned reduced motion on in Settings and then re-runs the flow must not
    // be offered "Full" as the pre-selection.
    expect(motionChoiceOf({ reducedMotion: true, particlesEnabled: true })).toBe('none');
    expect(motionChoiceOf({ reducedMotion: true, particlesEnabled: false })).toBe('none');
  });

  test('the shipped defaults pre-select Full', () => {
    // defaultSettings in store/useSettingsStore.ts — a fresh install starts at the top of
    // the ladder, so step 1 opens on the state the app is already in.
    expect(motionChoiceOf({ reducedMotion: false, particlesEnabled: true })).toBe('full');
  });
});
