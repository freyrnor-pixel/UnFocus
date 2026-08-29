#!/usr/bin/env node
// Focused Playwright check for the catalogue (not covered by preview.mjs):
// onboarding → Shopping → expand the Catalogue drawer → verify seeded rows render sorted,
// add an item through the "+" pop-up and confirm it lands in the list (store→sql.js
// write→read path), then round-trip through another tab to prove it persisted.
// Reuses preview.mjs's in-app-navigation rule (no page.goto — in-memory DB).
//
// Rewritten 2026-08-14, and both halves of the walk had gone stale:
//   · Catalogue stopped being one of Shopping's in-place sub-tabs on 2026-07-23 (it is a
//     pushed screen plus a CollapsedSection drawer now), so the old `switchTab('Catalogue')`
//     waited forever on a control that no longer exists and hung the whole script.
//   · The add flow is a "+" beside the search field opening components/CatalogueAddSheet.tsx,
//     not an inline AddRow you could type into and press Enter.
// The drawer — not the pushed screen — is what this script drives, deliberately: leaving a
// pushed screen on web costs a goBack, which reloads the document and wipes the in-memory DB,
// so the persistence round-trip at the end would be untestable from there.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { resolveChromium } from './chromium-path.mjs';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const outDir = 'preview-shots';
fs.mkdirSync(outDir, { recursive: true });
const CHROMIUM_PATH = resolveChromium();

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(outDir, `cat-${String(shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  screenshot: ${file}`);
}

async function clickText(page, text, opts = {}) {
  const locator = page.getByText(text, { exact: opts.exact ?? true });
  await locator.first().waitFor({ state: 'attached', timeout: 10000 });
  for (const c of await locator.all()) {
    if (await c.isVisible()) {
      await c.click({ timeout: 10000, force: opts.force ?? false });
      return;
    }
  }
  throw new Error(`clickText: no visible match for "${text}"`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push('[console] ' + msg.text()); });

  try {
    // Onboarding is two screens since the 2026-08-03 split: basics → privacy. Language first,
    // because everything below is asserted against English labels.
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await clickText(page, 'Continue');
    await page.waitForTimeout(700);
    await clickText(page, 'Start');
    await page.waitForTimeout(1800);

    // The guided tour opens over the tabs — step through it or its scrim eats every click.
    for (let i = 0; i < 8; i++) {
      if (await page.getByText('Start using the app', { exact: true }).first().isVisible().catch(() => false)) {
        await clickText(page, 'Start using the app');
        break;
      }
      if (!(await page.getByText('Got it', { exact: true }).first().isVisible().catch(() => false))) break;
      await clickText(page, 'Got it');
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(1000);

    console.log('> Shopping tab');
    await page.getByRole('button', { name: 'Shop', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1200);

    // Two drawers on this screen (Food, then Catalogue) share the "Expand list" label — the
    // Catalogue one is last in document order.
    console.log('> Catalogue drawer');
    const expanders = await page.getByRole('button', { name: 'Expand list', exact: true }).all();
    if (expanders.length === 0) throw new Error('no "Expand list" control on Shopping');
    await expanders[expanders.length - 1].click({ timeout: 10000 });
    await page.waitForTimeout(1200);
    await shot(page, 'catalogue-drawer');

    const seedVisible = await page.getByText('Agurk', { exact: true }).first().isVisible().catch(() => false);
    console.log(`  a known seed row visible: ${seedVisible}`);
    if (!seedVisible) pageErrors.push('No seeded catalogue row visible (expected Norwegian-sorted list)');

    // Add through the pop-up. A clean letters-only name that sorts to the TOP keeps the new row
    // inside the drawer's `EMBEDDED_ROWS` cap (and, on the full screen, inside the virtualized
    // window). NB: Norwegian collation reads a leading "aa" as "å" and sorts it last, so an
    // "Aaa…" prefix would be added correctly and still be invisible; "Abc…" sorts genuinely first.
    const itemName = `Abctest${Date.now() % 100000}`;
    console.log('> add pop-up');
    await page.getByRole('button', { name: 'Add new item', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    await page.getByPlaceholder('Item name').first().fill(itemName);
    await page.getByPlaceholder('Price (kr)').first().fill('42');
    await shot(page, 'catalogue-add-sheet');
    await clickText(page, 'Save');
    await page.waitForTimeout(1000);

    const added = await page.getByText(itemName, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  added item visible in list: ${added}`);
    if (!added) pageErrors.push(`Catalogue item "${itemName}" not visible after add`);
    await shot(page, 'catalogue-after-add');

    // Round-trip through another tab — the drawer stays mounted (the pager runs lazy: false),
    // so this exercises the store→DB→store read rather than just the in-memory array.
    await page.getByRole('button', { name: 'To-do', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Shop', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const persisted = await page.getByText(itemName, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  added item persisted after tab round-trip: ${persisted}`);
    if (!persisted) pageErrors.push(`Catalogue item "${itemName}" did not persist after tab round-trip`);
    await shot(page, 'catalogue-roundtrip');
  } finally {
    console.log(`\n> page errors: ${pageErrors.length}`);
    pageErrors.forEach((e) => console.log('  [err]', e));
    await browser.close();
    if (pageErrors.length > 0) process.exitCode = 1;
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
