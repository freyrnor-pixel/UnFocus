#!/usr/bin/env node
/**
 * measure-geometry.mjs — the app's VERTICAL geometry audit
 *
 * WHY THIS EXISTS. The other three harnesses each answer one question and none of them is this
 * one. `wraps` measures HORIZONTAL overflow, `halos` measures whether a field's glow is sliced,
 * `visual` catches a change against a blessed baseline. **Nothing measured whether a thing is
 * where it says it is vertically** — so "the tab slider in Settings is still not vertically
 * centred" was a defect no check in this repo could see, reported by eye, twice.
 *
 * It measures NUMBERS in the live DOM and compares them against the tokens that are supposed to
 * produce them. A source scan cannot do this: every one of these values is correct in the style
 * sheet and wrong on screen, because what a box ends up as depends on its parent, its siblings
 * and whatever is painted over it.
 *
 * Usage:
 *   npm run geometry
 *   npm run geometry -- --width=360
 *   FORCE_BUILD=1 npm run geometry
 *
 * Exits 1 on any finding.
 *
 * ⚠️ Same faithfulness caveat as every web-preview harness: react-native-web is honest about
 * LAYOUT (which is what this measures) and dishonest about shadows, font metrics and Reanimated
 * timing. In particular `constants/theme.ts`'s `OpticalCenter` is Android-only and a no-op here,
 * so a label mis-centred by Android font padding is invisible to this audit BY CONSTRUCTION —
 * that class still needs a device. What this catches is geometry: overlap, asymmetry, and a gap
 * that does not match its token.
 */
import { chromium } from '@playwright/test';
import { resolveChromium } from './chromium-path.mjs';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const WIDTH = Number(args.find((a) => a.startsWith('--width='))?.split('=')[1] || 430);
const CHROMIUM_PATH = resolveChromium();

/**
 * How far out of true a measurement may be before it is a finding, in CSS px.
 *
 * 1.0 rather than 0: sub-pixel layout and `StyleSheet.hairlineWidth` legitimately produce
 * fractional boxes, and a gate that fires on 0.5px would be turned off within a week. Anything
 * a person can actually see is well over this.
 */
const TOLERANCE = 1.0;

/** Screens to walk. Each is [label, how to get there] — the tab bar, plus Settings. */
const TABS = ['Shop', 'To-do', 'Home', 'Habits', 'Health'];

const findings = [];
const measured = [];

function finding(screen, check, detail, hint) {
  findings.push({ screen, check, detail, hint });
}

// ---------------------------------------------------------------------------
// in-page measurement
// ---------------------------------------------------------------------------

/**
 * Everything is gathered in ONE evaluate per screen and analysed in node, so the checks are
 * plain data transforms that can be reasoned about without a browser in the loop.
 */
const COLLECT = () => {
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), left: +b.left.toFixed(2), right: +b.right.toFixed(2), h: +b.height.toFixed(2), w: +b.width.toFixed(2) };
  };
  const all = [...document.querySelectorAll('*')];

  // The floating chrome: ScreenScaffold's header block (zIndex 100), an optional
  // stickyBelowHeader block (99) and the bottom block (100). They are the only absolutely
  // positioned, full-width, z-declaring boxes near the top and bottom of the window.
  const chrome = all
    .filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'absolute') return false;
      const z = parseInt(cs.zIndex, 10);
      if (!(z === 99 || z === 100)) return false;
      const b = el.getBoundingClientRect();
      // Full-width bands only — this excludes badges and pills that also declare a z.
      return b.width > window.innerWidth * 0.9 && b.height > 16 && b.height < 260;
    })
    .map((el) => ({ z: parseInt(getComputedStyle(el).zIndex, 10), ...box(el) }))
    .sort((a, b) => a.top - b.top);

  // Any control that carries an accessible name and sits inside one of those bands. Used for
  // the centring check: a control in a band the caller sized exactly should sit in its middle.
  const controls = [];
  for (const el of all) {
    const label = el.getAttribute('aria-label');
    const role = el.getAttribute('role');
    if (!label && role !== 'button') continue;
    const b = el.getBoundingClientRect();
    if (b.height < 8 || b.width < 8) continue;
    controls.push({ label: label || (el.textContent || '').trim().slice(0, 30), role, ...box(el) });
  }

  return { chrome, controls, viewport: { w: window.innerWidth, h: window.innerHeight } };
};

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------

