/**
 * useAppTheme.ts — React hooks resolving the active colour palette + dark-mode state.
 *
 * useAppTheme() reads the user's colorTheme + darkMode from the settings store and
 * the system colour scheme, then returns the matching AppColors via getTheme().
 * useSoftTheme() returns the same palette softened for emotional/health screens.
 * useIsDark() returns just the resolved dark/light boolean.
 * useAccessibility() returns { reducedMotion, fontScale } for animation and font scaling.
 * useScaledStyles() takes a StyleSheet.create() result and rescales every fontSize per the user's text-size setting.
 *
 * Connections:
 *   Imports → constants/theme, store/useSettingsStore
 *   Used by → app/automations.tsx, app/budget.tsx, app/focus.tsx, app/habit-form.tsx, app/habits.tsx, app/health.tsx, app/index.tsx, app/meals.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/onboarding/step2.tsx, app/onboarding/step3.tsx, app/onboarding/step4.tsx, app/onboarding/step5.tsx, app/onboarding/step6.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/BubbleMenu.tsx, components/CompletionGlow.tsx, components/ConfirmationBanner.tsx, components/DatePickerCalendar.tsx, components/DayTimeline.tsx, components/ExpandableCard.tsx, components/HintCard.tsx, components/Pet.tsx, components/PressableScale.tsx, components/QuickAddSheet.tsx, components/ShoppingRow.tsx, components/TaskItem.tsx, components/TimePickerWheel.tsx, components/cover/CoverHabitsSection.tsx, components/cover/CoverHeader.tsx, components/cover/CoverScreen.tsx, components/cover/CoverTasksSection.tsx
 *   Data    → reads `colorTheme`, `darkMode`, `reducedMotion`, `fontSize` from the settings Zustand
 *             store; reducedMotion is OR'd with the live OS-level AccessibilityInfo setting
 *
 * Edit notes:
 *   - These are hooks — only call from React components/other hooks, never from
 *     stores or schedulers (use getTheme() directly there).
 *   - darkMode 'system' defers to useColorScheme(); keep the on/system/off logic
 *     in sync between useAppTheme and useIsDark.
 *   - useAccessibility()'s reducedMotion is `manual setting OR system setting` — the
 *     in-app toggle (store/useSettingsStore.ts) never overrides an OS-level reduce-motion
 *     preference, it only adds to it. See ANIMATION_GUIDELINES.md §7.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getTheme, getSoftTheme, getFontSize, AppColors, FontSizeScale } from '@/constants/theme';

export function useAppTheme(): AppColors {
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const customPrimaryColor = useSettingsStore((s) => s.customPrimaryColor);
  const customSecondaryColor = useSettingsStore((s) => s.customSecondaryColor);
  const systemScheme = useColorScheme();
  const isDark = darkMode === 'on' || (darkMode === 'system' && systemScheme === 'dark');
  return getTheme(colorTheme, isDark, { primary: customPrimaryColor, secondary: customSecondaryColor });
}

/**
 * Like useAppTheme() but softened for emotional/health screens (warmer, lower contrast).
 * Use on app/health.tsx and app/habits.tsx so they read gentler than productivity screens.
 */
export function useSoftTheme(): AppColors {
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const customPrimaryColor = useSettingsStore((s) => s.customPrimaryColor);
  const customSecondaryColor = useSettingsStore((s) => s.customSecondaryColor);
  const systemScheme = useColorScheme();
  const isDark = darkMode === 'on' || (darkMode === 'system' && systemScheme === 'dark');
  return getSoftTheme(getTheme(colorTheme, isDark, { primary: customPrimaryColor, secondary: customSecondaryColor }));
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
