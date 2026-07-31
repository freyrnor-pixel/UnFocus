#!/usr/bin/env node
/**
 * measure-wraps.mjs — audit for "this only just wrapped" layout bugs.
 *
 * Drives the web preview and reports three failure modes that all look the same on a
 * phone ("why is that on two lines?") but have different causes and different fixes:
 *
 *   1. WRAPPED TEXT   — a paragraph/label on N+1 lines that would fit in N. Reported with
 *                       `needForOne`: how many more px of width would collapse it to one
 *                       line. A small number means the container is the problem, not the
 *                       copy.
 *   2. TRUNCATED TEXT — a single-line element whose text overflows its box (ellipsis or
 *                       clip). Tabs and chips fail this way instead of wrapping.
 *                       ⚠️ CONFIRM THESE ON A DEVICE BEFORE "FIXING" THEM. React Native's
 *                       `adjustsFontSizeToFit` / `minimumFontScale` shrink a label instead
 *                       of clipping it, and react-native-web implements NEITHER — so any
 *                       Text using them is reported here as truncated even though it fits
 *                       fine on iOS/Android. components/BottomNav.tsx's tab label is exactly
 *                       this case ("Handleliste" at minimumFontScale 0.8): the audit flags
 *                       it, the real app shrinks it. Wrapped text and wrapped rows are real
 *                       geometry and DO reproduce faithfully on web.
 *   3. WRAPPED ROWS   — a horizontal control row (the Mon–Sun weekday chips, a tab bar,
 *                       a segmented control) whose children spill onto a second line.
 *                       These can't be fixed by shortening copy — the row has a hard
 *                       minimum width — so they have to be measured, not eyeballed.
 *
 * Usage:
 *   node scripts/measure-wraps.mjs [--lang=no|en] [--width=393] [--json]
 *
 * Widths worth checking: 430 (iPhone Pro Max), 393 (iPhone 15 / Pixel 8), 360 (common
 * small Android). Large-font pressure: the app's `large` font setting is 1.2x, so
 * measuring at width/1.2 (e.g. 327 for a 393pt phone) approximates it without having to
 * drive the Settings UI — see `--width=327`.
 *
 * Chromium is pre-installed under PLAYWRIGHT_BROWSERS_PATH; never `playwright install`.
 * Requires the built bundle + a running server — `npm run wraps` handles both.
 */
import { chromium } from '@playwright/test';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const LANG = arg('lang', 'no');
const WIDTH = parseInt(arg('width', '393'), 10);
const AS_JSON = process.argv.includes('--json');

// Every string the walk clicks, per language, so adding a language is a table edit.
const L = {
  en: {
    langRow: /^Language: English\./, basicsNext: 'Continue',
    newHere: "No, I'm new here", gotIt: 'Got it →', guided: 'Walk me through it',
    next: 'Next →', go: "Let's go! 🌿", tourNext: 'Got it', skipTour: 'Skip the tour',
    tabs: ['Shopping', 'To-do', 'Health', 'Habits'], home: 'Home', settings: 'Settings',
    dismiss: ['Skip', 'Got it', 'Got it →', 'OK'],
  },
  no: {
    langRow: /^Språk: Norsk\./, basicsNext: 'Fortsett',
    newHere: 'Nei, jeg er ny her', gotIt: 'Skjønner →', guided: 'Vis meg rundt',
    next: 'Neste →', go: 'Kom i gang! 🌿', tourNext: 'Skjønner', skipTour: 'Hopp over omvisningen',
    tabs: ['Handleliste', 'Gjøremål', 'Helse', 'Vaner'], home: 'Hjem', settings: 'Innstillinger',
    dismiss: ['Hopp over', 'Skjønner', 'Skjønner →', 'OK'],
  },
}[LANG];

if (!L) { console.error(`unknown --lang=${LANG} (expected en or no)`); process.exit(1); }

async function clickText(page, text) {
  const locator = page.getByText(text, { exact: true });
  await locator.first().waitFor({ state: 'attached', timeout: 10000 });
  for (const c of await locator.all()) {
    if (await c.isVisible()) { await c.click({ timeout: 10000 }); return; }
  }
  throw new Error(`no visible match for "${text}"`);
}