/**
 * CHECK 1 — no chrome band may paint over another.
 *
 * ScreenScaffold's header block is zIndex 100 and an attached sticky bar is 99, so wherever
 * their painted boxes overlap the HEADER WINS and that many pixels of the sticky bar are simply
 * not on screen. The bar's own content is still centred in its full declared height, so every
 * overlapped pixel comes off ONE END — which is precisely how a perfectly-specified control
 * ends up looking like it is sitting low.
 *
 * This is the shape of the 2026-08-29 Settings tab-slider report, and it is invisible to every
 * other check: the styles are right, the reserved height is right, and the screenshot shows a
 * bar that is merely a hairline short.
 */
function checkChromeOverlap(screen, bands) {
  const header = pickHeader(bands);
  const sticky = pickSticky(bands);
  if (!header || !sticky) return; // most screens have no sticky bar; nothing to compare.

  const overlap = +(header.bottom - sticky.top).toFixed(2);
  if (overlap > TOLERANCE) {
    finding(
      screen,
      'chrome-overlap',
      `the header (z${header.z}, ends ${header.bottom}) paints ${overlap}px over the sticky bar ` +
        `(z${sticky.z}, starts ${sticky.top})`,
      'The higher band wins, so those pixels come off ONE END of the bar while its content is ' +
        'still centred in the full declared height — which is how a correctly-specified control ' +
        'ends up reading as offset. See HEADER_SEAM_OVERLAP in components/ScreenScaffold.tsx.',
    );
  }
}

/**
 * CHECK 2 — a control inside a chrome band sits in the middle of what is VISIBLE.
 *
 * Deliberately measured against the visible band (the declared box minus anything painted over
 * it by a higher band), not against the declared box. Measuring against the declared box is what
 * every style sheet already asserts and is exactly why this defect survived: the numbers agree
 * with themselves and disagree with the screen.
 */
function checkControlCentring(screen, bands, controls) {
  const header = pickHeader(bands);
  const sticky = pickSticky(bands);
  if (!sticky) return;

  // The bar's VISIBLE band: its declared box minus whatever the header paints over the top of it.
  const visibleTop = header && header.bottom > sticky.top ? header.bottom : sticky.top;
  const visibleBottom = sticky.bottom;

  // The bar's own controls — the segments. Fully inside it, and materially shorter than it, so
  // there are gaps to compare at all.
  const inside = controls.filter(
    (c) => c.top >= sticky.top - 1 && c.bottom <= sticky.bottom + 1 && c.h < sticky.h - 2 && c.h > 8,
  );
  for (const c of inside) {
    const gapTop = +(c.top - visibleTop).toFixed(2);
    const gapBottom = +(visibleBottom - c.bottom).toFixed(2);
    const skew = +(gapTop - gapBottom).toFixed(2);
    measured.push({ screen, what: c.label, gapTop, gapBottom, skew });
    if (Math.abs(skew) > TOLERANCE) {
      finding(
        screen,
        'control-not-centred',
        `"${c.label}" sits ${Math.abs(skew)}px too ${skew > 0 ? 'low' : 'high'} in the visible ` +
          `sticky bar (${gapTop}px above, ${gapBottom}px below)`,
        'Either the bar is painted over at one end (see chrome-overlap) or the control is ' +
          'centred in a box taller than the one it is drawn in.',
      );
    }
  }
}

/**
 * The header band: the topmost full-width z-100 box anchored at the very top of the window.
 *
 * ⚠️ Picked by geometry rather than by taking `bands[0]`, and deduped to the OUTERMOST box at
 * that position. react-native-web wraps a View in several divs and more than one of them can be
 * absolute with a z, so a naive sweep reports a container and its own child as two bands
 * "overlapping" by their full height — which is nesting, not overlap, and was the first thing
 * this audit got wrong.
 */
