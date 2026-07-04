/**
 * useAppTheme.ts — React hooks resolving the active colour palette + dark-mode state.
 *
 * useAppTheme() reads the user's colorTheme + darkMode from the settings store and
 * the system colour scheme, then returns the matching ThemePalette (Decision 006)
 * via getThemePalette() from constants/colors.ts. It also re-derives `accentInk` with
 * contrastOn(accent) so text/icons on an accent fill stay WCAG-legible on every theme
 * (the palette's literal accentInk is a placeholder — several accents are too light
 * for white ink); memoized on the palette reference so consumers keep referential
 * stability.
 * useIsDark() returns just the resolved dark/light boolean.
 * useAccessibility() returns { reducedMotion, getFontSize } for animation and font scaling.
 * useScaledStyles() takes a StyleSheet.create() result and rescales every fontSize per the user's text-size setting.
 *
 * Connections:
 *   Imports → constants/colors, constants/theme, store/useSettingsStore
 *   Used by → components (will be ported to use new ThemePalette token names)
 *   Data    → reads `colorTheme`, `darkMode`, `reducedMotion`, `fontSize` from the settings Zustand
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
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getThemePalette, ThemePalette, ThemeName } from '@/constants/colors';
import { getFontSize, FontSizeScale, contrastOn } from '@/constants/theme';

export function useAppTheme(): ThemePalette {
  const colorTheme = useSettingsStore((s) => s.colorTheme) as ThemeName;
  const darkMode = useSettingsStore((s) => s.darkMode);
  const systemScheme = useColorScheme();
  const isDark = darkMode === 'on' || (darkMode === 'system' && systemScheme === 'dark');
  const palette = getThemePalette(colorTheme, isDark);
  // accentInk must stay legible on `accent`. Several themes ship a light accent
  // (e.g. summer #E8794F, fluffyPink #E07AA8) where the palette's hardcoded white ink
  // fails WCAG AA. Re-derive it per-theme with contrastOn(), which picks dark-vs-white
  // by whichever wins contrast — self-correcting for any future theme.
  return useMemo(
    () => ({ ...palette, accentInk: contrastOn(palette.accent) }),
    [palette],
  );
}

export function useIsDark(): boolean {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const systemScheme = useColorScheme();
  return darkMode === 'on' || (darkMode === 'system' && systemScheme === 'dark');
}

/** Returns accessibility flags: whether animations should be suppressed and a font-scale helper. */
export function useAccessibility(): {
  reducedMotion: boolean;
  getFontSize: (base: number) => number;
} {
  const manualReducedMotion = useSettingsStore((s) => s.reducedMotion);
  const fontSize = useSettingsStore((s) => s.fontSize) as FontSizeScale;
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    return () => sub.remove();
  }, []);

  return {
    reducedMotion: manualReducedMotion || systemReducedMotion,
    getFontSize: (base: number) => getFontSize(base, fontSize),
  };
}

/**
 * Returns `base` (a StyleSheet.create() result) with every style's `fontSize`
 * scaled by the user's text-size setting. Call once per component that
 * renders styles from a module-level StyleSheet.create() object — if several
 * components share one styles object, each must call this hook separately.
 */
export function useScaledStyles<T extends Record<string, any>>(base: T): T {
  const fontSize = useSettingsStore((s) => s.fontSize) as FontSizeScale;
  return useMemo(() => {
    if (fontSize === 'default') return base;
    const out = {} as T;
    for (const key in base) {
      const style = base[key];
      if (style && typeof style === 'object' && typeof (style as any).fontSize === 'number') {
        out[key] = { ...style, fontSize: getFontSize((style as any).fontSize, fontSize) };
      } else {
        out[key] = style;
      }
    }
    return out;
  }, [base, fontSize]);
}
