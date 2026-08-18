/**
 * cardLayout.ts — the layout registry: which layouts a surface offers, and what each one shows.
 *
 * One source of truth for "how should this list be drawn". A surface never switches on a
 * layout id directly — it reads the resolved `LayoutSpec` and renders from its flags. That
 * is what keeps a new layout from requiring an edit in every row component, and what keeps
 * two surfaces on the same detail level from drifting apart visually.
 *
 * Resolution order (see `resolveLayout`): a per-surface override in
 * `settings.cardLayouts` wins; otherwise the global `settings.layoutDetail` applies. An
 * unknown or stale id (a layout that was renamed, or one saved against a different surface)
 * falls back rather than throwing — a bad row in the settings JSON must never be able to
 * blank a screen.
 *
 * **Not to be confused with lib/cardType.ts** (2026-08-01), which is the per-ITEM version of
 * the same idea: this file answers "how does this LIST draw itself" and is a user setting;
 * that one answers "how does this ONE item draw itself" and is a property of the item. They
 * stack as filters on a row and only ever subtract — the card type decides what the item is
 * allowed to show, the layout may then hide more, and neither can add a cue back.
 *
 * Connections:
 *   Imports → (none — deliberately dependency-free so it stays unit-testable and can't
 *             drag notification/DB code into a render path)
 *   Used by → components/ShoppingRow.tsx, components/ShoppingChip.tsx (the `chips` flag),
 *             components/WeekListCard.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/plans.tsx, components/PlanTaskCard.tsx, components/LayoutPickerSheet.tsx,
 *             app/settings.tsx, lib/__tests__/cardLayout.test.ts
 *   Data    → none — pure functions over values the caller already has. Reads no store,
 *             writes nothing, schedules nothing.
 *
 * Edit notes:
 *   - **This module must stay side-effect free.** It never imports lib/notifications,
 *     lib/db, or any store. A layout is a way of drawing data that already exists — it
 *     must not be able to create, cancel, or reschedule a reminder, and must not mutate a
 *     row. `lib/__tests__/cardLayout.test.ts` asserts the import graph stays clean; if you
 *     need store state here, pass it in as an argument instead.
 *   - Adding a layout: add its id to the surface's entry in `SURFACE_LAYOUTS`, add a spec
 *     to `LAYOUT_SPECS`, and add `config.layouts.<id>` labels to BOTH languages in
 *     lib/i18n.ts. Nothing else needs to change — the picker enumerates from here.
 *   - `DETAIL_LEVELS` are the three layouts every surface supports. A surface-specific
 *     layout (inStore, nowNext) is *additional*, never a replacement — so the global
 *     default is always valid for every surface and resolution can't dead-end.
 *   - **A new SHAPE is a flag on an existing layout, not a new id, unless the two would
 *     genuinely be offered side by side.** `chips` (2026-08-20) rides on `inStore` because
 *     that layout already means "big targets, name only, no money, walked in aisle order" —
 *     a second id meaning the same thing would need a name explaining the difference from it,
 *     and the picker would ask the user a question with no good answer. Adding an id is right
 *     when a user would choose BETWEEN them (`nowNext` vs `focusFirst`); a flag is right when
 *     one is simply how the other is drawn.
 */

/**
 * A list-bearing surface that can have its own layout.
 *
 * `homeTodo` is Home's to-do card, deliberately SEPARATE from `plans` (the To-do tab): as of
 * 2026-07-30 the two default differently on purpose — the tab opens on the day timeline, which
 * needs a whole screen to be readable, while Home's card is a plain ruled list like its three
 * sibling cards. One shared key couldn't express that.
 */
export type LayoutSurface = 'shopping' | 'plans' | 'homeTodo' | 'notes' | 'habits' | 'health';

/** The three levels every surface understands; also the shape of the global default. */
export type DetailLevel = 'basic' | 'normal' | 'everything';

/** Every layout id known to the app. */
export type LayoutId =
  | DetailLevel
  | 'inStore'
  | 'nowNext'
  | 'byPerson'
  | 'focusFirst'
  | 'timeline';

export const DETAIL_LEVELS: readonly DetailLevel[] = ['basic', 'normal', 'everything'] as const;

/** The global fallback when nothing else resolves. */
export const FALLBACK_LAYOUT: DetailLevel = 'normal';

