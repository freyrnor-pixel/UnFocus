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
