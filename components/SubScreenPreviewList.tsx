/**
 * SubScreenPreviewList.tsx — "here's some of what's in there", for a sub-screen drawer.
 *
 * The generic body of a components/CollapsedSection.tsx whose destination is a whole library
 * screen (Shopping's Food and Catalogue). It lists the first few item names and, when there are
 * more, one last row saying so — enough to answer "is what I'm after in there?" without
 * rebuilding the destination screen inside a drawer.
 *
 * Connections:
 *   Imports → components/PadSheet, components/PadRow, constants/theme, lib/i18n,
 *             lib/useAppTheme
 *   Used by → app/(tabs)/shopping.tsx (the Food and Catalogue drawers)
 *   Data    → none — the caller passes already-loaded names. Deliberately: this must not decide
 *             which store a drawer reads, or every new drawer means editing this file.
 *
 * Edit notes:
 *   - **Names only, and no per-row action.** A preview that starts carrying prices, counts or
 *     an add button is a second copy of the destination screen, and two copies of a list drift.
 *     Every row opens the real screen; so does the "and N more" row.
 *   - `PREVIEW_ROWS` is small on purpose — see components/DayPickerSheet.tsx's matching note. A
 *     preview that needs its own scroll is not a preview.
 *   - The empty state is the caller's own string (`emptyText`), drawn as the quiet inset line
 *     the tab screens use for an empty section — same shape as components/GoalsPreviewList.tsx.
 *     Not a StarterCard: teaching copy inside a drawer nobody has opened yet teaches nobody.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

const PREVIEW_ROWS = 5;

type Props = {
  /** The screen's hue, for the rows' accent. */
  accent: string;
  /** Every item's name. This component slices it — the caller shouldn't pre-truncate. */
  names: string[];
  /** Shown instead of the list when there's nothing yet. */
  emptyText: string;
  /** Open the real screen — from any row, and from the "and N more" line. */
  onOpen: () => void;
};

export default function SubScreenPreviewList({ accent, names, emptyText, onOpen }: Props) {
  const theme = useAppTheme();
  const t = useT();

  if (names.length === 0) {
    return (
      <Text
        style={[
          styles.empty,
          { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        {emptyText}
      </Text>
    );
  }

  const shown = names.slice(0, PREVIEW_ROWS);
  const rest = names.length - shown.length;

  return (
    <PadSheet state="open">
      {shown.map((name, i) => (
        <PadRow key={`${name}-${i}`} title={name} accent={accent} onPress={onOpen} />
      ))}
      {rest > 0 && <PadRow key="__more" title={t.andMoreItems(rest)} accent={accent} onPress={onOpen} />}
    </PadSheet>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
