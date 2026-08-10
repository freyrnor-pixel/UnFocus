/**
 * Surface.tsx — the one card shape: a flat opaque page with a single hue-ramped border.
 *
 * **Card design reset, 2026-08-05 (maintainer brief, "one simple design for all cards").**
 * Every card in the app is now the same object: an opaque fill — pure white in light mode,
 * the flat navy `theme.surface` in dark — with ONE simple border carrying the screen's own
 * colour, ramped deep→light down the edge. Nothing is drawn on the face. There is no frost,
 * no colour wash, no translucency, no face-lift gradient, and no beveled rim.
 *
 * What that replaced, so nobody re-adds it by halves: a glass system built between 2026-07-18
 * and 2026-08-05 — a BlurView for overlay contexts, a per-context translucent wash
 * (`GLASS_WASH_ALPHA`), a 10%-white face lift fading out by 42% with a 4% bottom shade
 * (`getMaterialStyle`'s `scrim`), a 2.5px beveled `computeRimGradient` ring, and an
 * `innerLine` second edge. All of it is gone from this component. `components/GlassFill.tsx`
 * is no longer mounted here at all.
 *
 * Connections:
 *   Imports → constants/theme (BORDER_WIDTH, computeBorderRamp, darken,
 *             getLayeredShadow, Radius), constants/motion (Travel), lib/useAppTheme
 *             (useAppTheme, useIsDark, useAccessibility), lib/screenColor (useScreenColor),
 *             lib/useDesignLab (useLabShape — the design lab's geometry, see Edit notes),
 *             components/PressableScale, expo-linear-gradient
 *   Used by → every screen that renders a card (grep `<Surface`). Callers passing `onPress`
 *             (the key-press path): components/OpenEpisodeCard, app/health-log,
 *             app/health-detail, app/scan. **components/CollapsedSection doesn't use this
 *             path**: it is a card whose HEADER is tappable, not one tappable card, so the
 *             press lives on the header's own PressableScale. (Its predecessor
 *             SubScreenLinkButton left this list on 2026-08-08 for the same reason, and was
 *             deleted on 2026-08-10.)
 *   Data    → reads `reducedMotion` via useAccessibility(); the ambient screen hue via
 *             useScreenColor() (provided by components/ScreenScaffold.tsx)
 *
 * Edit notes:
 *   - **Colour lives ONLY in the border, and the border's hue comes from the SCREEN.** The
 *     resolution order is `borderColor` (an explicit override — Home's preview cards pass
 *     their source screen's hue this way) → `tint` → the ambient screen hue from
 *     lib/screenColor.ts → the neutral `theme.border`. Home and Settings provide no hue on
 *     purpose, so their cards land on that neutral and are grey. See lib/screenColor.ts's
 *     header for why the per-screen layer came back after being retired on 2026-07-31.
 *   - **The ramp is a gradient again, and that is not a revert.** `constants/theme.ts`'s
 *     `computeRimGradient` was flattened one day earlier because a border should not simulate
 *     a light source. `computeBorderRamp` is not a light source: it stays inside the screen's
 *     own hue with no white and no black in it. Read that function's own doc before changing
 *     either of them.
 *   - `surfaceContext` ('ambient' | 'overlay' | 'nav') is kept in the API but **no longer
 *     changes a pixel** — every context is now the same opaque fill. It survives so the ~40
 *     call sites that pass it don't all need touching in this pass, and so a future
 *     "sheets should differ from cards" decision has somewhere to land. Don't wire new
 *     behaviour to it without asking; today it is documentation, not a switch.
 *   - **`settings.glassSurfaces` is inert for this component now.** It was the
 *     reduce-transparency a11y toggle, and the thing it reduced no longer exists — every
 *     surface is fully opaque unconditionally, which is the state that toggle was asking for.
 *     The setting and its DB column stay (this repo never drops columns) and other consumers
 *     still read it; Surface simply has nothing left to vary.
 *   - Depth is still `getLayeredShadow(theme.shadow)` — a three-pass `boxShadow` — and this
 *     view must NOT also set the `shadow*`/`elevation` keys (they would double up).
 *     `elevated` deepens it to the `floating` tier. Shadow was not part of the reset brief:
 *     a flat white card on a light backdrop needs *something* to sit on, and a shadow is the
 *     one depth cue that costs no colour.
 *   - `style` is split three ways: padding keys AND content-layout keys (alignItems,
 *     justifyContent, flexDirection, gap…) move to the inner content view; everything else
 *     non-owned (margin, width, flex, minHeight, borderRadius…) stays on the outer
 *     shadow-casting view; the mask `alignSelf:'stretch'`es to full width AND `flexGrow:1`s to
 *     full height. Routing content-layout inward is what stops the fill shrink-wrapping its
 *     children and floating as a narrower "box inside the box"; `flexGrow:1` is the height
 *     counterpart. Any backgroundColor, border or shadow key in `style` is intentionally
 *     dropped — those are owned here.
 *   - **A tappable card is a KEY**: pass `onPress` and Surface renders itself as a cap on a
 *     base — a stationary `darken(fill, 0.22)` slab behind the card, revealed as a `Travel.md`
 *     sliver by the wrapper's `paddingBottom`, with PressableScale's `travel` sinking the cap
 *     onto it. This is point 7 of the reset brief ("button states stay as designed") applied
 *     to cards, and is unchanged by it. `style` splits again on this path: whole-key sizing
 *     keys (`WRAPPER_KEYS`) move to the wrapper, or the base sticks out past the cap. Don't
 *     pass `depth` through to PressableScale — Surface owns its shadow and the two would fight.
 *   - **Reduced motion gets a static pressed COLOUR, not a sink.** With the flag set, `travel`
 *     is withheld and the fill drops to `theme.surfaceMuted` while held. The base slab is drawn
 *     in both modes — it's a static moulded edge, not an animation, so layout is identical.
 *   - **The design lab reaches three things here directly** (2026-08-06, lib/designLab.ts):
 *     the card's edge WIDTH, its ramp STRENGTH and its shadow DEPTH. All three are owned by
 *     this component — a caller's style can't set them (`OWNED_KEYS` drops them) and none comes
 *     from a `StyleSheet.create()` object, so `useScaledStyles`' geometry pass cannot reach
 *     them the way it reaches radius/padding everywhere else. `cardElevation` at its default
 *     resolves to `undefined` so the per-card `elevated` prop still decides — one global knob
 *     should not be able to flatten a deliberately-floating card. Inert until the lab is used.
 *   - **Per-corner radius**: pass standard RN `borderTopLeftRadius` etc. in `style` to square
 *     off individual corners (BottomNav squares its top corners). The outer view honours these
 *     already; the ring and mask need their own math, which is what `topLeftRadius` & co. below
 *     are for.
 */
