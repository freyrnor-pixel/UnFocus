/**
 * Button.tsx — soft, rounded, shame-free action button. Variants: primary (matte glass, lit and
 * haloed), secondary (the same glass, quieter and unlit), danger (destructive), ghost (text).
 *
 * Sentence-case labels; no copy is baked in. Leading/trailing icons supported. Resolves
 * fill/text colours from the active theme (Decision 006 tokens). Minimum touch target is 44px tall.
 *
 * Connections:
 *   Imports → constants/theme (computeBorderTone, glassKey — the shared matte-glass material),
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
 *   - Secondary is the same matte glass at a quieter alpha, NOT a border-only button.
 *   - Disabled state is opacity 0.45 applied over the variant's own colours — never swap fill for disabled.
 *   - **Matte glass, not plastic (2026-08-17)** — the current material, and the one that
 *     replaced the "hardware key" build below. Maintainer: *"the primary buttons look like
 *     glossy Web 2.0 plastic pills… FORBIDDEN: Do NOT use LinearGradient, inner shadows, or
 *     solid heavy colors for the background of primary buttons."* Three layers, and that is all:
 *       · **Body + Edge** — both come from `glassKey()` in constants/theme.ts: a flat,
 *         semi-transparent wash of the key's own hue (14% dark / 16% light for primary, 24% for
 *         danger, 8/10% for secondary), and one stroke that runs white on the TOP and LEFT and a
 *         quiet shade on the bottom and right. That is the glass catching a light source above
 *         and to the left — the same read `getGlassEdge` gives a card, done with per-side border
 *         COLOURS because a button is small enough that a gradient ring is not worth the extra
 *         view. Nothing is painted on top: no gradient, no scrim, no frost, no BlurView.
 *         **The helper is shared with the ~18 hand-rolled action pills** (every sheet's Done,
 *         AppModal's dialog buttons, scan's confirm bar) that never went through this component
 *         — they were most of the plastic actually on screen, so fixing Button alone would have
 *         left the app in two materials.
 *       · **Halo** — `getGlow` in the screen's categorical hue, projecting OUTWARD, on
 *         `primary`/`danger` only, and out well before the cap lands on press.
 *     **Deleted by this pass, and none of it should come back piecemeal:** the `keyBase` housing
 *     (a `darken(fill, 0.22)` slab — "solid heavy colors" exactly), the `depth="raised"` black
 *     cast shadow (the halo is the lift now), PressableScale's `face` gradients (a white top-edge
 *     highlight cross-fading to a dark inner shade — "LinearGradient" and "inner shadows"
 *     exactly), and `pressFill`/`PRESS_DARKEN` (a darken has nothing to act on once the body is a
 *     wash). What survives from the hardware era is the SINK, which is a motion rather than a
 *     finish, and it is what still makes a press feel physical.
 *   - **The history this replaced**, kept because the next brief will otherwise re-derive it:
 *     2026-07-28 made every filled variant a cap on a base; 2026-08-12 split the variants into
 *     "popped out" (primary/danger, housed + shadowed) and "flat" (secondary), and added the
 *     press-darken; 2026-08-15's Tactile Glass added the face highlight and the halo; 2026-08-16
 *     made the halo categorical while keeping the fill `theme.accent`. Everything in that chain
 *     except the halo and the sink is now gone. The one rule that survived all four passes and
 *     still holds: **implement the STATES, not the numbers** — `travel` stays `Travel.*` (3/4/5)
 *     rather than a brief's literal `translateY: 2`, and the edge is `edgeWidth` off the design
 *     lab's own token rather than a bare `1`. `Travel` is shared with
 *     Surface/IconButton/AddFAB/BottomNav, so a per-button literal would stop a Button being the
 *     same material as an IconButton beside it, and a bare `2` would fail
 *     `lib/__tests__/designTokens.test.ts`.
 *   - **Every variant has a border**, and every filled one now has the same one — the lit/shade
 *     pair above, derived from `hue`. `ghost` has no body to derive from, so it keeps the
 *     screen's hue at the BUTTON rung (`computeBorderTone(hue, isDark, 'button')`), the lightest
 *     step of the card → field → button family, falling back to the neutral `theme.border` on
 *     Home and Settings, which provide no hue.
 *   - **The label is `theme.text` on every filled variant, `danger` included.** It is not derived
 *     from the hue any more — nothing is written on a hue now, since the body is a wash rather
 *     than a fill, which is what freed the body to be categorical at all. Keeping `danger`'s label
 *     red was tried and MEASURED: `bad` on a wash of itself runs 4.62 → 3.59:1 across the usable
 *     alpha range in light and 4.33 → 3.59 in dark, i.e. it fails AA everywhere. Hence the
 *     opposite trade — plain ink, and the deepest wash in the band so the red is what the eye
 *     lands on rather than what it has to read.
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
import { computeBorderTone, FontSize, Fonts, glassKey, type KeyWeight, Radius, Spacing } from '@/constants/theme';
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
  // Raw (nullable) as well as defaulted: the border wants the neutral fallback, but the
  // categorical halo below must be able to tell "this screen has no hue" from "this screen is
  // grey" — a grey glow on Home would be a smudge, not an identity.
  const screenHue = useScreenColor();
  const buttonHue = screenHue ?? theme.border;
  const [vertPad, horizPad] = SIZE_PADDING[size];

  // ── The material a key is made of (2026-08-17, "no glossy plastic") ────────────────────────
  // `hue` is what the body, the shade edge and the halo are all derived from, so a key can never
  // be tinted one colour and lit another. `ink` is the label, and it is deliberately NOT derived
  // from the hue: the body is a 8–16% wash, i.e. very close to the surface behind it, so the
  // text that reads best on it is the app's ordinary `theme.text` at full contrast. That also
  // sidesteps the `accentInk` problem the 2026-08-16 halo note records — two of the five
  // categorical hues admit no AA-contrast ink at all, which only bites if something is written
  // ON the hue. Nothing is, any more.
  //
  // `danger` is not an exception to that — see `glassKey`'s `loud` note for the measurement that
  // decided it. Its label is `theme.text` like every other filled key, and what makes it read as
  // destructive is the deepest wash in the band plus a red halo.
  const hue =
    variant === 'danger'
      ? theme.bad
      : variant === 'secondary'
        ? theme.text // neutral glass — `rgba(255,255,255,0.08)` in dark, exactly the brief's example
        : screenHue ?? theme.accent;
  const weight: KeyWeight = variant === 'danger' ? 'loud' : variant === 'secondary' ? 'quiet' : 'key';
  const ink = theme.text;

  // Design lab (lib/designLab.ts): what a button IS. 'key' is what the app ships — a matte-glass
  // cap that sinks — and is the fallback, so the three alternatives below are unreachable until
  // the lab says otherwise. 'filled' keeps the body but drops the sink; 'ghost' and 'outline'
  // drop the body entirely and move the variant's colour to the label (and, for outline, to the
  // edge), which is how the shipped `ghost` variant already works.
  const buttonShape = useLabControl('button');
  const labShape = useLabShape();
  const unfilled = buttonShape === 'ghost' || buttonShape === 'outline';
  const edgeWidth = labShape.borderButtonWidth * labShape.borderScale;

  // `glassKey` (constants/theme.ts) is the whole material — the translucent body AND the
  // lit-top-left/quiet-bottom-right edge — and it is shared with the ~18 action pills that draw
  // themselves without going through this component (every sheet's Done, AppModal's dialog
  // buttons, scan's confirm bar). Read its doc before changing an alpha: the numbers are
  // load-bearing in both places, and the two drifting apart is what it exists to prevent.
  const key = glassKey(hue, isDark, weight, edgeWidth);

  // The lab's unfilled shapes drop the body and move the identity onto the label/edge. That
  // branch takes the HUE rather than the body, which is what it always meant — the body is an
  // `rgba()` wash and a wash makes no sense as a text colour.
  const colors = unfilled
    ? { bg: 'transparent', text: variant === 'ghost' ? theme.accent : hue }
    : {
        bg: variant === 'ghost' ? 'transparent' : key.backgroundColor,
        text: variant === 'ghost' ? theme.accent : ink,
      };

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
  // Since 2026-08-10 key mode is PressableScale's default, so opting out has to be explicit
  // (`press="scale"`) — leaving `travel` undefined would now give these two the key anyway.
  const isKeyShape = variant !== 'ghost' && buttonShape === 'key';
  const travel = isKeyShape ? SIZE_TRAVEL[size] : undefined;

  // **Which variants are LIT at rest.** `primary` and `danger` are the actions a screen wants
  // you to find, so they carry the halo; `secondary` is the same glass unlit, and `ghost` has no
  // body at all. This used to gate a housing and a cast shadow as well — both deleted 2026-08-17
  // — so the predicate now decides exactly one thing, which is the halo below.
  const isRaised = !unfilled && (variant === 'primary' || variant === 'danger');

  // ── Tactile Glass, 2026-08-15: the cap's halo ────────────────────────────────────────────
  // The HALO is the narrow one. `isRaised` is already exactly "primary or danger", i.e. the
  // one action a screen is asking for (DESIGN_RULES.md rule 6), which is the same scope rule 15
  // puts on getGlow: "the purposeful halo is for the one active/focused surface, never
  // decoration". Tying it to `isRaised` rather than to a new flag is what keeps the two from
  // drifting apart later.
  //
  // ⚠️ `secondary` deliberately does NOT get one. The 2026-08-12 pass flattened it because "a
  // soft-tint fill that is elevated competes with the one action a screen is asking for", and
  // that reasoning survives every brief since. Secondary is the same glass at a quieter alpha
  // with the same lit edge and the same sink; the halo is the whole of what separates it from
  // primary now, which is why the halo has to stay rare.
  //
  // ── The halo carries the CATEGORY, not the fill (2026-08-16, brief §7) ───────────────────
  // *"When rendering an icon, a badge, or the glowing shadow of a button associated with a
  // specific category, you MUST use its mapped categorical color."* So a primary button on the
  // Health tab throws a neon-rose light, on Habits an electric-cyan one, and so on — the same
  // five hues the badges and the pane wash use, resolved from the ambient screen (there is no
  // per-button category prop, and adding one would mean touching every call site to say
  // something the screen already knows).
  //
  // ⚠️ **The 2026-08-16 rule that the FILL stays `theme.accent` no longer applies**, and it is
  // worth saying why rather than letting it read as drift. That rule existed because the label
  // sat ON the fill: recolouring an opaque fill per screen means re-deriving `accentInk` per
  // screen, and two of the five hues admit no AA-contrast ink at all. A 14% wash is not a fill
  // the label sits on — `theme.text` is what reads on it, at full contrast, on every screen —
  // so the constraint that forced one action colour app-wide is gone with the opaque face.
  // "Primary" is still a ROLE, carried now by the halo and the lit edge rather than by blue.
  // `danger` opts out and keeps its own red — a destructive action must not borrow the colour of
  // the screen it happens to be on. Outside a ScreenScaffold (modals, sheets) `useScreenColor()`
  // is null and `hue` falls back to `theme.accent`, exactly as before.
  //
  // Since 2026-08-17 this is the ONLY light on a key. The face gradients that used to sit on top
  // of it are gone (see PressableScale's note), so "raised" is now carried by a halo projecting
  // OUTWARD plus the lit top-left edge — which is exactly what the brief asks for: *"Use an
  // outer shadowColor (in the category's neon color) to create the glow effect, projecting
  // outward, not inward."* `hue` already resolves to the categorical colour for primary and to
  // `theme.bad` for danger, so the halo and the body can't disagree about which colour the key is.
  const glow = isRaised ? { color: hue, radius: Radius.full } : undefined;

  const pressable = (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      press={isKeyShape ? 'key' : 'scale'}
      scaleTo={variant === 'danger' ? 0.93 : size === 'sm' ? 0.97 : 0.95}
      travel={travel}
      glow={disabled || loading ? undefined : glow}
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
          // Static again since 2026-08-17: PressableScale no longer owns backgroundColor (its
          // `pressFill` interpolation is deleted along with the rest of the face), so the body
          // is a plain flat translucent layer set right here.
          backgroundColor: colors.bg,
          opacity: disabled ? 0.45 : 1,
        },
        { paddingVertical: vertPad, paddingHorizontal: horizPad },
        // The glass edge: one width, lit on the top-left, a boundary on the bottom-right. The
        // screen's hue reaches this through `hue` (it is what `body` and the halo are made of
        // too), so the three can't disagree about which colour the key is.
        variant !== 'ghost' && !unfilled
          ? {
              borderWidth: key.borderWidth,
              borderTopColor: key.borderTopColor,
              borderLeftColor: key.borderLeftColor,
              borderBottomColor: key.borderBottomColor,
              borderRightColor: key.borderRightColor,
            }
          : null,
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
        // There is no wrapper any more (the `keyBase` housing went with the 2026-08-17 pass), so
        // the caller's style always belongs on the pressable itself.
        style,
      ]}
    >
      {inner}
    </PressableScale>
  );

  // **The `keyBase` housing is deleted (2026-08-17).** It was a `darken(fill, 0.22)` slab behind
  // the cap with `travel` px of it showing at rest — the "cap in a housing" half of the hardware
  // metaphor, and the single heaviest thing on a button: a solid, heavily-darkened block of the
  // action colour under a solid block of the action colour. That is precisely the *"solid heavy
  // colors"* the brief rules out, and it cannot survive a translucent body in any case — a
  // darkened slab shows straight THROUGH a 14% wash, which reads as a smudge rather than depth.
  // The sink stays (`travel` is unchanged): a glass key now sinks against the card behind it,
  // exactly as PressableScale prescribes for a caller with no base of its own.
  const button = pressable;

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
    // Centred, and centred by the TEXT as well as by the box (2026-08-17, brief §3: "Primary
    // text (Titles, Button labels) must be centered or left-aligned with a bold, legible font
    // weight"). `styles.base` already centres the content row; this is what keeps a label that
    // wraps to two lines centred rather than ragged-right.
    textAlign: 'center',
  },
});

/**
 * `<TactileButton>` — the Tactile Glass brief's name for this component (2026-08-15).
 *
 * An ALIAS, for the same reason `Surface` exports `GlassCard`: this file already is the app's
 * one button primitive, and forking a parallel component would leave every existing call site
 * on the old shape and give the app two button implementations — the exact duplication the
 * brief's "build reusable primitive components so the styling isn't repeated" is written
 * against. Prefer importing `Button` in app code; this export exists for new code written
 * against the brief's vocabulary and for the design-system docs.
 */
export const TactileButton = Button;
