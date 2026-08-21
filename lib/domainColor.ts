/**
 * domainColor.ts — semantic color-coding layer over the card-identity hues.
 *
 * One place that maps each app "domain" (task, plan, habit, shop, meal, budget,
 * note, health) to a triad {accent, soft, ink} + two gradient primitives, derived from
 * the palette's `card*` tokens (constants/colors.ts), plus a per-status mapping
 * (done/overdue/soon/default) onto the semantic good/bad/warn tokens. Every screen's section
 * headers, AddRow accent, badges, DisclosureRow.accentColor, and CardAccentBadge pull
 * their hue from here so a domain reads the same color everywhere (design criteria 1, 4, 8).
 *
 * ⚠️ **AN IDENTITY HUE IS A FILL. IT IS NEVER TEXT AND NEVER AN ICON COLOUR** (2026-07-31,
 * addendum A.4 rule 1). The two channels it is allowed on are the gradient BADGE
 * (components/CardAccent.tsx) and a card's own low-alpha EDGE (`<Surface borderColor>`), plus
 * the fill-shaped derivatives of those: `soft` plates, chip/row washes, a progress-bar fill, an
 * AddRow confirm button. Drawing `accent` as a glyph colour or as `style.color` is a bug — pass
 * `theme.text`/`theme.textMuted` for ink, `theme.accent` for something you can act on, and a
 * status token (`good`/`bad`/`warn`) for something that IS a status. Reason, not taste: an
 * identity hue is chosen to be seen as a colour, not measured against a background, and the
 * neon set makes that worse rather than better — every one of the five is bright enough that on
 * the LIGHT surface it measures 1.1–3.1:1, i.e. a word or glyph in one is not readable at all.
 * (The pre-2026-08-16 version of this note cited Shopping's gold at 2.25:1 as the single worst
 * case and the four-hue set's L\* spread as the thing that only survives on a filled shape. The
 * gold is gone; the L\* spread went with it and then came BACK on 2026-08-17 — see
 * DESIGN_RULES.md rule 11a — but the rule this paragraph states never depended on either and
 * binds on all five regardless.)
 * `badgeGlyphFor()` below is the ONE sanctioned exception, and it is sanctioned precisely
 * because it measures.
 *
 * The mirror rule (A.4 rule 2): a STATUS token is the opposite — text/icon only, never a fill.
 * `getStatusColor()` below is the sanctioned mapping and currently has no production callers.
 *
 * COLLAPSED 2026-07-31 (addendum A.3) from nine hues to four, then RETUNED to FIVE neon
 * categoricals on 2026-08-16 (maintainer brief §7) — To-do amber, Habits cyan, Health rose,
 * Shopping green, **Notes amethyst**, which is the one that changed count: Notes was
 * IDENTITY_NEUTRAL under A.3 and has a hue of its own now. The token names all survive so
 * DOMAIN_TOKEN below is untouched, but several domains deliberately share a value
 * (task/plan, shop/meal/budget/scan), which is why the badge GLYPH became load-bearing: see
 * components/CardAccent.tsx's DOMAIN_ICON note.
 *
 * Domain → palette token (the card* hexes are ordered by ROUTINE SEQUENCE in constants/colors.ts):
 *   plan→cardPlan · task→cardTask · habit→cardHabit · health→cardHealth
 *   meal→cardMeal · shop→cardShop · budget→cardBudget · note→cardNote
 *
 * Status → semantic token:
 *   done→good · overdue→bad · soon→warn · default→the domain accent
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), constants/theme (rgba, contrastOn, mix)
 *   Used by → components/AddRow, components/CardAccent (badge gradient + its ink), and screen
 *             headers/badges (plans/shopping/health/settings and their card components) that
 *             color-code by domain
 *   Data    → pure functions over a ThemePalette; no state
 *
 * Edit notes:
 *   - Callers pass the resolved palette from useAppTheme() — these are plain
 *     functions, not hooks, so they can be used inside render or memo.
 *   - `soft` is a translucent tint of the accent (works on any surface, both
 *     modes) rather than a second hardcoded token; `ink` is contrast-picked.
 *   - **`ink` is ALWAYS white now (2026-08-11)** — a maintainer report that the badge read
 *     inconsistent ("some color and black, some color and white") across cards. It used to be
 *     `contrastOn(accent)`, white for three hues and DARK for Shopping (gold, `#D9A441`, is only
 *     2.25:1 with white). Rather than keep the two-tone split, `badgeGradientFor()` below mixes
 *     a hue's badge fill further toward the navy deep-stop UNTIL white clears the WCAG 1.4.11
 *     3:1 floor on the lighter stop — for To-do/Habits/Health/Notes the accent already clears it
 *     unmixed, so their gradient is byte-identical to before; only Shopping (and its shop/meal/
 *     budget/scan aliases) actually deepens. `ink` is not a licence to draw the hue as text
 *     elsewhere — it only ever means "on top of this fill".
 *   - **This is the fourth time an all-white badge was proposed and the first time it stuck** —
 *     see components/CardAccent.tsx's history notes for the three prior declines. Those were
 *     rejected because they hardcoded white and ignored contrast on the fill as it existed;
 *     this instead changes the fill so white is genuinely legible. Don't revert to a bare
 *     `color="#FFFFFF"` without `badgeGradientFor` under it, or the old defect comes back.
 *   - **`washTop` HAS NO CONSUMERS as of 2026-07-31 (addendum A.4 rule 3).** The CardAccent
 *     header wash it fed is deleted: a card was carrying its hue three times (badge + wash +
 *     edge) for one idea, so the wash went and badge + edge stayed. It is still computed here
 *     only because `lib/__tests__/domainColor.test.ts` case (e) pins it and that test is not to
 *     be weakened. Do NOT wire it back into a component — if you want the wash gone entirely,
 *     that is a test change and therefore a separate, deliberate decision.
 *   - `badgeGradient` is the icon-badge two-stop (accent → accent-mixed-toward-navy
 *     CARD_BADGE_DEEP), consumed by components/CardAccent.
 *   - **(2026-07-14) Dropped the whole-card `tint` field**: domain-coded cards used to wash the
 *     entire card fill with a soft blend of the accent into `theme.surface`. Feedback was that the
 *     tint read as muddy/unnatural, so cards pass `borderColor={accent}` to `<Surface>` — a
 *     coloured edge on a plain fill, which is still the arrangement today.
 */