import React from 'react';
import { AccessibilityRole, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_WIDTH, computeBorderRamp, darken, getLayeredShadow, Radius } from '@/constants/theme';
import { useLabShape } from '@/lib/useDesignLab';
import { Travel } from '@/constants/motion';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
import PressableScale from '@/components/PressableScale';

/**
 * Which backdrop this surface sits over. **Presentational no-op since the 2026-08-05 card
 * reset** — all three render identically (opaque fill, one border). Kept for the call sites
 * and as a place for a future sheets-differ-from-cards decision; see the Edit notes.
 */
export type SurfaceContext = 'ambient' | 'overlay' | 'nav';

type Props = {
  surfaceContext?: SurfaceContext;
  /** Non-default FILL base (e.g. theme.offWhite for an empty state). Opaque. */
  tint?: string;
  /**
   * Overrides the border hue, winning over the ambient screen hue. The one legitimate use is
   * a card that belongs to a DIFFERENT screen than the one it is drawn on — Home's preview
   * cards, which wear their source screen's colour so Home reads as an index of the others.
   * A card on its own screen should pass nothing and inherit.
   */
  borderColor?: string;
  /** Boosts this card's shadow to the `floating` tier — the focus/active pop. */
  elevated?: boolean;
  /**
   * Makes the whole card a key: Surface draws a base behind itself and sinks onto it on press,
   * rather than the caller wrapping it in its own scale-bouncing PressableScale. Prefer this
   * over `<PressableScale><Surface/></PressableScale>` — a card that shrinks reads as a
   * sticker, one that sinks reads as a key.
   */
  onPress?: () => void;
  /** Only meaningful with `onPress`. */
  onLongPress?: () => void;
  /** Only meaningful with `onPress`. Defaults to 'button'. */
  accessibilityRole?: AccessibilityRole;
  /** Only meaningful with `onPress`. */
  accessibilityLabel?: string;
  /** Only meaningful with `onPress` — greys the key and stops it responding. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const EDGE_WIDTH = BORDER_WIDTH.card;

/**
 * Exported for anything painting INSIDE the mask that needs the card's true inner corner —
 * components/CardAccent.tsx's badge plate is the one case — so it can compute the same inner
 * radius the mask gets (`radius - GLASS_EDGE_WIDTH`) instead of guessing the outer radius and
 * leaving an unpainted crescent in the corners. Name kept (rather than renamed to
 * BORDER_WIDTH.card) purely so that import doesn't churn; it is the same number.
 */
export const GLASS_EDGE_WIDTH = EDGE_WIDTH;

/**
 * The design lab's `cardElevation` knob → an `ElevationLevel`. Index 2 is the DEFAULT and maps
 * to `undefined` on purpose: it means "as shipped", i.e. fall through to the `elevated` prop's
 * own floating/raised decision, which is per-card and not something one global knob should
 * flatten. 0/1/3 override every card at once.
 */
const LAB_ELEVATION: Record<number, 'flat' | 'raised' | 'floating' | undefined> = {
  0: 'flat',
  1: 'raised',
  2: undefined,
  3: 'floating',
};

const PADDING_KEYS = new Set([
  'padding', 'paddingHorizontal', 'paddingVertical',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd',
]);

// How the caller wants its *children* laid out — belongs on the inner content view, not the
// outer shadow/border view. Putting these on the outer view made the inner mask shrink-wrap its
// content and float as a narrower "box inside the box".
const CONTENT_LAYOUT_KEYS = new Set([
  'alignItems', 'justifyContent', 'flexDirection', 'gap', 'rowGap', 'columnGap', 'flexWrap',
]);

// Key-press path only (`onPress`): keys that must size/place the WHOLE key — cap plus base —
// rather than just the cap. Leaving a margin or a `flex: 1` on the cap lets the base (absolutely
// positioned to the wrapper) stick out past the card. Radius, minHeight and the content keys
// deliberately stay on the card itself.
const WRAPPER_KEYS = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'alignSelf', 'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'width', 'minWidth', 'maxWidth',
  'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);

// Owned here, not by the caller — silently dropped from any passed-in style.
const OWNED_KEYS = new Set([
  'backgroundColor', 'borderWidth', 'borderColor', 'borderTopColor', 'borderBottomColor',
  'borderLeftColor', 'borderRightColor', 'borderStyle',
  'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation',
]);

export default function Surface({
  surfaceContext = 'ambient',
  tint,
  borderColor,
  elevated,
  onPress,
  onLongPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  disabled,
  style,
  children,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const screenHue = useScreenColor();
  const { reducedMotion } = useAccessibility();
  const isKey = !!onPress;
  // Reduced motion gets a static pressed COLOUR instead of a sink — travel is motion, and
  // useAccessibility() already ORs in the OS flag. Only tracked when actually needed, so the
  // normal path never re-renders on press.
  const [heldFlat, setHeldFlat] = React.useState(false);
  const staticPressed = isKey && reducedMotion && heldFlat && !disabled;

  // The page. Opaque, flat, no wash and nothing drawn on top of it — white (#FFFFFF) in light
  // mode, the flat navy `surface` in dark. This single line is most of the 2026-08-05 reset.
  const fill = staticPressed ? theme.surfaceMuted : (tint ?? theme.surface);
  // Border hue: explicit override → tint → the ambient screen hue → neutral grey. See the
  // Edit notes; Home and Settings deliberately land on the neutral.
  const edgeHue = borderColor ?? tint ?? screenHue ?? theme.border;
  // Design lab (lib/designLab.ts). Card thickness, ramp strength and shadow depth are OWNED by
  // this component — a caller's style can't set them (see OWNED_KEYS) and they don't come from
  // a StyleSheet, so `useScaledStyles`' geometry pass can't reach them. This is one of the four
  // components that therefore reads the shape override directly. All three knobs default to
  // exactly what the card shipped with, so this is inert until the lab is used.
  const shape = useLabShape();
  const edgeWidth = shape.borderCardWidth * shape.borderScale;
  const ramp = computeBorderRamp(edgeHue, isDark, 'card', shape.borderRampStrength);
  const shadowLevel = LAB_ELEVATION[shape.cardElevation] ?? (elevated ? 'floating' : 'raised');

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const wrapper: Record<string, unknown> = {};
  const padding: Record<string, unknown> = {};
  const content: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) {
    if (PADDING_KEYS.has(key)) padding[key] = flat[key];
    else if (CONTENT_LAYOUT_KEYS.has(key)) content[key] = flat[key];
    else if (OWNED_KEYS.has(key)) continue;
    // On the key path only, the whole-key sizing keys move to the cap+base wrapper.
    else if (isKey && WRAPPER_KEYS.has(key)) wrapper[key] = flat[key];
    else outer[key] = flat[key];
  }
  // The design lab's `radiusScale` is applied to the DEFAULT only, never to a radius the
  // caller passed in. **One owner per property** — a caller that runs its styles through
  // `useScaledStyles` has already had its `borderRadius` scaled by that same knob, so scaling
  // it again here would square the factor and round a card's corners twice as fast as a chip's.
  // A caller that does NOT use that hook keeps whatever radius it hard-coded; that is a known,
  // documented partial rather than a bug to "fix" by scaling here as well.
  const radius = (flat.borderRadius as number | undefined) ?? Radius.md * shape.radiusScale;
  const topLeftRadius = (flat.borderTopLeftRadius as number | undefined) ?? radius;
  const topRightRadius = (flat.borderTopRightRadius as number | undefined) ?? radius;
  const bottomLeftRadius = (flat.borderBottomLeftRadius as number | undefined) ?? radius;
  const bottomRightRadius = (flat.borderBottomRightRadius as number | undefined) ?? radius;
  // The mask's flexGrow:1 only exists to let the fill reach the floor of an outer view the
  // CALLER has explicitly forced taller than its content (minHeight/height/flex). For a
  // hug-content card (no such key — a small alignSelf:'center' pill), the outer view has no
  // definite main-axis size to distribute, and on Android that can resolve as the ScrollView's
  // unbounded measure spec instead of the content-hug behaviour web/iOS give it, growing the
  // chip into a full-height bar (2026-07-20 bug: the Habits "X / Y goals met today" chip).
  const growsToFillOuter = 'minHeight' in flat || 'height' in flat || 'flex' in flat || 'flexGrow' in flat;
  const maskGrowStyle = { flexGrow: growsToFillOuter ? 1 : 0 };
  // A caller's `flex`/`flexGrow` moved to the key wrapper (WRAPPER_KEYS), so the cap has to be
  // told to fill it or the card would hug its content inside a stretched housing.
  const capStretches = isKey && ('flex' in flat || 'flexGrow' in flat);
  if (capStretches) outer.flexGrow = 1;

  // ── Key-press housing ────────────────────────────────────────────────────────────────────
  // A tappable card is a CAP ON A BASE, exactly as Button/IconButton are: a stationary
  // `darken(fill, 0.22)` slab behind the card, revealed as a `Travel.md` sliver by the
  // wrapper's paddingBottom. `darken(fill)` (not the border hue) is deliberate — the base is
  // the card's own paper moulded darker, not a second accent.
  const keyBaseColor = darken(tint ?? theme.surface, 0.22);
  const asKey = (card: React.ReactElement) =>
    isKey ? (
      <View style={[styles.keyWrap, wrapper, { paddingBottom: Travel.md }]}>
        <View
          style={[
            styles.keyBase,
            {
              borderTopLeftRadius: topLeftRadius,
              borderTopRightRadius: topRightRadius,
              borderBottomLeftRadius: bottomLeftRadius,
              borderBottomRightRadius: bottomRightRadius,
              backgroundColor: keyBaseColor,
              opacity: disabled ? 0.45 : 1,
            },
          ]}
        />
        <PressableScale
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          // Reduced motion: no travel at all. The static pressed fill above and the base's own
          // edge carry the feedback instead. Since key mode became PressableScale's default
          // (2026-08-10), withholding `travel` is no longer how you say "don't move" — scale
          // mode is, and it self-disables under reduced motion.
          press={reducedMotion ? 'scale' : 'key'}
          travel={Travel.md}
          onPressIn={reducedMotion ? () => setHeldFlat(true) : undefined}
          onPressOut={reducedMotion ? () => setHeldFlat(false) : undefined}
          style={[capStretches ? styles.capStretch : null, { opacity: disabled ? 0.45 : 1 }]}
        >
          {card}
        </PressableScale>
      </View>
    ) : (
      card
    );

  const innerTopLeftRadius = Math.max(0, topLeftRadius - edgeWidth);
  const innerTopRightRadius = Math.max(0, topRightRadius - edgeWidth);
  const innerBottomLeftRadius = Math.max(0, bottomLeftRadius - edgeWidth);
  const innerBottomRightRadius = Math.max(0, bottomRightRadius - edgeWidth);

  // The border is drawn as a `LinearGradient` padding-ring rather than as a View's own
  // `borderColor`, for one specific reason worth keeping: RN's native border renderer doesn't
  // reliably blend two colours around a rounded corner (worse on Android), so a two-stop edge
  // set via border props can render the corner as a flat cut even when the fill looks properly
  // rounded. A gradient FILL clipped by borderRadius has no such problem on any platform. The
  // mask inside it carries the opaque page.
  return asKey(
    <View
      style={[
        outer,
        {
          borderTopLeftRadius: topLeftRadius,
          borderTopRightRadius: topRightRadius,
          borderBottomLeftRadius: bottomLeftRadius,
          borderBottomRightRadius: bottomRightRadius,
        },
        // 'flat' is the design lab's cardElevation 0 and means no shadow at all — there is no
        // flat tier in getLayeredShadow (it starts at 'raised'), so the pass is skipped rather
        // than asked for a zero-strength one.
        shadowLevel === 'flat' ? null : { boxShadow: getLayeredShadow(theme.shadow, shadowLevel) },
      ]}
    >
      <LinearGradient
        colors={ramp.colors}
        locations={ramp.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.ring,
          maskGrowStyle,
          {
            borderTopLeftRadius: topLeftRadius,
            borderTopRightRadius: topRightRadius,
            borderBottomLeftRadius: bottomLeftRadius,
            borderBottomRightRadius: bottomRightRadius,
            padding: edgeWidth,
          },
        ]}
      >
        <View
          style={[
            styles.mask,
            maskGrowStyle,
            {
              borderTopLeftRadius: innerTopLeftRadius,
              borderTopRightRadius: innerTopRightRadius,
              borderBottomLeftRadius: innerBottomLeftRadius,
              borderBottomRightRadius: innerBottomRightRadius,
              backgroundColor: fill,
            },
          ]}
        >
          <View style={[content, padding]}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // The gradient ring sits between the outer shadow-casting view and the mask, `padding:
  // EDGE_WIDTH` revealing itself as the border around it. alignSelf:'stretch' spans the full
  // card width; the HEIGHT counterpart (flexGrow) is conditional via `maskGrowStyle`.
  ring: { alignSelf: 'stretch' },
  // ── Key-press housing ───────────────────────────────────────────────────────────────────
  // The same two-part shape components/Button.tsx uses, so a pressed card and a pressed button
  // are the same object in two sizes rather than two techniques. `relative` is what the
  // absolutely-positioned base anchors to; the wrapper's own `paddingBottom: Travel.md`
  // (applied at the call site, since it depends on the travel distance) is what leaves the base
  // visible as a sliver under the resting cap.
  keyWrap: { position: 'relative' },
  // Fills the whole wrapper INCLUDING that padding, so the sliver shows along the bottom edge
  // and the base is flush on the other three — a moulded edge, not a drop shadow. It keeps its
  // full height while the cap sinks, which is what makes the travel read as the cap moving
  // rather than the whole card shrinking.
  keyBase: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // A caller's `flex`/`flexGrow` moved to the wrapper (WRAPPER_KEYS), so the cap needs telling
  // to fill the housing — without this the card hugs its content inside a stretched wrapper.
  capStretch: { flexGrow: 1, alignSelf: 'stretch' },
  // alignSelf:'stretch' so the fill always spans the full card WIDTH even when the caller's
  // style centres content on the outer view. The HEIGHT counterpart (flexGrow) is conditional
  // via `maskGrowStyle` above — see that comment for why it isn't baked in here.
  mask: { overflow: 'hidden', alignSelf: 'stretch' },
});
