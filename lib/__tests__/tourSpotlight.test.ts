/**
 * tourSpotlight.test.ts — the guided tour's hole geometry, and the two things about it that
 * are invisible to every other check in this repo.
 *
 * Both halves of this file exist because of the same 2026-08-14 real-device report: five
 * screenshots of the tour, every step ringing the wrong thing. Two independent bugs, and
 * NEITHER was reachable by tsc, by the Jest suite as it stood, or by `npm run preview` —
 * the second one was reproducible in the web preview but nothing was looking, and the first
 * one cannot appear there at all.
 */
import fs from 'fs';
import path from 'path';
import {
  HOLE_PAD,
  MIN_BAND_RATIO,
  RING_GAP,
  coachCardBox,
  hasHole,
  spotlightHole,
  spotlightRing,
  type CoachCardBox,
} from '@/lib/tourSpotlight';

// A phone-shaped screen with the tab chrome's real footprint: a header card down to y=79 and
// a floating nav block 80 tall at the bottom.
const SCREEN = { width: 393, height: 852 };
const BAND = { top: 79, bottom: 80 };
/** The bottom edge of the strip where a tab screen's own content is what you can see. */
const CONTENT_BOTTOM = SCREEN.height - BAND.bottom; // 772

describe('spotlightHole', () => {
  it('pads a comfortably-placed target on all four sides', () => {
    const hole = spotlightHole({ x: 16, y: 200, width: 361, height: 300 }, SCREEN, BAND);
    expect(hole).toEqual({
      x: 16 - HOLE_PAD,
      y: 200 - HOLE_PAD,
      w: 361 + HOLE_PAD * 2,
      h: 300 + HOLE_PAD * 2,
    });
  });

  // The Home step, which is what the report's first screenshot showed: the day-view card is
  // taller than the visible band, so an un-clamped hole ran into the bottom nav and left the
  // bar lit at full brightness with the ring cutting across it.
  it('never cuts a hole into the bottom nav, however tall the target is', () => {
    const hole = spotlightHole({ x: 16, y: 490, width: 361, height: 400 }, SCREEN, BAND);
    expect(hole.y + hole.h).toBe(CONTENT_BOTTOM);
    expect(hole.y).toBe(490 - HOLE_PAD);
  });

  it('never cuts a hole into the header band', () => {
    // The Shopping step: the sticky tab bar sits directly under the header, so its HOLE_PAD
    // would otherwise land on the header card.
    const hole = spotlightHole({ x: 8, y: 79, width: 377, height: 46 }, SCREEN, BAND);
    expect(hole.y).toBe(BAND.top);
    expect(hole.y + hole.h).toBe(79 + 46 + HOLE_PAD);
  });

  it('never overhangs the screen edges', () => {
    const hole = spotlightHole({ x: 0, y: 200, width: SCREEN.width, height: 46 }, SCREEN, BAND);
    expect(hole.x).toBe(0);
    expect(hole.x + hole.w).toBe(SCREEN.width);
  });

  // A target the user has scrolled behind the chrome. The caller draws a plain full-screen
  // scrim for this and keeps the coach card, so the step stays advanceable — a NEGATIVE size
  // here would instead lay the dim rects out inside out.
  it('collapses to zero rather than going negative when the target is fully clipped', () => {
    const above = spotlightHole({ x: 16, y: -400, width: 361, height: 200 }, SCREEN, BAND);
    expect(above.h).toBe(0);
    expect(hasHole(above)).toBe(false);

    const below = spotlightHole({ x: 16, y: 900, width: 361, height: 200 }, SCREEN, BAND);
    expect(below.h).toBe(0);
    expect(hasHole(below)).toBe(false);
  });

  it('reports a hole whenever any of the target is visible', () => {
    expect(hasHole(spotlightHole({ x: 16, y: 200, width: 361, height: 300 }, SCREEN, BAND))).toBe(true);
  });
});

describe('spotlightRing', () => {
  it('sits RING_GAP outside a comfortably-placed hole', () => {
    const hole = spotlightHole({ x: 16, y: 200, width: 361, height: 300 }, SCREEN, BAND);
    const ring = spotlightRing(hole, SCREEN, BAND);
    expect(ring).toEqual({
      x: hole.x - RING_GAP,
      y: hole.y - RING_GAP,
      w: hole.w + RING_GAP * 2,
      h: hole.h + RING_GAP * 2,
    });
  });

  // The ring is the VISIBLE edge, so clamping the hole and not the ring would still draw an
  // accent line across the chrome — the exact artifact the clamp exists to remove.
  it('respects the same band the hole does', () => {
    // Tall enough to be clipped at BOTH ends, and full-bleed so the sides clamp too.
    const hole = spotlightHole({ x: 0, y: 79, width: SCREEN.width, height: 800 }, SCREEN, BAND);
    const ring = spotlightRing(hole, SCREEN, BAND);
    expect(ring.y).toBe(BAND.top);
    expect(ring.y + ring.h).toBe(CONTENT_BOTTOM);
    expect(ring.x).toBeGreaterThanOrEqual(0);
    expect(ring.x + ring.w).toBeLessThanOrEqual(SCREEN.width);
  });
});

