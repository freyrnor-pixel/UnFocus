/**
 * HomePreviewEmpty.tsx — shared empty-row filler for Home's preview cards.
 *
 * Renders a small centered "Nothing" label at the card's collapsed resting height when a
 * preview card's list has zero items.
 *
 * Connections:
 *   Imports → constants/theme (FontSize, Spacing), lib/useAppTheme, lib/i18n (useT)
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard (each card's empty branch).
 *             components/PlanTaskCard used this too until 2026-07-25, when its empty branch
 *             switched to components/DayHourScale (an hour-of-day ruler) instead — a day-view
 *             reads better as an empty timeline than blank space.
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - **"Nothing" label restored (2026-07-26, user report)**: the message-only version was
 *     removed 2026-07-24 for repeating what the header already conveys — but with no rows and
 *     no message, the card read as broken/too empty. A single short `t.home.previewEmpty`
 *     ("Nothing") word splits the difference: enough to say "this is intentional," not enough
 *     to duplicate the header's own title/count.
 *   - **Fixed height, not flex:1 (2026-07-25, user report)**: this used to be `flex: 1`, which
 *     grew to swallow ALL of the card's remaining resting-height floor — pushing the trailing
 *     AddRow's "+ New …" bar all the way down to the bottom of the card and leaving a big dead
 *     gap directly under the header. Now it's a small fixed gap instead, so the AddRow sits
 *     right under the header with just breathing room, not a void. Any leftover height still
 *     needed to reach `HOME_PREVIEW_CARD_MIN_HEIGHT` collects below the AddRow (cardContent's
 *     own flex:1 with default top-aligned children) — unnoticeable there, unlike between the
 *     header and the add row — so the three preview cards still land on the same resting height.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';

export default function HomePreviewEmpty() {
  const theme = useAppTheme();
  const t = useT();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: theme.textMuted }]}>{t.home.previewEmpty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: FontSize.sm, fontStyle: 'italic' },
});
