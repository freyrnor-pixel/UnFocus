/**
 * SwatchPicker.tsx — bare circular swatch picker (colour theme + bubble material).
 *
 * Renders a wrapping row of circular swatches with a label underneath; the
 * active swatch gets a coloured ring, a slight scale-up, and a heavier shadow.
 * The swatch's own visual content (a tinted icon, a gradient, a material
 * preview, etc.) is supplied by the caller via `renderSwatch` — this component
 * only owns the shared layout/active-state chrome so the colour-theme picker
 * (onboarding step 5 + settings) and the bubble-material picker (settings)
 * look identical.
 *
 * Connections:
 *   Imports → lib/useAppTheme, constants/theme
 *   Used by → app/settings.tsx (colour-theme + bubble-material pickers);
 *             app/onboarding/step5.tsx (not ported yet)
 *   Data    → none (controlled component; value/onChange only)
 *
 * Edit notes:
 *   - Keep this dumb/generic — anything theme- or material-specific belongs in
 *     the caller's renderSwatch, not here.
 */
import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type SwatchItem = {
  key: string;
  label: string;
};

type Props = {
  items: SwatchItem[];
  value: string;
  onChange: (key: string) => void;
  renderSwatch: (key: string, active: boolean) => React.ReactNode;
  size?: number;
};

export default function SwatchPicker({ items, value, onChange, renderSwatch, size = 54 }: Props) {
  const theme = useAppTheme();

  return (
    <View style={styles.row}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={styles.item}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
          >
            <View
              style={[
                styles.ringWrap,
                {
                  width: size + 8,
                  height: size + 8,
                  borderColor: active ? theme.accent : theme.border,
                  borderWidth: active ? 3 : 2,
                },
                active ? { ...Shadow.cardHeavy, transform: [{ scale: 1.07 }] } : Shadow.card,
              ]}
            >
              <View style={[styles.swatch, { width: size, height: size }]}>
                {renderSwatch(item.key, active)}
              </View>
            </View>
            <Text
              style={[
                styles.label,
                { color: active ? theme.accent : theme.textMuted },
                active && styles.labelActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  item: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ringWrap: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
  labelActive: {
    fontFamily: Fonts.bold,
  },
});
