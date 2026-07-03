/**
 * HabitIcon.tsx — renders a habit's `icon` field as a line icon, with legacy emoji fallback.
 *
 * Habits created before this file existed have `icon` stored as a raw emoji string
 * (e.g. '💧'); newly created/edited habits store an Ionicons glyph name (e.g. 'water-outline').
 * This renders whichever the habit has, so old data keeps working with no DB migration.
 *
 * Connections:
 *   Imports → @expo/vector-icons
 *   Used by → app/habit-form.tsx (icon picker), app/habits.tsx (habit cards/week/month rows), app/health.tsx (inline habits sub-section)
 *   Data    → none
 */
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Icon names offered in the habit-form picker — anything else is treated as legacy emoji text. */
export const HABIT_ICON_NAMES = [
  'water-outline', 'walk-outline', 'book-outline', 'flower-outline', 'nutrition-outline',
  'medical-outline', 'moon-outline', 'barbell-outline', 'brush-outline', 'leaf-outline',
  'cafe-outline', 'phone-portrait-outline', 'ban-outline', 'beer-outline', 'game-controller-outline',
  'star-outline', 'fitness-outline', 'locate-outline', 'sunny-outline', 'medkit-outline',
  'pencil-outline', 'bulb-outline', 'pulse-outline', 'heart-outline', 'flame-outline',
  'musical-notes-outline', 'extension-puzzle-outline', 'bed-outline',
] as const;

const ICON_NAME_SET: Set<string> = new Set(HABIT_ICON_NAMES);

export function isHabitIconName(icon: string): boolean {
  return ICON_NAME_SET.has(icon);
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
