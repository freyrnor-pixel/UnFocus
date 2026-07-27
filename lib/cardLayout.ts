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
 * Connections:
 *   Imports → (none — deliberately dependency-free so it stays unit-testable and can't
 *             drag notification/DB code into a render path)
 *   Used by → components/ShoppingRow.tsx, components/WeekListCard.tsx, app/(tabs)/shopping.tsx,
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
 */

/** A list-bearing surface that can have its own layout. */
export type LayoutSurface = 'shopping' | 'plans' | 'notes' | 'health';

/** The three levels every surface understands; also the shape of the global default. */
export type DetailLevel = 'basic' | 'normal' | 'everything';

/** Every layout id known to the app. */
export type LayoutId = DetailLevel | 'inStore' | 'nowNext';

export const DETAIL_LEVELS: readonly DetailLevel[] = ['basic', 'normal', 'everything'] as const;

/** The global fallback when nothing else resolves. */
export const FALLBACK_LAYOUT: DetailLevel = 'normal';

/**
 * Which layouts each surface offers, in picker order. Every surface starts with the three
 * detail levels so the global default is always applicable, then adds its own shapes.
 */
export const SURFACE_LAYOUTS: Record<LayoutSurface, readonly LayoutId[]> = {
  shopping: ['basic', 'normal', 'everything', 'inStore'],
  plans: ['basic', 'normal', 'everything', 'nowNext'],
  notes: ['basic', 'normal', 'everything'],
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
  // "In the store" — big rows, name only, no money; read at arm's length in a shop.
  inStore: spec('inStore', 'roomy', false, false, false, false, true),
  // "Now and next" — the current item large, the next one small, the rest behind a count.
  nowNext: spec('nowNext', 'normal', true, false, false, true, false),
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
