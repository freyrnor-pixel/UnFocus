/**
 * HabitLeading.tsx — what goes in a habit row's leading slot: the habit's chosen icon, or
 * the brand leaf when it hasn't got one.
 *
 * The four habit row-render sites (app/(tabs)/habits.tsx's Today/Week/Month lists and
 * components/HomeHabitsCard.tsx) each used to hand-roll `hasChosenHabitIcon(icon) ? <HabitIcon/>
 * : undefined`. That gate exists for a real bug — the neutral default glyph is a hollow circle,
 * and the row rule (2026-07-30) put a hollow *check* on the trailing edge, so rendering the
 * default gave every quick-added habit two identical rings on one line with the leading one
 * inert. See `hasChosenHabitIcon`'s own comment in components/HabitIcon.tsx.
 *
 * A LEAF is not a circle, which is the whole reason it can fill that slot where the ellipse
 * couldn't (design comparison task 04, option (a) — the narrow form; the blanket "a leaf on
 * every row" version was tried and reverted as noise, and is not what this does). Rows whose
 * habit HAS an icon are untouched.
 *
 * Connections:
 *   Imports → components/HabitIcon (the glyph renderer + `hasChosenHabitIcon`), components/Motif
 *             (the tintable `leaf-icon`)
 *   Used by → app/(tabs)/habits.tsx (Today PadRow leading at 22, Week grid label at 16,
 *             Month grid label at 14), components/HomeHabitsCard.tsx (row leading at 16)
 *   Data    → none — pure presentation
 *
 * Edit notes:
 *   - **`leaf-icon`, never `leaf-sprig`.** The sprig is an ILLUSTRATION carrying its own fixed
 *     blue ramp (`pal` in constants/motifs.ts), so components/Motif ignores `color` for it and
 *     it would sit blue on the green Habits surface. `leaf-icon` is single-colour and tintable,
 *     which is why it takes the same `theme.textMuted` the glyph it replaces takes — the mark
 *     agrees with its row instead of announcing itself.
 *   - **It is sized to its call site, not to the design's nominal 18–24px.** A 14px leaf in the
 *     Month grid is smaller than the design specifies, but matching the row's own icon size is
 *     what keeps a column of leading marks aligned; a leaf that outgrew its neighbours would be
 *     the noise this option exists to avoid.
 *   - This adds NO width to any row: every one of the four sites already lays out a leading slot
 *     at this exact size for habits that have an icon. It fills a hole rather than opening one —
 *     which is also why `npm run wraps` is unchanged by it.
 *   - Decorative, so it is never the row's tappable thing: Motif hard-codes `pointerEvents="none"`.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import HabitIcon, { hasChosenHabitIcon } from '@/components/HabitIcon';
import Motif from '@/components/Motif';

type Props = {
  /** The habit's stored `icon` — an Ionicons glyph name, a legacy emoji, or the neutral default. */
  icon: string;
  /** Match the row's other leading marks; the leaf is drawn into a square of this size. */
  size: number;
  /** Ink for both the glyph and the leaf — normally `theme.textMuted`. */
  color: string;
};

export default function HabitLeading({ icon, size, color }: Props) {
  if (hasChosenHabitIcon(icon)) return <HabitIcon icon={icon} size={size} color={color} />;
  return (
    // The Motif needs a sized box: an <Svg> with no explicit width/height collapses to nothing
    // inside a flex row. `fit="meet"` keeps the whole leaf in frame rather than cropping it.
    <View style={[styles.box, { width: size, height: size }]}>
      <Motif id="leaf-icon" color={color} opacity={0.75} fit="meet" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
