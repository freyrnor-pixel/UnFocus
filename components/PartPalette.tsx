/**
 * PartPalette.tsx — the shelf: the things you can put on a card, grouped so they can be found.
 *
 * The design lab's card editor had one way to add a part: a button that opened a list of
 * twenty-one kinds, which added it to whichever position that kind defaults to. That answered
 * "give me a slider" and not "put a slider *there*". This is the other half — the kinds sit
 * visible under the card, a tap adds one (and selects it, so it can be placed from the panel),
 * and a hold-and-drag carries one onto the card so it lands where the finger let go.
 *
 * **Grouped and wrapped, not one long scroller** (2026-08-07). Twenty-one word-chips in a
 * horizontal scroll is a list you hunt through with your thumb, which is the shape of flow this
 * rebuild exists to remove. `PART_GROUP_OF` files every kind under **Words · Controls · Marks**,
 * a group is at most eight, and eight wrap into two or three lines that are all on screen at
 * once. Nothing is behind a scroll any more.
 *
 * **Each chip carries a glyph, and the glyph is an icon rather than a live miniature.** A real
 * `Slider` or `SegmentedControl` shrunk into a 36px chip is a smear, and a smear is a worse
 * answer than a symbol — a symbol at least admits what it is. The specimen the maintainer
 * judges is the part once it is ON the card, drawn by the app's own component; this is signage
 * for getting it there. That is the one place in the lab where a stand-in is the right call,
 * and it is why `components/DesignLabCard.tsx` still may not have one.
 *
 * Connections:
 *   Imports → components/{PressableScale,FormControls}, constants/theme, lib/designLab
 *             (PART_GROUPS, PART_GROUP_OF, partsInGroup), lib/haptics, lib/i18n,
 *             lib/useAppTheme, react-native-gesture-handler, @expo/vector-icons
 *   Used by → app/design-lab/index.tsx (under the selected card, in Build mode)
 *   Data    → none. The screen owns the drag and the write.
 *
 * Edit notes:
 *   - **Hold to drag, the same 400ms as everywhere else** (lib/useDragReorder.ts,
 *     components/DraggableTaskRow.tsx). It is the gesture the maintainer already knows.
 *   - **A tap is not a lesser drag — it is the fast path**, and the only one any automated
 *     check in this repo can reach (Playwright cannot activate a long-press drag in the web
 *     build at all). Keep both, and keep the tap complete: it adds AND selects, so the panel
 *     under the card takes over without anything having to be hunted for.
 *   - Chips are labelled with the localized kind name, not the raw id. This is the one place in
 *     the lab where that is right: it is a thing you are choosing, not a word the exported
 *     document uses.
 *   - A new kind needs no change here — it arrives already filed by `PART_GROUP_OF` and already
 *     labelled by `t.designLab.parts`. It does need a glyph in `KIND_ICON`, and the exhaustive
 *     `Record` makes that a compile error rather than a blank chip.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { SegmentedControl } from '@/components/FormControls';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { PART_GROUPS, partsInGroup, type PartGroup, type PartKind } from '@/lib/designLab';
import { selection, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

/** Signage, one per kind. Exhaustive on purpose — a new kind should not compile without one. */
const KIND_ICON: Record<PartKind, keyof typeof Ionicons.glyphMap> = {
  text: 'text-outline',
  value: 'reader-outline',
  count: 'calculator-outline',
  price: 'cash-outline',
  time: 'time-outline',
  button: 'square-outline',
  slider: 'options-outline',
  toggle: 'toggle-outline',
  checkbox: 'checkmark-circle-outline',
  stepper: 'add-circle-outline',
  segmented: 'apps-outline',
  chips: 'pricetags-outline',
  field: 'create-outline',
  timeField: 'alarm-outline',
  icon: 'star-outline',
  badge: 'flash-outline',
  chip: 'pricetag-outline',
  personChip: 'person-outline',
  dot: 'ellipse',
  progress: 'stats-chart-outline',
  divider: 'remove-outline',
};

type Props = {
  /** Tap: add this kind to the card's own space and select it. */
  onAdd: (kind: PartKind) => void;
  /** Hold-drag: the screen tracks the finger and drops onto whichever slot it is over. */
  onDragStart: (kind: PartKind) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  /** The kind currently being dragged, so its chip can show it has left the shelf. */
  draggingKind?: PartKind | null;
};

export default function PartPalette({ onAdd, onDragStart, onDragMove, onDragEnd, draggingKind }: Props) {
  const t = useT();
  const [group, setGroup] = useState<PartGroup>('words');

  return (
    <View style={styles.wrap}>
      <SegmentedControl
        value={group}
        onChange={(v) => { selection(); setGroup(v as PartGroup); }}
        options={PART_GROUPS.map((g) => ({ value: g, label: t.designLab.partGroups[g] }))}
      />
      {/* A wrapping cloud, so a whole group is on screen at once. It is a `flexWrap` row of
          the `starterChips` family — the wrap audit reports it and that is correct behaviour,
          not a finding. */}
      <View style={styles.cloud}>
        {partsInGroup(group).map((kind) => (
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
      </View>
    </View>
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
        <Ionicons name={KIND_ICON[kind]} size={14} color={theme.textMuted} />
        <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
          {t.designLab.parts[kind]}
        </Text>
      </PressableScale>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, paddingVertical: 2 },
  cloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
