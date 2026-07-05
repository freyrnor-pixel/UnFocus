/**
 * colors.ts — Decision 006 colour theme token layer
 *
 * Six named themes (Default, Summer, Nature, Fluffy Pink, Gothic, Black & White),
 * each with complete light and dark palettes. Theme choice and dark-mode choice
 * are NOT independent: the dark-mode toggle selects the dark side of the
 * currently active theme. Token names are semantic, not color-based.
 *
 * Token list (closed set — every theme provides all of these, ×2 modes):
 *   Surfaces: bg, surface, surfaceMuted, surfaceInset
 *   Text: text, textMuted, textInverse
 *   Borders: border, borderStrong
 *   Accent: accent, accentSoft, accentInk
 *   Semantic state: good, goodSoft, bad, badSoft, warn, warnSoft
 *   Depth: shadow, overlay
 *   Hint card: hintBg, hintBorder, hintAccent
 *   Feature accents: featTask, featPlan, featHabit, featShop, featMeal, featBudget, featNote, featHealth
 *
 * Contrast constraints (light AND dark):
 *   1. text and textMuted both ≥ 4.5:1 contrast against both bg AND surface
 *      (light-mode textMuted was darkened in this file for comfortable AA at 12px)
 *   2. border is lighter than surface in dark mode
 *   3. surface is lighter than bg in dark mode
 *   4. accents desaturated ~25% in dark to avoid neon clash
 *   5. accent, good, warn, hintAccent, and every feat* token hit ≥ 4.5:1 (≥ 3:1
 *      where only ever used at icon size, e.g. accent-on-accentSoft) against
 *      every bg/surface they're actually rendered on as text or icon colour —
 *      not just as a fill, where accentInk's runtime override already covers
 *      legibility. Several light-theme values (warn, good, featMeal, and the
 *      Summer/Fluffy Pink accents) were too pale to clear this and were
 *      darkened; verify with contrastRatio() before lightening any of them
 *      back.
 *   6. borderStrong has *more* contrast against surface than border does, in
 *      both modes — it's the focused-input border (FormControls.tsx), so a
 *      focus state must never be less visible than the resting state. Light
 *      mode previously had this inverted (borderStrong was fainter than
 *      border) — fixed by strengthening borderStrong, not weakening border.
 *
 * accentInk note:
 *   The `accentInk` values below are effectively placeholders. `lib/useAppTheme.ts`
 *   OVERRIDES accentInk at runtime with contrastOn(accent) so text/icons on an accent
 *   fill are always WCAG-legible (several accents are too light for white ink). Don't
 *   rely on the literal accentInk here; change `accent` and the ink follows automatically.
 *
 * Connections:
 *   Imports → —
 *   Used by → lib/useAppTheme.ts (which re-derives accentInk via contrastOn)
 *   Data    → pure constants (accentInk is re-derived downstream in useAppTheme)
 */

export type ThemeName = 'default' | 'summer' | 'nature' | 'fluffyPink' | 'gothic' | 'blackWhite';

/**
 * Complete palette for a single theme mode (light or dark).
 * Every token is required — TypeScript will error if any are missing.
 */
export interface ThemePalette {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  bg: string;              // Page background (darkest in dark mode, lightest in light mode)
  surface: string;         // Card / elevated surface
  surfaceMuted: string;    // Sunken / secondary surface
  surfaceInset: string;    // Inset well (deepest surface)

  // ── Text ─────────────────────────────────────────────────────────────────
  text: string;            // Primary text (must be ≥ 4.5:1 contrast on bg AND surface)
  textMuted: string;       // Secondary text (must be ≥ 4.5:1 contrast on bg AND surface)
  textInverse: string;     // Text on coloured backgrounds

  // ── Borders ──────────────────────────────────────────────────────────────
  border: string;          // Primary border (lighter than surface in dark)
  borderStrong: string;    // Stronger border (lighter than border)

  // ── Accent ───────────────────────────────────────────────────────────────
  accent: string;          // Primary action / active state
  accentSoft: string;      // Accent tint for backgrounds
  accentInk: string;       // Text/icon colour on accent backgrounds

  // ── Semantic state ───────────────────────────────────────────────────────
  good: string;            // Success (chromatic in all themes, including Black & White)
  goodSoft: string;        // Success background
  bad: string;             // Error/destructive (chromatic in all themes, including Black & White)
  badSoft: string;         // Error background
  warn: string;            // Warning
  warnSoft: string;        // Warning background

