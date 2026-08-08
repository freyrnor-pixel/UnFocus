/**
 * ColorPickerSheet.tsx — pick a colour from a range, then fine-tune it.
 *
 * The design lab's original colour row was a hex field and a ±8% lighten/darken pair. That
 * answers "a bit darker" and nothing else: there was no way to ask for a different *hue*
 * without already knowing the code you wanted, which is the opposite of a workbench. This is
 * the replacement — a generated grid to get close in one tap, three sliders to land exactly,
 * and the hex field kept for the case where the value is already known.
 *
 * Connections:
 *   Imports → components/{AnimatedBottomSheet,Surface,Slider,PressableScale,FormControls},
 *             constants/theme (hexToHsl/hslToHex + tokens), lib/colorPalette (the range),
 *             lib/designLab (isValidHex/normalizeHex — one definition of a usable colour),
 *             lib/haptics, lib/i18n, lib/useAppTheme
 *   Used by → app/design-lab/tokens.tsx (every colour row opens this),
 *             components/PartControls.tsx (a part's own colour, behind "More…")
 *   Data    → none. Controlled: the caller owns the override and the write.
 *
 * Edit notes:
 *   - **Opening the sheet must not change the colour.** `hexToHsl`/`hslToHex` both round to
 *     whole degrees and percents, so a round trip can move a channel by a point or two
 *     (pinned in lib/__tests__/colorPalette.test.ts). Nothing here writes on mount or on
 *     `visible` — only a swatch tap, a slider drag or a committed hex does. A seed-and-echo
 *     effect would silently rewrite every token the maintainer merely looked at.
 *   - **While the sheet is open, the HSL triple is the source of truth, not the hex.** Derive
 *     H/S/L back out of the hex on every render and dragging hue at zero saturation loses the
 *     hue entirely (a grey has no angle), so the sliders would fight the finger. The triple is
 *     seeded once per opening, and re-seeded only when a swatch or a typed hex replaces it.
 *   - **Swatches carry no `hitSlop`.** They sit edge to edge, and RN resolves overlapping
 *     touch areas to the LAST sibling — slop here would make each swatch swallow its
 *     neighbour's edge, the same bug constants/theme.ts's `RowTrailing` documents. They are
 *     `MIN_TAP_TARGET` tall instead.
 *   - The token name renders RAW, like everywhere else in the lab: it is the word the exported
 *     document uses, and translating it would make the screen and the report disagree.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import Slider from '@/components/Slider';
import PressableScale from '@/components/PressableScale';
import { Input } from '@/components/FormControls';
import {
  FontSize,
  Fonts,
  MIN_TAP_TARGET,
  Radius,
  Spacing,
  contrastOn,
  hexToHsl,
  hslToHex,
} from '@/constants/theme';
import { SWATCH_GRID } from '@/lib/colorPalette';
import { isValidHex, normalizeHex } from '@/lib/designLab';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The palette token being edited. Rendered raw — see the Edit notes. */
  tokenName: string;
  /** The value the app ships with — what "put this one back" returns to. */
  shipped: string;
  /** The value in force right now (the override if there is one, else `shipped`). */
  value: string;
  /** True when an override exists, which is what makes the reset meaningful. */
  overridden: boolean;
  onChange: (hex: string) => void;
  onClear: () => void;
};

