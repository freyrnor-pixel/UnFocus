/**
 * screenColor.ts — per-SCREEN hue layer. **RETIRED 2026-07-31 (A.5) — NOTHING READS THIS.**
 *
 * ⚠️ This module is intentionally dead code. Every consumer was removed in the A.5 pass; the
 * definitions are kept in place (unused, exactly like the `feat*` tokens they resolve to in
 * constants/colors.ts) so the retirement is a trivially revertable one-commit change rather
 * than a delete-and-rewrite. **Do not wire anything new to it** — if you want a card to carry
 * colour, give it its own identity hue via Surface's `borderColor` (see lib/domainColor.ts),
 * which is the system that stayed.
 *
 * What it used to do: map each of the 5 tab screens to ONE dominant hue so a screen read as a
 * single colour family. That hue reached pixels through exactly one line — Surface's `edgeHue`
 * fallback chain — which meant EVERY un-coded ambient card on a tab drew that tab's colour on
 * its edge. That collided with the per-card identity hues (the card's own `borderColor`), since
 * two different systems were competing for the same 2.5px bevel. The screen-hue term lost; an
 * un-coded card now falls through to the neutral `theme.border`.
 *
 * Screen → hue it used to give (day-arc): shopping→green, plans→indigo, home→blue,
 * health→teal, habits→violet (the last inherited from the retired Scan tab slot).
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), constants/theme (rgba), react
 *   Used by → NOTHING in app code (as of 2026-07-31). Formerly components/Surface.tsx (edge
 *             hue via useScreenColor), components/ScreenScaffold.tsx (ScreenColorContext
 *             provider + its `screenColor` prop, both deleted), and the 5 app/(tabs)/*.tsx
 *             screen roots (each passed `screenColor={getScreenColor(theme, <route>).base}`).
 *             Still exercised by lib/__tests__/screenColor.test.ts, which pins the pure
 *             mapping and is deliberately left untouched.
 *   Data    → pure functions + a React context (no store/DB)
 *
 * Edit notes:
 *   - Route names are react-navigation route names from the tab pager: 'shopping', 'plans',
 *     'index' (Home), 'health', 'habits'. 'home' is accepted as an alias for 'index'.
 *   - getScreenColor falls back to `accent` for any unknown route so non-tab / sub-tier
 *     screens (which don't wrap a provider) stay on the calm default.
 */
import React from 'react';
import { ThemePalette } from '@/constants/colors';
import { rgba } from '@/constants/theme';

export type ScreenKey = 'shopping' | 'plans' | 'index' | 'home' | 'health' | 'habits';

const SCREEN_TOKEN: Record<ScreenKey, keyof ThemePalette> = {
  shopping: 'featShop',   // green
  plans: 'featPlan',      // indigo
  index: 'featTask',      // blue (Home)
  home: 'featTask',       // blue (alias)
  health: 'featHealth',   // teal
  habits: 'featScan',     // violet (inherited from the retired Scan tab slot)
};

export type ScreenHue = {
  /** The screen's dominant hue — base for a Surface's frosted tint and the backdrop blob. */
  base: string;
  /** Translucent tint of the base, for soft fills/badges if a screen wants one. */
  soft: string;
};

/**
 * Resolve a screen/route name to its dominant hue. Unknown routes (sub-tier screens,
 * settings, etc.) fall back to the calm `accent` so they read neutral.
 */
export function getScreenColor(theme: ThemePalette, route: string | null | undefined): ScreenHue {
  const token = route && (route in SCREEN_TOKEN) ? SCREEN_TOKEN[route as ScreenKey] : undefined;
  const base = (token ? (theme[token] as string) : theme.accent);
  return { base, soft: rgba(base, 0.14) };
}

/**
 * The active screen's base hue, or null outside any tab screen (sub-tier screens don't
 * provide one, so Surface falls back to its neutral `theme.surface` base there).
 */
export const ScreenColorContext = React.createContext<string | null>(null);

/** Read the ambient screen hue set by the nearest ScreenColorProvider (null if none). */
export function useScreenColor(): string | null {
  return React.useContext(ScreenColorContext);
}
