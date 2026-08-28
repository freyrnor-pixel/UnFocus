/**
 * Surface.tsx — the one card shape: a frosted glass pane with a light-catching edge.
 * Also exported as `GlassCard`, the Tactile Glass brief's name for it (see the bottom).
 *
 * **Tactile Glass, 2026-08-15 (maintainer brief).** A card is a pane of dark glass floating
 * over the backdrop: a translucent fill (`theme.surfaceGlass`), ONE edge that catches the
 * light on its top-left (`getGlassEdge`), and a real `BlurView`. Colour comes from a 5%
 * screen-hue wash on the pane, never from the edge.
 *
 * **Amended 2026-08-16 (the neon/OLED brief).** Two clauses above changed, and this header used
 * to state their opposites — that the edge "carries the control boundary on its bottom-right",
 * and that the blur mounts only "where there is genuinely something behind it to smear". On a
 * dark CARD the edge now fades to nothing, which is what makes a pane read as thick glass lit
 * from above-left rather than as a drawn frame; and every pane blurs. Both are scoped: the fade
 * is cards-in-dark only (a field or a button still identifies a control and keeps its 3:1
 * boundary, and light's pane has only a 1.17 fill step to distinguish it from the page), and
 * the blur is lighter on ambient panes than on overlays. See constants/theme.ts's GLASS_EDGE
 * block and the BlurView comment below for the full reasoning on each.
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
 *   - ⚠️ **The edge is a real per-side BORDER, not a gradient ring (2026-08-27, round 20) — and
 *     the reason is the worst defect this file has had.** User report, against a build:
 *     *"This looks too stale, not like glass."*
 *
 *     The ring was a full-area `LinearGradient` with the fill mask inside it, inset by
 *     `padding: edgeWidth`. That works only while the mask is OPAQUE, which is what the comment
 *     at the render site said it was. It stopped being opaque on 2026-08-15, when the fill
 *     became `theme.surfaceGlass` — `rgba(255,255,255,0.1412)`, i.e. **86% transparent**. So
 *     ~86% of the edge ramp showed through the ENTIRE pane, and every card in the app was a
 *     diagonal grey wash rather than a flat piece of glass with a lit edge.
 *
 *     Measured on the Habits card at 390px, sampling its interior along the diagonal:
 *     `rgb(75,70,82)` at the top-left running to `rgb(135,135,148)` at the bottom-right, where
 *     the design intends a flat `rgb(36,36,36)` everywhere. Two to four times too light, with a
 *     gradient across it.
 *
 *     ⚠️ **And it meant every contrast assertion in the app was measuring a colour no card
 *     drew.** `__tests__/glassMaterial.test.ts` and `lib/__tests__/colors.test.ts` check against
 *     `#242424`, where the five identity hues measure 11.07 / 8.94 / 7.13 / 5.71 / 4.51 and
 *     white text 15.52. On the pane as actually drawn: at the centre every one of the five fails
 *     AA (4.06 / 3.28 / 2.62 / 2.09 / 1.66) and at the bottom-right **white body text falls to
 *     3.55:1**, under AA for normal text. The suite stayed green throughout. This is the PR #540
 *     shape at full scale, and it is why "a comment asserting a safety property is a claim to
 *     verify, not a fact to trust" is the first entry in AGENTS.md's gotchas.
 *
 *     What the fix gives up: a gradient can blend two colours around a corner and per-side
 *     borders cannot. That is real and it is small — a 1.5px stroke changing colour over a 16px
 *     arc is not perceptible — and it was never worth washing the pane to get.
 *     `__tests__/glassMaterial.test.ts` now asserts the pane is painted by ONE flat fill with no
 *     gradient behind it.
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
 *             getLayeredShadow, Radius), constants/motion (Travel),
 *             lib/useAppTheme (useAppTheme, useIsDark, useAccessibility),
 *             lib/useDesignLab (useLabShape — the design lab's geometry,
 *             see Edit notes), store/useSettingsStore (glassSurfaces, opaqueCards),
 *             components/PressableScale, expo-linear-gradient, expo-blur
 *   Used by → every screen that renders a card (grep `<Surface`). Callers passing `onPress`
 *             (the key-press path): components/OpenEpisodeCard, app/health-log,
 *             app/health-detail, app/scan. **components/CollapsedSection doesn't use this
 *             path**: it is a card whose HEADER is tappable, not one tappable card, so the
 *             press lives on the header's own PressableScale. (Its predecessor
 *             SubScreenLinkButton left this list on 2026-08-08 for the same reason, and was
 *             deleted on 2026-08-10.)
 *   Data    → reads `reducedMotion` via useAccessibility(). It no longer reads the ambient
 *             screen hue at all (useScreenColor left this file on 2026-08-20 with the wash).
 *
 * Edit notes:
 *   - **A CARD IS WHITE GLASS. It carries no screen colour at all (2026-08-20).** The edge is
 *     `theme.border` in every mode and on every screen (2026-08-15), and the 5% identity-hue
 *     wash that ruling moved onto the pane is now deleted too — see the block at the fill, and
 *     `SCREEN_TINT`'s obituary in constants/theme.ts, for why the ladder's brightest rung is
 *     what killed it. The `borderColor` PROP went with it: its whole job was feeding that wash
 *     a hue, and a prop that resolves to nothing drawn is worse than no prop. Home's preview
 *     cards, which were its one legitimate caller, still read as belonging to their source
 *     screen — they pass the same hue to `CardAccentBadge accentOverride` and to their count
 *     Badge, which is where a card's identity has been loud since 2026-08-15.
 *   - **A coloured card edge was exported and rejected in the same pass**, so it is not the
 *     obvious next thing to try. It also cannot simply be a colour in the ramp: the ring is a
 *     full-area gradient behind a translucent mask, so a saturated hue in it washes the pane
 *     instead of edging it.
 *   - **The edge simulates a light source, deliberately.** That is the direct reversal of the
 *     2026-08-05 flat-rim pass, whose stated reason was that a border should not. It is the
 *     brief's central image ("an old UI trick… it perfectly simulates a light source hitting
 *     the physical edge of a piece of glass"). `computeBorderRamp`/`computeBorderTone` still
 *     exist and still work; they simply have no consumer here any more.
 *   - **`surfaceContext` ('ambient' | 'overlay' | 'nav') is a REAL SWITCH again**, for the
 *     first time since 2026-08-05. It decides which of the two glass tokens the pane uses and
 *     how hard its blur bites. This is the "future 'sheets should differ from cards' decision"
 *     the prop was explicitly kept alive for — so a caller that has been passing it
 *     decoratively is now passing it meaningfully. Check the value is right when you touch a
 *     sheet or a nav surface.
 *     **It no longer decides WHETHER a BlurView mounts (2026-08-16, brief §2)** — every pane
 *     blurs now; see the comment at the BlurView itself for why the ambient exclusion lost.
 *     **...except `overlay` (2026-08-18) and `nav` (2026-08-20), which are opaque**, maintainer:
 *     *"Cards that overlap other cards should never be translucent."* A sheet has the app's own
 *     CARDS behind it by construction; the nav bar joined it when the clip window went back to
 *     the chrome's OUTER footprint so a scrolled card could show in the bar's corner notches
 *     (components/ScreenScaffold.tsx, 2026-08-20) — the same condition, so the same answer. An
 *     ambient card still frosts: it sits in a vertical list that never overlaps itself. So this
 *     is a narrowing of the every-pane rule by two named contexts, not a re-opening of the
 *     ambient argument. `theme.surfaceRaised` is `surfaceGlassStrong` already composited, so a
 *     sheet or a bar over empty backdrop is unchanged.
 *   - **`settings.glassSurfaces` is LIVE again** (it was inert here from 2026-08-05, because
 *     everything was already opaque — the state that toggle asks for). Off ⇒ the opaque
 *     composite and no BlurView anywhere. It needs no new copy: the shipped EN/NO strings
 *     already describe exactly this ("Frosted glass finish on cards, buttons and the add
 *     button. Turn off for plain, solid surfaces"). A caller-supplied `tint` also stays
 *     opaque — those callers want that exact colour, not a frosted approximation of it.
 *   - **`settings.opaqueCards` is the CARD-ONLY version of that switch** (2026-08-15), added so
 *     the maintainer can A/B this material against a solid one. It is NOT a duplicate of
 *     `glassSurfaces` and the difference is the whole reason it exists: `glassSurfaces` is the
 *     global reduce-transparency mode and also restyles buttons, the FAB, sheets, the header
 *     and the nav, so flipping it changes several materials at once and can't answer "is the
 *     CARD better solid?". This one gates on `surfaceContext === 'ambient'`, which is exactly
 *     the content-card population, and leaves every chrome surface frosted.
 *     Three ordering facts, all of them load-bearing: `glassSurfaces` still wins outright (off
 *     ⇒ opaque everywhere regardless of this); `tint` still wins over both; and the opaque fill
 *     is `theme.surface`, the SAME colour `surfaceGlass` already composites to, so this changes
 *     what is drawn and never what `colors.test.ts` measures. It defaults OFF — glass is the
 *     shipped look and this is the experiment, not the other way round.
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
 *   - **⚠️ Nothing in this component may allocate per render without a reason (2026-08-28,
 *     perf).** This file had no `useMemo` at all while being the app's single card shape, so
 *     every render of every card ran `StyleSheet.flatten` + a key-partition loop over the
 *     caller's style, and minted a fresh `getGlassEdge` object (two arrays), a fresh
 *     `getLayeredShadow` array (three objects) and three identical radius literals. The
 *     allocation was the smaller half: `boxShadow` got a NEW VALUE IDENTITY every render, so
 *     Fabric re-committed a three-layer shadow even when nothing had changed — across ~60
 *     cards, on every store write, and on every foreground (app/_layout.tsx reloads three
 *     stores on `AppState: 'active'`, which gives every subscriber new array identities).
 *     The five memos below are all keyed on already-stable deps, so for a normal user they
 *     compute once and hold one reference for the app's lifetime.
 *       **What this deliberately does NOT do is `React.memo` the component.** `children` is
 *     fresh JSX on every parent render, so the wrapper would buy nothing without also making
 *     ~105 call sites stop passing inline `style` arrays — a wide mechanical change with real
 *     stale-render risk that no harness in this repo can see. The `style`-keyed memo above has
 *     the same caveat in miniature and says so at its own call site: a caller passing
 *     `styles.card` gets the pass for free, a caller passing `[styles.card, {gap: 4}]` does
 *     not. Don't read the stable dep lists as a claim that every call site benefits.
 *   - **Per-corner radius**: pass standard RN `borderTopLeftRadius` etc. in `style` to square
 *     off individual corners (BottomNav squares its top corners). The outer view honours these
 *     already; the mask and the key base need the same four corners, which is what the memoised
 *     `radii` object below is for (it was three identical inline literals until 2026-08-28).
 */
