/**
 * measure-jitter.mjs — does anything on a resting screen change size on its own?
 *
 * **Why this exists.** Three device reports in a row said cards "flicker", "jump mid-animation"
 * and finally *"jitter in height, all the time"*, and every attempt to fix them was a reading
 * of the source rather than a measurement — because nothing in this repo could see a height
 * that will not settle. `visual` takes ONE screenshot per screen, so a layout oscillating
 * between two heights is captured at whichever one the shutter caught and reported as
 * unchanged; `geometry` and `wraps` measure a single settled frame for the same reason. A
 * loop is invisible to all three by construction.
 *
 * This samples instead. It parks on a screen, touches nothing, and records the top edge of
 * every anchor element every `INTERVAL_MS` for `WINDOW_MS`. A resting screen returns exactly
 * one distinct value per anchor. Anything else is something re-laying itself out with no input,
 * and the report names which anchor and how far it moved.
 *
 * **What it can and cannot see.** It runs the web preview (react-native-web), so it sees a
 * layout/measure feedback loop — a component whose measurement changes what it measures — which
 * is platform-independent and the likeliest shape of "jitters forever". It cannot see anything
 * that is native-only: Reanimated's UI-thread timing, Android's clipping, the pager's gestures.
 * A clean run here does NOT clear the app; it narrows the cause to the native side, which is
 * worth knowing and was not knowable before.
 *
 * Usage (see run-jitter.sh, which builds and serves first):
 *   node scripts/measure-jitter.mjs             — Home, To-do, Habits, Health, Shop
 *   node scripts/measure-jitter.mjs --tab=To-do — one tab
 *   node scripts/measure-jitter.mjs --window=8000
 *
 * Exit code 1 if any anchor moved, so it can gate CI the way the other audits do.
 */
import { chromium } from '@playwright/test';
import { resolveChromium } from './chromium-path.mjs';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const CHROMIUM_PATH = resolveChromium();

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--tab='))?.split('=')[1];
/** How long to watch one screen. Long enough to catch a slow loop, short enough to run 5 tabs. */
const WINDOW_MS = Number(args.find((a) => a.startsWith('--window='))?.split('=')[1] || 4000);
/**
 * Sampling period. Deliberately NOT every animation frame: a loop driven by layout passes ticks
 * at layout speed, and rAF sampling would mostly record the same frame many times while making
 * the page slower, which changes the thing being measured.
 */
const INTERVAL_MS = 50;
/**
 * Sub-pixel noise floor. react-native-web lays out in fractional CSS pixels and a text node can
 * settle at .5 off between two otherwise identical frames; a real jitter is whole pixels (a
 * line of text, a row, a gap), so anything under this is not reported.
 */
const NOISE_PX = 1;

/**
 * ⚠️ **Every tab is watched on EVERY pass, not just the one named.** app/(tabs)/_layout.tsx runs
 * the pager with `lazy: false`, so all five screen trees are mounted from launch and the anchor
 * sweep below picks up all of them — including the four swiped off-screen. That is deliberate
 * here (a screen does not have to be visible to be looping), and it is why the labels below name
 * a SCENARIO rather than a tab.
 */
const TABS = ['Home', 'Shop', 'To-do', 'Habits', 'Health'];

/**
 * Sample the top edge of every text anchor on screen, repeatedly, from inside the page.
 *
 * Anchors are TEXT nodes rather than card containers because a card whose own height oscillates
 * moves everything BELOW it — so text picks up both the card that is misbehaving and the
 * evidence that it is. Elements are keyed by their text so the report names something a human
 * can find on the screen.
 */
