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

async function clickText(page, text, opts = {}) {
  const locator = page.getByText(text, { exact: opts.exact ?? true });
  await (opts.nth != null ? locator.nth(opts.nth) : locator.first()).click({ timeout: 10000 });
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

    console.log('> Shopping tab');
    await page.goto(`${BASE_URL}/shopping`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'shopping');

    console.log('> Plans tab');
    await page.goto(`${BASE_URL}/plans`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'plans');

    console.log('> Health tab');
    await page.goto(`${BASE_URL}/health`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'health');

    console.log('> Scan tab (web placeholder)');
    await page.goto(`${BASE_URL}/scan`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'scan');
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
