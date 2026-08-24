#!/usr/bin/env node
// measure-halos.mjs — is any field's neon actually being DRAWN, or is it sliced off?
//
// A field's halo (`getFieldGlow`, constants/theme.ts) is a `boxShadow`, so it is cut to the
// nearest ancestor with `overflow: hidden` — and a card clips its own body (components/Card.tsx
// folds it through a `Collapsible`). A composer mounted as a full-width child of that body
// therefore has ZERO room for its light: the halo's left and right halves are chopped off flat
// at the field's own edges, which reads as a hard neon rim rather than a glow.
//
// That is what shipped, on every composer in the app but one, and it is invisible to every
// other check in this repo: `tsc` sees valid styles, the Jest suite has no layout, and a
// screenshot shows a lit box either way — the whole tell is that the light stops dead instead
// of fading. Three maintainer reports about "the text boxes" were this. Hence a measurement:
// walk the real app in the web preview and, for every field-shaped haloed element, compare the
// blur radius against the room it has before the clip.
//
//   npm run halos              # 430px, English
//   npm run halos -- --width=360
//
// Exits 1 if anything is clipped, so it can gate a change the way `npm run wraps` reports do.
// Needs the preview bundle: `npm run preview:build` (or FORCE_BUILD=1) and a server on 8787 —
// scripts/run-halos.sh wires both up, the same way run-preview.sh does.
import { chromium } from '@playwright/test';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;
const width = Number(process.argv.find((a) => a.startsWith('--width='))?.split('=')[1] || 430);

async function clickText(page, text) {
  const loc = page.getByText(text, { exact: true });
  await loc.first().waitFor({ state: 'attached', timeout: 10000 });
  for (const c of await loc.all()) if (await c.isVisible()) { await c.click({ timeout: 10000 }); return; }
  throw new Error(`no visible "${text}"`);
}

// Every card rests closed (lib/cardRegistry.ts), and a composer inside a closed card is not in
// the DOM — so a walk that does not open them measures almost nothing. Same trap the wrap
// audit hit on 2026-08-21; the failure is silent in both.
async function openCards(page) {
  for (let i = 0; i < 14; i++) {
    const toggle = page.getByRole('button', { name: /: (Expand|Open)/i }).first();
    if (!(await toggle.count()) || !(await toggle.isVisible().catch(() => false))) return;
    await toggle.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

// Runs in the page. FIELD_RADIUS (12) is what marks a field: it is the one radius every field
// in the app is cut to, halo included (see getFieldGlow), so it separates a field's light from
// a card's own drop shadow without needing a class name.
const SCAN = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.boxShadow === 'none' || !/rgba?\\(/.test(cs.boxShadow)) continue;
    if (Math.round(parseFloat(cs.borderTopLeftRadius)) !== 12) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20 || r.bottom < 0 || r.top > window.innerHeight) continue;
    const blurs = [...cs.boxShadow.matchAll(/(-?[\\d.]+)px (-?[\\d.]+)px ([\\d.]+)px/g)].map((m) => parseFloat(m[3]));
    const need = Math.round(Math.max(0, ...blurs));
    let n = el.parentElement, clip = null;
    while (n) { const c = getComputedStyle(n); if (c.overflow !== 'visible') { clip = n.getBoundingClientRect(); break; } n = n.parentElement; }
    if (!clip) continue;
    const input = el.querySelector('input,textarea') || (el.tagName === 'INPUT' ? el : null);
    const label = (input && (input.placeholder || input.value))
      || (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28) || '(unlabelled field)';
    out.push({ label, need, room: {
      left: Math.round(r.left - clip.left), right: Math.round(clip.right - r.right),
      top: Math.round(r.top - clip.top), bottom: Math.round(clip.bottom - r.bottom) } });
  }
  return out;
})()`;

const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width, height: 932 } });
let clipped = 0, clean = 0;
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await clickText(page, 'Continue');
  await page.waitForTimeout(600);
  await clickText(page, 'Start');
  await page.waitForTimeout(1800);
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(800); }

  // All five screens are mounted at once (`lazy: false`), so a field can be reported from a tab
  // it does not live on. Dedupe on what was measured rather than on where it was found.
  const seen = new Set();
  for (const tab of ['Shop', 'To-do', 'Home', 'Habits', 'Health']) {
    await page.getByRole('button', { name: new RegExp(`^${tab}$`) }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await openCards(page);
    await page.waitForTimeout(400);
    for (const f of await page.evaluate(SCAN)) {
      const key = `${f.label}|${JSON.stringify(f.room)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const short = Object.entries(f.room).filter(([, v]) => v < f.need);
      if (short.length) {
        clipped += 1;
        console.log(`  CLIPPED  "${f.label}" halo=${f.need}px, room ${short.map(([s, v]) => `${s}=${v}`).join(' ')}`);
      } else {
        clean += 1;
        console.log(`  ok       "${f.label}" halo=${f.need}px`);
      }
    }
  }
} finally {
  await browser.close();
}
console.log(`\n${clipped} clipped, ${clean} clean (at ${width}px)`);
if (clipped) {
  console.log('\nA clipped halo means the field has less room than its own light needs. Give the');
  console.log('component that owns the field `FIELD_GLOW_CLEARANCE` of padding (constants/theme.ts),');
  console.log('the way components/PadTypeRow.tsx and components/AddRow.tsx do — do not shrink the glow');
  console.log('at one call site, and do not "fix" it by moving the shadow onto a different view.');
}
process.exit(clipped ? 1 : 0);
