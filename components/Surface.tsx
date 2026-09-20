/**
 * Surface.tsx — the one card shape: a pane that TRANSMITS the lit field behind it, painted as
 * if lit from the top left. Also exported as `GlassCard` (see the bottom).
 *
 * ── Current state, 2026-09-20 (the transmission pass). Read this first ─────────────────────
 *
 * Third *"doesn't look like frosted or shiny glass"* report. The first two rounds changed the
 * CARD — a ramp (#717), then a sheen, bloom and rim (#732) — and both failed. The fourth round
 * measured instead, and the answer was not on the card at all:
 *
 *   **A card was opaque, and it sat on rgb(1,2,3).** Glass reads as glass by transmitting a lit
 *   ground. The ground was black (#733 fixed the geometry; the field was still a whisper) and
 *   the pane let nothing through, so there was nothing to see and nothing to see it with.
 *
 * Two changes, and NEITHER works without the other — both were built and rendered alone first,
 * and each alone is worse than neither:
 *   · a translucent pane over a dark field → flat uniform slabs;
 *   · a vivid field under an opaque pane → `border` at 1.91:1, cards as holes in a wallpaper.
 *
 * So: the pane transmits **25%** (`theme.surfaceGlass`, a DARK veil at 0.75 — not thewhite 86%
 * one the 2026-09-14 ruling removed), and the backdrop roughly doubles. The veil's alpha is
 * what buys the backdrop its headroom: at 86% transmission the contrast band caps the ground
 * at 37/255, at 25% it allows 128/255. `lib/glassBudget.ts` is that arithmetic.
 *
 * ⚠️ **THE PERFORMANCE RULING IS NOT WALKED BACK — it is made unspellable.** A translucent pane
 * over `components/ParticleBackground.tsx`'s drifting dots means every dot that moves dirties
 * the backdrop AND every card showing it through: the whole window, every frame, at 120Hz. That
 * measurement stands. What changed is that the pair can no longer both exist — `transmits`
 * requires `!particlesEnabled`, and particles now default OFF (maintainer's call, given the
 * trade in full: particles off, glass on). Over a STATIC backdrop a translucent pane is one
 * composite, not a per-frame repaint. Turn the dots back on and the opaque card returns
 * automatically. `lib/__tests__/glassBudget.test.ts` asserts that predicate's truth table.
 *
 * ⚠️ **There is still no `BlurView`**, and the frost did not bring one back. A blur samples what
 * is behind it per frame; transmission is static compositing. See the comment where it mounted.
 *
 * ── Current state, 2026-09-15 (the frosted-glass brief). Read this first ───────────────────
 *
 * Maintainer, against a Home screenshot: *"I struggle to see how this is supposed to look like
 * frosted glass."* They were right, and the cause was structural rather than a mistuned value.
 * A card was `backgroundColor: theme.surface` — ONE colour — plus a `theme.border` hairline,
 * and a rectangle of one colour reads as a rectangle whatever a file header calls the material.
 *
 * So a card is now five pieces of paint, all static, described in full at `getGlassPane`
 * (constants/theme.ts):
 *   1. **a RAMP across its face** — `glassTop` at the lit corner to `glassBottom` at the shaded
 *      one, on a 155° diagonal, as a `backgroundImage` ON the fill view;
 *   2. **a SHEEN** — a radial hotspot centred just off the top-left corner, layered over the
 *      ramp in the same `backgroundImage`, and **3. a BLOOM**, a short diffusion falling from
 *      the lit edge into the face. These two are the 2026-09-18 pass; see below;
 *   4. **a specular RIM** along the top-left edges and a **WELL** along the bottom-right, both
 *      inset `boxShadow`s at zero blur — which is how the lit edge came back WITHOUT the
 *      two-colour border that forces Android off its antialiased corner path (`getGlassPane`);
 *   5. **the drop SHADOW** below it (`getElevation` since 2026-09-17).
 *
 * ── Amended 2026-09-18: a ramp is a tonal shift, and glass needs a HOTSPOT ─────────────────
 *
 * Maintainer, after the ramp shipped: *"What remains is making the cards look more like frosted
 * or shiny glass."* Three things came out of taking that literally, and the third is the one a
 * future session is most likely to undo by accident:
 *
 *   · **A linear ramp is not a shine.** Matte paper by a window has a ramp across it. What
 *     separates glass from paper is a bounded region where light REFLECTS rather than diffuses,
 *     and that is a radial falloff — unspellable as another stop on a corner-to-corner ramp.
 *     Hence `glassSheen` (the shiny half) and `glassBloom` (the frosted half: light scattering
 *     a few pixels into the material under the lit edge).
 *   · **The RIM was invisible, and by construction rather than by mistuning.** It is drawn just
 *     inside the card's border, that border is `theme.border` = `#9A9AA6` on all four sides, and
 *     at 38% white the rim composited DARKER than the frame outside it. The app was drawing a
 *     bright line with a dimmer line inside it — a double frame, never a lit edge. At 0.72 the
 *     order is finally shadow → frame → light → pane. This is the most visible change in the
 *     pass and it is one number; see the token's doc in constants/colors.ts.
 *   · ⚠️ **DARK HAS NO BRIGHTNESS HEADROOM, so do not "fix" the sheen upward.** The pane may
 *     not paint brighter than about `#43434B` or `textMuted` drops under AA on the very cards it
 *     is printed on, and `glassTop` is already `#3B3B45`: five levels, total, for every white
 *     layer stacked on the lit corner. `lib/__tests__/colors.test.ts` measures the COMPOSITE for
 *     exactly this reason — a sweep over the four ramp tokens would have gone green over a
 *     layer that paints past all of them. In LIGHT the budget is the whole range, and it is the
 *     shaded end that does the work instead. The two themes get the same look by opposite means.
 *
 * ⚠️ **The pane is OPAQUE, and every word of that is load-bearing — this is the 2026-09-14
 * particle ruling honoured, not walked back.** The obvious way to make a card look like glass
 * is to let the lit backdrop through it. This app shipped that and measured why it cannot: a
 * translucent pane over `components/ParticleBackground.tsx`'s drifting dots means every dot that
 * moves dirties the backdrop AND every card showing it through, so the dirty region is the whole
 * window at 120Hz. Maintainer's own resolution: *"Cards can look like glass, but can just cover
 * whatever is behind so it does not have to render how the particles or lights would look
 * shining through."* A baked ramp is that sentence implemented — the pane LOOKS lit without
 * SAMPLING anything, so the compositor still sees an opaque rect.
 *   `theme.surface` is kept UNDER the ramp rather than replaced by it, so a platform that drops
 * `backgroundImage` degrades to exactly the old card instead of to a transparent hole.
 *
 * ⚠️ **There is still no `BlurView` (removed 2026-09-07), and the frost did not bring it back.**
 * A blur samples what is behind it by definition, so it cannot be bought on the terms above at
 * any price, and it costs a render-effect pass per card per frame on lists that scroll. The
 * paint above costs one gradient in a drawable the view was already painting. See the comment
 * where it used to mount.
 *
 * ⚠️ **`settings.glassSurfaces` is LIVE again** and paints the pane flat — the same
 * "reduce transparency" job it has always had, stated in terms of the material the app actually
 * draws. It had gone inert earlier the same day; see the `paneOn` block for the full sequence.
 *
 * ── Everything below this line is history. It is true about how the shape was reached and is
 *    NOT current state — several of its claims (a translucent fill, transmission as the
 *    material, `surfaceGlass` as what a card paints) were reversed by the block above ────────
 *
 * **Amended 2026-08-16 (the neon/OLED brief).** Two clauses above changed, and this header used
 * to state their opposite — that the edge "carries the control boundary on its bottom-right".
 * On a dark CARD the edge now fades to nothing, which is what makes a pane read as thick glass
 * lit from above-left rather than as a drawn frame. It is scoped: the fade is cards-in-dark only
 * (a field or a button still identifies a control and keeps its 3:1 boundary, and light's pane
 * has only a 1.17 fill step to distinguish it from the page). See constants/theme.ts's
 * GLASS_EDGE block for the full reasoning.
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
 *   - **There is no blur.** See the comment where the `BlurView` used to mount.
 *
 * Connections:
 *   Imports → constants/theme (BORDER_WIDTH, darken,
 *             getLayeredShadow, Radius), constants/motion (Travel),
 *             lib/useAppTheme (useAppTheme, useIsDark, useAccessibility),
 *             lib/useDesignLab (useLabShape — the design lab's geometry,
 *             see Edit notes), store/useSettingsStore (glassSurfaces, opaqueCards),
 *             components/PressableScale, expo-linear-gradient
 *   Used by → every screen that renders a card (grep `<Surface`). Callers passing `onPress`
 *             (the key-press path): components/OpenEpisodeCard, app/health-log,
 *             app/health-detail, app/scan. **components/Card.tsx doesn't use this
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
 *     **`overlay` (2026-08-18) and `nav` (2026-08-20) are opaque**, maintainer:
 *     *"Cards that overlap other cards should never be translucent."* A sheet has the app's own
 *     CARDS behind it by construction; the nav bar joined it when the clip window went back to
 *     the chrome's OUTER footprint so a scrolled card could show in the bar's corner notches
 *     (components/ScreenScaffold.tsx, 2026-08-20) — the same condition, so the same answer. An
 *     ambient card still frosts: it sits in a vertical list that never overlaps itself. So this
 *     is a narrowing of the every-pane rule by two named contexts, not a re-opening of the
 *     ambient argument. `theme.surfaceRaised` is `surfaceGlassStrong` already composited, so a
 *     sheet or a bar over empty backdrop is unchanged.
 *   - ⚠️ **NEITHER `settings.glassSurfaces` NOR `settings.opaqueCards` is read by this file any
 *     more (2026-09-15), and this block used to say the opposite of both.** They are listed here
 *     only so the next reader does not go looking for a branch that was deleted.
 *       `glassSurfaces` was the reduce-transparency mode. #703 made every pane opaque, which
 *     left it nothing to reduce, so it was repointed to the card edge's lit/shaded diagonal —
 *     and that diagonal is what forced Android off its antialiased border path and chewed every
 *     card corner (see the block at the ramp). Removing it left the switch unable to change
 *     anything a user could see, so its Settings ROW was retired on the maintainer's call. The
 *     store field and its DB column stay, under the never-drop rule; nothing reads them.
 *     `opaqueCards` was the card-only A/B of the same idea and went inert with it.
 *       **Do not re-add a read of either without giving it something visible to do first** —
 *     a dead read is what makes the next reader believe a switch still works, and a live
 *     subscription re-renders every Surface in the app on a toggle that changes nothing.
 *     `__tests__/glassMaterial.test.ts` ('offers no Settings row for a switch that reaches
 *     nothing') is the guard.
 *       A caller-supplied `tint` still wins over the fill, as it always has — those callers want
 *     that exact colour.
 *   - Depth is still `getLayeredShadow(theme.shadow)` — a TWO-pass `boxShadow` since
 *     2026-09-09, when the widest (and so most expensive) blur was cut; this said "three"
 *     until 2026-09-15 — and this
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
import { AccessibilityRole, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  BORDER_WIDTH,
  darken,
  getGlassPane,
  getElevation,
  Radius,
} from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useLabShape } from '@/lib/useDesignLab';
import { Travel } from '@/constants/motion';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';

/**
 * Which backdrop this surface sits over, and it DECIDES THE MATERIAL — ⚠️ this doc used to say
 * the opposite ("presentational no-op since the 2026-08-05 card reset — all three render
 * identically"), which has been false since 2026-08-18.
 *
 * `ambient` is the only translucent tier: it sits in a vertical list that never overlaps
 * itself, so it transmits the lit backdrop. `overlay` and `nav` paint OPAQUE, because a sheet
 * or the bottom bar has the app's own cards behind it and frost there is not depth — it is the
 * card underneath reading through (maintainer, against a screenshot: *"Cards that overlap other
 * cards should never be translucent."*). The two tiers also pick different fill pairs:
 * `surfaceGlass`/`surface` vs `surfaceGlassStrong`/`surfaceRaised`.
 *
 * See `glassOn` and the Edit notes for the full ruling.
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
  // ── `glassSurfaces` is LIVE again, and this closes a loose end rather than inventing a job ──
  // It went inert earlier on 2026-09-15 when the lit/shaded edge was deleted: that edge was its
  // last consumer, so the row in Settings stopped changing anything a user could see, and the
  // honest move at the time was to drop the read and record the orphan in `DECISIONS_OPEN.md`
  // rather than leave a dead subscription looking load-bearing.
  //   The glass pane below gives it a real meaning back, and the SAME one it always had:
  // "reduce transparency" now means "paint the pane flat instead of lit". That is a difference
  // the user can see on any screen, so the switch is honest again without being redefined.
  //   ⚠️ `opaqueCards` stays unread and stays deprecated. It was the card-only half of this
  // switch, invented to judge the material with the chrome left alone; the material is settled
  // now and a second, narrower switch over the same property is the thing that made the
  // 2026-08-15 pair confusing in the first place.
  const glassSurfaces = useSettingsStore((s) => s.glassSurfaces);
  // "Reduce visual effects" (2026-08-29) — the user's escape hatch for a GPU-bound device.
  // It now takes this component's one remaining per-frame GPU cost, the two-pass boxShadow,
  // plus the translucency (an opaque pane composites in one step). The BlurView it was also
  // written to disable no longer exists. Off by default; see store/useSettingsStore.ts.
  const reduceEffects = useSettingsStore((s) => s.reduceEffects);
  // ⚠️ **The pane transmits ONLY while the particle field is off, and this is a hard interlock
  // rather than a preference (2026-09-20).** The 2026-09-14 ruling that made every pane opaque
  // was not wrong about its measurement: a translucent card over `components/ParticleBackground
  // .tsx`'s drifting dots means every dot that moves dirties the backdrop AND every card showing
  // it through, so the dirty region is the whole window at 120Hz. That is still true and this
  // does not walk it back — it makes the pair unspellable. Over a STATIC backdrop a translucent
  // pane is one composite, not a per-frame repaint, so transmission is affordable exactly when
  // nothing behind it animates.
  //   Maintainer's call, given the trade in full: particles off, glass on. `particlesEnabled`
  // now defaults off (store/useSettingsStore.ts), so this reads `true` out of the box; a user who
  // turns the dots back on gets the opaque card back automatically and pays no frame cost for a
  // material they can no longer see through anyway.
  const particlesEnabled = useSettingsStore((s) => s.particlesEnabled);
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
  //   The `overlapsCards` binding that used to stand here is GONE (2026-09-15). #703 made every
  // pane opaque, so the rule above is now carried by `glassOn`'s own terms below rather than by a
  // named const, and the const was left computed-but-never-read — which is the dead read this
  // file's own header warns about two screens up. The RULE is unchanged; only its spelling is.
  // ── History: two superseded rulings on the ambient pane, kept short ─────────────────────
  //
  // Both were sound on their premises and both premises have since been retired. They are
  // summarised rather than reproduced because the current ruling below cites them, and because
  // this file has reversed on this question five times — the pattern matters more than the prose.
  //
  //   · **2026-08-29 — ambient in dark drew no blur and cast no shadow.** Measured, on the dark
  //     baselines with the narrator pinned: turning both off left 15 of 21 screens byte-identical
  //     and moved the rest by 0.05-0.07%, with the cards coming out 2-6/255 LIGHTER. So the
  //     blur's only contribution in dark was `expo-blur`'s `tint="dark"` making every pane DARKER
  //     than `theme.surface` claimed. Premise: the ground under a card is flat `#000000`.
  //   · **2026-09-06 — the ambient pane went fully OPAQUE and the shadow came back.** The premise
  //     above had just been retired by v2's washes lighting the card column, so a translucent
  //     pane no longer composited to the `#242424` every contrast test asserts. That objection is
  //     correct and is answered below; the fix chosen for it was not.
  //
  // ── An ambient card is TRANSLUCENT again (2026-09-07), and the predicate is no longer a
  //    constant ────────────────────────────────────────────────────────────────────────────
  //
  // ⚠️ **`&& !isAmbient` (2026-09-06) made this expression CONSTANT-FALSE for the whole app,
  // and that was not what it was trying to do.** `SurfaceContext` has exactly three values, and
  // `!overlapsCards` had already excluded `overlay` and `nav` since 2026-08-18. Adding
  // `!isAmbient` removed the third and last one, so `glassOn` evaluated to `false` for every
  // surface, in both themes, at every call site — no pane was translucent, and the `BlurView`
  // below became unreachable code. The commit's own message said *"`overlay`/`nav` are
  // untouched"*; they had not been reachable for three weeks.
  //   ⚠️ **Never add a term to this predicate without checking the other terms don't already
  // cover the space.** `__tests__/glassMaterial.test.ts` ("opaqueCards is scoped to CARDS, and
  // glassSurfaces still wins over it") EXTRACTS this expression and evaluates it over every
  // `(context × setting)` combination — 48 of them — asserting some combination still yields
  // `true`, that ambient-at-defaults is `true`, and that each switch can individually force
  // `false`. A source-text regex cannot see a constant, which is exactly why three of them
  // passed over this one.
  //
  // **The contrast objection that motivated it was REAL, and is answered by a budget rather
  // than by opacity.** It is worth restating because it is the thing that must not regress:
  // `surfaceGlass` is `rgba(255,255,255,0.1412)`, chosen so the composite over a BLACK ground
  // lands exactly on `#242424` — the colour every contrast test measures. But that alpha
  // transmits **86%**, so once `components/ScreenBackground.tsx` lit the card column with v2's
  // washes, a translucent pane composited to something much brighter while the tests went on
  // asserting `#242424`. Measured at the old wash strength: `textMuted` fell to **3.20:1**,
  // under WCAG AA. Going opaque did fix that — by deleting the material.
  //   What fixes it without deleting the material is bounding the GROUND. `lib/glassBudget.ts`
  // derives the band the painted card may occupy (raw 29–64 of 255: `text` inside rule 10a's
  // 7–17:1 halation band, `textMuted` ≥ 4.5:1, `border` ≥ 3:1), inverts it through this alpha
  // to a maximum ground luminance, and `lib/__tests__/glassBudget.test.ts` samples the real
  // wash field across the card band and asserts every point clears it. The washes were scaled
  // to fit that budget; the geometry is still v2's. So the composite is bounded by
  // construction, and the card can go on being glass.
  //
  // **The blur does NOT come back with it, and that is the deliberate half of this change.**
  // A `BlurView` is a per-frame render-effect pass, per card, on lists that scroll — the cost
  // the 2026-08-29 HWUI trace was cutting. What makes a pane read as glass here is that it
  // TRANSMITS the lit field behind it (86% of it), plus the lit top-left edge and the drop
  // shadow. None of those cost anything per frame. The `BlurView` is deleted rather than left
  // switched off, so the next reader doesn't mistake dead code for a feature that is merely
  // disabled; `expo-blur` had no other mount in the app.
  // ── EVERY pane is opaque (2026-09-14), and this is a PERFORMANCE ruling first ───────────
  //
  // Maintainer, against a device, with Android's "show surface updates" on: *"the entire screen
  // flickered in the app, while only blinking while scrolling in the phone's settings."* The
  // whole window was repainting every frame. `reduceEffects` (opaque cards + no particles + no
  // orb field) stopped it completely; `reducedMotion` (particles only) stopped most of it.
  //
  // **A translucent card is what turned moving particles into a FULL-SCREEN repaint.** The
  // ambient pane transmitted 86%, and `components/ParticleBackground.tsx` drifts dots behind it
  // on a loop with no end condition. Every dot that moves dirties the backdrop, and every card
  // showing that backdrop through must recomposite with it — so the dirty region is not five
  // dots, it is every card on screen, at 120Hz, forever. Opaque panes CLIP that: the motion can
  // only dirty the gutters between cards, which is what the phone's own Settings app does.
  //
  // The maintainer's own framing, and it is the whole design ruling in one line: *"Cards can
  // look like glass, but can just cover whatever is behind so it does not have to render how
  // the particles or lights would look shining through."*
  //
  // ⚠️ **The glass read does not depend on transmission and has not since 2026-09-12.** What
  // makes this pane read as glass is the lit top-left EDGE clearing its shaded side (#701) plus
  // the drop shadow. Both are static paint on an opaque fill. See this file's header.
  //
  // ⚠️ **`glassOn` no longer picks the FILL, and that is deliberate.** Leaving it in the fill
  // path would have made it constant-`false` for every surface — the exact 2026-09-06 defect
  // where three source-text assertions were updated to match and all passed while no pane was
  // translucent. The predicate is not left lying around looking live: it now drives the EDGE,
  // which is a real, visible difference, so `glassSurfaces` still does something a user can see.
  // Transmission is an AMBIENT-only property, for the reason `surfaceContext` has carried since
  // 2026-08-18: a sheet or the nav bar has the app's own CARDS behind it, so "frost" there is the
  // card underneath reading through, not depth. Those tiers stay opaque at every setting.
  const transmits = isAmbient && !particlesEnabled && !reduceEffects && glassSurfaces;
  const opaqueFill = isAmbient ? theme.surface : theme.surfaceRaised;
  const baseFill = transmits ? theme.surfaceGlass : opaqueFill;
  const fill = staticPressed ? theme.surfaceMuted : tint ?? baseFill;
  // ── The pane is LIT (2026-09-15, the frosted-glass brief) ───────────────────────────────
  //
  // Maintainer, against a Home screenshot: *"I struggle to see how this is supposed to look
  // like frosted glass."* They were right, and nothing here was mistuned — the line above is
  // the whole answer. `fill` is ONE colour, so a card was a `#242424` rectangle with a
  // `#9A9AA6` hairline round it, and a rectangle of one colour reads as a rectangle whatever
  // this file's header calls the material. Glass reads as glass because its face is NOT
  // uniform: brighter where the light lands, darker where it falls away, with a specular line
  // along the lit edge. `getGlassPane` (constants/theme.ts) is those three things, and its doc
  // carries the reasoning for each; what matters at this call site is the three gates below.
  //
  // ⚠️ **The pane stays OPAQUE — this is not the translucency ruling being walked back.** The
  // block above records why a see-through card cost a full-window repaint per particle frame,
  // and the maintainer's own resolution of it: *"Cards can look like glass, but can just cover
  // whatever is behind so it does not have to render how the particles or lights would look
  // shining through."* A BAKED ramp is that sentence implemented — the pane looks lit without
  // sampling anything behind it, so the compositor still sees an opaque rect, the dirty region
  // stays in the gutters, and there is still no `BlurView` (a blur samples by definition, so it
  // cannot be bought on these terms at any price). `fill` is kept UNDER the ramp rather than
  // replaced by it, so a platform that drops `backgroundImage` degrades to exactly today's card
  // instead of to a transparent hole.
  //
  // Three things withhold the ramp, and each is a different question:
  //   · `tint` — a caller passed a specific colour because it needs THAT colour, not a lit
  //     approximation of it. Same reasoning that already keeps `tint` opaque above.
  //   · `staticPressed` — a pressed card is showing `surfaceMuted` to say "held"; lighting it
  //     at the same time fights the one thing that state exists to communicate.
  //   · `reduceEffects` / `glassSurfaces` — the user's two escape hatches. Costed below.
  const paneOn = !tint && !staticPressed && !reduceEffects && glassSurfaces;
  // ⚠️ **Memoised for the same reason `shadowStyle` and `radii` are, and it matters more here.**
  // This mints a template string and an array of two fresh objects; Fabric re-commits a
  // `boxShadow` whenever its VALUE IDENTITY changes, so an unmemoised version would re-commit
  // an inset shadow on every render of every card — the exact cost the 2026-08-28 pass was
  // cutting. Every dep is stable per theme, so for a normal user this computes once.
  //   ⚠️ **The hotspot is AMBIENT-ONLY (2026-09-18), and `null` here is a measurement, not a
  // style preference.** `glassTopRaised` is `#42424A` in dark and its token doc records that
  // the value is a CEILING found by measuring `textMuted` (`#B0B0BA`) against it at 4.63:1 — a
  // sheet is mostly secondary text and one step lighter fails AA. So the raised rung has no
  // headroom left for a white layer of any strength: 3.5% white over it lands on `#4A4A52`,
  // where `textMuted` is **4.08:1**. A sheet, a modal and the nav bar get the ramp, the rim and
  // the well; they do not get the sheen or the bloom.
  //   This is `surfaceContext` doing the same job it has done since 2026-08-18 (see its doc):
  // the two tiers pick different material, and the difference is a measured constraint on the
  // brighter rung rather than a decorative distinction.
  const pane = useMemo(
    () => (paneOn
      ? getGlassPane(
          isAmbient ? theme.glassTop : theme.glassTopRaised,
          isAmbient ? theme.glassBottom : theme.glassBottomRaised,
          theme.glassRim,
          theme.glassWell,
          isAmbient ? theme.glassSheen : null,
          isAmbient ? theme.glassBloom : null,
          // The ramp's stops are OPAQUE hexes, so on a transmitting pane they would cover the
          // very thing the veil is letting through. `veilBase` re-expresses each stop as an
          // overlay that composites to the same colour over `theme.surface` — identical on an
          // unlit ground, transparent to a lit one. See `veil()` in constants/theme.ts.
          transmits ? theme.surface : null,
        )
      : null),
    [paneOn, isAmbient, theme.glassTop, theme.glassBottom, theme.glassTopRaised,
      theme.glassBottomRaised, theme.glassRim, theme.glassWell, theme.glassSheen,
      theme.glassBloom, transmits, theme.surface],
  );
  // ⚠️ **Two different style keys for one value, and this is not a polyfill — both are real.**
  // React Native 0.85 takes a CSS gradient string on `experimental_backgroundImage`;
  // react-native-web has no such key, but its style validator is a DENYLIST (see
  // `node_modules/react-native-web/.../StyleSheet/validate.js` — `background` is on it,
  // `backgroundImage` is not), so a plain `backgroundImage` passes through to the DOM untouched.
  //   The web branch is not cosmetic. It is what lets `npm run preview` and the `visual` gate
  // SEE this change at all: most of this app's native rendering work lands in a class no harness
  // can look at (CLAUDE.md's A2 list), and a card material that renders on web is one that a
  // screenshot diff can actually fail on. Spread as a computed key so neither platform's style
  // object carries the other's dead property.
  const paneImage = pane
    ? { [Platform.OS === 'web' ? 'backgroundImage' : 'experimental_backgroundImage']: pane.image }
    : null;
  // ⚠️ **`litEdgeOn` IS GONE (2026-09-15), and it is deleted rather than left constant-false.**
  // That is #703's own lesson applied to #703's own predicate: a switch that still reads as live
  // while every branch lands in the same place is how 2026-09-06 shipped a whole app with no
  // translucent pane and three green source-text assertions.
  //
  // What it did: `true` gave the four sides a LIT top-left and a SHADED bottom-right. On Android
  // that is not a style choice, it is a rendering mode. React Native's `BorderDrawable` takes its
  // antialiased `canvas.drawRoundRect` path ONLY when all four widths and **all four colours**
  // are equal; with two colours it falls to `clipPath` + four filled quadrilaterals, and
  // `clipPath` is not antialiased on a hardware canvas. So every card and the nav bar drew a
  // stair-stepped rim across a smoothly-drawn fill corner — the maintainer's *"borders look weird
  // and corners are clipped"*. The lit diagonal cost the corners, on every card, always.
  //
  // Maintainer's ruling, given the trade in full: one uniform colour. So the edge is the ramp's
  // SHADE stop on all four sides — deliberately that one and not the lit stop, because it is the
  // stop carrying WCAG 1.4.11's 3:1 boundary in both themes (the lit stop has never had a floor
  // under it, and in LIGHT it is the boundary colour held back at 0.3 alpha, which as a whole
  // border would be no boundary at all).
  //
  // ⚠️ **`glassSurfaces` now changes nothing about a card**, and that is a real loose end, not a
  // detail. It was this predicate's last live use in the app — see `components/AddFAB.tsx`, which
  // records the previous time the toggle went inert app-wide as a defect. It is recorded in
  // `DECISIONS_OPEN.md` rather than papered over with an invented job, because the honest options
  // (retire the row, or give it a new meaning) are a product call and not this pass's to make.
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
  // ONE flat boundary colour on all four sides — see the block at `opaqueFill` for why the
  // lit/shaded diagonal had to go, and why it is the SHADE stop that survives. Not the 3-stop
  // fade-to-nothing branch either (that is the design lab's own knob): a flat CLOSED border,
  // because a card still needs a boundary.
  //   Kept as a `RimGradient`-shaped pair rather than a bare colour so the four `borderColor`
  // assignments below stay literally identical in shape — the thing Android is actually testing
  // is that they are EQUAL, and two reads of the same array element is the clearest way to say
  // that and the hardest way to break it by editing one side.
  const ramp = useMemo(
    () => ({ colors: [edgeHue, edgeHue], locations: [0, 1], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }),
    [edgeHue],
  );
  // ⚠️ **The nav takes the `chrome` rung from its CONTEXT, and the design lab cannot override it
  // (2026-09-15).** The rung exists so content visibly passes UNDER the bar; a knob that could
  // demote it to `raised` — the same rung as the cards sliding beneath it — would silently switch
  // that off, and the lab's `cardElevation` is, by its own name and doc, about CARDS. Assigning
  // from context rather than a prop is also what stops a caller promoting itself with `elevated`.
  //   ⚠️ **Deliberately `'nav'` alone, and NOT `'overlay'` as well.** A sheet
  // does sit above the card plane and is arguably under-elevated too, but it already reads as
  // separate because it comes with a scrim, and raising it would move every modal's shadow —
  // a different question from the one this pass was asked, and one that should be measured on
  // its own. `ScreenHeader` does not route through this component and takes the same rung by
  // hand; see its own note.
  const shadowLevel = surfaceContext === 'nav'
    ? 'chrome'
    : LAB_ELEVATION[shape.cardElevation] ?? (elevated ? 'floating' : 'raised');
  // 'flat' is the design lab's cardElevation 0 and means no shadow at all — there is no flat
  // tier in getLayeredShadow (it starts at 'raised'), so the pass is skipped rather than asked
  // for a zero-strength one.
  // ⚠️ `reduceEffects` drops this ENTIRELY rather than thinning it, and that is deliberate:
  // a boxShadow's cost is the blur, so two passes of three is still two blurs per card per
  // frame.
  //   ⚠️ **Whether this is visible in DARK mode is an OPEN question — do not make it the
  // default on the strength of an argument that it is invisible.** The argument is tempting
  // and half-sound: `theme.shadow` is `rgba(0,0,0,0.72)` in dark, `getLayeredShadow` takes it
  // to ~7-10% alpha, and a card's ground is `#000000` (ScreenBackground's DARK.base is three
  // black stops and its orbs are CI-asserted never to reach the card band), so black at 7%
  // over black is black. What that argument misses is the CHROME: the header and the nav are
  // Surfaces too, and they cast onto content scrolling underneath them, where the ground is
  // not black.
  //   A pixel diff was run to settle it and could NOT: this app's screenshots have a noise
  // floor of ~43 000 differing pixels between two runs of the SAME build, because
  // `components/NarratorQuote.tsx` picks a random line on mount — and the noise floor's max
  // channel delta (121/125) is exactly the figure the "shadows are visible" reading rested on.
  // Any future attempt at this question needs a harness that pins the narrator first.
  // ── The card depth is `elevation`, not a two-pass `boxShadow` (2026-09-17) ──────────────
  // **This is the change the whole swipe-lag hunt converged on, and it is a change of KIND, not
  // of amount.** The maintainer's framing is what identified it: *"dette skal egentlig være
  // ekstremt lett å kjøre. Andre lignende apper er null stress selv for vanlige telefoner, og jeg
  // tester på en kraftig én."*
  //
  // Measured first: on an EMPTY profile the app held **42 blurred shadow layers** at once (Shop
  // 12, Home 10, To-do 8, Health 6, Habits 4 — the reported ranking), from 21 casters of which 20
  // were card-sized. So there was no stray nested shadow to delete; the cards were the weight.
  //
  // Then read out of RN's own source, which is what makes this a fix rather than a tenth guess.
  // `ReactAndroid/.../drawable/OutsetBoxShadowDrawable.kt`'s `draw()` runs **per layer, per
  // frame** and: allocates two `Path` objects, two `RectF`, two `floatArray(8)`, a
  // `ComputedBorderRadius` and four `CornerRadii`; calls `canvas.clipOutPath(...)`, forgoing
  // Android's fast rect clip; then `drawPath()` with a **`BlurMaskFilter`** paint — which is not
  // GPU-accelerated on Android. ~10 allocations, a path clip and a software blur, ×2 layers,
  // ×cards on screen, ×2 pages mid-swipe.
  //
  // `elevation` is the other implementation entirely: the framework draws it from the view's
  // OUTLINE inside the GPU pipeline, cached, allocating nothing per frame. It is what the
  // comparable apps use, and `getElevation` has been sitting in `constants/theme.ts` the whole
  // time.
  //
  // ⚠️ **Two facts that make this safe, both verified in RN's source rather than assumed:**
  //   1. `CompositeBackgroundDrawable.getOutline()` builds a ROUNDED-rect outline from
  //      `borderRadius` — its own comment says "Android's elevation implementation requires this
  //      to be implemented to know where to draw the elevation shadow". It keys off borderRadius,
  //      NOT backgroundColor. This outer view already receives `radii`, so the shadow follows the
  //      card's corners. The "square shadow behind a rounded card" this pass was warned about
  //      cannot happen here.
  //   2. `BaseViewManager.setShadowColor` calls `setOutlineAmbientShadowColor` and
  //      `setOutlineSpotShadowColor` on API 28+, so `theme.shadow` still tints the shadow —
  //      dark mode does not silently fall back to pure black.
  //
  // ⚠️ **What no harness here can check.** `elevation` is Android-only and react-native-web
  // ignores it; what the web render DOES pick up is `getElevation`'s iOS `shadow*` keys, as a
  // single blurred box-shadow. So the visual gate shows a PROXY of the new look, not the look.
  // The `unverified` tag stands until the device says otherwise.
  //
  // `getLayeredShadow` is deliberately still exported and still used by the design lab; this
  // swaps the CALLER, so the two-pass shadow remains one edit away if the look is rejected.
  const shadowStyle = useMemo(
    () => (shadowLevel === 'flat' || reduceEffects
      ? null
      : getElevation(shadowLevel, theme.shadow)),
    [theme.shadow, shadowLevel, reduceEffects],
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
            // ⚠️ **The ramp and the rim go HERE, on the mask, and not on the outer view.** The
            // outer view is the one casting the drop shadow, and a second `boxShadow` there
            // would replace that array rather than add to it. The mask is also the view whose
            // rounded corners are drawn by the background drawable — which is the whole reason
            // the rim can be an inset shadow (see `getGlassPane`'s note on Android's
            // `BorderDrawable` and the clipped corners a two-colour border produced).
            paneImage,
            pane ? { boxShadow: pane.insets } : null,
          ]}
        >
          {/* ── There is no `BlurView` here, and that is a decision, not an omission ────────
              The pane's material is: a translucent FILL that transmits the lit backdrop
              (`surfaceGlass` is 86% transmissive in dark), the lit top-left EDGE below, and
              the drop SHADOW above. All three are static paint. A blur would be a per-frame
              render-effect pass, per card, on lists that scroll — the cost the 2026-08-29
              HWUI trace identified, for an effect that duplicates what transmission already
              does now that the ground behind a card actually has light in it.
                History, because this has moved three times: 2026-08-15 mounted a BlurView on
              `overlay`/`nav` only; 2026-08-16 reversed that to every pane ("use expo-blur as
              the absolute foundation for every card"); 2026-08-18 took `overlay`/`nav` back
              out (a sheet has the app's own cards behind it, so its "blur" was the card
              underneath showing through). That left `ambient` as the only tier still mounting
              one — and 2026-09-06 turned that off too, which made the mount unreachable
              without removing it. It is removed now. `expo-blur` has no other mount in the
              app. If a blur is ever wanted again, bring it back for ONE tier with a
              measurement attached, not as a foundation. */}
          <View style={[content, padding]}>{children}</View>
        </View>
    </View>
  );
}


const styles = StyleSheet.create({
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
