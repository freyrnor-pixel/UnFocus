#!/usr/bin/env node
/**
 * visual-diff.mjs — the app's visual regression gate
 *
 * WHY THIS EXISTS. Until now the maintainer's eyes were the only detector of a visual
 * regression in this repo. `tsc` sees valid styles, jest has no layout, and the three existing
 * visual harnesses answer narrower questions (`wraps` = horizontal overflow, `halos` = clipped
 * glow, `preview` = do the write paths still work). Nothing could see a thing that was FIXED
 * ONCE COMING BACK — which is why AGENTS.md reads as a list of reversals, the card header
 * cluster order alone having now been all four of its possible arrangements.
 *
 * This captures the app through the existing `screenshot-states.mjs` walk and compares every
 * shot against a committed baseline. An unexplained pixel change fails the run.
 *
 * Usage:
 *   npm run visual                    # capture + compare, exit 1 on drift
 *   npm run visual -- --update        # re-bless: current output becomes the baseline
 *   npm run visual -- --theme=dark
 *   FORCE_BUILD=1 npm run visual      # rebuild dist/ first
 *
 * ⚠️ THESE ARE WEB-RENDER vs WEB-RENDER BASELINES, NOT NATIVE GROUND TRUTH.
 * react-native-web is faithful for layout, spacing, hierarchy and copy, and is NOT faithful for
 * shadows, font metrics or Reanimated timing (AGENTS.md says so at length). So a clean run here
 * means "nothing changed that I did not intend", never "this looks right on a phone". Do not
 * let a later session read a blessed baseline as a device screenshot.
 *
 * ⚠️ **BASELINES ARE TOOLCHAIN-BOUND — pin `@playwright/test`, do not raise the tolerance.**
 * For one day this could not run in CI at all: all 21 baselines came back "changed" by a uniform
 * 0.1-1.05%, on screens the commit never touched. It read as an environment difference; it was a
 * dependency range. The library was on a caret and had drifted to a version whose launch defaults
 * rasterise text differently from the one that blessed the shots.
 *   ⚠️ The browser BINARY was not the variable — `chromium.executablePath()` resolves to the same
 * build either way. It is the LIBRARY. It is pinned to `~1.56.0`, the revision is gone from every
 * script (`scripts/chromium-path.mjs`), and `lib/__tests__/visualGate.test.ts` keeps it that way.
 *   If this ever goes uniformly red again, check the toolchain BEFORE touching MAX_DIFF_PIXELS —
 * raising it past the noise floor is exactly where a single-card regression hides.
 *
 * ⚠️ BLESSING IS THE WHOLE RISK. `--update` is how an intentional redesign lands, and it is also
 * how a real regression gets laundered into the baseline. So the diff PNGs are written for every
 * finding and the failure output names each one: re-bless deliberately, in its own commit, with
 * the diffs looked at — never as a reflex to make a red run go green.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const THEME = args.find((a) => a.startsWith('--theme='))?.split('=')[1] || 'light';

const BASELINE_DIR = path.join(ROOT, 'visual-baselines', THEME);
const WORK_DIR = path.join(ROOT, '.visual-work', THEME);
const DIFF_DIR = path.join(ROOT, 'visual-diff-out', THEME);

/**
 * How different a single pixel must be before it counts. pixelmatch's own YIQ metric, 0–1.
 * 0.1 is its documented default and absorbs anti-aliasing on text edges without absorbing a
 * colour or position change.
 */
const PIXEL_THRESHOLD = 0.1;

