/**
 * tourSpotlight.ts — where the guided tour's hole and focus ring actually go.
 *
 * The pure geometry behind components/TourSpotlight.tsx: given a target's measured rect, the
 * screen size and the band the floating chrome leaves free, work out the un-dimmed hole and the
 * ring around it. Split out of the component for the reason lib/designLabPlace.ts was — a
 * spotlight is drawn by four absolutely-positioned views over a live app, so nothing about it is
 * reachable from a headless test while it lives inline in JSX, and the arithmetic is exactly the
 * part that was wrong.
 *
 * **The clamp is the whole point of this module.** A target's measured rect is its LAYOUT box,
 * which on a tab screen routinely extends past what you can see: content scrolls underneath the
 * floating header and bottom-nav cards and is hidden BY them, because they are opaque (see the
 * `viewportInset` note in components/ScreenScaffold.tsx). Cutting a hole over that part of the
 * rect doesn't reveal the card — it reveals the chrome, at full brightness, with the focus ring
 * drawn across it. Home's to-do card is taller than the band, so that is what shipped
 * (2026-08-14, real-device report; reproduced in the web preview).
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like lib/tourSteps.ts and
 *             lib/cardLayout.ts — no store, no theme, no react-native)
 *   Used by → components/TourSpotlight.tsx, lib/__tests__/tourSpotlight.test.ts
 *   Data    → none
 *
 * Edit notes:
 *   - Keep it dependency-free. The band is passed IN (from ScreenScaffold's `tabChromeBand`)
 *     rather than derived here, so there is still exactly one place that knows where the chrome
 *     is — this module must never grow its own copy of that sum.
 *   - A fully-clipped target yields a zero-size hole rather than a negative one. The caller
 *     draws a plain full-screen scrim in that case and keeps the coach card, so a tour step
 *     whose target has been scrolled behind the chrome is still advanceable.
 *   - **`coachCardBox` returns a BAND, never a height** (2026-09-12). It says which edge the
 *     card hangs from and how much room it may occupy; the card's own content decides how much
 *     of that it uses. That is the property that makes it size-independent — see its docblock.
 */

/** A measured target, in root-view coordinates. Mirrors TourTarget's `TargetRect`. */
export type Rect = { x: number; y: number; width: number; height: number };

/** How much of the screen the floating chrome covers, top and bottom. */
export type ChromeBand = { top: number; bottom: number };

/** A box in root-view coordinates: position plus size. */
export type Box = { x: number; y: number; w: number; h: number };

/** Breathing room between the target's edge and the hole. */
export const HOLE_PAD = 8;

/** How far the focus ring sits outside the hole. */
export const RING_GAP = 4;