async function sampleTops(page, windowMs, intervalMs) {
  return page.evaluate(
    async ({ windowMs, intervalMs }) => {
      const anchorsFor = () => {
        const out = [];
        const seen = new Set();
        for (const el of document.querySelectorAll('div, span')) {
          if (el.children.length > 0) continue; // leaf nodes only — text, not containers
          const text = (el.textContent || '').trim();
          if (!text || text.length > 40) continue;
          if (seen.has(text)) continue; // a repeated label cannot be told apart in the report
          seen.add(text);
          out.push({ text, el });
        }
        return out;
      };

      const anchors = anchorsFor();
      const series = new Map(anchors.map((a) => [a.text, []]));
      const deadline = Date.now() + windowMs;
      while (Date.now() < deadline) {
        for (const a of anchors) {
          // A node that unmounts mid-window reports 0/0 rather than throwing; the caller
          // filters those out, since "it left the tree" is not the same as "it moved".
          const r = a.el.getBoundingClientRect();
          series.get(a.text).push(r.width === 0 && r.height === 0 ? null : r.top);
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return [...series].map(([text, tops]) => [text, tops]);
    },
    { windowMs, intervalMs }
  );
}

function report(tab, samples) {
  const moved = [];
  for (const [text, tops] of samples) {
    const live = tops.filter((t) => t !== null);
    if (live.length < 3) continue;
    const min = Math.min(...live);
    const max = Math.max(...live);
    if (max - min <= NOISE_PX) continue;
    // How many times it CHANGED, not how many distinct values: a loop that ticks between two
    // heights and a one-off settle both span the same range, and only one of them is a bug.
    let flips = 0;
    for (let i = 1; i < live.length; i++) if (Math.abs(live[i] - live[i - 1]) > NOISE_PX) flips++;
    moved.push({ text, range: +(max - min).toFixed(1), flips });
  }
  moved.sort((a, b) => b.flips - a.flips || b.range - a.range);

  if (moved.length === 0) {
    console.log(`  [${tab}] settled — ${samples.length} anchors, none moved`);
    return 0;
  }
  console.log(`  [${tab}] ${moved.length} anchor(s) MOVED while nothing was touching the screen:`);
  for (const m of moved.slice(0, 12)) {
    console.log(`     ${String(m.range).padStart(7)}px over ${String(m.flips).padStart(3)} change(s)  "${m.text}"`);
  }
  return moved.length;
}

/**
 * Fold and unfold the first card that has a chevron, then watch what happens AFTER the
 * animation should have finished.
 *
 * This is the state the device reports describe — *"expand and collapse"*, then *"they jitter in
 * height, all the time"* — and it is a different question from the resting one: components/
 * Collapsible.tsx drives an open card's height from a measured value that it also ANIMATES when
 * the body resizes, which is the shape a feedback loop would take. A card that never settles
 * after being opened would read exactly as reported.
 */
async function foldFirstCard(page) {
  // ⚠️ The FOLD chevron only — `…: Collapse list` / `…: Expand list` (components/
  // CardCollapseToggle.tsx). A looser /Expand/ also matches the ⤢, whose label is "Expand card",
  // and pressing that opens a full-screen pane whose scrim then swallows every later click —
  // which surfaces as an unrelated timeout on the next tab button, not as a wrong state.
  const chevrons = await page.getByRole('button', { name: /(Collapse|Expand) list$/ }).all();
  if (chevrons.length === 0) return false;
  await chevrons[0].click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  await chevrons[0].click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  return true;
}

async function onboard(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.getByText('Continue', { exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(600);
  await page.getByText('Start', { exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1800);
}

/**
 * Leave the tour. Separate from onboarding so a scenario can choose to watch WITH it up.
 *
 * Bounded loop over both exits, because the tour has two: "Skip the tour" on a step, and "Start
 * using the app" on the closing card — and which one is showing depends on how long the caller
 * spent watching. Its scrim swallows every later click, so a missed dismissal fails as an
 * unrelated timeout on the next tab button (which is how this was found).
 */
async function skipTour(page) {
  for (let i = 0; i < 6; i++) {
    let clicked = false;
    for (const label of ['Skip the tour', 'Start using the app']) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(700);
        clicked = true;
        break;
      }
    }
    if (!clicked) return;
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  let offenders = 0;
  try {
    await onboard(page);

    // 1. The tour is still up. Its overlay re-measures every mounted target every 240ms
    //    (components/TourSpotlight.tsx's cadence), and the device report arrived with the tour
    //    on screen — so this is watched before it is dismissed, not after.
    await page.waitForTimeout(1500);
    offenders += report('tour running', await sampleTops(page, WINDOW_MS, INTERVAL_MS));

    await skipTour(page);
    await page.waitForTimeout(1200);

    for (const tab of TABS) {
      if (only && tab !== only) continue;
      // In-app navigation only — the web DB is in-memory (lib/sqlite.web.ts), so a page.goto()
      // would wipe it and bounce back to onboarding.
      await page.getByRole('button', { name: tab, exact: true }).first().click({ timeout: 10000 });
      // Let the arrival settle before watching: a tab switch legitimately animates, and this
      // harness is about what happens when nothing SHOULD be moving.
      await page.waitForTimeout(1500);
      offenders += report(`${tab}, resting`, await sampleTops(page, WINDOW_MS, INTERVAL_MS));

      if (await foldFirstCard(page)) {
        offenders += report(`${tab}, after a fold`, await sampleTops(page, WINDOW_MS, INTERVAL_MS));
      }
    }
  } finally {
    await browser.close();
  }
  console.log(offenders === 0 ? '\njitter: clean ✓' : `\njitter: ${offenders} moving anchor(s)`);
  process.exit(offenders === 0 ? 0 : 1);
}

main();
