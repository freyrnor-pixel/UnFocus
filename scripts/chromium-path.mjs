/**
 * chromium-path.mjs — which Chromium these harnesses drive
 *
 * **There is no path here any more, and that is the fix (2026-08-30).**
 *
 * Every Playwright script in this repo used to hardcode
 * `${PLAYWRIGHT_BROWSERS_PATH}/chromium-1194/chrome-linux/chrome`. That worked in the remote dev
 * environment, where Chromium is pre-installed and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`,
 * and it quietly broke the pixel gate everywhere else — because a hardcoded REVISION is a claim
 * about which Playwright the project pins, made in a file that has no way to check.
 *
 * It was wrong. `@playwright/test` had drifted to `^1.61.1`, which expects **chromium-1228**,
 * while this environment has **1194**. So CI installed 1228, the baselines had been blessed on
 * 1194, and `npm run visual` failed there with all 21 screens differing by a uniform 0.1-1.05%
 * — the signature of a different text rasteriser, not of a changed app. That is what took the
 * gate out of CI (see DECISIONS_OPEN.md).
 *
 * The dependency is pinned to `~1.56.0` now, which is the version that ships **1194** — so the
 * library and the pre-installed browser agree again, and every environment can resolve the
 * browser its own Playwright pins:
 *   · dev container — `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` already holds `chromium-1194`,
 *     so nothing is downloaded and the env's "never run playwright install" rule is honoured;
 *   · CI — `npx playwright install chromium` fetches 1194, the same build.
 *
 * ⚠️ **Keep `@playwright/test` on a `~` range.** A caret is what let the library outrun the
 * browser in the first place, and the failure mode is a pixel gate that reports the whole app
 * has changed. `lib/__tests__/buildInfo.test.ts`'s sibling guard in `visual-diff.mjs`'s header
 * explains what a drifting baseline looks like from the other end.
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` remains as a manual override for anyone driving a browser that
 * Playwright did not install.
 */
import { fileURLToPath } from 'node:url';

export function resolveChromium() {
  // `undefined` is the point: `chromium.launch({ executablePath: undefined })` means "use the
  // browser you installed", which is the only answer that is correct in every environment.
  return process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
}

/**
 * Launch flags every harness passes (2026-10-11). Text is rasterised from the MACHINE's
 * fontconfig unless told otherwise: a stock Ubuntu runner hints text "slight", and this repo's
 * cloud dev image unhints it (an /etc/fonts/conf.d/12-unhinted-grayscale.conf that appeared on
 * 2026-10-03). Baselines blessed on one and diffed on the other differed on every glyph edge —
 * 25/25 screens "changed" by 0.4-10% with nothing in the app changed. Pinning hinting and LCD
 * text here makes the rendering a property of the harness, not of whichever machine runs it.
 */
// The flags alone left ~13 screens with small text patches under a stock config: fontconfig
// still applies per-FONT rules (`target="font"`) that a command-line flag does not reach. So
// every harness also gets the repo's own fontconfig, which includes the machine's and then
// assigns one rasterisation on top. Set at import, before any harness launches Chromium —
// Playwright passes this process's environment to the browser.
process.env.FONTCONFIG_FILE = fileURLToPath(new URL('./harness-fonts.conf', import.meta.url));

export const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--font-render-hinting=none',
  '--disable-lcd-text',
];
