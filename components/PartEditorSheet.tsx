/**
 * PartEditorSheet.tsx — everything one part of a card can be.
 *
 * The design lab's card editor lets a part be added, moved and taken away from the list on the
 * Card tab; this is where the part itself is decided — what it says, what colour it is, how
 * big and how heavy, and which position in the card it sits in. It is a sheet rather than an
 * inline expansion because the card being changed is pinned to the top of the screen: the
 * point is to watch the specimen move while turning these, and a sheet leaves it visible.
 *
 * Connections:
 *   Imports → components/{AnimatedBottomSheet,Surface,PressableScale,FormControls,
 *             ColorPickerSheet}, constants/theme, lib/designLab (the part model +
 *             SLOTS_FOR_KIND), lib/haptics, lib/i18n, lib/useAppTheme
 *   Used by → app/design-lab.tsx (the Card tab)
 *   Data    → none. Controlled: the screen owns the composition and the write.
 *
 * Edit notes:
 *   - **"Where it sits" offers only the slots this part's KIND allows** (`SLOTS_FOR_KIND`).
 *     Offering the rest and rejecting the choice afterwards would be the same broken control
 *     the lab was built to get away from — a slider in the right-hand string column renders
 *     nothing and then sits in the exported report as an instruction nobody can carry out.
 *   - **An empty label is a real value, not a missing one.** It means "use the sample", which
 *     is what a part shows until the maintainer has words for it. Don't fill it in on open.
 *   - Colour reuses components/ColorPickerSheet.tsx, so a part and a palette token are
 *     coloured by the same control. A part may also carry NO colour, which is the default and
 *     means it inherits from wherever it sits — that is the state the picker's "put this one
 *     back" returns it to.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import ColorPickerSheet from '@/components/ColorPickerSheet';
import { Input } from '@/components/FormControls';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import {
  PART_SIZES,
  PART_WEIGHTS,
  SLOTS_FOR_KIND,
  type CardPart,
  type PartSize,
  type PartSlot,
  type PartWeight,
} from '@/lib/designLab';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  /** `null` while the sheet is playing its exit animation — render the last part, or nothing. */
  part: CardPart | null;
  onClose: () => void;
  onChange: (next: CardPart) => void;
  onRemove: () => void;
};

export default function PartEditorSheet({ visible, part, onClose, onChange, onRemove }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const [picking, setPicking] = useState(false);

  if (!part) return null;

  const patch = (next: Partial<CardPart>) => onChange({ ...part, ...next });
  const swatch = part.color
    ? (part.color.startsWith('#') ? part.color : (theme as unknown as Record<string, string>)[part.color])
    : theme.surfaceMuted;

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface style={styles.sheet}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {part.label || t.designLab.parts[part.kind]}
        </Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <Input
            label={t.designLab.partEditor.whatItSays}
            placeholder={t.designLab.partEditor.whatItSaysPlaceholder}
            value={part.label}
            onChangeText={(label) => patch({ label })}
          />

          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.colour}</Text>
          <PressableScale
            onPress={() => { selection(); setPicking(true); }}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.designLab.partEditor.colour}
            style={styles.colorRow}
          >
            <View style={[styles.swatch, { backgroundColor: swatch, borderColor: theme.border }]} />
            <Text style={[styles.colorText, { color: theme.text }]} numberOfLines={1}>
              {part.color || t.designLab.partEditor.inherited}
            </Text>
          </PressableScale>

          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.size}</Text>
          <View style={styles.cloud}>
            {PART_SIZES.map((size) => (
              <Pill
                key={size}
                label={t.designLab.partEditor.sizes[size]}
                active={part.size === size}
                onPress={() => { selection(); patch({ size: size as PartSize }); }}
              />
            ))}
          </View>

          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.weight}</Text>
          <View style={styles.cloud}>
            {PART_WEIGHTS.map((weight) => (
              <Pill
                key={weight}
                label={t.designLab.partEditor.weights[weight]}
                active={part.weight === weight}
                onPress={() => { selection(); patch({ weight: weight as PartWeight }); }}
              />
            ))}
          </View>

          {/* Only the positions this kind can actually occupy. See the Edit notes. */}
          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.where}</Text>
          <View style={styles.cloud}>
            {SLOTS_FOR_KIND[part.kind].map((slot) => (
              <Pill
                key={slot}
                label={t.designLab.partSlots[slot]}
                active={part.slot === slot}
                onPress={() => { selection(); patch({ slot: slot as PartSlot }); }}
              />
            ))}
          </View>
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

      <ColorPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        tokenName={part.label || part.kind}
        shipped={theme.text}
        value={swatch}
        overridden={part.color !== ''}
        onChange={(hex) => patch({ color: hex })}
        onClear={() => patch({ color: '' })}
      />
    </AnimatedBottomSheet>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.accent : 'transparent',
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: active ? theme.accentInk : theme.textMuted }]}>{label}</Text>
    </PressableScale>
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
  body: { gap: Spacing.xs, paddingBottom: Spacing.sm },
  groupLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textTransform: 'uppercase', marginTop: Spacing.xs },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: MIN_TAP_TARGET },
  swatch: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1 },
  colorText: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.regular },
  cloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pill: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
  },
  pillText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
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
