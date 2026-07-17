#!/usr/bin/env node
// Focused Playwright check for the Catalogue tab (not covered by preview.mjs):
// onboarding → Shopping → Catalogue sub-tab → verify seeded rows render sorted,
// add an item and confirm it lands in the list (store→sql.js write→read path).
// Reuses preview.mjs's in-app-navigation rule (no page.goto — in-memory DB).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const outDir = 'preview-shots';
fs.mkdirSync(outDir, { recursive: true });
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

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
      // force bypasses the floating glass-header/sticky overlay that can intercept
      // pointer events over the sub-tab toggle row.
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

  // Onboarding (Explore path is shortest: skips the tour + name step).
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await clickText(page, 'English');
  await page.waitForTimeout(400);
  await clickText(page, 'Got it →');
  await page.waitForTimeout(400);
  await clickText(page, 'Jump right in');
  await page.waitForTimeout(1500);

  // Shopping → Catalogue sub-tab.
  console.log('> Shopping tab');
  await page.getByRole('button', { name: 'Shopping', exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1000);
  console.log('> Catalogue sub-tab');
  // The sub-tab toggles are PressableScale (accessibilityRole=button + label) sitting under
  // the floating glass-header overlay, which intercepts real click coordinates even with
  // force. Dispatch the pointer/click sequence directly on the button element — RN-web wires
  // onPress→onClick and onPressIn/Out→pointerdown/up, and React catches the bubbling events.
  const switchTab = async (name) => {
    const btn = page.getByRole('button', { name, exact: true });
    const handle = (await btn.all()).slice(-1)[0] ?? btn.first();
    await handle.evaluate((el) => {
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
      }
    });
  };
  await switchTab('Catalogue');
  await page.waitForTimeout(1200);
  await shot(page, 'catalogue-list');

  // A first-visit "Monthly list reset" info modal can pop over the list — dismiss it so it
  // doesn't block the add-row input.
  for (const label of ['Got it', 'Got it →', 'OK']) {
    const btn = page.getByText(label, { exact: true }).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      break;
    }
  }

  // Seeded rows should be present and alphabetically first-visible.
  const addRowPresent = await page.getByPlaceholder('Item name').first().isVisible().catch(() => false);
  const seedVisible = await page.getByText('Agurk', { exact: true }).first().isVisible().catch(() => false);
  console.log(`  add-row present: ${addRowPresent}; a known seed row visible: ${seedVisible}`);
  if (!seedVisible) pageErrors.push('No seeded catalogue row visible (expected Norwegian-sorted list)');

  // Add a catalogue item and confirm it appears in the list. Use a clean letters-only name
  // that sorts to the TOP of the (virtualized) list so it's in the initial render window —
  // a bottom-sorted name would be added fine but stay unmounted off-screen (isVisible()
  // couldn't see it). NB: Norwegian collation treats a leading "aa" as "å" (sorts last), so
  // avoid an "Aaa…" prefix; "Abc…" sorts genuinely first (before "Agurk").
  const itemName = `Abctest${Date.now() % 100000}`;
  const input = page.getByPlaceholder('Item name').first();
  await input.fill(itemName);
  await input.press('Enter');
  await page.waitForTimeout(800);
  const added = await page.getByText(itemName, { exact: true }).first().isVisible().catch(() => false);
  console.log(`  added item visible in list: ${added}`);
  if (!added) pageErrors.push(`Catalogue item "${itemName}" not visible after add`);
  await shot(page, 'catalogue-after-add');

  // Round-trip: switch to Week lists and back to Catalogue — item must survive (store→DB).
  await switchTab('Week lists');
  await page.waitForTimeout(600);
  await switchTab('Catalogue');
  await page.waitForTimeout(800);
  const persisted = await page.getByText(itemName, { exact: true }).first().isVisible().catch(() => false);
  console.log(`  added item persisted after sub-tab round-trip: ${persisted}`);
  if (!persisted) pageErrors.push(`Catalogue item "${itemName}" did not persist after sub-tab round-trip`);
  await shot(page, 'catalogue-roundtrip');

  console.log(`\n> page errors: ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log('  [err]', e));
  await browser.close();
  if (pageErrors.length > 0) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
