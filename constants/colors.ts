/**
 * colors.ts — Decision 006 colour theme token layer
 *
 * Single named theme (Default) with complete light and dark palettes.
 * Token names are semantic, not color-based.
 *
 * Token list (closed set — both modes provide all of these):
 *   Surfaces: bg, surface, surfaceMuted, surfaceInset
 *   Text: text, textMuted, textInverse
 *   Borders: border, borderStrong
 *   Accent: accent, accentSoft, accentInk
 *   Semantic state: good, goodSoft, bad, badSoft, warn, warnSoft
 *   Depth: shadow, overlay
 *   Hint card: hintBg, hintBorder, hintAccent
 *   Feature accents: featTask, featPlan, featHabit, featShop, featMeal, featBudget, featNote, featHealth
 *
 * Connections:
 *   Imports → —
 *   Used by → lib/useAppTheme.ts (which re-derives accentInk via contrastOn)
 *   Data    → pure constants (accentInk is re-derived downstream in useAppTheme)
 */

export type ThemeName = 'default';

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
  good: string;            // Success (chromatic)
  goodSoft: string;        // Success background
  bad: string;             // Error/destructive
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

// ── Theme registry ───────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, ThemeVariant> = {
  default: { light: defaultLight, dark: defaultDark },
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
