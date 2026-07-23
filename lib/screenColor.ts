/**
 * screenColor.ts — per-SCREEN hue layer (one dominant colour per tab).
 *
 * Distinct from lib/domainColor.ts (which colours by *content domain*). This maps each of
 * the 5 tab screens to ONE dominant hue so a screen reads as a single colour family — a
 * low-mental-load "you're in the green screen" scanning cue (the user won't learn colour
 * meanings; the colour just differentiates screens). The hue drives (a) the shared
 * ScreenBackground blob (crossfaded per active tab in app/(tabs)/_layout.tsx) and (b) the
 * frosted tint of every ambient Surface on that screen (via ScreenColorContext →
 * components/Surface.tsx). Semantic colour (good/bad/warn = done/overdue/soon, accent = save)
 * is untouched — it still comes from getStatusColor / theme tokens, never from here.
 *
 * Screen → hue (day-arc, distinct): shopping→green, plans→indigo, home→blue, health→teal,
 * habits→violet. Reuses the feat* octet where it fits. Habits inherits the featScan violet
 * (2026-07-23, UX audit E1/E2 nav swap) — Scan no longer needs a screen-hue slot since it
 * moved off the bottom nav to a pushed sub-screen (which doesn't render this per-tab hue).
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), constants/theme (rgba), react
 *   Used by → app/(tabs)/_layout.tsx (ScreenBackground tint), components/ScreenBackground,
 *             components/Surface (default frosted tint via useScreenColor), and each
 *             app/(tabs)/*.tsx screen root (wraps its subtree in ScreenColorProvider)
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
