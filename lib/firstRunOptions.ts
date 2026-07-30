/**
 * firstRunOptions.ts — the value sets behind the first-run personalization flow
 *
 * One dependency-free module holding every option the first-run flow can offer, the
 * mapping from a picked option to the settings it writes, and the inverse mapping used
 * to seed the flow from the settings a user already has. `app/first-run.tsx` renders
 * these; `app/settings.tsx` reuses the same value sets for its permanent controls, so a
 * choice made in the flow and the same choice made in Settings are literally the same
 * set of values — there is no first-run-only sizing/appearance system.
 *
 * The invariants this file exists to make mechanical (FIRST_RUN_PERSONALIZATION_HANDOFF.md):
 *   - Every option is one of a fixed, enumerated set. Nothing is free text or numeric,
 *     so no pick needs validation and no combination can be invalid.
 *   - `settingsPatchFromPicks()` returns ONE patch object covering every step plus
 *     `firstRunComplete: true`, so the flow's single `settings.update()` call is
 *     all-or-nothing — the gate can never be set without the selections landing with it.
 *   - `picksFromSettings()` is its exact inverse for every reachable state, which is what
 *     makes "Re-run setup" idempotent: re-entering the flow and pressing straight through
 *     writes back the settings it started from.
 *
 * Connections:
 *   Imports → (types only) store/useSettingsStore
 *   Used by → app/first-run.tsx, app/settings.tsx, app/(tabs)/_layout.tsx (START_SCREEN_ROUTES),
 *             lib/__tests__/firstRunOptions.test.ts
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
 *   - Adding a step means adding to FIRST_RUN_STEPS *and* to both mapping functions.
 *     Four is the cap (handoff doc's anti-overwhelm rules); a fifth thing goes to Settings.
 */
import type { DarkMode, FontSizePref, StartScreen } from '@/store/useSettingsStore';

/** The four steps, in the order the flow shows them. */
export const FIRST_RUN_STEPS = ['motion', 'textSize', 'appearance', 'startScreen'] as const;
export type FirstRunStep = (typeof FIRST_RUN_STEPS)[number];

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

/* ── Step 2 & 3: text size and appearance ────────────────────────────────── */

/** Same three values as Settings → General → Accessibility → Font size. */
export const FONT_SIZE_CHOICES: readonly FontSizePref[] = ['small', 'default', 'large'];

/** Same three values as Settings → General → Appearance → Light/Dark mode. */
export const DARK_MODE_CHOICES: readonly DarkMode[] = ['off', 'system', 'on'];

/* ── Step 4: starting screen ─────────────────────────────────────────────── */

export const START_SCREEN_CHOICES: readonly StartScreen[] = ['home', 'plans', 'shopping'];

/**
 * Setting id → the `app/(tabs)/` route name it opens, i.e. the navigator's
 * `initialRouteName`. Only ever three of the five tabs: these are the surfaces a day
 * plausibly starts on. Every other tab stays one tap away, so a "wrong" pick costs a tap.
 */
export const START_SCREEN_ROUTES: Record<StartScreen, string> = {
  home: 'index',
  plans: 'plans',
  shopping: 'shopping',
};

/**
 * The same three tabs as router paths, for navigating there *now* — `initialRouteName`
 * only decides where a cold launch opens, and the pager is already mounted by the time
 * the first-run flow commits. Matches SITE_ITEMS' routes in lib/siteNav.ts.
 */
export const START_SCREEN_PATHS: Record<StartScreen, '/' | '/plans' | '/shopping'> = {
  home: '/',
  plans: '/plans',
  shopping: '/shopping',
};

/* ── Picks ⇄ settings ────────────────────────────────────────────────────── */

/** One selection per step, held in the flow's local state until it commits. */
export type FirstRunPicks = {
  motion: MotionChoice;
  fontSize: FontSizePref;
  darkMode: DarkMode;
  startScreen: StartScreen;
};

/** The slice of the settings row this flow reads from and writes back to. */
export type FirstRunSettings = MotionSettings & {
  fontSize: FontSizePref;
  darkMode: DarkMode;
  startScreen: StartScreen;
};

/**
 * Seed the flow from the settings that are already applied — on a fresh install those are
 * the shipped defaults, so no step ever starts unset, and on a re-run they are whatever
 * the user has chosen since.
 */
export function picksFromSettings(s: FirstRunSettings): FirstRunPicks {
  return {
    motion: motionChoiceOf(s),
    fontSize: s.fontSize,
    darkMode: s.darkMode,
    startScreen: s.startScreen,
  };
}

/**
 * The flow's one and only write. Returns every field for all four steps plus the gate, so
 * the caller's single `settings.update()` either lands the whole personalization or none
 * of it — there is no ordering in which `firstRunComplete` is set on its own.
 */
export function settingsPatchFromPicks(
  picks: FirstRunPicks,
): FirstRunSettings & { firstRunComplete: true } {
  return {
    ...MOTION_SETTINGS[picks.motion],
    fontSize: picks.fontSize,
    darkMode: picks.darkMode,
    startScreen: picks.startScreen,
    firstRunComplete: true,
  };
}
