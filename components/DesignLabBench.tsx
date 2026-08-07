/**
 * DesignLabBench.tsx — the design lab's control strip: one of each real control, drawn live.
 *
 * The whole value of the lab is that the maintainer judges a change on the actual components
 * rather than on a description of them, so this renders `Button`, `Slider`, `FormControls` and
 * `Stepper` themselves — never a lookalike. If a knob doesn't move something here, that is a
 * true report about the app, not a gap in the mock.
 *
 * **This used to be the whole bench** and carried a list card and three assignable "empty
 * slots" as well. Both are gone as of 2026-08-07: `components/DesignLabCard.tsx` draws the
 * card the maintainer actually picked, and the empty slots were a stand-in for "let me add
 * something" that the card editor now does properly, on a real card rather than in a nameless
 * position. What is left is what the Controls tab is about — the shapes a control can take.
 *
 * Connections:
 *   Imports → components/{Surface,Button,Slider,Stepper,FormControls}, constants/theme,
 *             lib/designLab (LabOverrides type), lib/useDesignLab (DesignLabContext),
 *             lib/i18n, lib/useAppTheme
 *   Used by → app/design-lab.tsx (the Controls tab)
 *   Data    → none. Every value shown is local sample state; nothing here writes to a store.
 *
 * Edit notes:
 *   - Sample state is local `useState` on purpose. A specimen the maintainer can tick, type in
 *     and drag is the point; writing any of it to a store would put fake rows in the app.
 *   - Keep this to ONE of each thing. It is a swatch card, not a screen — a bench that grows a
 *     second list card starts competing with the knobs for the space it shares with them, and
 *     the card it would be competing with is now pinned to the top of the screen anyway.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import Slider from '@/components/Slider';
import Stepper from '@/components/Stepper';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { type LabOverrides } from '@/lib/designLab';
import { DesignLabContext } from '@/lib/useDesignLab';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The DRAFT bag — what the knobs currently say, saved or not. */
  overrides: LabOverrides;
};

export default function DesignLabBench({ overrides }: Props) {
  return (
    <DesignLabContext.Provider value={overrides}>
      <BenchBody />
    </DesignLabContext.Provider>
  );
}

/**
 * Split from the exported component so everything below the provider resolves the DRAFT bag.
 * A hook called in `DesignLabBench` itself would read the ambient (app-wide) value instead,
 * which is the bug that makes a preview silently show the committed state.
 */
function BenchBody() {
  const theme = useAppTheme();
  const t = useT();

  // Sample state — local, never persisted. See the Edit notes.
  const [toggle, setToggle] = useState(true);
  const [choice, setChoice] = useState('b');
  const [count, setCount] = useState(2);
  const [amount, setAmount] = useState(4);
  const [text, setText] = useState('');

  return (
    <View style={styles.wrap}>
      {/* Buttons: the primary/secondary pair a screen actually shows. */}
      <View style={styles.buttonRow}>
        <Button label={t.designLab.sample.primary} onPress={() => {}} variant="primary" />
        <Button label={t.designLab.sample.secondary} onPress={() => {}} variant="ghost" />
      </View>

      {/* Form controls: one of each shape a setting can take. */}
      <Surface style={styles.card}>
        <View style={styles.controlRow}>
          <Text style={[styles.controlLabel, { color: theme.text }]}>{t.designLab.sample.toggleLabel}</Text>
          <Switch checked={toggle} onChange={setToggle} />
        </View>

        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.designLab.sample.choiceLabel}</Text>
        <SegmentedControl
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
          ]}
        />

        <View style={styles.controlRow}>
          <Text style={[styles.controlLabel, { color: theme.text }]}>{t.designLab.sample.numberLabel}</Text>
          <Stepper value={count} onChange={setCount} min={0} max={9} />
        </View>

        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.designLab.parts.slider}</Text>
        <Slider
          value={amount}
          onChange={setAmount}
          min={0}
          max={10}
          step={1}
          accessibilityLabel={t.designLab.parts.slider}
        />

        <Input
          label={t.designLab.sample.fieldLabel}
          placeholder={t.designLab.sample.fieldPlaceholder}
          value={text}
          onChangeText={setText}
        />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  card: { padding: Spacing.md, gap: Spacing.sm },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  // flex + minWidth:0 so the label yields to the control, never the other way round — the
  // control has no width to give (see AGENTS.md's wrap-audit notes).
  controlLabel: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  fieldLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
