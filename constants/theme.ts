/**
 * theme.ts — design tokens: spacing/radius/type/shadow scales + glass surface finish.
 *
 * `getFontSize(base, scale)` applies the user's fontSize preference to a base pt.
 * `contrastOn(hexBg)` picks near-black or white text for the best WCAG contrast.
 * `getMaterialStyle(base, variant?)` computes the simplified glass surface-finish tokens
 * (frost + wash, 2026-07-18) from a single base colour, consumed by components/GlassFill.tsx.
 * `getLayeredShadow(shadowColor?, level?)` returns the three-pass `boxShadow` depth.
 * `getGlow(color, level?)` (2026-07-18) returns a two-pass colored `boxShadow` halo —
 * the purposeful active/focus indicator; apply sparingly (see its own doc comment).
 * `getElevation(level, shadowColor?)` is the 3-tier depth scale (flat/raised/floating) —
 * the go-forward source of truth for shadow/elevation; see its own doc comment.
 * `Fonts` holds the rounded Nunito family tokens. Card padding across the app is `Spacing.md`
 * (16) — there is no separate `Layout` token; a prior `Layout.cardPadding/cardGap/maxVisible`
 * export was removed 2026-07-12 (zero call sites, docs disagreed with it — see
 * HANDOFF_SPACING_PASS.md).
 * `Type` (2026-07-18 typography pass) is an additive role map (display/title/heading/
 * subheading/body/bodyStrong/label/caption) — `size` still goes through `getFontSize`, `line`
 * is a lineHeight ratio. `FontSize.*` stays the base scale; not every call site is migrated
 * (see AGENTS.md's type-migration follow-up list).
 * `TabularNums` (2026-07-28 row-rule pass) is the fixed-width-figures style for values that
 * sit in a list row's right-hand column, so the column edge lines up row to row.
 * `MIN_TAP_TARGET` + `HitSlop` + `hitSlopFor()` (2026-07-30, DESIGN_RULES.md rule 17) are the
 * WCAG 2.2 target-size tokens — never write a bare `44` or `hitSlop={8}` at a call site.
 * `PAD_*` + `DONE_ROW_OPACITY` (2026-07-30 notepad pass) are the ruled-sheet geometry every
 * list-bearing surface shares — one gutter, one row height, two spare rules, one done fade.
 * See their own doc comment; components/PadSheet.tsx draws from them.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/GlassFill.tsx, components/Surface.tsx, components/Button.tsx,
 *             components/AddFAB.tsx, components/PhotoFrame.tsx, app/_layout.tsx, app/budget.tsx, app/capture.tsx, app/focus.tsx, app/habit-form.tsx, app/(tabs)/health.tsx, app/index.tsx, app/meals.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/onboarding/step2.tsx, app/onboarding/step3.tsx, app/onboarding/step4.tsx, app/onboarding/step5.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/DatePickerCalendar.tsx, components/ExpandableCard.tsx, components/HintCard.tsx, components/ShoppingRow.tsx, components/TimePickerWheel.tsx, lib/useAppTheme.ts
 *   Data    → none (pure constants)
 *
 * Edit notes:
 *   - Glass surface (simplified 2026-07-18): BlurView frost (overlay/chrome only) + colour
 *     wash (see Surface.tsx) so text on cards keeps the same contrast guarantees regardless
 *     of what's blurred behind.
 *   - **Matte finish (2026-07-28)**: `MaterialStyle` carries `rim` (the gradient border ring),
 *     `scrim` (the cap's face lift) and `fillGradient` (primary/danger button fill). All
 *     mode-aware via getMaterialStyle's `mode` arg, all STATIC. Rim is drawn by Surface/Button;
 *     scrim/fillGradient by GlassFill. Two things are deliberately NOT here and must not come
 *     back: the `specular` highlight blob (removed — it read as gloss; see each token's own
 *     comment below) and the drifting "sheen" (never implemented — it was the app's
 *     persistent-sluggishness driver; see GlassFill's header).
 *   - Purposeful Depth System (2026-07-14): `getElevation('flat'|'raised'|'floating')`
 *     is the go-forward depth token — flat=read-only, raised=tappable at rest,
 *     floating=the one focused/active surface. Used by PressableScale's `depth` prop,
 *     TaskCard's resting/focus-pop elevation, and Surface's `elevated` prop. The old
 *     `Shadow.*` map is untouched/back-compat only — don't mass-migrate its call sites.
 */
