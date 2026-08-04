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
 *   Imports → constants/theme (getLayeredShadow, getMaterialStyle, darken), lib/useAppTheme,
 *             lib/i18n, store/useSettingsStore (glassSurfaces), components/BottomNav
 *             (BOTTOM_NAV_HEIGHT), components/PressableScale, components/GlassFill
 *   Used by → app/health-log.tsx (symptom log FAB), app/automations.tsx,
 *             app/(tabs)/shopping.tsx (Monthly list's lower-right
 *             "add item" bubble, size="sm" — visual-audit 2026-07-11); also
 *             components/VoiceNoteFAB.tsx (FAB_LG_SIZE/FAB_DEFAULT_BOTTOM
 *             constants only, not the component itself — app/notes.tsx dropped AddFAB in favour of
 *             VoiceNoteFAB, see that file's header).
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - Glass: when settings.glassSurfaces is on the FAB is a transparent circle with
 *     components/GlassFill (frost + wash) + a crisp 1px hue-tinted inner line (mat.innerLine, the
 *     raised-keycap edge, matching cards/buttons) + a floating-tier getLayeredShadow (the
 *     three-pass depth). Off → solid theme.accent + Shadow.fab (the same token BottomNav's
 *     centre button uses) + (task 16, 2026-08-04) the same `mat.innerLine` border the glass path
 *     always had — the flat fill used to have no edge at all, the clearest case of "floating, so
 *     it needs the strongest edge of anything" having none.
 *   - **Keycap base (task 16, 2026-08-04)**: same `keyWrap`/`keyBase` fix as IconButton.tsx —
 *     `travel` had no base to sink onto. `style` (and the `'lg'` floating position) now live on
 *     the wrapper, not the inner `PressableScale`; a caller's `bottom`/`style` positions the
 *     whole key, not just the cap.
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
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { darken, Fonts, getGlow, getLayeredShadow, getMaterialStyle, Radius, Shadow, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import PressableScale from '@/components/PressableScale';
import { Travel } from '@/constants/motion';
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

  // Key press (2026-07-28) — the FAB travels furthest of anything (v6's travel table), a big
  // soft key rather than a twitchy chip. Task 16 (2026-08-04) gives it the base that travel
  // needs to sink onto (it had none — same "cap with no base" bug fixed in IconButton.tsx) and,
  // for the glass-off fill, the border the audit found missing ("floating, so it needs the
  // strongest edge of anything" — it had none at all when glassSurfaces was off).
  const travel = size === 'sm' ? Travel.md : Travel.fab;
  const keyBaseColor = darken(theme.accent, 0.22);

  const cap = (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t.a11yAdd}
      // 'sm' is 32px — below the 44px minimum touch target, so pad the tap area out.
      hitSlop={size === 'sm' ? 6 : undefined}
      scaleTo={0.9}
      travel={travel}
      style={[
        styles.base,
        { width: dimension, height: dimension },
        // Glass: transparent fill + frost + floating-tier layered shadow (merged with the
        // glow) makes the FAB read as the lit chrome floating over content. Off → solid
        // accent + Shadow.fab + a calm hue-tinted border, with the glow's boxShadow added
        // alongside.
        glass
          ? {
              backgroundColor: 'transparent',
              overflow: 'hidden',
              // Raised-keycap inner line (2026-07-18 retune): a crisp 1px hue-tinted edge so the
              // glass FAB matches cards/buttons. No outer rim ring here — the inner line plus the
              // always-on accent glow is enough definition for a 56px circle.
              borderWidth: 1,
              borderColor: mat.innerLine,
              boxShadow: [...getLayeredShadow(theme.shadow, 'floating'), ...glowShadow],
            }
          : {
              backgroundColor: theme.accent,
              borderWidth: 1.5,
              borderColor: mat.innerLine,
              ...Shadow.fab,
              boxShadow: glowShadow,
            },
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

  // `style` (and the floating position) move to this wrapper, not the inner PressableScale —
  // same rule Button.tsx/IconButton.tsx follow: a caller's width/margin/position has to size
  // the whole key, or the base sticks out past the cap.
  return (
    <View
      style={[
        styles.keyWrap,
        { width: dimension, paddingBottom: travel },
        size === 'lg' && [styles.floating, { bottom: bottom ?? DEFAULT_BOTTOM }],
        style,
      ]}
    >
      <View
        style={[styles.keyBase, { borderRadius: Radius.full, backgroundColor: keyBaseColor }]}
      />
      {cap}
    </View>
  );
}

const styles = StyleSheet.create({
  keyWrap: { position: 'relative' },
  keyBase: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
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
