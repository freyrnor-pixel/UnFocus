/**
 * Button.tsx — soft, rounded, shame-free action button. Variants: primary (filled), secondary (soft tint), danger (destructive), ghost (text).
 *
 * Sentence-case labels; no copy is baked in. Leading/trailing icons supported. Resolves
 * fill/text colours from the active theme (Decision 006 tokens). Minimum touch target is 44px tall.
 *
 * Connections:
 *   Imports → constants/theme (getMaterialStyle), lib/useAppTheme, store/useSettingsStore
 *             (glassSurfaces), components/PressableScale, components/GlassFill,
 *             components/GlowPulse (optional `emphasis` breathing CTA halo)
 *   Used by → all screens for standard action buttons
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - Size sm=36, md=44-48, lg=56. All meet 44px minimum touch target (md,lg exceed it; sm is inset slightly for small/secondary uses).
 *   - BorderRadius.full (999) for buttons (fully rounded pills).
 *   - Secondary is soft-tint fill (accentSoft), NOT border.
 *   - Disabled state is opacity 0.45 applied over the variant's own colours — never swap fill for disabled.
 *   - **Key press (2026-07-28)**: every filled variant is a CAP ON A BASE. The base is a
 *     plain `darken(fill, 0.22)` slab behind the cap (v6 `handoff/BUTTONS.md`: "the face at
 *     ~78% lightness — a real moulded edge, never a drop shadow"), and the wrapper's
 *     `paddingBottom: travel` is what leaves a sliver of it showing under the cap at rest.
 *     PressableScale's `travel` then sinks the cap onto it on press (Travel.sm/md/lg by size).
 *     Two consequences worth knowing: `style` moves to the WRAPPER on this path (a caller's
 *     width/margin has to size the whole key, or the base sticks out past the cap), and
 *     `ghost` opts out entirely — it's text with no fill, so it has no cap to sink and keeps
 *     the historical scale-bounce.
 *   - Glass: primary/secondary render components/GlassFill (frost + wash + face lift)
 *     inside a "raised keycap (double)" edge — a VERTICAL hue-tinted rim gradient
 *     padding-ring (fix 1, at Radius.full) PLUS a crisp 1px hue-tinted inner line (mat.innerLine)
 *     on the pill mask — over a transparent PressableScale (so the frost blurs the screen, not a solid fill) with the
 *     near-opaque `'button'` material for CTA contrast. Primary swaps the flat wash for
 *     the top-lit `mat.fillGradient` (lighten→base→darken); secondary keeps the flat wash + rim
 *     edge only. `ghost` (no fill) is never glass. Off when settings.glassSurfaces is false —
 *     back to the solid `colors.bg` pill, no rim. PressableScale owns the press depth in both.
 *   - **`danger` stays flat (2026-07-21)** — never glass, regardless of `settings.glassSurfaces`:
 *     a destructive action shouldn't be the shiniest, most skeuomorphic thing on screen. It's a
 *     solid `colors.bg` fill with a single calm `mat.innerLine` border (no rim/fill
 *     gradient) — matching the flat, bordered chip-pill convention used elsewhere (habit-form/
 *     task-form chips, FormControls' SegmentedControl) rather than the full glass CTA treatment.
 *   - Purposeful Depth System (2026-07-14): primary/secondary/danger pass PressableScale's
 *     `depth="raised"` (solid-fill, physical — reads as tappable); `ghost` (text-only) stays
 *     flat/unset since it has no fill to cast a shadow from.
 *   - **`emphasis` (2026-07-22, reserve-only)**: opt-in breathing `GlowPulse` halo behind the
 *     PRIMARY variant to draw the eye to the single main action on a screen (reduces "which
 *     button" load). Wrapped in a non-clipping relative View (glass path sets overflow:hidden).
 *     Ignored on non-primary/disabled. Use on at most one button per screen.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Label stays on FontSize/Fonts.bold rather than a Type role (2026-07-18 typography pass) —
// no Type entry fits a short CTA pill label; Type is for headings/body/captions.
import { darken, FontSize, Fonts, getMaterialStyle, Radius, Spacing } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import PressableScale from '@/components/PressableScale';
import GlassFill from '@/components/GlassFill';
import GlowPulse from '@/components/GlowPulse';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  /** Reserve-only: give the primary CTA a gentle breathing glow to mark the ONE main action on a screen. */
  emphasis?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE_HEIGHT: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
