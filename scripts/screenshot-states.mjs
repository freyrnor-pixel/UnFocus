#!/usr/bin/env node
/**
 * screenshot-states.mjs — captures every screen of the app in its different states for an
 * outside design review, and writes a captioned index alongside the images.
 *
 * This is a wider walk than `scripts/preview.mjs`, and a different job: preview.mjs proves
 * write→read paths still work, this one documents what the app LOOKS like. It deliberately
 * shoots each surface EMPTY first (the state a new user actually meets) and then again with
 * data, plus the sheets, editors and pushed sub-screens.
 *
 * Output: `review-bundle/screens/NN-name.png` + `index.json` + `INDEX.md`.
 *
 * Usage:
 *   node scripts/screenshot-states.mjs [outDir] [--theme=light|dark] [--only=core] [--deterministic]
 *
 * `--deterministic` pins Math.random and the clock (see freezeNondeterminism) so the output can
 * be DIFFED rather than merely looked at. `scripts/visual-diff.mjs` always passes it; the review
 * bundle deliberately does not, since a human reader benefits from a real random narrator line.
 *
 * THE ONE CONSTRAINT THAT SHAPES THE WHOLE WALK: on web the DB is in-memory sql.js, and
 * `page.goto()`/`page.goBack()` reload the document and WIPE it back to a fresh install.
 * There is no in-app back button on web (ScreenHeader draws one on iOS only), so every
 * pushed sub-screen costs a goBack and therefore costs the data. Hence the phases:
 *
 *   1. onboarding + guided tour
 *   2. the three tabs, empty
 *   3. sheets and overlays (they close in place — data survives, but there isn't any yet)
 *   4. pushed sub-screens, each an independent excursion that seeds whatever it needs,
 *      shoots, goes back, and lets the wipe happen
 *   5. seed for real, shoot every populated surface — NO navigation away in this phase
 *   6. the one data-bearing push that can afford to be last
 *
 * Other web-preview constraints (see AGENTS.md): `lazy: false` on the tab pager means all
 * tab screens are mounted at once, so a bare `.first()` on a shared label can resolve
 * to an off-screen copy; and hold-and-drag cannot be driven at all here, so no shot needs one.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { resolveChromium } from './chromium-path.mjs';
import { forceAppearance } from './force-appearance.mjs';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const outDir = args[0] && !args[0].startsWith('--') ? args[0] : 'review-bundle/screens';
const THEME = args.find((a) => a.startsWith('--theme='))?.split('=')[1] || 'light';
const ONLY = args.find((a) => a.startsWith('--only='))?.split('=')[1] || 'all';
const FULL = ONLY === 'all';
/** Pin Math.random + the clock so shots can be diffed run to run. See freezeNondeterminism. */
const DETERMINISTIC = args.includes('--deterministic');

fs.mkdirSync(outDir, { recursive: true });

const CHROMIUM_PATH = resolveChromium();

const prefix = THEME === 'dark' ? 'dark-' : '';
const captions = [];
const problems = [];
let shotIndex = 0;

/**
 * Wait until the page has stopped moving, by asking it rather than by guessing how long.
 *
 * ⚠️ **This replaces a `waitForTimeout` that was machine-speed-dependent, and that dependence is
 * what broke the gate in CI (2026-08-30).** `habits-empty` needed a settle — its TabSlider's
 * sliding pill was still in flight — and a fixed wait tuned on this machine (374 px at 1100 ms →
 * 73 at 2600 → 0 at 4200) landed the RUNNER at a different point in the same animation, so CI
 * reported exactly the 73 px the 2600 ms run produced here. A timeout cannot be right on two
 * machines at once; a predicate can.
 *
 * Two viewport screenshots a beat apart, compared byte for byte — the same question the pixel
 * gate itself asks, which is what makes it the honest predicate here. A screen that is already
 * static costs one extra capture and returns immediately. A screen with a genuinely endless
 * animation spends the budget and proceeds, which is no worse than the bare wait it replaces —
 * so this can be unconditional without any screen being able to hang the walk.
 *
 * ⚠️ **ONE matching pair was not enough, and the screen that proved it is `task-editor`
 * (2026-09-07).** `components/ScreenBackground.tsx` crossfades the per-tab hue over
 * `Duration.ambient` — **2400 ms**, far longer than this function's whole 3000 ms budget — on an
 * ease-out whose tail changes by well under one level per 250 ms step. So two consecutive frames
 * could compare equal MID-FADE, and this returned "settled" on a screen that was still moving.
 *   That race is older than the bug it caused; what made it visible was cards becoming
 * translucent again. While an ambient card painted an opaque fill, the crossfade was invisible
 * over ~86% of the frame, so a mid-fade capture was byte-identical to a settled one and this
 * function got the right answer for the wrong reason. Once the pane transmits the backdrop, the
 * same race prints a card fill a level or two off, run to run: measured on ONE machine against
 * baselines blessed on it an hour earlier, `task-editor` came back 0 px, then 27 px, then 127 px.
 *
 * So the predicate is now **`STABLE_FRAMES` consecutive identical captures**, and the budget
 * exceeds the longest ambient animation rather than being half of it. A still screen costs one
 * extra step per additional frame required (~44 shots × 250 ms ≈ 11 s per walk) and that is the
 * whole price. Do not lower either constant to make a walk faster: the failure they prevent
 * presents as an unrelated screen drifting by a hundred pixels, which is the most expensive kind
 * of red this repo produces.
 */
const STABLE_FRAMES = 3;   // 750 ms of byte-identical output before a screen counts as still
const SETTLE_BUDGET_MS = 6000;   // > Duration.ambient (2400) with room for the fade to finish

async function settle(page, { budgetMs = SETTLE_BUDGET_MS, step = 250 } = {}) {
  let previous = null;
  let matches = 0;
  for (let waited = 0; waited <= budgetMs; waited += step) {
    const frame = await page.screenshot({ fullPage: false });
    if (previous && previous.equals(frame)) {
      // `STABLE_FRAMES` CAPTURES in a row means `STABLE_FRAMES - 1` consecutive matches.
      if (++matches >= STABLE_FRAMES - 1) return true;
    } else {
      matches = 0;
    }
    previous = frame;
    await page.waitForTimeout(step);
  }
  return false;
}

/**
 * Freeze, then restore, every horizontal scroll position across `shot()`'s scroll-to-top.
 *
 * The tab bar is `react-native-pager-view`, which on web is a horizontally scrolling container.
 * Chromium CHAINS a vertical wheel into the nearest ancestor that can consume it, so once
 * `shot()`'s scroll-to-top has bottomed out the inner (vertical) scroller — which is most short
 * screens — the remaining delta slides the PAGER sideways instead. It parks between two pages
 * and stays there, so `settle()` sees a perfectly still frame and reports success while the
 * screenshot shows two half screens, or the wrong tab entirely under the right nav highlight.
 *
 * That is how `task-editor` sat at 42-59% changed on a diff that never touched it, and why the
 * parked frame reads as a stable baseline rather than an animation caught mid-flight.
 *
 * ⚠️ Restore, do NOT "snap to the nearest page". Nearest is a guess, and it guesses wrong exactly
 * when the drift is worst: a wheel that pushes the pager more than half a page puts the nearest
 * boundary on the WRONG tab, which produced a `shopping-populated` showing the To-do list under a
 * highlighted Shop pill. The position the app itself set is the only correct answer, so record it
 * before the wheel and put it back afterwards.
 */
async function freezeScrollX(page) {
  return page
    .evaluate(() => {
      const marked = [];
      let i = 0;
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollWidth <= el.clientWidth + 1 || el.clientWidth === 0) continue;
        const key = `sx${i++}`;
        el.setAttribute('data-walk-sx', key);
        marked.push([key, el.scrollLeft]);
      }
      return marked;
    })
    .catch(() => []);
}

async function restoreScrollX(page, marked) {
  if (!marked || !marked.length) return;
  await page
    .evaluate((entries) => {
      for (const [key, left] of entries) {
        const el = document.querySelector(`[data-walk-sx="${key}"]`);
        if (el && el.scrollLeft !== left) el.scrollLeft = left;
        if (el) el.removeAttribute('data-walk-sx');
      }
    }, marked)
    .catch(() => {});
  await page.waitForTimeout(300);
}

/**
 * Force the tab pager onto an exact page index.
 *
 * Last resort, and needed because the two gentler moves both fail here:
 *   · re-tapping the current tab is a no-op — the navigator still believes it is on that tab, so
 *     nothing calls `jumpTo` and the drifted scroll offset stays exactly where it was;
 *   · a To-do → Shop round trip does not reseat it either (measured: still straddling pages).
 * The pager's scroll offset and the navigator's idea of the active tab have genuinely diverged,
 * and only the offset is wrong, so writing the offset directly is the fix that matches the fault.
 *
 * The pager is the horizontally scrollable element whose page width is the viewport width; inner
 * horizontal strips (week pickers, chip rows) are narrower and are left alone.
 */