import { ThemePalette, contrastRatio } from '@/constants/colors';
import { rgba, mix } from '@/constants/theme';

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
  /**
   * Solid domain hue. **A FILL, never ink** (A.4 rule 1): the badge gradient, a card's
   * `<Surface borderColor>` edge, an AddRow confirm fill, a chip/row wash. Not `style.color`,
   * not an icon `color` — see the ⚠️ block in this file's header.
   */
  accent: string;
  /** Translucent tint of the accent for soft backgrounds/plates. Also a fill. */
  soft: string;
  /**
   * Legible glyph colour to sit ON TOP of `badgeGradient` — i.e. only inside the badge or
   * another accent-filled shape. **Always `BADGE_ICON_INK` (white) since 2026-08-11** — see
   * `badgeGradientFor()` below for how the fill guarantees that stays legible.
   */
  ink: string;
  /**
   * Header-wash tinted stop (2026-07-19): the accent blended 22% into `theme.surface`.
   * **UNUSED since 2026-07-31 (A.4 rule 3) — the CardAccent header wash it fed is deleted.**
   * Kept only because domainColor.test.ts case (e) pins it; don't wire it into a component.
   */
  washTop: string;
  /**
   * Icon-badge two-stop fill (2026-07-19, deepened per-hue 2026-08-11 — see
   * `badgeGradientFor()`): `[lightStop, mix(accent, CARD_BADGE_DEEP, lightT + 0.35)]`, a 135°
   * gradient from a hue-supporting-white starting point to a navy-shifted darker end. For most
   * hues `lightStop` IS the raw accent (t=0), same as the original 2026-07-19 recipe.
   */
  badgeGradient: readonly [string, string];
};

