/**
 * PartEditorSheet.tsx — a card part's settings, in a sheet.
 *
 * The route in from the Card tab's parts LIST, which stays the exhaustive way to reach any
 * part (a position holding three things can only be tapped into once on the card itself). The
 * card's own tap-to-select uses the inline panel in app/design-lab.tsx instead — same controls
 * (`components/PartControls.tsx`), different framing — because a sheet would cover the very
 * card the maintainer is judging.
 *
 * Connections:
 *   Imports → components/{AnimatedBottomSheet,Surface,PressableScale,PartControls},
 *             constants/theme, lib/designLab (CardPart type), lib/haptics, lib/i18n,
 *             lib/useAppTheme
 *   Used by → app/design-lab.tsx (the Card tab's parts list)
 *   Data    → none. Controlled: the caller owns the composition and the write.
 *
 * Edit notes:
 *   - The fields live in components/PartControls.tsx and are shared with the inline panel.
 *     Add a field there, not here — this file is a title, a scroll and two buttons.
 *   - `part` is nullable because the sheet stays mounted through its exit animation; render
 *     nothing rather than a half-empty form.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import PartControls from '@/components/PartControls';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { type CardPart } from '@/lib/designLab';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  /** `null` while the sheet is playing its exit animation — render nothing. */
  part: CardPart | null;
  onClose: () => void;
  onChange: (next: CardPart) => void;
  onRemove: () => void;
};

export default function PartEditorSheet({ visible, part, onClose, onChange, onRemove }: Props) {
  const theme = useAppTheme();
  const t = useT();

  if (!part) return null;

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface style={styles.sheet}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {part.label || t.designLab.parts[part.kind]}
        </Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <PartControls part={part} onChange={onChange} />
        </ScrollView>

        <View style={styles.actions}>
          <PressableScale
            onPress={() => { selection(); onRemove(); }}
            scaleTo={0.95}
            accessibilityRole="button"
            style={[styles.ghostBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.ghostText, { color: theme.bad }]}>{t.designLab.removePart}</Text>
          </PressableScale>
          <PressableScale
            onPress={onClose}
            scaleTo={0.95}
            accessibilityRole="button"
            style={[styles.doneBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.doneText, { color: theme.accentInk }]}>{t.designLab.color.close}</Text>
          </PressableScale>
        </View>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '86%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  scroll: { flexShrink: 1 },
  body: { paddingBottom: Spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  ghostBtn: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  ghostText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  doneBtn: {
    flexGrow: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  doneText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
