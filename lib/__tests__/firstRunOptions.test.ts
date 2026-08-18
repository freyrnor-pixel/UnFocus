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
  START_SCREEN_CHOICES,
  START_SCREEN_PATHS,
  START_SCREEN_ROUTES,
  motionChoiceOf,
  picksFromSettings,
  settingsPatchFromPicks,
} from '@/lib/firstRunOptions';

/** Every pick the screen can possibly hold — 2 × 3 × 3 × 3 × 2 × 3 = 324 combinations. */
function everyPick(): FirstRunPicks[] {
  const out: FirstRunPicks[] = [];
  for (const language of LANGUAGE_CHOICES)
    for (const motion of MOTION_CHOICES)
      for (const fontSize of FONT_SIZE_CHOICES)
        for (const darkMode of DARK_MODE_CHOICES)
          for (const handedness of HANDEDNESS_CHOICES)
            for (const startScreen of START_SCREEN_CHOICES)
              out.push({ language, motion, fontSize, darkMode, handedness, startScreen });
  return out;
}

describe('anti-overwhelm: one screen, each row with 2–4 options', () => {
  test('six rows, no more, and no duplicates', () => {
    // The old cap was four WIZARD STEPS; the rule it encoded — don't make getting started a
    // long walk — is now "one screen". Six rows of pills fit one; a seventh thing goes to
    // Settings. Raising this number should mean re-checking the screen still fits, not just
    // editing the assertion.
    expect(BASICS_ROWS.length).toBeLessThanOrEqual(6);
    expect(new Set(BASICS_ROWS).size).toBe(BASICS_ROWS.length);
  });

  test('every row is backed by a choice list, and vice versa', () => {
    // A row with no options renders an empty pill strip; a choice list with no row is dead
    // code. Neither shows up in a typecheck.
    expect([...BASICS_ROWS].sort()).toEqual(
      ['appearance', 'handedness', 'language', 'motion', 'startScreen', 'textSize'].sort(),
    );
  });

  test.each([
    ['language', LANGUAGE_CHOICES],
    ['motion', MOTION_CHOICES],
    ['text size', FONT_SIZE_CHOICES],
    ['appearance', DARK_MODE_CHOICES],
    ['handedness', HANDEDNESS_CHOICES],
    ['starting screen', START_SCREEN_CHOICES],
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

  test('every starting screen names a real tab route and a real path', () => {
    // 'index' is app/(tabs)/index.tsx ("I dag"); the other two are their own tab files.
    // These are ALL THREE tabs since the 2026-08-20 5→3 merge, not a subset — and 'plans' is
    // deliberately absent, because a pushed sub-screen cannot be an `initialRouteName`.
    for (const s of START_SCREEN_CHOICES) {
      expect(['index', 'shopping', 'health']).toContain(START_SCREEN_ROUTES[s]);
      expect(['/', '/shopping', '/health']).toContain(START_SCREEN_PATHS[s]);
    }
    // Distinct targets, or two options would silently do the same thing.
    expect(new Set(Object.values(START_SCREEN_ROUTES)).size).toBe(START_SCREEN_CHOICES.length);
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
          'particlesEnabled', 'reducedMotion', 'startScreen',
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
              for (const leftHanded of [false, true])
                for (const startScreen of START_SCREEN_CHOICES) {
              const current: FirstRunSettings = {
                reducedMotion,
                particlesEnabled,
                fontSize,
                darkMode,
                language,
                leftHanded,
                startScreen,
              };
              const { firstRunComplete, ...writtenBack } = settingsPatchFromPicks(picksFromSettings(current));
              expect(firstRunComplete).toBe(true);
              expect(writtenBack.fontSize).toBe(current.fontSize);
              expect(writtenBack.darkMode).toBe(current.darkMode);
              expect(writtenBack.language).toBe(current.language);
              expect(writtenBack.leftHanded).toBe(current.leftHanded);
              expect(writtenBack.startScreen).toBe(current.startScreen);
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
