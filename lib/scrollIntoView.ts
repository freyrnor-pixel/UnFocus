/**
 * scrollIntoView.ts — the context a text field uses to ask its nearest scroll surface to lift it
 * above the keyboard. Lives here rather than in components/ScreenScaffold.tsx (which re-exports
 * it, so older imports keep working) because more than one surface provides it now and
 * components/FormControls.tsx consumes it — importing ScreenScaffold from there would drag the
 * whole scaffold into an import cycle.
 *
 * Connections:
 *   Imports → react
 *   Used by → components/ScreenScaffold.tsx (provider + re-export),
 *             components/KeyboardAwareScrollView.tsx (provider), lib/useKeyboardLift.ts,
 *             lib/useKeyboardAwareScroll.ts, components/AddRow.tsx / PadTypeRow.tsx (via the
 *             ScreenScaffold re-export)
 *   Data    → none
 */
import React from 'react';

/** A host component ref that can be measured in window coordinates. */
export type Measurable = {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

/**
 * Scrolls a given node just above the keyboard. Pass the field (or its row's View): it is
 * measured in window coords and the surface scrolls only by the overlap, so a mid-list row is
 * lifted to just above the keyboard rather than past it (the #196 regression). `null` where no
 * scroll surface can help (a FlatList screen manages its own).
 */
export const ScrollIntoViewContext = React.createContext<((node: Measurable | null) => void) | null>(null);
