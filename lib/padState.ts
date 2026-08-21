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
 *   Imports → constants/theme (PAD_PREVIEW_ROWS, PAD_SPARE_LINES)
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
 *   - **This axis is no longer about open vs closed** (2026-08-21). It briefly rested at
 *     'closed' with an exception list, mirroring lib/collapsedCards.ts; that was the second of
 *     the two mechanisms owning one question, and the one that had to go. `'closed'` is deleted
 *     from `PadState`, the exception list with it, and every card's fold — pad cards included —
 *     is lib/collapsedCards.ts over lib/cardRegistry.ts's declarations.
 */
import { PAD_PREVIEW_ROWS, PAD_SPARE_LINES } from '@/constants/theme';
import type { LayoutSurface } from '@/lib/cardLayout';

/**
 * How many of a pad card's rows are drawn. **Two values as of 2026-08-21 — `'closed'` is gone.**
 *
 * It used to be three, and the third one was a second fold: a "closed" pad card drew its header,
 * its empty first rule, its Suggestions block and its composer — about 400px — while a card one
 * tab over that called itself closed was 70px of bare header. Two mechanisms owned open/closed
 * with two storage columns and two different answers to what the word means, which is the
 * *"not all cards can be collapsed"* half of the report.
 *
 * Open/closed is `lib/collapsedCards.ts` for every card in the app now, pad cards included. This
 * axis keeps only the question it is uniquely good at: HOW MANY rows, with a footer chevron that
 * can say *"3 more"* — a count a header chevron has nowhere to put. The two can never both be
 * showing, because closed is a bare header.
 */
export type PadState = 'preview' | 'open';

export const PAD_STATES: readonly PadState[] = ['preview', 'open'] as const;

/** Surfaces that can carry their own state — the same set that can carry a layout. */
export type PadSurface = LayoutSurface;

/**
 * What a surface is drawn at when nothing has been chosen for it.
 *
 * 'preview' for everything, and there is no exception list any more: the exceptions existed to
 * say which pad cards rested OPEN, and that question moved to lib/cardRegistry.ts's `openAtRest`
 * along with every other card's. 'preview' rather than 'open' is the same call the pad cards
 * have always made — the point of a sized card is that its resting size is a glance.
 */
export function defaultPadState(_surface: PadSurface): PadState {
  return 'preview';
}

/**
 * The next size up, wrapping back to preview from open. One chevron, two stops — it was three
 * until 'closed' left this axis.
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
  if (state === 'open') return [...rows];
  return rows.slice(0, PAD_PREVIEW_ROWS);
}

/** How many rows a state is holding back — the count on the footer chevron. */
export function padHiddenCount(total: number, state: PadState): number {
  if (state === 'open') return 0;
  return Math.max(0, total - PAD_PREVIEW_ROWS);
}

/**
 * Blank ruled lines to draw after the last row.
 *
 * Both remaining states get them. The one state that did not was 'closed', which no longer
 * exists here — a card with nothing to show draws no body at all now.
 */
export function padSpareLines(_state: PadState): number {
  return PAD_SPARE_LINES;
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