function pickHeader(bands) {
  const top = bands.filter((b) => b.z === 100 && b.top <= 1);
  if (!top.length) return null;
  return top.reduce((best, b) => (b.bottom > best.bottom ? b : best), top[0]);
}

/** The stickyBelowHeader band: ScreenScaffold gives it zIndex 99 and nothing else uses that. */
function pickSticky(bands) {
  const s = bands.filter((b) => b.z === 99 && b.top > 1);
  if (!s.length) return null;
  return s.reduce((best, b) => (b.h > best.h ? b : best), s[0]);
}

// ---------------------------------------------------------------------------
// walk
// ---------------------------------------------------------------------------

async function clickText(page, text, timeout = 10000) {
  const l = page.getByText(text, { exact: true }).first();
  await l.waitFor({ state: 'attached', timeout });
  await l.click({ timeout });
}

async function runOnboarding(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1300);
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(700);
  await clickText(page, 'Continue');
  await page.waitForTimeout(900);
  await clickText(page, 'Start');
  await page.waitForTimeout(2200);
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 8000 });
    await page.waitForTimeout(800);
  }
}

async function scan(page, screen) {
  await page.waitForTimeout(500);
  const { chrome, controls } = await page.evaluate(COLLECT);
  if (!chrome.length) {
    // ⚠️ Fail, never skip. A screen that measures NOTHING and says nothing is how the other two
    // audits in this repo rotted — see AGENTS.md on `wraps` un-measuring two whole tabs.
    finding(screen, 'un-measured', 'no chrome bands found — the walk is looking at the wrong thing', 'Fix the walk.');
    return;
  }
  checkChromeOverlap(screen, chrome);
  checkControlCentring(screen, chrome, controls);
  console.log(`  ${screen}: ${chrome.length} chrome band(s), ${controls.length} control(s)`);
}

const EXPECTED_SCREENS = TABS.length + 1; // the five tabs plus Settings
let screensScanned = 0;

const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 932 } });
  await runOnboarding(page);

  for (const name of TABS) {
    await page.getByRole('button', { name, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    await scan(page, name);
    screensScanned += 1;
  }

  // Settings is a pushed dead end (no in-app back on web), so it goes last.
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1600);
  await scan(page, 'settings');
  screensScanned += 1;
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

console.log(`\n── geometry (${WIDTH}px) ──────────────────────────────────`);
console.log(`coverage: ${screensScanned} screens scanned, expected ${EXPECTED_SCREENS}`);

// Print the measurements even when nothing trips the gate. A verdict alone is what let the
// other audits in this repo report confidently about less and less of the app; a number in
// front of the reader is also the only way a sub-tolerance but SYSTEMATIC skew (every segment
// off the same way, in the same direction) is visible at all — which is exactly the shape the
// Settings tab-slider report turned out to have.
if (measured.length) {
  console.log('\nmeasured centring (gap above / below, + = sits low):');
  for (const m of measured) {
    const flag = Math.abs(m.skew) > TOLERANCE ? ' ←' : '';
    console.log(`  [${m.screen}] ${String(m.what).padEnd(12)} ${String(m.gapTop).padStart(6)} / ${String(m.gapBottom).padStart(6)}   skew ${m.skew >= 0 ? '+' : ''}${m.skew}${flag}`);
  }
}

if (findings.length === 0) {
  console.log('\ngeometry: clean ✓');
} else {
  const byCheck = new Map();
  for (const f of findings) {
    if (!byCheck.has(f.check)) byCheck.set(f.check, []);
    byCheck.get(f.check).push(f);
  }
  for (const [check, list] of byCheck) {
    console.log(`\n${check} — ${list.length}`);
    for (const f of list) console.log(`  [${f.screen}] ${f.detail}`);
    console.log(`  ^ ${list[0].hint}`);
  }
}

if (screensScanned < EXPECTED_SCREENS) {
  console.error(`\n⚠️  UN-MEASURED: ${EXPECTED_SCREENS - screensScanned} screen(s) did not run.`);
  process.exit(1);
}
process.exit(findings.length ? 1 : 0);
