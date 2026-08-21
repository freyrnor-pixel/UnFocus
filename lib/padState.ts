/**
 * padState.ts — the three sizes a pad card can be drawn at, and the pure maths for each.
 *
 * A list-bearing surface has three resting sizes rather than the old two (2026-07-30, user
 * report: "there should be two expandable states, so user does not see everything at once —
 * if totally un-expanded they only see header and for example the remaining 8/10 things
 * remain"). Before this a card jumped straight from a 5-row preview to the entire list, and
 * a genuinely-closed state didn't exist, so four Home cards could never all fit on screen.
 *
 *   closed  → header + the "8/10 left" summary + the type-here line. No rows.
 *   preview → the above + the first PAD_PREVIEW_ROWS rows + the spare rules.
 *   open    → everything, including the done/checked zone.
 *
 * The type-here line shows in ALL THREE (maintainer's call): capturing a thought stays one
 * tap from anywhere on Home, which is most of why the card is there at all.
 *
 * Connections:
 *   Imports → constants/theme (PAD_PREVIEW_ROWS, PAD_SPARE_LINES), lib/cardDefaults
 *             (PAD_SURFACES_OPEN_AT_REST), lib/cardLayout (LayoutSurface — type-only, so no
 *             runtime dependency)
 *   Used by → components/PadSheet.tsx, components/PadFooterToggle.tsx,
 *             components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/plans.tsx, store/useSettingsStore.ts (sanitize on read),
 *             lib/__tests__/padRows.test.ts
 *   Data    → none — pure functions over values the caller already has. Reads no store,
 *             writes nothing. Persistence is settings.cardStates, owned by the store.
 *
 * Edit notes:
 *   - **Keep this side-effect free**, for the same reason lib/cardLayout.ts is: a card's
 *     SIZE must never be able to create, cancel or reschedule anything. A row the current
 *     state doesn't draw is still a live row — it keeps its reminders and still counts in
 *     the summary. If you need store state here, pass it in.
 *   - `resolveCardState` falls back rather than throwing, so one bad row in the settings
 *     JSON (older build, hand-edited backup, AI-generated import) degrades to that surface's
 *     resting state instead of blanking a card.
 *   - **A surface rests at 'closed' as of 2026-08-21**, except the ones lib/cardDefaults.ts
 *     names, which rest at 'preview' (maintainer: *"All card start in closed state, except
 *     'Today' 'Notes' and 'Shopping' in middle screen"*). It read 'preview' for everything
 *     until then, on the reasoning that an upgrading user should open the app to roughly the
 *     card they already know — which was right while the app had users on the old default and
 *     is not what was asked for now. The excepted surfaces rest at 'preview' rather than
 *     'open' deliberately: the point of a three-state card is that its resting size is a
 *     glance, not the whole list.
 */
import { PAD_PREVIEW_ROWS, PAD_SPARE_LINES } from '@/constants/theme';
import { PAD_SURFACES_OPEN_AT_REST } from '@/lib/cardDefaults';
import type { LayoutSurface } from '@/lib/cardLayout';

/** A pad card's three resting sizes, smallest first. */
export type PadState = 'closed' | 'preview' | 'open';

export const PAD_STATES: readonly PadState[] = ['closed', 'preview', 'open'] as const;

/** Surfaces that can carry their own state — the same set that can carry a layout. */
export type PadSurface = LayoutSurface;

/**
 * What a surface is drawn at when nothing has been chosen for it. Closed for everything except
 * the cards lib/cardDefaults.ts excepts — see this file's edit notes.
 */
export function defaultPadState(surface: PadSurface): PadState {
  return PAD_SURFACES_OPEN_AT_REST.includes(surface) ? 'preview' : 'closed';
}

/**
 * The next size up, wrapping back to closed from open. One chevron cycles all three, so
 * there is a single expandability affordance per card instead of the old per-card text link.
 */
export function nextPadState(state: PadState): PadState {
  const i = PAD_STATES.indexOf(state);
  return PAD_STATES[(i + 1) % PAD_STATES.length];
}

/** The effective state for a surface; anything unrecognised becomes that surface's default. */
export function resolveCardState(
  cardStates: Record<string, string> | undefined,
  surface: PadSurface
): PadState {
  const raw = cardStates?.[surface];
  return isPadState(raw) ? raw : defaultPadState(surface);
}

export function isPadState(raw: string | undefined): raw is PadState {
  return !!raw && (PAD_STATES as readonly string[]).includes(raw);
}

/**
 * Set a surface's state, returned as a new object for `settings.update`. Same storage
 * shape as home_card_order / card_layouts.
 *
 * Choosing a surface's RESTING state deletes the key rather than storing it, which is what
 * `lib/collapsedCards.ts`'s `withCollapsed` does for the other mechanism and for the same
 * reason: `{}` keeps meaning "the app as designed", and a surface whose default later moves
 * follows it for everyone who never had an opinion about that card.
 */
export function withCardState(
  cardStates: Record<string, string> | undefined,
  surface: PadSurface,
  state: PadState
): Record<string, string> {
  const out = { ...(cardStates ?? {}) };
  if (state === defaultPadState(surface)) delete out[surface];
  else out[surface] = state;
  return out;
}

/** Drop unknown values. Applied when reading the column so a bad entry can't wedge a card. */
export function sanitizeCardStates(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string' || !isPadState(value)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * The rows this state actually draws. Closed draws none; preview draws the first
 * PAD_PREVIEW_ROWS; open draws all of them.
 *
 * Pass this result — the rows the pad genuinely renders — anywhere that needs "what is
 * visible" (e.g. lib/viewSnapshot's glow ids), never the full list.
 */
export function padVisibleRows<T>(rows: readonly T[], state: PadState): T[] {
  if (state === 'closed') return [];
  if (state === 'open') return [...rows];
  return rows.slice(0, PAD_PREVIEW_ROWS);
}

/** How many rows a state is holding back — the count on the footer chevron. */
export function padHiddenCount(total: number, state: PadState): number {
  if (state === 'closed') return total;
  if (state === 'open') return 0;
  return Math.max(0, total - PAD_PREVIEW_ROWS);
}

/**
 * Blank ruled lines to draw after the last row. A closed card gets none — it is header +
 * summary + type line, and spare rules there would undo the point of closing it.
 */
export function padSpareLines(state: PadState): number {
  return state === 'closed' ? 0 : PAD_SPARE_LINES;
}

/**
 * Whether a row finished on `doneOn` should still be drawn among the live rows.
 *
 * Ticking something should not make it disappear from under your finger — you need to see
 * that the tap landed, and to be able to untick a mis-tap. So a row finished TODAY stays
 * where it is (struck through and faded, via DONE_ROW_OPACITY), and only sinks into the
 * card's "Checked off" zone from the next day onwards.
 *
 * `doneOn` is a 'YYYY-MM-DD' stamp, or '' for a row that isn't finished. An empty stamp on a
 * row that IS marked done means it was ticked by a build older than the stamp column — which
 * correctly reads as "finished a while ago", so it sinks.
 */
export function isDoneRowStillInPlace(doneOn: string, today: string): boolean {
  return doneOn !== '' && doneOn === today;
}
