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
 *   Imports → constants/theme (filledEdge, getGlow, hitSlopFor, darken), lib/useAppTheme,
 *             lib/i18n, components/BottomNav (BOTTOM_NAV_HEIGHT), components/PressableScale
 *   Used by → **nothing mounts this component (re-measured 2026-08-08).** The only importer left
 *             is components/VoiceNoteFAB.tsx, and it takes the FAB_LG_SIZE/FAB_DEFAULT_BOTTOM
 *             constants only, not the component — app/notes.tsx swapped AddFAB for VoiceNoteFAB.
 *             This line previously named app/health-log.tsx, app/automations.tsx and
 *             app/(tabs)/shopping.tsx; none of the three renders an `<AddFAB>` any more —
 *             health-log and shopping compose with AddRow/InlineAddItem instead.
 *             **So the flatten below changed no pixel any user sees.** It was still worth doing:
 *             this file was the last GlassFill mount, and until it went, `glassSurfaces` and the
 *             whole frosted-material system had to be kept alive for one component nobody draws.
 *             If the FAB shape is genuinely not coming back, the honest follow-up is to move the
 *             two constants into VoiceNoteFAB and delete this file — that is a separate call,
 *             not something to do quietly inside a material pass.
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - **No glass any more (2026-08-08).** This was the LAST component in the app still mounting
 *     components/GlassFill: when settings.glassSurfaces was on the FAB drew a transparent circle
 *     with frost + wash over it. `Surface` and `Button` both dropped the frost in the 2026-08-05
 *     card reset, which left this as the one frosted surface and left `glassSurfaces` — the
 *     reduce-transparency a11y toggle — doing nothing anywhere except here. The FAB now always
 *     draws what the glass-OFF path drew: solid theme.accent + Shadow.fab (the same token
 *     BottomNav's centre button uses) + a hue-tinted edge. `components/GlassFill.tsx` is deleted
 *     with it, and `glassSurfaces` is now inert app-wide, which is the state that toggle was
 *     asking for in the first place. The setting and its DB column stay (this repo never drops
 *     columns) — see store/useSettingsStore.ts's "Inert columns" note.
 *   - **Keycap base (task 16, 2026-08-04)**: same `keyWrap`/`keyBase` fix as IconButton.tsx —
 *     `travel` had no base to sink onto. `style` (and the `'lg'` floating position) now live on
 *     the wrapper, not the inner `PressableScale`; a caller's `bottom`/`style` positions the
 *     whole key, not just the cap.
 *   - **Glow (2026-07-18)**: only the `'lg'` floating FAB (the primary "add" action) always
 *     carries `getGlow(theme.accent, 'strong')` — the one "always on" purposeful glow in the
 *     app (see constants/theme.ts's getGlow doc); the `'sm'` inline variant is a secondary,
 *     in-row control and stays glow-free. Added alongside `Shadow.fab`'s single-shadow keys —
 *     RN allows `boxShadow` and the legacy shadow* keys on the same view (independent props).
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
import { darken, filledEdge, Fonts, getGlow, hitSlopFor, Radius, Shadow, Spacing } from '@/constants/theme';
import { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import PressableScale from '@/components/PressableScale';
import { Travel } from '@/constants/motion';

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
  const t = useT();
  const dimension = DIMENSION[size];
  const edgeColor = filledEdge(theme.accent, isDark);
  // Purposeful glow (2026-07-18): only the floating 'lg' FAB, always on — see the file
  // header's Glow edit note.
  const glowShadow = size === 'lg' ? getGlow(theme.accent, 'strong').boxShadow : [];

  // Key press (2026-07-28) — the FAB travels furthest of anything (v6's travel table), a big
  // soft key rather than a twitchy chip. Task 16 (2026-08-04) gives it the base that travel
  // needs to sink onto (it had none — same "cap with no base" bug fixed in IconButton.tsx) and
  // the border the audit found missing ("floating, so it needs the strongest edge of anything"
  // — the solid fill had none at all).
  const travel = size === 'sm' ? Travel.md : Travel.fab;
  const keyBaseColor = darken(theme.accent, 0.22);

  const cap = (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t.a11yAdd}
      // 'sm' is 32px — below the minimum touch target, so pad the tap area out. This was a
      // bare `6` (32 + 12 = 44) and silently fell under the floor when MIN_TAP_TARGET rose to
      // 48 on 2026-08-08. designTokens.test.ts's bare-hitSlop scan could not catch it: its
      // regex wants digits straight after `hitSlop={`, and this one sat inside a ternary.
      // `hitSlopFor` derives from the token, so it can't drift out of step again.
      hitSlop={size === 'sm' ? hitSlopFor(dimension) : undefined}
      scaleTo={0.9}
      travel={travel}
      style={[
        styles.base,
        { width: dimension, height: dimension },
        // Solid accent + Shadow.fab + a hue-tinted edge, with the glow's boxShadow alongside.
        // This is what the glass-OFF path always drew; the frosted path is gone (2026-08-08).
        {
          backgroundColor: theme.accent,
          // 1.5 (the CARD rung) rather than the button rung, kept from the pre-flatten fill:
          // this thing floats free over scrolling content and task 16's audit called it "the
          // one that needs the strongest edge of anything". Changing it is a taste call of its
          // own, not part of dropping the frost.
          borderWidth: 1.5,
          borderColor: edgeColor,
          ...Shadow.fab,
          boxShadow: glowShadow,
        },
      ]}
    >
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