import React, { useMemo } from 'react';
import { AccessibilityRole, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  BORDER_WIDTH,
  darken,
  getGlassEdge,
  getGlassFill,
  getLayeredShadow,
  Radius,
} from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useLabShape } from '@/lib/useDesignLab';
import { Travel } from '@/constants/motion';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
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
  //
  // `opaqueCards` (2026-08-15) is the third input and the NARROWEST: it takes the frost off
  // content cards only, leaving sheets, the header and the nav frosted, so the card material
  // can be judged without also changing the chrome around it. `glassSurfaces` still wins —
  // with it off, everything here is opaque whatever this says. See the Edit notes.
  const glassPref = useSettingsStore((s) => s.glassSurfaces);
  const opaqueCards = useSettingsStore((s) => s.opaqueCards);
  const isAmbient = surfaceContext === 'ambient';
  // ── An overlay pane is OPAQUE (2026-08-18), and so is the nav bar (2026-08-20) ──────────
  // Maintainer, against a screenshot of the card menu: *"Cards that overlap other cards should
  // never be translucent."* A sheet/modal has the app's own cards behind it by construction, so
  // frost there isn't depth, it's the card underneath showing through: the shot had "Handleliste"
  // and its green badge legible twice over, and the nav's five labels reading through the Done key.
  //   **`nav` joined it on 2026-08-20**, and the reason is that the sentence this comment used to
  // end with expired. It said the chrome "has nothing but backdrop behind it to reveal" — true
  // only while components/ScreenScaffold.tsx clipped content at the chrome's INNER edges. The
  // maintainer then asked for the header and the bar to *"only have rounded corners"* with *"the
  // corners show[ing] content behind it"*, which requires content to travel behind the chrome
  // again — so the bar has the app's own cards behind it now, exactly like a sheet, and takes the
  // same answer. (`components/ScreenHeader.tsx` doesn't route through Surface and paints its own
  // opaque fill for the same reason.) An `ambient` card still frosts: it sits in a vertical list
  // that never overlaps itself.
  const overlapsCards = surfaceContext === 'overlay' || surfaceContext === 'nav';
  const glassOn = glassPref && !tint && !overlapsCards && !(isAmbient && opaqueCards);
  const glassFill = isAmbient ? theme.surfaceGlass : theme.surfaceGlassStrong;
  // The opaque half follows the same tier as the glass half, so turning frost off (here, or via
  // `glassSurfaces`) changes what is drawn and never how bright the surface reads. `nav`'s
  // fallback used to be `surface` — one rung darker than the frost it replaced.
  const opaqueFill = isAmbient ? theme.surface : theme.surfaceRaised;
  const fill = staticPressed
    ? theme.surfaceMuted
    : tint ?? getGlassFill(glassFill, opaqueFill, glassOn);
  // ── The pane carries NO screen colour (2026-08-20) ──────────────────────────────────────
  // A card is plain white glass on every screen. What used to be here was the 2026-08-15
  // ruling's other half: the identity hue, taken off the edge and repainted as a 5%
  // `SCREEN_TINT` wash across the whole pane. It failed on the brightest rung of the ladder —
  // 5% of To-do's gold `#FFD700` over `#000000` composites to olive, and it covers the card
  // rather than marking it, so the tab whose hue is most visible was the tab whose cards
  // looked dirtiest. Maintainer, against three exported builds: *"I do not like the yellow
  // card glass look. White glass with color elements might be better."*
  //   The hue is not gone from the screen, only from the pane: the icon badge
  // (lib/domainColor.ts) was always the LOUD half and is untouched, and the composer's focus
  // ring, the primary key's halo and the active nav tab all still wear it. What this gives up
  // is the quiet half — a card no longer says which screen it is on when nothing else on it
  // does — and that is the accepted trade, not an oversight.
  //   A coloured card EDGE was exported beside this and rejected in the same pass. It is not
  // the cheap version of this change to fall back on: the edge is a `LinearGradient` ring
  // sitting BEHIND a translucent mask, so a saturated hue in it bleeds across the whole pane
  // exactly like the wash did (measured, not reasoned about — the first export drew a fully
  // gold card). Drawing it as a real border instead works, and was still a no.
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
  // ── Memoised: these two were the app's largest per-render allocation (2026-08-28, perf) ──
  // `getGlassEdge` mints an object holding two fresh arrays and `getLayeredShadow` an array of
  // three fresh objects, and this component ran BOTH on every render of every card, with no
  // memo anywhere in the file. The allocation was the smaller half of the cost: because
  // `boxShadow` got a NEW VALUE IDENTITY each time, Fabric re-committed a three-layer shadow to
  // the shadow node on every render even when nothing about it had changed — across ~60 cards,
  // on every store write, and (see app/_layout.tsx's AppState handler) on every foreground.
  // Every dep here is already stable per theme/lab state, so for a normal user these now
  // compute once and keep one reference for the app's lifetime.
  const ramp = useMemo(
    () => getGlassEdge(edgeHue, isDark, 'card', shape.borderRampStrength),
    [edgeHue, isDark, shape.borderRampStrength],
  );
  const shadowLevel = LAB_ELEVATION[shape.cardElevation] ?? (elevated ? 'floating' : 'raised');
  // 'flat' is the design lab's cardElevation 0 and means no shadow at all — there is no flat
  // tier in getLayeredShadow (it starts at 'raised'), so the pass is skipped rather than asked
  // for a zero-strength one.
  const shadowStyle = useMemo(
    () => (shadowLevel === 'flat' ? null : { boxShadow: getLayeredShadow(theme.shadow, shadowLevel) }),
    [theme.shadow, shadowLevel],
  );

  // ── Memoised: the flatten + key-partition pass (2026-08-28, perf) ──────────────────────
  // `StyleSheet.flatten` walks a (usually nested) array and allocates, then this loop allocates
  // four more objects and visits every key the caller passed. It ran on every render of every
  // card. Keyed on the `style` prop and `isKey` — nothing else here reads anything else.
  //   ⚠️ **This is worth exactly as much as the caller's `style` identity is stable**, and a
  // caller passing an inline array (`style={[styles.a, {gap: 4}]}`) mints a new one every
  // render and gets nothing. That is the wide, mechanical call-site change this deliberately
  // does NOT make; a caller passing a plain `styles.card` reference — most of them — gets the
  // whole pass for free from here. Don't read a stable dep list as a claim that every call site
  // benefits.
  const { flat, outer, wrapper, padding, content, capStretches, maskGrowStyle } = useMemo(() => {
    const f = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
    const o: Record<string, unknown> = {};
    const w: Record<string, unknown> = {};
    const p: Record<string, unknown> = {};
    const c: Record<string, unknown> = {};
    for (const key of Object.keys(f)) {
      if (PADDING_KEYS.has(key)) p[key] = f[key];
      else if (CONTENT_LAYOUT_KEYS.has(key)) c[key] = f[key];
      else if (OWNED_KEYS.has(key)) continue;
      // On the key path only, the whole-key sizing keys move to the cap+base wrapper.
      else if (isKey && WRAPPER_KEYS.has(key)) w[key] = f[key];
      else o[key] = f[key];
    }
    // A caller's `flex`/`flexGrow` moved to the key wrapper (WRAPPER_KEYS), so the cap has to
    // be told to fill it or the card would hug its content inside a stretched housing. Set
    // HERE rather than by mutating `o` after the memo — the old code did exactly that, which
    // was harmless only because the write happened to be idempotent.
    const stretches = isKey && ('flex' in f || 'flexGrow' in f);
    if (stretches) o.flexGrow = 1;
    // The mask's flexGrow:1 only exists to let the fill reach the floor of an outer view the
    // CALLER has explicitly forced taller than its content (minHeight/height/flex). For a
    // hug-content card (no such key — a small alignSelf:'center' pill), the outer view has no
    // definite main-axis size to distribute, and on Android that can resolve as the
    // ScrollView's unbounded measure spec instead of the content-hug behaviour web/iOS give
    // it, growing the chip into a full-height bar (2026-07-20 bug: the Habits "X / Y goals met
    // today" chip).
    const grows = 'minHeight' in f || 'height' in f || 'flex' in f || 'flexGrow' in f;
    return {
      flat: f, outer: o, wrapper: w, padding: p, content: c,
      capStretches: stretches,
      maskGrowStyle: { flexGrow: grows ? 1 : 0 },
    };
  }, [style, isKey]);
  // The design lab's `radiusScale` is applied to the DEFAULT only, never to a radius the
  // caller passed in. **One owner per property** — a caller that runs its styles through
  // `useScaledStyles` has already had its `borderRadius` scaled by that same knob, so scaling
  // it again here would square the factor and round a card's corners twice as fast as a chip's.
  // A caller that does NOT use that hook keeps whatever radius it hard-coded; that is a known,
  // documented partial rather than a bug to "fix" by scaling here as well.
  // One object, memoised, for the three views that all need the same four corners (the key
  // base, the outer shadow-caster, the mask). It was three identical inline literals, i.e.
  // three fresh objects per render per card.
  const radii = useMemo(() => {
    const r = (flat.borderRadius as number | undefined) ?? Radius.md * shape.radiusScale;
    return {
      borderTopLeftRadius: (flat.borderTopLeftRadius as number | undefined) ?? r,
      borderTopRightRadius: (flat.borderTopRightRadius as number | undefined) ?? r,
      borderBottomLeftRadius: (flat.borderBottomLeftRadius as number | undefined) ?? r,
      borderBottomRightRadius: (flat.borderBottomRightRadius as number | undefined) ?? r,
    };
  }, [flat, shape.radiusScale]);

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
            radii,
            {
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

  // ⚠️ **The border was a `LinearGradient` padding-ring until 2026-08-27, and that is the bug
  // this file's header documents.** The reason it existed is still true — RN's native border
  // renderer does not reliably BLEND two colours around a rounded corner, where a gradient fill
  // clipped by `borderRadius` has no such problem — but the sentence that made it safe stopped
  // being true on 2026-08-15 and nobody noticed: "the mask inside it carries the opaque page".
  // The mask stopped being opaque when the fill became `surfaceGlass`, and a full-area gradient
  // behind an 86%-transparent mask is a wash, not a ring.
  //   Per-side border colours are what `glassKey()` has used on every button in the app since
  // the 2026-08-17 matte pass, so the card is on the technique the codebase already had.
  return asKey(
    <View
      style={[
        outer,
        radii,
        shadowStyle,
      ]}
    >
        <View
          style={[
            styles.mask,
            maskGrowStyle,
            radii,
            {
              backgroundColor: fill,
              // ⚠️ **The edge is a real BORDER, per side — it is not a gradient any more
              // (2026-08-27, round 20).** See this file's header for the measurement; the short
              // version is that a full-area `LinearGradient` behind an 86%-transparent fill is
              // not a ring, it is a wash over the whole pane, and it was the "clouded / milky /
              // not glass" report.
              //   Two colours, top-left lit and bottom-right shaded, is exactly what
              // `glassKey()` already does on every button in the app, so this is the technique
              // the codebase had rather than a new one. What it gives up is the BLEND around a
              // corner that only a gradient can do — the reason the ring existed. That is a
              // real loss and a small one: a 1.5px stroke changing colour over a 16px arc is
              // not perceptible, and it was never worth washing the pane to get.
              borderWidth: edgeWidth,
              borderTopColor: ramp.colors[0],
              borderLeftColor: ramp.colors[0],
              borderBottomColor: ramp.colors[ramp.colors.length - 1],
              borderRightColor: ramp.colors[ramp.colors.length - 1],
            },
          ]}
        >
          {/* ── Blur, on every pane except an overlay (2026-08-16, narrowed 2026-08-18) ───
              *"All cards MUST be translucent. Use expo-blur as the absolute foundation for
              every card."* This REVERSES the 2026-08-15 decision to mount a BlurView only on
              `overlay`/`nav`, which this comment used to defend at length. That argument is
              worth keeping rather than deleting, because it is still half true:

              An ambient content card sits on the BACKDROP, and in dark mode that backdrop is
              `#000000` (ScreenBackground's DARK.base is three black stops with both radial
              glows at 0). Blurring black returns black. So over the middle of a dark screen
              this genuinely does nothing visible, and it is not free — on Android this is a
              real render-effect pass per frame per card, on the scrolling lists that make up
              most of the app.

              What the old argument MISSED, and why it lost: "the backdrop" is not uniformly
              black. `components/ScreenBackground.tsx` draws edge-anchored branch-and-leaf art,
              cards overlap each other while scrolling, and — the case that actually settles it
              — light mode's backdrop is a real gradient the whole way across. A card that
              blurs on a sheet and doesn't on a list is two materials, which is the exact thing
              the brief is written against.

              Two mitigations rather than none, so the cost is bounded:
                · `BLUR_AMBIENT` is roughly half `BLUR_STRONG` — an ambient pane's own wash
                  already carries most of its opacity, so the blur only has to smear the last
                  of it, and a lighter pass is measurably cheaper.
                · `glassSurfaces` (the reduce-transparency toggle) still removes all of it, so
                  a user on a slow device has one switch that turns the whole effect off.
              Android below API 31 degrades a BlurView to a flat translucent overlay — i.e.
              exactly the old ambient treatment — so the fallback is graceful, not broken.

              ⚠️ **`overlay` left this rule on 2026-08-18** (`overlapsCards` clears `glassOn`
              above, which takes the fill AND this blur in one gate — an opaque fill with a live
              BlurView over it would still smear the card behind onto the pane, i.e. the bug in
              a form that looks half-fixed). That is a narrowing by one context, not the ambient
              argument re-opened: what settles each tier is what is BEHIND it, and a sheet is
              the only one with the app's own cards there. See the `overlapsCards` comment. */}
          {glassOn ? (
            <BlurView
              intensity={isAmbient ? BLUR_AMBIENT : BLUR_STRONG}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          <View style={[content, padding]}>{children}</View>
        </View>
    </View>
  );
}

/**
 * How hard the blur bites, per tier. Tuned against the two glass tokens rather than chosen —
 * the wash already carries most of a pane's opacity, so the blur only has to smear whatever
 * shows through the remaining ~12–15%. Higher reads as frosted plastic and costs more on
 * Android, where this is a real render-effect pass on every frame the surface is on screen.
 *
 * `BLUR_AMBIENT` is the lighter of the two because there are ~59 ambient cards to an overlay's
 * one, and an ambient pane has less behind it to reveal (see the BlurView comment above). Don't
 * raise it to match: the cost difference is the reason blurring every card is affordable at all.
 */
const BLUR_STRONG = 28;
const BLUR_AMBIENT = 15;

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