/**
 * How many changed pixels a screen may have before it is a finding — an ABSOLUTE count.
 *
 * ⚠️ **This was `0.0005` of the shot (~200 px) until 2026-08-30, on a premise that turned out to
 * be false, and the false premise was hiding real changes.** The old note said Chromium's text
 * rasterisation is not bit-identical across runs, so a strict 0 would make every run red. That is
 * the shape AGENTS.md's "a header that ASSERTS a safety property is not evidence the property
 * holds" gotcha warns about: it was never measured. Measured now, on one pinned toolchain, over
 * the whole set — **nine untouched screens came back at exactly 0 changed pixels**, not "small".
 * The noise floor is zero.
 *
 * What the 200 px was actually buying was a blind spot the same size. The commit that measured
 * this added one header icon to twelve screens, and every one of them differed by **exactly 84
 * px** — a thin 22px outline glyph is mostly its own background — so the gate reported
 * `unchanged` on twelve screens that had visibly gained a control. A whole new affordance is
 * precisely the class of change this exists to catch.
 *
 * An absolute budget rather than a ratio, because the thing being absorbed is stray rasteriser
 * pixels, which do not scale with the frame. 24 px is well under a third of the smallest real
 * change measured (84) and well above the measured floor (0). ⚠️ **If CI ever shows a floor of
 * its own, raise this with the measurement in hand** — the number it replaced was set by feel and
 * cost eight days of a header icon nobody could see.
 */
const MAX_DIFF_PIXELS = 24;

/**
 * The curated baseline set, keyed by the walk's own `name` — NOT by its `NN-` filename.
 *
 * ⚠️ Keyed on name ON PURPOSE. `screenshot-states.mjs` numbers its output in capture order, so
 * inserting one shot renumbers every file after it and would show up here as dozens of
 * "regressions" that are nothing of the kind. A name is stable across that.
 *
 * ⚠️ Curated, not all 54. These are PNGs in git history forever; the full set is ~14 MB per
 * blessing and every re-bless adds another copy. This is the set where a regression would
 * actually be caught — every tab in both its empty and populated state, the chrome, the card
 * shapes, and the two densest forms. Add a screen when a defect is found on one that is not
 * here; that is the ratchet.
 */
const BASELINE_SET = [
  // Every tab, empty AND populated. The empty ones matter most: this app puts real teaching
  // content where a blank list would be, so "empty" is a designed screen, not an absence.
  'home-empty',
  'home-populated',
  'plans-empty',
  'plans-today-populated',
  // ⚠️ `habits-empty` was here and is now in MACHINE_DEPENDENT below — read that entry
  // before putting it back.
  'habits-populated',
  'notes-empty',
  'notes-populated',
  'shopping-empty',
  'shopping-populated',
  'shopping-monthly',
  'health-empty',
  'health-medicine-tray',
  'health-dose-logged',
  // Settings — all three tabs. `settings-general` is where the tab-slider centring defect
  // lives, so this is the shot that should have caught it.
  'settings-general',
  'settings-personal',
  'settings-advanced',
  // The densest surfaces, where horizontal and vertical pressure are highest.
  'health-form',
  'medicine-form',
  'catalogue',
  'quick-add-focused-empty',
  // Added 2026-08-30 once the walk could reach them. `task-editor` is the densest form in the
  // app and the one that produced the sliced-microphone bug — the single most valuable shot in
  // this set, and it was missing from it until now.
  'task-editor',
  'goals-drawer',
];

/**
 * Screens this set WANTS and the walk does not currently produce.
 *
 * ⚠️ These are **pre-existing breakage**, not something this gate introduced, and they are
 * listed rather than quietly dropped because a coverage gap nobody can see is how the other two
 * audits in this repo rotted (AGENTS.md records `wraps` un-measuring two whole tabs for days,
 * and `halos` reporting a contented "0 clipped" while looking at 4 fields instead of 14).
 *
 * Each is a pushed-sub-screen excursion whose locator has gone stale. They are printed on every
 * run so the number is in front of whoever reads the output. Move one into BASELINE_SET the
 * moment its excursion is repaired — that is the ratchet, and it only goes one way.
 */
const WANTED_BUT_UNCAPTURED = [
  ['day-log-screen', 'the walk’s `day-log` excursion times out — Earlier days is a SECTION inside To-do’s Today card since 2026-08-26, and retargeting the tab was not enough'],
  ['shopping-list-expanded-empty', 'needs a list created first; the `food` excursion above it times out for a related reason'],
];