/** The icon-badge glyph colour — always white. See the file header's 2026-08-11 addendum. */
export const BADGE_ICON_INK = '#FFFFFF';

/** Safety margin over the WCAG 1.4.11 3:1 floor `lib/__tests__/colors.test.ts` enforces. */
const BADGE_ICON_MIN_CONTRAST = 3.3;

/** How far the two badge-gradient stops sit apart, in mix-toward-navy units (unchanged since 2026-07-19). */
const BADGE_GRADIENT_SPAN = 0.35;

/**
 * The two-stop badge gradient for a given accent. Starts at the pure accent (t=0) and walks it
 * toward `CARD_BADGE_DEEP` in 1% steps until the white glyph clears `BADGE_ICON_MIN_CONTRAST` on
 * the LIGHTER stop — contrast only rises as the mix deepens toward navy, so the lighter stop is
 * always the binding constraint; the darker stop (light stop + `BADGE_GRADIENT_SPAN`) is never
 * checked separately because it's strictly higher-contrast once the light stop clears.
 *
 * ⚠️ **Which hues get deepened flipped almost completely on 2026-08-16.** This note used to say
 * that only Shopping's gold shifted and everyone else's light stop was the raw accent. Under
 * the neon set it is the other way round: white measures 1.40–3.55:1 on the five, so all but
 * one start already-mixed toward the navy. The exception is whichever hue sits at the BOTTOM of
 * the lightness band — Health's rose until 2026-08-17, **Notes' violet since**, the ladder
 * having moved rose up to rung 3. That is the function working as designed under a brighter
 * palette, not a regression — the guarantee is "white is legible on both stops", not "the light
 * stop is the accent". `lib/__tests__/domainColor.test.ts` case (e) derives the deepened set
 * rather than listing it, so it cannot go stale this way again.
 */
function badgeGradientFor(accent: string): readonly [string, string] {
  let t = 0;
  while (
    t < 1 &&
    contrastRatio(BADGE_ICON_INK, mix(accent, CARD_BADGE_DEEP, t)) < BADGE_ICON_MIN_CONTRAST
  ) {
    t += 0.01;
  }
  const lightStop = t === 0 ? accent : mix(accent, CARD_BADGE_DEEP, t);
  return [lightStop, mix(accent, CARD_BADGE_DEEP, Math.min(1, t + BADGE_GRADIENT_SPAN))] as const;
}

/**
 * Exposed for components/CardAccent.tsx's `accentOverride` path (Home's preview cards, which
 * pass their source screen's `feat*` hue instead of a domain's `card*` hue) — same guarantee,
 * same function, so a screen-hue badge gets the identical white-legibility treatment a
 * domain-hue badge does.
 */
export { badgeGradientFor };

