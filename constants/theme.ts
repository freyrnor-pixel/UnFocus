/**
 * theme.ts — design tokens: colour themes (light/dark) + spacing/radius/type/shadow scales.
 *
 * Defines five named colour palettes (default/tech/gothic/nature/custom),
 * their dark variants, and shared layout constants. `getTheme(name, isDark, customColors)`
 * resolves a palette; lib/useAppTheme.ts wraps it to react to the user's theme + dark-mode
 * settings. The static `Colors` export is the default theme's light palette.
 * `getSoftTheme(colors)` returns a gentler, lower-contrast variant for emotional/health screens.
 * `Fonts` holds the rounded Nunito family tokens, `Layout` the shared card padding/rhythm.
 * `getFontSize(base, scale)` applies the user's fontSize preference to a base pt.
 * `getMaterialStyle(base, material)` computes bubble/FAB surface-finish tokens
 * (glass/metal/rock/paper) from a single base colour, tinted toward that
 * finish's real-world hue — see "Materials" section below.
 * `tintToTheme(base, themeAccent)` leans a fixed feature colour (FeatureColors.*)
 * toward the active theme's accent hue/saturation, so per-feature colours (bubble
 * wheel, task-type accents) shift with the selected colour theme instead of always
 * rendering the exact same hardcoded hues.
 *
 * Connections:
 *   Imports → —
 *   Used by → app/_layout.tsx, app/budget.tsx, app/capture.tsx, app/focus.tsx, app/habit-form.tsx, app/habits.tsx, app/health.tsx, app/index.tsx, app/meals.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/onboarding/step2.tsx, app/onboarding/step3.tsx, app/onboarding/step4.tsx, app/onboarding/step5.tsx, app/onboarding/step6.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/BubbleMenu.tsx, components/DatePickerCalendar.tsx, components/DayTimeline.tsx, components/ExpandableCard.tsx, components/HintCard.tsx, components/QuickAddSheet.tsx, components/ShoppingRow.tsx, components/TaskItem.tsx, components/TimePickerWheel.tsx, lib/useAppTheme.ts
 *   Data    → none (pure constants)
 *
 * Edit notes:
 *   - Every theme must implement the full AppColors interface — add a new key to
 *     ALL palettes (THEMES + DARK_THEMES) or getTheme returns undefined colours.
 *   - For theme-aware screens prefer useAppTheme() over the static `Colors`,
 *     which is always the light default palette.
 *   - `neutral` is a muted mid-tone used for shame-free UI elements (empty habit circles, backlog badges).
 *   - The 'custom' theme is computed from user's primary/secondary colors via buildCustomTheme().
 *   - Materials are a separate axis from colour themes (a bubble's hue + its finish are
 *     independent settings). metal/rock/paper tint the input base toward a per-finish
 *     reference hue (steel grey metal, stone grey rock, warm paper) before shading it —
 *     so the same base colour still looks recognizably different per finish (see tint()
 *     below, which blends hue/saturation at the base's own lightness to keep existing
 *     text-contrast assumptions intact). glass deliberately does NOT tint toward an
 *     unrelated reference hue — it just lightens the base colour itself (lighten(base,
 *     0.16) at higher alpha) so every theme/feature colour keeps its own identity instead
 *     of washing toward a flat icy grey-blue.
 */
export type ThemeName = 'default' | 'tech' | 'gothic' | 'nature' | 'fluffy' | 'custom';
export type FontSizeScale = 'small' | 'default' | 'large';

export interface AppColors {
  cream: string;
  orange: string;
  orangeLight: string;
  green: string;
  greenLight: string;
  brown: string;
  brownLight: string;
  white: string;
  offWhite: string;
  gray: string;
  grayLight: string;
  black: string;
  text: string;
  textLight: string;
  danger: string;
  dangerLight: string;
  shadow: string;
  border: string;
  /** Muted neutral tone — used for shame-free empty circles / backlog badges. */
  neutral: string;
  /** Hint/explanation box surface — derived from `orange` (primary), not `green`, so it always harmonizes with the theme's own accent rather than an unrelated secondary hue. */
  hintBg: string;
  hintBorder: string;
  hintAccent: string;
}