/**
 * **The coordinate-space guard.** A target's rect and the overlay's own origin have to be
 * measured the SAME way, because the spotlight subtracts one from the other. Break the pairing
 * and the tour points at the wrong thing on one platform while looking perfect on the others,
 * which is exactly what shipped: `measureInWindow` alone put every hole one status bar too high
 * on Android, because Fabric folds `includeViewportOffset` into "window"
 * (ReactCommon/react/renderer/dom/DOM.cpp) and on Android that offset is
 * `rootView.getLocationInWindow() − getWindowVisibleDisplayFrame().top`
 * (uimanager/RootViewUtil.kt) — i.e. `−statusBarHeight` under the edge-to-edge window Expo
 * enforces, while the scrim is an absoluteFill in ROOT coordinates.
 *
 * `measure()`'s root-relative pageX/pageY are the tempting one-line "fix" and are a trap in the
 * other direction: correct on native, wrong on web, where react-native-web implements `measure`
 * as an `offsetParent` walk that never subtracts the pager's scrollLeft. Taking it silently
 * stopped the tour rendering in `npm run preview` at all. Hence the pairing, and hence this
 * test — a source scan, like lib/__tests__/episodes.test.ts and __tests__/workletSafety.test.ts,
 * because nothing else in the repo can see it: a typecheck passes either way, and the web
 * preview renders the Android bug perfectly.
 */
describe('the tour measures both ends of its subtraction the same way', () => {
  const read = (file: string) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'components', file), 'utf8');
    // Comments name both traps, so scan code only.
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
  };
  const target = read('TourTarget.tsx');
  const spotlight = read('TourSpotlight.tsx');

  it('measures targets with measureInWindow', () => {
    expect(target).toMatch(/\.measureInWindow\(/);
  });

  it('does not measure targets with measure(), which disagrees with it on web', () => {
    expect(target).not.toMatch(/\.measure\(/);
  });

  it('measures the overlay origin the same way, and subtracts it', () => {
    expect(spotlight).toMatch(/overlayRef\.current\?\.measureInWindow\(/);
    expect(spotlight).toMatch(/-\s*origin\.x/);
    expect(spotlight).toMatch(/-\s*origin\.y/);
  });
});

/**
 * coachCardBox — the placement that replaced `CARD_RESERVE = 260`.
 *
 * The property under test is not a set of numbers, it is an INVARIANT: whatever the hole and
 * whatever the screen, the band this returns lies inside the safe area. That is the thing the
 * fixed reserve could not promise, and the four viewports in the last block are the measured
 * counter-examples it shipped — each one a real Android size smaller than the 430×932 every
 * harness in this repo runs at, which is why nothing here caught it for a month.
 */
describe('coachCardBox', () => {
  const SAFE = { top: 8, bottom: 8 };
  const GAP = 16;

  /** Resolve a returned band to the [top, bottom] strip the card may actually occupy. */
  function strip(box: CoachCardBox, screenHeight: number) {
    return box.edge === 'top'
      ? { top: box.top, bottom: box.top + box.maxHeight }
      : { top: screenHeight - box.bottom - box.maxHeight, bottom: screenHeight - box.bottom };
  }

  it('hangs below a target near the top, stopping at the bottom safe edge', () => {
    const box = coachCardBox({ x: 0, y: 60, w: 393, h: 200 }, SCREEN, SAFE, GAP);
    expect(box).toEqual({ edge: 'top', top: 260 + GAP, maxHeight: SCREEN.height - SAFE.bottom - 260 - GAP });
  });

  it('hangs above a target near the bottom, stopping at the top safe edge', () => {
    const box = coachCardBox({ x: 0, y: 500, w: 393, h: 300 }, SCREEN, SAFE, GAP);
    expect(box).toEqual({ edge: 'bottom', bottom: SCREEN.height - (500 - GAP), maxHeight: 500 - GAP - SAFE.top });
  });

  it('picks the side with more room', () => {
    // 300 above, 252 below → above wins, and the anchor says so.
    expect(coachCardBox({ x: 0, y: 316, w: 393, h: 268 }, SCREEN, SAFE, GAP).edge).toBe('bottom');
  });

  it('gives up on sitting beside a tall target and takes the whole safe band', () => {
    // A 566-tall hole on a 740 screen: 47 above, 111 below, neither a usable band.
    const screen = { width: 360, height: 740 };
    const box = coachCardBox({ x: 0, y: 71, w: 360, h: 546 }, screen, SAFE, GAP);
    expect(box).toEqual({ edge: 'bottom', bottom: SAFE.bottom, maxHeight: screen.height - SAFE.top - SAFE.bottom });
  });

  /**
   * The regression itself. Each row is a hole measured in the web preview on a real Android
   * viewport, with the card height the old code then drew off the screen. Asserting the BAND
   * rather than a position is the point: the card is no longer allowed to be taller than the
   * room it has, so "does it fit" stops depending on how much copy the step happens to carry.
   */
  it.each([
    ['360x640 step 1', { width: 360, height: 640 }, { x: 4, y: 279, w: 352, h: 290 }],
    ['360x640 step 3', { width: 360, height: 640 }, { x: 4, y: 71, w: 352, h: 498 }],
    ['360x740 step 3', { width: 360, height: 740 }, { x: 4, y: 71, w: 352, h: 546 }],
    ['384x854 step 3', { width: 384, height: 854 }, { x: 4, y: 71, w: 376, h: 546 }],
    ['412x915 step 3', { width: 412, height: 915 }, { x: 4, y: 71, w: 404, h: 546 }],
  ])('keeps the card inside the safe area on %s', (_label, screen, hole) => {
    const box = coachCardBox(hole, screen, SAFE, GAP);
    const { top, bottom } = strip(box, screen.height);
    expect(top).toBeGreaterThanOrEqual(SAFE.top);
    expect(bottom).toBeLessThanOrEqual(screen.height - SAFE.bottom);
    // And a band worth having: a card squeezed to nothing is off-screen by another name.
    expect(box.maxHeight).toBeGreaterThanOrEqual(screen.height * MIN_BAND_RATIO);
  });
});
