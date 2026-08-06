/**
 * useAppTheme.ts — React hooks resolving the active colour palette + dark-mode state.
 *
 * useAppTheme() reads the user's darkMode from the settings store and
 * the system colour scheme, then returns the default ThemePalette (Decision 006)
 * via getThemePalette() from constants/colors.ts. It also re-derives `accentInk` with
 * contrastOn(accent) so text/icons on an accent fill stay WCAG-legible on every theme
 * (the palette's literal accentInk is a placeholder — several accents are too light
 * for white ink); memoized on the palette reference so consumers keep referential
 * stability.
 * useIsDark() returns just the resolved dark/light boolean.
 * useAccessibility() returns { reducedMotion, getFontSize } for animation and font scaling.
 * useScaledStyles() takes a StyleSheet.create() result and rescales every fontSize (and lineHeight, in lockstep) per the user's text-size setting.
 * Each hook has a pure counterpart taking the value explicitly instead of reading the
 * store — resolveIsDark()/buildTheme()/withAccentInk() and scaleStyles(). They exist for
 * app/first-run.tsx, which must render an appearance/text-size choice the user has NOT
 * committed yet (the flow holds selections in local state until one atomic write), and
 * has to resolve them exactly the way the hooks resolve the stored ones.
 *
 * Connections:
 *   Imports → constants/colors, constants/theme, store/useSettingsStore,
 *             lib/designLab + lib/useDesignLab (the design-lab override bag — see below)
 *   Used by → components (will be ported to use new ThemePalette token names);
 *             app/first-run.tsx uses the pure buildTheme/resolveIsDark/scaleStyles trio
 *   Data    → reads `darkMode`, `reducedMotion`, `fontSize` from the settings Zustand
 *             store; reducedMotion is OR'd with the live OS-level AccessibilityInfo setting
 *
 * **This file is the design lab's two hook points (2026-08-06).** `useAppTheme()` is imported
 * by 137 of the app's 140 screens/components and `useScaledStyles()` by 63, which is why the
 * lab can recolour and re-space the whole app without adding a prop anywhere or maintaining a
 * second rendering path. Colour overrides land in `buildTheme`/`useAppTheme`; geometry
 * overrides land in `scaleStyles`. Both are inert — same object references, same early
 * returns — for a user who has never opened the lab. See lib/designLab.ts.
 *
 * Edit notes:
 *   - These are hooks — only call from React components/other hooks, never from
 *     stores or schedulers (use getThemePalette() directly there).
 *   - darkMode 'system' defers to useColorScheme(); keep the on/system/off logic
 *     in sync between useAppTheme and useIsDark.
 *   - useAccessibility()'s reducedMotion is `manual setting OR system setting` — the
 *     in-app toggle (store/useSettingsStore.ts) never overrides an OS-level reduce-motion
 *     preference, it only adds to it. See ANIMATION_GUIDELINES.md §7.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ColorSchemeName, useColorScheme } from 'react-native';
import { DarkMode, useSettingsStore } from '@/store/useSettingsStore';
import { getThemePalette, ThemePalette } from '@/constants/colors';
import { getFontSize, FontSizeScale, contrastOn } from '@/constants/theme';
import {
  applyColorOverrides,
  isDefaultShape,
  type LabOverrides,
  type ShapeOverrides,
} from '@/lib/designLab';
import { useLabOverrides, useLabShape } from '@/lib/useDesignLab';

/**
 * The one place the darkMode setting + the OS colour scheme resolve to a boolean.
 * Pure, so a caller previewing an unsaved choice (app/first-run.tsx) resolves it the
 * same way the hooks below resolve the saved one.
 */
export function resolveIsDark(darkMode: DarkMode, systemScheme: ColorSchemeName): boolean {
  return darkMode === 'on' || (darkMode === 'system' && systemScheme === 'dark');
}