  // ── Depth ────────────────────────────────────────────────────────────────
  shadow: string;          // Shadow colour (per-theme tint)
  overlay: string;         // Modal/sheet backdrop rgba

  // ── Hint card ────────────────────────────────────────────────────────────
  hintBg: string;          // Hint/explanation card background
  hintBorder: string;      // Hint card border
  hintAccent: string;      // Hint card accent

  // ── Feature accents (octet) ──────────────────────────────────────────────
  featTask: string;        // Task type bubble
  featPlan: string;        // Plan type bubble
  featHabit: string;       // Habit type bubble
  featShop: string;        // Shopping type bubble
  featMeal: string;        // Meal type bubble
  featBudget: string;      // Budget type bubble
  featNote: string;        // Note type bubble
  featHealth: string;      // Health type bubble
}

export interface ThemeVariant {
  light: ThemePalette;
  dark: ThemePalette;
}

// ── Colour manipulation helpers ──────────────────────────────────────────────

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

function desaturate(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const gray = (r + g + b) / 3;
  return rgbToHex(r + (gray - r) * amount, g + (gray - g) * amount, b + (gray - b) * amount);
}

function relLuminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Calculate WCAG contrast ratio between two hex colours.
 * Returns a number ≥ 1; ≥ 4.5 is AA compliant for body text.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relLuminance(hex1);
  const l2 = relLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ── Default Theme (Cool blue, Linear/Notion-clean) ──────────────────────────

const defaultLight: ThemePalette = {
  bg: '#F2F8FE',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F6FB',
  surfaceInset: '#E8F2FE',
  text: '#0F1C2E',
  textMuted: '#4E6182',
  textInverse: '#FFFFFF',
  border: '#B0CFF2',
  borderStrong: '#5590E9',
  accent: '#0B62F2',
  accentSoft: '#DBEAFE',
  accentInk: '#FFFFFF',
  good: '#107636',
  goodSoft: '#DCEADE',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  warn: '#976306',
  warnSoft: '#FEFCE8',
  shadow: 'rgba(15,28,46,0.12)',
  overlay: 'rgba(0,0,0,0.5)',
  hintBg: '#E9EFFD',
  hintBorder: '#B3C8F8',
  hintAccent: '#0B62F2',
  featTask: '#2563EB',
  featPlan: '#7C3AED',
  featHabit: '#107636',
  featShop: '#0891B2',
  featMeal: '#A55A05',
  featBudget: '#8B5CF6',
  featNote: '#DB2777',
  featHealth: '#DC2626',
};

const defaultDark: ThemePalette = {
  bg: '#070C18',
  surface: '#18243E',
  surfaceMuted: '#0F1B2E',
  surfaceInset: '#060914',
  text: '#DDE9FB',
  textMuted: '#7A9FC6',
  textInverse: '#07101F',
  border: '#2A4264',
  borderStrong: '#3A5578',
  accent: '#60A5FA',
  accentSoft: '#1E3A5F',
  accentInk: '#07101F',
  good: '#34D399',
  goodSoft: '#0D2A1A',
  bad: '#F87171',
  badSoft: '#220A0A',
  warn: '#FCD34D',
  warnSoft: '#1A1400',
  shadow: 'rgba(0,3,12,0.6)',
  overlay: 'rgba(0,0,0,0.7)',
  hintBg: '#0C1E38',
  hintBorder: '#1A3A60',
  hintAccent: '#60A5FA',
  featTask: '#60A5FA',
  featPlan: '#C084FC',
  featHabit: '#34D399',
  featShop: '#22D3EE',
  featMeal: '#FBBF24',
  featBudget: '#E879F9',
  featNote: '#F472B6',
  featHealth: '#F87171',
};

// ── Summer Theme (Warm cream + slate, orange) ────────────────────────────────

const summerLight: ThemePalette = {
  bg: '#FFFAF5',
  surface: '#FFFFFF',
  surfaceMuted: '#FDF6EE',
  surfaceInset: '#F5EFE7',
  text: '#3F2817',
  textMuted: '#685138',
  textInverse: '#FFFFFF',
  border: '#E7C6AE',
  borderStrong: '#C77F3D',
  accent: '#C04719',
  accentSoft: '#FDD7BA',
  accentInk: '#FFFFFF',
  good: '#107636',
  goodSoft: '#DCEADE',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  warn: '#976306',
  warnSoft: '#FEFCE8',
  shadow: 'rgba(63,40,23,0.12)',
  overlay: 'rgba(0,0,0,0.5)',
  hintBg: '#FDF0E7',
  hintBorder: '#F5C4A3',
  hintAccent: '#C04719',
  featTask: '#EA580C',
  featPlan: '#D97706',
  featHabit: '#107636',
  featShop: '#0891B2',
  featMeal: '#9E6506',
  featBudget: '#8B5CF6',
  featNote: '#DB2777',
  featHealth: '#DC2626',
};

