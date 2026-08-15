/**
 * Button.tsx — soft, rounded, shame-free action button. Variants: primary (filled), secondary (soft tint), danger (destructive), ghost (text).
 *
 * Sentence-case labels; no copy is baked in. Leading/trailing icons supported. Resolves
 * fill/text colours from the active theme (Decision 006 tokens). Minimum touch target is 44px tall.
 *
 * Connections:
 *   Imports → constants/theme (computeBorderTone, filledEdge),
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
 *   - **Three states, and only PRIMARY/DANGER pop out (2026-08-12)**. The brief was "flat,
 *     popped out, pressed in", and the three now map onto the variants like this:
 *       · **Popped out** — `primary`/`danger` (`isRaised`): the `keyBase` housing AND the
 *         `depth="raised"` cast shadow, exactly as before. Nothing about the resting look
 *         changed; this pass only decided who gets it.
 *       · **Flat** — `secondary`, as of this change: no housing, no shadow, flush with the
 *         card. A soft-tint fill that is elevated competes with the one action a screen is
 *         actually asking for. It keeps its full `travel`, so it is flat, not inert.
 *       · **Pressed in** — every filled variant sinks by `travel`, its shadow collapses to
 *         nothing, and now its FACE DARKENS by `PRESS_DARKEN` (PressableScale's `pressFill`,
 *         driven off the same shared value as the sink so the two can't disagree).
 *     The darken is the only genuinely new ingredient; the elevation numbers are still the
 *     app's own tokens (`getElevation('raised')`, `Travel.*`), not per-button literals, so a
 *     Button, an IconButton and an AddFAB still read as the same material.
 *   - **Tactile Glass adds a FACE and a HALO (2026-08-15); it did not restructure any of the
 *     above.** The brief asked for buttons that "feel like physical hardware keys": a top-edge
 *     highlight and a coloured glow at rest, and on press a move into the screen with the glow
 *     gone and a dark inner shadow in its place. Three of those five were already shipped by
 *     the 2026-08-12 pass — the sink, the shadow collapse, the face darken — so this change is
 *     only the two that were missing, and both go through PressableScale's new `face`/`glow`
 *     props on the SAME `press` shared value as the rest. Five cues, one curve.
 *       · `face` — every filled key gets it (gated on `pressFill`, so never a `ghost`: a
 *         highlight along the top of a bare word is nonsense).
 *       · `glow` — `isRaised` only, i.e. `primary`/`danger`. That is deliberately the same
 *         predicate as the housing rather than a new flag, so the two can't drift; and it is
 *         what keeps the halo inside DESIGN_RULES.md rule 15 ("never decoration") and rule 6
 *         (one primary action per screen).
 *     ⚠️ **`secondary` did NOT get its housing back.** The 2026-08-12 reasoning above is
 *     untouched by this brief, which asks specifically for *primary* buttons to read as
 *     hardware. Secondary sinks, darkens and now lights its face; primary additionally sits in
 *     a housing and glows. The gap between them got WIDER in this pass, not narrower.
 *   - `travel` stays `Travel.*` (3/4/5), not the brief's literal `translateY: 2`. Same rule the
 *     2026-08-12 pass wrote down — implement the STATES, not the numbers — and `Travel` is
 *     shared with Surface/IconButton/AddFAB/BottomNav, so a per-button literal would make a
 *     Button stop being the same material as an IconButton beside it. A bare `2` would also
 *     fail `lib/__tests__/designTokens.test.ts`.
 *   - **`secondary` lost `travel` px of layout height** with its housing (the wrapper's
 *     `paddingBottom` reserved the base's sliver). Intended — "flush with the UI" — and
 *     harmless because screens space their cards with `SCREEN_GAP`. Worth knowing if a
 *     tightly-packed row of secondary buttons ever looks 4px off from a mock.
 *   - **There is no glass path any more (card design reset, 2026-08-05, brief point 6: "white
 *     fill, full opacity for all cards and buttons").** Every variant is a solid, fully opaque
 *     fill with a border and the cap-on-base sink. Deleted with it: the transparent pressable,
 *     the `LinearGradient` rim ring, the `overflow:'hidden'` pill mask, the `GlassFill` frost +
 *     wash, and the `settings.glassSurfaces` read that chose between them. The same pass
 *     removed the equivalent layers from components/Surface.tsx.
 *     **Still true of BUTTONS after Tactile Glass (2026-08-15), and deliberately so** — that
 *     pass made CARDS translucent again but left every button fill solid. A button is the lit
 *     object in the brief ("illuminated and raised"), not the frosted one; a translucent
 *     primary action would take its own accent colour down toward whatever it happened to be
 *     sitting on, which is the opposite of "one obvious action". So a button and a card are no
 *     longer the same material, and that is the design: glass panes, solid keys ON them.
 *   - **Point 7 of that brief was "button states stay as designed now", and it held until
 *     2026-08-12** — that pass removed only translucency. The tactile-states change above is
 *     the first deliberate exception, made on instruction, and it is a narrow one: it adds the
 *     press-darken and moves `secondary` to flat. Everything else point 7 protected is still
 *     untouched — the variant fills, the per-variant `scaleTo`, the travel by size, the 0.45
 *     disabled opacity, the flat face, and `depth="raised"` on the variants that keep it.
 *     Still don't read the card reset as licence to restyle the states generally.
 *   - **Every variant has a border.** A FILLED variant's edge is `filledEdge`, derived from
 *     its own fill — a green screen-hue edge on a blue primary would read as a mistake.
 *     `ghost` has no fill to derive from, so it takes the screen's hue at the BUTTON rung
 *     (`computeBorderTone(hue, isDark, 'button')`), the lightest step of the card → field →
 *     button family. It falls back to the neutral `theme.border` on Home and Settings, which
 *     provide no hue.
 *   - **Flat face (2026-08-05)**: nothing is painted ON the face — no top-lit fill gradient, no
 *     face-lift scrim. "Raised" is read from the border, the keyBase sliver and the cast shadow,
 *     none of which touch the face. This used to call `getMaterialStyle` for the whole glass
 *     recipe and consume exactly one field of it; since 2026-08-08 it calls `filledEdge`, which
 *     IS that field, and the rest of the recipe is deleted.
 *   - Purposeful Depth System (2026-07-14): primary/danger pass PressableScale's
 *     `depth="raised"` (solid-fill, physical — reads as tappable); `ghost` (text-only) stays
 *     flat/unset since it has no fill to cast a shadow from. **`secondary` joined `ghost` on
 *     the flat side on 2026-08-12** — see the three-states note above.
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
import { computeBorderTone, darken, filledEdge, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
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
/**
 * How far a filled face darkens while it is held down (2026-08-12). Deliberately BETWEEN the
 * cap and its `keyBase` (`darken(fill, 0.22)`): the face moves toward the shade of the base it
 * is landing on, and never past it. A value at or above 0.22 would make the pressed cap darker
 * than the housing it sits in, which reads as a hole rather than a key.
 */
