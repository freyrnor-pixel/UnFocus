/**
 * HabitIcon.tsx — renders a habit's `icon` field as a line icon, with legacy emoji fallback.
 *
 * Habits created before this file existed have `icon` stored as a raw emoji string
 * (e.g. '💧'); newly created/edited habits store an Ionicons glyph name (e.g. 'water-outline').
 * This renders whichever the habit has, so old data keeps working with no DB migration.
 *
 * Connections:
 *   Imports → @expo/vector-icons
 *   Used by → app/habit-form.tsx (icon picker), app/(tabs)/habits.tsx (cards/week/month rows
 *             + empty-state starter chips), components/HomeHabitsCard.tsx (row leading),
 *             lib/habitStarters.ts (HABIT_ICON_NAMES, to type the starter glyphs)
 *   Data    → none
 *
 * Edit notes:
 *   - `hasChosenHabitIcon()` is the gate every ROW should ask before drawing a leading mark.
 *     Rendering the neutral default put a second, inert hollow circle next to the row's real
 *     check — see that function's own comment before reintroducing it anywhere.
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
