/**
 * IconButton.tsx — circular icon-only button. Round affordance for settings, focus, etc.
 *
 * Defaults to soft chip fill; pass `tint` for background override. `active` state shows
 * accent background + border. Always pass `label` for accessibility.
 *
 * Connections:
 *   Imports → constants/theme (incl. computeRimGradient, darken), lib/useAppTheme,
 *             lib/useToggleColor (animated active-state background/border crossfade),
 *             store/useSettingsStore (glassSurfaces), react-native-reanimated,
 *             expo-linear-gradient, components/PressableScale
 *   Used by → header actions, focus toggles, standalone icon controls
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - `size` controls outer button size (default 36); hit target always >=44px (achieved via Pressable wrapper).
 *   - Icon size is automatically 50% of button size.
 *   - `active` crossfades the background (→ accentSoft) and border (transparent → accent) via
 *     useToggleColor; icon colour swaps instantly to accent on top. It ALSO rests sunk
 *     (PressableScale's `sunk`, 2026-07-28) so "on" is carried by depth as well as colour —
 *     which is what keeps it readable in greyscale, in glare, and for a colour-blind user. Border is always 1.5px
 *     (transparent when inactive) so toggling active never shifts the icon by the border width.
 *   - Default (inactive, enabled) icon colour is `text`; disabled icon colour is `textMuted`.
 *   - **Keycap base (task 16, 2026-08-04)**: `travel` was sinking the cap with nothing under it
 *     — every call site had the "cap with no base" bug AGENTS.md warns about. Now wrapped in a
 *     (Amended 2026-08-10: the base is sized to the CAP, not to the hit target — it used to
 *     stretch to all four edges of the 48px `keyWrap` behind a 36px circle and read as a dark
 *     ring rather than a bottom sliver. See the `capInset` comment.)
 *     `keyWrap`/`keyBase` pair (same shape as Button.tsx): a stationary `darken(fill, 0.22)`
 *     slab, revealed as a sliver by `paddingBottom: Travel.md` on the wrapper. **`style` now
 *     applies to the wrapper, not the inner `PressableScale`** — a caller's margin/position has
 *     to size the whole key or the base sticks out past the cap (same rule Button.tsx follows).
 *     This also grows the component's total footprint by `Travel.md` (a few px) versus before;
 *     a caller relying on the old exact height should re-check its layout.
 *   - **`depth="raised"` (2026-08-05)**: the inner PressableScale now also carries a real cast
 *     shadow (getElevation, compresses to 0 at the bottom of the travel) — it was missing before,
 *     so "popped out" rested on the rim + keyBase sliver alone. Matches Button.tsx's non-ghost
 *     variants. The face itself was already flat (plain crossfaded `backgroundColor`, no
 *     GlassFill/scrim/gradient) — this file was already the reference for "flat face, depth from
 *     the edges," it just lacked the shadow half of that.
 *   - **Keycap bevel ring (2026-07-21)**: when `settings.glassSurfaces` is on, the circular fill
 *     is wrapped in the same rim technique Button.tsx/Surface.tsx already use (`computeRimGradient`
 *     — flat, single-tone as of 2026-08-05, was light-top/dark-bottom) — a `LinearGradient` ring
 *     (`padding: EDGE_WIDTH`) around the existing fill+border `Animated.View`, which becomes the
 *     inner "double keycap" line. Rim hue follows the same base the fill is already crossfading
 *     toward/from (`inactiveBg` → `theme.accent`), snapped instantly on `active` change (not
 *     animated — LinearGradient colors aren't cheaply tweenable; only the inner fill/border keep
 *     crossfading via useToggleColor). Glass-off renders exactly the pre-2026-07-21 flat circle,
 *     unchanged.
 *   - **`borderColor` → ghost mode (2026-08-06)**: a flat, transparent-fill circle with a thin
 *     border in the given colour instead of a solid tint fill — the same "no fill, hue on the
 *     border only" move Button.tsx's `ghost` variant makes, for a spot (e.g. a pager arrow) that
 *     needs a screen-hued control without reading as a heavy solid-colour blob. Skips the
 *     keyWrap/keyBase cap-on-base and the glass rim entirely (matching Button's ghost, which
 *     opts out of both for the same reason: no fill means no cap to sink and nothing for a rim
 *     to wrap). `tint`/`active` are ignored in this mode; `color` overrides the default icon tint
 *     (`theme.accent`, matching Button ghost's text colour — never the border hue itself as an
 *     icon colour, per lib/domainColor.ts's A.4 rule 1).
 */
import React from 'react';
import { StyleSheet, StyleProp, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { darken, MIN_TAP_TARGET, Radius, Spacing, computeRimGradient } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import { useSettingsStore } from '@/store/useSettingsStore';
import PressableScale from '@/components/PressableScale';
import { Travel } from '@/constants/motion';

const EDGE_WIDTH = 1.5;

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: number;
  tint?: string;
  color?: string;
  active?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Ghost mode — see the header note. A thin border in this colour, transparent fill, no
   *  cap-on-base. Ignores `tint`/`active` when set. */
  borderColor?: string;
  /**
   * Announce as something other than a button — currently only `'switch'`, for an icon that IS
   * the on/off control rather than an action (components/ReminderBell.tsx). When set, `active`
   * is reported as `checked` instead of `selected`, which is what a screen reader needs to say
   * "on"/"off" rather than "selected". Default `'button'`.
   */
  role?: 'button' | 'switch';
};

