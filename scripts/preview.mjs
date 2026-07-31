#!/usr/bin/env node
// preview.mjs — Playwright driver for the web preview: walks onboarding, screenshots
// every main tab, and exercises "add a task" (To-do), "add a habit" (Habits) and
// "add a medicine + log a dose" (Health) — each verified to survive a tab round-trip —
// to prove three stores' write→read paths through the in-memory sql.js DB, not just
// static render. Also renders the two pushed sub-screens reachable without data setup
// (Settings, the medicine editor). Chromium is pre-installed under
// PLAYWRIGHT_BROWSERS_PATH; never `playwright install`.
//
// Usage: node scripts/preview.mjs [outDir] [--route=/some/path]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const outDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'preview-shots';
const onlyRoute = process.argv.find((a) => a.startsWith('--route='))?.split('=')[1];

fs.mkdirSync(outDir, { recursive: true });

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(outDir, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  screenshot: ${file}`);
}

// expo-router's native Stack keeps previous screens mounted off-screen (for
// back-swipe), so a plain text locator can resolve to a stale, invisible
// button from an earlier onboarding step. Pick the first genuinely visible
// match instead of trusting DOM order.
async function clickText(page, text, opts = {}) {
  const locator = page.getByText(text, { exact: opts.exact ?? true });
  await locator.first().waitFor({ state: 'attached', timeout: 10000 });
  const candidates = await locator.all();
  const wantNth = opts.nth ?? 0;
  let seen = 0;
  for (const candidate of candidates) {
    if (await candidate.isVisible()) {
      if (seen === wantNth) {
        await candidate.click({ timeout: 10000 });
        return;
      }
      seen += 1;
    }
  }
  throw new Error(`clickText: no visible match #${wantNth} for "${text}" (${candidates.length} total matches)`);
}