async function dismissModalIfPresent(page) {
  for (let i = 0; i < 3; i++) {
    let did = false;
    for (const label of L.dismiss) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250); did = true; break;
      }
    }
    if (!did) return;
  }
}

// Runs in the page.
const SCAN = () => {
  const texts = [];
  const rows = [];
  const visible = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden';

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 4) continue;

    // ── 3. Control rows: a flex row whose children sit on more than one baseline.
    if (cs.display === 'flex' && cs.flexDirection === 'row' && el.children.length >= 3) {
      // Only NORMAL-FLOW children count. An absolutely-positioned sibling (BottomNav's
      // sliding pill, a badge, an overlay) sits at its own `top` and would otherwise make
      // a perfectly fine single-line row look like it wrapped — that false positive is why
      // this filter exists; don't drop it.
      const kids = Array.from(el.children)
        .map((k) => ({ k, r: k.getBoundingClientRect(), cs: getComputedStyle(k) }))
        .filter((x) => x.r.width > 0 && x.r.height > 0
          && x.cs.position !== 'absolute' && x.cs.position !== 'fixed');
      if (kids.length >= 3) {
        const tops = new Set(kids.map((x) => Math.round(x.r.top)));
        const gapPx = parseFloat(cs.columnGap || cs.gap) || 0;
        const needPx = kids.reduce((s, x) => s + x.r.width, 0) + gapPx * (kids.length - 1);
        // `short > 0` is the real test: the children genuinely need more width than the row
        // has. Multiple `top`s with short <= 0 means they're stacked for some other reason
        // (align-items, a taller sibling), not because the row ran out of room.
        if (tops.size > 1 && needPx - rect.width > 0) {
          const widest = Math.max(...kids.map((x) => x.r.width));
          rows.push({
            kind: 'row-wrapped',
            children: kids.length,
            linesUsed: tops.size,
            avail: Math.round(rect.width),
            needed: Math.round(needPx),
            short: Math.round(needPx - rect.width),
            widestChild: Math.round(widest),
            wrapping: cs.flexWrap,
            sample: kids.slice(0, 8).map((x) => (x.k.textContent || '').trim().slice(0, 12)).join('|'),
          });
        }
      }
    }

    if (el.children.length > 0) continue;
    const txt = (el.textContent || '').trim();
    if (!txt || txt.length < 2) continue;

    // Real line boxes (element height includes padding, which fakes a second line).
    let lines = 0;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rs = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      lines = new Set(rs.map((r) => Math.round(r.top))).size;
    } catch { continue; }

    const prevWS = el.style.whiteSpace, prevOF = el.style.overflow;
    el.style.whiteSpace = 'nowrap'; el.style.overflow = 'visible';
    const natural = el.scrollWidth;
    el.style.whiteSpace = prevWS; el.style.overflow = prevOF;

    const avail = rect.width;
    if (lines >= 2) {
      texts.push({
        kind: 'wrapped', text: txt.slice(0, 70), lines,
        avail: Math.round(avail), natural: Math.round(natural),
        needForOne: Math.round(natural - avail), fontSize: cs.fontSize,
      });
    } else if (natural > avail + 1) {
      // ── 2. Single line but overflowing: ellipsised or clipped.
      texts.push({
        kind: 'truncated', text: txt.slice(0, 70), lines: 1,
        avail: Math.round(avail), natural: Math.round(natural),
        needForOne: Math.round(natural - avail), fontSize: cs.fontSize,
      });
    }
  }
  return { texts, rows };
};

