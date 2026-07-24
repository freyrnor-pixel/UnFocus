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
 *   Feature accents (screen hues — lib/screenColor.ts): featTask, featPlan, featHabit, featShop, featMeal, featBudget, featNote, featHealth, featScan
 *   Card identity ramp (blue→violet — lib/domainColor.ts, drives card badge+wash+edge): cardTask,
 *     cardPlan, cardHabit, cardShop, cardMeal, cardBudget, cardNote, cardHealth, cardScan
 *   Priority ramp (reserved, unwired — no live UI/DB reads this yet): priorityHigh,
 *     priorityHighSoft, priorityMedium, priorityMediumSoft, priorityLow, priorityLowSoft
 *   Category palette (reserved, unwired — no live UI/DB reads this yet): categoryWork,
 *     categoryWorkSoft, categoryHealth, categoryHealthSoft, categoryHome, categoryHomeSoft,
 *     categoryPersonal, categoryPersonalSoft, categoryShared, categorySharedSoft
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
  featScan: string;        // Scan screen hue (violet) — per-screen color, no domain bubble

  // ── Card identity ramp (blue→violet, octet+scan) ─────────────────────────
  // A cohesive ordered ramp that colours each CARD TYPE (lib/domainColor.ts), distinct from the
  // feat* screen hues above. Cards read as one family (never random) and re-tint per scheme; the
  // hue drives the CardAccent badge + header wash + the domain-coded card's edge. Ordered by the
  // same routine sequence as feat* (plan→task→habit→health→meal→shop→budget→note, +scan violet).
  cardPlan: string;
  cardTask: string;
  cardHabit: string;
  cardHealth: string;
  cardMeal: string;
  cardShop: string;
  cardBudget: string;
  cardNote: string;
  cardScan: string;

  // ── Priority ramp (reserved — no live feature reads these yet) ────────────
  priorityHigh: string;
  priorityHighSoft: string;
  priorityMedium: string;
  priorityMediumSoft: string;
  priorityLow: string;
  priorityLowSoft: string;

  // ── Category palette (reserved — no live feature reads these yet) ────────
  categoryWork: string;
  categoryWorkSoft: string;
  categoryHealth: string;
  categoryHealthSoft: string;
  categoryHome: string;
  categoryHomeSoft: string;
  categoryPersonal: string;
  categoryPersonalSoft: string;
  categoryShared: string;
  categorySharedSoft: string;
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
  // 2026-07-18 "Soft daylight" palette (Visual Refresh Phase 01). Airy, pale, cool-blue
  // daylight mood — replaces the earlier "Vivid & clean" values. Every token name is
  // preserved (closed ThemePalette set); only values change. shadow stays a themed
  // translucent ink (not black) so depth shifts hue with the theme.
  bg: '#EEF3F9',
  surface: '#FCFDFF',
  surfaceMuted: '#E7EDF4',
  surfaceInset: '#DEE6EF',
  text: '#1B2432',
  textMuted: '#5F6A79',
  textInverse: '#FFFFFF',
  // 2026-07-24 contrast pass: bumped from #D3DBE6 (1.25:1 on bg, 1.37:1 on surface — invisible,
  // well under WCAG 1.4.11's 3:1 non-text minimum) to a slate-blue that clears 3:1 against both
  // bg and surface while staying in the theme's cool-blue family (contrastRatio() above verifies).
  border: '#7689A8',
  borderStrong: '#2B5FD9',
  // accent = Save/primary action colour. Aligned to the card-accent DS's --color-primary (#2563EB),
  // a hair more saturated than the prior #3B6FE0 — action colour stays constant across all cards.
  accent: '#2563EB',
  accentSoft: '#CFE0FB',
  accentInk: '#FFFFFF',
  good: '#1FA974',
  goodSoft: '#C4EFDD',
  // bad = Delete/destructive colour. Aligned to the DS --status-danger (#EF4444 / soft #FEE2E2).
  bad: '#EF4444',
  badSoft: '#FEE2E2',
  warn: '#BF7A1C',
  warnSoft: '#FBEBD3',
  shadow: 'rgba(38,58,92,0.10)',
  overlay: 'rgba(20,28,44,0.42)',
  hintBg: '#E6EEFC',
  hintBorder: '#BAD0F6',
  hintAccent: '#3B6FE0',
  // Domain accents ordered by ROUTINE SEQUENCE (2026-07-13 redesign) — color signifies
  // "the order of things," not a random rainbow. Read in the order a user moves through a day
  // (plan → task → habit → health → meal → shop → budget → note) the hue walks a deliberate
  // arc: a smooth cool gradient across the morning "get-things-done" block (indigo → blue →
  // sky → teal), then warm midday activity (orange → green), settling to money-amber and a
  // golden-yellow note accent. Health stays OFF red (it was #DC2626 === `bad`) on a calm teal.
  // (2026-07-14 "Vivid & clean" refresh: the whole octet moved to bright, confident Tailwind-
  // 500-family hues for a higher-tier look — Shopping now reads as a fresh green (#22C55E, was
  // the muddy olive-lime #65A30D) and Notes a clean golden yellow (#EAB308, was olive-lemon
  // #C9C30D). The earlier hard rule that every domain hue must sit clear of `good`(green)/
  // `bad`(red)/`warn`(gold) was RELAXED per product direction: with the app's clear button
  // layout/section structure, a green Shopping chip near a green "done" status reads fine —
  // proximity is disambiguated by placement, not hue. Status logic is UNCHANGED: good/bad/warn
  // still drive done/overdue/soon via getStatusColor; a domain accent only shows for `default`
  // rows. See lib/domainColor.ts for the mapping.)
  featPlan: '#6E74EE',   // 1 · indigo   — plan the day
  featTask: '#4C8DF0',   // 2 · blue     — do tasks
  featHabit: '#22A7E0',  // 3 · sky      — keep habits
  featHealth: '#17BEB0', // 4 · teal     — track health (off red/`bad`)
  featMeal: '#E88A52',   // 5 · orange   — eat (2026-07-18: muted off neon #F5843A, less candy)
  featShop: '#3DAF6F',   // 6 · green    — shop (2026-07-18: muted off neon #34C06A, less candy)
  featBudget: '#D69420', // 7 · amber    — money (2026-07-20: deepened/desaturated off the
  // brighter #F0A81E — that shade read as too loud/candy next to the tab bar's new neutral
  // blue selection accent; same hue family, calmer)
  featNote: '#E6BC1C',   // 8 · yellow   — reflect / note
  // Scan screen hue — violet, distinct from featPlan indigo. Per-screen color only
  // (Scan has no domain bubble); read via lib/screenColor.ts (2026-07-18).
  featScan: '#9B72E3',

  // Card identity ramp (2026-07-19 "Card accent system"): a cohesive blue→violet ramp for CARD
  // colour, separate from the feat* screen hues above. Values are the design-system ramp
  // (guidelines/colors-card-accent.html) laid across the routine sequence — habit/health/meal/shop
  // land on the DS's exact --feature-* hexes. Drives CardAccent's badge+wash + the card's edge
  // (lib/domainColor.ts); screens keep their feat* hues (decision: cards-only palette scope).
  cardPlan: '#2572AA',
  cardTask: '#2A6EC0',
  cardHabit: '#3468D3',
  cardHealth: '#4865D7',
  cardMeal: '#5761DA',
  cardShop: '#635DDB',
  cardBudget: '#7059DA',
  cardNote: '#7C53D9',
  cardScan: '#894DD8',

  // Reserved priority/category ramps from the 2026-07-14 Claude Design brief — no live
  // feature reads these yet (dormant `priority` SQLite column, unwired category concept).
  priorityHigh: '#C4341F',
  priorityHighSoft: '#FBEAE8',
  priorityMedium: '#B7691A',
  priorityMediumSoft: '#FDF1E1',
  priorityLow: '#5B6472',
  priorityLowSoft: '#EEF1F4',

  categoryWork: '#2854C9',
  categoryWorkSoft: '#EFF3FF',
  categoryHealth: '#0F8B63',
  categoryHealthSoft: '#ECF9F5',
  categoryHome: '#A9631E',
  categoryHomeSoft: '#FBF1E8',
  categoryPersonal: '#7A4FC9',
  categoryPersonalSoft: '#F3EEFC',
  categoryShared: '#B23E82',
  categorySharedSoft: '#FBEAF3',
};

