/**
 * domainColor.ts — semantic color-coding layer over the card-identity ramp.
 *
 * One place that maps each app "domain" (task, plan, habit, shop, meal, budget,
 * note, health) to a triad {accent, soft, ink} + two gradient primitives, derived from
 * the palette's blue→violet `card*` ramp (constants/colors.ts), plus a per-status mapping
 * (done/overdue/soon/default) onto the semantic good/bad/warn tokens. Every screen's section
 * headers, AddRow accent, badges, ExpandableCard.accentColor, and CardAccent (badge+wash) pull
 * their hue from here so a domain reads the same color everywhere (design criteria 1, 4, 8).
 *
 * NOTE (2026-07-19 "Card accent system"): domain colour now comes from the `card*` ramp, NOT the
 * `feat*` octet. `feat*` still drives the per-SCREEN hue (lib/screenColor.ts — green Shopping, teal
 * Health, …); `card*` is a separate cohesive blue→violet ramp for CARD identity. So a card's badge
 * intentionally need not match its screen's background hue (decision: cards-only palette scope).
 *
 * Domain → palette token (the card* hexes are ordered by ROUTINE SEQUENCE in constants/colors.ts —
 * colour signifies the order of a day walked as one blue→violet family, not a random rainbow):
 *   plan→cardPlan · task→cardTask · habit→cardHabit · health→cardHealth
 *   meal→cardMeal · shop→cardShop · budget→cardBudget · note→cardNote
 *
 * Status → semantic token:
 *   done→good · overdue→bad · soon→warn · default→the domain accent
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), constants/theme (rgba, contrastOn, mix)
 *   Used by → components/AddRow, components/CardAccent (badge+wash gradients), and screen
 *             headers/badges (plans/shopping/health/settings and their card components) that
 *             color-code by domain
 *   Data    → pure functions over a ThemePalette; no state
 *
 * Edit notes:
 *   - Callers pass the resolved palette from useAppTheme() — these are plain
 *     functions, not hooks, so they can be used inside render or memo.
 *   - `soft` is a translucent tint of the accent (works on any surface, both
 *     modes) rather than a second hardcoded token; `ink` is contrast-picked.
 *   - `washTop`/`badgeGradient` are the "one gradient move" (2026-07-19): a soft header-wash
 *     tint (accent blended 22% into the surface) and the icon-badge two-stop (accent →
 *     accent-mixed-toward-navy CARD_BADGE_DEEP). Both are consumed by components/CardAccent.
 *   - **(2026-07-14) Dropped the whole-card `tint` field**: domain-coded cards used to wash the
 *     entire card fill with a soft blend of the accent into `theme.surface`. Feedback was that the
 *     tint read as muddy/unnatural, so cards pass `borderColor={accent}` to `<Surface>` (a colored
 *     edge on a plain fill) and, from 2026-07-19, a CardAccent header WASH (a top band only, never a
 *     whole-card fill) — the wash stays a band, not a full tint, so it doesn't reopen that issue.
 */
import { ThemePalette } from '@/constants/colors';
import { rgba, contrastOn, mix } from '@/constants/theme';

/**
 * Deep navy the icon-badge gradient mixes toward for its darker second stop (the DS's `--brown`,
 * which is actually a navy). `badgeGradient`'s second stop = 65% accent + 35% this.
 */
export const CARD_BADGE_DEEP = '#1E3A8A';

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
  /**
   * Header-wash tinted stop (2026-07-19): the accent blended 22% into `theme.surface`. The
   * CardAccent header wash is a `[washTop → theme.surface]` gradient band behind the title row.
   */
  washTop: string;
  /**
   * Icon-badge two-stop fill (2026-07-19): `[accent, mix(accent, CARD_BADGE_DEEP, 0.35)]` — a
   * 135° gradient from the true accent to a navy-shifted darker end (the DS badge recipe).
   */
  badgeGradient: readonly [string, string];
};

const DOMAIN_TOKEN: Record<Domain, keyof ThemePalette> = {
  task: 'cardTask',
  plan: 'cardPlan',
  habit: 'cardHabit',
  shop: 'cardShop',
  meal: 'cardMeal',
  budget: 'cardBudget',
  note: 'cardNote',
  health: 'cardHealth',
};

/** Resolve a domain's {accent, soft, ink, washTop, badgeGradient} from the active palette. */
export function getDomainColor(theme: ThemePalette, domain: Domain): DomainTriad {
  const accent = theme[DOMAIN_TOKEN[domain]] as string;
  return {
    accent,
    soft: rgba(accent, 0.14),
    ink: contrastOn(accent),
    washTop: mix(theme.surface, accent, 0.22),
    badgeGradient: [accent, mix(accent, CARD_BADGE_DEEP, 0.35)] as const,
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
