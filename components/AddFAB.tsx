/**
 * AddFAB.tsx — shared circular "add new" button (the accent "+" used everywhere a
 * screen lets the user add a new entity).
 *
 * Two variants: `'lg'` (default) is a 56px floating action button, bottom-right
 * above BottomNav; `'sm'` is a 32px inline button for use inside a row (e.g. a
 * dashboard section header). Always `theme.accent` — this is the one shared shape
 * so "add new" reads the same on every site.
 *
 * Connections:
 *   Imports → constants/theme (getLayeredShadow, getMaterialStyle), lib/useAppTheme, lib/i18n,
 *             store/useSettingsStore (glassSurfaces), components/BottomNav (BOTTOM_NAV_HEIGHT),
 *             components/PressableScale, components/GlassFill
 *   Used by → app/health-log.tsx (symptom log FAB), app/(tabs)/health.tsx (embedded Habits
 *             section's inline "sm" add — the former app/habits.tsx's own AddFAB),
 *             app/automations.tsx,
 *             app/inventory-edit.tsx, app/(tabs)/shopping.tsx (Monthly list's lower-right
 *             "add item" bubble, size="sm" — visual-audit 2026-07-11); also
 *             components/VoiceNoteFAB.tsx (FAB_LG_SIZE/FAB_DEFAULT_BOTTOM
 *             constants only, not the component itself — app/notes.tsx dropped AddFAB in favour of
 *             VoiceNoteFAB, see that file's header).
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - Glass: when settings.glassSurfaces is on the FAB is a transparent circle with
 *     components/GlassFill (frost + wash) + a floating-tier getLayeredShadow (the
 *     three-pass depth). Off → solid theme.accent + Shadow.fab (the same token BottomNav's
 *     centre button uses) so it never hand-rolls a weaker shadow.
 *   - **Glow (2026-07-18)**: only the `'lg'` floating FAB (the primary "add" action) always
 *     carries `getGlow(theme.accent, 'strong')` — the one "always on" purposeful glow in the
 *     app (see constants/theme.ts's getGlow doc); the `'sm'` inline variant is a secondary,
 *     in-row control and stays glow-free. Merged into the same `boxShadow` array as the depth
 *     shadow (glass-on) or added alongside `Shadow.fab`'s single-shadow keys (glass-off; RN
 *     allows `boxShadow` and the legacy shadow* keys on the same view — independent props).
 *   - `bottom` only applies to the 'lg' floating variant; pass it when a screen has
 *     extra sticky footer content above BottomNav.
 *   - Exports FAB_LG_SIZE/FAB_DEFAULT_BOTTOM so a screen with extra footer content
 *     can stack it directly above the FAB's default position without hardcoding/
 *     duplicating these numbers.
 *   - `theme.orange`/`theme.white` remapped to Decision 006 tokens `accent`/`accentInk`
 *     during the port (2026-07-02, Phase 3d).
 */
import React from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { Fonts, getGlow, getLayeredShadow, getMaterialStyle, Radius, Shadow, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import PressableScale from '@/components/PressableScale';
import GlassFill from '@/components/GlassFill';

type Props = {
  onPress: () => void;
  /** 'lg' = 56px floating FAB (default); 'sm' = 32px inline button. */
  size?: 'lg' | 'sm';
  /** Floating-position override (only applies to size 'lg'); default Spacing.xl + BOTTOM_NAV_HEIGHT. */
  bottom?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Screen-reader label for this icon-only button. Pass the specific action
   * ("Add task", "Add note", …); falls back to a generic "Add" so the button
   * is never announced as just its "+" glyph.
   */
  accessibilityLabel?: string;
};

const DIMENSION = { lg: 56, sm: 32 };
const PLUS_SIZE = { lg: 28, sm: 18 };
const DEFAULT_BOTTOM = Spacing.xs + BOTTOM_NAV_HEIGHT;

export const FAB_LG_SIZE = DIMENSION.lg;
export const FAB_DEFAULT_BOTTOM = DEFAULT_BOTTOM;

export default function AddFAB({ onPress, size = 'lg', bottom, style, accessibilityLabel }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const t = useT();
  const dimension = DIMENSION[size];
  const mat = getMaterialStyle(theme.accent, 'button', isDark ? 'dark' : 'light');
  // Purposeful glow (2026-07-18): only the floating 'lg' FAB, always on, regardless of the
  // glassSurfaces toggle — see the file header's Glow edit note.
  const glowShadow = size === 'lg' ? getGlow(theme.accent, 'strong').boxShadow : [];

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t.a11yAdd}
      // 'sm' is 32px — below the 44px minimum touch target, so pad the tap area out.
      hitSlop={size === 'sm' ? 6 : undefined}
      scaleTo={0.9}
      style={[
        styles.base,
        { width: dimension, height: dimension },
        // Glass: transparent fill + frost + floating-tier layered shadow (merged with the
        // glow) makes the FAB read as the lit chrome floating over content. Off → solid
        // accent + Shadow.fab, with the glow's boxShadow added alongside.
        glass
          ? {
              backgroundColor: 'transparent',
              overflow: 'hidden',
              boxShadow: [...getLayeredShadow(theme.shadow, 'floating'), ...glowShadow],
            }
          : { backgroundColor: theme.accent, ...Shadow.fab, boxShadow: glowShadow },
        size === 'lg' && [styles.floating, { bottom: bottom ?? DEFAULT_BOTTOM }],
        style,
      ]}
    >
      {glass && (
        <GlassFill
          mat={mat}
          radius={Radius.full}
          blurIntensity={16}
          tint={isDark ? 'dark' : 'light'}
        />
      )}
      <Text style={[styles.plus, { fontSize: PLUS_SIZE[size], color: theme.accentInk }]}>+</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    position: 'absolute',
    right: Spacing.md,
  },
  plus: {
    fontFamily: Fonts.bold,
  },
});