const summerDark: ThemePalette = {
  bg: '#1A140C',
  surface: '#2A1F18',
  surfaceMuted: '#15110A',
  surfaceInset: '#0C0905',
  text: '#EFE4D9',
  textMuted: '#B8956F',
  textInverse: '#1A140C',
  border: '#51392C',
  borderStrong: '#5A4438',
  accent: '#F08A5D',
  accentSoft: '#3A2818',
  accentInk: '#1A140C',
  good: '#34D399',
  goodSoft: '#0D2A1A',
  bad: '#F87171',
  badSoft: '#220A0A',
  warn: '#FCD34D',
  warnSoft: '#1A1400',
  shadow: 'rgba(0,0,0,0.6)',
  overlay: 'rgba(0,0,0,0.7)',
  hintBg: '#24190E',
  hintBorder: '#5A3F30',
  hintAccent: '#F08A5D',
  featTask: '#FB923C',
  featPlan: '#FBBF24',
  featHabit: '#34D399',
  featShop: '#22D3EE',
  featMeal: '#FCD34D',
  featBudget: '#E879F9',
  featNote: '#F472B6',
  featHealth: '#F87171',
};

// ── Nature Theme (Parchment + olive, forest green) ──────────────────────────

const natureLight: ThemePalette = {
  bg: '#F2FAF4',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F8F2',
  surfaceInset: '#E8F5EC',
  text: '#0D3018',
  textMuted: '#3F684B',
  textInverse: '#FFFFFF',
  border: '#9BDAAE',
  borderStrong: '#3EA24F',
  accent: '#497A3E',
  accentSoft: '#C6E8B9',
  accentInk: '#FFFFFF',
  good: '#107636',
  goodSoft: '#DCEADE',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  warn: '#976306',
  warnSoft: '#FEFCE8',
  shadow: 'rgba(13,48,24,0.12)',
  overlay: 'rgba(0,0,0,0.5)',
  hintBg: '#E8F8EC',
  hintBorder: '#C2EDCE',
  hintAccent: '#497A3E',
  featTask: '#2563EB',
  featPlan: '#7C3AED',
  featHabit: '#107636',
  featShop: '#0891B2',
  featMeal: '#A55A05',
  featBudget: '#8B5CF6',
  featNote: '#DB2777',
  featHealth: '#DC2626',
};

const natureDark: ThemePalette = {
  bg: '#08140A',
  surface: '#16261C',
  surfaceMuted: '#0F1E16',
  surfaceInset: '#080D0A',
  text: '#D0F0D8',
  textMuted: '#6AB87A',
  textInverse: '#08140A',
  border: '#285038',
  borderStrong: '#3A6A4A',
  accent: '#82A86A',
  accentSoft: '#1A3520',
  accentInk: '#08140A',
  good: '#34D399',
  goodSoft: '#0D2A1A',
  bad: '#F87171',
  badSoft: '#220A0A',
  warn: '#FCD34D',
  warnSoft: '#1A1400',
  shadow: 'rgba(5,15,10,0.6)',
  overlay: 'rgba(0,0,0,0.7)',
  hintBg: '#0A1A10',
  hintBorder: '#1A3820',
  hintAccent: '#82A86A',
  featTask: '#60A5FA',
  featPlan: '#C084FC',
  featHabit: '#34D399',
  featShop: '#22D3EE',
  featMeal: '#FBBF24',
  featBudget: '#E879F9',
  featNote: '#F472B6',
  featHealth: '#F87171',
};

// ── Fluffy Pink Theme (Powder + plum, dusty rose) ─────────────────────────

