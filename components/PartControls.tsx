/**
 * PartControls.tsx — everything one part of a card can be, as a plain block of controls.
 *
 * Split out of the old `PartEditorSheet` when the design lab grew a second place to edit a
 * part, and then outlived it: **that sheet is deleted** (2026-08-07). A sheet covers the card
 * being judged, which is the one thing the playground exists to keep visible, so there is now
 * exactly one editor and it is a panel directly under the card.
 *
 * Connections:
 *   Imports → components/{PressableScale,FormControls,ColorPickerSheet}, constants/theme,
 *             lib/designLab (the part model, SLOTS_FOR_KIND, the body grid), lib/haptics,
 *             lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → app/design-lab/index.tsx (the panel under the selected card)
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
 *   - This renders no heading and no actions. The caller frames it (a panel with a "what you're
 *     editing" line and a Take-it-out button), so framing is theirs and the fields are this
 *     file's.
 *   - **Colour is a strip of real swatches, not just a door to the picker** (2026-08-07). The
 *     row used to be a single swatch that opened a sheet, which made recolouring a part a
 *     three-tap errand and made it look like an advanced setting rather than the thing the
 *     maintainer says they want to do most. The strip is the common answers inline; the
 *     picker is still there behind "…" for a colour that is not one of them. `''` is a real
 *     value in that strip and comes FIRST — it means "inherit from wherever it sits", which is
 *     what most parts should be.
 *   - **"Where it sits" is two different questions depending on the part.** In the row's
 *     anatomy it is a slot; in the card's own space it is a grid cell, and the row/column/width
 *     pills are the TAP equivalent of dragging it there. That equivalence is not a nicety —
 *     the drag cannot be driven by any automated check this repo has (see lib/designLabPlace.ts),
 *     so a placement with no tap route is a placement with no coverage.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import ColorPickerSheet from '@/components/ColorPickerSheet';
import { Input } from '@/components/FormControls';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  BODY_COLS,
  PART_SIZES,
  PART_WEIGHTS,
  SLOTS_FOR_KIND,
  clampPlace,
  isPlaceableSlot,
  type CardPart,
  type PartSize,
  type PartSlot,
  type PartWeight,
} from '@/lib/designLab';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * The colours offered inline, `''` (inherit) first.
 *
 * Palette token ids rather than hexes, so the strip stays right in both modes and so what the
 * exported document names is what was tapped. Anything else goes through the picker.
 */
const QUICK_COLORS = ['', 'accent', 'good', 'warn', 'bad', 'text', 'textMuted'] as const;

type Props = {
  part: CardPart;
  onChange: (next: CardPart) => void;
  /** How many body rows the card has, so "which row" can offer a real range. */
  bodyRows?: number;
};

export default function PartControls({ part, onChange, bodyRows = 1 }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const [picking, setPicking] = useState(false);

  const patch = (next: Partial<CardPart>) => onChange({ ...part, ...next });
  const tokenColor = (id: string) =>
    (id.startsWith('#') ? id : (theme as unknown as Record<string, string>)[id]) ?? theme.surfaceMuted;
  const swatch = part.color ? tokenColor(part.color) : theme.surfaceMuted;
  const place = part.place ? clampPlace(part.place) : null;

  return (
    <View style={styles.wrap}>
      <Input
        label={t.designLab.partEditor.whatItSays}
        placeholder={t.designLab.partEditor.whatItSaysPlaceholder}
        value={part.label}
        onChangeText={(label) => patch({ label })}
      />

      <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.colour}</Text>
      <View style={styles.cloud}>
        {QUICK_COLORS.map((id) => (
          <PressableScale
            key={id || 'inherit'}
            onPress={() => { selection(); patch({ color: id }); }}
            scaleTo={0.9}
            accessibilityRole="radio"
            accessibilityState={{ selected: part.color === id }}
            accessibilityLabel={id || t.designLab.partEditor.inherited}
            style={[
              styles.quickSwatch,
              {
                backgroundColor: id ? tokenColor(id) : 'transparent',
                borderColor: part.color === id ? theme.accent : theme.border,
                borderWidth: part.color === id ? 2 : 1,
              },
            ]}
          >
            {/* "Inherited" has no colour to show, so it says so with a mark rather than
                pretending to be a shade of the background. */}
            {id ? null : <Ionicons name="remove-outline" size={16} color={theme.textMuted} />}
          </PressableScale>
        ))}
        <PressableScale
          onPress={() => { selection(); setPicking(true); }}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={t.designLab.partEditor.moreColours}
          style={[styles.pill, { borderColor: theme.border }]}
        >
          <Text style={[styles.pillText, { color: theme.textMuted }]}>
            {t.designLab.partEditor.moreColours}
          </Text>
        </PressableScale>
      </View>

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
            onPress={() => {
              selection();
              // Leaving the card's own space takes the grid cell with it — a stale one would
              // be a second, disagreeing answer about where the part sits.
              patch(isPlaceableSlot(slot as PartSlot)
                ? { slot: slot as PartSlot }
                : { slot: slot as PartSlot, place: undefined });
            }}
          />
        ))}
      </View>

      {/* The tap route to a grid cell. Dragging is the fast way; this is the one that works
          without a finger, and the only one any automated check can reach. */}
      {isPlaceableSlot(part.slot) ? (
        <>
          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.row}</Text>
          <View style={styles.cloud}>
            {Array.from({ length: Math.max(bodyRows, (place?.row ?? 0) + 1) + 1 }, (_, i) => i).map((row) => (
              <Pill
                key={row}
                label={String(row + 1)}
                active={place?.row === row}
                onPress={() => {
                  selection();
                  patch({ place: clampPlace({ row, col: place?.col ?? 0, span: place?.span ?? BODY_COLS }) });
                }}
              />
            ))}
          </View>

          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.partEditor.width}</Text>
          <View style={styles.cloud}>
            {Array.from({ length: BODY_COLS }, (_, i) => i + 1).map((span) => (
              <Pill
                key={span}
                label={t.designLab.partEditor.spans[span - 1]}
                active={(place?.span ?? BODY_COLS) === span}
                onPress={() => {
                  selection();
                  patch({ place: clampPlace({ row: place?.row ?? 0, col: place?.col ?? 0, span }) });
                }}
              />
            ))}
          </View>
        </>
      ) : null}

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
  // 36 rather than MIN_TAP_TARGET so seven swatches plus a "…" chip fit one line at 327px;
  // the row is a flexWrap cloud, so it wraps rather than clipping when they don't.
  quickSwatch: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
