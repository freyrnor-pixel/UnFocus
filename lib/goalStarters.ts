/**
 * goalStarters.ts — the one-tap example goals offered on an empty Goals screen.
 *
 * Same shape and rationale as lib/habitStarters.ts: this file holds only the STRUCTURAL
 * half (a key and its icon); the user-facing titles live in `lib/i18n.ts` under
 * `starters.goals.suggestions.<key>` so both languages stay in sync by key rather than by
 * array position.
 *
 * **One of these is deliberately a "less of" goal** (`cutBack`). Habits in this app are
 * positive-only — there is no negative-habit kind, no "log a slip", no broken-streak state —
 * so something you want to do LESS of is expressed as a Goal, and the tasks and habits you
 * link to it are the replacement behaviour you're doing instead. Offering one in the
 * starters is how that becomes discoverable without needing its own data model: a
 * cutting-back goal is an ordinary goal whose title says so.
 *
 * Connections:
 *   Imports → @expo/vector-icons (Ionicons glyph-name type only)
 *   Used by → app/goals.tsx (empty-state starter chips), lib/__tests__/goalStarters.test.ts
 *   Data    → none directly; a tap in app/goals.tsx feeds these into useGoalStore.add
 *
 * Edit notes:
 *   - Keys are load-bearing: each one needs a matching title in BOTH the `en` and `no`
 *     `starters.goals.suggestions` objects (`no: typeof en` makes tsc enforce this).
 *   - A Goal is name-only to author (useGoalStore assigns its colour), so a starter is just
 *     a title — the `icon` here is for the chip, and is never stored on the goal.
 *   - Keep the list short and the goals broad. A goal is the thing tasks and habits point
 *     AT; a list of narrow, prescriptive goals would turn it into a wellness programme,
 *     which is the opposite of what this app is for.
 */
import type { Ionicons } from '@expo/vector-icons';

/** Keys of the offered starters — mirrored by `starters.goals.suggestions` in lib/i18n.ts. */
export type GoalStarterKey = 'rested' | 'moving' | 'cutBack' | 'together';

export type GoalStarter = {
  key: GoalStarterKey;
  /** Chip glyph only — goals themselves have no icon field. */
  icon: keyof typeof Ionicons.glyphMap;
};

export const GOAL_STARTERS: readonly GoalStarter[] = [
  { key: 'rested', icon: 'moon-outline' },
  { key: 'moving', icon: 'walk-outline' },
  // The "less of" one — see the header. Its title (i18n) is what carries the direction.
  { key: 'cutBack', icon: 'trending-down-outline' },
  { key: 'together', icon: 'people-outline' },
];