/**
 * Which layouts each surface offers, in picker order. Every surface starts with the three
 * detail levels so the global default is always applicable, then adds its own shapes.
 */
export const SURFACE_LAYOUTS: Record<LayoutSurface, readonly LayoutId[]> = {
  shopping: ['basic', 'normal', 'everything', 'inStore'],
  plans: ['basic', 'normal', 'everything', 'timeline', 'nowNext', 'focusFirst', 'byPerson'],
  // Home's to-do card offers the timeline too — it just doesn't default to it. `byPerson`
  // is deliberately absent: a Home preview card is not the place for a second person filter
  // (the same call the Habits card already makes).
  homeTodo: ['basic', 'normal', 'everything', 'timeline', 'nowNext', 'focusFirst'],
  notes: ['basic', 'normal', 'everything'],
  habits: ['basic', 'normal', 'everything'],
  health: ['basic', 'normal', 'everything'],
};

/**
 * What a layout draws. Surfaces read these flags rather than comparing layout ids, so a
 * row component doesn't need to know that "inStore" exists.
 */
export type LayoutSpec = {
  id: LayoutId;
  /** Row height class. Drives scroll-anchor estimation in lib/useLayoutTransition.ts. */
  density: 'compact' | 'normal' | 'roomy';
  /** Secondary line: quantity, unit, qty stepper, in-stock label, step counts. */
  showMeta: boolean;
  /** Money — per-row totals and price footers. */
  showPrice: boolean;
  /** Third-tier detail: category, stock counts, energy cost, linked goal, hints. */
  showExtras: boolean;
  /**
   * Collapse everything except what's immediately actionable (Now and next). The surface
   * decides what "immediate" means; this only says the user asked for it.
   */
  focusMode: boolean;
  /** Oversized rows and hit targets for one-handed use while walking around. */
  bigTouch: boolean;
  /**
   * Re-group the list under whoever each row is for, instead of its usual sections. Only
   * surfaces that HAVE a per-person notion honour it; everywhere else it's simply false,
   * which is why it's optional rather than another positional arg to `spec()`.
   */
  groupByPerson?: boolean;
  /**
   * Re-group the list by shop category (aisle) instead of its usual order. You walk a store
   * in an order, so the list should be in that order too — but ONLY here: everywhere else
   * Weekly rows keep the position the user dragged them to, and a category re-cluster would
   * silently undo that (see lib/shoppingGroups.ts's note on groupByCategory being
   * Monthly-only). Grouping is presentation: no row's stored `orderIndex` is touched, so
   * switching back restores the dragged order exactly.
   */
  groupByAisle?: boolean;
  /**
   * Draw the list as a wrapping grid of tap-to-tick CHIPS instead of ruled rows, and put the
   * ticked ones in a "recently used" drawer under it.
   *
   * Rides on `inStore` rather than being its own layout id, deliberately: that layout already
   * means "big targets, name only, no money, walked in aisle order", and a second id meaning
   * the same thing would need a name that explained the difference from it. This flag says
   * what SHAPE that intent takes; `bigTouch`/`showPrice`/`groupByAisle` still say what a row
   * may draw, so the chip honours them rather than re-deciding.
   *
   * Like every flag here it can only SUBTRACT — a chip drops price and drag-reorder because
   * one tap is already spent on ticking. Nothing is written: switching back to any other
   * layout restores the dragged order and every field untouched.
   */
  chips?: boolean;
  /**
   * Draw the day as a clock-time calendar grid (lib/dayGrid + components/DayGridLines)
   * instead of a ruled list. A surface asks for this flag, never for the `timeline` id — same
   * rule as every other flag here.
   */
  timeline?: boolean;
};

const spec = (
  id: LayoutId,
  density: LayoutSpec['density'],
  showMeta: boolean,
  showPrice: boolean,
  showExtras: boolean,
  focusMode = false,
  bigTouch = false
): LayoutSpec => ({ id, density, showMeta, showPrice, showExtras, focusMode, bigTouch });

