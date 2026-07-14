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
 * Domain → palette token (the feat* hexes are ordered by ROUTINE SEQUENCE in
 * constants/colors.ts — color signifies the order of a day, not a random rainbow;
 * green/red/amber are reserved for status, so no domain hue collides with done/overdue/soon):
 *   plan→featPlan · task→featTask · habit→featHabit · health→featHealth
 *   meal→featMeal · shop→featShop · budget→featBudget · note→featNote
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
 *   - **(2026-07-14) Dropped the whole-card `tint` field**: domain-coded cards
 *     (Home previews, WeekListCard, health.tsx) used to wash the entire card fill
 *     with a soft blend of the accent into `theme.surface`. Feedback was that the
 *     tint read as muddy/unnatural, so cards now pass `borderColor={accent}` to
 *     `<Surface>` instead — a colored edge on a plain `theme.surface` fill. `accent`
 *     already covers that use; nothing else needs a separate blended fill color.
 */
import { ThemePalette } from '@/constants/colors';
import { rgba, contrastOn } from '@/constants/theme';

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
  /** Solid domain hue — headers, active tab underline, AddRow confirm fill, card borders. */
  accent: string;
  /** Translucent tint of the accent for soft backgrounds/badges. */
  soft: string;
  /** Legible text/icon color to sit on top of `accent`. */
  ink: string;
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

/** Resolve a domain's {accent, soft, ink} triad from the active palette. */
export function getDomainColor(theme: ThemePalette, domain: Domain): DomainTriad {
  const accent = theme[DOMAIN_TOKEN[domain]] as string;
  return {
    accent,
    soft: rgba(accent, 0.14),
    ink: contrastOn(accent),
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