export default function ColorPickerSheet({
  visible,
  onClose,
  tokenName,
  shipped,
  value,
  overridden,
  onChange,
  onClear,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const [text, setText] = useState(value);

  // Seed once per opening. Deliberately NOT keyed on `value` — see the Edit notes.
  useEffect(() => {
    if (!visible) return;
    setHsl(hexToHsl(value));
    setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** A slider moved: the triple is authoritative, the hex is derived from it. */
  const setChannel = (channel: 'h' | 's' | 'l', n: number) => {
    const next = { ...hsl, [channel]: n };
    setHsl(next);
    const hex = hslToHex(next.h, next.s, next.l);
    setText(hex);
    onChange(hex);
  };

  /** A swatch or a typed hex replaces the colour outright, so the triple re-seeds from it. */
  const setHex = (hex: string) => {
    const clean = normalizeHex(hex);
    setHsl(hexToHsl(clean));
    setText(clean);
    onChange(clean);
  };

  const channels: { key: 'h' | 's' | 'l'; label: string; max: number }[] = [
    { key: 'h', label: t.designLab.color.hue, max: 360 },
    { key: 's', label: t.designLab.color.saturation, max: 100 },
    { key: 'l', label: t.designLab.color.lightness, max: 100 },
  ];

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface style={styles.sheet}>
        <View style={styles.headerRow}>
          <View style={[styles.preview, { backgroundColor: value, borderColor: theme.border }]}>
            <Text style={[styles.previewText, { color: contrastOn(value) }]} numberOfLines={1}>
              {value}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.token, { color: theme.text }]} numberOfLines={1}>{tokenName}</Text>
            {overridden ? (
              <Text style={[styles.was, { color: theme.textMuted }]} numberOfLines={1}>
                {t.designLab.color.was(shipped)}
              </Text>
            ) : null}
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.color.pick}</Text>
          <View style={styles.grid}>
            {SWATCH_GRID.map((row, rowIndex) => (
              <View key={row.hue ?? `neutral-${rowIndex}`} style={styles.gridRow}>
                {row.shades.map((hex) => {
                  const active = hex === normalizeHex(value);
                  return (
                    <PressableScale
                      key={hex}
                      onPress={() => { selection(); setHex(hex); }}
                      scaleTo={0.92}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={hex}
                      style={[
                        styles.swatch,
                        { backgroundColor: hex, borderColor: active ? theme.text : 'transparent' },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{t.designLab.color.tune}</Text>
          {channels.map((channel) => (
            <View key={channel.key} style={styles.channel}>
              <View style={styles.channelHead}>
                <Text style={[styles.channelLabel, { color: theme.text }]}>{channel.label}</Text>
                <Text style={[styles.channelValue, { color: theme.textMuted }]}>{hsl[channel.key]}</Text>
              </View>
              <Slider
                value={hsl[channel.key]}
                onChange={(n) => setChannel(channel.key, n)}
                min={0}
                max={channel.max}
                step={1}
                color={value}
                accessibilityLabel={channel.label}
              />
            </View>
          ))}

          <Input
            label={t.designLab.color.hex}
            value={text}
            onChangeText={setText}
            onBlur={() => {
              const typed = text.trim();
              if (isValidHex(typed)) setHex(typed);
              // Anything else is a typo. Put back what is actually in force rather than
              // storing junk the sanitizer would drop on the next load anyway.
              else setText(value);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ScrollView>

        <View style={styles.actions}>
          {overridden ? (
            <PressableScale
              onPress={() => { selection(); onClear(); onClose(); }}
              scaleTo={0.95}
              style={[styles.ghostBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.ghostText, { color: theme.textMuted }]}>{t.designLab.color.putBack}</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={onClose}
            scaleTo={0.95}
            style={[styles.doneBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.doneText, { color: theme.accentInk }]}>{t.designLab.color.close}</Text>
          </PressableScale>
        </View>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    // Capped so the grid scrolls inside the sheet rather than pushing the actions off screen.
    maxHeight: '86%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  preview: {
    minWidth: 88,
    paddingHorizontal: Spacing.sm,
    height: MIN_TAP_TARGET,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  // flex + minWidth:0 so a long token name yields instead of shoving the swatch off the card.
  headerText: { flex: 1, minWidth: 0, gap: 1 },
  token: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  was: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  scroll: { flexShrink: 1 },
  scrollBody: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  groupLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
  grid: { gap: Spacing.xs },
  gridRow: { flexDirection: 'row', gap: Spacing.xs },
  // No hitSlop, and full tap-target height: these sit edge to edge. See the Edit notes.
  swatch: { flex: 1, height: MIN_TAP_TARGET, borderRadius: Radius.sm, borderWidth: 2 },
  channel: { gap: 2 },
  channelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelLabel: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  channelValue: { fontSize: FontSize.sm, fontFamily: Fonts.regular },
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
