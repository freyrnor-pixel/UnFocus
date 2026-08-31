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
 *   - **2026-07-31: four wizard steps became six rows on ONE screen.** The old
 *     app/first-run.tsx ran motion/text size/appearance/starting screen as four separate
 *     cards after onboarding, and app/onboarding/language.tsx asked for language before it.
 *     Six sequential screens for six switches is the thing that made getting started feel
 *     long, so they collapsed into app/onboarding/basics.tsx. The anti-overwhelm rule the
 *     old four-step cap encoded still holds, restated: ONE screen, no wizard. A seventh
 *     thing goes to Settings, not here.
 *   - Adding a row means adding to BASICS_ROWS *and* to both mapping functions.
 */
import type { DarkMode, FontSizePref, Language } from '@/store/useSettingsStore';

/**
 * The five rows, in the order the Basics screen shows them.
 *
 * ⚠️ **`startScreen` was REMOVED on 2026-08-21 (consistency audit).** It was a sixth row, and
 * the app now always opens on the centre (To-do) tab — see `START_TAB_ROUTE` in
 * `app/(tabs)/_layout.tsx`. Maintainer: *"Middle screen is to be the Main one where app always
 * starts when opening it fresh."* There is nothing left to pick.
 *
 * That row was also the clearest case of the thing the audit is about: `app/onboarding/basics.tsx`
 * renders only the LANGUAGE row on a fresh install, so the picker deciding where the app opened
 * was one a new user was never shown — a setting with a default nobody chose, silently governing
 * launch. The `StartScreen` type, `settings.startScreen` and the `start_screen` column all
 * survive as inert (this repo never drops columns).
 */
export const BASICS_ROWS = [
  'language',
  'appearance',
  'textSize',
  'motion',
  'handedness',
] as const;
export type BasicsRow = (typeof BASICS_ROWS)[number];

/* ── Step 1: motion ──────────────────────────────────────────────────────── */

/**
 * ⚠️ **THREE rungs again (2026-09-01). Two from 2026-08-27 to then, and the round trip is the
 * lesson: this rung is only allowed to exist while something real sits under it.**
 *
 * The middle rung's only job is `particlesEnabled: false` — the ambient drifting-dot field off,
 * the functional transitions kept. Round 20 deleted that field
 * (`components/ParticleBackground.tsx`) as a "stray artefact", so `'reduced'` was left being
 * offered while writing nothing, and its shipped copy ("Transitions stay, moving background
 * goes") described a no-op. Collapsing to two was the right call *on that code*.
 *
 * The field is back — maintainer: *"backdrop is too empty, don't know why we removed particles
 * and movement"* — so the rung has something to turn off again and comes back with it. The rule
 * to keep: **a rung must write something the user can see; check the field still exists before
 * defending the word.** `lib/__tests__/firstRunOptions.test.ts` asserts exactly that.
 *
 * **The OS reduce-motion path costs nothing here, and that is measured rather than assumed**:
 * `useAccessibility()` ORs the OS flag into `reducedMotion`, so on a phone asking for reduced
 * motion every rung behaves identically and the pre-selection is cosmetic — which is why
 * app/onboarding/basics.tsx floors such a phone at `'none'`.
 */
export type MotionChoice = 'full' | 'reduced' | 'none';

/** The settings a motion choice actually writes. */
export type MotionSettings = { reducedMotion: boolean; particlesEnabled: boolean };

export const MOTION_CHOICES: readonly MotionChoice[] = ['full', 'reduced', 'none'];

/** Most movement first, least last. */
export const MOTION_SETTINGS: Record<MotionChoice, MotionSettings> = {
  full: { reducedMotion: false, particlesEnabled: true },
  reduced: { reducedMotion: false, particlesEnabled: false },
  none: { reducedMotion: true, particlesEnabled: false },
};

/**
 * Which card to pre-select for a settings row. `reducedMotion` outranks the particles flag —
 * a phone whose OS asks for reduced motion is at the bottom rung whatever the field says.
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

/* ── Starting screen — REMOVED 2026-08-21 ────────────────────────────────── */

/**
 * ⚠️ **There is no starting-screen choice any more.** `START_SCREEN_CHOICES`,
 * `START_SCREEN_ROUTES` and `START_SCREEN_PATHS` lived here and are deleted; the app always
 * opens on the centre (To-do) tab, which is `START_TAB_ROUTE` / `START_TAB_ROUTE_PATH` in
 * `lib/siteNav.ts`. Maintainer, 2026-08-21: *"Middle screen is to be the Main one where app
 * always starts when opening it fresh."*
 *
 * Two things worth carrying forward from what was here, because both are still live traps:
 *   - **A route name the navigator does not have is silently ignored**, and the app opens on the
 *     FIRST tab (Shop) with no error anywhere. `'health'` sat in the old choice list for months
 *     after Health stopped being a tab, and that is precisely what it shipped. The replacement
 *     constant is pinned against the navigator's own `<TopTabs.Screen>` declarations in
 *     `lib/__tests__/firstRunOptions.test.ts` — read the target off the navigator, never off a
 *     memory of which screens exist.
 *   - **`settings.startScreen` and the `start_screen` column still exist and are now inert.**
 *     This repo never drops columns; see `store/useSettingsStore.ts`'s "Inert columns" note. A
 *     test asserts no surface reads the field, because wiring a new control to it would
 *     typecheck perfectly and quietly re-create a setting the user is never shown.
 */

/* ── Picks ⇄ settings ────────────────────────────────────────────────────── */

/** One selection per row, held in the screen's local state until it commits. */
export type FirstRunPicks = {
  language: Language;
  darkMode: DarkMode;
  fontSize: FontSizePref;
  motion: MotionChoice;
  handedness: HandednessChoice;
};

/** The slice of the settings row this screen reads from and writes back to. */
export type FirstRunSettings = MotionSettings & {
  language: Language;
  darkMode: DarkMode;
  fontSize: FontSizePref;
  leftHanded: boolean;
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
  };
}

/**
 * The screen's one and only write. Returns every field for all five rows plus the gate, so
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
    firstRunComplete: true,
  };
}