const screens = [];
async function scan(page, name) {
  screens.push({ name, ...(await page.evaluate(SCAN)) });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 852 } });
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    // Basics is screen ONE and the densest control screen in the app: six rows of pills,
    // three-across at the widest. It is exactly the shape this audit exists to catch, so it
    // gets scanned before anything is tapped. The language row is a radio, not a button.
    await scan(page, 'onboarding-basics');
    await page.getByRole('radio', { name: L.langRow }).first().click({ timeout: 10000 });
    await page.waitForTimeout(400);
    await clickText(page, L.basicsNext);
    await page.waitForTimeout(400);
    await clickText(page, L.newHere);
    await page.waitForTimeout(400);
    await scan(page, 'onboarding-privacy');
    await clickText(page, L.gotIt);
    await page.waitForTimeout(400);
    await clickText(page, L.guided);
    await page.waitForTimeout(400);
    await scan(page, 'onboarding-energy');
    await clickText(page, L.next);
    await page.waitForTimeout(400);
    await scan(page, 'onboarding-features');
    await clickText(page, L.next);
    await page.waitForTimeout(400);
    await scan(page, 'onboarding-name');
    await clickText(page, L.go);
    await page.waitForTimeout(1800);

    // The guided tour opens straight after onboarding. Measure its coach card — it is new copy
    // in a fixed-width box, exactly what this audit is for — then dismiss it, or its scrim
    // swallows every click below and the run dies somewhere unrelated.
    if (await page.getByText(L.tourNext, { exact: true }).first().isVisible().catch(() => false)) {
      await scan(page, 'tour-step');
      await clickText(page, L.skipTour);
      await page.waitForTimeout(900);
    }

    await scan(page, 'home');
    for (const tab of L.tabs) {
      await page.getByRole('button', { name: tab, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(900);
      await dismissModalIfPresent(page);
      await scan(page, tab);
    }
    await page.getByRole('button', { name: L.home, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: L.settings, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1200);
    await scan(page, 'settings');
  } finally {
    await browser.close();
  }

  if (AS_JSON) { console.log(JSON.stringify(screens, null, 1)); return; }

  const allTexts = screens.flatMap((s) => s.texts.map((t) => ({ ...t, screen: s.name })));
  const allRows = screens.flatMap((s) => s.rows.map((r) => ({ ...r, screen: s.name })));
  const uniq = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  console.log(`\n=== wrap audit — lang=${LANG} width=${WIDTH}px ===\n`);

  const rowsWrapped = uniq(allRows, (r) => r.sample);
  console.log(`CONTROL ROWS that wrapped (cannot be fixed by shortening copy): ${rowsWrapped.length}`);
  for (const r of rowsWrapped.sort((a, b) => a.short - b.short)) {
    console.log(`  short by ${r.short}px | ${r.children} items on ${r.linesUsed} lines | `
      + `avail=${r.avail} needed=${r.needed} widest=${r.widestChild} [${r.screen}] ${r.sample}`);
  }

  const trunc = uniq(allTexts.filter((t) => t.kind === 'truncated'), (t) => t.text);
  console.log(`\nTRUNCATED single-line text: ${trunc.length}`
    + `\n  (confirm on device — adjustsFontSizeToFit/minimumFontScale are not emulated on web,`
    + `\n   so an auto-shrinking label like BottomNav's shows up here but is fine natively)`);
  for (const t of trunc.sort((a, b) => b.needForOne - a.needForOne)) {
    console.log(`  over by ${t.needForOne}px | avail=${t.avail} ${t.fontSize} [${t.screen}] ${JSON.stringify(t.text)}`);
  }

  const near = uniq(allTexts.filter((t) => t.kind === 'wrapped' && t.lines === 2
    && t.needForOne > 0 && t.needForOne <= 60), (t) => t.text.slice(0, 44));
  console.log(`\nNEAR-MISS wrapped text (would fit on one line with <=60px more): ${near.length}`);
  for (const t of near.sort((a, b) => a.needForOne - b.needForOne)) {
    console.log(`  +${t.needForOne}px | avail=${t.avail} ${t.fontSize} [${t.screen}] ${JSON.stringify(t.text)}`);
  }

  const totalWrapped = allTexts.filter((t) => t.kind === 'wrapped').length;
  console.log(`\ntotals: ${totalWrapped} wrapped, ${allTexts.filter((t) => t.kind === 'truncated').length} truncated, `
    + `${allRows.length} wrapped rows\n`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