const fluffyPinkLight: ThemePalette = {
  bg: '#FFF5F9',
  surface: '#FFFFFF',
  surfaceMuted: '#FFF0F7',
  surfaceInset: '#FDE7F1',
  text: '#4A1530',
  textMuted: '#845069',
  textInverse: '#FFFFFF',
  border: '#F4BCD6',
  borderStrong: '#E95DA0',
  accent: '#C62E73',
  accentSoft: '#F8D0E0',
  accentInk: '#FFFFFF',
  good: '#107636',
  goodSoft: '#DCEADE',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  warn: '#976306',
  warnSoft: '#FEFCE8',
  shadow: 'rgba(74,21,48,0.13)',
  overlay: 'rgba(0,0,0,0.5)',
  hintBg: '#FDEAF3',
  hintBorder: '#F8C6DF',
  hintAccent: '#C62E73',
  featTask: '#EC4899',
  featPlan: '#A855F7',
  featHabit: '#107636',
  featShop: '#0891B2',
  featMeal: '#9E6506',
  featBudget: '#8B5CF6',
  featNote: '#DB2777',
  featHealth: '#DC2626',
};

const fluffyPinkDark: ThemePalette = {
  bg: '#1A0612',
  surface: '#2C1322',
  surfaceMuted: '#14080E',
  surfaceInset: '#0A0406',
  text: '#FCE7F3',
  textMuted: '#E0A0C0',
  textInverse: '#1A0612',
  border: '#562D43',
  borderStrong: '#5A3848',
  accent: '#F09BC2',
  accentSoft: '#3A1828',
  accentInk: '#1A0612',
  good: '#34D399',
  goodSoft: '#0D2A1A',
  bad: '#F87171',
  badSoft: '#220A0A',
  warn: '#FCD34D',
  warnSoft: '#1A1400',
  shadow: 'rgba(25,5,15,0.6)',
  overlay: 'rgba(0,0,0,0.7)',
  hintBg: '#1A0A16',
  hintBorder: '#2A1428',
  hintAccent: '#F09BC2',
  featTask: '#F472B6',
  featPlan: '#E879F9',
  featHabit: '#34D399',
  featShop: '#22D3EE',
  featMeal: '#FBBF24',
  featBudget: '#E879F9',
  featNote: '#F472B6',
  featHealth: '#F87171',
};

// ── Gothic Theme (Ivory→near-black, aubergine) ────────────────────────────

const gothicLight: ThemePalette = {
  bg: '#F5F0FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F0FB',
  surfaceInset: '#F0EAFF',
  text: '#200E40',
  textMuted: '#5B4D75',
  textInverse: '#FFFFFF',
  border: '#CFC5FE',
  borderStrong: '#9A81DD',
  accent: '#5C2A50',
  accentSoft: '#E5D4E0',
  accentInk: '#FFFFFF',
  good: '#107636',
  goodSoft: '#DCEADE',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  warn: '#976306',
  warnSoft: '#FEFCE8',
  shadow: 'rgba(32,14,64,0.12)',
  overlay: 'rgba(0,0,0,0.5)',
  hintBg: '#F1ECFE',
  hintBorder: '#D2C4FB',
  hintAccent: '#5C2A50',
  featTask: '#7C3AED',
  featPlan: '#7C3AED',
  featHabit: '#107636',
  featShop: '#0891B2',
  featMeal: '#A55A05',
  featBudget: '#8B5CF6',
  featNote: '#DB2777',
  featHealth: '#DC2626',
};

const gothicDark: ThemePalette = {
  bg: '#0E0818',
  surface: '#241C30',
  surfaceMuted: '#17101F',
  surfaceInset: '#0E0812',
  text: '#F3E8FF',
  textMuted: '#C4A0E8',
  textInverse: '#0E0818',
  border: '#463366',
  borderStrong: '#4E3E70',
  accent: '#A06FA8',
  accentSoft: '#2A1860',
  accentInk: '#0E0818',
  good: '#34D399',
  goodSoft: '#0D2A1A',
  bad: '#F87171',
  badSoft: '#220A0A',
  warn: '#FCD34D',
  warnSoft: '#1A1400',
  shadow: 'rgba(20,10,30,0.7)',
  overlay: 'rgba(0,0,0,0.7)',
  hintBg: '#1A0F2A',
  hintBorder: '#2A1450',
  hintAccent: '#A06FA8',
  featTask: '#C084FC',
  featPlan: '#C084FC',
  featHabit: '#34D399',
  featShop: '#22D3EE',
  featMeal: '#FBBF24',
  featBudget: '#E879F9',
  featNote: '#F472B6',
  featHealth: '#F87171',
};

// ── Black & White Theme (Mono: black-on-white / white-on-black) ─────────────

