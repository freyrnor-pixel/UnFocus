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
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';

export default function HomePreviewEmpty() {
  return <View style={styles.wrap} />;
}

const styles = StyleSheet.create({
  // flex:1 lets this fill the card's resting-height floor as one blank row.
  wrap: { flex: 1, paddingVertical: Spacing.md },
});
