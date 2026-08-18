/**
 * firstRunOptions.ts — the value sets behind the Basics screen
 *
 * One dependency-free module holding every option `app/onboarding/basics.tsx` can offer, the
 * mapping from a picked option to the settings it writes, and the inverse mapping used to seed
 * the screen from the settings a user already has. `app/settings.tsx` reuses the same value
 * sets for its permanent controls, so a choice made during onboarding and the same choice made
 * in Settings are literally the same set of values — there is no onboarding-only
 * sizing/appearance system.
 *
 * The invariants this file exists to make mechanical (FIRST_RUN_PERSONALIZATION_HANDOFF.md):
 *   - Every option is one of a fixed, enumerated set. Nothing is free text or numeric,
 *     so no pick needs validation and no combination can be invalid.
 *   - `settingsPatchFromPicks()` returns ONE patch object covering every row plus
 *     `firstRunComplete: true`, so the screen's single `settings.update()` call is
 *     all-or-nothing — the gate can never be set without the selections landing with it.
 *   - `picksFromSettings()` is its exact inverse for every reachable state, which is what
 *     makes "Run setup again" idempotent: re-entering and pressing straight through
 *     writes back the settings it started from.
 *
 * Connections:
 *   Imports → (types only) store/useSettingsStore
 *   Used by → app/onboarding/basics.tsx, app/settings.tsx,
 *             app/(tabs)/_layout.tsx (START_SCREEN_ROUTES), lib/__tests__/firstRunOptions.test.ts
 *   Data    → none — pure data + pure functions, no store, no DB, no i18n
 *
 * Edit notes:
 *   - Keep this dependency-free (the type import is erased at compile time). It is
 *     imported by app/(tabs)/_layout.tsx at navigator-mount time, before most stores
 *     have done anything; pulling a store or lib/notifications in here would put real
 *     work on that path.
 *   - The motion ladder is deliberately monotonic: full → reduced → none each removes
 *     movement and never adds any. `reduced` keeps functional transitions and drops the
 *     ambient particle field; `none` also sets `reducedMotion`. Note `reducedMotion` is
 *     OR'd with the OS reduce-motion flag in lib/useAppTheme.ts's useAccessibility(), so
 *     picking `full` here can never override a phone that asks for less motion — the flow
 *     only ever adds reduction on top of the OS.
 *   - **2026-07-31: four wizard steps became six rows on ONE screen.** The old
 *     app/first-run.tsx ran motion/text size/appearance/starting screen as four separate
 *     cards after onboarding, and app/onboarding/language.tsx asked for language before it.
 *     Six sequential screens for six switches is the thing that made getting started feel
 *     long, so they collapsed into app/onboarding/basics.tsx. The anti-overwhelm rule the
 *     old four-step cap encoded still holds, restated: ONE screen, no wizard. A seventh
 *     thing goes to Settings, not here.
 *   - Adding a row means adding to BASICS_ROWS *and* to both mapping functions.
 */
import type { DarkMode, FontSizePref, Language, StartScreen } from '@/store/useSettingsStore';

/** The six rows, in the order the Basics screen shows them. */
export const BASICS_ROWS = [
  'language',
  'appearance',
  'textSize',
  'motion',
  'handedness',
  'startScreen',
] as const;
export type BasicsRow = (typeof BASICS_ROWS)[number];

/* ── Step 1: motion ──────────────────────────────────────────────────────── */

export type MotionChoice = 'full' | 'reduced' | 'none';

/** The settings a motion choice actually writes. */
export type MotionSettings = { reducedMotion: boolean; particlesEnabled: boolean };

export const MOTION_CHOICES: readonly MotionChoice[] = ['full', 'reduced', 'none'];

/**
 * Most movement first, least last. `reduced` drops the ambient particle field but keeps
 * the functional transitions that show where a thing came from; `none` drops those too.
 */
export const MOTION_SETTINGS: Record<MotionChoice, MotionSettings> = {
  full: { reducedMotion: false, particlesEnabled: true },
  reduced: { reducedMotion: false, particlesEnabled: false },
  none: { reducedMotion: true, particlesEnabled: false },
};

/**
 * Which card to pre-select for a settings row. `reducedMotion` wins outright: an install
 * that has it on is already at the bottom of the ladder whatever the particles flag says,
 * so a user who turned it on in Settings and then re-runs the flow sees `none` selected
 * rather than being quietly offered more movement than they asked for.
 */
export function motionChoiceOf(s: MotionSettings): MotionChoice {
  if (s.reducedMotion) return 'none';
  return s.particlesEnabled ? 'full' : 'reduced';
}

/* ── Text size and appearance ─────────────────────────────────────────────── */

/** Same three values as Settings → General → Accessibility → Font size. */
export const FONT_SIZE_CHOICES: readonly FontSizePref[] = ['small', 'default', 'large'];