const fontScaleMap: Record<FontSizeScale, number> = { small: 0.875, default: 1, large: 1.2 };

/** Apply the user's fontSize preference to any base point size. */
export function getFontSize(base: number, scale: FontSizeScale): number {
  return Math.round(base * fontScaleMap[scale]);
}

// ─── Colour manipulation helpers for the custom theme ───────────────────────

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

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function relLuminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const DARK_TEXT = '#1E293B';

/**
 * Returns whichever of near-black (DARK_TEXT) or white text has the higher WCAG
 * contrast ratio against hexBg. Picking the actual winner (rather than a flat
 * luminance>0.6 threshold, which this replaced) matters once a background's
 * luminance lands in a mid-range zone — e.g. an amber bubble tinted toward
 * paper's cream hue scored only 2.96:1 against white but 4.95:1 against dark
 * text, and the old threshold picked the worse one.
 */
export function contrastOn(hexBg: string): string {
  const bgLum = relLuminance(hexBg);
  const darkLum = relLuminance(DARK_TEXT);
  const contrastWithWhite = (Math.max(bgLum, 1) + 0.05) / (Math.min(bgLum, 1) + 0.05);
  const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
  return contrastWithDark >= contrastWithWhite ? DARK_TEXT : '#FFFFFF';
}

/**
 * Like contrastOn(), but picks ONE text colour (DARK_TEXT or white) for a whole
 * set of backgrounds — the one whose *worst-case* (minimum) contrast across all
 * of them is highest. Used by the bubble wheel so every label is the same colour
 * (not flipped per-hue) while still staying readable on the hardest bubble.
 */
export function contrastOnAll(hexBgs: string[]): string {
  if (hexBgs.length === 0) return DARK_TEXT;
  const darkLum = relLuminance(DARK_TEXT);
  let minWhite = Infinity;
  let minDark = Infinity;
  for (const bg of hexBgs) {
    const bgLum = relLuminance(bg);
    minWhite = Math.min(minWhite, (Math.max(bgLum, 1) + 0.05) / (Math.min(bgLum, 1) + 0.05));
    minDark = Math.min(minDark, (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05));
  }
  return minDark >= minWhite ? DARK_TEXT : '#FFFFFF';
}

function buildCustomTheme(primary: string, secondary: string, isDark: boolean): AppColors {
  if (isDark) {
    return {
      cream: '#0C0C14',
      orange: lighten(primary, 0.25),
      orangeLight: darken(primary, 0.7),
      green: lighten(secondary, 0.25),
      greenLight: darken(secondary, 0.8),
      brown: lighten(primary, 0.35),
      brownLight: darken(primary, 0.65),
      // Depth ladder: offWhite (sunken) < cream (bg) < white (raised card). `white`
      // sits clearly above `cream` so a card reads as elevated without a sheen highlight.
      white: '#1A1A2C',
      offWhite: '#0A0A12',
      gray: '#7A7A98',
      grayLight: '#161628',
      black: '#000000',
      text: '#EEEEF8',
      textLight: '#9A9AB8',
      danger: '#F87171',
      dangerLight: '#220A0A',
      shadow: 'rgba(0, 0, 10, 0.6)',
      // Subtle dark border, not bright primary — the primary colour itself
      // is way too bright to read as a border on a dark field.
      border: darken(primary, 0.3),
      neutral: '#606080',
      hintBg: darken(primary, 0.8),
      hintBorder: darken(primary, 0.6),
      hintAccent: lighten(primary, 0.25),
    };
  }
  return {
    cream: lighten(primary, 0.92),
    orange: primary,
    orangeLight: lighten(primary, 0.7),
    green: secondary,
    greenLight: lighten(secondary, 0.7),
    brown: darken(primary, 0.3),
    brownLight: lighten(primary, 0.4),
    white: lighten(primary, 0.985),
    offWhite: lighten(primary, 0.85),
    gray: '#8A8A9A',
    grayLight: lighten(primary, 0.88),
    black: '#000000',
    text: darken(primary, 0.6),
    textLight: darken(primary, 0.3),
    danger: '#E05050',
    dangerLight: '#FFE0E0',
    shadow: `rgba(0,0,0,0.12)`,
    border: lighten(primary, 0.6),
    neutral: lighten(primary, 0.5),
    hintBg: lighten(primary, 0.9),
    hintBorder: lighten(primary, 0.65),
    hintAccent: primary,
  };
}

