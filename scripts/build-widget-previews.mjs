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
import { resolveChromium } from './chromium-path.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'widget-previews');

const args = process.argv.slice(2);
const argOf = (name, fallback) =>
  (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=')[1];
const LANG = argOf('lang', 'no') === 'en' ? 'en' : 'no';
// Dark is the app's default appearance since 2026-08-16, and the widget's dark palette is the
// one its identity hues are actually tuned for — so the picker shows that.
const THEME = argOf('theme', 'dark') === 'light' ? 'light' : 'dark';

// Android's picker scales the preview down hard, so this is drawn at K× a real placement (see
// K below) — big enough to stay crisp, small enough not to ship a heavy drawable.
const WIDTH = 384;
const HEIGHT = 216;

const CHROMIUM_PATH = resolveChromium();

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

const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hx = (n) => Math.round(n).toString(16).padStart(2, '0');
/** Mirrors WidgetViews.tsx's `composite` — one translucent layer flattened onto its ground. */
const mix = (base, tint, a) => {
  const [r1, g1, b1] = srgb(base);
  const [r2, g2, b2] = srgb(tint);
  return `#${hx(r1 + (r2 - r1) * a)}${hx(g1 + (g2 - g1) * a)}${hx(b1 + (b2 - b1) * a)}`;
};

// The matte key's three alphas, READ OUT of keyStyle() rather than retyped — the mic button is
// the one thing here whose colour is computed per hue rather than looked up in a table, so it
// is also the one that would silently drift if this file carried its own numbers.
const keyAlpha = (name, re) => {
  const m = re.exec(viewsSrc);
  if (!m) throw new Error(`could not read keyStyle()'s ${name} alpha from WidgetViews.tsx`);
  return [Number(m[1]), Number(m[2])];
};
// The white a lit edge catches, read out of WidgetViews' own GLASS_LIGHT rather than typed —
// this file is asserted to contain no hex literal at all (widgetPalette.test.ts), which is what
// makes "extract, never copy" a mechanism rather than a habit.
const GLASS_LIGHT = (/const GLASS_LIGHT = '(#[0-9A-Fa-f]{6})'/.exec(viewsSrc) || [])[1];
if (!GLASS_LIGHT) throw new Error('could not read GLASS_LIGHT from WidgetViews.tsx');

const [KEY_BODY_D, KEY_BODY_L] = keyAlpha('body', /composite\(p\.card, accent, p\.dark \? ([\d.]+) : ([\d.]+)\)/);
const [KEY_LIT_D, KEY_LIT_L] = keyAlpha('lit', /composite\(p\.card, GLASS_LIGHT, p\.dark \? ([\d.]+) : ([\d.]+)\)/);
const KEY_SHADE = keyAlpha('shade', /p\.dark \? composite\(p\.card, GLASS_LIGHT, ([\d.]+)\) : composite\(p\.card, accent, ([\d.]+)\)/);

/** The matte key (constants/theme.ts's glassKey), for the preview's one button. */
const key = (accent) => {
  const dark = THEME === 'dark';
  const body = mix(palette.card, accent, dark ? KEY_BODY_D : KEY_BODY_L);
  const lit = mix(palette.card, GLASS_LIGHT, dark ? KEY_LIT_D : KEY_LIT_L);
  const shade = dark ? mix(palette.card, GLASS_LIGHT, KEY_SHADE[0]) : mix(palette.card, accent, KEY_SHADE[1]);
  return `background:${body};border-top-color:${lit};border-left-color:${lit};` +
    `border-bottom-color:${shade};border-right-color:${shade}`;
};

// WIDGET_STRINGS is nested per language, so slice the language's own block out first.
const headlessSrc = read('lib/widgets/headlessSnapshot.ts');
const langBlock = new RegExp(`\\n  ${LANG}: \\{([\\s\\S]*?)\\n  \\},`).exec(headlessSrc);
if (!langBlock) throw new Error(`could not find WIDGET_STRINGS.${LANG}`);
const strings = {};
for (const p of langBlock[1].matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) {
  strings[p[1]] = p[2].replace(/\\'/g, "'");
}

// ── The only invented content in the file ───────────────────────────────────
// TWO rows is the budget — it was three until 2026-08-28. The card's header grew a second
// storey (the peek) and its rows grew a box, which is ~8dp per row and ~15dp of header, so a
// 135dp widget now holds two. A preview showing a row sliced in half is worse than one showing
// fewer; the real widget scrolls, a static picture cannot.
const SAMPLES = {
  no: {
    shopping: ['Melk', 'Havregryn'],
    tasks: ['Ringe tannlegen', 'Svare på e-post'],
    notes: ['Gaveidé til Mia', 'Bytte dekk før vinteren'],
    habits: ['Drikke vann', 'Gå en tur'],
    trays: [['Morgen', '0 av 1', 'due']],
    health: [['Hodepine', 3]],
  },
  en: {
    shopping: ['Milk', 'Oats'],
    tasks: ['Call the dentist', 'Reply to email'],
    notes: ['Gift idea for Mia', 'Swap tyres before winter'],
    habits: ['Drink water', 'Go for a walk'],
    trays: [['Morning', '0 of 1', 'due']],
    health: [['Headache', 3]],
  },
}[LANG];

// ── Layout (mirrors WidgetViews.tsx's Flex/Text structure) ──────────────────
// Rebuilt 2026-08-28 alongside the widget's own card anatomy: a lit edge, a badge plate, the
// subtitle as a peek UNDER the title, boxed rows, and the check on the right. Every dp below is
// the widget's own number times K — the preview is a scaled photograph of the real layout, so
// the two cannot be given different proportions by accident.
// 1.6× a 240×135dp widget — which is what a `targetCellWidth: 3` / `targetCellHeight: 2`
// placement actually measures on a common phone, and comfortably inside the declared
// 180×110dp minimum and the horizontal|vertical resize range. It was 1.8 (a 213×120dp widget)
// while the header was one flat row; the anatomy is taller now, so depicting a bigger widget is
// what keeps the preview an honest photograph rather than a crop.
const K = 1.6;
const px = (dp) => `${(dp * K).toFixed(1)}px`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The trailing check: neutral ring while open, filled with the hue once ticked. */
const check = (accent, done) =>
  `<i class="check" style="border-color:${done ? accent : palette.line}${done ? `;background:${accent}` : ''}"></i>`;

/** A leading state mark — Health's read-only ongoing/settled pair, the row rule's other slot. */
const lead = (accent, ongoing) =>
  `<i class="lead" style="${ongoing ? `background:${accent}` : `border:${px(2)} solid ${palette.line};background:transparent`}"></i>`;

const row = (accent, { text, done, muted, leading, right, tick = true }) => `
  <div class="row">
    <div class="grow">${leading ?? ''}<span class="label${muted ? ' muted' : ''}">${esc(text)}</span></div>
    ${right ?? ''}${tick ? check(accent, !!done) : ''}
  </div>`;

const severity = (accent, n) =>
  `<span class="sev">${[0, 1, 2, 3, 4]
    .map((i) => `<i class="pip" style="${i < n ? `background:${accent}` : `border:1px solid ${palette.line}`}"></i>`)
    .join('')}</span>`;

/** The card header: badge plate + hue, then the naming column (title over peek). */
function head(accent, title, peek, right = '') {
  return `<div class="head">
      <div class="grow">
        <i class="badge" style="background:${palette.plate}"><i class="badgeDot" style="background:${accent}"></i></i>
        <span class="titles">
          <span class="title">${esc(title)}</span>
          ${peek ? `<span class="peek">${esc(peek)}</span>` : ''}
        </span>
      </div>
      ${right}
    </div>`;
}

function card(accent, title, peek, body, right = '') {
  return `<div class="frame">${head(accent, title, peek, right)}<div class="body">${body}</div></div>`;
}

const WIDGETS = {
  shopping: () => {
    const a = ink(accents.shop);
    return card(a, strings.shoppingTitle, LANG === 'no' ? '2 varer igjen' : '2 items left',
      SAMPLES.shopping.map((n, i) => row(a, { text: n, done: i === 1, muted: i === 1 })).join(''));
  },
  tasks: () => {
    const a = ink(accents.task);
    return card(a, strings.tasksTitle, LANG === 'no' ? '2 oppgaver igjen' : '2 tasks left',
      SAMPLES.tasks.map((n, i) => row(a, { text: n, done: i === 1, muted: i === 1 })).join(''));
  },
  notes: () => {
    const a = ink(accents.notes);
    // The matte key: its own hue as a flat wash with a lit edge, and a plain `text` label —
    // nothing is written on a hue any more (constants/theme.ts's glassKey).
    const mic = `<span class="mic" style="${key(a)}"><i class="micDot" style="background:${a}"></i>${esc(strings.voiceNote)}</span>`;
    return card(a, strings.notesTitle, '', SAMPLES.notes.map((n) => row(a, { text: n })).join(''), mic);
  },
  habits: () => {
    const a = ink(accents.habits);
    return card(a, strings.habitsTitle, LANG === 'no' ? '1 vane igjen' : '1 habit left',
      SAMPLES.habits.map((n, i) => row(a, { text: n, done: i === 0, muted: i === 0 })).join(''));
  },
  // Medicine trays above the symptom entries (2026-08-15). A tray is the widget's fullest row:
  // title → right-hand value → check. A symptom entry is the read-only one: leading mark, no check.
  health: () => {
    const a = ink(accents.health);
    const trays = SAMPLES.trays
      .map(([label, detail, state]) =>
        row(a, { text: label, done: state === 'taken', muted: state === 'taken', right: `<span class="det">${esc(detail)}</span>` })
      )
      .join('');
    const entries = SAMPLES.health
      .map(([label, sev]) => row(a, { text: label, leading: lead(a, true), right: severity(a, sev), tick: false }))
      .join('');
    return card(a, strings.healthTitle, `1 ${LANG === 'no' ? 'medisin gjenstår' : 'medicine still due'}`, trays + entries);
  },
};

const html = (inner) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;background:transparent}
  body{font-family:Roboto,"Noto Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  /* The card: components/Surface.tsx's lit top-left lip, the boundary token bottom-right. */
  .frame{width:${WIDTH}px;height:${HEIGHT}px;background:${palette.card};
         border-radius:${px(16)};border-style:solid;border-width:${px(1.5)};
         border-top-color:${palette.edgeLit};border-left-color:${palette.edgeLit};
         border-bottom-color:${palette.line};border-right-color:${palette.line};
         padding:${px(8)} ${px(12)} ${px(12)};display:flex;flex-direction:column;
         color:${palette.text};overflow:hidden}
  .head{display:flex;align-items:center;justify-content:space-between;flex:none;gap:${px(8)}}
  /* min-width:0 is what lets the TITLE ellipsis instead of shoving its neighbour off the
     card — the same failure npm run wraps exists to catch on the app's own rows. */
  .grow{display:flex;align-items:center;min-width:0;flex:1 1 auto}
  /* The inverted badge: a neutral frosted plate with the hue fully opaque on top. */
  .badge{width:${px(20)};height:${px(20)};border-radius:50%;margin-right:${px(8)};flex:none;
         display:inline-flex;align-items:center;justify-content:center}
  .badgeDot{width:${px(8)};height:${px(8)};border-radius:50%;display:block}
  .titles{display:flex;flex-direction:column;min-width:0}
  .title{font-size:${px(15)};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .peek{font-size:${px(11)};color:${palette.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .body{margin-top:${px(6)};display:flex;flex-direction:column;flex:1;overflow:hidden}
  /* A boxed row: components/PadSheet.tsx's neutral fill one step off the card, plus its edge. */
  .row{display:flex;align-items:center;flex:none;background:${palette.rowFill};
       border:${px(1.25)} solid ${palette.rowEdge};border-radius:${px(12)};
       padding:${px(5)} ${px(8)};margin-bottom:${px(3)}}
  .label{font-size:${px(13)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .muted{color:${palette.muted}}
  /* The check, on the RIGHT — the 2026-07-30 row rule. */
  .check{width:${px(13)};height:${px(13)};border-radius:50%;border-style:solid;
         border-width:${px(2)};margin-left:${px(8)};flex:none;display:block}
  .lead{width:${px(8)};height:${px(8)};border-radius:50%;margin-right:${px(8)};flex:none;display:block}
  .det{font-size:${px(12)};color:${palette.muted};margin-left:${px(8)};white-space:nowrap}
  .sev{display:flex;align-items:center;margin-left:${px(8)}}
  .pip{width:${px(7)};height:${px(7)};border-radius:50%;margin-left:${px(3)};display:inline-block;flex:none}
  .mic{display:inline-flex;align-items:center;border-radius:999px;border-style:solid;
       border-width:${px(1.25)};padding:${px(5)} ${px(10)};font-size:${px(12)};font-weight:600;
       white-space:nowrap;flex:none;color:${palette.text}}
  .micDot{width:${px(8)};height:${px(8)};border-radius:50%;margin-right:${px(6)};display:block}
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
    // ⚠️ **The "drop the subtitle so the title fits" hack is gone (2026-08-28), and its absence
    // is the point.** It existed because the header was one row — badge, title, then the
    // subtitle in the hue hung off the right edge — so "Dagens gjøremål" and "2 oppgaver igjen"
    // competed for the same width and Norwegian lost. The subtitle is a PEEK on its own line
    // now, exactly as it is in the app, and the two cannot take width from each other at all.
    // What is still worth watching is whether either line truncates on its own, so that is
    // measured and reported rather than silently corrected.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('.title, .peek, .label')]
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map((el) => el.textContent.trim())
    );
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), omitBackground: true });
    console.log(`  ✓ ${name}.png${clipped.length ? `  (truncated: ${clipped.join(', ')})` : ''}`);
  }

  await browser.close();
  console.log(`\nWrote 5 previews to assets/widget-previews/ (${LANG}, ${THEME}).`);
  console.log('⚠️  previewImage is bundled into the APK — this needs a native build to reach anyone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
