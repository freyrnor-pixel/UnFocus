/**
 * theme.ts — design tokens: spacing/radius/type/shadow scales + glass surface finish.
 *
 * `getFontSize(base, scale)` applies the user's fontSize preference to a base pt.
 * `contrastOn(hexBg)` picks near-black or white text for the best WCAG contrast.
 * `getMaterialStyle(base)` computes glass surface-finish tokens from a single base colour.
 * `getElevation(level, shadowColor?)` is the 3-tier depth scale (flat/raised/floating) —
 * the go-forward source of truth for shadow/elevation; see its own doc comment.
 * `Fonts` holds the rounded Nunito family tokens. Card padding across the app is `Spacing.md`
 * (16) — there is no separate `Layout` token; a prior `Layout.cardPadding/cardGap/maxVisible`
 * export was removed 2026-07-12 (zero call sites, docs disagreed with it — see
 * HANDOFF_SPACING_PASS.md).
 *
 * Connections:
 *   Imports → —
 *   Used by → app/_layout.tsx, app/budget.tsx, app/capture.tsx, app/focus.tsx, app/habit-form.tsx, app/(tabs)/health.tsx, app/index.tsx, app/meals.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/onboarding/step2.tsx, app/onboarding/step3.tsx, app/onboarding/step4.tsx, app/onboarding/step5.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/DatePickerCalendar.tsx, components/ExpandableCard.tsx, components/HintCard.tsx, components/ShoppingRow.tsx, components/TimePickerWheel.tsx, lib/useAppTheme.ts
 *   Data    → none (pure constants)
 *
 * Edit notes:
 *   - Glass surface: BlurView frost + colour wash (see Surface.tsx) so text on cards
 *     keeps the same contrast guarantees regardless of what's blurred behind.
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

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
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
  sm: 10,
  md: 18,
  lg: 26,
  full: 999,
};

// Shared compact "resting" height for Home's collapsed preview cards (Notes/Plans/Shopping)
// so an empty or light card reads as one intentional size (with a designed empty state —
// components/HomePreviewEmpty) instead of a big blank band. Applied only while
// collapsed/unexpanded; it's a floor, not a cap — content past it (added rows up to 5, an
// expanded task's steps, Plans' proportional time-gap rail) is free to grow taller.
export const HOME_PREVIEW_CARD_MIN_HEIGHT = 140;

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
 * A *fixed* band (the old 72px) satisfies neither once the font scales up: a static
 * lineHeight goes tighter than the glyph, and a lineHeight generous enough for the glyph
 * overflows the fixed band. So both scale with the (capped) font size.
 */
export const HEADER_TITLE_LINE_RATIO = 1.45; // headroom over Nunito Bold's ~1.36 natural ratio
export function getHeaderMetrics(rawFontScale: number) {
  const fontScale = Math.min(rawFontScale, MAX_FONT_SCALE);
  const titleLineHeight = Math.ceil(FontSize.xxl * fontScale * HEADER_TITLE_LINE_RATIO);
  // Band = title line box + the header row's vertical padding (Spacing.sm each side) + a
  // Spacing.md slack so the descender never sits flush against the mask edge.
  const headerHeight = titleLineHeight + Spacing.sm * 2 + Spacing.md;
  return { fontScale, titleLineHeight, headerHeight };
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
  /** Faint highlight overlay for the top portion of the surface. */
  sheenColor: string;
  /**
   * Translucent dark overlay for the bottom portion of the surface.
   */
  shadeColor: string;
  /**
   * Opaque hex equivalent of `backgroundColor` — pass this to contrastOn(),
   * never `backgroundColor` itself, since glass's backgroundColor is a
   * translucent rgba() string that contrastOn() can't parse.
   */
  contrastBase: string;
};

const MATERIAL_BORDER_WIDTH = 1.5;

/**
 * Computes glass surface-finish tokens from a single base colour.
 * Spread the border/shadow keys onto the outer (shadow-casting) view and
 * `backgroundColor` + `sheenColor` onto an inner overflow:hidden mask.
 */
export function getMaterialStyle(base: string): MaterialStyle {
  // Frosted-pane look from the base colour's own hue (lightened, not blended toward
  // an unrelated icy-blue) — every feature colour keeps its identity.
  const tinted = lighten(base, 0.16);
  return {
    backgroundColor: rgba(tinted, 0.84),
    borderWidth: MATERIAL_BORDER_WIDTH,
    borderColor: rgba('#FFFFFF', 0.5),
    borderTopColor: rgba('#FFFFFF', 0.75),
    borderBottomColor: rgba('#000000', 0.15),
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
    sheenColor: rgba('#FFFFFF', 0.5),
    shadeColor: rgba('#000000', 0.12),
    contrastBase: tinted,
  };
}
