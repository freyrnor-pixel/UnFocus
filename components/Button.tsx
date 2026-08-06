/**
 * Button.tsx — soft, rounded, shame-free action button. Variants: primary (filled), secondary (soft tint), danger (destructive), ghost (text).
 *
 * Sentence-case labels; no copy is baked in. Leading/trailing icons supported. Resolves
 * fill/text colours from the active theme (Decision 006 tokens). Minimum touch target is 44px tall.
 *
 * Connections:
 *   Imports → constants/theme (computeBorderTone, getMaterialStyle),
 *             lib/useDesignLab (useLabControl/useLabShape — the design lab's `button` shape
 *             knob: key (shipped) · filled · ghost · outline, plus the edge width),
 *             lib/useAppTheme, lib/screenColor (useScreenColor — the `ghost` border hue),
 *             components/PressableScale, components/GlowPulse (optional `emphasis` CTA halo)
 *   Used by → all screens for standard action buttons
 *   Data    → the ambient screen hue via useScreenColor(); no store reads
 *
 * Edit notes:
 *   - Size sm=36, md=44-48, lg=56. All meet 44px minimum touch target (md,lg exceed it; sm is inset slightly for small/secondary uses).
 *   - **Those are MINIMUMS, not fixed heights (2026-08-05)**: `minHeight`, so a label that
 *     needs a taller line box than the pill's resting height grows the pill instead of being
 *     sliced by the glass path's overflow mask. It was a fixed `height` and shipped clipped
 *     descenders on every `size="sm"` button — see the comment at the call site. Don't put a
 *     px `lineHeight` on `styles.label` as the "fix" either: Android re-scales a style
 *     lineHeight by the OS font scale when allowFontScaling is on, double-scaling the line box
 *     (constants/theme.ts's getHeaderMetrics block documents that trap in full).
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
 *   - **There is no glass path any more (card design reset, 2026-08-05, brief point 6: "white
 *     fill, full opacity for all cards and buttons").** Every variant is a solid, fully opaque
 *     fill with a border and the cap-on-base sink. Deleted with it: the transparent pressable,
 *     the `LinearGradient` rim ring, the `overflow:'hidden'` pill mask, the `GlassFill` frost +
 *     wash, and the `settings.glassSurfaces` read that chose between them. The same pass
 *     removed the equivalent layers from components/Surface.tsx, so a button and a card are
 *     once again made of the same material — which is now no material at all.
 *   - **Point 7 of that brief is "button states stay as designed now", and they did.** The
 *     variant fills, the per-variant `scaleTo`, the travel by size, the `depth="raised"`, the
 *     0.45 disabled opacity and the flat face are all exactly as they were. Translucency was
 *     the only thing removed. Don't read the reset as licence to restyle the states.
 *   - **Every variant has a border.** A FILLED variant's edge is `mat.innerLine`, derived from
 *     its own fill — a green screen-hue edge on a blue primary would read as a mistake.
 *     `ghost` has no fill to derive from, so it takes the screen's hue at the BUTTON rung
 *     (`computeBorderTone(hue, isDark, 'button')`), the lightest step of the card → field →
 *     button family. It falls back to the neutral `theme.border` on Home and Settings, which
 *     provide no hue.
 *   - **Flat face (2026-08-05)**: nothing is painted ON the face — no top-lit fill gradient, no
 *     face-lift scrim (`getMaterialStyle`'s `scrim` is a no-op for the `'button'` variant).
 *     "Raised" is read from the border, the keyBase sliver and the cast shadow, none of which
 *     touch the face. `mat.fillGradient` still exists in constants/theme.ts (pinned by
 *     `__tests__/glassMaterial.test.ts`); this file just doesn't consume it.
 *   - Purposeful Depth System (2026-07-14): primary/secondary/danger pass PressableScale's
 *     `depth="raised"` (solid-fill, physical — reads as tappable); `ghost` (text-only) stays
 *     flat/unset since it has no fill to cast a shadow from.
 *   - **`emphasis` (2026-07-22, reserve-only)**: opt-in breathing `GlowPulse` halo behind the
 *     PRIMARY variant to draw the eye to the single main action on a screen (reduces "which
 *     button" load). Wrapped in a relative View so the halo isn't clipped by the pill.
 *     Ignored on non-primary/disabled. Use on at most one button per screen.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Label stays on FontSize/Fonts.bold rather than a Type role (2026-07-18 typography pass) —
// no Type entry fits a short CTA pill label; Type is for headings/body/captions.
import { computeBorderTone, darken, FontSize, Fonts, getMaterialStyle, Radius, Spacing } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
import { useLabControl, useLabShape } from '@/lib/useDesignLab';
import PressableScale from '@/components/PressableScale';
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
  const buttonHue = useScreenColor() ?? theme.border;
  const [vertPad, horizPad] = SIZE_PADDING[size];

  const variantColors = {
    primary: { bg: theme.accent, text: theme.accentInk },
    secondary: { bg: theme.accentSoft, text: theme.text },
    danger: { bg: theme.bad, text: theme.textInverse },
    ghost: { bg: 'transparent', text: theme.accent },
  };
  // Design lab (lib/designLab.ts): what a button IS. 'key' is what the app ships — a filled
  // cap sunk onto a darker base — and is the fallback, so the three alternatives below are
  // unreachable until the lab says otherwise. 'filled' keeps the fill but drops the sink;
  // 'ghost' and 'outline' drop the fill entirely and move the variant's colour to the label
  // (and, for outline, to the edge), which is how the shipped `ghost` variant already works.
  const buttonShape = useLabControl('button');
  const labShape = useLabShape();
  const unfilled = buttonShape === 'ghost' || buttonShape === 'outline';
  const filledColors = variantColors[variant];
  const colors = unfilled
    ? { bg: 'transparent', text: variant === 'secondary' ? theme.text : filledColors.bg }
    : filledColors;
  const edgeWidth = labShape.borderButtonWidth * labShape.borderScale;
  // **Never glass (card design reset, 2026-08-05, brief point 6: "white fill, full opacity for
  // all cards and buttons").** Every variant now takes the solid path: an opaque fill in its own
  // colour, a border, and the cap-on-base sink. The frosted path — a transparent pressable with
  // a rim ring and a translucent GlassFill wash inside an overflow:hidden mask — is gone, in the
  // same pass that removed it from components/Surface.tsx, so a button and a card are made of
  // the same (absence of) material again.
  //
  // Point 7 of the same brief is "button states stay as designed now", and they do: the fills
  // (`variantColors` above), the per-variant scale, the travel, the disabled opacity and the
  // `depth` are all untouched. Only the translucency went. This is also why `glassSurfaces` is
  // no longer read here — see components/Surface.tsx's note on that setting going inert.
  const mat = getMaterialStyle(colors.bg, 'button', isDark ? 'dark' : 'light');

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
  // The lab's 'key' is the shipped behaviour; every other shape is flat, so nothing sinks.
  const travel = variant === 'ghost' || buttonShape !== 'key' ? undefined : SIZE_TRAVEL[size];

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
          // minHeight, NOT height (2026-08-05). A fixed height plus the glass path's
          // overflow:'hidden' mask is a clipper: at sm the box left 15px of content for a 14px
          // Nunito label whose natural line box is ~19px, and the OS text scale (capped at
          // MAX_FONT_SCALE) grows the label without growing the box — so "Sett dagens energi"
          // and "Last ned AI-oppsettsguide" shipped with their descenders sliced off. Same bug
          // getHeaderMetrics() exists to solve for the screen header band. As a minimum, every
          // size keeps its resting height and a label that needs more room grows the pill.
          // Left exactly as `SIZE_HEIGHT[size]` — the design lab's `minTapTarget` knob does NOT
          // reach here. `lib/__tests__/designTokens.test.ts` source-scans this very line to keep
          // it a minHeight rather than a height (a fixed height clipped descenders on shipped
          // buttons), and a knob is not worth weakening that guard for: a button is already at
          // or above the floor at every size, and the knob still moves fields, rows and the
          // checkbox, which is where a too-small target actually bites.
          minHeight: SIZE_HEIGHT[size],
          backgroundColor: colors.bg,
          opacity: disabled ? 0.45 : 1,
        },
        { paddingVertical: vertPad, paddingHorizontal: horizPad },
        // A filled button's border is derived from its OWN fill (`mat.innerLine`), not from the
        // screen hue: a green edge on a blue primary would read as a mistake, and point 7 keeps
        // the variants' colours as they are. The screen's hue reaches buttons through `ghost`
        // below — the one variant with no fill of its own to derive from.
        variant !== 'ghost' && !unfilled ? { borderWidth: edgeWidth, borderColor: mat.innerLine } : null,
        // Lab 'outline': no fill, and the edge carries the variant's own colour at full strength
        // rather than the screen's hue — the point of the shape is that the button's identity
        // moves from its face to its edge.
        unfilled
          ? {
              borderWidth: buttonShape === 'outline' ? edgeWidth * 1.5 : edgeWidth,
              borderColor: buttonShape === 'outline' ? colors.text : computeBorderTone(buttonHue, isDark, 'button', labShape.borderRampStrength),
            }
          : null,
        // Ghost has no fill, so it wears the screen's hue at the BUTTON rung — the lightest step
        // of the family (card → field → button), which is the "green to light green" gradation
        // across elements the maintainer specified. Falls back to the neutral `theme.border`
        // on Home and Settings, which provide no hue.
        variant === 'ghost' && !unfilled
          ? { borderWidth: edgeWidth, borderColor: computeBorderTone(buttonHue, isDark, 'button', labShape.borderRampStrength) }
          : null,
        // With travel, `style` goes on the cap+base wrapper instead — a caller's margin/width
        // must size the whole key, not just the cap, or the base would stick out past it.
        travel ? null : style,
      ]}
    >
      {inner}
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
  emphasisWrap: { position: 'relative', borderRadius: Radius.full },
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
