/**
 * SettingRow.tsx — the two rows a settings card is made of: a switch, and a link.
 *
 * `<ToggleRow>` is name + optional hint + a `FormControls` Switch. `<SettingLinkRow>` is the
 * same left-hand column with an arrow instead, opening another screen. Between them they are
 * the whole vocabulary of app/settings.tsx's cards.
 *
 * Both were written out by hand at every use — seven lines of nested `View`/`Text`/`Switch`
 * per row, twenty-three times in app/settings.tsx alone (about 160 of that file's ~1000 lines),
 * with the row/label/hint style block separately declared in five files. That is the shape of
 * duplication that doesn't announce itself: nothing breaks, but it takes seven lines to add a
 * setting and a whole-file sweep to change what one looks like, and the copies drift in ways
 * no screenshot shows — see the accessibility note below for the one that had.
 *
 * Connections:
 *   Imports → components/FormControls (Switch), components/PressableScale, constants/theme,
 *             lib/useAppTheme (useAppTheme + useScaledStyles)
 *   Used by → app/settings.tsx (every switch and every "go to this screen" row),
 *             components/ListSettingsSheet.tsx, app/design-lab/tokens.tsx
 *   Data    → none — presentational; the caller owns the value and the write
 *
 * Edit notes:
 *   - **The switch always carries the row's name as its accessible name.** A bare `Switch` in
 *     a row announces only its state, so a screen-reader user hears "off" with nothing saying
 *     what is off. Exactly one of the twenty-three hand-written rows had noticed and passed
 *     `accessibilityLabel` — with a comment on it reading "Named, unlike its neighbours". It
 *     is not an option here; `accessibilityLabel` only OVERRIDES the default for a row whose
 *     visible label reads badly aloud.
 *   - **Dividers stay at the call site.** A card decides where its rules go — several of these
 *     rows are conditional, and a row that drew its own divider would leave a hanging line the
 *     moment it unmounted. Same reason `components/PadSheet.tsx` owns its rules rather than
 *     its rows doing.
 *   - **The label yields, the control doesn't.** `flex: 1` + `minWidth: 0` on the text column,
 *     nothing on the switch — the wrap-audit lesson from the task editor (AGENTS.md): a fixed
 *     control has no width to give, so a long Norwegian label has to be the thing that shrinks.
 *   - Geometry is app/settings.tsx's, which is where 23 of the 26 rows were. Two callers had
 *     slightly different type (`FontSize.sm`/`semibold` on the design-lab token screen) and now
 *     read as the app's settings row, which is the point of having one.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Switch } from '@/components/FormControls';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type RowTextProps = {
  label: string;
  /** The line under the name. Omit where the name says everything (a calendar's title). */
  hint?: string;
};

function RowText({ label, hint }: RowTextProps) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    <View style={styles.textCol}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

type ToggleRowProps = RowTextProps & {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Only when the visible label reads badly aloud — it is the switch's name by default. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A named setting with a switch: the row a settings card is mostly made of. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  accessibilityLabel,
  style,
}: ToggleRowProps) {
  const styles = useScaledStyles(baseStyles);
  return (
    <View style={[styles.row, style]}>
      <RowText label={label} hint={hint} />
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  );
}

type SettingLinkRowProps = RowTextProps & {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The same row, but it opens a screen instead of holding a value. */
export function SettingLinkRow({ label, hint, onPress, style }: SettingLinkRowProps) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    <PressableScale
      style={[styles.row, style]}
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <RowText label={label} hint={hint} />
      <Text style={[styles.label, { color: theme.accent }]}>{'→'}</Text>
    </PressableScale>
  );
}

const baseStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textCol: { flex: 1, minWidth: 0, marginRight: Spacing.md },
  label: { fontSize: FontSize.md, fontFamily: Fonts.medium },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.xs },
});