const defaultDark: ThemePalette = {
  // 2026-07-18 "Midnight glass" palette (Visual Refresh Phase 01). Deep-navy, low-glare
  // night mood pairing with Soft daylight above. Every token name is preserved; only
  // values change. shadow stays a themed translucent ink (not black) so depth shifts hue
  // with the theme.
  bg: '#080B12',
  surface: '#151C2B',
  surfaceMuted: '#10151F',
  surfaceInset: '#0B0F17',
  text: '#E9EDF5',
  textMuted: '#8B95A7',
  textInverse: '#080B12',
  // 2026-07-24 contrast pass: bumped from #2A3346 (1.56:1 on bg — invisible) and #3C4B66
  // (2.24:1 — still under WCAG 1.4.11's 3:1 non-text minimum) to lighter slate-blues that
  // clear 3:1 against both bg and surface, mirroring the light-theme border bump above.
  border: '#5B6C8A',
  borderStrong: '#7891B6',
  accent: '#6EA8FF',
  accentSoft: '#1B2C49',
  accentInk: '#080B12',
  good: '#34D399',
  goodSoft: '#123227',
  bad: '#FB7185',
  badSoft: '#3A1620',
  warn: '#F0B24A',
  warnSoft: '#33240F',
  shadow: 'rgba(0,2,10,0.65)',
  overlay: 'rgba(0,0,0,0.62)',
  hintBg: '#141E30',
  hintBorder: '#28405F',
  hintAccent: '#6EA8FF',
  // Dark mirrors the light "Vivid & clean" arc (2026-07-14): same hue families, brighter
  // tints for the dark surface. Order plan → task → habit → health → meal → shop → budget →
  // note; health = teal (off red/`bad`). See the light block above for the full rationale
  // (bright Tailwind-family hues, collision-avoidance relaxed) and lib/domainColor.ts.
  featPlan: '#8A90FF',   // 1 · indigo
  featTask: '#6BA5FF',   // 2 · blue
  featHabit: '#4CC3F5',  // 3 · sky
  featHealth: '#2DD4C4', // 4 · teal
  featMeal: '#F09763',   // 5 · orange (2026-07-18: muted off neon #FF9A55)
  featShop: '#50C68C',   // 6 · green  (2026-07-18: muted off neon #45D588)
  featBudget: '#EAB84C', // 7 · amber (2026-07-20: deepened/desaturated off #FBBF3C, dark mirror
  // of the light-mode change above — same reasoning, less neon against the blue tab bar)
  featNote: '#FBD24B',   // 8 · yellow
  // Scan screen hue — violet (per-screen color only; see lib/screenColor.ts, 2026-07-18).
  featScan: '#BE9DF7',

  // Card identity ramp (dark): each light stop lightened ~0.20 for legibility on the dark surface,
  // same approach the dark feat* octet uses; hue order preserved. See the light block for rationale.
  cardPlan: '#518EBB',
  cardTask: '#558BCD',
  cardHabit: '#5D86DC',
  cardHealth: '#6D84DF',
  cardMeal: '#7981E1',
  cardShop: '#827DE2',
  cardBudget: '#8D7AE1',
  cardNote: '#9675E1',
  cardScan: '#A171E0',

  // Reserved priority/category ramps — dark values from the 2026-07-14 Claude Design brief.
  priorityHigh: '#F0685A',
  priorityHighSoft: '#2A0F0D',
  priorityMedium: '#E0A030',
  priorityMediumSoft: '#2A2010',
  priorityLow: '#8A93A0',
  priorityLowSoft: '#171C24',

  categoryWork: '#6E9CF5',
  categoryWorkSoft: '#101B33',
  categoryHealth: '#34C99A',
  categoryHealthSoft: '#0B241C',
  categoryHome: '#E0A050',
  categoryHomeSoft: '#2A2013',
  categoryPersonal: '#B197F0',
  categoryPersonalSoft: '#201A33',
  categoryShared: '#E870B0',
  categorySharedSoft: '#2E1522',
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
