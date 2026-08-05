/**
 * tourFocus.test.ts — regression guard for the tour spotlight's "ring drifts off its card" bug
 * (2026-08-05, PR #498).
 *
 * The bug: a target's rect is measured on mount/focus/onLayout, and none of those fire when
 * something ABOVE the target resizes and pushes it down — e.g. a Collapsible reveal animating
 * its height from a Reanimated worklet, which moves every sibling below it with no layout pass
 * of their own. The fix is components/TourTarget.tsx registering each mounted target's
 * measure() function so components/TourSpotlight.tsx can poll all of them on a cadence for as
 * long as a step is showing — see both files' doc comments for the full story.
 *
 * **Why a source scan and not a render test.** This suite runs with `testEnvironment: 'node'`
 * and has no component-rendering harness (TESTING.md) — every behavior that's invisible on the
 * web preview or depends on real device/layout timing (episodes' no-notification guarantee,
 * cardLayout's presentation-only guarantee, Button's text-scale clipping fix in
 * lib/__tests__/designTokens.test.ts) is pinned the same way: read the source, assert the
 * mechanism is still there. The web preview genuinely cannot see THIS bug either — a
 * Collapsible's worklet-driven resize doesn't shift anything in the Playwright/RNW render the
 * way it does on device — so a render test wouldn't catch a regression here even if this suite
 * had the infrastructure to write one.
 *
 * What this guards, concretely: someone "simplifying" the cadence back to a one-shot measure on
 * step entry (the exact shape of the original bug), or TourTarget no longer
 * registering/unregistering its measurer, silently reintroduces a ring that sits over blank
 * space until the next manual on-device check happens to catch it.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

/** Strip the leading JSDoc header before scanning — same reasoning as designTokens.test.ts's
 * readCode(): these files document their own constraints in prose, and matching that prose
 * makes "delete the comment" the cheapest way to get green. */
const readCode = (rel: string) => {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  return src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
};

describe('TourSpotlight re-measures its target on a cadence, not just once', () => {
  const src = readCode('components/TourSpotlight.tsx');

  it('imports remeasureTargets from the target registry', () => {
    expect(src).toMatch(
      /import\s*\{[^}]*\bremeasureTargets\b[^}]*\}\s*from\s*'@\/components\/TourTarget'/,
    );
  });

  it('measures immediately AND arms an interval, not an interval alone', () => {
    // Both calls have to exist together: the immediate call catches the common case with no
    // visible delay, the interval catches everything that happens after (async loads, a
    // scroll, the user working the live card the tour deliberately leaves interactive).
    expect(src).toMatch(
      /remeasureTargets\(\);\s*\n\s*const \w+ = setInterval\(remeasureTargets,\s*REMEASURE_INTERVAL\)/,
    );
  });

  it('clears the interval on cleanup', () => {
    expect(src).toMatch(/return \(\) => clearInterval\(\w+\)/);
  });

  it('re-arms the cadence on every step change, not once on mount', () => {
    // A `[]` dependency array here is the exact regression this test exists to catch: it would
    // measure once when the tour starts and never again as the user moves through steps.
    const effect = src.match(
      /useEffect\(\(\) => \{\s*if \(!step\) return;\s*remeasureTargets\(\);[\s\S]*?\}, (\[[^\]]*\])\);/,
    );
    expect(effect).not.toBeNull();
    expect(effect![1]).toBe('[step]');
  });
});

describe('TourTarget registers its measurer where the cadence can reach it', () => {
  const src = readCode('components/TourTarget.tsx');

  it('remeasureTargets() calls every registered measurer', () => {
    expect(src).toMatch(
      /export function remeasureTargets\(\): void \{\s*for \(const \w+ of measurers\.values\(\)\) \w+\(\);\s*\}/,
    );
  });

  it('registers its measure function on mount', () => {
    expect(src).toMatch(/measurers\.set\(id, measure\)/);
  });

  it('unregisters on unmount, so the cadence can never reach a stale target', () => {
    expect(src).toMatch(/measurers\.delete\(id\)/);
  });
});