async function forcePagerTo(page, index) {
  await page
    .evaluate((i) => {
      const vw = window.innerWidth;
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollWidth <= el.clientWidth + 1) continue;
        if (Math.abs(el.clientWidth - vw) > 2) continue;
        el.scrollLeft = i * el.clientWidth;
      }
    }, index)
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function shot(page, name, meta = {}) {
  // A full-page screenshot here captures the VIEWPORT, not the whole scroll content: the app
  // scrolls inside a fixed-height ScrollView, not the document. So framing depends on wherever
  // the last interaction left the scroll — put every screen shot back at its top first. Sheets
  // and modals are excluded: the wheel would land on the sheet's own scroller instead.
  const isOverlay = /^(SHEET|MODAL|LAYOUT)/.test(meta.state || '');
  if (meta.top !== false && !isOverlay) {
    // The cursor starts at (0,0), which is outside the scroller on several screens and makes
    // the wheel a no-op — park it over the middle of the content first.
    const frozenX = await freezeScrollX(page);
    await page.mouse.move(215, 500);
    await page.mouse.wheel(0, -6000);
    await page.waitForTimeout(400);
    await restoreScrollX(page, frozenX);
  }
  // Ask the page whether it has stopped moving. See `settle` — a fixed wait is only ever right
  // on the machine it was tuned on, and this walk runs on at least two.
  await settle(page);
  shotIndex += 1;
  const file = `${prefix}${String(shotIndex).padStart(2, '0')}-${name}.png`;
  // ⚠️ **`fullPage: false` since 2026-08-29, and it captures strictly MORE useful area than the
  // `fullPage: true` it replaces.** The note above already says why: the app scrolls inside a
  // fixed-height ScrollView, not the document, so "full page" never reached below the fold —
  // it only added the ~61px of bare document that sits under the app's 932px viewport. That
  // strip is not the app, and it is not stable: it renders as whatever the outermost background
  // happens to be, so a change to the backdrop's own view tree moves it while nothing inside
  // the app moves at all. Measured — an early cut of the 2026-08-29 GPU pass came back with 18
  // of 21 baselines "changed", every one of them differing at exactly y=932 and nowhere above
  // it. A gate whose findings are mostly outside the thing it guards gets ignored.
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  captions.push({ file, theme: THEME, ...meta, name });
  console.log(`  ${file} — ${meta.title || name}`);
}

// ---------------------------------------------------------------------------
// driving helpers
// ---------------------------------------------------------------------------

async function clickText(page, text, opts = {}) {
  const locator = page.getByText(text, { exact: opts.exact ?? true });
  await locator.first().waitFor({ state: 'attached', timeout: opts.timeout ?? 10000 });
  for (const candidate of await locator.all()) {
    if (await candidate.isVisible()) {
      await candidate.click({ timeout: opts.timeout ?? 10000 });
      return true;
    }
  }
  throw new Error(`clickText: no visible match for "${text}"`);
}

/**
 * Click a text node that is genuinely on screen. `isVisible()` is not enough here: the pager
 * keeps every tab screen mounted and moves them by transform, so a label that also exists
 * on another tab (every card has a "Show all") reports visible from off-screen and the click
 * lands on the wrong card.
 */
async function clickOnScreenText(page, text) {
  for (const el of await page.getByText(text, { exact: true }).all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && box.x > -20 && box.x < 430) {
      await el.click({ timeout: 8000 });
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

async function tryText(page, text, timeout = 2500) {
  try {
    await clickText(page, text, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function tryButton(page, name, timeout = 4000) {
  const btn = page.getByRole('button', { name, exact: true }).first();
  if (!(await btn.isVisible({ timeout }).catch(() => false))) return false;
  await btn.click({ timeout: 8000 }).catch(() => false);
  await page.waitForTimeout(700);
  return true;
}

/**
 * Same as `tryButton`, but matches the accessible name as a SUBSTRING.
 *
 * `CardCollapseToggle` composes its label as `\`${cardLabel}: ${action}\``, so a week list's
 * chevron is "Shopping list: Expand list", not "Expand list". The exact-match lookup the walk
 * used therefore never matched, the card stayed collapsed, and — because `tryButton` reports a
 * miss by returning false — nothing said so. Substring is the right shape for any control whose
 * label is composed from a card name.
 */
async function tryButtonLike(page, fragment, timeout = 4000) {
  const btn = page.getByRole('button', { name: fragment }).first();
  if (!(await btn.isVisible({ timeout }).catch(() => false))) return false;
  await btn.click({ timeout: 8000 }).catch(() => false);
  await page.waitForTimeout(700);
  return true;
}

/** Close whatever sheet/modal is on screen. Everything below is a "just get out" affordance. */
async function closeOverlays(page) {
  for (let i = 0; i < 4; i++) {
    let closed = false;
    for (const label of ['Done', 'Close', 'Skip', 'Got it', 'Got it →', 'OK', 'Cancel']) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        closed = true;
        break;
      }
    }
    if (!closed) return;
  }
}

async function dismissTour(page) {
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 8000 });
    await page.waitForTimeout(700);
  }
}