/**
 * A palette with `accentInk` re-derived via contrastOn(), which picks dark-vs-white by
 * whichever wins contrast rather than trusting the palette's hardcoded white ink (several
 * accents are too light for it). Not memoized — callers memoize on the palette reference,
 * which getThemePalette() keeps stable per (theme, isDark).
 */
export function withAccentInk(palette: ThemePalette): ThemePalette {
  return { ...palette, accentInk: contrastOn(palette.accent) };
}

/**
 * The resolved palette for a dark/light boolean — the pure core of useAppTheme().
 *
 * `overrides` is the design lab's bag (lib/designLab.ts). It is applied BEFORE
 * `withAccentInk`, deliberately: an overridden `accent` must get its own contrast-derived ink,
 * or the lab would let the maintainer pick a pale accent and leave white text on it.
 */
export function buildTheme(isDark: boolean, overrides?: LabOverrides): ThemePalette {
  const base = getThemePalette('default', isDark);
  return withAccentInk(overrides ? applyColorOverrides(base, overrides, isDark) : base);
}

export function useAppTheme(): ThemePalette {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const systemScheme = useColorScheme();
  const isDark = resolveIsDark(darkMode, systemScheme);
  const palette = getThemePalette('default', isDark);
  // The single choke point 137 of the app's 140 screens/components already go through, which
  // is why the lab needs no new prop anywhere: overriding here reaches the per-screen border
  // hues (lib/screenColor.ts derives them from the feat* tokens) and the domain badges
  // (lib/domainColor.ts reads the palette) for free. `useLabOverrides` returns a shared
  // reference when nothing is applied, so this memo does not invalidate for a normal user.
  const overrides = useLabOverrides();
  return useMemo(
    () => withAccentInk(applyColorOverrides(palette, overrides, isDark)),
    [palette, overrides, isDark],
  );
}

export function useIsDark(): boolean {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const systemScheme = useColorScheme();
  return resolveIsDark(darkMode, systemScheme);
}

/**
 * The OS-level reduce-motion flag ALONE, without the in-app setting OR'd in. Almost
 * everything wants useAccessibility() instead; this exists for app/first-run.tsx, which
 * has to tell "the phone asks for less motion" apart from "this app is set to less
 * motion" in order to pre-select honestly and say why.
 */
export function useSystemReducedMotion(): boolean {
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    return () => sub.remove();
  }, []);
  return systemReducedMotion;
}

/** Returns accessibility flags: whether animations should be suppressed and a font-scale helper. */
export function useAccessibility(): {
  reducedMotion: boolean;
  getFontSize: (base: number) => number;
} {
  const manualReducedMotion = useSettingsStore((s) => s.reducedMotion);
  const fontSize = useSettingsStore((s) => s.fontSize) as FontSizeScale;
  const systemReducedMotion = useSystemReducedMotion();

  return {
    reducedMotion: manualReducedMotion || systemReducedMotion,
    getFontSize: (base: number) => getFontSize(base, fontSize),
  };
}

/**
 * Returns `base` (a StyleSheet.create() result) with every style's `fontSize`
 * AND `lineHeight` scaled by the user's text-size setting (both by the same factor,
 * so the line box keeps its ratio to the font and descenders never clip). Call once per component that
 * renders styles from a module-level StyleSheet.create() object — if several
 * components share one styles object, each must call this hook separately.
 */
export function useScaledStyles<T extends Record<string, any>>(base: T): T {
  const fontSize = useSettingsStore((s) => s.fontSize) as FontSizeScale;
  // The design lab's geometry rides the same transform — see scaleStyles' own doc for why
  // this hook and not a new prop on every component.
  const shape = useLabShape();
  return useMemo(() => scaleStyles(base, fontSize, shape), [base, fontSize, shape]);
}

/**
 * The pure core of useScaledStyles() — rescale a StyleSheet object by an explicit text-size
 * scale rather than the stored one. app/first-run.tsx uses this to live-preview a text size
 * the user hasn't committed yet; everything else should use the hook.
 */