/**
 * The INVERTED badge (Tactile Glass, 2026-08-15): the hue as a fully-opaque GLYPH sitting on a
 * neutral frosted plate, instead of a white glyph on a hue-gradient plate.
 *
 * Brief §4: *"an icon badge should be a translucent frosted circle with a brightly colored,
 * fully opaque vector icon sitting on top."*
 *
 * ⚠️ **This inverts A.4 rule 1 — "AN IDENTITY HUE IS A FILL. IT IS NEVER TEXT AND NEVER AN
 * ICON COLOUR"** — and that rule was not arbitrary, so read this before restoring it. Its
 * evidence was that Shopping's gold `#D9A441` measures 2.25:1 on *its own soft hue wash*, and
 * that "a fixed opacity cannot hold across eight hues and two modes". Both facts are still
 * true. What changed is the GROUND: the plate is neutral now, not a wash of the same hue, and
 * a hue-on-neutral measurement is a different measurement — one this function makes rather
 * than assumes. The rule's real content was "never put a hue somewhere nothing checks its
 * contrast", and the check is right here.
 *
 * So: walk the accent toward white (dark mode) or black (light) in 1% steps until it clears
 * `BADGE_ICON_MIN_CONTRAST` on the plate — the exact mirror of `badgeGradientFor`, which walks
 * the FILL toward navy until white clears the same floor.
 *
 * ⚠️ **This is a NO-OP in dark mode and load-bearing in light**, and that is the good outcome
 * rather than a reason to delete it. Measured on the real plates (2026-08-17 lightness ladder):
 *   dark plate  `#323232` — todo 9.14 ✓ · habits 7.39 ✓ · health 5.89 ✓ · shopping 4.62 ✓ ·
 *                           notes 3.61 ✓   (all clear unaided — bright-on-near-black is the
 *                           entire point of the set; the ladder narrows the spread from
 *                           3.54–9.83 to 3.61–9.14 without dropping a rung under the floor)
 *   light plate `#EBEDF1` — **all five fail: todo 1.20 ✗ · habits 1.48 ✗ · health 1.86 ✗ ·
 *                           shopping 2.37 ✗ · notes 3.03 ✗** (Notes was the last hue that
 *                           cleared unaided, at 3.09 before the ladder)
 * So the derivation earns its keep entirely in LIGHT mode, where it is the only thing between
 * a `#0DB34A` glyph and a 2.37:1 badge. `lib/__tests__/colors.test.ts`'s "the raw hue is NOT
 * safe for at least one identity hue" guard is scoped to light for this reason.
 * (Before the 2026-08-16 neon retune the numbers ran the other way — three hues failed in dark
 * and only Shopping's gold failed in light, at 1.92:1.)
 *
 * **The L\* ladder survives the walk, and now that the ladder is back (2026-08-17) that matters
 * again.** What the walk must not do is collapse two hues into each other, and it cannot: in
 * dark it moves nothing, and in light every hue moves toward black by the same rule, which
 * preserves their order — the rungs compress slightly but never cross.
 *
 * @param plate the composited frost colour to measure against — `theme.badgeFrost` over the
 *   pane. Passed in rather than derived here because this module has no access to what the
 *   badge is actually sitting on, and guessing is how the 2.25:1 gold shipped in the first place.
 */
export function badgeGlyphFor(accent: string, plate: string, isDark: boolean): string {
  const towards = isDark ? '#FFFFFF' : '#000000';
  let t = 0;
  let cur = accent;
  while (t < 1 && contrastRatio(cur, plate) < BADGE_ICON_MIN_CONTRAST) {
    t += 0.01;
    cur = mix(accent, towards, t);
  }
  return cur;
}

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
    ink: BADGE_ICON_INK,
    washTop: mix(theme.surface, accent, 0.22),
    badgeGradient: badgeGradientFor(accent),
  };
}

export type RowStatus = 'done' | 'overdue' | 'soon' | 'default';

/**
 * Map a row/item status to its {accent, soft} pair. `default` falls back to the
 * domain accent so an untagged row still carries its screen's identity color.
 *
 * **Zero production callers as of 2026-07-31** — verified while auditing A.4 rule 2 ("a status
 * token is text/icon colour, never a fill"). Only domainColor.test.ts case (c) calls it, so the
 * rule holds vacuously *here*. It does NOT hold app-wide: `theme.good` is used directly as a
 * FILL in ~15 places (every done-checkbox in TaskCard/ShoppingRow/MedicineTrayCard, several
 * confirm buttons, Badge/Button/ConfirmationBanner variants). That is a real, separate finding —
 * unwinding it would rewrite the app's done-state affordance and was deliberately left alone.
 * If you ever wire this function up, note its returned `accent` is a status colour: draw it as
 * ink, and don't reach for the `soft` half to make a plate out of it.
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
