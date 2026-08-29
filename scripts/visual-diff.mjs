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
 * ⚠️ **BASELINES ARE ENVIRONMENT-BOUND — this cannot currently run in CI.** Blessed here and
 * compared on a GitHub runner, all 21 screens come back "changed" at 0.1-1.05% each: uniform,
 * on every screen, including ones the commit never touched. The runner installs Chromium v1228
 * where the blessing environment has v1194 pre-installed, and different browser builds rasterise
 * text differently. A baseline is a fact about the machine that took it as well as about the
 * app. So this gate runs where the baselines were blessed, and CI runs the three audits that
 * measure geometry rather than pixels. The options for changing that, with their costs, are in
 * DECISIONS_OPEN.md — do not just raise MAX_DIFF_RATIO past the noise floor, which is exactly
 * where a single-card regression hides.
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
 * How many changed pixels a screen may have before it is a finding, as a FRACTION of the shot.
 *
 * Not zero, and the reason is worth keeping: Chromium's text rasterisation is not bit-identical
 * across runs on the same machine, so a strict 0 makes every run red for reasons that have
 * nothing to do with the app, and a gate that cries wolf gets switched off. 0.0005 of a
 * 430×932 shot is ~200 px — comfortably under a 1px shift of a single line of text (a 200px-wide
 * label moving one pixel dirties ~400), so a real geometry change still fails.
 */
const MAX_DIFF_RATIO = 0.0005;

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
  'habits-empty',
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
  ['task-editor', 'the densest form in the app — needs a seeded task to open'],
  ['goals-drawer', 'Goals became a section inside To-do’s Today card (2026-08-26)'],
  ['day-log-screen', 'Earlier days moved into the same card'],
  ['shopping-list-expanded-empty', 'needs a list created first'],
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
  if (ratio <= MAX_DIFF_RATIO) return { name, status: 'ok', changed, ratio };

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
