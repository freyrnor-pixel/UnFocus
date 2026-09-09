/**
 * collapseMotion.test.ts — the expand/collapse gesture is ONE movement, on one clock.
 *
 * Everything here is invisible to the two harnesses this repo can actually run. A screenshot
 * catches a wrong resting state, never a wrong curve; and `npm run preview` runs Reanimated
 * worklets on the JS thread, so a reveal that hitches on device plays fine there. The whole
 * class of defect the maintainer reported — *"Expanding and collapsing animation does not look
 * smooth"* — is therefore only pinnable by reading the source.
 *
 * Two causes were found, and they are independent:
 *
 *   1. `Collapsible` started its open curve on the same tick it mounted the body, so on a first
 *      expand the clip held at `progress * 0` and then jumped to wherever the curve had already
 *      reached when `onLayout` finally reported a height.
 *   2. `AnimatedChevron` ran on `Duration.control` (150) with `Ease.enter` in both directions
 *      while the body ran 220/200 and eased both ways, so the arrow finished early and, on
 *      close, decelerated while the body accelerated.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Source with comments stripped — both files DESCRIBE the defects at length in their headers. */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Collapsible — the reveal waits for a height', () => {
  const src = codeOnly(read('components/Collapsible.tsx'));

  it('defers an open that has nothing to grow to', () => {
    // The fix in one line: an open with no measurement yet arms a flag instead of starting a
    // curve against 0.
    expect(src).toMatch(/if \(measured\.value > 0\) runOpen\(\);\s*else pendingOpen\.value = true;/);
  });

  it('starts the deferred reveal from the measurement itself', () => {
    // A reaction on the shared value, so the curve begins on the frame the height lands rather
    // than a JS round-trip later.
    expect(src).toMatch(/useAnimatedReaction/);
    expect(src).toMatch(/measured\.value > 0 && pendingOpen\.value/);
  });

  it('keeps the deferred path worklet-safe', () => {
    // `runOpen` is called from an auto-workletized reaction body. A plain JS function there
    // crashes on device and looks perfect in the web preview — see AGENTS.md's Reanimated note.
    // __tests__/workletSafety.test.ts scans the call; this asserts the declaration it relies on.
    expect(src).toMatch(/function runOpen\(\) \{\s*'worklet';/);
  });

  it('animates a height change that arrives while the card is already open', () => {
    expect(src).toMatch(/measured\.value = withTiming\(h,/);
  });

  it('still lands the FIRST measurement instantly', () => {
    // The counter-case, and it is load-bearing: if the first measurement were animated, the
    // deferred reveal above would be waiting on a value that is itself still travelling, and
    // the clip would chase a moving target. Assert the unconditional assignment survives.
    expect(src).toMatch(/^\s*measured\.value = h;$/m);
  });

  it('only animates the resize when already open, measured, and not reduced-motion', () => {
    expect(src).toMatch(/progress\.value === 1 && measured\.value > 0 && !reducedMotion/);
  });
});

describe('Collapsible — the dedupe compares against the TARGET, not the live value', () => {
  const src = codeOnly(read('components/Collapsible.tsx'));

  /**
   * Reported from a device on 2026-09-09, with a screenshot: the Energy card open at the wrong
   * height, its "Sett dagens energi" row sliced by the card's own bottom edge, plus a jitter
   * while opening and closing.
   *
   * `onLayout` guarded with `h === measured.value`, and `measured` is animated by the
   * open-resize branch directly below that guard. Comparing a fresh measurement against a
   * mid-tween value fails in both directions: the tween passing through `h` makes the guard
   * return early so the target is never reached (stuck clipped), and a miss starts a second
   * withTiming on top of the first (stutter).
   */
  it('does not dedupe a new measurement against the animated value', () => {
    expect(src).not.toMatch(/h === measured\.value/);
  });

  it('dedupes against the last requested height instead', () => {
    expect(src).toMatch(/if \(h <= 0 \|\| h === measuredTarget\.value\) return;/);
  });

  it('records the target it just asked for, on every path out of the guard', () => {
    // Both branches below the guard (instant assign, and the animated resize) must be covered by
    // one write, or the next layout pass compares against a stale target and the bug returns in
    // the other direction — a real height change ignored rather than a fake one accepted.
    expect(src).toMatch(/measuredTarget\.value = h;[\s\S]*?if \(progress\.value === 1/);
  });
});

describe('AnimatedChevron — the arrow lands with the body', () => {
  const chevron = codeOnly(read('components/AnimatedChevron.tsx'));
  const collapsible = codeOnly(read('components/Collapsible.tsx'));

  it('uses the card durations, not the control duration', () => {
    expect(chevron).toMatch(/open \? Duration\.card : Duration\.cardOut/);
    expect(chevron).not.toMatch(/Duration\.control/);
  });

  it('eases both ways, like the body does', () => {
    expect(chevron).toMatch(/easing: open \? Ease\.enter : Ease\.exit/);
  });

  it('names the same tokens the body names', () => {
    // The point is that the two agree, not that either is a particular number — `Duration.card`
    // is free to be retuned, and this fails only if one of the pair is changed without the
    // other. Both tokens have to appear on both sides.
    for (const token of ['Duration.card', 'Duration.cardOut', 'Ease.enter', 'Ease.exit']) {
      expect(chevron).toContain(token);
      expect(collapsible).toContain(token);
    }
  });
});
