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
 *   Imports → constants/theme, lib/useAppTheme, lib/i18n, components/BottomNav (BOTTOM_NAV_HEIGHT)
 *   Used by → app/(tabs)/health.tsx (symptom log FAB + Habits section's inline "sm" add), app/(tabs)/index.tsx, app/automations.tsx,
 *             app/inventory-edit.tsx; also components/VoiceNoteFAB.tsx (FAB_LG_SIZE/FAB_DEFAULT_BOTTOM
 *             constants only, not the component itself — app/notes.tsx dropped AddFAB in favour of
 *             VoiceNoteFAB, see that file's header)
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - Reuses Shadow.fab (constants/theme.ts) — the same token BottomNav's centre
 *     button uses — instead of each screen hand-rolling its own weaker shadow.
 *   - `bottom` only applies to the 'lg' floating variant; pass it when a screen has
 *     extra sticky footer content above BottomNav.
 *   - Exports FAB_LG_SIZE/FAB_DEFAULT_BOTTOM so a screen with extra footer content
 *     can stack it directly above the FAB's default position without hardcoding/
 *     duplicating these numbers.
 *   - `theme.orange`/`theme.white` remapped to Decision 006 tokens `accent`/`accentInk`
 *     during the port (2026-07-02, Phase 3d).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';

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
  const t = useT();
  const dimension = DIMENSION[size];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t.a11yAdd}
      // 'sm' is 32px — below the 44px minimum touch target, so pad the tap area out.
      hitSlop={size === 'sm' ? 6 : undefined}
      style={[
        styles.base,
        { width: dimension, height: dimension, backgroundColor: theme.accent },
        size === 'lg' && [styles.floating, { bottom: bottom ?? DEFAULT_BOTTOM }],
        style,
      ]}
    >
      <Text style={[styles.plus, { fontSize: PLUS_SIZE[size], color: theme.accentInk }]}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.fab,
  },
  floating: {
    position: 'absolute',
    right: Spacing.md,
  },
  plus: {
    fontFamily: Fonts.bold,
  },
});
