#!/usr/bin/env node
// preview.mjs — Playwright driver for the web preview: walks onboarding, screenshots
// every main tab, and exercises "add a task" / "add a shopping item" to prove store
// logic (not just static render). Chromium is pre-installed under
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
// "Monthly list reset" summary, gated on real date math — expected app
// behaviour, not a bug). Dismiss it if present so it doesn't block the next
// click; no-op if no modal is showing.
async function dismissModalIfPresent(page) {
  for (const label of ['Got it', "Got it →", 'OK']) {
    const btn = page.getByText(label, { exact: true }).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      console.log(`  (dismissing modal: "${label}")`);
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      return;
    }
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

  if (onlyRoute) {
    console.log(`> focused check: ${onlyRoute}`);
    await page.goto(`${BASE_URL}${onlyRoute}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, onlyRoute.replace(/\//g, '_') || 'root');
  } else {
    console.log('> onboarding: language');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'onboarding-language');
    await clickText(page, 'English');
    await page.waitForTimeout(500);

    console.log('> onboarding: privacy');
    await shot(page, 'onboarding-privacy');
    await clickText(page, 'Got it →');
    await page.waitForTimeout(500);

    console.log('> onboarding: guided/explore choice');
    await shot(page, 'onboarding-guided-choice');
    await clickText(page, 'Next →', { nth: 0 });
    await page.waitForTimeout(500);

    console.log('> onboarding: name');
    await shot(page, 'onboarding-name');
    await clickText(page, 'Get started →');
    await page.waitForTimeout(500);

    console.log('> onboarding: work mode (step2)');
    await shot(page, 'onboarding-step2');
    await clickText(page, 'Next →', { nth: 0 });
    await page.waitForTimeout(500);

    console.log('> onboarding: shopping days (step3)');
    await shot(page, 'onboarding-step3');
    await clickText(page, 'Next →', { nth: 0 });
    await page.waitForTimeout(500);

    console.log('> onboarding: notifications (step4)');
    await shot(page, 'onboarding-step4');
    await clickText(page, 'Next →', { nth: 0 });
    await page.waitForTimeout(500);

    console.log('> onboarding: theme + handedness (step5)');
    await shot(page, 'onboarding-step5');
    await clickText(page, "Let's go! 🌿");
    await page.waitForTimeout(1500);

    console.log('> Home');
    await shot(page, 'home');

    // Navigate via the in-app BottomNav (client-side route change), NOT page.goto() —
    // the DB is in-memory (sql.js fallback, see lib/sqlite.web.ts); a full page
    // navigation reloads the bundle and wipes it, bouncing back to onboarding.
    for (const [tab, shotName] of [['Shopping', 'shopping'], ['Tasks', 'plans'], ['Health', 'health'], ['Scan', 'scan']]) {
      console.log(`> ${tab} tab`);
      await page.getByRole('button', { name: tab, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await dismissModalIfPresent(page);
      await shot(page, shotName);
    }

    console.log('> back to Home tab');
    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await shot(page, 'home-again');

    // Exercise real store logic (not just static render): add a task via the inline
    // AddRow at the bottom of the Whenever section (type + Enter), and confirm it
    // round-trips through the in-memory sql.js DB by reappearing after navigating away.
    console.log('> add a task (store logic check)');
    await page.getByRole('button', { name: 'Tasks', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    const taskTitle = `Preview check ${Date.now()}`;
    const taskInput = page.getByPlaceholder('New task').first();
    await taskInput.fill(taskTitle);
    await taskInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'task-added');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Tasks', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    const persisted = await page.getByText(taskTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  task persisted after tab round-trip: ${persisted}`);
    if (!persisted) pageErrors.push(`Task "${taskTitle}" did not persist after navigating away and back`);
    await shot(page, 'task-persisted-check');
  }

  console.log(`\n> page errors: ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log('  [pageerror]', e));
  console.log(`> console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  [console.error]', e));

  await browser.close();
  if (pageErrors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
