/**
 * GoalGlowDot.tsx — a small coloured dot whose glow reflects a Goal's live strength.
 *
 * The single visual language for the Goals "living glow": a filled dot in the goal's
 * hue, wrapped in a halo (constants/theme's getGlow) that intensifies with the goal's
 * effective (decayed) strength. Shared by components/GoalPicker.tsx (picker rows +
 * selected chip) and the linked task/habit cards, so momentum reads the same everywhere.
 *
 * Connections:
 *   Imports → constants/theme (getGlow, rgba), lib/goalStrength (decayedStrength)
 *   Used by → components/GoalPicker.tsx, components/TaskCard.tsx, app/(tabs)/habits.tsx (HabitCard)
 *   Data    → none; pure presentational (reads a raw strength + timestamp, decays on render)
 *
 * Edit notes:
 *   - Pass the goal's RAW strength + strengthUpdatedAt; the dot decays them to now itself,
 *     so callers don't each re-implement the maths. A cold goal shows a faint dot, a warm
 *     one glows — never nothing (so a link is always visible), and never a "penalty" state.
 */
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { getGlow, rgba } from '@/constants/theme';
import { decayedStrength } from '@/lib/goalStrength';

type Props = {
  color: string;
  strength: number;
  strengthUpdatedAt: string | null;
  size?: number;
  style?: ViewStyle;
};

export function GoalGlowDot({ color, strength, strengthUpdatedAt, size = 12, style }: Props) {
  const level = decayedStrength(strength, strengthUpdatedAt, Date.now()); // 0..1
  // Always a little visible (0.35 floor) so a linked goal reads even at neutral; fills in
  // toward opaque as it warms. The halo only kicks in once there's real momentum.
  const fillAlpha = 0.35 + level * 0.65;
  const glow = level > 0.05 ? getGlow(color, level >= 0.5 ? 'strong' : 'soft') : null;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: rgba(color, fillAlpha),
          borderWidth: 1,
          borderColor: rgba(color, Math.min(1, fillAlpha + 0.2)),
        },
        glow,
        style,
      ]}
    />
  );
}
