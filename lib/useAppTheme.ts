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
 *   Imports → constants/colors, constants/theme, store/useSettingsStore
 *   Used by → components (will be ported to use new ThemePalette token names);
 *             app/first-run.tsx uses the pure buildTheme/resolveIsDark/scaleStyles trio
 *   Data    → reads `darkMode`, `reducedMotion`, `fontSize` from the settings Zustand
 *             store; reducedMotion is OR'd with the live OS-level AccessibilityInfo setting
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

/** The resolved palette for a dark/light boolean — the pure core of useAppTheme(). */
export function buildTheme(isDark: boolean): ThemePalette {
  return withAccentInk(getThemePalette('default', isDark));
}

export function useAppTheme(): ThemePalette {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const systemScheme = useColorScheme();
  const palette = getThemePalette('default', resolveIsDark(darkMode, systemScheme));
  return useMemo(() => withAccentInk(palette), [palette]);
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
  return useMemo(() => scaleStyles(base, fontSize), [base, fontSize]);
}

/**
 * The pure core of useScaledStyles() — rescale a StyleSheet object by an explicit text-size
 * scale rather than the stored one. app/first-run.tsx uses this to live-preview a text size
 * the user hasn't committed yet; everything else should use the hook.
 */
export function scaleStyles<T extends Record<string, any>>(base: T, fontSize: FontSizeScale): T {
    if (fontSize === 'default') return base;
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
      if (hasFont || hasLine) {
        out[key] = {
          ...style,
          ...(hasFont ? { fontSize: getFontSize(s.fontSize, fontSize) } : null),
          ...(hasLine ? { lineHeight: getFontSize(s.lineHeight, fontSize) } : null),
        };
      } else {
        out[key] = style;
      }
    }
    return out;
}
