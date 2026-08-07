/**
 * PartControls.tsx — everything one part of a card can be, as a plain block of controls.
 *
 * Split out of components/PartEditorSheet.tsx (2026-08-07) when the design lab grew a second
 * place to edit a part: an inline panel directly under the pinned card, so the card stays
 * visible while it is being changed. Two copies of "what it says / colour / size / weight /
 * where it sits" would drift the first time a field was added, so there is one.
 *
 * Connections:
 *   Imports → components/{PressableScale,FormControls,ColorPickerSheet}, constants/theme,
 *             lib/designLab (the part model + SLOTS_FOR_KIND), lib/haptics, lib/i18n,
 *             lib/useAppTheme
 *   Used by → components/PartEditorSheet.tsx (the parts-list route),
 *             app/design-lab.tsx (the inline panel under the card)
 *   Data    → none. Controlled: the caller owns the composition and the write.
 *
 * Edit notes:
 *   - **"Where it sits" offers only the slots this part's KIND allows** (`SLOTS_FOR_KIND`).
 *     Offering the rest and rejecting the choice afterwards would be the same broken control
 *     the lab was built to get away from — a slider in the right-hand string column renders
 *     nothing and then sits in the exported report as an instruction nobody can carry out.
 *   - **An empty label is a real value, not a missing one.** It means "use the sample", which
 *     is what a part shows until the maintainer has words for it. Don't fill it in on open.
 *   - Colour reuses components/ColorPickerSheet.tsx, so a part and a palette token are coloured
 *     by the same control. A part may also carry NO colour — the default, meaning it inherits
 *     from wherever it sits, and the state the picker's "put this one back" returns it to.
 *   - This renders no heading and no actions. Both callers frame it differently (a sheet with
 *     a title and a Done button; a panel with a "what you're editing" line), so framing is
 *     theirs and the fields are this file's.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  part: CardPart;
  onChange: (next: CardPart) => void;
};

export default function PartControls({ part, onChange }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const [picking, setPicking] = useState(false);

  const patch = (next: Partial<CardPart>) => onChange({ ...part, ...next });
  const swatch = part.color
    ? (part.color.startsWith('#') ? part.color : (theme as unknown as Record<string, string>)[part.color])
    : theme.surfaceMuted;

  return (
    <View style={styles.wrap}>
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
    </View>
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
  wrap: { gap: Spacing.xs },
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
});