export default function IconButton({
  icon,
  label,
  onPress,
  size = 36,
  tint,
  color,
  active = false,
  disabled,
  style,
  borderColor,
  role = 'button',
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const iconSize = Math.round(size * 0.5);
  const hitTarget = Math.max(MIN_TAP_TARGET, size + Spacing.sm);

  const inactiveBg = tint ?? theme.surfaceMuted;
  const fgColor = color ?? (disabled ? theme.textMuted : active ? theme.accent : theme.text);

  // Background + border crossfade between inactive and active as `active` flips (the icon
  // colour swaps instantly on top, matching the SegmentedControl convention). Inactive keeps a
  // VISIBLE thin edge (theme.border) — matching the cards' thin beveled edge so icon-buttons read
  // as the same family of raised keys (2026-07-18 "border around icons and buttons") — rather than
  // the old fully-transparent inactive border that left them edgeless.
  // Called unconditionally (rules-of-hooks) even in ghost mode below, where its result goes
  // unused — a hook can never sit after an early return.
  const animatedStyle = useToggleColor(active, {
    backgroundColor: [inactiveBg, theme.accentSoft],
    borderColor: [theme.border, theme.accent],
  });

  if (borderColor) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        // Explicit opt-out (2026-08-10): key mode is PressableScale's default now, and this
        // path deliberately skips the keyWrap/keyBase cap-on-base — there is no fill to build
        // a base from, so it keeps the scale-bounce, matching Button's `ghost`.
        press="scale"
        scaleTo={0.9}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[
          styles.hit,
          styles.ghost,
          {
            width: hitTarget,
            height: hitTarget,
            borderRadius: Radius.full,
            borderColor,
            opacity: disabled ? 0.45 : 1,
          },
          style,
        ]}
      >
        <Ionicons name={icon} size={iconSize} color={color ?? theme.accent} />
      </PressableScale>
    );
  }

  // Ring adds EDGE_WIDTH padding around the fill, so the fill shrinks to match when the ring
  // is showing — the overall button footprint (and hit target) stays exactly `size`, no layout
  // shift versus the glass-off circle.
  const innerSize = glass ? size - EDGE_WIDTH * 2 : size;
  const rim = computeRimGradient(active ? theme.accent : inactiveBg, isDark);
  const fill = (
    <Animated.View style={[
      styles.base,
      { width: innerSize, height: innerSize, borderWidth: 1.5 },
      animatedStyle,
    ]}>
      <Ionicons name={icon} size={iconSize} color={fgColor} />
    </Animated.View>
  );

  // Task 16 (2026-08-04): `travel` was sinking the cap with no base under it — AGENTS.md's own
  // "press = sink, not shrink" rule ("a caller passing travel must also draw a base... or the
  // cap sinks into nothing"), which every IconButton call site was silently violating. Same
  // `keyWrap`/`keyBase` shape as Button.tsx: a stationary darker slab the visible circle rests
  // on, revealed as a sliver by the wrapper's `paddingBottom: Travel.md` and covered when the
  // cap sinks on press. `style` moves here (the wrapper), not the PressableScale, for the same
  // reason Button's does — a caller's width/margin has to size the whole key, not just the cap.
  const keyBaseColor = darken(active ? theme.accent : inactiveBg, 0.22);
  // The base is the size of the CAP, not of the hit target (fixed 2026-08-10). `keyBase` used
  // to stretch to all four edges of `keyWrap`, which is `hitTarget` wide (48, the tap floor)
  // while the visible circle is only `size` (36 by default) — so a `darken(fill, 0.22)` slab
  // showed 6px proud on every side and read as a heavy dark RING around the button, not as the
  // "sliver revealed by paddingBottom" this block's own comment describes. Invisible while
  // every IconButton was a quiet grey; obvious the moment one went `active` in a card header
  // (components/ReminderBell.tsx). The cap is centred in the pressable, so the base sits at the
  // same inset, shifted down by exactly the travel it is there to catch.
  const capInset = (hitTarget - size) / 2;

  return (
    <View style={[styles.keyWrap, { width: hitTarget, paddingBottom: Travel.md }, style]}>
      <View
        style={[
          styles.keyBase,
          {
            top: capInset + Travel.md,
            left: capInset,
            width: size,
            height: size,
            borderRadius: Radius.full,
            backgroundColor: keyBaseColor,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      />
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.9}
        // Key press (2026-07-28): an icon button sinks rather than shrinking, and an ACTIVE one
        // stays sunk — v6's "Pressed = on", so a focus/filter toggle reads as engaged by depth
        // and not only by the accentSoft crossfade below.
        travel={Travel.md}
        sunk={active}
        // Cast shadow (2026-08-05, matching Button.tsx's non-ghost variants): without this the
        // "popped out" resting state relied on the rim + keyBase sliver alone, no real shadow —
        // PressableScale compresses it to 0 at the bottom of the travel, same as Button.
        depth="raised"
        accessibilityLabel={label}
        accessibilityRole={role}
        accessibilityState={role === 'switch' ? { disabled, checked: active } : { disabled, selected: active }}
        style={[
          styles.hit,
          { width: hitTarget, height: hitTarget, opacity: disabled ? 0.45 : 1 },
        ]}
      >
        {glass ? (
          <LinearGradient
            colors={rim.colors}
            locations={rim.locations}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ width: size, height: size, borderRadius: Radius.full, padding: EDGE_WIDTH, alignItems: 'center', justifyContent: 'center' }}
          >
            {fill}
          </LinearGradient>
        ) : fill}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  keyWrap: { position: 'relative' },
  // Geometry is inline — it derives from `size`/`hitTarget`, which are props. See `capInset`.
  keyBase: { position: 'absolute' },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