// ─── Light themes ────────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, AppColors> = {
  // Watercolor tree logo blue, soft glow whites — clean, focused, calm.
  default: {
    cream: '#F2F8FE',
    orange: '#2563EB',
    orangeLight: '#BFDBFE',
    green: '#10B981',
    greenLight: '#A7F3D0',
    brown: '#1E3A8A',
    brownLight: '#60A5FA',
    white: lighten('#2563EB', 0.985),
    offWhite: '#E8F2FE',
    gray: '#94A3B8',
    grayLight: '#DCEEFC',
    black: '#000000',
    text: '#142545',
    textLight: '#5C7299',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    shadow: 'rgba(30,41,59,0.12)',
    border: '#CDE6FA',
    neutral: '#A3C2E4',
    hintBg: lighten('#2563EB', 0.9),
    hintBorder: lighten('#2563EB', 0.65),
    hintAccent: '#2563EB',
  },
  // Sky blue with blue-tinted white and grey details — modern, airy.
  tech: {
    cream: '#F0F5FC',
    orange: '#0EA5E9',
    orangeLight: '#BAE6FD',
    green: '#06B6D4',
    greenLight: '#CFFAFE',
    brown: '#0369A1',
    brownLight: '#7DD3FC',
    white: lighten('#0EA5E9', 0.985),
    offWhite: '#E8F1FB',
    gray: '#6B8090',
    grayLight: '#D8E8F5',
    black: '#000000',
    text: '#0C1A28',
    textLight: '#4A6070',
    danger: '#F43F5E',
    dangerLight: '#FFE4E6',
    shadow: 'rgba(12,26,40,0.12)',
    border: '#C0D8F0',
    neutral: '#8AAAC0',
    hintBg: lighten('#0EA5E9', 0.9),
    hintBorder: lighten('#0EA5E9', 0.65),
    hintAccent: '#0EA5E9',
  },
  // Soft purple tones in light mode; dark mode is the true gothic look.
  gothic: {
    cream: '#F5F0FF',
    orange: '#7C3AED',
    orangeLight: '#EDE9FE',
    green: '#8B5CF6',
    greenLight: '#F5F3FF',
    brown: '#5B21B6',
    brownLight: '#C4B5FD',
    white: lighten('#7C3AED', 0.985),
    offWhite: '#F0EAFF',
    gray: '#7C6A9E',
    grayLight: '#EAE5F8',
    black: '#000000',
    text: '#200E40',
    textLight: '#6B5A8A',
    danger: '#E11D48',
    dangerLight: '#FFE4E6',
    shadow: 'rgba(32,14,64,0.12)',
    border: '#DDD6FE',
    neutral: '#A890C8',
    hintBg: lighten('#7C3AED', 0.9),
    hintBorder: lighten('#7C3AED', 0.65),
    hintAccent: '#7C3AED',
  },
  // Green seams with white, orange details — earthy, grounded.
  nature: {
    cream: '#F2FAF4',
    orange: '#16A34A',
    orangeLight: '#BBF7D0',
    green: '#15803D',
    greenLight: '#DCFCE7',
    brown: '#EA580C',
    brownLight: '#FED7AA',
    white: lighten('#16A34A', 0.985),
    offWhite: '#E8F5EC',
    gray: '#7A9E84',
    grayLight: '#D8EEE0',
    black: '#000000',
    text: '#0D3018',
    textLight: '#4A7A58',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    shadow: 'rgba(13,48,24,0.12)',
    border: '#C0E8CC',
    neutral: '#8CB89A',
    hintBg: lighten('#16A34A', 0.9),
    hintBorder: lighten('#16A34A', 0.65),
    hintAccent: '#16A34A',
  },
  // Cheerful pastel pink/magenta — playful, soft.
  fluffy: {
    cream: '#FFF0F6',
    orange: '#EC4899',
    orangeLight: '#FBCFE8',
    green: '#F472B6',
    greenLight: '#FCE7F3',
    brown: '#9D174D',
    brownLight: '#F9A8D4',
    white: lighten('#EC4899', 0.985),
    offWhite: '#FCE7F3',
    gray: '#C2839F',
    grayLight: '#F8DCE8',
    black: '#000000',
    text: '#4A0E2E',
    textLight: '#9D5B7D',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    shadow: 'rgba(74,14,46,0.12)',
    border: '#FBCFE8',
    neutral: '#E0A8C2',
    hintBg: lighten('#EC4899', 0.9),
    hintBorder: lighten('#EC4899', 0.65),
    hintAccent: '#EC4899',
  },
  // Placeholder — replaced at runtime by buildCustomTheme() using user's chosen colors.
  custom: {
    cream: '#F8F8F8',
    orange: '#6B6B8A',
    orangeLight: '#E0E0F0',
    green: '#5A8A6B',
    greenLight: '#D0F0D8',
    brown: '#3A3A5A',
    brownLight: '#AAAAC8',
    white: '#FFFFFF',
    offWhite: '#F0F0F8',
    gray: '#8A8A9A',
    grayLight: '#E8E8F0',
    black: '#000000',
    text: '#1A1A2E',
    textLight: '#6A6A80',
    danger: '#E05050',
    dangerLight: '#FFE0E0',
    shadow: 'rgba(0,0,0,0.12)',
    border: '#D0D0E0',
    neutral: '#9090A8',
    hintBg: lighten('#6B6B8A', 0.9),
    hintBorder: lighten('#6B6B8A', 0.65),
    hintAccent: '#6B6B8A',
  },
};