export const LAYOUT_SPECS: Record<LayoutId, LayoutSpec> = {
  // "Just the basics" — one line per item, name + check, nothing else.
  basic: spec('basic', 'compact', false, false, false),
  // "Normal" — today's default two-line row.
  normal: spec('normal', 'normal', true, true, false),
  // "Show everything" — every field inline.
  everything: spec('everything', 'roomy', true, true, true),
  // "In the store" — big rows, name only, no money; read at arm's length in a shop, and
  // grouped by aisle because that's the order you physically walk it in.
  inStore: {
    ...spec('inStore', 'roomy', false, false, false, false, true),
    groupByAisle: true,
    chips: true,
  },
  // "Now and next" — the current item large, the next one small, the rest behind a count.
  nowNext: spec('nowNext', 'normal', true, false, false, true, false),
  // "One thing at a time" (design-system v6's `Focus First (1c)`) — ONE task as a hero card,
  // a short "Then" list under it, and a count of everything else. Shares `focusMode` with
  // nowNext because the surface's collapse rule is the same; the difference is the SHAPE the
  // surface draws around it, which is why this is its own id and not a nowNext variant.
  focusFirst: spec('focusFirst', 'normal', true, false, false, true, false),
  // "Timeline" — the day as a calendar grid on an elastic hour axis (hour labels in a left
  // gutter, a live now-line, empty stretches folded into short dashed bands). Same detail as
  // `normal` because it changes the SHAPE, not what a row shows; no price, because a to-do
  // has none. The To-do tab defaults to this (seeded in lib/db.ts's migrations); Home's card
  // offers it but defaults to the ruled list, so the two surfaces read differently on purpose.
  timeline: { ...spec('timeline', 'normal', true, false, false), timeline: true },
  // "By person" — the normal row, re-grouped under whoever each task is for. Same detail
  // as `normal` on purpose: this layout changes the GROUPING, not what a row shows, so it
  // stays readable next to the other four rather than being a second axis of density.
  byPerson: { ...spec('byPerson', 'normal', true, true, false), groupByPerson: true },
};

/** True when `id` is a layout this surface actually offers. */
export function isLayoutValidFor(surface: LayoutSurface, id: string | undefined): id is LayoutId {
  if (!id) return false;
  return (SURFACE_LAYOUTS[surface] as readonly string[]).includes(id);
}

/**
 * The effective layout id for a surface.
 *
 * Per-surface override first, then the global detail level, then `FALLBACK_LAYOUT`. Every
 * step is validated, so a stale id left in the settings JSON by an older build (or a
 * hand-edited backup) degrades to a sane layout instead of rendering nothing.
 */
export function resolveLayout(
  surface: LayoutSurface,
  cardLayouts: Record<string, string> | undefined,
  globalDetail: string | undefined
): LayoutId {
  const override = cardLayouts?.[surface];
  if (isLayoutValidFor(surface, override)) return override;
  if (isLayoutValidFor(surface, globalDetail)) return globalDetail;
  return FALLBACK_LAYOUT;
}

/** The resolved spec for a surface — what callers actually render from. */
export function resolveLayoutSpec(
  surface: LayoutSurface,
  cardLayouts: Record<string, string> | undefined,
  globalDetail: string | undefined
): LayoutSpec {
  return LAYOUT_SPECS[resolveLayout(surface, cardLayouts, globalDetail)];
}

/**
 * Set (or clear) a surface's override, returned as a new object for `settings.update`.
 * Passing `null` removes the override so the surface follows the global default again —
 * that's the "Use my normal layout" reset in the picker.
 */
export function withSurfaceLayout(
  cardLayouts: Record<string, string> | undefined,
  surface: LayoutSurface,
  id: LayoutId | null
): Record<string, string> {
  const next = { ...(cardLayouts ?? {}) };
  if (id === null) delete next[surface];
  else next[surface] = id;
  return next;
}

/**
 * Drop unknown surfaces and invalid ids. Applied when reading the column so one bad entry
 * (older build, edited backup, AI-generated import) can't wedge the picker.
 */
export function sanitizeCardLayouts(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in SURFACE_LAYOUTS)) continue;
    if (typeof value !== 'string') continue;
    if (!isLayoutValidFor(key as LayoutSurface, value)) continue;
    out[key] = value;
  }
  return out;
}

/** Normalize the global default; anything unrecognised becomes `FALLBACK_LAYOUT`. */
export function sanitizeDetailLevel(raw: unknown): DetailLevel {
  return typeof raw === 'string' && (DETAIL_LEVELS as readonly string[]).includes(raw)
    ? (raw as DetailLevel)
    : FALLBACK_LAYOUT;
}
