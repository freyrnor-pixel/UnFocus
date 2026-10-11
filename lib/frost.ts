/**
 * frost.ts — the shared state behind the frosted-glass panes (2026-10-11, V2 build step 3).
 *
 * **What "frost" is here.** The maintainer's mockups draw glass with CSS `backdrop-filter: blur`,
 * which re-blurs whatever is behind a pane every frame. The app tried the native equivalent
 * (`expo-blur`'s `BlurView`) and removed it in September: on device it was the per-frame GPU cost
 * behind the swipe lag. But the thing behind every pane is a FIXED painting
 * (components/TreeBackdrop.tsx), so the blur can be done once, offline:
 * `assets/backdrop/tree-{dark,light}-frost.jpg` is the same painting, Gaussian-blurred. Each pane
 * draws the slice of that image that sits behind it (components/FrostLayer.tsx), and the slice
 * moves as the pane moves. No per-frame blur, no sampling of what is behind — so it also cannot
 * show a card underneath through a sheet, which is what made overlays opaque in August.
 *
 * Two pieces of state make the slice line up:
 *   - `FrostContext` — whether the painting is actually behind this subtree (`enabled`), and the
 *     vertical scroll offset of the screen it scrolls in (`scrollY`, a Reanimated shared value
 *     written from ScreenScaffold's existing `onScroll`, read on the UI thread). A pane with no
 *     provider above it draws no frost — the default is off, so nothing opts in by accident.
 *   - `frostEpoch` — bumped whenever a pane's resting position may have moved without that pane
 *     being laid out again (a card above it expanded, a scroll came to rest). Every FrostLayer
 *     re-measures when it changes.
 *
 * Horizontal position needs neither: pager pages sit whole screen-widths apart, so a pane's
 * x modulo the window width is its on-screen x once its page is showing (see FrostLayer).
 *
 * Connections:
 *   Imports → react, react-native-reanimated (makeMutable, SharedValue type)
 *   Used by → components/FrostLayer.tsx, components/Surface.tsx, components/CardExpandHost.tsx, components/ScreenScaffold.tsx,
 *             app/(tabs)/_layout.tsx (the nav bar's provider)
 *   Data    → none
 */
import { createContext, useContext } from 'react';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

export type FrostState = {
  /** The painted backdrop is drawn behind this subtree, so a pane may frost. */
  enabled: boolean;
  /** Vertical scroll offset of the enclosing screen, or null for fixed chrome. */
  scrollY: SharedValue<number> | null;
};

const OFF: FrostState = { enabled: false, scrollY: null };

export const FrostContext = createContext<FrostState>(OFF);

export function useFrost(): FrostState {
  return useContext(FrostContext);
}

/** Bumped when panes may have moved without re-laying-out; FrostLayer re-measures on change. */
export const frostEpoch = makeMutable(0);

export function bumpFrostEpoch(): void {
  frostEpoch.value = frostEpoch.value + 1;
}

/**
 * True when a test harness asked for the painted backdrop to be left out (see
 * scripts/force-appearance.mjs's `hideBackdropPainting`). Frost is a copy of that painting, so it
 * goes with it.
 */
export function backdropPaintingHidden(): boolean {
  return !!(globalThis as { __unfocusHideBackdropPainting__?: boolean }).__unfocusHideBackdropPainting__;
}

export { shouldFrost } from '@/lib/frostRule';