export const THEME_META: Record<ThemeName, { label: string }> = {
  default: { label: 'Default' },
  tech: { label: 'Tech' },
  gothic: { label: 'Gothic' },
  nature: { label: 'Nature' },
  fluffy: { label: 'Fluffy pink' },
  custom: { label: 'Custom' },
};

// ─── Dark themes ─────────────────────────────────────────────────────────────

export const DARK_THEMES: Record<ThemeName, AppColors> = {
  default: {
    cream: '#070C18',
    orange: '#5AABFF',
    orangeLight: '#122B50',
    green: '#34D399',
    greenLight: '#092318',
    brown: '#93C5FD',
    brownLight: '#112040',
    // Navy-based depth ladder: offWhite (sunken) < cream (bg) < white (raised card),
    // all staying within the navy family. `white` sits clearly above `cream` so a card
    // separates from the page on its own, without relying on a sheen highlight.
    white: '#18243E',
    offWhite: '#060914',
    gray: '#57789A',
    grayLight: '#131E30',
    black: '#000000',
    text: '#DDE9FB',
    textLight: '#7A9FC6',
    danger: '#F87171',
    dangerLight: '#220A0A',
    shadow: 'rgba(0, 3, 12, 0.6)',
    // Inky border, understated but visible enough to define a card edge in the dark.
    border: '#2A4264',
    neutral: '#4A6882',
    hintBg: '#0C1E38',
    hintBorder: '#1A3A60',
    hintAccent: '#5AABFF',
  },
  tech: {
    cream: '#080E16',
    orange: '#3DBEF9',
    orangeLight: '#0F1F34',
    green: '#22D3EE',
    greenLight: '#071E26',
    brown: '#7DD3FC',
    brownLight: '#0C1A28',
    white: '#16202E',
    offWhite: '#080D14',
    gray: '#4A7590',
    grayLight: '#0F1E30',
    black: '#000000',
    text: '#D0E8F8',
    textLight: '#6AB5D8',
    danger: '#FB7185',
    dangerLight: '#280810',
    shadow: 'rgba(0, 8, 20, 0.6)',
    border: '#284663',
    neutral: '#3A6080',
    hintBg: '#0D1F36',
    hintBorder: '#1A3A54',
    hintAccent: '#3DBEF9',
  },
  // Full dark gothic — the primary intended look for this theme.
  gothic: {
    cream: '#0E0818',
    orange: '#B366F2',
    orangeLight: '#1F1538',
    green: '#C084FC',
    greenLight: '#0F0820',
    brown: '#E9D5FF',
    brownLight: '#2A1860',
    white: '#241C30',
    offWhite: '#0E0812',
    gray: '#8A6BA8',
    grayLight: '#1E1728',
    black: '#000000',
    text: '#F3E8FF',
    textLight: '#C4A0E8',
    danger: '#F472B6',
    dangerLight: '#2A0820',
    shadow: 'rgba(20, 10, 30, 0.7)',
    border: '#3C2C58',
    neutral: '#7A4AA8',
    hintBg: '#1A0F2A',
    hintBorder: '#2A1450',
    hintAccent: '#B366F2',
  },
  nature: {
    cream: '#08140A',
    orange: '#34D399',
    orangeLight: '#0F2818',
    green: '#16A34A',
    greenLight: '#082014',
    brown: '#FB923C',
    brownLight: '#1A0F06',
    white: '#16261C',
    offWhite: '#080D0A',
    gray: '#5A8064',
    grayLight: '#10201A',
    black: '#000000',
    text: '#D0F0D8',
    textLight: '#6AB87A',
    danger: '#F87171',
    dangerLight: '#280808',
    shadow: 'rgba(5, 15, 10, 0.6)',
    border: '#285038',
    neutral: '#458058',
    hintBg: '#0A1A10',
    hintBorder: '#1A3820',
    hintAccent: '#34D399',
  },
  // Deep plum/maroon with vivid pink accents — fluffy's true-dark counterpart.
  fluffy: {
    cream: '#1A0612',
    orange: '#F580BE',
    orangeLight: '#2A1220',
    green: '#F9A8D4',
    greenLight: '#1A0812',
    brown: '#FBCFE8',
    brownLight: '#3A1828',
    white: '#2C1322',
    offWhite: '#140809',
    gray: '#A88898',
    grayLight: '#1F1018',
    black: '#000000',
    text: '#FCE7F3',
    textLight: '#E0A0C0',
    danger: '#FB7185',
    dangerLight: '#2A0810',
    shadow: 'rgba(25, 5, 15, 0.6)',
    border: '#3E2030',
    neutral: '#9A4878',
    hintBg: '#1A0A16',
    hintBorder: '#2A1428',
    hintAccent: '#F580BE',
  },
  // Placeholder — replaced at runtime by buildCustomTheme().
  custom: {
    cream: '#0C0C14',
    orange: '#8DA3F0',
    orangeLight: '#1A1530',
    green: '#669A77',
    greenLight: '#0D1812',
    brown: '#AAAACC',
    brownLight: '#0F0F20',
    white: '#1A1A2C',
    offWhite: '#0A0A12',
    gray: '#7A7A98',
    grayLight: '#161628',
    black: '#000000',
    text: '#EEEEF8',
    textLight: '#9A9AB8',
    danger: '#F87171',
    dangerLight: '#280808',
    shadow: 'rgba(0, 0, 10, 0.6)',
    border: '#2A2A48',
    neutral: '#606080',
    hintBg: '#0E0A1A',
    hintBorder: '#1A1430',
    hintAccent: '#8DA3F0',
  },
};

