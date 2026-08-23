/**
 * splash.ts — the launch field: the ONE description of what a cold start looks like.
 *
 * The app opens through two surfaces that have to be pixel-identical to each other or the
 * handoff reads as a cut: the NATIVE splash (configured in app.json's expo-splash-screen
 * plugin, baked into the build) and components/LaunchReveal.tsx (the JS continuation that
 * adds the app name and dissolves into the app). Neither can import the other's config, so
 * both read these values and lib/__tests__/splashHandoff.test.ts fails the PR when app.json
 * and this file disagree.
 *
 * Connections:
 *   Imports → none (pure constants — deliberately dependency-free, like constants/motion.ts)
 *   Used by → components/LaunchReveal.tsx, lib/__tests__/splashHandoff.test.ts
 *             (app.json's splash plugin block mirrors these by hand — see above)
 *   Data    → none
 *
 * Edit notes:
 *   - **The field is the LOGO's own colour, not the app's** (2026-08-22, maintainer: *"matches
 *     the color of the app logo (now it's just black)"*). assets/icon.png is a blue watercolour
 *     tree on a white card; on the old `#000000` splash that card read as a sticker floating on
 *     black. On `#FFFFFF` the card's edges vanish and only the tree and its pale halo are left,
 *     which is what makes the mark look drawn onto the screen rather than pasted onto it.
 *     Changing this colour is a NATIVE change (app.json) and needs a new build, not an OTA.
 *   - ⚠️ **This REVERSES dfa6619 (2026-08-15, "The splash flashed light into a dark app"),
 *     and the reason that reversal is safe is components/LaunchReveal.tsx, not a change of
 *     mind.** That pass took the splash `#EEF3F9` → `#000000` because a light splash cut
 *     straight to a true-black app on every cold start. The cut is what was wrong, not the
 *     light: the reveal's exit now walks the empty field from this colour to `theme.bg`
 *     before it lets go, so there is nothing left to flash. **Do not put this back to white
 *     without that exit, and do not simplify that exit into a plain cross-fade** — either
 *     one on its own re-creates the 2026-08-15 report.
 *   - `SPLASH_INK` is sampled from the darkest ink in the logo's own trunk (#0242DF), so the
 *     wordmark is literally the drawing's colour rather than a blue chosen to go with it. It
 *     measures 7.38:1 on the white field — the test asserts ≥4.5:1 so a future "nicer" blue
 *     can't quietly land the app's first screen under AA.
 *   - `SPLASH_WORDMARK` is the app's NAME, not UI copy — it is the same string in every
 *     language, so it does not go through useT() (the test pins it to app.json's `expo.name`).
 */

/** The splash field. app.json: `plugins.expo-splash-screen.backgroundColor` AND `.dark.backgroundColor`. */
export const SPLASH_BACKGROUND = '#FFFFFF';

/** The logo's rendered width in dp. app.json: `plugins.expo-splash-screen.imageWidth`. */
export const SPLASH_IMAGE_WIDTH = 200;

/** The wordmark's colour — the deepest ink in the logo's trunk. */
export const SPLASH_INK = '#0242DF';

/** The wordmark. Pinned to app.json's `expo.name`; a proper noun, so never translated. */
export const SPLASH_WORDMARK = 'UnFocus';

/**
 * How far the logo rises as the name arrives under it, in dp.
 *
 * At mount the logo sits exactly where the native splash had it — dead centre — so the
 * handoff is invisible. The lift is what re-centres the PAIR once the name exists, and it is
 * why the name reads as the logo making room for it rather than as text appearing over art.
 */
export const LAUNCH_LOGO_LIFT = 16;

/** How far the name travels up into place, in dp. Small: it settles, it doesn't fly in. */
export const LAUNCH_NAME_RISE = 10;
