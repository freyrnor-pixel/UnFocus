/**
 * paintWarmup.test.ts — the warm-up must draw the paints the app actually draws, then get out.
 *
 * **The one way this component can rot, and it is silent.** `PaintWarmup` exists to make Skia
 * compile the app's blurred shadows and pane gradient at launch instead of on the first swipe. If
 * it ever warms a *different* paint than `Surface` draws — a blur radius that drifted, a gradient
 * key the platform does not read, a tier nobody uses — it compiles something the app never needs,
 * the first swipe stays cold, and **nothing anywhere looks wrong.** That is this repo's documented
 * failure class twice over: the silently-constant boolean (`CLAUDE.md` A2) and the widget-preview
 * drift that `scripts/build-widget-previews.mjs` now guards with "extract, never copy".
 *
 * So the assertions here are about AGREEMENT between two files, not about the presence of code:
 *   · every tier the warm-up names is a real `getLayeredShadow` tier, and it covers the ones
 *     `Surface` can ask for;
 *   · the values it warms are the ones `getLayeredShadow`/`getGlassPane` return for the live
 *     theme — byte for byte, not merely "a shadow";
 *   · the alpha is non-zero, because Android skips drawing a view at alpha 0 and the whole
 *     component would be a no-op;
 *   · it stops rendering after its frames are up, so it costs nothing at rest.
 *
 * ⚠️ **What no test here can check:** whether warming actually removes the first-swipe cost.
 * `renderToHardwareTextureAndroid` is a no-op everywhere a harness can run and Skia's program
 * cache is invisible to all of them. That claim stays `unverified` until the device answers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getGlassPane, getLayeredShadow } from '../../constants/theme';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const warmup = read('components/PaintWarmup.tsx');
const surface = read('components/Surface.tsx');
const layout = read('app/(tabs)/_layout.tsx');
/** The callers that still draw a BLURRED boxShadow, now that Surface uses `elevation`. */
const header = read('components/ScreenHeader.tsx');
const expandHost = read('components/CardExpandHost.tsx');
/** Source with comments stripped — this component explains itself at length in its header. */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('PaintWarmup warms the paints the app really draws', () => {
  it('names only real shadow tiers', () => {
    const tiers = (codeOnly(warmup).match(/WARM_TIERS = \[([^\]]+)\]/)?.[1] ?? '')
      .split(',')
      .map((t) => t.trim().replace(/['"]/g, ''))
      .filter(Boolean);
    expect(tiers.length).toBeGreaterThan(0);
    // A tier that getLayeredShadow does not know would throw or silently return the default,
    // warming `raised` three times and leaving the other two cold.
    for (const tier of tiers) {
      expect(() => getLayeredShadow('#000', tier as never)).not.toThrow();
    }
  });

  it('covers every tier a REMAINING getLayeredShadow caller draws', () => {
    // ⚠️ **Repointed 2026-09-17, and the rename is the point.** This used to read "every tier
    // Surface can ask for" — and it kept PASSING after `Surface` moved to `elevation`, because
    // `shadowLevel` is still computed there and still names all three tiers. A green assertion
    // about a shadow the app had stopped drawing is the exact green-but-stale shape this repo
    // renamed the 'ONE flat fill' block to avoid, so the source of truth moves with the code.
    const callers = [header, expandHost].map(codeOnly).join('\n');
    const asked = new Set(
      [...callers.matchAll(/getLayeredShadow\([^,]+,\s*'(\w+)'\)/g)].map((m) => m[1])
    );
    // The vacuity guard, kept from the original: if the extraction stops finding callers this
    // fails loudly instead of the loop below running zero times.
    expect([...asked].sort()).toEqual(['chrome', 'floating']);

    const warmed = new Set(
      (codeOnly(warmup).match(/WARM_TIERS = \[([^\]]+)\]/)?.[1] ?? '')
        .split(',')
        .map((t) => t.trim().replace(/['"]/g, ''))
        .filter(Boolean)
    );
    for (const tier of asked) {
      const wanted = JSON.stringify(getLayeredShadow('#000', tier as never));
      const covered = [...warmed].some(
        (w) => JSON.stringify(getLayeredShadow('#000', w as never)) === wanted
      );
      expect(covered).toBe(true);
    }
  });

  it('warms nothing the app has stopped drawing', () => {
    // The other half of the same rule. `Surface` is where ~20 of the app's 21 shadow casters
    // live; it draws `elevation` now, so a `raised` blur has no caller and warming it would be
    // dead work. If Surface ever goes back to a layered shadow, this fails and says so — which
    // is the signal to put `raised` back on WARM_TIERS.
    expect(codeOnly(surface)).not.toMatch(/getLayeredShadow\(/);
    const warmed = (codeOnly(warmup).match(/WARM_TIERS = \[([^\]]+)\]/)?.[1] ?? '');
    expect(warmed).not.toMatch(/raised/);
  });

  it('builds its shadow and pane from the shared helpers, not transcribed values', () => {
    const code = codeOnly(warmup);
    // The whole point: same functions, same arguments as Surface. A literal rgba/px string here
    // would be a value that can drift from the card's without either file looking wrong.
    expect(code).toMatch(/getLayeredShadow\(theme\.shadow,\s*tier\)/);
    expect(code).toMatch(/getGlassPane\(\s*theme\.glassTop,\s*theme\.glassBottom,\s*theme\.glassRim,\s*theme\.glassWell\s*\)/);
    expect(code).not.toMatch(/boxShadow:\s*['"`]/);
    expect(code).not.toMatch(/linear-gradient\(/);
  });

  it('spells the gradient key the same way Surface does on each platform', () => {
    // RN 0.85 reads `experimental_backgroundImage`; react-native-web reads `backgroundImage`.
    // Warming the wrong key compiles no shader at all — and looks identical in the diff.
    const key = /Platform\.OS === 'web' \? 'backgroundImage' : 'experimental_backgroundImage'/;
    expect(codeOnly(surface)).toMatch(key);
    expect(codeOnly(warmup)).toMatch(key);
  });

  it('applies the pane insets as their own pass, like Surface does', () => {
    // Surface puts the drop shadow on the outer view and the rim/well insets on the inner mask.
    // Merged into one boxShadow they would be a paint the app never draws.
    expect(codeOnly(warmup)).toMatch(/boxShadow:\s*pane\.insets/);
    expect(codeOnly(surface)).toMatch(/boxShadow:\s*pane\.insets/);
  });

  it('produces a pane whose gradient is the one getGlassPane returns', () => {
    // Evaluate rather than grep: the helper is the source of truth, so this pins that the
    // warm-up's inputs produce a real gradient string and two inset layers.
    const pane = getGlassPane('#202028', '#16161c', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.20)');
    expect(pane.image).toContain('linear-gradient(155deg');
    expect(pane.insets).toHaveLength(2);
    expect(pane.insets.every((i) => i.inset)).toBe(true);
  });
});

describe('PaintWarmup costs a launch and nothing after it', () => {
  const code = codeOnly(warmup);

  it('draws at a non-zero alpha', () => {
    const alpha = Number(code.match(/WARM_ALPHA = ([\d.]+)/)?.[1]);
    // Android skips drawing a view at alpha 0 — at 0 this component compiles nothing at all.
    expect(alpha).toBeGreaterThan(0);
    // And low enough that it cannot read as a visible artefact if it were ever exposed.
    expect(alpha).toBeLessThan(0.05);
  });

  it('returns null once its frames are up', () => {
    expect(code).toMatch(/if \(done\) return null;/);
  });

  it('counts frames rather than milliseconds', () => {
    expect(code).toMatch(/requestAnimationFrame/);
    expect(code).not.toMatch(/setTimeout/);
  });

  it('cancels its frame on unmount', () => {
    expect(code).toMatch(/cancelAnimationFrame\(raf\)/);
  });

  it('forces the layer promotion the texture pool warms from', () => {
    expect(code).toMatch(/renderToHardwareTextureAndroid/);
  });
});

describe('PaintWarmup is mounted where it cannot be seen', () => {
  it('sits in the tabs backdrop group before ScreenBackground paints over it', () => {
    const code = codeOnly(layout);
    const warm = code.indexOf('<PaintWarmup />');
    const bg = code.indexOf('<ScreenBackground');
    expect(warm).toBeGreaterThan(-1);
    expect(bg).toBeGreaterThan(-1);
    // Order is the invisibility mechanism: drawn first, then covered on the same frame.
    expect(warm).toBeLessThan(bg);
  });

  it('is mounted exactly once', () => {
    expect(codeOnly(layout).match(/<PaintWarmup\s*\/>/g) ?? []).toHaveLength(1);
  });
});