export function getTheme(
  name: string,
  isDark = false,
  customColors?: { primary: string; secondary: string }
): AppColors {
  if (name === 'custom' && customColors) {
    return buildCustomTheme(customColors.primary, customColors.secondary, isDark);
  }
  const map = isDark ? DARK_THEMES : THEMES;
  return map[name as ThemeName] ?? (isDark ? DARK_THEMES.default : THEMES.default);
}

/**
 * Soften a palette for emotional / health screens: warms and lowers the contrast
 * of text and surfaces so the screen reads gentler than productivity screens.
 * Pure-function transform over any AppColors.
 */
export function getSoftTheme(c: AppColors): AppColors {
  return {
    ...c,
    text: c.textLight,
    danger: c.neutral,
  };
}

export const Colors = THEMES.default;

/** Ionicons glyph name shown inside each theme's swatch circle (SwatchPicker). */
export const THEME_ICONS: Record<ThemeName, string> = {
  default: 'water-outline',
  tech: 'flash-outline',
  gothic: 'moon-outline',
  nature: 'leaf-outline',
  fluffy: 'flower-outline',
  custom: 'color-palette-outline',
};

/**
 * Bubble/FAB accent colors for BubbleMenu + the task-type accents in task-form/TaskItem.
 * Designed as one coordinated set rather than independent picks: hues are spread
 * ~16-41° apart around the wheel (no two adjacent, so every bubble is unambiguous at a
 * glance — the old set had habits/health as near-identical greens and meals/shop as
 * near-identical cyans), saturation held in a 56-85% band, and lightness tuned per-hue
 * so every value's luminance lands in a tight ~0.42-0.55 range. That luminance band is
 * still worth keeping tight even though BubbleMenu now resolves its icon/label color
 * dynamically via contrastOn(material.contrastBase) rather than a hardcoded white —
 * the tighter the band, the more predictable each entry looks across every material
 * finish's tint/shade.
 * Hue stays anchored to the feature's natural semantic family (task=blue/trust,
 * health=red/heart, habits=green/growth, shared=violet/connection, focus=red-orange/
 * energy) so the mapping still feels intuitive, not just decorative.
 */
