/**
 * personColor.ts — the per-person identity colour channel (2026-07-28).
 *
 * Gives every row in the People registry (store/usePeopleStore.ts) a stable, visually
 * distinct hue so "who is this for" is answerable at a glance instead of by reading a
 * name. Modelled on `GOAL_PALETTE` in store/useGoalStore.ts: the colour is auto-assigned
 * at creation from a fixed palette, persisted on the row, and never picked by the user —
 * so two paired phones show the same person in the same colour without negotiating one.
 *
 * **This is a THIRD colour channel and must not be confused with the two that already
 * exist.** lib/domainColor.ts owns card identity (the card's border + header wash) and
 * `getStatusColor` owns done/overdue/soon. A person's colour is therefore only ever drawn
 * as a filled avatar dot / initial chip on a row, or as the `SectionCard` hue when a list
 * is grouped by person — **never as a card border**, which would collide head-on with the
 * domain hue already there.
 *
 * Connections:
 *   Imports → constants/theme (contrastOn, rgba)
 *   Used by → store/usePeopleStore.ts (colour assignment at create + back-fill),
 *             components/PersonChip.tsx, app/settings.tsx (People card swatches),
 *             app/(tabs)/plans.tsx (person filter chips), lib/__tests__/personColor.test.ts
 *   Data    → none (pure functions over values the caller already has)
 *
 * Edit notes:
 *   - **No green, no red, no amber.** Those are reserved for status everywhere in this app
 *     (see components/SharedTasksSection.tsx's header for the same rule stated for section
 *     hues): a green person dot sitting next to a green "done" rail reads as a state, not
 *     an identity. The palette's one big hue gap (16° → 180°) is exactly that reserved arc.
 *   - The palette is a FLAT list with no light/dark variants, unlike the `card*` ramp in
 *     constants/colors.ts. That is deliberate — the hex is persisted on the row and synced,
 *     so both devices must resolve the identical value regardless of who is in dark mode.
 *     Hues are mid-saturation so they stay legible on both surfaces.
 *   - A task row can show a goal glow dot AND a person chip at once, and `GOAL_PALETTE`
 *     overlaps this palette's violet. They stay tellable apart by FORM, not hue — a goal
 *     dot pulses/decays (components/GoalGlowDot.tsx), a person chip is flat and carries an
 *     initial. Keep it that way if you extend either palette.
 *   - `personColor()` takes the stored hex first and only falls back to the palette, so an
 *     older row written before a palette change keeps the colour the user already learned.
 */
import { contrastOn, rgba } from '@/constants/theme';

/**
 * Identity hues, spaced around the wheel with the status arc (green→amber) left empty.
 * Six is a deliberate ceiling: this is a household, and past six the dots stop being
 * tellable apart at chip size anyway — a seventh person simply reuses the first colour.
 */
export const PERSON_PALETTE = [
  '#3B6FE0', // blue         h222
  '#6D4FD0', // violet       h258
  '#A94FC4', // orchid       h288
  '#D4488E', // magenta      h330
  '#E0663F', // burnt orange h16
  '#17A2A2', // teal         h180
] as const;

/** The colour a person created at `index` should be assigned. Wraps past the palette end. */
export function paletteColorAt(index: number): string {
  const i = ((index % PERSON_PALETTE.length) + PERSON_PALETTE.length) % PERSON_PALETTE.length;
  return PERSON_PALETTE[i];
}

/**
 * Resolve a person's display colour: the hex stored on their row when it's a usable value,
 * otherwise their palette slot. Guards against '' (the column default) and against junk
 * left by a hand-edited backup, so a bad row degrades to a sane colour instead of an
 * invalid style value.
 */
export function personColor(storedColor: string | undefined, index = 0): string {
  return isHexColor(storedColor) ? storedColor : paletteColorAt(index);
}

/** True for a `#RGB`/`#RRGGBB` string — the only shapes `constants/theme`'s helpers parse. */
export function isHexColor(value: string | undefined): value is string {
  return !!value && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * The three values a person chip needs: the solid hue, a translucent wash for a soft
 * background, and a legible ink colour to sit on top of the solid fill. Same shape as
 * lib/domainColor.ts's triad so the two read consistently at call sites.
 */
export function personTriad(storedColor: string | undefined, index = 0): {
  accent: string;
  soft: string;
  ink: string;
} {
  const accent = personColor(storedColor, index);
  return { accent, soft: rgba(accent, 0.14), ink: contrastOn(accent) };
}

/**
 * One or two letters for an avatar chip. Uses the first character of each of the first two
 * whitespace-separated words, so "Anne Berit" reads "AB" and "Sam" reads "S". Returns ''
 * for an empty/whitespace name — callers should fall back to an icon rather than drawing
 * an empty circle.
 *
 * Uses spread rather than `charAt` so a name starting with an astral-plane character (an
 * emoji, some scripts) yields the whole character instead of half a surrogate pair.
 */
export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = [...words[0]][0] ?? '';
  if (words.length === 1) return first.toUpperCase();
  const second = [...words[1]][0] ?? '';
  return (first + second).toUpperCase();
}