/** Same three values as Settings → General → Appearance → Light/Dark mode. */
export const DARK_MODE_CHOICES: readonly DarkMode[] = ['off', 'system', 'on'];

/* ── Language ─────────────────────────────────────────────────────────────── */

/**
 * The app's languages. This row is FIRST on the Basics screen and previews live: tapping
 * it re-renders everything else in that language, which is both the demonstration that the
 * screen previews at all and the reason language no longer needs a screen of its own.
 *
 * Icelandic joined 2026-08-15 and is appended rather than slotted in, so the two rows a
 * returning user already knows keep their positions. The cross-product the round-trip test
 * sweeps grew 324 → 486 with it.
 */
export const LANGUAGE_CHOICES: readonly Language[] = ['en', 'no', 'is'];

/* ── Handedness ───────────────────────────────────────────────────────────── */

/**
 * Which hand the phone is in. Stored as the single boolean `leftHanded` (the DB column
 * predates this screen), but offered as a named pair so it obeys the same
 * "every option is a member of a fixed set" rule as every other row rather than being the
 * one raw boolean.
 */
export type HandednessChoice = 'right' | 'left';

export const HANDEDNESS_CHOICES: readonly HandednessChoice[] = ['right', 'left'];

export const HANDEDNESS_SETTINGS: Record<HandednessChoice, { leftHanded: boolean }> = {
  right: { leftHanded: false },
  left: { leftHanded: true },
};

export function handednessChoiceOf(s: { leftHanded: boolean }): HandednessChoice {
  return s.leftHanded ? 'left' : 'right';
}

/* ── Starting screen ──────────────────────────────────────────────────────── */

export const START_SCREEN_CHOICES: readonly StartScreen[] = ['home', 'shopping', 'health'];

/**
 * Setting id → the `app/(tabs)/` route name it opens, i.e. the navigator's
 * `initialRouteName`. **This is now all three tabs**, not a subset — the 2026-08-20 5→3
 * merge left exactly three, and each is a surface a day plausibly starts on (the day's list,
 * the shop, the morning's meds). `'plans'` was a choice here until that merge and is no
 * longer a tab, so it cannot be an `initialRouteName`; a stored `start_screen='plans'` falls
 * back to `'home'` through `readEnum`'s default, which lands on the screen its list moved to.
 */
export const START_SCREEN_ROUTES: Record<StartScreen, string> = {
  home: 'index',
  shopping: 'shopping',
  health: 'health',
};

/**
 * The same three tabs as router paths, for navigating there *now* — `initialRouteName`
 * only decides where a cold launch opens, and the pager is already mounted by the time
 * the first-run flow commits. Matches SITE_ITEMS' routes in lib/siteNav.ts.
 */
export const START_SCREEN_PATHS: Record<StartScreen, '/' | '/shopping' | '/health'> = {
  home: '/',
  shopping: '/shopping',
  health: '/health',
};

/* ── Picks ⇄ settings ────────────────────────────────────────────────────── */

/** One selection per row, held in the screen's local state until it commits. */
export type FirstRunPicks = {
  language: Language;
  darkMode: DarkMode;
  fontSize: FontSizePref;
  motion: MotionChoice;
  handedness: HandednessChoice;
  startScreen: StartScreen;
};

/** The slice of the settings row this screen reads from and writes back to. */
export type FirstRunSettings = MotionSettings & {
  language: Language;
  darkMode: DarkMode;
  fontSize: FontSizePref;
  leftHanded: boolean;
  startScreen: StartScreen;
};

/**
 * Seed the flow from the settings that are already applied — on a fresh install those are
 * the shipped defaults, so no step ever starts unset, and on a re-run they are whatever
 * the user has chosen since.
 */
export function picksFromSettings(s: FirstRunSettings): FirstRunPicks {
  return {
    language: s.language,
    darkMode: s.darkMode,
    fontSize: s.fontSize,
    motion: motionChoiceOf(s),
    handedness: handednessChoiceOf(s),
    startScreen: s.startScreen,
  };
}

/**
 * The screen's one and only write. Returns every field for all six rows plus the gate, so
 * the caller's single `settings.update()` either lands the whole personalization or none
 * of it — there is no ordering in which `firstRunComplete` is set on its own.
 */
export function settingsPatchFromPicks(
  picks: FirstRunPicks,
): FirstRunSettings & { firstRunComplete: true } {
  return {
    ...MOTION_SETTINGS[picks.motion],
    ...HANDEDNESS_SETTINGS[picks.handedness],
    language: picks.language,
    darkMode: picks.darkMode,
    fontSize: picks.fontSize,
    startScreen: picks.startScreen,
    firstRunComplete: true,
  };
}