export const FeatureColors = {
  task:    '#3A78E4', // blue          — trust / primary action
  scan:    '#D97512', // burnt amber   — camera / attention
  habits:  '#27915F', // forest green  — growth (was too close to health's old green)
  health:  '#DC3853', // rose-red      — heart / vitality
  meals:   '#AF8D1D', // ochre/mustard — food / warmth (was cyan, didn't read as "food")
  shop:    '#2096B6', // teal-cyan     — list / fresh (distinct from task's blue)
  shared:  '#8260D2', // violet        — connection
  focus:   '#E83A17', // red-orange    — energy / urgency (was a stray inline hex in BubbleMenu)
  capture: '#D6399C', // magenta-pink  — quick jot-it-down spark (AP-02), distinct from every hue above
} as const;

/** Meal type colors for the meals screen. */
export const MealColors = {
  breakfast: '#F6C344', // golden yellow
  lunch: '#6BAA75',     // leaf green
  dinner: '#F4A261',    // warm orange
  snack: '#7BC8A4',     // mint green
  kveldsmat: '#9B8EC4', // soft purple
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * Shared card/layout rhythm. Use these instead of ad-hoc padding so every card
 * breathes the same on every screen.
 */
export const Layout = {
  cardPadding: 18,
  cardPaddingV: 18,
  cardPaddingH: 16,
  cardGap: 14,
  maxVisible: 5,
};

export const Radius = {
  sm: 10,
  md: 18,
  lg: 26,
  full: 999,
};

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
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
};

/** 20 preset colors for the custom theme color picker (5 × 4 grid). */
export const CUSTOM_COLOR_PRESETS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#06B6D4', '#0EA5E9', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
  '#78716C', '#6B7280', '#374151', '#1E293B', '#000000',
];

// ─── Materials: bubble/FAB surface finish ───────────────────────────────────
// A finish is a set of pure style tokens (no native gradient/blur deps, so it
// stays OTA-safe) derived from a single base colour, tinted toward that
// finish's real-world hue (see MATERIAL_TINT) before the existing
// lighten/darken shading is applied. Independent from colour themes — any
// bubble's hue and finish can vary separately, the tint just makes sure two
// finishes never render as the literal same colour for the same base.