const PRESS_DARKEN = 0.1;

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
  const filledBorder = filledEdge(colors.bg, isDark);

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

  // **Which variants POP OUT at rest (2026-08-12).** `primary` and `danger` are the actions a
  // screen wants you to find, so they keep the whole raised kit: the `keyBase` housing, the
  // sliver of base showing under the cap, and a real cast shadow. `secondary` is now FLUSH with
  // the card it sits on — a soft-tint fill that is elevated competes with the one action the
  // screen is actually asking for — and `ghost` never had either. Flat does not mean inert:
  // a flat variant still sinks its full `travel` and still darkens, so losing the elevation
  // costs it none of the feedback. It sinks against the card behind it, which is what
  // PressableScale prescribes for a caller with no base of its own.
  const isRaised = !unfilled && (variant === 'primary' || variant === 'danger');
  // Only a raised variant gets the cap-on-base housing; a flat one is the bare pressable, so
  // it also stops reserving the `paddingBottom: travel` sliver that the base showed through.
  const housed = !!travel && isRaised;

  // The face darkens while held (PressableScale's `pressFill`, on the same shared value as the
  // sink). `ghost` and the lab's unfilled shapes have `bg: 'transparent'` — there is nothing to
  // darken, and they keep the scale bounce as their own feedback. Gated on `isKeyShape` too,
  // since PressableScale only interpolates the fill in key mode: without that guard the lab's
  // `filled` shape would drop its static fill here and get no animated one back.
  const pressFill =
    isKeyShape && colors.bg !== 'transparent'
      ? { rest: colors.bg, pressed: darken(colors.bg, PRESS_DARKEN) }
      : undefined;

  // ── Tactile Glass, 2026-08-15: the cap's face and its halo ───────────────────────────────
  // The FACE (top-edge highlight at rest, dark inner shade while held) goes on any filled key,
  // because every one of them is a cap that sinks — it is the same gesture at three strengths,
  // not a fourth variant. Gated on `pressFill` rather than on the variant so it can never
  // appear on something with no fill to light: a `ghost` button is a word, and a highlight
  // along the top of a word is nonsense.
  const face = pressFill ? { radius: Radius.full } : undefined;
  // The HALO is the narrow one. `isRaised` is already exactly "primary or danger", i.e. the
  // one action a screen is asking for (DESIGN_RULES.md rule 6), which is the same scope rule 15
  // puts on getGlow: "the purposeful halo is for the one active/focused surface, never
  // decoration". Tying it to `isRaised` rather than to a new flag is what keeps the two from
  // drifting apart later.
  //
  // ⚠️ `secondary` deliberately does NOT get one, and deliberately does NOT get its housing
  // back either. The 2026-08-12 pass flattened it because "a soft-tint fill that is elevated
  // competes with the one action a screen is asking for", and that reasoning is untouched by
  // this brief — which asks specifically for "PRIMARY buttons should feel like physical
  // hardware keys". Secondary still sinks its full travel, still darkens, and now lights its
  // face; what separates it from primary is the housing and the halo, which is a wider gap
  // than it had before rather than a narrower one.
  //
  // ── The halo carries the CATEGORY, not the fill (2026-08-16, brief §7) ───────────────────
  // *"When rendering an icon, a badge, or the glowing shadow of a button associated with a
  // specific category, you MUST use its mapped categorical color."* So a primary button on the
  // Health tab throws a neon-rose light, on Habits an electric-cyan one, and so on — the same
  // five hues the badges and the pane wash use, resolved from the ambient screen (there is no
  // per-button category prop, and adding one would mean touching every call site to say
  // something the screen already knows).
  //
  // ⚠️ The FILL deliberately stays `colors.bg`, i.e. the accent. Only the light is categorical.
  // Two reasons, and the second is the one that decides it:
  //   · `accentInk` is derived from `theme.accent` — recolouring the fill per screen means
  //     re-deriving the label's colour per screen, and two of the five hues admit no
  //     AA-contrast ink at all (see IDENTITY_HUES' note in constants/colors.ts). A neon-rose
  //     Save button would ship with a label measured at 4.32:1 at best.
  //   · One action colour app-wide is what makes "the thing you press" learnable. The category
  //     is already carried by the badge, the icon and the pane wash; the halo joins them, but
  //     the button staying blue is what keeps "primary" readable as a ROLE rather than as a
  //     sixth category.
  // `danger` opts out and keeps its own red halo — a destructive action must not borrow the
  // colour of the screen it happens to be on. Outside a ScreenScaffold (modals, sheets)
  // `useScreenColor()` is null and this falls back to the fill, exactly as before.
  const glow = isRaised
    ? { color: variant === 'danger' ? colors.bg : screenHue ?? colors.bg }
    : undefined;

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
      pressFill={pressFill}
      face={face}
      glow={disabled || loading ? undefined : glow}
      depth={isRaised ? 'raised' : undefined}
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
          // With `pressFill`, PressableScale OWNS backgroundColor — it interpolates the face
          // from this colour toward its darkened self as the cap sinks — and its contract says
          // not to set both. Without it (ghost, the lab's non-key shapes) the fill stays here.
          backgroundColor: pressFill ? undefined : colors.bg,
          opacity: disabled ? 0.45 : 1,
        },
        { paddingVertical: vertPad, paddingHorizontal: horizPad },
        // A filled button's border is derived from its OWN fill (`filledEdge`), not from the
        // screen hue: a green edge on a blue primary would read as a mistake, and point 7 keeps
        // the variants' colours as they are. The screen's hue reaches buttons through `ghost`
        // below — the one variant with no fill of its own to derive from.
        variant !== 'ghost' && !unfilled ? { borderWidth: edgeWidth, borderColor: filledBorder } : null,
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
        // With the housing, `style` goes on the cap+base wrapper instead — a caller's
        // margin/width must size the whole key, not just the cap, or the base would stick out
        // past it. A flat variant has no wrapper, so `style` belongs here; keying this off
        // `travel` rather than `housed` would silently drop a secondary button's width.
        housed ? null : style,
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
  // Raised variants only since 2026-08-12 — `secondary` is flat and renders the bare cap.
  const button = housed ? (
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
