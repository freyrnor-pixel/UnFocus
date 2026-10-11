/**
 * visualGate.test.ts — the pixel gate's toolchain cannot drift out from under its baselines
 *
 * `npm run visual` compares screenshots against committed PNGs, so it is only as trustworthy as
 * the sameness of the thing that took them. On 2026-08-29 it could not run in CI at all: every
 * one of the 21 baselines came back "changed" by a uniform 0.1-1.05%, on screens the commit had
 * never touched.
 *
 * The cause was a dependency range. `@playwright/test` was `^1.61.1`, so the library drifted
 * forward while the dev environment's pre-installed Chromium stayed at the 1194 build that
 * Playwright **1.56** pins — and CI, installing what the library asked for, rendered text
 * differently from the machine that blessed the baselines.
 *
 * ⚠️ **The browser binary was NOT the variable, and that is worth knowing before "fixing" this
 * again.** Measured: `chromium.executablePath()` resolves to the same `chromium-1194` binary on
 * either library version, and launching it reports the same `141.0.7390.37` — yet re-blessing was
 * still required when the library moved. So it is the LIBRARY that has to be pinned, not the
 * path, and pinning the path (what this repo used to do, in seven copies) actively hid the
 * problem by making the local run look stable while CI diverged.
 *
 * These three assertions are cheap and they close the loop that cost a session:
 *   1. the dependency stays on a `~` range, so a minor bump cannot silently re-break rendering;
 *   2. no script hardcodes a browser revision again;
 *   3. CI actually runs the gate — the whole point of having fixed it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('visual gate — the toolchain is pinned', () => {
  it('@playwright/test is on a ~ range, never ^', () => {
    const pkg = JSON.parse(read('package.json'));
    const range = pkg.devDependencies['@playwright/test'];
    expect(range).toBeDefined();
    // A caret admits a minor bump, and a minor bump moves the bundled browser AND the launch
    // defaults — which is exactly how the baselines and CI came to disagree.
    expect(range.startsWith('^')).toBe(false);
    expect(range.startsWith('~')).toBe(true);
  });

  // Comments are stripped first: these files EXPLAIN the old hardcoded `chromium-1194` path at
  // length, and the history is worth keeping. What must not come back is the number in CODE.
  const codeOf = (p: string) =>
    read(p)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  // Text was rasterised from the machine's fontconfig until 2026-10-11: CI (stock Ubuntu, slight
  // hinting) and the cloud dev image (unhinted since 2026-10-03) disagreed on every glyph edge,
  // so every baseline blessed in one place failed in the other. See CHROMIUM_ARGS's note.
  it('every harness launches Chromium with the shared, machine-independent text flags', () => {
    const args = codeOf('scripts/chromium-path.mjs');
    expect(args).toMatch(/'--font-render-hinting=none'/);
    expect(args).toMatch(/'--disable-lcd-text'/);
    // …and the per-font rules a flag cannot reach: the harness's own fontconfig, loaded at import.
    expect(args).toMatch(/process\.env\.FONTCONFIG_FILE\s*=/);
    const conf = read('scripts/harness-fonts.conf');
    expect(conf).toMatch(/<include ignore_missing="yes">\/etc\/fonts\/fonts\.conf<\/include>/);
    // Same FONTS too: the dev image's system-ui/sans-serif is Inter, CI has none — fallback text
    // rendered in two different typefaces until the generic families were pinned.
    expect(conf).toMatch(/<rejectfont>[\s\S]*Inter[\s\S]*<\/rejectfont>/);
    for (const family of ['sans-serif', 'system-ui']) {
      expect(conf).toMatch(new RegExp(`<family>${family}</family><prefer><family>Liberation Sans</family>`));
    }
    // An XML comment may not contain a double hyphen; fontconfig then drops the WHOLE file.
    for (const comment of conf.match(/<!--[\s\S]*?-->/g) ?? []) {
      expect(comment.slice(4, -3)).not.toMatch(/--/);
    }
    for (const target of ['pattern', 'font']) {
      expect(conf).toMatch(new RegExp(`<match target="${target}">[\\s\\S]*?hintnone[\\s\\S]*?<\\/match>`));
    }
    for (const f of [
      'scripts/measure-geometry.mjs',
      'scripts/measure-halos.mjs',
      'scripts/measure-wraps.mjs',
      'scripts/screenshot-states.mjs',
      'scripts/preview.mjs',
    ]) {
      expect(codeOf(f)).toMatch(/args: CHROMIUM_ARGS/);
    }
  });

  it('no harness hardcodes a Chromium revision', () => {
    // The resolver's whole job is to NOT know a revision — see its header. A number here is a
    // claim about which Playwright the project pins, made in a file that cannot check.
    expect(codeOf('scripts/chromium-path.mjs')).not.toMatch(/chromium-\d+/);
    for (const f of [
      'scripts/measure-geometry.mjs',
      'scripts/measure-halos.mjs',
      'scripts/measure-wraps.mjs',
      'scripts/screenshot-states.mjs',
      'scripts/visual-diff.mjs',
      'scripts/preview.mjs',
    ]) {
      expect(`${f}: ${/chromium-\d+/.test(codeOf(f))}`).toBe(`${f}: false`);
    }
  });

  it('CI runs the pixel gate in both themes', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/npm run visual\b/);
    expect(ci).toMatch(/npm run visual -- --theme=dark/);
    // …and the three machine-independent audits alongside it.
    expect(ci).toMatch(/npm run geometry/);
    expect(ci).toMatch(/npm run wraps/);
    expect(ci).toMatch(/npm run halos/);
  });
});