/**
 * Screens the walk DOES produce, stably, that two machines nonetheless disagree about.
 *
 * ⚠️ **A different thing from the list above, and the distinction is the point.** Those are not
 * captured at all. These are captured perfectly and reproducibly — and the picture this machine
 * settles on is not the picture the CI runner settles on, so whichever one blesses the baseline
 * makes the other permanently red. Keeping such a screen in the set does not buy coverage; it
 * buys a standing red that trains whoever reads this output to re-bless on reflex, which is the
 * one failure mode `--update`'s whole warning is about.
 *
 * `habits-empty` (2026-08-30) is the only member, and it was chased properly before landing
 * here. Its differing pixels sit on the TabSlider's own sliding pill. On this machine it is a
 * settle race that converges — **374 px at 1100 ms → 73 at 2600 → 0 at 4200** — so a tuned wait
 * fixed it locally and CI came back with exactly the 73 px the 2600 ms run had produced.
 * Replacing the wait with a predicate (`settle()` in the screenshot walk, which is the right fix
 * regardless and stays) made CI's frame *stable* at that same 73 px. So it is not a race there:
 * the pill has two stable resting positions a fraction of a pixel apart, and the two machines
 * pick different ones.
 *
 * The alternative was raising the pixel budget past 73 — which is 11 px under the 84 that one
 * header icon costs, i.e. re-opening precisely the blind spot this gate had just closed. One
 * screen is the cheaper loss, and it is not a coverage hole: `habits-populated` shoots the same
 * surface with content and is stable on both machines.
 *
 * Fix it by making the pill's resting position not depend on animation timing, then move the
 * name back into BASELINE_SET and bless. Do NOT resolve it by raising MAX_DIFF_PIXELS.
 */
const MACHINE_DEPENDENT = [
  ['habits-empty', 'the TabSlider pill settles 73 px differently here and on CI — see this constant’s note; do not fix by raising the pixel budget'],
];

function log(...m) {
  console.log(...m);
}

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

