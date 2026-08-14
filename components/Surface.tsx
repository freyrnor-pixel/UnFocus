/**
 * Surface.tsx — the one card shape: a frosted glass pane with a light-catching edge.
 * Also exported as `GlassCard`, the Tactile Glass brief's name for it (see the bottom).
 *
 * **Tactile Glass, 2026-08-15 (maintainer brief).** A card is a pane of dark glass floating
 * over the backdrop: a translucent fill (`theme.surfaceGlass`), ONE edge that catches the
 * light on its top-left and carries the control boundary on its bottom-right
 * (`getGlassEdge`), and — where there is genuinely something behind it to smear — a real
 * `BlurView`. Colour comes from a 5% screen-hue wash on the pane, never from the edge.
 *
 * ⚠️ **This REVERSES the 2026-08-05 card reset, which this header used to describe** ("a flat
 * opaque page… no frost, no BlurView, no translucent wash, no beveled rim"), and it reverses
 * that pass's flat-rim decision too, since a light-catching edge is by definition a simulated
 * light source. Both were deliberate, and both were re-put to the maintainer before this was
 * written — `DESIGN_COMPARISON/16-solid-pressable-materials.md` §2 required exactly that
 * ("a maintainer conversation and a separate PR — not a quiet test edit"). Read that file's
 * 2026-08-15 addendum and DESIGN_RULES_AUDIT.md before reverting any of it on the authority
 * of the older entries; they are history now, not current state.
 *
 * Three things about the new material that are load-bearing and not obvious:
 *   - **The fill is a pair.** `surfaceGlass` is what gets PAINTED; `surface` is the same
 *     colour already composited over the backdrop, and is what every contrast test measures.
 *     They are derived from each other by construction — dark's alpha was chosen so the
 *     composite lands exactly on the `#1E1E1E` the palette already had, which is why not one
 *     dark token moved in this pass. Change one, re-derive the other.
 *   - **The edge is the boundary now.** A translucent pane can't reach light mode's `#FFFFFF`
 *     ceiling, so the bg↔surface fill step fell to 1.170 and DESIGN_RULES.md rule 10b relaxed
 *     its floor. The compensation is that the edge's shade stop is plain `theme.border` at
 *     full strength, clearing WCAG 1.4.11's 3:1 against both the page and the pane — a
 *     measured boundary where the fill step was only ever an assumed one. Don't fade it.
 *   - **Blur is contextual, not global.** See the comment at the BlurView itself.
 *
 * Connections:
 *   Imports → constants/theme (BORDER_WIDTH, darken, getGlassEdge, getGlassFill,
 *             getLayeredShadow, Radius, SCREEN_TINT), constants/motion (Travel),
 *             lib/useAppTheme (useAppTheme, useIsDark, useAccessibility), lib/screenColor
 *             (useScreenColor), lib/useDesignLab (useLabShape — the design lab's geometry,
 *             see Edit notes), store/useSettingsStore (glassSurfaces),
 *             components/PressableScale, expo-linear-gradient, expo-blur
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
 *   - **The EDGE is neutral on every screen; the screen's colour is a WASH on the pane.** This
 *     is the 2026-08-15 ruling and it inverts what this note said for the ten days before it.
 *     `theme.border` is the edge in every mode and on every screen. The identity hue resolves
 *     `borderColor` (an explicit override — Home's preview cards pass their source screen's
 *     hue this way) → `tint` → the ambient screen hue from lib/screenColor.ts, and is painted
 *     as a `SCREEN_TINT` (5%) layer inside the mask. Home and Settings supply no hue on
 *     purpose and get no wash at all. lib/screenColor.ts is NOT retired by this — it was
 *     retired once before, in 2026-07-31's addendum A.5, precisely for having no consumers,
 *     and it has two here (this wash and the icon badge).
 *   - **The edge simulates a light source, deliberately.** That is the direct reversal of the
 *     2026-08-05 flat-rim pass, whose stated reason was that a border should not. It is the
 *     brief's central image ("an old UI trick… it perfectly simulates a light source hitting
 *     the physical edge of a piece of glass"). `computeBorderRamp`/`computeBorderTone` still
 *     exist and still work; they simply have no consumer here any more.
 *   - **`surfaceContext` ('ambient' | 'overlay' | 'nav') is a REAL SWITCH again**, for the
 *     first time since 2026-08-05, and it decides two things: which of the two glass tokens
 *     the pane uses, and whether a `BlurView` is mounted at all. This is the "future 'sheets
 *     should differ from cards' decision" the prop was explicitly kept alive for — so a caller
 *     that has been passing it decoratively is now passing it meaningfully. Check the value is
 *     right when you touch a sheet or a nav surface.
 *   - **`settings.glassSurfaces` is LIVE again** (it was inert here from 2026-08-05, because
 *     everything was already opaque — the state that toggle asks for). Off ⇒ the opaque
 *     composite and no BlurView anywhere. It needs no new copy: the shipped EN/NO strings
 *     already describe exactly this ("Frosted glass finish on cards, buttons and the add
 *     button. Turn off for plain, solid surfaces"). A caller-supplied `tint` also stays
 *     opaque — those callers want that exact colour, not a frosted approximation of it.
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
import { BlurView } from 'expo-blur';
import {
  BORDER_WIDTH,
  darken,
  getGlassEdge,
  getGlassFill,
  getLayeredShadow,
  Radius,
  SCREEN_TINT,
} from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
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
  // `onLayout` lived here from 2026-08-10 to 2026-08-11, forwarded to the outer
  // (shadow/border) view for components/BottomNav.tsx, which sizes its indicator pill to fit
  // inside the bar. It measured the WRONG box for that job — the outer view is
  // `2 × EDGE_WIDTH` bigger than the mask that clips the children, so the bar's sums came out
  // 3px optimistic and Home's ring landed 1px off the mask. BottomNav measures an
  // `absoluteFill` probe rendered beside its pill now (guaranteed to share the pill's own
  // containing block), and this prop went with its only caller. If a card ever does need its
  // painted box, add it back — but read that file's note first, because "the Surface's box"
  // and "the box a child is positioned in" are not the same rectangle.
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

  // ── The pane (Tactile Glass, 2026-08-15) ────────────────────────────────────────────────
  // A frosted pane, not an opaque page. `glassSurfaces` is the user's reduce-transparency
  // switch and is LIVE again — it went inert in the 2026-08-05 reset because everything was
  // already opaque, which was the state it asked for. Off ⇒ `theme.surface`, which is the
  // SAME colour already composited over the backdrop, so turning glass off changes what is
  // drawn and never what colors.test.ts measures.
  //
  // `tint` (a caller-supplied fill) still wins outright and stays opaque: its callers pass a
  // specific colour because they need that exact colour, not a frosted approximation of it.
  const glassOn = useSettingsStore((s) => s.glassSurfaces) && !tint;
  const glassFill = surfaceContext === 'ambient' ? theme.surfaceGlass : theme.surfaceGlassStrong;
  const fill = staticPressed
    ? theme.surfaceMuted
    : tint ?? getGlassFill(glassFill, theme.surface, glassOn);
  // ── Where the screen's colour went ──────────────────────────────────────────────────────
  // The 2026-08-15 ruling took the identity hue OFF the card edge, which is now neutral in
  // every screen. It did not delete lib/screenColor.ts: the hue moved into this faint
  // `SCREEN_TINT` wash over the pane, and into the icon badge (lib/domainColor.ts), which is
  // the loud half. `borderColor`/`tint` still override, so Home's preview cards keep passing
  // their SOURCE screen's hue and still read as belonging to that screen.
  const tintHue = borderColor ?? tint ?? screenHue;
  // The edge is neutral in every mode and on every screen — see getGlassEdge's doc. Its shade
  // stop is plain `border` at full strength, which is what carries WCAG 1.4.11's 3:1 now that
  // rule 10b has relaxed the bg↔surface fill step.
  const edgeHue = theme.border;
  // Design lab (lib/designLab.ts). Card thickness, ramp strength and shadow depth are OWNED by
  // this component — a caller's style can't set them (see OWNED_KEYS) and they don't come from
  // a StyleSheet, so `useScaledStyles`' geometry pass can't reach them. This is one of the four
  // components that therefore reads the shape override directly. All three knobs default to
  // exactly what the card shipped with, so this is inert until the lab is used.
  const shape = useLabShape();
  const edgeWidth = shape.borderCardWidth * shape.borderScale;
  const ramp = getGlassEdge(edgeHue, isDark, 'card', shape.borderRampStrength);
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
        // Diagonal, from getGlassEdge — a vertical sweep would light the top edge and leave
        // the left one dark, and the brief asks for both. `?? ` keeps the older RimGradient
        // producers (computeRimGradient/computeBorderRamp) rendering vertically as they always
        // did, since neither sets these.
        start={ramp.start ?? { x: 0, y: 0 }}
        end={ramp.end ?? { x: 0, y: 1 }}
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
          {/* ── Blur, and only where there is something to blur ──────────────────────────
              An `overlay`/`nav` surface floats above real scrolling content, so a BlurView
              genuinely bleeds it through the pane — that is the effect the brief describes,
              and it is why `surfaceContext` was kept in the API through the 2026-08-05 reset
              ("a future 'sheets should differ from cards' decision has somewhere to land").
              An `ambient` content card has the BACKDROP behind it, which in dark mode is pure
              black: blurring black returns black, so a BlurView under all ~59 cards would be
              pure GPU cost on a scrolling list for zero visible difference. The translucent
              wash alone composites to the identical colour. This is the brief's own "use
              expo-blur OR semi-transparent hex codes", resolved per context.
              Android below API 31 degrades this to a flat translucent overlay — i.e. exactly
              the ambient treatment — so the fallback is graceful rather than broken. */}
          {glassOn && surfaceContext !== 'ambient' ? (
            <BlurView
              intensity={BLUR_INTENSITY}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          {/* The screen's identity, at the weight a pane can carry without competing with its
              own content. Painted as its own layer rather than mixed into `fill` because a hue
              cannot be mixed into an rgba() string — and because as a separate layer it
              composites the same whether the fill under it is glass or opaque. */}
          {tintHue ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: tintHue, opacity: SCREEN_TINT }]}
              pointerEvents="none"
            />
          ) : null}
          <View style={[content, padding]}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

/**
 * How hard the overlay/nav blur bites. Tuned against `surfaceGlassStrong` rather than chosen —
 * the wash already carries most of the pane's opacity, so the blur only has to smear whatever
 * shows through the remaining ~12–15%. Higher reads as frosted plastic and costs more on
 * Android, where this is a real render-effect pass on every frame the sheet is on screen.
 */
const BLUR_INTENSITY = 28;

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

/**
 * `<GlassCard>` — the Tactile Glass brief's name for this component (2026-08-15, brief §5:
 * "build reusable primitive components so the styling isn't repeated across screens").
 *
 * Deliberately an ALIAS and not a second component. `Surface` already is the app's one card
 * primitive with ~59 call sites, and the brief's actual requirement — that the material lives
 * in one place rather than being re-typed per screen — has been satisfied by this file since
 * the 2026-08-05 reset. Forking a parallel `GlassCard` would have left those 59 sites on the
 * old shape and given the app two card implementations, which is the exact failure the brief
 * is written against. So the name is the deliverable; the implementation is right here.
 *
 * Prefer importing `Surface` in app code — every existing call site does, and one name in the
 * imports is easier to grep than two. This export is for new code written against the brief's
 * vocabulary, and for the design-system docs.
 */
export const GlassCard = Surface;
