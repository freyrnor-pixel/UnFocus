/**
 * HomePreviewEmpty.tsx — shared empty-row filler for Home's preview cards.
 *
 * Renders blank space at the card's collapsed resting height when a preview card's list
 * has zero items — an empty row, not an explanatory message.
 *
 * Connections:
 *   Imports → constants/theme (Spacing)
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - **Removed the empty-state message (2026-07-24, user report)**: after two earlier
 *     reverts (skeleton ghost rows read as a stuck loading state; a message+icon duplicated
 *     the header badge's glyph), the message-only version still repeated what the card's own
 *     header already conveys (title + zero count) — so it's gone too. A card with no rows now
 *     just shows an empty row: blank space at the resting height, nothing else. No autoFocus
 *     lives here — the trailing AddRow only focuses its input when its own "+" bar is tapped.
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
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';

export default function HomePreviewEmpty() {
  return <View style={styles.wrap} />;
}

const styles = StyleSheet.create({
  wrap: { height: Spacing.xl },
});
