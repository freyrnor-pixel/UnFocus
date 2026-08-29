/**
 * chromium-path.mjs — find the Chromium these harnesses should drive
 *
 * Every Playwright script in this repo hardcoded the same fallback:
 *
 *   `${PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`
 *
 * which is exactly right for the remote dev environment (AGENTS.md: Chromium is pre-installed
 * there, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, and "never run playwright install") and
 * wrong everywhere else — a CI runner installs into `~/.cache/ms-playwright`, and the pinned
 * `chromium-1194` directory name changes with every Playwright bump. Four copies of a path that
 * is right in one place is the shape this repo keeps getting bitten by; this is the one copy.
 *
 * Order: the explicit override, then the pre-installed path if it actually exists, then
 * Playwright's own resolution. Returning `undefined` is the point of the last case —
 * `chromium.launch({ executablePath: undefined })` is how you say "use whatever you installed",
 * whereas launching with a path that does not exist fails with a message about a missing file
 * rather than about a missing browser.
 */
import fs from 'node:fs';

const PINNED = `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

export function resolveChromium() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (explicit) return explicit;
  if (fs.existsSync(PINNED)) return PINNED;
  return undefined; // let Playwright find the browser it installed
}
