/**
 * PartPalette.tsx — the things you can put on a card, as a row you tap or drag from.
 *
 * The design lab's card editor had one way to add a part: a button that opened a list of
 * twenty-one kinds, which added it to whichever position that kind defaults to. That answers
 * "give me a slider" and not "put a slider *there*". This is the other half — the kinds sit
 * visible under the card, a tap adds one (and selects it, so it can be placed from the panel),
 * and a hold-and-drag carries one onto the card so it lands where the finger let go.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme, lib/designLab (PART_KINDS),
 *             lib/haptics, lib/i18n, lib/useAppTheme, react-native-gesture-handler
 *   Used by → app/design-lab.tsx (under the pinned card, in edit mode)
 *   Data    → none. The screen owns the drag and the write.
 *
 * Edit notes:
 *   - **Hold to drag, the same 400ms as everywhere else** (lib/useDragReorder.ts,
 *     components/DraggableTaskRow.tsx). This row scrolls horizontally, so a pan that activated
 *     instantly would fight the scroll; the hold is what tells the two apart, and it is the
 *     gesture the maintainer already knows from the parts list.
 *   - A tap is not a lesser drag — it is the fast path, and the one that works when the card
 *     is scrolled somewhere the finger can't reach. Keep both.
 *   - Chips are labelled with the localized kind name, not the raw id. This is the one place
 *     in the lab where that is right: it is a thing you are choosing, not a word the exported
 *     document uses.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { PART_KINDS, type PartKind } from '@/lib/designLab';
import { selection, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Tap: add this kind at its default position and select it. */
  onAdd: (kind: PartKind) => void;
  /** Hold-drag: the screen tracks the finger and drops onto whichever slot it is over. */
  onDragStart: (kind: PartKind) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  /** The kind currently being dragged, so its chip can show it has left the row. */
  draggingKind?: PartKind | null;
};

export default function PartPalette({ onAdd, onDragStart, onDragMove, onDragEnd, draggingKind }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // A drag starting on a chip must not also scroll the row out from under it.
      scrollEnabled={!draggingKind}
    >
      {PART_KINDS.map((kind) => (
        <Chip
          key={kind}
          kind={kind}
          active={draggingKind === kind}
          onAdd={onAdd}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  kind,
  active,
  onAdd,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  kind: PartKind;
  active: boolean;
  onAdd: (kind: PartKind) => void;
  onDragStart: (kind: PartKind) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
}) {
  const theme = useAppTheme();
  const t = useT();

  const pan = Gesture.Pan()
    .activateAfterLongPress(400)
    .onStart(() => { tap(); onDragStart(kind); })
    .onUpdate((e) => onDragMove(e.absoluteX, e.absoluteY))
    .onFinalize(() => onDragEnd());

  return (
    <GestureDetector gesture={pan}>
      <PressableScale
        onPress={() => { selection(); onAdd(kind); }}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel={t.designLab.addNamed(t.designLab.parts[kind])}
        style={[
          styles.chip,
          { borderColor: active ? theme.accent : theme.border, backgroundColor: theme.surface },
          active && { opacity: 0.4 },
        ]}
      >
        <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
          {t.designLab.parts[kind]}
        </Text>
      </PressableScale>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs, paddingVertical: 2, alignItems: 'center' },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