const SIZE_FONT: Record<Size, number> = { sm: FontSize.sm, md: FontSize.md, lg: FontSize.lg };
const SIZE_PADDING: Record<Size, [number, number]> = { sm: [8, 16], md: [12, 22], lg: [15, 28] };
/** Cap travel per size — design-system v6 `handoff/BUTTONS.md`'s "Travel by size" table. */
const SIZE_TRAVEL: Record<Size, number> = { sm: Travel.sm, md: Travel.md, lg: Travel.lg };

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  loading,
  emphasis,
  style,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const [vertPad, horizPad] = SIZE_PADDING[size];

  const variantColors = {
    primary: { bg: theme.accent, text: theme.accentInk },
    secondary: { bg: theme.accentSoft, text: theme.text },
    danger: { bg: theme.bad, text: theme.textInverse },
    ghost: { bg: 'transparent', text: theme.accent },
  };
  const colors = variantColors[variant];
  // Ghost is text-only (no fill) → never glass. Others render the take-two glass fill when
  // enabled: the near-opaque `'button'` material keeps the CTA's ink contrast (see
  // getMaterialStyle) while adding the rim (static; matte — no specular, no drifting sheen). When glass
  // is on the PressableScale's own backgroundColor drops to transparent so the frost blurs the
  // screen (not a solid fill sitting under it); the glass wash provides the colour.
  // **danger stays flat (2026-07-21)**: a destructive action shouldn't be the shiniest, most
  // skeuomorphic thing on screen — it now renders as a solid fill + a single calm hue-tinted
  // border (mat.innerLine), matching the flat/bordered chip-pill convention used elsewhere
  // (habit-form/task-form chips, FormControls' SegmentedControl) instead of the full glass
  // rim/top-lit-gradient treatment primary/secondary still get.
  const useGlass = glass && variant !== 'ghost' && variant !== 'danger';
  const mat = getMaterialStyle(colors.bg, 'button', isDark ? 'dark' : 'light');
  // Only the solid-filled primary CTA gets the top-lit vertical fill gradient (fix, buttons);
  // secondary keeps its flat accentSoft wash + rim edge only, danger stays fully flat (per the
  // 2026-07-21 note above).
  const topLit = variant === 'primary';

  const inner = loading ? (
    <ActivityIndicator color={colors.text} />
  ) : (
    <View style={styles.content}>
      {icon ? <Ionicons name={icon} size={Math.ceil(SIZE_FONT[size] * 1.15)} color={colors.text} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: colors.text, fontSize: SIZE_FONT[size] }]}>{label}</Text>
      {iconRight ? <Ionicons name={iconRight} size={Math.ceil(SIZE_FONT[size] * 1.15)} color={colors.text} style={styles.iconRight} /> : null}
    </View>
  );

  // Key-press travel (2026-07-28). `ghost` is text-only — it has no cap and no base, so it
  // keeps the historical scale-bounce; everything with a fill sinks.
  const travel = variant === 'ghost' ? undefined : SIZE_TRAVEL[size];

  const pressable = (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      scaleTo={variant === 'danger' ? 0.93 : size === 'sm' ? 0.97 : 0.95}
      travel={travel}
      depth={variant === 'ghost' ? undefined : 'raised'}
      style={[
        styles.base,
        {
          height: SIZE_HEIGHT[size],
          backgroundColor: useGlass ? 'transparent' : colors.bg,
          overflow: useGlass ? 'hidden' : undefined,
          opacity: disabled ? 0.45 : 1,
        },
        // Glass moves the label padding onto the inner mask (the rim ring + mask fill the pill);
        // the solid path keeps it on the pressable itself, as before.
        useGlass ? null : { paddingVertical: vertPad, paddingHorizontal: horizPad },
        // danger's flat fill still gets a single calm border (no rim) — see the
        // 2026-07-21 note above `useGlass`.
        variant === 'danger' ? { borderWidth: 1.5, borderColor: mat.innerLine } : null,
        // With travel, `style` goes on the cap+base wrapper instead — a caller's margin/width
        // must size the whole key, not just the cap, or the base would stick out past it.
        travel ? null : style,
      ]}
    >
      {useGlass ? (
        // Raised-keycap edge scaled to the pill (2026-07-18 retune): a VERTICAL hue-tinted rim
        // padding-ring at Radius.full (top→bottom, matching Surface — was a 135° diagonal) PLUS a
        // crisp 1px hue-tinted inner line (mat.innerLine) on the mask = the "double keycap". The
        // frost/wash/face-lift are masked inside; primary/danger swap the flat wash for the
        // top-lit fillGradient.
        <LinearGradient
          colors={mat.rim.colors}
          locations={mat.rim.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.ring, { borderRadius: Radius.full, padding: mat.borderWidth }]}
        >
          <View style={[styles.pillMask, { borderRadius: Radius.full, borderWidth: 1, borderColor: mat.innerLine, paddingVertical: vertPad, paddingHorizontal: horizPad }]}>
            <GlassFill
              mat={mat}
              radius={Radius.full}
              blurIntensity={20}
              tint={isDark ? 'dark' : 'light'}
              fillGradient={topLit ? mat.fillGradient : undefined}
            />
            {inner}
          </View>
        </LinearGradient>
      ) : (
        inner
      )}
    </PressableScale>
  );

  // The base the cap sits on (design-system v6 `handoff/BUTTONS.md`): "the face at ~78%
  // lightness — a real moulded edge, never a drop shadow". It's a plain darker slab behind the
  // cap, `travel` px taller, so at rest you see that sliver of base under the button and on
  // press the cap closes the gap and lands on it. A drop shadow can't do this: a shadow says
  // "floating above the page", a base says "this is a key in a housing".
  const button = travel ? (
    <View style={[styles.keyWrap, { paddingBottom: travel }, style]}>
      <View
        style={[
          styles.keyBase,
          { borderRadius: Radius.full, backgroundColor: darken(colors.bg, 0.22), opacity: disabled ? 0.45 : 1 },
        ]}
      />
      {pressable}
    </View>
  ) : (
    pressable
  );

  // Reserve-only emphasis: a single breathing halo behind the primary CTA. Wrapped in a
  // non-clipping relative View because the glass path sets overflow:'hidden' (which would clip
  // the halo's boxShadow). Use on at most one button per screen (ANIMATION_GUIDELINES §6/§9).
  if (emphasis && variant === 'primary' && !disabled) {
    return (
      <View style={[styles.emphasisWrap, style]}>
        <GlowPulse active color={theme.accent} mode="breathe" level="strong" radius={Radius.full} />
        {button}
      </View>
    );
  }
  return button;
}

const styles = StyleSheet.create({
  // Cap + base housing. `paddingBottom: travel` is what reserves the sliver of base that
  // shows under the cap at rest — without it the base would be exactly covered and the
  // button would look identical to the old flat pill until pressed.
  keyWrap: { position: 'relative' },
  keyBase: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Glass-on only: the rim gradient ring fills the pressable, and the mask inside it clips the
  // glass fill + centres the label. flexGrow/alignSelf so both fill the fixed-height pill.
  emphasisWrap: { position: 'relative', borderRadius: Radius.full },
  ring: { alignSelf: 'stretch', flexGrow: 1 },
  pillMask: { overflow: 'hidden', flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  iconRight: {
    marginLeft: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.bold,
  },
});
