/**
 * habitStarters.ts — the four one-tap example habits offered on an empty Habits tab.
 *
 * A brand-new user lands on Habits with nothing to look at, so the empty-state
 * StarterCard offers a handful of deliberately tiny, universal habits they can add
 * with one tap. This file holds only the STRUCTURAL half (glyph + daily goal); the
 * user-facing titles live in `lib/i18n.ts` under `starters.habits.suggestions.<key>`
 * so both languages stay in sync by key rather than by array position.
 *
 * Connections:
 *   Imports → components/HabitIcon (HABIT_ICON_NAMES — the glyphs must be pickable ones)
 *   Used by → app/(tabs)/habits.tsx (empty-state starter chips),
 *             lib/__tests__/habitStarters.test.ts
 *   Data    → none directly; a tap in habits.tsx feeds these into useHabitStore.add
 *
 * Edit notes:
 *   - `icon` MUST be a member of HABIT_ICON_NAMES (components/HabitIcon.tsx) — anything
 *     else is treated as a legacy emoji string and renders as raw text.
 *   - Keys are load-bearing: each one needs a matching title in BOTH the `en` and `no`
 *     `starters.habits.suggestions` objects (`no: typeof en` makes tsc enforce this).
 *   - Deliberately small numbers. These are illustrations of "small things add up",
 *     not a wellness programme — resist growing the list or the goals.
 */
import { HABIT_ICON_NAMES } from '@/components/HabitIcon';

/** Keys of the offered starters — mirrored by `starters.habits.suggestions` in lib/i18n.ts. */
export type HabitStarterKey = 'water' | 'stretch' | 'posture' | 'breakfast';

export type HabitStarter = {
  key: HabitStarterKey;
  /** An Ionicons glyph from HABIT_ICON_NAMES (see Edit notes). */
  icon: (typeof HABIT_ICON_NAMES)[number];
  /** Times per day the habit counts as met — 1 for a simple yes/no habit. */
  dailyGoal: number;
};

export const HABIT_STARTERS: readonly HabitStarter[] = [
  { key: 'water', icon: 'water-outline', dailyGoal: 4 },
  { key: 'stretch', icon: 'fitness-outline', dailyGoal: 1 },
  { key: 'posture', icon: 'body-outline', dailyGoal: 1 },
  { key: 'breakfast', icon: 'nutrition-outline', dailyGoal: 1 },
];
