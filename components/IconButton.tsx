/**
 * IconButton.tsx — circular icon-only button. Round affordance for settings, focus, etc.
 *
 * A translucent MATTE GLASS key: a flat wash of the button's own hue, one lit top-left edge,
 * and nothing else. Pass `tint` to change what the resting body is made of. Always pass `label`
 * for accessibility.
 *
 * Connections:
 *   Imports → constants/theme (glassKey), lib/useAppTheme, lib/useToggleColor (the active-state
 *             body crossfade), lib/screenColor (useControlHue — what the active state is lit in),
 *             react-native-reanimated, components/PressableScale
 *   Used by → header actions, focus toggles, standalone icon controls
 *   Data    → none
 *
 * Edit notes:
 *   - `size` controls outer button size (default 36); hit target always >= MIN_TAP_TARGET
 *     (achieved via the Pressable's own width/height).
 *   - Icon size is automatically 50% of button size.
 *   - **Matte glass since 2026-08-18 — this is the same recipe components/Button.tsx took on
 *     2026-08-17, and this file simply hadn't been converted.** Everything below in this list
 *     that describes a housing, a rim ring, a cast shadow or an opaque fill is HISTORY, and the
 *     notes are kept only so none of it gets rebuilt by someone reading a stale comment:
 *       • the `keyWrap`/`keyBase` pair (a stationary `darken(fill, 0.22)` slab under the cap) is
 *         **deleted** — a "solid heavy colour", and one that shows straight through a
 *         translucent body as a smudge. `style` therefore goes back on the PressableScale.
 *       • `depth="raised"` (a black cast shadow) is **deleted**; the only light on a key is an
 *         OUTWARD `getGlow` halo, and only while `active`.
 *       • the `LinearGradient` rim ring and its `EDGE_WIDTH` geometry are **deleted** — the edge
 *         is the cap's own four-sided border now, so `glassSurfaces` no longer changes this
 *         component's size (or anything else about it; a key was never blurred).
 *     What SURVIVES, and must: the momentary sink (`travel`) and the `active` body crossfade.
 *     Depth here is a motion and a lit edge, never a filled plate.
 *   - **⚠️ An active button does NOT rest sunk (2026-08-24), and that is an alignment rule
 *     rather than a taste one.** It carried `sunk={active}` from 2026-07-28 ("Pressed = on"),
 *     which translates the cap down by `Travel.md` for as long as the state holds — so in a row
 *     of these the lit one sits 4px lower than its neighbours. Reported against the Katalog
 *     card's header, where the locked lock sat visibly below the camera next to it
 *     (`components/CatalogueTab.tsx`'s `CatalogueHeaderControls`). It is the same ruling
 *     components/BottomNav.tsx already took on 2026-08-12 — `sunk` is for a momentary press,
 *     not for "this one is on" — and for the extra reason the 2026-08-18 pass created here: the
 *     `keyBase` slab is deleted, so there is no base left to sink INTO and the offset never read
 *     as depth, only as a button sitting low. On is still carried on three channels — the
 *     deepened body, the hued glyph and the outward halo. Pinned by
 *     lib/__tests__/chromeRhythm.test.ts.
 *   - **The active state is the SCREEN's hue in dark, `theme.accent` in light** (2026-08-27,
 *     round 20's *"never blue on a pink or cyan screen"*). All three active channels read one
 *     `useControlHue` value, so the body cannot be tinted one colour and lit another. This is
 *     the component that made the gap visible: components/ReminderBell.tsx is an IconButton, so
 *     the medicine bell was a blue bloom on the rose Health tab. The dark-only half is measured
 *     — see `useControlHue`'s doc and lib/__tests__/screenColor.test.ts, which pins the light
 *     mode FAILURE too so nobody extends it there.
 *   - `active` deepens the body (`quiet` → `key` rung of the same glass) and swaps the icon to
 *     that hue instantly, matching the SegmentedControl convention. Only the BODY crossfades:
 *     `useToggleColor` collapses `borderColor` to one tone for all four sides, which would
 *     destroy the top-left-lit/bottom-right-shaded split that IS the 3D cue, so the edge is set
 *     statically. The border width never changes between states, so toggling can't shift the
 *     icon.
 *   - Default (inactive, enabled) icon colour is `text`; disabled icon colour is `textMuted`.
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
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { glassKey, IconSize, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { useControlHue } from '@/lib/screenColor';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import PressableScale from '@/components/PressableScale';
import { Travel } from '@/constants/motion';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /**
   * Visual diameter. Prefer `IconSize.*` (constants/theme.ts) — and prefer passing NOTHING for
   * the ordinary case, so this control tracks the default if it ever moves. Six diameters
   * shipped at once before that token existed; see its doc.
   *
   * ⚠️ It does not affect the TOUCH target, which is floored at `MIN_TAP_TARGET` below whatever
   * this says. That is why the six were invisible to every tap-target test in the repo.
   */
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
  size = IconSize.action,
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
  const iconSize = Math.round(size * 0.5);
  const hitTarget = Math.max(MIN_TAP_TARGET, size + Spacing.sm);

  // **The active state wears the SCREEN's hue, not the app's accent (2026-08-27, round 20).**
  // The brief: *"never blue on a pink or cyan screen"* — and this component is where that was
  // most visible, because components/ReminderBell.tsx is an IconButton, so the medicine bell
  // bloomed blue in the middle of the rose Health tab. `useControlHue` is dark-only and says
  // why (light's octet fails the 3:1 non-text floor as glyph ink). All three of the active
  // channels below read it, so the body can never be tinted one colour and lit another —
  // the same single-`hue` discipline components/Button.tsx states.
  const controlHue = useControlHue(theme, isDark);
  const fgColor = color ?? (disabled ? theme.textMuted : active ? controlHue : theme.text);

  // **Matte glass, same recipe as components/Button.tsx (2026-08-18).** This component was left
  // behind by the 2026-08-17 button pass and so still carried every layer that pass deleted: a
  // `darken(fill, 0.22)` keyBase slab, a cast shadow, a `LinearGradient` rim ring and an opaque
  // `accentSoft` fill when active. Maintainer, again: *"Buttons must be flat and translucent…
  // Do NOT use LinearGradient, inner shadows, or solid opaque colors for button backgrounds."*
  // A key is a translucent body of its own hue plus one lit top-left edge, and nothing else.
  //
  // `quiet` for the resting rung and `key` for the active one, so switching a filter on
  // deepens the body rather than swapping its colour for a solid plate.
  const restKey = glassKey(tint ?? theme.text, isDark, 'quiet');
  const activeKey = glassKey(controlHue, isDark, 'key');
  // The third on/off channel, replacing the halo (2026-08-31). `glassKey` sets four per-side
  // edge colours — the lit top-left / shaded bottom-right split that is the 3D cue — so the
  // active state overrides all four to the hue rather than adding a fifth: a border that is the
  // hue on two sides and white on the other two reads as a rendering fault, not as a state.
  const activeEdge = active && !disabled
    ? {
      borderTopColor: controlHue,
      borderLeftColor: controlHue,
      borderBottomColor: controlHue,
      borderRightColor: controlHue,
    }
    : null;
  const edge = active ? { ...activeKey, ...activeEdge } : restKey;
  // Only the BODY crossfades. The four edge colours are set statically below, because the
  // top-left lit / bottom-right shaded split is the whole 3D cue and `useToggleColor` collapses
  // `borderColor` to one tone for all four sides. Called unconditionally (rules-of-hooks) even
  // in ghost mode below, where its result goes unused — a hook can never sit after an early
  // return.
  const animatedStyle = useToggleColor(active, {
    backgroundColor: [restKey.backgroundColor, activeKey.backgroundColor],
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

  // One layer, at the button's real size. There is no ring to pad for any more — the edge is
  // the cap's OWN border, exactly as it is on a Button — so `glass` no longer changes the
  // geometry and the footprint is `size` in both settings. (`glassSurfaces` still turns the
  // BAR's and the CARD's blur off; a key was never blurred.)
  const fill = (
    <Animated.View style={[
      styles.base,
      {
        width: size,
        height: size,
        borderWidth: edge.borderWidth,
        borderTopColor: edge.borderTopColor,
        borderLeftColor: edge.borderLeftColor,
        borderBottomColor: edge.borderBottomColor,
        borderRightColor: edge.borderRightColor,
      },
      animatedStyle,
    ]}>
      <Ionicons name={icon} size={iconSize} color={fgColor} />
    </Animated.View>
  );

  // **No `keyWrap`/`keyBase` housing any more (2026-08-18).** It was a stationary
  // `darken(fill, 0.22)` slab under the cap, revealed as a sliver by the wrapper's
  // `paddingBottom` — the same "solid heavy colour" Button.tsx dropped on 2026-08-17, and it
  // cannot coexist with a translucent body in any case: a darkened slab shows straight THROUGH
  // a 14% wash and reads as a smudge rather than as depth. The SINK stays (a motion, not a
  // finish); with no base of its own, a glass key sinks against the card behind it, which is
  // exactly what PressableScale prescribes for a caller that draws no base.
  //   With the wrapper gone, `style` goes on the pressable itself — same rule Button follows
  // now, and the same reason: there is no second box for it to size.
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      // Key press (2026-07-28): an icon button sinks rather than shrinking. **It does NOT rest
      // sunk while `active` (2026-08-24)** — see the header note; the resting offset put an
      // active button 4px below the inactive one beside it.
      travel={Travel.md}
      // ⚠️ **No halo, since 2026-08-31 — and losing it needed something in its place.** The
      // corrected screens' glow budget is *"accent icons, the active chip and the primary button
      // only"*, and this is none of those: the maintainer's screenshots show the Medisin bell and
      // the Katalog lock blooming hard in the middle of otherwise quiet chrome. Two always-lit
      // two-pass shadows per screen went with it.
      //   What made it not a straight deletion is that this component is also a SWITCH
      // (components/ReminderBell.tsx, rule 19a's one documented exception), and that file's whole
      // argument is that on/off needs more than two channels to read at a glance. Dropping the
      // halo would have left glyph + plate. So the third channel is a hue EDGE on the active
      // plate instead — see `activeEdge` above. Same information, no blur: a border is one stroke
      // where `getGlow` is two full passes, and it is drawn whether or not the button moves.
      accessibilityLabel={label}
      accessibilityRole={role}
      accessibilityState={role === 'switch' ? { disabled, checked: active } : { disabled, selected: active }}
      style={[
        styles.hit,
        { width: hitTarget, height: hitTarget, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {fill}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
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