export type MaterialName = 'glass' | 'metal' | 'rock' | 'paper' | 'plain';

export const MATERIAL_META: Record<MaterialName, { label: string }> = {
  glass: { label: 'Glass' },
  metal: { label: 'Metal' },
  rock: { label: 'Rock' },
  paper: { label: 'Paper' },
  plain: { label: 'Plain' },
};

export type MaterialStyle = {
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  borderTopColor: string;
  borderBottomColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  /**
   * Android shadow depth. RN ignores shadowOpacity/shadowRadius on Android —
   * elevation is the only thing that actually draws a shadow there, so each
   * finish needs its own value or every material looks identical on Android.
   */
  elevation: number;
  /** Faint highlight overlay for the top portion of the surface. */
  sheenColor: string;
  /**
   * Translucent dark overlay for the bottom portion of the surface. Paired with
   * sheenColor (top) it fakes a top→bottom gradient out of stacked Views — no
   * native gradient module, so it stays OTA-safe. Kept as an rgba('#000…') so it
   * composites over both hex and translucent (glass) backgrounds.
   */
  shadeColor: string;
  /**
   * Opaque hex equivalent of `backgroundColor` — pass this to contrastOn(),
   * never `backgroundColor` itself, since glass's backgroundColor is a
   * translucent rgba() string that contrastOn() can't parse.
   */
  contrastBase: string;
};