function capture() {
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  fs.mkdirSync(WORK_DIR, { recursive: true });
  log(`> capturing (${THEME}) …`);
  execFileSync(
    'node',
    [
      path.join(ROOT, 'scripts', 'screenshot-states.mjs'),
      WORK_DIR,
      `--theme=${THEME}`,
      // Always deterministic: NarratorQuote picks a random line on mount and several surfaces
      // print the current date, so without this every run differs for reasons that are not the
      // app changing. See freezeNondeterminism in that file.
      '--deterministic',
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
}

/** name → absolute png path, from the walk's own index.json. */
function capturedByName() {
  const indexPath = path.join(WORK_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.error(`visual-diff: no index.json in ${WORK_DIR} — the capture produced nothing.`);
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const byName = new Map();
  for (const e of entries) {
    if (e.theme !== THEME) continue;
    byName.set(e.name, path.join(WORK_DIR, e.file));
  }
  return byName;
}

// ---------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

/** One screen's verdict: 'ok' | 'changed' | 'size' | 'missing-baseline' | 'missing-shot'. */
function compareOne(name, shotPath) {
  const basePath = path.join(BASELINE_DIR, `${name}.png`);
  if (!fs.existsSync(basePath)) return { name, status: 'missing-baseline' };

  const shot = readPng(shotPath);
  const base = readPng(basePath);

  // A size change is a real finding in its own right and pixelmatch cannot express it — it
  // throws on mismatched dimensions. Report it rather than crashing the run.
  if (shot.width !== base.width || shot.height !== base.height) {
    return {
      name,
      status: 'size',
      detail: `${base.width}×${base.height} → ${shot.width}×${shot.height}`,
    };
  }

  const diff = new PNG({ width: shot.width, height: shot.height });
  const changed = pixelmatch(base.data, shot.data, diff.data, shot.width, shot.height, {
    threshold: PIXEL_THRESHOLD,
    includeAA: false,
  });
  const ratio = changed / (shot.width * shot.height);
  if (changed <= MAX_DIFF_PIXELS) return { name, status: 'ok', changed, ratio };

  fs.mkdirSync(DIFF_DIR, { recursive: true });
  const diffPath = path.join(DIFF_DIR, `${name}.diff.png`);
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  // Copy both sides next to the diff — a diff mask alone does not tell you which way it went.
  fs.copyFileSync(basePath, path.join(DIFF_DIR, `${name}.expected.png`));
  fs.copyFileSync(shotPath, path.join(DIFF_DIR, `${name}.actual.png`));
  return { name, status: 'changed', changed, ratio, diffPath };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

capture();
const captured = capturedByName();

if (UPDATE) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  let written = 0;
  const absent = [];
  for (const name of BASELINE_SET) {
    const shot = captured.get(name);
    if (!shot) {
      absent.push(name);
      continue;
    }
    fs.copyFileSync(shot, path.join(BASELINE_DIR, `${name}.png`));
    written += 1;
  }
  log(`\nvisual-diff: blessed ${written}/${BASELINE_SET.length} baselines into visual-baselines/${THEME}/`);
  if (absent.length) {
    // Refuse to bless a partial set silently. A name in BASELINE_SET that the walk no longer
    // produces is exactly the "audit un-measures instead of failing" shape this repo keeps
    // getting bitten by — see AGENTS.md on `wraps` and `halos`.
    console.error(
      `\nvisual-diff: ${absent.length} name(s) in BASELINE_SET were not produced by the walk:\n` +
        absent.map((n) => `  · ${n}`).join('\n') +
        `\nEither the walk no longer captures them (fix the walk) or they were renamed ` +
        `(fix BASELINE_SET). Blessing a partial set is how coverage rots.`,
    );
    process.exit(1);
  }
  process.exit(0);
}

const results = BASELINE_SET.map((name) => {
  const shot = captured.get(name);
  if (!shot) return { name, status: 'missing-shot' };
  return compareOne(name, shot);
});

const ok = results.filter((r) => r.status === 'ok');
const changed = results.filter((r) => r.status === 'changed' || r.status === 'size');
const missingBaseline = results.filter((r) => r.status === 'missing-baseline');
const missingShot = results.filter((r) => r.status === 'missing-shot');

log(`\n── visual diff (${THEME}) ──────────────────────────────────`);
if (WANTED_BUT_UNCAPTURED.length) {
  log(`  coverage gap     ${WANTED_BUT_UNCAPTURED.length} screen(s) this set wants and the walk does not produce:`);
  for (const [name, why] of WANTED_BUT_UNCAPTURED) log(`                     · ${name} — ${why}`);
}
if (MACHINE_DEPENDENT.length) {
  log(`  not comparable   ${MACHINE_DEPENDENT.length} screen(s) captured but excluded — two machines settle differently:`);
  for (const [name, why] of MACHINE_DEPENDENT) log(`                     · ${name} — ${why}`);
}
log(`  unchanged        ${ok.length}/${BASELINE_SET.length}`);
log(`  changed          ${changed.length}`);
log(`  no baseline yet  ${missingBaseline.length}`);
log(`  not captured     ${missingShot.length}`);

for (const r of changed) {
  if (r.status === 'size') log(`\n  [size]    ${r.name} — ${r.detail}`);
  else log(`\n  [changed] ${r.name} — ${r.changed} px (${(r.ratio * 100).toFixed(3)}%)`);
}
if (changed.length) {
  log(`\n  Diffs, expected and actual written to visual-diff-out/${THEME}/`);
  log('  If the change is intended: look at each diff, then `npm run visual -- --update`');
  log('  in its own commit. Do not re-bless to make a red run go green.');
}
for (const r of missingShot) log(`\n  [not captured] ${r.name} — the walk did not produce this shot`);
for (const r of missingBaseline) log(`\n  [no baseline]  ${r.name} — run with --update to bless it`);

// `missingShot` fails: a screen that silently stops being captured is the failure mode this
// repo has hit twice already with the other audits, and it looks identical to a pass.
const failed = changed.length + missingShot.length + missingBaseline.length;
if (failed) {
  console.error(`\nvisual-diff: ${failed} finding(s).`);
  process.exit(1);
}
log('\nvisual-diff: clean ✓');
