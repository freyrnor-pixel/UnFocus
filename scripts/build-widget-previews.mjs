/**
 * build-widget-previews.mjs — regenerate assets/widget-previews/*.png from the real widget source.
 *
 * These PNGs are what Android shows in the widget PICKER (long-press the home screen → Widgets),
 * declared per widget as `previewImage` in app.json. They are the first and often only look
 * anyone gets at a widget before deciding to place it, and until 2026-08-15 they were
 * hand-drawn one-offs: the old Midnight-glass navy, the pre-categorical accents, English-only
 * titles, and a "Today's tasks" heading the widget itself never rendered. A user browsing the
 * picker saw a different app to the one they'd get.
 *
 * ⚠️ **A hand-drawn preview drifts, so this does not draw one.** Every colour and every title
 * is EXTRACTED FROM SOURCE at run time — the palette out of lib/widgets/WidgetViews.tsx, the
 * accents out of lib/widgets/snapshot.ts, the titles out of lib/widgets/headlessSnapshot.ts's
 * WIDGET_STRINGS. Nothing here is a copy that can go stale; if a hue moves, re-running this is
 * the whole update. `lib/widgets/__tests__/widgetPalette.test.ts` asserts this file holds no
 * hardcoded hex at all, so a future "just tweak the colour here" edit fails the build.
 *
 * Sample ROW TEXT is invented, and honestly so — a preview has no real data to show. It is the
 * only thing in here not taken from source.
 *
 * ⚠️ **This is a NATIVE-SURFACE change.** `previewImage` is bundled into the APK as a drawable,
 * so regenerating the PNGs reaches nobody over OTA — it needs a new build (AGENTS.md, "New
 * preview APK build"). It does NOT change the JS↔native contract, so it does not by itself
 * require a `runtimeVersion` bump.
 *
 * Usage:
 *   node scripts/build-widget-previews.mjs            # Norwegian (the app's default language)
 *   node scripts/build-widget-previews.mjs --lang=en
 *   node scripts/build-widget-previews.mjs --theme=light
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'widget-previews');

const args = process.argv.slice(2);
const argOf = (name, fallback) =>
  (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=')[1];
const LANG = argOf('lang', 'no') === 'en' ? 'en' : 'no';
// Dark is the app's default appearance since 2026-08-16, and the widget's dark palette is the
// one its identity hues are actually tuned for — so the picker shows that.
const THEME = argOf('theme', 'dark') === 'light' ? 'light' : 'dark';

// Android's picker scales the preview down hard; 2x the widget's 3x2 cell footprint keeps it
// crisp without shipping a large drawable.
const WIDTH = 384;
const HEIGHT = 216;

const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

// ── Extract, never copy ─────────────────────────────────────────────────────
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** `const NAME… = { … }` → key→value map, for simple string-literal properties only. */
function literalBlock(src, name) {
  const m = new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n?\\};`).exec(src);
  if (!m) throw new Error(`could not find ${name} — has it been renamed?`);
  const out = {};
  for (const p of m[1].matchAll(/'?([\w#]+)'?\s*:\s*'((?:[^'\\]|\\.)*)'/g)) {
    out[p[1]] = p[2].replace(/\\'/g, "'");
  }
  return out;
}

const viewsSrc = read('lib/widgets/WidgetViews.tsx');
const palette = literalBlock(viewsSrc, THEME === 'dark' ? 'DARK' : 'LIGHT');
const lightInk = literalBlock(viewsSrc, 'LIGHT_INK');
const accents = literalBlock(read('lib/widgets/snapshot.ts'), 'WIDGET_ACCENT');

// Mirrors ink() in WidgetViews.tsx: dark passes an identity hue straight through, light needs
// the darkened variant or the hue lands at 1.35-3.42:1 and is unreadable.
const ink = (hex) => (THEME === 'dark' ? hex : lightInk[hex.toUpperCase()] || hex);

// The two ink ends onInk() picks between, lifted out of its source rather than retyped.
const ON_INK = (/ratio\(fill, '(#[0-9A-Fa-f]{6})'\) >= ratio\(fill, '(#[0-9A-Fa-f]{6})'\)/.exec(viewsSrc) || []).slice(1);
if (ON_INK.length !== 2) throw new Error('could not read onInk()’s two ink ends from WidgetViews.tsx');

const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) =>
  srgb(h)
    .map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
/** Label colour for something drawn ON a fill — same rule as WidgetViews.tsx's onInk(). */
const onInk = (fill) => (ratio(fill, ON_INK[0]) >= ratio(fill, ON_INK[1]) ? ON_INK[0] : ON_INK[1]);

// WIDGET_STRINGS is nested per language, so slice the language's own block out first.
const headlessSrc = read('lib/widgets/headlessSnapshot.ts');
const langBlock = new RegExp(`\\n  ${LANG}: \\{([\\s\\S]*?)\\n  \\},`).exec(headlessSrc);
if (!langBlock) throw new Error(`could not find WIDGET_STRINGS.${LANG}`);
const strings = {};
for (const p of langBlock[1].matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) {
  strings[p[1]] = p[2].replace(/\\'/g, "'");
}

// ── The only invented content in the file ───────────────────────────────────
// THREE rows is the budget: 216px less the frame padding and header leaves room for exactly
// that many, and a preview showing a row sliced in half is worse than one showing fewer. The
// real widget scrolls; a static picture cannot.
const SAMPLES = {
  no: {
    shopping: ['Melk', 'Havregryn', 'Kaffe'],
    tasks: ['Ringe tannlegen', 'Svare på e-post', 'Rydde kjøkkenet'],
    notes: ['Gaveidé til Mia', 'Bytte dekk før vinteren'],
    habits: ['Drikke vann', 'Gå en tur'],
    trays: [['Morgen', '2 av 2', 'taken'], ['Midt på dagen', '0 av 1', 'due']],
    health: [['Hodepine', 3]],
  },
  en: {
    shopping: ['Milk', 'Oats', 'Coffee'],
    tasks: ['Call the dentist', 'Reply to email', 'Tidy the kitchen'],
    notes: ['Gift idea for Mia', 'Swap tyres before winter'],
    habits: ['Drink water', 'Go for a walk'],
    trays: [['Morning', '2 of 2', 'taken'], ['Midday', '0 of 1', 'due']],
    health: [['Headache', 3]],
  },
}[LANG];

// ── Layout (mirrors WidgetViews.tsx's Flex/Text structure) ──────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const marker = (accent, filled, mutedRing) =>
  filled
    ? `<i class="dot" style="background:${accent}"></i>`
    : `<i class="dot ring" style="border-color:${mutedRing ? palette.muted : accent}"></i>`;

const row = (accent, { text, filled, mutedRing, muted, right }) => `
  <div class="row">
    <div class="left">${marker(accent, filled, mutedRing)}<span class="label${muted ? ' muted' : ''}">${esc(text)}</span></div>
    ${right ? `<span class="right">${right}</span>` : ''}
  </div>`;

const severity = (accent, n) =>
  `<span class="sev">${[0, 1, 2, 3, 4]
    .map((i) => `<i class="pip" style="${i < n ? `background:${accent}` : `border:1px solid ${palette.line}`}"></i>`)
    .join('')}</span>`;

function card(accent, title, subtitle, body, extra = '') {
  return `<div class="frame">
    <div class="head">
      <div class="left"><i class="dot" style="background:${accent}"></i><span class="title">${esc(title)}</span></div>
      ${subtitle ? `<span class="sub" style="color:${accent}">${esc(subtitle)}</span>` : ''}
    </div>
    ${extra}
    <div class="body">${body}</div>
  </div>`;
}

const WIDGETS = {
  shopping: () => {
    const a = ink(accents.shop);
    return card(a, strings.shoppingTitle, LANG === 'no' ? '2 varer igjen' : '2 items left',
      SAMPLES.shopping.map((n, i) => row(a, { text: n, filled: i === 2, muted: i === 2 })).join(''));
  },
  tasks: () => {
    const a = ink(accents.task);
    return card(a, strings.tasksTitle, LANG === 'no' ? '2 oppgaver igjen' : '2 tasks left',
      SAMPLES.tasks.map((n, i) => row(a, { text: n, filled: i === 2, mutedRing: true, muted: i === 2 })).join(''));
  },
  notes: () => {
    const a = ink(accents.notes);
    const mic = `<span class="mic" style="background:${a};color:${onInk(a)}"><i class="pip" style="background:currentColor"></i>${esc(strings.voiceNote)}</span>`;
    return `<div class="frame">
      <div class="head">
        <div class="left"><i class="dot" style="background:${a}"></i><span class="title">${esc(strings.notesTitle)}</span></div>
        ${mic}
      </div>
      <div class="body">${SAMPLES.notes.map((n) => row(a, { text: n })).join('')}</div>
    </div>`;
  },
  habits: () => {
    const a = ink(accents.habits);
    return card(a, strings.habitsTitle, LANG === 'no' ? '1 vane igjen' : '1 habit left',
      SAMPLES.habits.map((n, i) => row(a, { text: n, filled: i === 0, mutedRing: true, muted: i === 0 })).join(''));
  },
  // The one that changed shape in this pass: medicine trays above the symptom entries.
  health: () => {
    const a = ink(accents.health);
    const trays = SAMPLES.trays
      .map(([label, detail, state]) =>
        row(a, { text: label, filled: state === 'taken', muted: state === 'taken', right: `<span class="det">${esc(detail)}</span>` })
      )
      .join('');
    const entries = SAMPLES.health
      .map(([label, sev]) => row(a, { text: label, filled: true, right: severity(a, sev) }))
      .join('');
    return card(a, strings.healthTitle, `1 ${LANG === 'no' ? 'medisin gjenstår' : 'medicine still due'}`, trays + entries);
  },
};

const html = (inner) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;background:transparent}
  body{font-family:Roboto,"Noto Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .frame{width:${WIDTH}px;height:${HEIGHT}px;background:${palette.card};border-radius:36px;
         padding:22px;display:flex;flex-direction:column;color:${palette.text};overflow:hidden}
  .head{display:flex;align-items:center;justify-content:space-between;flex:none;gap:14px}
  /* min-width:0 is what lets the TITLE ellipsis instead of shoving the subtitle off the
     card — the same failure npm run wraps exists to catch on the app's own rows. */
  .left{display:flex;align-items:center;min-width:0;flex:0 1 auto}
  .dot{width:18px;height:18px;border-radius:50%;margin-right:14px;flex:none}
  .dot.ring{background:transparent;border-width:4px;border-style:solid}
  .title{font-size:27px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{font-size:21px;font-weight:500;white-space:nowrap;margin-left:12px;flex:none}
  .body{margin-top:10px;display:flex;flex-direction:column;flex:1;overflow:hidden}
  .row{display:flex;align-items:center;justify-content:space-between;padding:9px 2px;flex:none}
  .label{font-size:23px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .muted{color:${palette.muted}}
  .right{display:flex;align-items:center;margin-left:14px;flex:none}
  .det{font-size:21px;color:${palette.muted}}
  .sev{display:flex;align-items:center}
  .pip{width:13px;height:13px;border-radius:50%;margin-left:5px;display:inline-block;flex:none}
  .mic{display:inline-flex;align-items:center;gap:10px;border-radius:26px;padding:8px 16px;
       font-size:21px;font-weight:600;white-space:nowrap;flex:none}
  .mic .pip{margin:0;width:14px;height:14px}
</style>${inner}`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  for (const [name, build] of Object.entries(WIDGETS)) {
    await page.setContent(html(build()), { waitUntil: 'load' });
    // In a picker, the widget's NAME is what someone is reading; the count beside it is
    // decoration. Norwegian is long enough that "Dagens gjøremål" + "2 oppgaver igjen" does
    // not fit at this width, and the flex rules above resolve that by ellipsising the title —
    // exactly backwards for this one use. So if the title truncated, drop the subtitle and
    // re-render. Measured rather than hand-tuned per language, since EN and NO differ.
    const dropped = await page.evaluate(() => {
      const title = document.querySelector('.title');
      const sub = document.querySelector('.sub');
      if (!title || !sub || title.scrollWidth <= title.clientWidth) return false;
      sub.remove();
      return true;
    });
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), omitBackground: true });
    console.log(`  ✓ ${name}.png${dropped ? '  (subtitle dropped — title needed the width)' : ''}`);
  }

  await browser.close();
  console.log(`\nWrote 5 previews to assets/widget-previews/ (${LANG}, ${THEME}).`);
  console.log('⚠️  previewImage is bundled into the APK — this needs a native build to reach anyone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
