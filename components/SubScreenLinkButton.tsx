/**
 * SubScreenLinkButton.tsx — the app's ONE "this takes you somewhere else" control: a row of
 * icon + label + chevron, and a card that groups several of them.
 *
 * For screens that reach a related screen without giving it a permanent Home card or in-place
 * tab (Goals, Earlier days). Mirrors app/(tabs)/shopping.tsx's inline Food/Catalogue link row
 * (UX audit F1, 2026-07-23) — that pattern predates this component and stays as-is there,
 * because two short side-by-side tiles are a different shape from a full-width row.
 *
 * **Two exports, one row (2026-08-08 spacing/structure pass).** Before this, the same "go to
 * Goals" destination was drawn two entirely different ways: a full-width bordered card with a
 * gradient badge and no chevron on To-do, and a bare icon + label + chevron row inside the
 * Habits card. The card version was the worse of the two — nothing on it said it navigated,
 * and stacked under a real content section it read as one more section of the screen. Both
 * screens now draw the same `SubScreenLinkRow`; To-do wraps its two in one `SubScreenLinkCard`
 * so they read as a single "elsewhere" group rather than two more floating sections.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, lib/useAppTheme,
 *             lib/screenColor, lib/haptics
 *   Used by → app/(tabs)/plans.tsx (SubScreenLinkCard — Goals + Earlier days),
 *             app/(tabs)/habits.tsx (SubScreenLinkRow — Goals, inside the Habits card)
 *   Data    → none (presentational; `onPress` is the caller's — a router.push elsewhere, or
 *             opening a popup for the Habits/Plans Goals link)
 *
 * Edit notes:
 *   - **The icon is a bare glyph in the screen's hue, not a CardAccentBadge.** The gradient
 *     badge was dropped in the 2026-08-08 pass for two reasons: on To-do both links are
 *     `domain="task"`, so the badge drew the identical plate twice and carried no
 *     information; and a filled 24px plate is card-weight chrome, which is exactly what made
 *     the Habits version look like "yet another card" when it was tried there. `domain` is
 *     gone from the API with it — the glyph is now the caller's own `icon`.
 *   - **`SubScreenLinkCard` draws ONE Surface, `SubScreenLinkRow` draws none.** A row mounted
 *     inside a caller's own card (Habits) must not bring a border with it, or it reads as a
 *     card inside a card. If you need a standalone single link, use the card with one entry.
 *   - No vertical margin on the card — the screen's content container owns the gap between
 *     stacked cards (`SCREEN_GAP`, constants/theme.ts).
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
import { tap } from '@/lib/haptics';

export type SubScreenLink = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * One navigation row — icon + label + chevron, no border or fill of its own. Mount it inside
 * a card the caller already owns (see Habits' Goals row), or let `SubScreenLinkCard` supply one.
 */
export function SubScreenLinkRow({ icon, label, onPress, accessibilityLabel }: SubScreenLink) {
  const theme = useAppTheme();
  const screenHue = useScreenColor() ?? theme.border;

  return (
    <PressableScale
      onPress={() => { tap(); onPress(); }}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons name={icon} size={16} color={screenHue} />
      <Text style={[styles.text, { color: theme.text }]} numberOfLines={1}>{label}</Text>
      {/* The chevron is the whole point: without it a link is indistinguishable from a
          section header, which is what the To-do tab's two links looked like. */}
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </PressableScale>
  );
}

/**
 * A group of navigation rows in one card. Several destinations that all lead off this screen
 * are ONE thing, not N sections — grouping is what says so, which is why this takes an array
 * rather than being mounted once per link.
 */
export default function SubScreenLinkCard({ links }: { links: SubScreenLink[] }) {
  if (links.length === 0) return null;
  return (
    <Surface style={styles.card}>
      {links.map((link) => (
        <SubScreenLinkRow key={link.label} {...link} />
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  // No vertical margin — the screen's content container owns the gap (SCREEN_GAP).
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
  },
  text: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