// Some screens show a one-off info modal on first visit (e.g. Shopping's
// pre-reset MonthlyResetReviewSheet, or its follow-up read-only
// MonthlyResetSummaryModal — both gated on real date math, a fresh profile's
// first Shopping visit always has an unset lastMonthlyReset — expected app
// behaviour, not a bug). Dismiss it if present so it doesn't block the next
// click; no-op if no modal is showing. "Skip" (the review sheet's ghost
// button) is deliberately equivalent to any other way of leaving that sheet —
// see components/MonthlyResetReviewSheet.tsx's header — so clicking it here
// is exactly the same "just get past this" behavior as "Got it" below.
async function dismissModalIfPresent(page) {
  // Bounded loop, not a single dismiss: Skip on the review sheet immediately opens the
  // follow-up read-only summary modal (Got it) in the same tick — so a fresh profile's
  // first Shopping visit needs two dismissals in a row, not one.
  for (let i = 0; i < 3; i++) {
    let dismissedAny = false;
    for (const label of ['Skip', 'Got it', "Got it →", 'OK']) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`  (dismissing modal: "${label}")`);
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        dismissedAny = true;
        break;
      }
    }
    if (!dismissedAny) return;
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Wrapped in try/finally so a thrown locator/timeout error (e.g. a renamed tab button)
  // still closes the browser — an uncaught throw here used to skip browser.close()
  // entirely, leaving the Chromium process open and the whole script hanging forever
  // instead of failing fast (found 2026-07-23 when the Scan→Habits tab rename did
  // exactly this).
  try {
  if (onlyRoute) {
    console.log(`> focused check: ${onlyRoute}`);
    await page.goto(`${BASE_URL}${onlyRoute}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, onlyRoute.replace(/\//g, '_') || 'root');
  } else {
    // Basics (2026-07-31): language, appearance, text size, movement, menu side and starting
    // screen, all on ONE screen, replacing the old language screen plus the four-step
    // first-run wizard. Each row is a strip of radio pills; the whole screen previews live,
    // so tapping English re-renders the rest of it in English.
    console.log('> onboarding: basics');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'onboarding-basics-no');
    // Language first — everything after this is asserted against English labels.
    await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, 'onboarding-basics-en');

    // Walk a few rows so the live preview actually gets exercised rather than just rendered.
    // Values are left on the shipped defaults (Light / Default / Full / Right / Home) so the
    // tab screenshots further down still show the standard app.
    for (const [row, option] of [['Appearance', 'Light'], ['Text size', 'Default'], ['Movement', 'Full']]) {
      await page.getByRole('radio', { name: new RegExp(`^${row}: ${option}\\.`) }).first().click({ timeout: 10000 });
      await page.waitForTimeout(300);
    }
    await shot(page, 'onboarding-basics-picked');
    await clickText(page, 'Continue');
    await page.waitForTimeout(600);

    // "Have you used UnFocus before?" — the returning-user restore step. Take the
    // "No, I'm new here" path to continue a fresh onboarding walk.
    console.log('> onboarding: restore prompt');
    await shot(page, 'onboarding-restore');
    await clickText(page, "No, I'm new here");
    await page.waitForTimeout(500);

    console.log('> onboarding: privacy');
    await shot(page, 'onboarding-privacy');
    await clickText(page, 'Got it →');
    await page.waitForTimeout(500);

    console.log('> onboarding: guided/explore choice');
    await shot(page, 'onboarding-guided-choice');
    await clickText(page, 'Walk me through it');
    await page.waitForTimeout(500);

    // Energy vs Quiet growth (2026-07-31) — the screen that replaced the 8-page intro
    // slideshow's one-liner about each. Left on its seeded values (Energy on, growth off),
    // which is what a real new user lands with.
    console.log('> onboarding: energy vs growth');
    await shot(page, 'onboarding-energy');
    await clickText(page, 'Next →');
    await page.waitForTimeout(500);

    // Feature picker: screenshotted with everything left OFF, deliberately — that's the state
    // a real new user lands in, and the tab screenshots further down are meant to show the
    // stripped-back default app, not the everything-on build.
    console.log('> onboarding: feature picker');
    await shot(page, 'onboarding-features');
    await clickText(page, 'Next →');
    await page.waitForTimeout(500);

    console.log('> onboarding: name + finish');
    await shot(page, 'onboarding-name');
    await clickText(page, "Let's go! 🌿");
    await page.waitForTimeout(1800);

    console.log('> Home');
    await shot(page, 'home');

    // Navigate via the in-app BottomNav (client-side route change), NOT page.goto() —
    // the DB is in-memory (sql.js fallback, see lib/sqlite.web.ts); a full page
    // navigation reloads the bundle and wipes it, bouncing back to onboarding.
    for (const [tab, shotName] of [['Shopping', 'shopping'], ['To-do', 'plans'], ['Health', 'health'], ['Habits', 'habits']]) {
      console.log(`> ${tab} tab`);
      await page.getByRole('button', { name: tab, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await dismissModalIfPresent(page);
      await shot(page, shotName);
    }

    // Food and Catalogue are button-launched sub-screens off Shopping (UX audit F1,
    // 2026-07-23), not tabs — click through each via in-app navigation (same in-memory-DB
    // constraint as above) and back, confirming both render past onboarding's gate.
    console.log('> Shopping -> Food button');
    await page.getByRole('button', { name: 'Shopping', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Food', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, 'food');
    await page.goBack();
    await page.waitForTimeout(800);

    console.log('> Shopping -> Catalogue button');
    await page.getByRole('button', { name: 'Catalogue', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, 'catalogue');
    await page.goBack();
    await page.waitForTimeout(800);

    // Card layouts (2026-07-27): open Shopping's layout picker from the header, switch to a
    // surface-specific layout and then to the sparsest one, confirming both that the picker
    // renders and that the rows actually redraw. The second switch is the one that matters —
    // ShoppingRow is memoized on prop identity, so a layout change that didn't reach the
    // comparator would leave the list looking identical and this step would catch it.
    console.log('> Shopping -> layout picker');
    await page.getByRole('button', { name: 'Shopping', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const layoutBtn = page.getByRole('button', { name: 'How lists look' }).first();
    const layoutRowsBefore = await page.getByText(/kr/).count();
    await layoutBtn.click({ timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, 'layout-picker');
    await clickText(page, 'In the store');
    await page.waitForTimeout(700);
    await shot(page, 'layout-in-the-store');
    await clickText(page, 'Just the basics');
    await page.waitForTimeout(700);
    await shot(page, 'layout-just-the-basics');
    // "Just the basics" hides money entirely, so any price text present before must be gone.
    const layoutRowsAfter = await page.getByText(/kr/).count();
    console.log(`  price cells before/after switching to basics: ${layoutRowsBefore}/${layoutRowsAfter}`);
    console.log(`  layout switch changed the rendering: ${layoutRowsAfter <= layoutRowsBefore}`);
    await clickText(page, 'Done');
    await page.waitForTimeout(500);

    console.log('> back to Home tab');
    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await shot(page, 'home-again');

    // Home's pad cards (2026-07-30). Three things worth a regression check, all new surface
    // area: writing on a card's own type line, ticking a note (which must stay IN PLACE,
    // struck through, rather than vanishing into the checked zone until tomorrow), and
    // stepping the Shopping card's week pager. The type line is an always-open input whose
    // grey prompt clears on focus — target it by accessible name, not by placeholder.
    console.log('> Home pad cards (type line, tick-in-place, week pager)');
    const noteTitle = `Preview note ${Date.now()}`;
    const noteInput = page.getByLabel('Type note', { exact: true }).first();
    await noteInput.scrollIntoViewIfNeeded();
    await noteInput.focus();
    await noteInput.fill(noteTitle);
    await noteInput.press('Enter');
    await page.waitForTimeout(700);
    const noteVisible = await page.getByText(noteTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  note written from Home's type line: ${noteVisible}`);
    if (!noteVisible) pageErrors.push(`Note "${noteTitle}" was not created from Home's type line`);
    await shot(page, 'home-note-added');

    // Tick it: the row must still be on screen afterwards (in place, struck through).
    const noteRow = page.getByText(noteTitle, { exact: true }).first();
    const noteCheck = page.getByRole('checkbox', { name: noteTitle, exact: true }).first();
    if (await noteCheck.count()) {
      await noteCheck.scrollIntoViewIfNeeded();
      await noteCheck.click({ timeout: 10000 });
      await page.waitForTimeout(700);
      const stillThere = await noteRow.isVisible().catch(() => false);
      console.log(`  ticked note stayed in place: ${stillThere}`);
      if (!stillThere) pageErrors.push('A note ticked today vanished instead of staying struck-through in place');
      await shot(page, 'home-note-ticked-in-place');
    } else {
      pageErrors.push(`No checkbox found for note "${noteTitle}" — PadRow's check may not be wired`);
    }

    // Step the Shopping card's week pager one week forward and back.
    const weekNext = page.getByRole('button', { name: 'Next week', exact: true }).first();
    if (await weekNext.count()) {
      await weekNext.scrollIntoViewIfNeeded();
      await weekNext.click({ timeout: 10000 });
      await page.waitForTimeout(600);
      await shot(page, 'home-shopping-week-next');
      await page.getByRole('button', { name: 'Previous week', exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(600);
      console.log('  shopping week pager stepped both ways: true');
    } else {
      pageErrors.push('Shopping card week-pager arrows not found on Home');
    }

    // Exercise real store logic (not just static render): add a task via the inline
    // AddRow at the bottom of the Whenever section (type + Enter), and confirm it
    // round-trips through the in-memory sql.js DB by reappearing after navigating away.
    console.log('> add a task (store logic check)');
    await page.getByRole('button', { name: 'To-do', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    // The Whenever AddRow (the only add affordance on this screen) only renders under the
    // "All tasks" tab — the default tab is "Today" (#186), which doesn't have it.
    await clickText(page, 'All tasks');
    await page.waitForTimeout(500);
    const taskTitle = `Preview check ${Date.now()}`;
    // AddRow now collapses to a "+ New task" bar (accessibilityLabel = placeholder); tap it
    // to expand the actual input before typing (2026-07-19 "+ makes a new row" change).
    await page.getByRole('button', { name: 'New task', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(400);
    const taskInput = page.getByPlaceholder('New task').first();
    await taskInput.fill(taskTitle);
    await taskInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'task-added');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'To-do', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    const persisted = await page.getByText(taskTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  task persisted after tab round-trip: ${persisted}`);
    if (!persisted) pageErrors.push(`Task "${taskTitle}" did not persist after navigating away and back`);
    await shot(page, 'task-persisted-check');

    // Exercise a second store's write path: add a habit from the Habits tab's type line, then
    // confirm it round-trips through the in-memory sql.js DB after a tab away-and-back.
    //
    // **This is a text input, not a button** (2026-07-30): the collapsed "+ Add habit" AddRow
    // bar became components/PadTypeRow.tsx — an always-open line whose grey prompt clears on
    // focus. There is no bar to tap open any more, and the prompt is our own Text layer rather
    // than a `placeholder` attribute, so `getByPlaceholder` won't find it either. Target the
    // input by its accessible name (the prompt string, t.pad.type.habit).
    console.log('> add a habit (store logic check)');
    await page.getByRole('button', { name: 'Habits', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const habitTitle = `Preview habit ${Date.now()}`;
    const habitInput = page.getByLabel('Type habit', { exact: true }).first();
    await habitInput.scrollIntoViewIfNeeded();
    await habitInput.focus();
    await habitInput.fill(habitTitle);
    await habitInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'habit-added');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Habits', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const habitPersisted = await page.getByText(habitTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  habit persisted after tab round-trip: ${habitPersisted}`);
    if (!habitPersisted) pageErrors.push(`Habit "${habitTitle}" did not persist after navigating away and back`);
    await shot(page, 'habit-persisted-check');

    // Exercise the medicine store's two write paths (2026-07-27): quick-create a medicine
    // from the Health tab's tray card, then LOG A DOSE by tapping its circle — the dose is
    // the whole point of the feature, and it's a separate table (medicine_doses) from the
    // medicine row itself. Both are checked to survive a tab round-trip.
    console.log('> add a medicine + log a dose (store logic check)');
    await page.getByRole('button', { name: 'Health', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const medName = `Preview med ${Date.now()}`;
    const medAddBar = page.getByRole('button', { name: 'Add a medicine', exact: true }).first();
    await medAddBar.scrollIntoViewIfNeeded();
    await medAddBar.click({ timeout: 10000 });
    await page.waitForTimeout(400);
    const medInput = page.getByPlaceholder('Add a medicine').first();
    await medInput.scrollIntoViewIfNeeded();
    await medInput.fill(medName);
    await medInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'medicine-added');

    // The new medicine lands in whichever tray "now" falls in, so assert on the row itself
    // rather than a specific tray label.
    const medVisible = await page.getByText(medName, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  medicine row rendered: ${medVisible}`);
    if (!medVisible) pageErrors.push(`Medicine "${medName}" did not render on the Health tab`);

    const doseToggle = page.getByRole('checkbox', { name: `Mark ${medName} as taken`, exact: true }).first();
    await doseToggle.scrollIntoViewIfNeeded();
    await doseToggle.click({ timeout: 10000 });
    await page.waitForTimeout(600);
    const doseLogged = await page.getByText(/^Taken \d{2}:\d{2}$/).first().isVisible().catch(() => false);
    console.log(`  dose logged (Taken HH:MM shown): ${doseLogged}`);
    if (!doseLogged) pageErrors.push(`Logging a dose of "${medName}" did not show a "Taken HH:MM" stamp`);
    await shot(page, 'medicine-dose-logged');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Health', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const dosePersisted = await page.getByText(/^Taken \d{2}:\d{2}$/).first().isVisible().catch(() => false);
    console.log(`  dose persisted after tab round-trip: ${dosePersisted}`);
    if (!dosePersisted) pageErrors.push(`Dose of "${medName}" did not persist after navigating away and back`);
    await shot(page, 'medicine-persisted-check');

    // The medicine editor is a pushed sub-screen reached by tapping the row's NAME (the
    // circle logs the dose instead) — render it once so the new route isn't a blind spot.
    console.log('> Health -> medicine form');
    await page.getByRole('button', { name: medName, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    await shot(page, 'medicine-form');
    const formRendered = await page.getByText('When to take it', { exact: true }).first().isVisible().catch(() => false);
    console.log(`  medicine form rendered: ${formRendered}`);
    if (!formRendered) pageErrors.push('The medicine form did not render its tray picker');
    await page.goBack();
    await page.waitForTimeout(800);

    // Sub-tier header check (HEADER_CLIP_DEBUG.md): Settings was reported to show NO
    // header at all on device, and this walk never visited a sub-tier screen before —
    // the gear → /settings push is the only sub-tier route reachable without data setup.
    // Measure the header title's geometry on Home (site tier) and Settings (sub tier):
    // a layout/positioning-level cause (band collapsed, title off-screen) would show up
    // here, even though Android-native font metrics don't reproduce on web.
    console.log('> Settings (sub-tier header check)');
    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    // A title string can match other nodes too (e.g. the BottomNav "Home" label), so
    // measure the TOPMOST visible match — the header title is the one at the top edge.
    const measureTitle = async (text) => {
      const matches = await page.getByText(text, { exact: true }).all();
      let best = null;
      for (const m of matches) {
        if (!(await m.isVisible().catch(() => false))) continue;
        const box = await m.boundingBox();
        if (box && (!best || box.y < best.box.y)) best = { m, box };
      }
      if (!best) return { visible: false };
      const css = await best.m.evaluate((node) => {
        const s = getComputedStyle(node);
        return { fontSize: s.fontSize, lineHeight: s.lineHeight };
      });
      return { visible: true, box: best.box, ...css };
    };
    const homeTitle = await measureTitle('Home');
    console.log(`  Home (site) header title: ${JSON.stringify(homeTitle)}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1200);
    await shot(page, 'settings');
    const settingsTitle = await measureTitle('Settings');
    console.log(`  Settings (sub) header title: ${JSON.stringify(settingsTitle)}`);
    if (!settingsTitle.visible) pageErrors.push('Settings sub-tier header title is NOT visible on web (matches the on-device "no header" report)');
  }

  console.log(`\n> page errors: ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log('  [pageerror]', e));
  console.log(`> console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  [console.error]', e));

  if (pageErrors.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