const blackWhiteLight: ThemePalette = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceMuted: '#EBEBEB',
  surfaceInset: '#E0E0E0',
  text: '#141414',
  textMuted: '#4D4D4D',
  textInverse: '#FFFFFF',
  border: '#C3C3C3',
  borderStrong: '#888888',
  accent: '#141414',
  accentSoft: '#E8E8E8',
  accentInk: '#FFFFFF',
  good: '#16A34A',        // Chromatic: green check (instant recognition as positive)
  goodSoft: '#F0F8F4',
  bad: '#DC2626',         // Chromatic: red cross (instant recognition as negative)
  badSoft: '#FEF6F6',
  warn: '#8B7A0E',        // Chromatic: dark amber (warning)
  warnSoft: '#FEFCE8',
  shadow: 'rgba(0,0,0,0.12)',
  overlay: 'rgba(0,0,0,0.5)',
  hintBg: '#F8F8F8',
  hintBorder: '#C0C0C0',
  hintAccent: '#141414',
  featTask: '#2563EB',    // Chromatic feature colors for differentiation
  featPlan: '#7C3AED',
  featHabit: '#16A34A',
  featShop: '#0891B2',
  featMeal: '#A55A05',
  featBudget: '#8B5CF6',
  featNote: '#DB2777',
  featHealth: '#DC2626',
};

const blackWhiteDark: ThemePalette = {
  bg: '#141414',
  surface: '#2A2A2A',
  surfaceMuted: '#1F1F1F',
  surfaceInset: '#0A0A0A',
  text: '#F0F0F0',
  textMuted: '#A5A5A5',
  textInverse: '#141414',
  border: '#4A4A4A',
  borderStrong: '#5A5A5A',
  accent: '#F0F0F0',
  accentSoft: '#2A2A2A',
  accentInk: '#141414',
  good: '#34D399',        // Chromatic: green check
  goodSoft: '#0D2A1A',
  bad: '#F87171',         // Chromatic: red cross
  badSoft: '#2A0A0A',
  warn: '#FCD34D',        // Chromatic: yellow warning
  warnSoft: '#1A1400',
  shadow: 'rgba(0,0,0,0.6)',
  overlay: 'rgba(0,0,0,0.7)',
  hintBg: '#1F1F1F',
  hintBorder: '#4A4A4A',
  hintAccent: '#F0F0F0',
  featTask: '#60A5FA',    // Chromatic feature colors
  featPlan: '#C084FC',
  featHabit: '#34D399',
  featShop: '#22D3EE',
  featMeal: '#FBBF24',
  featBudget: '#E879F9',
  featNote: '#F472B6',
  featHealth: '#F87171',
};

// ── Theme registry ───────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, ThemeVariant> = {
  default:     { light: defaultLight,     dark: defaultDark },
  summer:      { light: summerLight,      dark: summerDark },
  nature:      { light: natureLight,      dark: natureDark },
  fluffyPink:  { light: fluffyPinkLight,  dark: fluffyPinkDark },
  gothic:      { light: gothicLight,      dark: gothicDark },
  blackWhite:  { light: blackWhiteLight,  dark: blackWhiteDark },
};

export const THEME_META: Record<ThemeName, { label: string }> = {
  default:     { label: 'Default' },
  summer:      { label: 'Summer' },
  nature:      { label: 'Nature' },
  fluffyPink:  { label: 'Fluffy Pink' },
  gothic:      { label: 'Gothic' },
  blackWhite:  { label: 'Black & White' },
};

/**
 * Ionicons glyph shown inside each theme's picker swatch (SwatchPicker in
 * settings + onboarding step 5). Lives here — alongside the canonical palette —
 * so the swatch previews and the runtime chrome always agree on the theme set
 * (the old copy in constants/theme.ts was keyed to the legacy AppColors themes,
 * which caused the picker/palette mismatch: Tech & Fluffy fell back to Default
 * and Black & White was unreachable).
 */
export const THEME_ICONS: Record<ThemeName, string> = {
  default:     'water-outline',
  summer:      'sunny-outline',
  nature:      'leaf-outline',
  fluffyPink:  'flower-outline',
  gothic:      'moon-outline',
  blackWhite:  'contrast-outline',
};

/**
 * Resolve a theme palette for the given theme name and mode.
 * Returns the light palette for the theme, or dark if isDark is true.
 */
export function getThemePalette(themeName: ThemeName, isDark: boolean): ThemePalette {
  const variant = THEMES[themeName];
  if (!variant) {
    return THEMES.default[isDark ? 'dark' : 'light'];
  }
  return isDark ? variant.dark : variant.light;
}
