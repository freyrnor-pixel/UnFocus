/**
 * HabitIcon.tsx — renders a habit's `icon` field as a line icon, with legacy emoji fallback.
 *
 * Habits created before this file existed have `icon` stored as a raw emoji string
 * (e.g. '💧'); newly created/edited habits store an Ionicons glyph name (e.g. 'water-outline').
 * This renders whichever the habit has, so old data keeps working with no DB migration.
 *
 * Connections:
 *   Imports → @expo/vector-icons
 *   Used by → app/habit-form.tsx (icon picker), app/(tabs)/habits.tsx + components/
 *             HomeHabitsCard.tsx (empty-state starter chips only — since 2026-08-04 both
 *             screens' ROWS go through components/HabitLeading.tsx instead),
 *             components/HabitLeading.tsx (the row-leading policy: this glyph, or the brand
 *             leaf when `hasChosenHabitIcon` says no icon was chosen),
 *             lib/habitStarters.ts (HABIT_ICON_NAMES, to type the starter glyphs)
 *   Data    → none
 *
 * Edit notes:
 *   - `hasChosenHabitIcon()` is the gate every ROW should ask before drawing a leading mark.
 *     Rendering the neutral default put a second, inert hollow circle next to the row's real
 *     check — see that function's own comment before reintroducing it anywhere. As of
 *     2026-08-04 the four habit rows ask it via components/HabitLeading.tsx, which draws the
 *     brand LEAF in that slot rather than nothing: a leaf isn't a circle, so it can't be
 *     confused with the trailing check the way the neutral ellipse was. That does not soften
 *     this gate — the ellipse still must not be painted.
 *   - **Don't import components/Motif here.** lib/__tests__/habitStarters.test.ts imports this
 *     module in a plain node env for HABIT_ICON_NAMES; pulling react-native-svg into that chain
 *     is why the leaf lives in HabitLeading.tsx rather than as a fallback branch in this file.
 */
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Icon names offered in the habit-form picker — anything else is treated as legacy emoji text. */
export const HABIT_ICON_NAMES = [
  // 'ellipse-outline' is the neutral "to-do" default (2026-07-21) — listed first so it
  // reads as the picker's baseline choice; a star implies reward, against the app's tone.
  'ellipse-outline',
  'water-outline', 'walk-outline', 'book-outline', 'flower-outline', 'nutrition-outline',
  'medical-outline', 'moon-outline', 'barbell-outline', 'brush-outline', 'leaf-outline',
  'cafe-outline', 'phone-portrait-outline', 'ban-outline', 'beer-outline', 'game-controller-outline',
  'star-outline', 'fitness-outline', 'locate-outline', 'sunny-outline', 'medkit-outline',
  'pencil-outline', 'bulb-outline', 'pulse-outline', 'heart-outline', 'flame-outline',
  'musical-notes-outline', 'extension-puzzle-outline', 'bed-outline',
  // Added 2026-07-26 for the empty-state starter habits (lib/habitStarters.ts) — a glyph
  // must be in this list or HabitIcon renders it as raw emoji text.
  'body-outline',
] as const;

const ICON_NAME_SET: Set<string> = new Set(HABIT_ICON_NAMES);

function isHabitIconName(icon: string): boolean {
  return ICON_NAME_SET.has(icon);
}

/**
 * The stored value meaning "no icon was chosen" — the quick-add default, the `habits.icon`
 * column default, and the picker's baseline choice.
 */
export const NEUTRAL_HABIT_ICON = 'ellipse-outline';

/**
 * Whether a habit has an icon worth DRAWING as a row's leading mark.
 *
 * The neutral default is a hollow circle, which was a fine "to-do" baseline when it was
 * picked (2026-07-21) — but the row rule then moved the check to the trailing edge
 * (2026-07-30) and gave every row its own hollow circle there. That left a quick-added
 * habit showing two identical rings on one line, only one of them tappable, with the inert
 * one leading. So a row asks this before drawing a leading mark, and draws none when the
 * answer is no: the title simply starts at the gutter, like a ruled line on a notepad.
 *
 * `ellipse-outline` deliberately stays the stored default — nothing migrates, the picker
 * keeps its neutral first choice, and picking it still means "no mark, thanks". This only
 * governs whether it is PAINTED.
 */
export function hasChosenHabitIcon(icon: string): boolean {
  return !!icon && icon !== NEUTRAL_HABIT_ICON;
}

export default function HabitIcon({
  icon,
  size = 24,
  color = '#000000',
  emojiStyle,
}: {
  icon: string;
  size?: number;
  color?: string;
  emojiStyle?: TextStyle;
}) {
  if (isHabitIconName(icon)) {
    return <Ionicons name={icon as any} size={size} color={color} />;
  }
  return <Text style={[{ fontSize: size }, emojiStyle]}>{icon}</Text>;
}
