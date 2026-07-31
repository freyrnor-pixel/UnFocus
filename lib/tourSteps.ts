/**
 * tourSteps.ts — the guided tour's steps, and the pure logic for where you are in it.
 *
 * The tour replaced an 8-page intro slideshow that described features on cards the user could
 * not touch; when it ended the app was still empty. This runs on the REAL app instead: one
 * step per feature, each pointing at a real card and ending in one real action the user
 * performs themselves. So the tour leaves behind a task, a habit and a shopping list rather
 * than a memory of some screenshots.
 *
 * Two rules the shape of this file exists to enforce:
 *   - **Every step is skippable, individually and as a whole.** There is no required step and
 *     no ordering the user is forced through; `skip` records the step as done and moves on.
 *     A tour you cannot leave is worse than no tour, particularly in an ADHD app.
 *   - **Progress is a SET, not an index.** Steps are recorded by id, so inserting, removing or
 *     reordering a step can't strand someone mid-tour or silently re-show a step they already
 *     did. A stored id that no longer exists is ignored rather than being an error.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like lib/cardLayout.ts and
 *             lib/firstRunOptions.ts — no store, no i18n, no notifications)
 *   Used by → components/TourSpotlight.tsx, components/TourTarget.tsx,
 *             lib/__tests__/tourSteps.test.ts
 *   Data    → none. The progress SET is persisted by store/useSettingsStore.ts
 *             (settings.tourProgress) — this module only parses and formats it.
 *
 * Edit notes:
 *   - Keep this dependency-free. It is imported by every tab screen (via TourTarget), so
 *     pulling a store or lib/notifications in here would put real work on that path.
 *   - `copyKey` indexes `t.tour.steps` in lib/i18n.ts; `targetId` must match the id passed to
 *     the matching <TourTarget> on that screen, or the step has nothing to point at and is
 *     skipped at runtime. lib/__tests__/tourSteps.test.ts checks both ends.
 *   - `route` is the tab's router path, so the tour can navigate itself to the right screen.
 *   - Adding a step means adding the TourTarget on that screen AND the copy in both languages.
 *     The test will fail on either alone.
 */

/** One stop on the tour. */
export type TourStep = {
  /** Stable, language-neutral id. Persisted — never rename one without a migration. */
  id: string;
  /** Router path of the tab this step lives on. */
  route: '/' | '/plans' | '/shopping' | '/habits' | '/health';
  /** Must match a <TourTarget id=…> rendered on that screen. */
  targetId: string;
};

/**
 * The tour, in order. Home first because it is where the flow lands, then the two surfaces a
 * day actually starts from, then the two that need a first entry to be worth anything.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'home', route: '/', targetId: 'tour.home.today' },
  { id: 'plans', route: '/plans', targetId: 'tour.plans.list' },
  { id: 'shopping', route: '/shopping', targetId: 'tour.shopping.list' },
  { id: 'habits', route: '/habits', targetId: 'tour.habits.list' },
  { id: 'health', route: '/health', targetId: 'tour.health.log' },
];

/** Sentinel recorded when the whole tour is dismissed, so it never re-opens by itself. */
export const TOUR_DISMISSED = 'dismissed';

/* ── Progress ─────────────────────────────────────────────────────────────── */

/**
 * Parse the stored progress string into a set of ids.
 *
 * Stored as comma-separated ids, the same shape as `tasks.tag_ids` (see lib/tags.ts) — a set
 * this small does not earn a table. Unknown ids are kept rather than dropped: a build that
 * removed a step shouldn't erase the record that an older build's step was completed, in case
 * it comes back.
 */
export function parseProgress(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Format a set back to the stored string. Sorted, so an unchanged set is byte-identical. */
export function formatProgress(done: Set<string>): string {
  return [...done].sort().join(',');
}

/** Has the user finished or dismissed the whole tour? */
export function isTourComplete(done: Set<string>): boolean {
  if (done.has(TOUR_DISMISSED)) return true;
  return TOUR_STEPS.every((s) => done.has(s.id));
}

/**
 * The next step to show, or null if there is none.
 *
 * Order comes from TOUR_STEPS, not from what the user has done, so a step skipped early and a
 * step never reached behave identically — there is no "you left something unfinished" state
 * to come back to.
 */
export function nextStep(done: Set<string>): TourStep | null {
  if (done.has(TOUR_DISMISSED)) return null;
  return TOUR_STEPS.find((s) => !done.has(s.id)) ?? null;
}

/** Position of a step for the quiet "2 of 5" label. 1-based; 0 if the id is unknown. */
export function stepPosition(id: string): number {
  return TOUR_STEPS.findIndex((s) => s.id === id) + 1;
}