export function scaleStyles<T extends Record<string, any>>(
  base: T,
  fontSize: FontSizeScale,
  shape?: ShapeOverrides,
): T {
    // The design lab's geometry knobs ride this same transform rather than getting their own
    // mechanism, because this hook is ALREADY the one place that rewrites a module-level
    // StyleSheet.create() result at render time. Spacing/Radius/BORDER_WIDTH are imported as
    // plain constants by ~120 files and captured at module-eval, so there is no other way to
    // move them live without a prop on every component. 63 of the app's 140 files call
    // useScaledStyles; the rest of the visible geometry is owned by Surface/FormControls/
    // PadRow/PadSheet, which read the shape override directly.
    const geo = shape && !isDefaultShape(shape) ? shape : null;
    if (fontSize === 'default' && !geo) return base;
    const out = {} as T;
    for (const key in base) {
      const style = base[key];
      const s = style as any;
      const hasFont = style && typeof style === 'object' && typeof s.fontSize === 'number';
      // lineHeight MUST scale by the same factor as fontSize, or the Size setting (large =
      // 1.2x) grows the glyph while the line box stays put — going tighter than the font's
      // descenders and clipping their bottoms (the "Hjem"->"Hiem" class of bug), the same
      // way the OS font-scale axis did to the header. Scale it whether or not this same
      // style also carries fontSize (a style can set lineHeight alone; keeping its ratio to
      // the inherited font size is still correct).
      const hasLine = style && typeof style === 'object' && typeof s.lineHeight === 'number';
      const geoPatch = geo ? geometryPatch(s, geo) : null;
      if (hasFont || hasLine || geoPatch) {
        // The lab's fontScale multiplies on TOP of the user's own Size setting, never instead
        // of it — the maintainer is asking "is the type too big", and the answer has to be
        // relative to whatever size they are actually reading at.
        const fs = geo?.fontScale ?? 1;
        out[key] = {
          ...style,
          ...geoPatch,
          ...(hasFont ? { fontSize: getFontSize(s.fontSize, fontSize) * fs } : null),
          ...(hasLine ? { lineHeight: getFontSize(s.lineHeight, fontSize) * fs } : null),
        };
      } else {
        out[key] = style;
      }
    }
    return out;
}

// Style keys the geometry pass multiplies, grouped by which scale owns them. Written out
// rather than pattern-matched on the name: `borderRadius` and `borderWidth` both start
// "border" and belong to different knobs, and a regex over key names would silently start
// scaling any future key that happens to match.
const RADIUS_KEYS = [
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
] as const;
const SPACING_KEYS = [
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'paddingHorizontal', 'paddingVertical', 'paddingStart', 'paddingEnd',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'gap', 'rowGap', 'columnGap',
] as const;
const BORDER_KEYS = [
  'borderWidth', 'borderTopWidth', 'borderBottomWidth',
  'borderLeftWidth', 'borderRightWidth', 'borderStartWidth', 'borderEndWidth',
] as const;

/**
 * The geometry half of a style rewrite: every radius, pad/margin/gap and edge width the
 * caller set, multiplied by the lab's three scales. Returns `null` when the style carries
 * none of them, so the common case allocates nothing.
 *
 * Only NUMBERS are touched. A percentage string (`padding: '5%'`) or `'auto'` is left exactly
 * as written — multiplying it would either throw away the unit or silently change what the
 * value means.
 */
function geometryPatch(s: Record<string, unknown>, geo: ShapeOverrides): Record<string, number> | null {
  if (!s || typeof s !== 'object') return null;
  let patch: Record<string, number> | null = null;
  const scale = (keys: readonly string[], factor: number) => {
    if (factor === 1) return;
    for (const key of keys) {
      const value = s[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (!patch) patch = {};
      patch[key] = value * factor;
    }
  };
  scale(RADIUS_KEYS, geo.radiusScale);
  scale(SPACING_KEYS, geo.spacingScale);
  scale(BORDER_KEYS, geo.borderScale);
  return patch;
}