/** lighten() for amount >= 0, darken() for amount < 0 — one knob, either direction. */
function shade(hex: string, amount: number): string {
  return amount >= 0 ? lighten(hex, amount) : darken(hex, -amount);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Per-channel linear blend toward hexB; t=0 → hexA, t=1 → hexB. */
export function mix(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return rgbToHex(r * 255, g * 255, b * 255);
}

/**
 * Blend `base` toward `target`'s hue/saturation while keeping base's own
 * lightness — re-lighting the target to base's lightness *before* mixing
 * means the blend shifts hue/chroma rather than just averaging two different
 * brightness levels (which mostly cancels out hue and barely moves it; tried
 * that first). Keeping lightness anchored to `base` is also what keeps this
 * contrast-safe: every existing shade()/contrastOn() call downstream of this
 * was tuned against `base`'s lightness, so preserving it means the finish's
 * colour changes without quietly breaking text contrast on top of it.
 */
function tint(base: string, target: string, ratio: number): string {
  const [, , baseL] = hexToHsl(base);
  const [targetH, targetS] = hexToHsl(target);
  const relit = hslToHex(targetH, targetS, baseL);
  return mix(base, relit, ratio);
}

/**
 * Pulls a fixed feature color (FeatureColors.*) toward the active theme's accent
 * hue/saturation, so the bubble wheel actually shifts with the selected color theme
 * instead of always showing the same hardcoded hues regardless of theme. Each
 * feature keeps enough of its own identity (ratio kept below 0.5) that habits is
 * still recognizably green-ish, health red-ish, etc. — it just leans toward the
 * theme's accent rather than sitting completely outside the palette.
 */
export function tintToTheme(base: string, themeAccent: string, ratio = 0.38): string {
  return tint(base, themeAccent, ratio);
}

/**
 * Derives the Egendefinert (custom) theme's primary + secondary accent colours
 * from a single user-chosen hue (0-360). Saturation/lightness are fixed at
 * values tuned to stay contrast-safe with white text (same range as the
 * built-in theme accents), so the user only ever controls hue — every other
 * token (disabled states, surface tints, FAB gradient) already derives from
 * these two via buildCustomTheme().
 */
export function hueToCustomColors(hue: number): { primary: string; secondary: string } {
  const h = ((hue % 360) + 360) % 360;
  const primary = hslToHex(h / 360, 0.62, 0.5);
  const secondary = hslToHex(((h + 140) % 360) / 360, 0.55, 0.45);
  return { primary, secondary };
}

/** Real-world reference hue + blend strength each finish tints its base toward. */
const MATERIAL_TINT: Record<'metal' | 'rock' | 'paper', { color: string; ratio: number }> = {
  metal: { color: '#9AA5AD', ratio: 0.6 }, // brushed steel grey
  rock: { color: '#7D7870', ratio: 0.62 }, // stone grey
  paper: { color: '#E0D2B0', ratio: 0.5 }, // cream / kraft paper
};

// Constant across every finish so switching materials never resizes a card —
// RN/Yoga grows a content-sized box when borderWidth increases (border adds
// onto the intrinsic size unless an explicit width/height is set), so the
// old per-finish widths (1 / 1.5 / 2 / 1 / 1) made cards visibly jump size
// when the material setting changed.
const MATERIAL_BORDER_WIDTH = 1.5;

/**
 * Per-finish surface tokens for bubble/FAB rendering, computed from a single
 * base colour. Spread the border/shadow keys onto the outer (shadow-casting)
 * view and `backgroundColor` + `sheenColor` onto an inner overflow:hidden mask
 * — see components/BubbleMenu.tsx for the two-layer render pattern.
 */
export function getMaterialStyle(base: string, material: MaterialName): MaterialStyle {
  switch (material) {
    case 'metal': {
      const tinted = tint(base, MATERIAL_TINT.metal.color, MATERIAL_TINT.metal.ratio);
      const bg = shade(tinted, -0.08);
      return {
        backgroundColor: bg,
        borderWidth: MATERIAL_BORDER_WIDTH,
        borderColor: shade(tinted, -0.3),
        borderTopColor: shade(tinted, 0.4),
        borderBottomColor: shade(tinted, -0.5),
        shadowOpacity: 0.32,
        shadowRadius: 8,
        elevation: 9,
        sheenColor: rgba('#FFFFFF', 0.3),
        shadeColor: rgba('#000000', 0.2),
        contrastBase: bg,
      };
    }
    case 'rock': {
      const tinted = tint(base, MATERIAL_TINT.rock.color, MATERIAL_TINT.rock.ratio);
      const bg = shade(tinted, -0.18);
      return {
        backgroundColor: bg,
        borderWidth: MATERIAL_BORDER_WIDTH,
        borderColor: shade(tinted, -0.4),
        borderTopColor: shade(tinted, -0.05),
        borderBottomColor: shade(tinted, -0.55),
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
        sheenColor: rgba('#FFFFFF', 0.06),
        shadeColor: rgba('#000000', 0.24),
        contrastBase: bg,
      };
    }
    case 'paper': {
      const tinted = tint(base, MATERIAL_TINT.paper.color, MATERIAL_TINT.paper.ratio);
      const bg = shade(tinted, 0.08);
      return {
        backgroundColor: bg,
        borderWidth: MATERIAL_BORDER_WIDTH,
        borderColor: shade(tinted, -0.08),
        borderTopColor: shade(tinted, 0.18),
        borderBottomColor: shade(tinted, -0.12),
        shadowOpacity: 0.09,
        shadowRadius: 4,
        elevation: 2,
        sheenColor: rgba('#FFFFFF', 0.18),
        shadeColor: rgba('#000000', 0.08),
        contrastBase: bg,
      };
    }
    case 'glass': {
      // Frosted-pane look from the base colour's own hue (lightened, not blended toward
      // an unrelated icy-blue) — every theme/feature colour keeps its identity instead of
      // washing toward grey-blue, and the higher alpha keeps it from diluting into the
      // backdrop behind it.
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
    // No-finish baseline: a flat, even fill with a hairline border and no
    // bevel/sheen — for anyone who wants surfaces to just sit there quietly
    // rather than read as glass/metal/rock/paper.
    case 'plain':
    default:
      return {
        backgroundColor: base,
        borderWidth: MATERIAL_BORDER_WIDTH,
        borderColor: shade(base, -0.06),
        borderTopColor: shade(base, -0.06),
        borderBottomColor: shade(base, -0.06),
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 3,
        sheenColor: rgba('#FFFFFF', 0),
        shadeColor: rgba('#000000', 0.1),
        contrastBase: base,
      };
  }
}