async function tab(page, name) {
  await closeOverlays(page);
  await page.getByRole('button', { name, exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(900);
  await closeOverlays(page);
}

/**
 * Open a card by title, so its body — composer included — is actually in the DOM.
 *
 * ⚠️ Every card RESTS CLOSED since 2026-08-21 (`lib/cardDefaults.ts`), and a closed card is a
 * bare header: its composer does not exist to be typed into. Without this, a seeding step aimed
 * inside a card waits its full timeout and the step SKIPS — the silent failure this whole audit
 * family keeps getting bitten by, and exactly what happened to the Habits composer here.
 *
 * The chevron's accessible name is `<card title>: <expandListLabel>` in BOTH states
 * (components/CardCollapseToggle.tsx), so this is a no-op on an already-open card. Same helper
 * as `scripts/measure-wraps.mjs`'s; kept per-file because the two walks run in different
 * languages.
 */
async function openCard(page, title, expandLabel = 'Expand list') {
  const toggle = page.getByRole('button', { name: `${title}: ${expandLabel}`, exact: true }).first();
  if (!(await toggle.isVisible().catch(() => false))) return false;
  await toggle.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await toggle.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(700);
  return true;
}

/** Onboarding. `allRows` uses the Settings re-run route, which is where the appearance row lives. */
async function runOnboarding(page, { allRows = false, capture = false } = {}) {
  await page.goto(allRows ? `${BASE_URL}/onboarding/basics?rows=all` : BASE_URL, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(1300);
  if (capture) {
    await shot(page, 'onboarding-basics-norwegian', {
      title: 'Onboarding — Basics, before a language is picked',
      screen: 'app/onboarding/basics.tsx',
      state: 'FRESH INSTALL, screen one of two. Norwegian-first: the app opens in Norwegian, and every row previews live — picking English re-renders the screen you are standing on.',
    });
  }
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(700);
  if (capture) {
    await shot(page, 'onboarding-basics-english', {
      title: 'Onboarding — Basics, switched to English',
      screen: 'app/onboarding/basics.tsx',
      state: 'A fresh install draws only this one row. The other five (appearance, text size, movement, menu side, starting screen) are behind "Run setup again" in Settings — screen one was asking for fifteen decisions before the user knew what the app was.',
    });
  }
  if (allRows) {
    if (THEME === 'dark') {
      const darkPill = page.getByRole('radio', { name: /Dark\./ }).first();
      if (await darkPill.isVisible({ timeout: 4000 }).catch(() => false)) {
        await darkPill.click({ timeout: 8000 });
        await page.waitForTimeout(800);
      } else {
        problems.push('Could not find the Dark appearance pill — dark shots may be light');
      }
    }
    if (capture) {
      await shot(page, 'onboarding-basics-all-rows', {
        title: 'Onboarding — Basics with all six rows',
        screen: 'app/onboarding/basics.tsx',
        state: 'The Settings re-run (`?rows=all`): language, appearance, text size, movement, menu side, starting screen. One screen is the hard cap — a seventh setting goes to Settings. Every value already has a working default, so this screen only ever ADJUSTS; skipping it is a no-op.',
      });
    }
  }
  await clickText(page, 'Continue');
  await page.waitForTimeout(900);
  if (capture) {
    await shot(page, 'onboarding-privacy', {
      title: 'Onboarding — Privacy (the last screen)',
      screen: 'app/onboarding/privacy.tsx',
      state: 'Onboarding is TWO screens. It was ~18, then 7, then 6. Restoring a backup is a link below the primary button rather than a screen of its own — a returning user\'s question, asked of the person who needs it instead of everyone.',
    });
  }
  await clickText(page, 'Start');
  await page.waitForTimeout(2200);
}

async function walkTour(page, { capture = false } = {}) {
  for (let i = 0; i < 8; i++) {
    if (await page.getByText('Start using the app', { exact: true }).first().isVisible().catch(() => false)) {
      if (capture) {
        await shot(page, 'tour-finale', {
          title: 'Guided tour — closing card',
          screen: 'components/TourSpotlight.tsx',
          state: 'The end of the tour, and where the downloadable "AI setup guide" lives — the app has no in-app AI builder, so a user hands that file to an external AI and uploads the filled-in reply back into Settings.',
        });
      }
      await clickText(page, 'Start using the app');
      break;
    }
    if (!(await page.getByText('Got it', { exact: true }).first().isVisible().catch(() => false))) break;
    if (capture) {
      await shot(page, `tour-step-${i + 1}`, {
        title: `Guided tour — step ${i + 1}`,
        screen: 'components/TourSpotlight.tsx + components/TourTarget.tsx',
        state: 'One spotlight step per tab, on the real app rather than a slideshow. Everything but one card is dimmed; that card stays live and tappable through the hole. Every step is skippable on its own, and progress is a SET of ids — a skipped step and a finished one are indistinguishable, so reordering can never strand anyone.',
      });
    }
    await clickText(page, 'Got it');
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1300);
}

/**
 * Return from a pushed sub-screen. The document reload wipes the DB, so the app may land back
 * in onboarding or replay the tour — put it back on its feet either way.
 */
async function back(page) {
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1200);
  await ensureTabs(page);
}

/**
 * Guarantee the app is sitting on the tab pager with the bottom nav visible. A goBack can
 * land anywhere — mid-onboarding on a wiped DB, or one screen too far back if the excursion
 * pushed twice — and the next phase has no way to recover on its own. Reload from scratch as
 * the last resort; the DB is already gone either way.
 */
async function ensureTabs(page) {
  await dismissTour(page);
  await closeOverlays(page);
  if (await page.getByRole('button', { name: 'Home', exact: true }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }
  if (await page.getByText('Continue', { exact: true }).first().isVisible({ timeout: 1500 }).catch(() => false)) {
    await tryText(page, 'Continue', 4000);
    await page.waitForTimeout(800);
    await tryText(page, 'Start', 4000);
    await page.waitForTimeout(1800);
    await walkTour(page, { capture: false });
    await dismissTour(page);
    if (await page.getByRole('button', { name: 'Home', exact: true }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }
  }
  console.log('  (lost the tab bar — reloading and re-running onboarding)');
  await runOnboarding(page, {});
  await walkTour(page, { capture: false });
  await dismissTour(page);
}

/** An excursion: push somewhere, shoot it, come back, and absorb the DB wipe. */
async function excursion(page, label, fn) {
  try {
    await fn();
  } catch (e) {
    problems.push(`${label}: ${e.message.split('\n')[0]}`);
    console.log(`  (skipped ${label}: ${e.message.split('\n')[0]})`);
  }
  await back(page).catch(() => {});
}

// ---------------------------------------------------------------------------
// seeding helpers (used both by throwaway excursions and by the real data phase)
// ---------------------------------------------------------------------------

/**
 * The tab screens are all mounted at once (`lazy: false`) and the pager moves pages by
 * transform, so an input on an off-screen tab still reports `isVisible()` — a bare `.first()`
 * on a shared label like "Type task" happily resolves to a card on a different tab and then
 * fails with "element is outside of the viewport". Ask for the one whose box is actually in
 * the window.
 */
async function onScreenField(page, label) {
  for (const el of await page.getByLabel(label, { exact: true }).all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && box.x > -20 && box.x < 430) return el;
  }
  return null;
}

async function typeInto(page, label, text) {
  const field = await onScreenField(page, label);
  if (!field) {
    problems.push(`No on-screen field labelled "${label}" — could not type "${text}"`);
    return false;
  }
  await field.scrollIntoViewIfNeeded().catch(() => {});
  await field.click({ timeout: 8000 });
  await field.fill(text);
  await field.press('Enter');
  await page.waitForTimeout(700);
  return true;
}

const seedTask = (page, title) => typeInto(page, 'Type task', title);
const seedHabit = (page, title) => typeInto(page, 'Type habit', title);

async function seedMedicine(page, name) {
  if (!(await tryButton(page, 'Add a medicine'))) return false;
  const input = page.getByPlaceholder('Add a medicine').first();
  await input.fill(name);
  await input.press('Enter');
  await page.waitForTimeout(900);
  return true;
}

// forceAppearance is now shared — see scripts/force-appearance.mjs. It moved there
// 2026-09-01 so measure-geometry.mjs/measure-wraps.mjs/measure-halos.mjs (which ran
// light-mode-only in CI) could force dark mode the same way this file always has.

/**
 * Pin the two sources of run-to-run variation, so a screenshot can be DIFFED and not merely
 * looked at (`npm run visual`). Opt-in via `--deterministic`; the review bundle does not use
 * it, because a human reader benefits from seeing a real random line.
 *
 * Both are page-level overrides installed before any app code evaluates — nothing in the app
 * changes, and nothing here can leak into a shipped build.
 *
 *   · **`Math.random`** — `components/NarratorQuote.tsx` picks its line by a random index ON
 *     MOUNT, so every empty state in the app renders different copy on every run. That is one
 *     of the surfaces a baseline most wants to watch (it is what an empty card SAYS), so
 *     skipping those screens would be the wrong trade. A tiny deterministic PRNG (mulberry32)
 *     rather than a constant: `Math.random()` returning the same number forever is a subtly
 *     different program, and at least one caller could divide by the gap between two draws.
 *   · **The clock** — the day log splits "today" at the current minute, several surfaces print
 *     a date, and `Updates.createdAt` renders a timestamp. Frozen to a fixed local noon on a
 *     Wednesday: mid-week and mid-day, so nothing lands on a week or day boundary where a
 *     surface would render its "edge" state and make the baseline depend on when it was blessed.
 *
 * ⚠️ `Date` must stay a real constructor — the app calls `new Date(someString)` and
 * `date.getTime()` all over `lib/date.ts`. Only the ZERO-ARGUMENT construction and `Date.now`
 * are pinned; every other overload passes straight through.
 */
/**
 * Pin the two things that make an identical build produce two different pictures.
 *
 * ⚠️ **`Math.random` is a seeded STREAM, not a constant, and the difference bites when you edit
 * this walk.** components/NarratorQuote.tsx picks its line by a random index ON MOUNT, so which
 * line a screen shows depends on how many draws happened *earlier in the walk* — insert one step
 * upstream and every narrator line downstream of it re-rolls. That is what it looks like: a
 * screen the commit never touched, differing only in one italic sentence. **Look at the diff and
 * confirm it is only the quote before blessing it** — the failure it resembles (a card's content
 * changing) is a real regression.
 *
 * It cannot simply return a constant, and the reason is the other consumer: lib/id.ts is
 * `Date.now().toString(36) + Math.random().toString(36).slice(2, 7)`, and `Date.now()` is frozen
 * here — so the random half is the ONLY thing keeping two rows created in one walk from sharing
 * an id. A constant would silently corrupt the seeded data instead of merely re-rolling a
 * sentence. The stream serves both; the cost is this caveat.
 *
 * And `Date.now()` must stay frozen with the constructor rather than running live: the goal
 * strength bands (lib/goalStrength.ts) and task decay (`isWashedAway`) both compare a stored
 * timestamp — written through the FROZEN `new Date()` — against it. A live clock against frozen
 * rows would wash every seeded task away before it could be photographed.
 */
async function freezeNondeterminism(page) {
  await page.addInitScript(() => {
    let seed = 0x9e3779b9;
    Math.random = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const FROZEN = new Date('2026-06-17T12:00:00').getTime(); // a Wednesday, local noon
    const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...args) {
        // Only "what time is it now" is pinned; every explicit value is passed through.
        if (args.length === 0) super(FROZEN);
        else super(...args);
      }
      static now() {
        return FROZEN;
      }
    };
    Date.parse = RealDate.parse;
    Date.UTC = RealDate.UTC;
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

  if (DETERMINISTIC) await freezeNondeterminism(page);
  // ⚠️ **BOTH modes are forced, and light MUST be (2026-08-29).** `--theme=light` used to mean
  // only "don't call forceDarkMode" — which stopped meaning light on 2026-08-16, when dark
  // became the DEFAULT appearance. AGENTS.md has said so since; this walk had not caught up, so
  // every "light" baseline was in fact a dark-mode screenshot and the two committed sets were
  // the same picture twice. Caught by the gate itself: a change scoped to `isDark` moved the
  // "light" baselines by exactly the amount it moved the dark ones, which is impossible.
  await forceAppearance(page, THEME === 'dark' ? 'on' : 'off');

  try {
    // ---- 1. onboarding + tour -------------------------------------------
    console.log('> onboarding + tour');
    await runOnboarding(page, { capture: FULL });
    await walkTour(page, { capture: FULL });

    // ---- 2. the three tabs, empty ---------------------------------------
    console.log('> tabs, empty');
    await shot(page, 'home-empty', {
      title: 'Me — first run, nothing added yet',
      screen: 'app/(tabs)/index.tsx',
      state: 'EMPTY. "Me" is the personal tab (2026-08-19) — habits, notes and health, and nothing else. It stopped previewing To-do and Shopping when To-do took the centre tab: a shorter second copy of a tab one swipe away is duplication, not a shortcut. It owns no data of its own; each card wears the border hue of the surface it comes from (habits cyan, notes violet, health rose) and the tab itself is neutral grey. The Energy strip is replaced by its tutorial card while nothing carries an energy value — a full ten-pip bar with nothing able to spend it reads as a score. That card draws no tree: the watermark was removed here by name (2026-08-19).',
      components: 'EnergyMeter, HomeHabitsCard, HomeNotesCard, HomeHealthCard, StarterCard, StarterExampleRow',
    });

    for (const [btn, file, title, screen, state, components] of [
      ['Shop', 'shopping-empty', 'Shopping — empty', 'app/(tabs)/shopping.tsx',
        'EMPTY. Green screen hue. Week lists / Monthly list / Whenever, with Food, Catalogue and Scan as buttons rather than tabs. A migration seeds one empty monthly list, which is why this surface\'s empty-state gate has to count items too, not just lists.',
        'WeekListCard, ShoppingRow, InlineAddItem, StarterCard, ShoppingFilterBar, NewMonthlyListRow'],
      // ⚠️ **This clicked 'Home' until 2026-08-30, and had done since the 5→3 tab merge.** The
      // comment it carried was true then — Health was a CARD on the Me tab and 'Me' was the
      // screen that held it — and stopped being true on 2026-08-22, when the five tabs came
      // back. Nothing failed: the walk kept producing a `health-empty.png`, it was just a second
      // copy of `home-empty`, so the committed baseline for the Health tab was a picture of a
      // different screen for eight days. Found by the pixel gate reporting 0 changed pixels here
      // on a commit that demonstrably added a header icon to this screen — a shot that cannot
      // move is the shape this class of rot takes. **A tab click is only as good as the nav
      // label beside it**; re-read this loop against `components/BottomNav.tsx` whenever the bar
      // changes, the same way `npm run wraps`'s walk has to be.
      // To-do and Habits are also tabs again, but they stay in phase 4: they are shot there as
      // excursions that open a specific card, which the plain tab click here cannot do.
      ['Health', 'health-empty', 'Health — empty', 'components/HealthSurface.tsx',
        'EMPTY. Rose card hue. Medicine trays (morning / midday / evening / night — windows, not clock times) sit above the symptom log. Nothing on this surface is a scoreboard: a count of migraines is not an achievement in either direction, so there is no streak, no total, no escalating colour, and — the trap specific to this domain — no congratulation for a quiet week.',
        'MedicineTrayCard, OpenEpisodeCard, AddRow, StarterCard, StarterExampleRow'],
    ]) {
      await tab(page, btn);
      await shot(page, file, { title, screen, state, components });
    }

    // ---- 3. sheets and overlays (close in place) -------------------------
    if (FULL) {
      console.log('> sheets and overlays');
      await tab(page, 'Home');
      if (await tryButton(page, "Set the day's energy")) {
        await shot(page, 'energy-config-sheet', {
          title: 'The Energy config sheet',
          screen: 'components/EnergyConfigSheet.tsx',
          state: 'SHEET. Energy is the app\'s one number. Its explainer under the meter is PERMANENT rather than a card that self-destructs — an explanation that disappears is not there when you come back to the number months later.',
          components: 'EnergyConfigSheet, Stepper, Slider',
        });
        // ⚠️ **Set a capacity before leaving, or the meter itself is never photographed.**
        // Home draws `StarterCard` ("Set the day's energy") until a capacity exists, so every
        // Home baseline in this set has only ever shown the TUTORIAL state. The v2 Energibudsjett
        // bar — filled = brukt, outline = igjen, a divided run for gitt tilbake, and the legend
        // that says which way to read them — lives in the populated meter and was invisible to
        // this walk by construction: the 2026-09-06 pass that built it got `0 changed` across
        // all 21 baselines in both themes, which is EXECUTION_RULES.md rule 2's "a harness that
        // reports unchanged must prove it looked" exactly.
        //   The `+` keys carry no accessible name of their own (components/Stepper.tsx), so they
        // are reached through the row's label — the last button in the row labelled with
        // `energyMeter.todayCapacity`.
        const capRow = page.getByLabel("Today's energy").first();
        if (await capRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          const plus = capRow.getByRole('button').last();
          for (let i = 0; i < 8; i++) await plus.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(500);
        }
        await closeOverlays(page);
        await page.waitForTimeout(900);
        // Only shoot it if the starter card is actually gone — otherwise this is another
        // confident capture of the state it was meant to replace.
        if (!(await page.getByText("Set the day's energy", { exact: true }).first().isVisible({ timeout: 1500 }).catch(() => false))) {
          await shot(page, 'home-energy-budget', {
            title: 'Home — the Energy budget bar (v2)',
            screen: 'components/EnergyMeter.tsx',
            state: 'POPULATED METER, and the only baseline that reaches it. Filled = SPENT, outline = left — the inverse of the glossy pip token this row drew until 2026-09-06, and the reading v2 states outright. A third run in the habits hue, after a divider, is energy a habit gave BACK; it is capped so it stays a shape and not a tally. The legend is load-bearing: it is the only thing on screen saying which way the glyphs read.',
            components: 'EnergyMeter, energyBudgetBar, EnergyConfigSheet',
          });
        }
      }
      // ⚠️ **No per-card ⋯ to shoot since 2026-09-01.** Home hid and arranged its cards from a
      // per-card kebab over its own `settings.homeCardOrder` column; that whole mechanism —
      // components/CardMenuSheet.tsx, components/HomeCardManager.tsx, lib/homeCards.ts and the
      // "Retired" shelf — is deleted. Home uses the same "Manage cards" header control as the
      // other four screens now (maintainer: *"One button per screen for reordering and/or hiding
      // cards instead of the three dots was disregarded"*), which this walk already shoots.
      // ⚠️ **No Goals drawer to shoot (2026-09-01).** It was a folded section inside To-do's
      // Today card; goal editing is a centre pop-up reached from a goal picker's "Edit goals"
      // row now, and it is shot as `goals-editor` in the data-bearing phase at the end of this
      // walk — where a picker actually exists to open it from.
      if (await tryButton(page, 'How lists look')) {
        await shot(page, 'layout-picker', {
          title: 'The layout picker (per surface, from that surface\'s own header)',
          screen: 'components/LayoutPickerSheet.tsx',
          state: 'SHEET. Three shared detail levels (Just the basics / Normal / Show everything) plus surface-specific shapes. Layouts are named after the SITUATION you would want them in — "In the store", never "Compact". They are presentation ONLY: a row a layout does not draw is still live, still counted in headers, still reminding, one tap away.',
          components: 'LayoutPickerSheet, TabSlider',
        });
        if (await tryText(page, 'One thing at a time', 3000)) {
          await page.waitForTimeout(900);
          await shot(page, 'plans-layout-one-thing', {
            title: 'To-do — the "One thing at a time" layout',
            screen: 'lib/cardLayout.ts',
            state: 'LAYOUT. A Next-up hero, a short Then list, then the day\'s done count. Also hides the Whenever section. The mock\'s row of count chips was deliberately not built — it duplicated the tab bar a few pixels above it, so the counts live in the tab slider\'s own accessory slot.',
          });
        }
        if (await tryText(page, 'Just the basics', 3000)) {
          await page.waitForTimeout(900);
          await shot(page, 'plans-layout-basics', {
            title: 'To-do — the "Just the basics" layout',
            screen: 'lib/cardLayout.ts',
            state: 'LAYOUT, sparsest. Whatever the PREVIOUS view was hiding glows briefly after a switch — the glow marks VISIBILITY, not novelty, so a glowing row is usually something the user has had for months.',
            components: 'NewSinceGlow',
          });
        }
        await closeOverlays(page);
      }

      await tab(page, 'Health');
      await openCard(page, 'Medicine');
      if (await tryButton(page, 'Reminder times')) {
        await shot(page, 'medicine-reminder-times', {
          title: 'Medicine tray reminder times',
          screen: 'app/(tabs)/health.tsx + lib/medicineNotifications.ts',
          state: 'SHEET. ONE reminder per tray, shared by every medicine in it, with a "Taken" action that logs the whole tray from the notification shade. Quiet hours SKIP a tray rather than shifting it.',
        });
        await closeOverlays(page);
      }
    }

    // ---- 4. pushed sub-screens (each excursion ends in a DB wipe) --------
    if (FULL) {
      console.log('> pushed sub-screens');

      // To-do and Habits (2026-08-20, 5 tabs → 3). They were tabs until the merge and are
      // pushed screens now, so they belong in this phase rather than in the tab loop above.
      // Reached by their card headers on Home — the same route a user takes — rather than by
      // a goto, so the walk also proves those doors still open.
      await excursion(page, 'plans-empty', async () => {
        await tab(page, 'To-do');
        await clickOnScreenText(page, "Today's list");
        await page.waitForTimeout(1100);
        await shot(page, 'plans-empty', {
          title: 'To-do — empty (a pushed screen since the 3-tab merge)',
          screen: 'app/plans.tsx',
          state: 'EMPTY. Blue screen hue. This is the DEEP surface — This week, All tasks, Recurring, Washed away — that a daily list has no room for; the day itself now lives on Home. Today is the default tab and is drawn as the elastic timeline, real durations and visible gaps, split by a live now-line. The explainer draws inside the card rather than as a card above it (a Surface inside a Surface reads as a nested panel).',
          components: 'PlanTaskCard, TaskCard, SectionCard, AddRow, TabSlider, CollapsedSection, DayGridLines',
        });
      });

      await excursion(page, 'habits-empty', async () => {
        await tab(page, 'Habits');
        await clickOnScreenText(page, 'Habits');
        // This shot is why `settle()` exists — see its header. It was the one screen in the set
        // that was not bit-identical between two runs of an unchanged build (its TabSlider's
        // pill was still sliding), and the fixed wait that fixed it HERE reproduced the defect
        // on the CI runner instead. `shot()` waits on the page rather than on a number now, so
        // this is back to its siblings' value.
        await page.waitForTimeout(1100);
        await shot(page, 'habits-empty', {
          title: 'Habits — empty (a pushed screen since the 3-tab merge)',
          screen: 'app/habits.tsx',
          state: 'EMPTY. Sky screen hue. Where a habit is SET UP and browsed; the day\'s due habits are a section of the merged card on Home. Offers one-tap starter habits instead of an empty list. There is no negative habit, no slip log and no broken streak anywhere in the app.',
          components: 'PadRow, PadTypeRow, StarterCard, HabitIcon, CollapsedSection',
        });
      });

      await excursion(page, 'food', async () => {
        await tab(page, 'Shop');
        await tryButton(page, 'Food');
        await page.waitForTimeout(900);
        await shot(page, 'food', {
          title: 'Food & meals (a button on Shopping, not a tab)',
          screen: 'app/food.tsx',
          state: 'EMPTY. Orange screen hue. The per-meal "add a dish" trigger sits at the BOTTOM of the list it appends to — it used to be a small "+" wedged into the section header beside the collapse chevron, close enough that the two read as one crowded control.',
          components: 'FoodTab, AddDishSheet, AddRow',
        });
      });

      await excursion(page, 'catalogue', async () => {
        await tab(page, 'Shop');
        // ⚠️ **`openCard`, not `tryButton('Catalogue')`.** The exact-match lookup never matched —
        // the toggle's accessible name is composed as "<card>: Expand list"
        // (components/CardCollapseToggle.tsx) — so the card stayed shut and this shot was a
        // second copy of `shopping-empty`, byte-identical to it in both themes. Same locator
        // drift as the shopping seeding no-op; see EXECUTION_RULES.md standing debt 1.
        await openCard(page, 'Catalogue');
        await page.waitForTimeout(900);
        // Prove the card is actually open before shooting it. Its Items/Dishes switch only
        // exists inside the body, so it is the cheapest thing that cannot be on screen while
        // the card is collapsed.
        if (!(await page.getByText('Dishes', { exact: true }).first().isVisible({ timeout: 4000 }).catch(() => false))) {
          throw new Error('catalogue: the card did not open — refusing to shoot the Shop tab behind it');
        }
        await shot(page, 'catalogue', {
          title: 'Catalogue — the Items tab',
          screen: 'app/(tabs)/shopping.tsx',
          state: 'SEEDED, and the first capture of this card that has ever actually opened it. ONE card with TWO tabs since 2026-09-07 (v3: "Katalog = ett kort, to faner") — Items is the catalogue that powers autocomplete and that OCR receipts upsert into; Dishes is the old Food card, now a tab. The lock and camera are drawn on Items only: both act on the item list and neither means anything under Dishes.',
          components: 'CatalogueTab, TabSlider, InlineAddItem',
        });
        // The other half of the same card. A tab whose content no baseline photographs is a
        // surface the gate cannot see — the defect this whole excursion just stopped being.
        if (await tryButton(page, 'Dishes')) {
          await page.waitForTimeout(700);
          await shot(page, 'catalogue-dishes', {
            title: 'Catalogue — the Dishes tab',
            screen: 'app/(tabs)/shopping.tsx',
            state: 'The former `shopDishes` card, now Catalogue\'s second tab (maintainer, 2026-09-07). Its meal-type sections and its "Add dish" ghost trigger are unchanged — FoodTab is mounted here exactly as it was mounted in its own card, reading the same store. The header controls are gone on this tab by design.',
            components: 'FoodTab, TabSlider',
          });
        }
      });

      await excursion(page, 'notes-empty', async () => {
        await tab(page, 'Home');
        await clickText(page, 'Notes');
        await page.waitForTimeout(1000);
        await shot(page, 'notes-empty', {
          title: 'Notes (reached from Home\'s Notes card)',
          screen: 'app/notes.tsx',
          state: 'EMPTY. Yellow screen hue. This empty state is the ONE first-person line in the whole app, and it is deliberate — see VOICE.md. Rows here are edited IN PLACE, which is the one thing the Home notes card does not do.',
          components: 'NoteRow, PadRow, AddFAB, VoiceNoteFAB',
        });
      });

      await excursion(page, 'day-log', async () => {
        // Earlier days is a SECTION inside To-do's Today card since 2026-08-26.
        await tab(page, 'To-do');
        await openCard(page, 'Today');
        await tryButton(page, 'Earlier days');
        await page.waitForTimeout(1000);
        await shot(page, 'day-log-screen', {
          title: 'Earlier days (the day log, one day at a time)',
          screen: 'app/day-log.tsx',
          state: 'EMPTY. One day at a time, deliberately with NO week view and no aggregation — two days compared is a scoreboard. No count, total, percentage or progress bar appears anywhere in this feature, and a test source-scans the module to keep it that way.',
          components: 'PlanTaskCard, DateChipRow',
        });
      });

      await excursion(page, 'health-form', async () => {
        await tab(page, 'Health');
        await tryButton(page, "What's bothering you?");
        await page.waitForTimeout(1000);
        await shot(page, 'health-form', {
          title: 'Log a symptom',
          screen: 'app/health-form.tsx',
          state: 'FORM, empty. A symptom entry can be a point in time or an ONGOING episode. An episode is a STATE, not a stretch of time: there is no live elapsed counter anywhere, duration is computed on read and rounded into plain language ("About 4 hours", never "3h 47m"), and nothing auto-closes, escalates or notifies at any horizon.',
          components: 'FormControls, DatePickerCalendar, EpisodeCloseSheet',
        });
      });

      await excursion(page, 'health-log', async () => {
        await tab(page, 'Health');
        await tryButton(page, 'Health log');
        await page.waitForTimeout(1000);
        await shot(page, 'health-log', {
          title: 'Health log (history)',
          screen: 'app/health-log.tsx',
          state: 'EMPTY. Health data is the most sensitive in the app: it never syncs between devices, and it is deliberately excluded from the AI setup guide entirely.',
        });
      });

      await excursion(page, 'medicine-form', async () => {
        await tab(page, 'Health');
        await openCard(page, 'Medicine');
        if (await seedMedicine(page, 'Vitamin D')) {
          await tryButton(page, 'Vitamin D');
          await page.waitForTimeout(1000);
          await shot(page, 'medicine-form', {
            title: 'The medicine editor',
            screen: 'app/medicine-form.tsx',
            state: 'FORM. Reached by tapping the medicine\'s NAME (its circle logs a dose instead). As-needed medicines belong to no tray and are guarded by a minimum gap plus an optional daily cap — nothing ever nudges you to take one.',
            components: 'FormControls, Stepper, TimeBoxInput',
          });
        }
      });

      await excursion(page, 'settings', async () => {
        await tab(page, 'Home');
        await tryButton(page, 'Settings');
        await page.waitForTimeout(1400);
        await shot(page, 'settings-general', {
          title: 'Settings — General',
          screen: 'app/settings.tsx',
          state: 'Neutral grey: Home and Settings are the only two screens with no hue of their own. Three tabs — General (profile, appearance, notifications, layout, feedback), Personal (accessibility, shopping, device features), Advanced (features, tags, backup, version, reset, debug). Reorganised 2026-08-17: what people actually come here to change is on the first tab.',
          components: 'TabSlider, FormControls, Surface, SectionCard',
        });
        if (await tryText(page, 'Personal', 4000)) {
          await page.waitForTimeout(900);
          await shot(page, 'settings-personal', {
            title: 'Settings — Personal',
            screen: 'app/settings.tsx',
            state: 'Notifications, shopping cadence, the global layout default, device features. "Run setup again" here re-enters onboarding\'s Basics screen with all six rows, seeded from current settings, so pressing straight through writes them back unchanged.',
          });
        }
        if (await tryText(page, 'Advanced', 4000)) {
          await page.waitForTimeout(900);
          await shot(page, 'settings-advanced', {
            title: 'Settings — Advanced',
            screen: 'app/settings.tsx',
            state: 'Feature flags in three states: on-by-default-but-real (Energy, Goals, Medicine, Day log), off-by-default opt-in (Automations), and hidden outright — every sharing-with-other-people surface is currently behind one constant while the single-user basics are reworked. Nothing was deleted to hide them.',
          });
        }
      });

      await excursion(page, 'design-lab', async () => {
        await tab(page, 'Home');
        await tryButton(page, 'Settings');
        await page.waitForTimeout(1400);
        await tryText(page, 'Advanced', 4000);
        await page.waitForTimeout(900);
        // Debug mode is the door since 2026-08-17 — the lab's own switch went in the
        // settings-declutter pass and its link lives inside the Debug mode card now.
        const labSwitch = page.getByRole('switch', { name: 'Debug mode', exact: true }).first();
        if (!(await labSwitch.isVisible({ timeout: 4000 }).catch(() => false))) return;
        await labSwitch.click({ timeout: 8000 });
        await page.waitForTimeout(900);
        await page.getByText('Design lab', { exact: true }).last().click({ timeout: 8000 });
        await page.waitForTimeout(1800);
        await shot(page, 'design-lab-playground', {
          title: 'Design lab — the playground',
          screen: 'app/design-lab/index.tsx',
          state: 'OFF BY DEFAULT, and the most relevant screen in this bundle for a reviewer: it is a workbench of empty screens and empty cards you build on, and the result exports as a document an agent applies to the real files. Every PART on it is the app\'s real component; only the ARRANGEMENT is the lab\'s.',
          components: 'DesignLabCard, DesignLabBench, PartPalette, PartControls, CardStarterSheet',
        });
        if (await tryText(page, 'Add a card', 4000)) {
          await page.waitForTimeout(900);
          await shot(page, 'design-lab-add-card', {
            title: 'Design lab — the add-a-card sheet',
            screen: 'components/CardStarterSheet.tsx',
            state: 'SHEET. Blank first, then two skeletons, then the eleven real app cards under their own heading — a card that names an origin exports as "the to-do card, but with the tick moved", i.e. a diff against something real.',
          });
          await tryText(page, 'A blank card', 4000);
          await page.waitForTimeout(1200);
          await shot(page, 'design-lab-blank-card', {
            title: 'Design lab — a blank card on the bench',
            screen: 'app/design-lab/index.tsx',
            state: 'Placement is free in the card\'s own four-column body grid and snapped in the row (the seven row slots go through the real PadRow). Every drag has a tap equivalent, deliberately — a drag-only control is one no automated check in this repo can reach.',
          });
        }
        if (await tryButton(page, 'Colours and shapes')) {
          await page.waitForTimeout(1400);
          await shot(page, 'design-lab-tokens', {
            title: 'Design lab — the token knobs',
            screen: 'app/design-lab/tokens.tsx',
            state: '34 palette tokens, 11 geometry numbers, 7 control jobs, 4 row positions, and the export. Two hook points carry the whole thing — useAppTheme() for colour and scaleStyles() for geometry — so no component gained a prop and there is no second rendering path.',
            components: 'ColorPickerSheet, Slider, TabSlider',
          });
          // Two pushes deep (settings → lab → tokens); the excursion's own back() only
          // unwinds one, and ensureTabs() catches whatever this lands on.
          await page.goBack().catch(() => {});
          await page.waitForTimeout(900);
        }
      });
    }

    // ---- 5. seed for real, shoot the populated states --------------------
    console.log('> seeding + populated states');
    await tab(page, 'To-do');

    const typeLine = (await onScreenField(page, 'Type task')) || page.getByLabel('Type task', { exact: true }).first();
    await typeLine.scrollIntoViewIfNeeded().catch(() => {});
    await typeLine.click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, 'quick-add-focused-empty', {
      title: 'The quick-add composer, focused and empty',
      screen: 'components/PadTypeRow.tsx',
      state: 'THE COMPOSER — three tiers, and this is the shape used on every surface. Tier 1 is the line: a name alone must always produce a valid row, or capture costs more than one gesture. Tier 2 is the labelled options panel, visible only while typing. Tier 3 is everything else behind the worded "More options", which is live in every state including an empty line. No blind tap-cycles: a stepper for a number, a picker for a choice.',
      components: 'PadTypeRow, QuickAddOptionsPanel, QuickAddOptionRow, Stepper',
    });

    for (const t of ['Ring the dentist', 'Water the plants', 'Pick up a parcel']) await seedTask(page, t);
    await shot(page, 'plans-today-populated', {
      title: 'To-do — Today, with tasks',
      screen: 'app/plans.tsx',
      state: 'POPULATED. The elastic timeline ahead of the now-line. Device-calendar events (read-only) draw here too, as structure rather than achievement, sharing one layout pass with tasks so an overlapping meeting and task go side by side rather than stacking.',
      components: 'PlanTaskCard, PadRow, DayGridLines',
    });

    // ⚠️ **The Planner card's two SECTIONS, which nothing else photographs.** `todoCalendar` and
    // `todoRecurring` became sections of `todoPlanner` on 2026-09-07 (maintainer: *"Calendar,
    // Recurring and this week is part of planning card"*), and every To-do baseline draws that
    // card COLLAPSED — so the merge itself would have been invisible to this gate, which is the
    // same rule-2 gap `home-energy-budget` and `catalogue` were both added to close.
    if (await openCard(page, 'Planner')) {
      await page.waitForTimeout(900);
      // The range segment belongs to the Calendar section and cannot be on screen while the
      // card is shut, so it proves the card actually opened.
      if (!(await page.getByText('Week', { exact: true }).first().isVisible({ timeout: 4000 }).catch(() => false))) {
        throw new Error('todo-planner: the card did not open — refusing to shoot the collapsed stack');
      }
      await shot(page, 'todo-planner', {
        title: 'To-do — the Planner card, open',
        screen: 'components/TodoSurface.tsx',
        state: 'ONE card, two sections. Calendar (with its Week/Month range — "this week" is the week view, not a fourth surface) and Recurring were separate cards until 2026-09-07; both bodies are unchanged, only their `<Card>` wrappers became `SectionRail tier="sub"`. This lands the tab on the three cards v3 draws: Whenever, Today, Planner.',
        components: 'TodoSurface, SectionRail, TaskCard, DateChipRow',
      });
    }

    const check = page.getByRole('checkbox', { name: 'Ring the dentist', exact: true }).first();
    if (await check.count()) {
      await check.click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      // Two things stand between the tick and the shot the caption describes. The card
      // collapses its log behind "Show all" on this tab; and the To-do tab's copy of the card
      // does not draw the newly-logged row until it REMOUNTS — Home's copy of the same card
      // updates live, which is why the gap is easy to miss. Round-trip the tab, then expand.
      await tab(page, 'To-do');
      await tab(page, 'To-do');
      await clickOnScreenText(page, 'Show all');
      await shot(page, 'day-log-after-tick', {
        title: 'To-do — a ticked task crosses the now-line into the day log',
        screen: 'lib/dayLog.ts, drawn by components/PlanTaskCard.tsx',
        state: 'THE DAY LOG — the feature\'s whole idea in one screenshot. Ahead of now, the day is elastic with visible gaps; behind now, the SAME day collapses into a flush, spacing-free list of what actually happened. A gap ahead of you is room; the identical gap behind you is an accusation. It is a record, not a productivity surface: no count, no total, no percentage, no verdict on a quiet day, and no notification ever.',
      });
    } else {
      problems.push('No checkbox for the seeded task — day-log state not captured');
    }

    const line2 = (await onScreenField(page, 'Type task')) || page.getByLabel('Type task', { exact: true }).first();
    await line2.scrollIntoViewIfNeeded().catch(() => {});
    await line2.click({ timeout: 8000 });
    await line2.fill('Sat in the sun for a bit');
    await page.waitForTimeout(500);
    const captureToggle = page.getByRole('switch', { name: 'What just happened?', exact: true }).first();
    if (await captureToggle.isVisible().catch(() => false)) {
      await captureToggle.click({ timeout: 8000 });
      await page.waitForTimeout(500);
      await shot(page, 'quick-add-moment-mode', {
        title: 'The same field, switched to capturing a moment',
        screen: 'components/PadTypeRow.tsx',
        state: 'One field, one submit: a switch in the composer changes whether Enter commits a task or a day-log moment. There is deliberately no second input anywhere — the standalone quick-capture inbox was removed and its table is dead.',
      });
      await page.getByLabel('What just happened?', { exact: true }).first().press('Enter');
      await page.waitForTimeout(900);
      await tab(page, 'To-do');
      await tab(page, 'To-do');
      await clickOnScreenText(page, 'Show all');
      await shot(page, 'day-log-with-moment', {
        title: 'The day log with a captured moment in it',
        screen: 'lib/dayLog.ts',
        state: 'Sources are tasks, habits, medicine doses, health entries and manual moments. Shopping and notes are deliberately out. A completion from before the app started timestamping has no honest time and is simply absent — absence beats invention.',
      });
    }

    if (await tryText(page, 'All tasks', 4000)) {
      await page.waitForTimeout(800);
      await shot(page, 'plans-all-tasks', {
        title: 'To-do — All tasks',
        screen: 'app/plans.tsx',
        state: 'POPULATED, grouped by kind. The undated "Whenever" backlog is one of the few lists with a manual drag order — Today and This week are ordered by the clock, and dragging a 09:00 task under a 14:00 one would either lie about the order or silently retime the task.',
        components: 'TaskCard, SectionCard, AddRow, DraggableTaskRow, CollapsedSection',
      });

      const taskRow = page.getByText('Water the plants', { exact: true }).first();
      if (await taskRow.isVisible().catch(() => false)) {
        await taskRow.click({ timeout: 8000 });
        await page.waitForTimeout(1000);
        await shot(page, 'task-editor', {
          title: 'The task editor (expands in place — not a pushed screen)',
          screen: 'components/TaskCard.tsx',
          state: 'TIER 3, the densest form in the app. Date, time-box, repeat, reminder, energy, tags, goal, steps, and the four per-item card types (standard / simple / note / stepped) picked from a labelled row of visible words, never icons. Switching type is lossless and reversible — nothing is ever cleared.',
          components: 'TaskCard, TimeBoxInput, GoalPicker, TagPickerRow, DateChipRow, Stepper, VoiceNoteFAB',
        });
        await taskRow.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(600);
      }
      await tryText(page, 'Today', 4000);
      await page.waitForTimeout(600);
    }

    console.log('> habits');
    // Habits is its OWN TAB again (2026-08-22, five tabs, Home in the middle) — it was a card
    // on the old "Me" tab when this walk was written. And its list card rests closed, so the
    // composer is not in the DOM until openCard runs.
    await tab(page, 'Habits');
    await openCard(page, 'Habits');
    await seedHabit(page, 'Drink water');
    await seedHabit(page, 'Ten minutes outside');
    await shot(page, 'habits-populated', {
      title: 'Habits — with habits, none registered yet',
      screen: 'app/habits.tsx',
      state: 'POPULATED. Every habit registers through a −/+ pair rather than a check circle. A habit enters the day log on the FIRST log of the day, not on "met" — 5 of 7 glasses of water still leaves a trace, which is exactly the kind of day the log exists for.',
      components: 'PadRow, HabitIcon, HabitLeading, Stepper',
    });

    const plus = page.getByRole('button', { name: 'Increase quantity Drink water', exact: true }).first();
    if (await plus.count()) {
      await plus.click({ timeout: 8000 });
      await page.waitForTimeout(900);
      await shot(page, 'habits-registered', {
        title: 'Habits — one registered today',
        screen: 'app/habits.tsx',
        state: 'A rest day and a count still at 0 are simply excluded — there is no failed state to render. Reward for a streak is ambient and shows no number anywhere: the screen backdrop tints from blue toward green and grows extra branches from a high-water mark, so branches never un-grow and a lapsed streak returns the art to exactly what it always was.',
        components: 'ScreenBackground, Motif',
      });
    }

    console.log('> health');
    // Health is its own tab again too, and Medicine moved onto it as a peer card (2026-08-22).
    await tab(page, 'Health');
    await openCard(page, 'Medicine');
    if (await seedMedicine(page, 'Vitamin D')) {
      await shot(page, 'health-medicine-tray', {
        title: 'Health — a medicine in its tray',
        screen: 'components/MedicineTrayCard.tsx',
        state: 'POPULATED. A tray is a WINDOW, not a clock time: a dose taken at 11:40 is still a morning dose, and an untaken one reads "still due" — never "missed". Same no-shame framing as habits\' rest days; CI fails a PR that introduces "missed"/"overdue"/"behind" copy.',
      });
      const dose = page.getByRole('checkbox', { name: 'Mark Vitamin D as taken', exact: true }).first();
      if (await dose.count()) {
        await dose.click({ timeout: 8000 });
        await page.waitForTimeout(800);
        await shot(page, 'health-dose-logged', {
          title: 'Health — a dose logged',
          screen: 'components/MedicineTrayCard.tsx',
          state: 'The dose is a separate table from the medicine row. A symptom entry can optionally be attributed to a medicine ("this one gives me stomach issues") — and that relief/attribution data is DISPLAYED and never interpreted: no correlation, no ranking, no "this usually helps".',
        });
      }
    }

    console.log('> shopping');
    await tab(page, 'Shop');
    // TWO doors into a new week list, and which one is on screen depends on whether ANY week
    // list already exists — `isWeeklyEmpty` in app/(tabs)/shopping.tsx, the 2026-08-13 "the
    // empty state and the trigger are ONE card" ruling:
    //   empty     → the empty card's body IS the choice; its button is labelled "Start empty".
    //   not empty → a "Create a new list" trigger that opens a chooser whose first row is
    //               "Start empty".
    // The walk only ever knew the SECOND label. On a fresh install — which is every run — the
    // lookup missed, `tryButton` returned false without throwing, and the entire seeding body
    // was skipped while every `shot()` below it still fired. That is how `shopping-populated`
    // and `shopping-monthly` came to be byte-identical to `shopping-empty` in both themes
    // (md5sum-confirmed), and why the pixel gate has never once photographed a populated list.
    // See EXECUTION_RULES.md standing debt 1.
    let listCreated = false;
    if (await tryButton(page, 'Create a new list')) {
      // Not-empty path: the trigger opened the chooser modal.
      await shot(page, 'shopping-new-list-modal', {
        title: 'Shopping — creating a list',
        screen: 'components/AppModal.tsx',
        state: 'MODAL. The app has ZERO native `Alert.alert` call sites left — every dialog is this in-app modal, which is also why the whole surface is reachable in this web preview at all.',
      });
      listCreated = await tryText(page, 'Start empty', 4000);
    } else {
      // Fresh-install path: no chooser, the card's own button makes the list.
      listCreated = await tryButton(page, 'Start empty');
    }
    // A seeding step that cannot be skipped without failing the run (EXECUTION_RULES.md
    // rule 1: a check that cannot fail is not a check). If the list was not created there is
    // nothing to populate, and shooting the empty tab under a "populated" name is worse than
    // shooting nothing — it is a baseline that looks like evidence.
    if (!listCreated) {
      throw new Error(
        'shopping: could not create a week list via "Create a new list" or "Start empty" — ' +
          'seeding aborted rather than shooting the empty tab as `shopping-populated`',
      );
    }
    {
      await page.waitForTimeout(1400);
      // A new list arrives with its NAME FIELD focused for an inline rename. Commit that first,
      // or the keyboard-focused input swallows the next interaction.
      await page.keyboard.press('Enter').catch(() => {});
      await page.waitForTimeout(600);
      // A new list arrives collapsed; its items (and the add affordance) are behind the chevron.
      // Substring, not exact: the label is "<list name>: Expand list" (see tryButtonLike).
      if (!(await tryButtonLike(page, 'Expand list'))) await tryText(page, 'Shopping list', 3000);
      await page.waitForTimeout(900);
      await shot(page, 'shopping-list-expanded-empty', {
        title: 'Shopping — a new, empty week list',
        screen: 'components/WeekListCard.tsx',
        state: 'EMPTY LIST. A list can be locked, reordered by drag, filled from the monthly list or from a saved dish. The monthly list is a different shape again (a table), and a monthly reset NULLs every purchase — which is why shopping is deliberately kept out of the day log.',
        components: 'WeekListCard, InlineAddItem, AddFromMonthlyModal, ListSettingsSheet',
      });

      if (await tryButton(page, 'Search for items…')) {
        await shot(page, 'shopping-inline-add-item', {
          title: 'The shopping composer (InlineAddItem)',
          screen: 'components/InlineAddItem.tsx',
          state: 'THE ONE COMPOSER THAT DOES NOT TIER. Name, catalogue autocomplete, price, category and quantity all open at once, which is why it is the only add-flow in the app that feels like a form. Its tier 2 is genuinely richer than the others (a catalogue lookup is the point of this surface), so folding it in is a real design question rather than a tidy-up — a good thing for a reviewer to have an opinion about.',
          components: 'InlineAddItem, FormControls, Stepper',
        });
        const itemField = page.getByPlaceholder('Item').first();
        for (const item of ['Melk', 'Brød', 'Epler']) {
          if (!(await itemField.isVisible().catch(() => false))) {
            if (!(await tryButton(page, 'Search for items…'))) break;
          }
          await page.getByPlaceholder('Item').first().fill(item);
          await page.getByPlaceholder('Item').first().press('Enter');
          await page.waitForTimeout(800);
        }
      }
    }
    // Re-assert the tab through the app's OWN navigator before shooting. The seeding above
    // scrolls elements into view, and `scrollIntoViewIfNeeded` walks up to the horizontal pager
    // and drags it — leaving Shop parked against a neighbouring page. Restoring scroll positions
    // cannot help here: by this point the bad position IS the app's position, so the only thing
    // that puts the pager back on a whole page is navigating to it.
    //   It has to be a ROUND TRIP. The navigator still believes it is on Shop — only the pager's
    // scroll offset drifted — so tapping Shop again is a no-op that changes no state and moves
    // nothing (measured: byte-identical capture, same 240443 px diff). Going to a neighbour and
    // back forces a real `jumpTo`, which re-seats the pager on a whole page.
    await tab(page, 'To-do');
    await tab(page, 'Shop');
    await forcePagerTo(page, 0); // Shop is SITE_ITEMS index 0 (lib/siteNav.ts).
    // Same reasoning as the list-creation guard: `shopping-populated` must contain items or
    // it is not the state its name claims. `Melk` is the first of the three seeded above.
    if (!(await page.getByText('Melk', { exact: false }).first().isVisible({ timeout: 4000 }).catch(() => false))) {
      throw new Error(
        'shopping: the list was created but no seeded item is on screen — refusing to shoot ' +
          'an empty list as `shopping-populated`',
      );
    }
    await shot(page, 'shopping-populated', {
      title: 'Shopping — with a list and items',
      screen: 'app/(tabs)/shopping.tsx',
      state: 'POPULATED. The ONE surface still hand-rolling its rows instead of drawing through the shared PadRow — the last conversion left, and the largest. Quantity READS in the row\'s leading cluster and is EDITED in a sheet opened by tapping the row body.',
      components: 'ShoppingRow, WeekListCard, InlineAddItem, MonthlyTableRow, SavedListsSection',
    });

    // The row-body tap opens the item sheet — the only editor for a weekly item's quantity,
    // unit, price and category.
    if (await tryText(page, 'Melk', 3000)) {
      await shot(page, 'shopping-item-sheet', {
        title: 'The shopping item sheet',
        screen: 'components/ShoppingItemSheet.tsx',
        state: 'SHEET. Quantity READS in the row and is EDITED here: the row\'s old +/− buttons were removed on purpose, because a value you can change in the row invites changing it by accident while shopping.',
      });
      await closeOverlays(page);
    }

    if (await tryText(page, 'Monthly list', 3000)) {
      await page.waitForTimeout(900);
      // Tapping the LABEL does not open the section — the chevron does, and its accessible name
      // is composed as "<title>: Expand list". `openCard` already knows that shape and is a
      // no-op on an already-open card.
      await openCard(page, 'Monthly list');
      // The Monthly section sits BELOW the week lists, and `shot()` scrolls every non-overlay
      // screen back to the top — so expanding Monthly and then shooting produced a frame
      // byte-identical to `shopping-populated` (md5sum-confirmed). Same family of defect as the
      // seeding no-op: a distinct name over an indistinct capture. Hold the scroll position
      // (`top: false`) and bring the section into frame instead.
      await page
        .getByText('Monthly list', { exact: true })
        .first()
        .scrollIntoViewIfNeeded({ timeout: 5000 })
        .catch(() => {});
      // `scrollIntoViewIfNeeded` walks up to the horizontal pager and drags it; put it back.
      await forcePagerTo(page, 0);
      await shot(page, 'shopping-monthly', {
        top: false,
        title: 'Shopping — the Monthly list',
        screen: 'app/(tabs)/shopping.tsx',
        state: 'A TABLE, not a list of rows — the one place in the app that draws a table. A migration seeds one empty monthly list on every install, which is why an empty-state gate here has to count items rather than lists.',
        components: 'MonthlyTableRow, MonthlyResetReviewSheet, MonthlyResetSummaryModal',
      });
      await tryText(page, 'Week lists', 3000);
      await page.waitForTimeout(700);
    }

    console.log('> home, populated');
    await tab(page, 'Home');
    await shot(page, 'home-populated', {
      title: 'Me — with everything seeded',
      screen: 'app/(tabs)/index.tsx',
      state: 'POPULATED. Three cards, each carrying the hue of the surface it comes from — the one legitimate use of an explicit borderColor override in the whole app. Order and visibility come from settings.cardOrder + settings.hiddenCards, through the same "Manage cards" header control every other screen has (2026-09-01). Nothing is force-restored on read any more: each of these previews a TAB, so hiding one costs the shortcut and nothing else.',
      components: 'PlanTaskCard, HomeNotesCard, HomeShoppingCard, EnergyMeter, ManageCardsSheet',
    });

    if (await typeInto(page, 'Type note', 'Ask about the bike lock')) {
      const noteCheck = page.getByRole('checkbox', { name: 'Ask about the bike lock', exact: true }).first();
      if (await noteCheck.count()) {
        await noteCheck.click({ timeout: 8000 });
        await page.waitForTimeout(800);
      }
      await shot(page, 'home-note-ticked-in-place', {
        title: 'Me — a note ticked today stays in place',
        screen: 'components/HomeNotesCard.tsx',
        state: 'Struck through where it is, rather than vanishing into a checked zone until tomorrow. The row anatomy is fixed app-wide: [leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check], with the check on the RIGHT like the ticks in the margin of a paper checklist.',
        components: 'HomeNotesCard, PadRow',
      });
    }

    // ---- 6. the last push (nothing follows, so the wipe costs nothing) ---
    if (FULL) {
      console.log('> notes, populated (last)');
      try {
        await clickText(page, 'Notes');
        await page.waitForTimeout(1200);
        await shot(page, 'notes-populated', {
          title: 'Notes — with a note, edited in place',
          screen: 'app/notes.tsx',
          state: 'POPULATED. Each row\'s title is a live text field (PadRow\'s titleInput) — this screen exists to edit them. Notes are ordered `checked, sort_order`, the one list whose reorder renumbers per section.',
          components: 'NoteRow, PadRow, SendToSheet',
        });
        const action = page.getByRole('button', { name: 'Send it to…', exact: true }).first();
        if (await action.count()) {
          await action.scrollIntoViewIfNeeded();
          await action.click({ timeout: 8000 });
          await page.waitForTimeout(900);
          await shot(page, 'notes-send-to-sheet', {
            title: 'The ⋯ row-action sheet',
            screen: 'components/SendToSheet.tsx',
            state: 'SHEET. ONE row-level action button, sitting just inside the check, replacing the assorted trailing trash / send / put-back buttons each surface used to grow its own version of.',
          });
        }
      } catch (e) {
        problems.push(`notes-populated: ${e.message.split('\n')[0]}`);
      }
    }

    // ---- 7. the To-do editor and the Goals drawer (last, on a FRESH app) ---
    //
    // Ported from `scripts/measure-wraps.mjs`'s To-do pass, which has reached both of these
    // reliably for weeks while this walk could not produce them at all — they were two of the
    // four names `scripts/visual-diff.mjs` prints as a coverage gap on every run. The task
    // editor is the densest form in the app, so a baseline set without it was missing the
    // surface most likely to break.
    //
    // ⚠️ **It starts by RELOADING, and that is the fix.** Two earlier attempts at this port
    // failed and were reverted; the recipe was never the problem — driven against a fresh app
    // every step passes. What failed was the STATE phase 7 inherits: phase 6 ends on a pushed
    // screen with seeded data behind it, and by then Whenever already holds tasks, so
    // `openCard` finds a card that is already open and the row locators match rows this step
    // did not create. `ensureTabs()` alone was not enough, because it only recovers a MISSING
    // tab bar, not a dirty one.
    //   Reloading is free here for the same reason phase 6's push is: nothing follows, so the
    // in-memory DB wipe costs nothing. That is the licence this phase takes.
    if (FULL) {
      console.log('> task editor (fresh app)');
      try {
        await runOnboarding(page, {});
        await walkTour(page, { capture: false });
        await dismissTour(page);
        await tab(page, 'To-do');
        // Every card rests closed, so the composer is not in the DOM until this runs.
        await openCard(page, 'Whenever');
        await page.getByRole('button', { name: 'New task', exact: true }).first().click({ timeout: 10000 });
        await page.waitForTimeout(400);
        const field = page.getByPlaceholder('New task').first();
        await field.fill('Screenshot probe');
        await field.press('Enter');
        await page.waitForTimeout(900);

        // ⚠️ `.first()`, never `.last()` — this comment used to say the exact opposite, and the
        // opposite was wrong. All five tabs are mounted at once (`lazy: false`), and BOTH To-do
        // and Home render a row for this task (Home's is its preview card). DOM order follows
        // `lib/siteNav.ts`'s SITE_ITEMS — shop(0), plans/To-do(1), home(2) — so Home's copy is
        // the LAST one and To-do's is the FIRST.
        //   Targeting `.last()` therefore aimed at Home, and `scrollIntoViewIfNeeded()` obligingly
        // dragged the horizontal pager off To-do to reach it. The click then landed on Home's
        // preview row, no editor opened, and the shot below captured the Home tab. The committed
        // `task-editor` baseline is that frame: a screen named for an editor it has never once
        // photographed.
        const probeRow = page.getByText('Screenshot probe', { exact: true }).first();
        await probeRow.scrollIntoViewIfNeeded({ timeout: 5000 });
        await probeRow.click({ timeout: 10000 });
        await page.waitForTimeout(1000);
        // Prove the editor is actually open before shooting it (EXECUTION_RULES.md rule 2: a
        // harness must prove it looked). `Save` belongs to the editor and to nothing behind it.
        if (!(await page.getByText('Save', { exact: true }).first().isVisible({ timeout: 5000 }).catch(() => false))) {
          throw new Error('task-editor: the row click did not open the editor — refusing to shoot the tab behind it');
        }
        // ⚠️ **Blur before shooting, or this screen is machine-dependent.** The editor opens with
        // its Name field focused and the existing text SELECTED, and a selection rectangle is
        // sized from font metrics — so it lands a few pixels differently on this machine and on
        // the CI runner. Measured: 137 px (0.034%) light, 150 px (0.037%) dark, against a
        // MAX_DIFF_PIXELS floor of 24, on a diff where nothing else moved.
        //   Playwright's screenshot already hides the CARET by default, which is why this looked
        // deterministic locally and only failed across machines. `quick-add-focused-empty` is
        // focused too and does NOT drift, because it is empty — there is no selection to draw.
        //   The alternative was `MACHINE_DEPENDENT`, i.e. dropping the comparison entirely on
        // what scripts/visual-diff.mjs calls "the densest form in the app… the single most
        // valuable shot in this set". Removing the focus is the smaller loss by a wide margin:
        // the editor's layout, spacing and controls — everything this baseline exists to guard —
        // are unchanged by it.
        await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined)).catch(() => {});
        await page.waitForTimeout(500);
        await shot(page, 'task-editor', {
          title: 'The task editor, open on a row',
          screen: 'components/TaskCard.tsx (variant="full")',
          state: 'POPULATED. The densest form in the app, and the one whose horizontal pressure produced the 2026-08-01 sliced-microphone bug — three nested 16px paddings plus an icon gutter left the text 306 of 393px. Delete · Discard · Save WRAPS rather than truncating, because the labels are words the user has to read.',
          components: 'TaskCard, GoalPicker, Stepper, SegmentedControl, PersonChip, TagChip',
        });

        // ⚠️ **No goals shot here (2026-09-01).** This used to click a "Practical goals" drawer
        // at the foot of the To-do tab — a folded `GoalsEditor` section, now deleted. The editor
        // is a centre pop-up reached from the "Edit goals" row at the foot of a goal picker, and
        // the task editor left open above carries one — but its trigger is not findable by name
        // in the web build, so the attempt timed out rather than producing a shot.
        //   Listed as a coverage gap in `scripts/visual-diff.mjs`'s `WANTED_BUT_UNCAPTURED`
        // instead of faked: a step that pretends is worse than a gap that is written down. The
        // component itself is still exercised — `GoalsEditor` renders inside the pop-up, and
        // `lib/__tests__/prefill.test.ts` pins the route and the prefill that reach it.
      } catch (e) {
        problems.push(`task-editor: ${e.message.split('\n')[0]}`);
      }
    }

    console.log(`\n> ${captions.length} screenshots, ${problems.length} problems`);
    problems.forEach((p) => console.log('  ', p));
  } finally {
    await browser.close();
  }

  writeIndex();
}