export type FontSizeScale = 'small' | 'default' | 'large';

const fontScaleMap: Record<FontSizeScale, number> = { small: 0.875, default: 1, large: 1.2 };

/** Apply the user's fontSize preference to any base point size. */
export function getFontSize(base: number, scale: FontSizeScale): number {
  return Math.round(base * fontScaleMap[scale]);
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [100, 100, 100];
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * Blend `t` (0..1) of `overlay` into `base` and return an opaque hex. Used to derive a
 * soft solid card tint from a domain accent (e.g. mix(theme.surface, accent, 0.15)) — a
 * solid hex is required because getMaterialStyle()/Surface's tint can't parse an rgba().
 */
export function mix(base: string, overlay: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(overlay);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function relLuminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DARK_TEXT = '#1E293B';

/**
 * Returns whichever of near-black (DARK_TEXT) or white text has the higher WCAG
 * contrast ratio against hexBg.
 */
export function contrastOn(hexBg: string): string {
  const bgLum = relLuminance(hexBg);
  const darkLum = relLuminance(DARK_TEXT);
  const contrastWithWhite = (Math.max(bgLum, 1) + 0.05) / (Math.min(bgLum, 1) + 0.05);
  const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
  return contrastWithDark >= contrastWithWhite ? DARK_TEXT : '#FFFFFF';
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 12,
  // md nudged 18 → 16 (2026-07-18 "colored glass"): a calmer, less bubbly card corner so
  // surfaces read as lifelike glass panes rather than rounded plastic tiles.
  md: 16,
  lg: 24,
  full: 999,
};

/**
 * Shared width/height ratios for photo/media tiles (components/PhotoFrame.tsx).
 * `fit` means "no forced ratio" (contain, natural proportions) — the other keys are
 * width/height values for a fixed crop (cover). Golden (φ ≈ 1.618) is the classic
 * landscape proportion. Only apply a fixed ratio to genuinely visual/media tiles —
 * never to variable-length text/content cards.
 */
export const AspectRatio = {
  fit: undefined,
  square: 1,
  classic: 4 / 3,
  widescreen: 16 / 9,
  golden: 1.618,
} as const;

export type AspectRatioKey = keyof typeof AspectRatio;

// Shared compact "resting" height for Home's collapsed preview cards (Notes/Plans/Shopping)
// so an empty or light card reads as one intentional size (each with its own designed empty
// state — see HomeNotesCard/HomeShoppingCard/PlanTaskCard) instead of a big blank band. Applied
// only while
// collapsed/unexpanded; it's a floor, not a cap — content past it (added rows up to 5, an
// expanded task's steps, Plans' proportional time-gap rail) is free to grow taller.
export const HOME_PREVIEW_CARD_MIN_HEIGHT = 140;

/**
 * Pad ("notepad") geometry — the shared ruled-sheet language every list-bearing surface
 * draws itself with (2026-07-30, user report: "look like notepads", "related cards should
 * look practically the same", "the feel of 1, 2, 3, everything inside a card is connected
 * and in orderly fashion feels like it's not there").
 *
 * Before this, one Home card could carry FOUR different left edges — a title row inset 52
 * to clear an absolutely-pinned badge, rows at Spacing.md, a day-grid at GUTTER_WIDTH +
 * Spacing.xs, and dividers at ShoppingRow's old 30px check inset — which is most of why
 * nothing inside a card read as belonging to the same list. `PAD_GUTTER` is the ONE
 * horizontal inset for everything inside a pad card: header, rules, rows, type line,
 * footer. Don't add a second one.
 *
 * `PAD_ROW_MIN_HEIGHT` is the always-open TYPE line's own rhythm (PadTypeRow) — it needs the
 * fuller height for its 32px commit button + comfortable typing target, so it stays 44.
 * `PAD_ROW_HEIGHT` (2026-07-30, user report: "lines can be compressed for all except the
 * empty one with the Type text-box") is the shorter rhythm for actual list rows (PadRow) and
 * the blank spare lines after them — a real row's 22px check + hitSlop don't need 44px of
 * air, and the taller uniform height read as loose/floaty next to the type line above it.
 * Rules are drawn by components/PadSheet.tsx and run the full card width (there is no
 * leading check column to inset past any more — see the row rule in AGENTS.md).
 */
export const PAD_ROW_MIN_HEIGHT = 44;
export const PAD_ROW_HEIGHT = 38;
export const PAD_GUTTER = Spacing.md;
/** Blank ruled lines drawn after the last real row — the "keep writing" invitation. */
export const PAD_SPARE_LINES = 2;
/** Rows shown in a pad card's middle ("preview") state, between closed and open. */
export const PAD_PREVIEW_ROWS = 3;

/**
 * A finished row's fade. Struck through AND faded, in place — the shared "done" treatment
 * for notes, tasks, shopping items and completed habits, so one tick looks the same
 * everywhere. Promoted here from components/ShoppingRow.tsx's `CHECKED_OPACITY` (same
 * value, still re-exported there for its existing callers).
 */
export const DONE_ROW_OPACITY = 0.55;

/**
 * Minimum tappable target, in px — WCAG 2.2 target size (DESIGN_RULES.md rule 17).
 * A hard floor, not a preference: never write a bare `44` at a call site.
 *
 * When the *visual* control is deliberately smaller than this (an icon button's 36px
 * cap, a chip), don't grow the art — expand the touch area instead, either with a
 * `minHeight`/`minWidth` of MIN_TAP_TARGET or with a `HitSlop` token. The pattern is
 * components/IconButton.tsx: `Math.max(MIN_TAP_TARGET, size + Spacing.sm)`.
 *
 * Three shipped heights sit deliberately below this — `PAD_ROW_HEIGHT` (38, the
 * compressed notepad row the user asked for on 2026-07-30), `Button`'s `sm` (36) and
 * FormControls' 40px rows. They're open conflict #6 in DESIGN_RULES.md and are NOT to
 * be "fixed" in passing; `sm` buttons carry a HitSlop to reach 44 of touch area instead.
 */
export const MIN_TAP_TARGET = 44;

/**
 * The slop needed to lift a `visualSize`-px control up to MIN_TAP_TARGET of touch area.
 * **Prefer this over a hand-picked `HitSlop.*` constant** — it takes the one number you
 * actually know (how big the icon/glyph is) and does the arithmetic, so the target can't
 * silently come out under 44 the way a guessed `hitSlop={6}` on a 22px check does (34px).
 *
 *   <Pressable hitSlop={hitSlopFor(CHECK_SIZE)}>   // 22px check → 11px slop → 44px target
 *
 * Returns 0-slop for a control already at or over target. RN's `hitSlop` extends the touch
 * area outside the view's bounds and does not affect layout, so this is free.
 */
export function hitSlopFor(visualSize: number) {
  const pad = Math.max(0, Math.ceil((MIN_TAP_TARGET - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}

/**
 * Named hitSlop values, replacing the eight different bare numbers this codebase carried
 * (8, 6, 13, 4, 12, 16, 10, 2). Each is labelled with the *smallest visual control it
 * actually makes compliant*, because that — not the slop number — is what rule 17 is about.
 * If your control is smaller than the label says, use `hitSlopFor(size)` instead of reaching
 * for the next token up.
 *
 * DESIGN_RULES.md rule 17 also asks for ≥8px of dead space *around* a target, so don't put
 * `loose` on two controls sitting 8px apart — their touch areas would overlap and the wrong
 * one wins.
 */
export const HitSlop = {
  /** 4px — lifts a ≥36px control (an IconButton cap) to target. */
  tight: { top: 4, bottom: 4, left: 4, right: 4 },
  /** 6px — lifts a ≥32px control to target. */
  snug: { top: 6, bottom: 6, left: 6, right: 6 },
  /** 8px — lifts a ≥28px control (most header/row icons) to target. */
  base: { top: 8, bottom: 8, left: 8, right: 8 },
  /** 13px — the row check: 22px + 26 = 48px of target. Deliberately above the minimum;
   *  components/PadRow.tsx's header warns not to shrink it to tidy up the trailing cluster. */
  check: { top: 13, bottom: 13, left: 13, right: 13 },
  /** 16px — lifts a ≥12px glyph/dot to target. */
  loose: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

// Body text is never below 16; secondary/caption text never below 14.
export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 36,
};

/**
 * The global `maxFontSizeMultiplier` applied to every RNText/RNTextInput in
 * app/_layout.tsx. Header metrics below cap font scaling at the same value so the
 * band/line-box math matches what the title actually renders at.
 */
export const MAX_FONT_SCALE = 1.4;

/**
 * Screen-header title metrics, derived together from the OS text-size scale so they can
 * never disagree (they live in two files — ScreenHeader draws the title, ScreenScaffold
 * sizes the band). Two clippers have to be satisfied at once:
 *   1. the Text's own line box must clear Nunito Bold's deep descenders (g/j/p/q/y) — a
 *      lineHeight below the font's ~1.36 natural ratio chops their tails ("Hjem"→"Hiem");
 *   2. the row (line box + vertical padding) must fit inside the header band, or the glass
 *      Surface's overflow:hidden mask clips the bottom instead.
 *
 * ⚠️ The values are PRE-SCALED, so the consuming Text MUST set `allowFontScaling={false}`
 * and apply `titleFontSize` + `titleLineHeight` verbatim. With `allowFontScaling` left on
 * (the earlier, broken arrangement), RN treats BOTH the style fontSize AND the style
 * lineHeight as SP and multiplies them by the OS font scale again — see Android's
 * `TextAttributes.effectiveLineHeight` (`toPixelFromSP(lineHeight, maxFontSizeMultiplier)`).
 * That double-scaled the line box (57 → ~80px at the 1.4× cap) while the band stayed
 * single-scaled (89px), overflowing the row — the "cut headers" bug that survived #189/
 * #194/#195/#198. (The old comments claimed "a px lineHeight never scales; only fontSize
 * does" — that's exactly backwards on Android, and react-native-web doesn't emulate the
 * SP conversion, which is why the web preview could never reproduce the clip.)
 */
export const HEADER_TITLE_LINE_RATIO = 1.45; // headroom over Nunito Bold's ~1.36 natural ratio
// Header prominence pass (2026-07-20): kept as its own token (not a bump to FontSize.xxl
// itself) since that scale is reused by unrelated onboarding screens this pass isn't meant
// to touch. Same-day follow-up dialed the size back to 28 (matching the old FontSize.xxl
// this token was split from) after the initial 32 + uppercase + centering fix together read
// as too large — the row's centering (paddingVertical: Spacing.md in ScreenHeader.tsx, which
// must stay put — see that file's comment) is kept. The uppercase casing that pass also
// introduced was REMOVED 2026-07-28 (design review): all-caps at 24px reads as a label style
// at a heading size. This token still drives the band height in lockstep, unchanged.
// 2026-07-24: dialed 28 → 24. This value drives ALL header titles uniformly (and the band
// height below, in lockstep), so lowering it makes every screen's title one consistent,
// still-legible size AND gives the long uppercase "HANDLELISTE" (11 chars, extrabold) room
// to sit on one line next to Shopping's 5-icon control row without the old per-screen
// autosize shrink hack (removed in ScreenHeader.tsx the same day — see that file's edit note).
export const HEADER_TITLE_BASE_SIZE = 24;
export function getHeaderMetrics(rawFontScale: number) {
  const fontScale = Math.min(rawFontScale, MAX_FONT_SCALE);
  // The OS text-size scale is applied HERE, once — the title Text opts out of RN's own
  // scaling (allowFontScaling={false}), so accessibility sizing still works but through
  // this single, band-aware code path with the same MAX_FONT_SCALE cap.
  const titleFontSize = Math.round(HEADER_TITLE_BASE_SIZE * fontScale);
  const titleLineHeight = Math.ceil(titleFontSize * HEADER_TITLE_LINE_RATIO);
  // Band = title line box + the header row's vertical padding (Spacing.sm each side) + a
  // Spacing.md slack so the descender never sits flush against the mask edge.
  const headerHeight = titleLineHeight + Spacing.sm * 2 + Spacing.md;
  return { fontScale, titleFontSize, titleLineHeight, headerHeight };
}

/**
 * Rounded-typeface family tokens (Nunito). Loaded in app/_layout.tsx via expo-font;
 * the regular face is also set as the global Text default there.
 */
export const Fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

/**
 * Refined Nunito hierarchy (additive, 2026-07-18 typography pass) — `FontSize.*` stays the
 * source of truth for the many existing call sites; `Type` is a higher-level role map for
 * new/converted call sites. `size` is the base pt fed through `getFontSize(size,
 * settings.fontSize)` at the call site (same pattern as existing code); `line` is a
 * lineHeight *ratio* (multiply by the scaled size), not a fixed pt value.
 */
export const Type = {
  display: { fontFamily: Fonts.extrabold, size: 34, line: 1.15 },
  title: { fontFamily: Fonts.extrabold, size: 26, line: 1.20 },
  heading: { fontFamily: Fonts.bold, size: 20, line: 1.25 },
  subheading: { fontFamily: Fonts.semibold, size: 17, line: 1.30 },
  body: { fontFamily: Fonts.regular, size: 16, line: 1.45 },
  bodyStrong: { fontFamily: Fonts.semibold, size: 16, line: 1.45 },
  label: { fontFamily: Fonts.semibold, size: 14, line: 1.30 },
  caption: { fontFamily: Fonts.medium, size: 13, line: 1.35 },
} as const;

/**
 * Tabular (fixed-width) figures — the row rule's "right edge is a single column"
 * (design-system v6 `Checklist Redesign Options`). Apply to any value that sits in a
 * list row's right-hand slot (a time, a price, a count) so the digits occupy the same
 * width on every row and the column's edge lines up instead of jittering between
 * "1" and "11". Nunito ships the `tnum` feature, so this is a font-feature switch,
 * not a font swap — it never changes the family, size or weight it's mixed into.
 *
 * Deliberately NOT applied to prose or to numbers inside a sentence: proportional
 * figures read better there, and there's no column to align to.
 */
/* Not `as const`: React Native types `fontVariant` as a MUTABLE `FontVariant[]`, and a
   `readonly [...]` tuple won't assign to it. This file stays import-free (see the header),
   so the element type is written out rather than pulled from react-native's `TextStyle`. */
export const TabularNums: { fontVariant: 'tabular-nums'[] } = { fontVariant: ['tabular-nums'] };

export type ElevationLevel = 'flat' | 'raised' | 'floating';

/**
 * 3-tier depth scale (Purposeful Depth System, 2026-07-14): `flat` = informational/
 * read-only, `raised` = tappable at rest, `floating` = the one focused/active/modal
 * surface on screen. Roughly: `Shadow.card`/`button` ≈ `raised`, `Shadow.cardHeavy`/
 * `fab` ≈ `floating` — new code should prefer `getElevation` over the `Shadow` map
 * below (kept for its 15+ existing call sites, not migrated in this pass). Pass
 * `theme.shadow` for a theme-tinted shadow (matches Surface); omit for legacy black.
 */
export function getElevation(level: ElevationLevel, shadowColor: string = '#000') {
  switch (level) {
    case 'flat':
      return { shadowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
    case 'raised':
      return { shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 };
    case 'floating':
      return { shadowColor, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 10 };
  }
}

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 5,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  // Raised "toward the user" button depth (2026-07-13 depth pass): a stronger downward
  // offset + elevation so small tappable controls (AddRow confirm, habit +/- adjusters,
  // chips) read as physical, pressable buttons instead of flat recessed wells. Pair with
  // a fill that is NOT surfaceMuted (use surface or an accent) and a light top edge.
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
};

// ─── Materials: glass surface finish ─────────────────────────────────────────

/** Light vs dark tuning for the glass recipe (rim/scrim alphas). */
export type MaterialMode = 'light' | 'dark';

/** expo-linear-gradient requires ≥2 colour/location stops — a tuple, not a plain array. */
type GradientColors = readonly [string, string, ...string[]];
type GradientStops = readonly [number, number, ...number[]];

/** Raised-keycap border (fix 1) — a vertical (top-light → bottom-dark) hue-tinted gradient padding-ring. */
export type RimGradient = { colors: GradientColors; locations: GradientStops };
/** The matte cap finish — a vertical gradient: a 10% white lift, gone by 42%, then a 4% shade. */
export type ScrimGradient = { colors: GradientColors; locations: GradientStops };

export type MaterialStyle = {
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  borderTopColor: string;
  borderBottomColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  /** Android shadow depth. */
  elevation: number;
  /**
   * Opaque hex equivalent of `backgroundColor` — pass this to contrastOn(),
   * never `backgroundColor` itself, since glass's backgroundColor is a
   * translucent rgba() string that contrastOn() can't parse.
   */
  contrastBase: string;
  /**
   * Alpha the colour wash renders at inside GlassFill. Card glass leans translucent
   * (the Surface caller overrides this per surfaceContext); the `'button'` variant
   * returns a near-opaque value so a CTA's ink keeps its contrast over busy backdrops.
   */
  washAlpha: number;
  /**
   * Take-two static glass layers (2026-07-18 "Glass, take two", re-added after the
   * simplification): all mode-aware, all static (no per-frame/looping effect — the drifting
   * "sheen", fix 4, is deliberately NOT here; see GlassFill's header). `rim` is the gradient
   * border ring (Surface/Button render it, not GlassFill); `scrim` is rendered by GlassFill as
   * a fill overlay; `fillGradient` is the primary/danger button's top-lit vertical fill,
   * pre-alpha'd to `washAlpha`. There is deliberately no specular blob — see GlassFill's header.
   */
  rim: RimGradient;
  /**
   * The "raised keycap (double)" second edge — a crisp, cool, hue-tinted line drawn on the
   * inner `overflow:hidden` mask (Surface/Button/AddFAB) INSIDE the outer `rim` chamfer, so a
   * surface reads as a physically raised key rather than a single soft bevel. Derived from the
   * base hue (not neutral), so it auto-tints to whatever surface it sits on.
   */
  innerLine: string;
  scrim: ScrimGradient;
  fillGradient: GradientColors;
};

const MATERIAL_BORDER_WIDTH = 1.5;

/** Card vs. button tuning for the glass recipe (buttons lean denser/opaquer for CTA contrast). */
export type MaterialVariant = 'card' | 'button';

/**
 * The raised-keycap rim gradient recipe, extracted so callers whose edge hue differs from
 * their fill hue (Surface's `edgeHue` — a domain/screen colour — vs. its neutral frosted
 * `base` fill) can compute a rim from that different hue without duplicating the colour math.
 * `getMaterialStyle` calls this with its own `base` for `mat.rim` (Button/AddFAB); Surface.tsx
 * calls it directly with `edgeHue`.
 */
export function computeRimGradient(base: string, isDark: boolean): RimGradient {
  // 2026-07-24 contrast pass: the mid/bottom stops were low enough (light 0.18/0.34, dark
  // 0.08/0.34) that most of the ring's height read as no border at all against the pale/near-
  // black backdrops (measured ~1.3:1, well under WCAG 1.4.11's 3:1 non-text minimum) — only the
  // top ~20% (the lit highlight) was actually visible. Raised the mid/bottom alphas so the whole
  // ring reads as a real edge; the top stop (the "lit lip") is untouched since it already worked.
  //
  // **Matte pass (2026-07-28, maintainer: "the glossy button look is awful, want it flatter,
  // it feels too rounded towards the user").** The old light-mode top stop was
  // lighten(base, 0.42) at 0.85 alpha — a near-white band bright enough to read as a domed,
  // wet-looking chamfer curving toward the viewer. Design-system v6's `handoff/BUTTONS.md` is
  // explicit about the target: "matte, not glossy… no specular highlight, no white gloss arc.
  // The read should be moulded ABS under diffuse light", with the whole lift carried by a
  // plain `inset 0 1px 0 rgba(255,255,255,.22)` top edge. So the top stop is now a flat white
  // at that .22, holding for a hair of the height instead of fading over a fifth of it (a
  // gradient that FADES reads as curvature; one that stops reads as a chamfer), and the
  // bottom keeps a soft hue-dark line so the moulded base edge survives.
  return isDark
    ? {
        colors: [rgba('#FFFFFF', 0.16), rgba('#FFFFFF', 0), rgba('#000000', 0.42)],
        locations: [0, 0.12, 1],
      }
    : {
        colors: [rgba('#FFFFFF', 0.22), rgba('#FFFFFF', 0), rgba(darken(base, 0.16), 0.38)],
        locations: [0, 0.12, 1],
      };
}

/**
 * Computes the matte surface-finish tokens from a single base colour.
 * Spread the border/shadow keys onto the outer (shadow-casting) view and
 * `backgroundColor` + the take-two layer colours onto components/GlassFill.tsx.
 * `variant` tunes fill density: `'card'` (default) stays glassy-translucent; `'button'`
 * returns a near-opaque wash so action labels stay WCAG-legible. `mode` ('light'|'dark')
 * tunes the rim/scrim alphas — a full-strength white edge reads as a harsh line on near-black,
 * so dark mode dims both. Callers that render these layers (Surface, Button, AddFAB via
 * GlassFill) MUST pass their current mode; FoodTab and
 * the other back-compat consumers only read backgroundColor/border/contrastBase and can omit it.
 */
export function getMaterialStyle(base: string, variant: MaterialVariant = 'card', mode: MaterialMode = 'light'): MaterialStyle {
  const isButton = variant === 'button';
  const isDark = mode === 'dark';
  // Frosted-pane look from the base colour's own hue (lightened, not blended toward
  // an unrelated icy-blue) — every feature colour keeps its identity. Buttons lighten far
  // less so a CTA's accent stays close to its true hue and keeps `accentInk`'s contrast.
  // (2026-07-18 "colored glass": cards lighten only 0.10, not 0.16 — the translucency now
  // comes from the low ambient wash alpha (Surface's GLASS_WASH_ALPHA), not from washing the
  // hue toward milky white, so a screen-tinted card reads as real frosted glass, not pastel.)
  const tinted = lighten(base, isButton ? 0.06 : 0.10);
  // Ambient content cards ride translucent (~0.66-0.8, set by the Surface caller per
  // surfaceContext) — a tinted wash alone reads as frosted without per-frame blur, the
  // simplified glass finish's power win. Buttons lean denser for CTA ink contrast. (The card
  // ambient value bumped 0.62 → 0.66 in "Glass, take two" for a denser adaptive scrim base.)
  const washAlpha = isButton ? 0.9 : 0.66;

  // Rim = raised-keycap chamfer (2026-07-18 "typewriter glass", retuned): a VERTICAL gradient
  // border, HUE-TINTED (derived from the surface's own base, not pure white), with the bright
  // band pushed hard to the TOP edge (locations 0 → 0.22) so it reads CRISP — a sharp lit lip,
  // not the old soft half-height fade — then a faint mid and a soft dark hue-shadow at the
  // bottom edge. Paired with `innerLine` below, this is the "double keycap": a bright outer lip
  // + a cool inner line, so cards/buttons read as physically raised keys. Rendered top→bottom
  // (start {0,0} → end {0,1}) by Button and Surface (2026-07-21: Surface switched to this same
  // gradient-ring recipe — see computeRimGradient below and its call site in Surface.tsx).
  const rim: RimGradient = computeRimGradient(base, isDark);

  // Inner line (the "double" of the double keycap): a crisp, cool, hue-tinted 1px line the
  // callers draw on the inner mask, just inside the rim chamfer. Restrained (calm) but present
  // enough to read as a second edge — this is what turns the previously-invisible neutral
  // hairline (old `theme.border`) into the keycap's inner wall.
  // 2026-07-24 contrast pass: 0.26/0.5 read as barely-there on a neutral (grey) edge hue —
  // bumped so the inner wall is dependably visible, not just on hues far from the backdrop.
  const innerLine = isDark ? rgba(lighten(base, 0.16), 0.4) : rgba(lighten(base, 0.06), 0.65);

  // The face lift (was "adaptive scrim"). **Matte pass (2026-07-28)**: design-system v6's
  // `handoff/BUTTONS.md` gives one recipe for the whole cap finish —
  // `linear-gradient(rgba(255,255,255,.10), transparent 42%, rgba(0,0,0,.04))`. That is what
  // this now is. The old version was white at 0.22 fading over HALF the height, which put a
  // visible sheen across the middle of every surface; combined with the specular blob it read
  // as a glossy dome. The new one is a tenth-opacity lift that's gone by 42% and a barely-there
  // 4% shade at the bottom: enough to say "this face catches light from above", not enough to
  // say "this face is curved".
  const scrim: ScrimGradient = {
    colors: [rgba('#FFFFFF', isDark ? 0.06 : 0.10), rgba('#FFFFFF', 0), rgba('#000000', 0.04)],
    locations: [0, 0.42, 1],
  };

  // Primary/danger button top-lit vertical fill, pre-alpha'd to the wash so GlassFill can drop
  // it in as a straight replacement for the flat wash layer. **Matte pass (2026-07-28)**:
  // lighten/darken halved (0.12/0.10 → 0.05/0.04) and the base held to the same 42% the face
  // lift uses. At the old spread the fill itself had a top-to-bottom shading ramp strong enough
  // to read as a cylinder; the cap is meant to be a flat moulded face whose only shading is the
  // lift above and the base edge below.
  const fillGradient: GradientColors = [
    rgba(lighten(base, 0.05), washAlpha),
    rgba(base, washAlpha),
    rgba(darken(base, 0.04), washAlpha),
  ];

  return {
    backgroundColor: rgba(tinted, 0.84),
    borderWidth: MATERIAL_BORDER_WIDTH,
    // Flat keycap edge tokens, now hue-tinted to match the rim/innerLine (was plastic white/black):
    // a bright lit top, a cool mid, a soft hue-dark bottom. Read by the glass-OFF fallback and by
    // back-compat direct consumers (e.g. FoodTab) that don't render the rim gradient themselves.
    borderColor: innerLine,
    borderTopColor: isDark ? rgba(lighten(base, 0.28), 0.5) : rgba(lighten(base, 0.42), 0.7),
    borderBottomColor: isDark ? rgba('#000000', 0.3) : rgba(darken(base, 0.14), 0.34),
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
    contrastBase: tinted,
    washAlpha,
    rim,
    innerLine,
    scrim,
    fillGradient,
  };
}

/**
 * Soft colored halo — PURPOSEFUL indicator ONLY (primary action + the single active/focused
 * element on a screen). Not decoration; do not apply broadly. New-Arch boxShadow (iOS+Android).
 */
export function getGlow(color: string, level: 'soft' | 'strong' = 'soft') {
  const alpha = level === 'strong' ? 0.55 : 0.34;
  const radius = level === 'strong' ? 22 : 15;
  return {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: radius, spreadDistance: 0, color: rgba(color, alpha) },
      { offsetX: 0, offsetY: 0, blurRadius: Math.round(radius * 1.8), spreadDistance: 0, color: rgba(color, alpha * 0.5) },
    ],
  };
}

/**
 * Layered depth (take-two fix 3): three shadow passes — contact (tight, grounds the
 * pane), near (mid, the bulk of the float), and cast (soft/wide, the ambient drop) —
 * instead of one flat shadow, so the eye reads real elevation. Returned as an RN
 * `boxShadow` value array (New Arch, RN 0.76+); apply it to the outer surface view and
 * DON'T also set `shadowOpacity`/`elevation` there (they'd double up). `shadowColor` is
 * the theme's shadow token so depth shifts hue with the colour theme. `level` scales the
 * spread: `raised` for resting cards/buttons, `floating` for the FAB and focus-popped cards.
 */
export function getLayeredShadow(shadowColor: string = '#000', level: Exclude<ElevationLevel, 'flat'> = 'raised') {
  const k = level === 'floating' ? 1.6 : 1;
  // Strengthened (2026-07-18 vision tune): higher alphas + a deeper cast so raised-keycap cards
  // POP off the colorful field with real depth/layering, not sit flush like flat tiles. The
  // three passes are contact (tight, grounds the key), near (the bulk of the lift), and cast
  // (soft/wide ambient drop).
  return [
    { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: rgba(shadowColor, 0.10) },
    { offsetX: 0, offsetY: Math.round(4 * k), blurRadius: Math.round(14 * k), spreadDistance: 0, color: rgba(shadowColor, 0.14) },
    { offsetX: 0, offsetY: Math.round(10 * k), blurRadius: Math.round(26 * k), spreadDistance: -2, color: rgba(shadowColor, 0.10) },
  ];
}
