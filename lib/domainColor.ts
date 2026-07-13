/**
 * domainColor.ts — semantic color-coding layer over the feature-accent octet.
 *
 * One place that maps each app "domain" (task, plan, habit, shop, meal, budget,
 * note, health) to a triad {accent, soft, ink} derived from the palette's `feat*`
 * tokens (constants/colors.ts), plus a per-status mapping (done/overdue/soon/default)
 * onto the semantic good/bad/warn tokens. Every screen's section headers, AddRow
 * accent, badges, and ExpandableCard.accentColor pull their hue from here so a
 * domain reads the same color everywhere (design criteria 1, 4, 8).
 *
 * Domain → palette token:
 *   task→featTask · plan→featPlan · habit→featHabit · shop→featShop
 *   meal→featMeal · budget→featBudget · note→featNote · health→featHealth
 *
 * Status → semantic token:
 *   done→good · overdue→bad · soon→warn · default→the domain accent
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), constants/theme (rgba, contrastOn)
 *   Used by → components/AddRow, and screen headers/badges (plans/shopping/health/
 *             settings and their card components) that color-code by domain
 *   Data    → pure functions over a ThemePalette; no state
 *
 * Edit notes:
 *   - Callers pass the resolved palette from useAppTheme() — these are plain
 *     functions, not hooks, so they can be used inside render or memo.
 *   - `soft` is a translucent tint of the accent (works on any surface, both
 *     modes) rather than a second hardcoded token; `ink` is contrast-picked.
 */
import { ThemePalette } from '@/constants/colors';
import { rgba, contrastOn, mix } from '@/constants/theme';

export type Domain =
  | 'task'
  | 'plan'
  | 'habit'
  | 'shop'
  | 'meal'
  | 'budget'
  | 'note'
  | 'health';

export type DomainTriad = {
  /** Solid domain hue — headers, active tab underline, AddRow confirm fill, accent bars. */
  accent: string;
  /** Translucent tint of the accent for soft backgrounds/badges. */
  soft: string;
  /** Legible text/icon color to sit on top of `accent`. */
  ink: string;
  /**
   * Solid, opaque pale surface tint (the accent softly blended into theme.surface) for
   * tinting a whole card so a section visibly belongs to its domain (2026-07-13 grouping
   * pass). Solid hex — pass as Surface's `tint` (getMaterialStyle can't parse an rgba()).
   * In dark mode this equals `theme.surface` (no tint) — see getDomainColor.
   */
  tint: string;
};

const DOMAIN_TOKEN: Record<Domain, keyof ThemePalette> = {
  task: 'featTask',
  plan: 'featPlan',
  habit: 'featHabit',
  shop: 'featShop',
  meal: 'featMeal',
  budget: 'featBudget',
  note: 'featNote',
  health: 'featHealth',
};

/** Perceived-brightness check so the tint strength can adapt to light vs dark palettes. */
function isDarkSurface(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** Resolve a domain's {accent, soft, ink, tint} triad from the active palette. */
export function getDomainColor(theme: ThemePalette, domain: Domain): DomainTriad {
  const accent = theme[DOMAIN_TOKEN[domain]] as string;
  return {
    accent,
    soft: rgba(accent, 0.14),
    ink: contrastOn(accent),
    // Whole-card tint. Light mode: ~15% accent into white keeps body text at the same
    // contrast while clearly coloring the card. Dark mode: skip it (return surface) — the
    // feature accents are bright, so tinting a dark card lightens it and erodes textMuted
    // legibility; there the 4px accent bar already carries the domain identity.
    tint: isDarkSurface(theme.surface) ? theme.surface : mix(theme.surface, accent, 0.15),
  };
}

export type RowStatus = 'done' | 'overdue' | 'soon' | 'default';

/**
 * Map a row/item status to its {accent, soft} pair. `default` falls back to the
 * domain accent so an untagged row still carries its screen's identity color.
 */
export function getStatusColor(
  theme: ThemePalette,
  status: RowStatus,
  domain: Domain,
): { accent: string; soft: string } {
  switch (status) {
    case 'done':
      return { accent: theme.good, soft: theme.goodSoft };
    case 'overdue':
      return { accent: theme.bad, soft: theme.badSoft };
    case 'soon':
      return { accent: theme.warn, soft: theme.warnSoft };
    default: {
      const d = getDomainColor(theme, domain);
      return { accent: d.accent, soft: d.soft };
    }
  }
}