// ---------------------------------------------------------------------------

function writeIndex() {
  const indexPath = path.join(outDir, 'index.json');
  const existing = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  const merged = [...existing.filter((c) => c.theme !== THEME), ...captions];
  fs.writeFileSync(indexPath, JSON.stringify(merged, null, 2));

  const L = [];
  L.push('# Screens and states');
  L.push('');
  L.push(
    'Captured from the real app running as a web build at 430×932, full-page so nothing below ' +
      'the fold is lost. react-native-web is faithful for layout, spacing, hierarchy and copy, ' +
      'but is NOT pixel-identical to native: shadows/elevation, some font metrics and animation ' +
      'timing differ, and a few native-only surfaces (receipt OCR, home-screen widgets, every ' +
      'gesture) cannot be shown at all. Judge composition and hierarchy from these; do not judge ' +
      'shadow softness.'
  );
  L.push('');
  L.push(
    '**Each caption says which STATE the shot is in.** The empty ones matter as much as the ' +
      'full ones — a fresh install is what every user meets first, and this app puts real ' +
      'teaching content there rather than a blank list.'
  );
  L.push('');
  for (const theme of ['light', 'dark']) {
    const rows = merged.filter((c) => c.theme === theme);
    if (!rows.length) continue;
    L.push(`## ${theme === 'light' ? 'Light mode' : 'Dark mode'}`);
    L.push('');
    for (const c of rows) {
      L.push(`### ${c.title || c.name}`);
      L.push('');
      L.push(`![${c.title || c.name}](${c.file})`);
      L.push('');
      const meta = [];
      if (c.screen) meta.push(`**Drawn by:** \`${c.screen}\``);
      if (c.components) meta.push(`**Components:** ${c.components}`);
      if (meta.length) {
        L.push(meta.join('  \n'));
        L.push('');
      }
      if (c.state) {
        L.push(c.state);
        L.push('');
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'INDEX.md'), L.join('\n'));
  console.log(`> wrote ${path.join(outDir, 'INDEX.md')} (${merged.length} shots)`);
}

main().catch((err) => {
  console.error(err);
  writeIndex();
  process.exitCode = 1;
});
