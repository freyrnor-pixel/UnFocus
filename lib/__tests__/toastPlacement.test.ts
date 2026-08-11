/**
 * toastPlacement.test.ts — an overlay toast renders OUTSIDE the scroll viewport it belongs to.
 *
 * `components/ConfirmationBanner.tsx` is a plain absolutely-positioned overlay (deliberately
 * NOT a `<Modal>` like the sheets around it), anchored at `top: insets.top + Spacing.sm`. That
 * only means "near the top of the SCREEN" while it is a sibling of `ScreenScaffold`. Nested in
 * the scaffold's children it lands inside the internal ScrollView instead, and three things go
 * wrong at once:
 *
 *   1. It scrolls away with the content, which is the reason app/(tabs)/shopping.tsx's header
 *      has spelled out the sibling rule since long before this test existed.
 *   2. Its `top` is then measured from the scroll content rather than the screen, so the safe
 *      area is counted twice.
 *   3. Since the 2026-08-10 chrome-clipping pass, `ScreenScaffold`'s `styles.viewport` is an
 *      `overflow: 'hidden'` box whose top edge sits on the header card — so the toast is
 *      physically clipped at the header rather than merely misplaced.
 *
 * (3) is what turned a latent bug into a visible one, and it was live on app/health-form.tsx —
 * the single screen whose save path delays navigation ~900ms *specifically* so the toast can be
 * read. Four of the five callers were already correct; nothing was checking the fifth.
 *
 * This is a source scan for the same reason lib/__tests__/chromeRhythm.test.ts is one: the bug
 * is pure JSX nesting inside a Reanimated overlay, invisible to a shape test and invisible in a
 * screenshot until it is already wrong. Precedent: cardLayout.test.ts, chromeRhythm.test.ts.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

/** Source with comments stripped — the headers deliberately quote the bad shape to warn about it. */
const code = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Every .tsx under app/ and components/, recursively. */
function screenFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.tsx')) out.push(rel);
    }
  };
  walk('app');
  walk('components');
  return out;
}

describe('ConfirmationBanner sits outside the clipped scroll viewport', () => {
  const callers = screenFiles().filter((f) => {
    const src = code(f);
    return f !== 'components/ConfirmationBanner.tsx' && /<ConfirmationBanner\b/.test(src);
  });

  it('finds the call sites (guards against the scan silently matching nothing)', () => {
    // If a rename makes this list empty, every assertion below passes vacuously.
    expect(callers.length).toBeGreaterThanOrEqual(4);
  });

  it.each(callers)('%s renders it as a sibling of ScreenScaffold, not a child', (file) => {
    const src = code(file);
    // A caller that doesn't mount ScreenScaffold at all has no viewport to escape.
    if (!/<ScreenScaffold\b/.test(src)) return;

    const close = src.lastIndexOf('</ScreenScaffold>');
    expect(close).toBeGreaterThan(-1);

    // Every <ConfirmationBanner> must appear AFTER the scaffold closes. `lastIndexOf` is the
    // right anchor: a screen may mount the scaffold once, and the toast belongs past its end.
    const positions: number[] = [];
    const re = /<ConfirmationBanner\b/g;
    for (let m = re.exec(src); m; m = re.exec(src)) positions.push(m.index);

    expect(positions.length).toBeGreaterThan(0);
    for (const at of positions) {
      expect(at).toBeGreaterThan(close);
    }
  });
});

describe('the anchor the sibling rule protects', () => {
  const banner = code('components/ConfirmationBanner.tsx');

  it('is absolutely positioned against the screen top, not the scroll content', () => {
    // `top: insets.top + …` is only "the top of the screen" outside the viewport. If this ever
    // becomes a bottom anchor, the sibling rule above still holds but this test should be
    // re-read rather than deleted — see the note below about why it stays top-anchored.
    expect(banner).toMatch(/top:\s*insets\.top/);
    expect(banner).toMatch(/position:\s*'absolute'/);
  });

  it('is not a Modal — a Modal would escape the clip on its own and need no rule', () => {
    expect(banner).not.toMatch(/<Modal\b/);
  });
});