function clampBox(
  edges: { left: number; top: number; right: number; bottom: number },
  screen: { width: number; height: number },
  band: ChromeBand,
): Box {
  const left = Math.max(0, edges.left);
  const right = Math.min(screen.width, edges.right);
  const top = Math.max(band.top, edges.top);
  const bottom = Math.min(screen.height - band.bottom, edges.bottom);
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

/**
 * The un-dimmed hole for a target: its rect grown by HOLE_PAD, then clipped to the strip of
 * screen where the target is actually visible.
 */
export function spotlightHole(rect: Rect, screen: { width: number; height: number }, band: ChromeBand): Box {
  return clampBox(
    {
      left: rect.x - HOLE_PAD,
      top: rect.y - HOLE_PAD,
      right: rect.x + rect.width + HOLE_PAD,
      bottom: rect.y + rect.height + HOLE_PAD,
    },
    screen,
    band,
  );
}

/** Is there anything left to light up, or has the target been clipped away entirely? */
export function hasHole(hole: Box): boolean {
  return hole.w > 0 && hole.h > 0;
}

/**
 * The focus ring: RING_GAP outside the hole, under the same clamp. Without the clamp the ring
 * draws its accent line across the header card or the nav bar the hole was just pulled back
 * from — the ring is the visible edge, so it has to respect the same boundary the hole does.
 */
export function spotlightRing(hole: Box, screen: { width: number; height: number }, band: ChromeBand): Box {
  return clampBox(
    {
      left: hole.x - RING_GAP,
      top: hole.y - RING_GAP,
      right: hole.x + hole.w + RING_GAP,
      bottom: hole.y + hole.h + RING_GAP,
    },
    screen,
    band,
  );
}

/**
 * Where the coach card may sit: which edge it hangs from, and the most room it may take.
 *
 * ⚠️ **This replaces a fixed `CARD_RESERVE = 260` guess, which put the card off the screen on
 * every phone smaller than the one the harnesses run at** (2026-09-12, reported from the device
 * as *"the onboarding looks off"*, with the step counter and the top of the title missing).
 * The old placement pinned one edge of the card and then clamped that pin with
 * `height - CARD_RESERVE` — i.e. it asserted the card would be at most 260dp tall. A coach card
 * is a step counter, a title, two or three lines of body copy and a button row, in Norwegian or
 * Icelandic, at the user's chosen font scale: 260 is not a bound, it is one measurement of one
 * card in one language on one screen. Measured across four Android viewports before this change:
 *
 *   360×640  step 1  card top  −12   ·  step 3  card top   −22   (clipped off the top)
 *   360×740  step 1  card top  −12   ·  step 3  card bottom 762   (clipped off the bottom)
 *   384×854                         ·  step 3  card bottom 876   (clipped off the bottom)
 *   412×915  clean — and 430×932, which every harness in this repo runs at, is cleaner still.
 *
 * **The fix is to stop predicting the height.** This returns the band between the hole and the
 * safe area on whichever side has more room, as an anchor plus a `maxHeight`. The card grows
 * from the anchored edge and simply stops at the far one, so it cannot leave the screen at any
 * size, in any language, at any font scale — the caller makes its body scrollable for the case
 * where the copy genuinely needs more room than the band. No number here is a guess about
 * content.
 *
 * When neither side has a usable band (`MIN_BAND_RATIO` of the screen — a tall target on a short
 * phone, which is step 3 at 360×740), the card gives up on sitting beside the hole and anchors
 * to the far safe-area edge with the whole screen to grow into. It then overlays part of the
 * dimmed area, which is honest: there was nowhere else for it to be, and a readable card over
 * the scrim beats a clipped one beside the target.
 */
export type CoachCardBox =
  | { edge: 'top'; top: number; maxHeight: number }
  | { edge: 'bottom'; bottom: number; maxHeight: number };

/**
 * The smallest band, as a fraction of screen height, that still counts as room to put the card
 * beside the hole. A ratio rather than a constant for the same reason the rest of this function
 * measures rather than predicts: what "enough room" means is a property of the screen, and a
 * fixed dp figure is the mistake `CARD_RESERVE` was.
 */
export const MIN_BAND_RATIO = 0.34;

export function coachCardBox(
  hole: Box,
  screen: { width: number; height: number },
  safe: { top: number; bottom: number },
  gap: number,
): CoachCardBox {
  const limitTop = safe.top;
  const limitBottom = screen.height - safe.bottom;

  const bandAbove = Math.max(0, hole.y - gap - limitTop);
  const bandBelow = Math.max(0, limitBottom - (hole.y + hole.h) - gap);
  const below = bandBelow >= bandAbove;
  const band = below ? bandBelow : bandAbove;

  // Enough room beside the hole: hang off the hole's edge and stop at the safe area.
  if (band >= screen.height * MIN_BAND_RATIO) {
    return below
      ? { edge: 'top', top: hole.y + hole.h + gap, maxHeight: band }
      : { edge: 'bottom', bottom: screen.height - (hole.y - gap), maxHeight: band };
  }

  // Nowhere beside it. Anchor to the far safe-area edge — the one the hole is furthest from —
  // and allow the full safe band, so the card is whole and on screen even though it now covers
  // some of the scrim.
  const full = Math.max(0, limitBottom - limitTop);
  return below
    ? { edge: 'bottom', bottom: safe.bottom, maxHeight: full }
    : { edge: 'top', top: safe.top, maxHeight: full };
}
