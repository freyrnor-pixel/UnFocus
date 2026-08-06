/**
 * DesignLabBench.tsx — the design lab's specimen strip: one of each real thing, drawn live.
 *
 * The whole value of the lab is that the maintainer judges a change on the actual components
 * rather than on a description of them, so this renders `Surface`, `PadSheet`, `PadRow`,
 * `Button` and `FormControls` themselves — never a lookalike. If a knob doesn't move something
 * here, that is a true report about the app, not a gap in the mock.
 *
 * It wraps its children in `DesignLabContext` carrying the DRAFT bag, which is what makes the
 * bench a preview: a knob moves these specimens immediately even while "use these everywhere"
 * is off, and the rest of the screen (the knobs themselves) stays in the app's own styling so
 * the controls don't become unreadable while a colour is being dragged through black.
 *
 * Connections:
 *   Imports → components/{Surface,PadSheet,PadRow,Button,FormControls,Stepper,TimeBoxInput},
 *             constants/theme, lib/designLab, lib/useDesignLab (DesignLabContext),
 *             lib/i18n, lib/useAppTheme, lib/domainColor
 *   Used by → app/design-lab.tsx
 *   Data    → none. Every value shown is local sample state; nothing here writes to a store,
 *             and the sample rows are not real tasks.
 *
 * Edit notes:
 *   - **The bench is the ONE place a slot assignment is fully live.** On a real screen
 *     `PadRow` is handed finished nodes and can only hide a position (see its header); here the
 *     bench owns the data, so it can actually put a person chip in the right-hand value. Keep
 *     `SLOT_CONTENT` in step with `ROW_CONTENT`/`BENCH_CONTENT` in lib/designLab.ts — a slot
 *     option with nothing to render is a silently empty position.
 *   - Sample state is local `useState` on purpose. A specimen the maintainer can tick, type in
 *     and drag is the point; writing any of it to a store would put fake rows in the app.
 *   - Keep this to ONE of each thing. It is a swatch card, not a screen — a bench that grows a
 *     second list card starts competing with the knobs for the screen it shares with them.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import Button from '@/components/Button';
import Stepper from '@/components/Stepper';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { resolveSlot, type LabOverrides, type SlotId } from '@/lib/designLab';
import { DesignLabContext } from '@/lib/useDesignLab';
import { getDomainColor } from '@/lib/domainColor';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The DRAFT bag — what the knobs currently say, saved or not. */
  overrides: LabOverrides;
};

export default function DesignLabBench({ overrides }: Props) {
  return (
    <DesignLabContext.Provider value={overrides}>
      <BenchBody overrides={overrides} />
    </DesignLabContext.Provider>
  );
}

/**
 * Split from the exported component so everything below the provider resolves the DRAFT bag.
 * A hook called in `DesignLabBench` itself would read the ambient (app-wide) value instead,
 * which is the bug that makes a preview silently show the committed state.
 */
function BenchBody({ overrides }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const domain = getDomainColor(theme, 'task');

  // Sample state — local, never persisted. See the Edit notes.
  const [ticked, setTicked] = useState<Record<string, boolean>>({ one: false, two: true, three: false });
  const [toggle, setToggle] = useState(true);
  const [choice, setChoice] = useState('b');
  const [count, setCount] = useState(2);
  const [text, setText] = useState('');

  const rows: { id: string; title: string }[] = [
    { id: 'one', title: t.designLab.sample.rowOne },
    { id: 'two', title: t.designLab.sample.rowTwo },
    { id: 'three', title: t.designLab.sample.rowThree },
  ];

  return (
    <View style={styles.wrap}>
      {/* The list card: Surface → PadSheet → PadRow, the exact stack every tab draws through. */}
      <Surface style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{t.designLab.sample.cardTitle}</Text>
        <PadSheet state="open">
          {rows.map((row) => (
            <PadRow
              key={row.id}
              title={row.title}
              accent={domain.accent}
              done={ticked[row.id]}
              leading={slotNode(resolveSlot('row.leading', overrides), theme, domain.accent, t)}
              meta={slotNode(resolveSlot('row.meta', overrides), theme, domain.accent, t)}
              rightValue={slotText(resolveSlot('row.right', overrides), t)}
              onAction={() => {}}
              onToggle={() => setTicked((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
            />
          ))}
        </PadSheet>
      </Surface>

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

        <Input
          label={t.designLab.sample.fieldLabel}
          placeholder={t.designLab.sample.fieldPlaceholder}
          value={text}
          onChangeText={setText}
        />
      </Surface>

      {/* The three empty slots. A slot set to 'none' renders nothing at all, which is the
          honest thing for a position the maintainer has not assigned yet. */}
      <BenchSlots overrides={overrides} />
    </View>
  );
}

/** The three assignable empty slots, each drawing whatever control kind it was given. */
function BenchSlots({ overrides }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const ids: SlotId[] = ['bench.a', 'bench.b', 'bench.c'];
  const filled = ids.filter((id) => resolveSlot(id, overrides) !== 'none');
  if (filled.length === 0) return null;

  return (
    <Surface style={styles.card}>
      {filled.map((id) => (
        <View key={id} style={styles.slotRow}>
          <Text style={[styles.controlLabel, { color: theme.textMuted }]}>{t.designLab.slots[id]}</Text>
          <BenchControl kind={resolveSlot(id, overrides)} />
        </View>
      ))}
    </Surface>
  );
}

/**
 * One control of the requested kind, with throwaway local state.
 *
 * Every branch renders the app's OWN component where one exists — the point is to see the real
 * thing in a new position, not a stand-in. `chips`/`tabs`/`pills` all route through
 * `SegmentedControl`, which is itself reshaped by the lab's `choice` knob, so the two knobs
 * compose the way they would on a real screen.
 */
function BenchControl({ kind }: { kind: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  const [pick, setPick] = useState('a');
  const [n, setN] = useState(1);
  const [txt, setTxt] = useState('');

  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  switch (kind) {
    case 'button':
      return <Button label={t.designLab.sample.primary} onPress={() => {}} size="sm" />;
    case 'toggle':
    case 'checkbox':
      return <Switch checked={on} onChange={setOn} />;
    case 'tabs':
    case 'pills':
    case 'chips':
      return <SegmentedControl value={pick} onChange={setPick} options={options} />;
    case 'stepper':
    case 'slider':
      return <Stepper value={n} onChange={setN} min={0} max={9} />;
    case 'time':
      return <Input value={txt} onChangeText={setTxt} placeholder="08:00" keyboardType="number-pad" />;
    case 'textbox':
      return <Input value={txt} onChangeText={setTxt} placeholder={t.designLab.sample.fieldPlaceholder} />;
    default:
      return null;
  }
}

/**
 * What a row slot draws when it is assigned a NODE-shaped piece of content.
 *
 * Returns `undefined` for 'none' and for the text-shaped options, which go through
 * `slotText` instead — `PadRow`'s `rightValue` takes a string, not a node, so a column of
 * values keeps its tabular alignment.
 */
function slotNode(
  content: string,
  theme: ReturnType<typeof useAppTheme>,
  accent: string,
  t: ReturnType<typeof useT>,
): React.ReactNode {
  switch (content) {
    case 'badge':
      return <Ionicons name="ellipse" size={12} color={accent} />;
    case 'goalDot':
      return <View style={[styles.dot, { backgroundColor: accent }]} />;
    case 'personChip':
      return (
        <View style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.chipText, { color: theme.text }]}>A</Text>
        </View>
      );
    case 'tags':
      return <Text style={[styles.metaText, { color: theme.textMuted }]}>{t.designLab.sample.meta}</Text>;
    case 'repeat':
      return <Ionicons name="repeat" size={13} color={theme.textMuted} />;
    case 'energy':
      return <Ionicons name="flash-outline" size={13} color={theme.textMuted} />;
    default:
      return undefined;
  }
}

/** What a row slot draws when it is assigned a VALUE — the right-hand column's string. */
function slotText(content: string, t: ReturnType<typeof useT>): string | undefined {
  switch (content) {
    case 'time':
      return '09:30';
    case 'count':
      return '3';
    case 'price':
      return '49';
    case 'energy':
      return '+2';
    case 'tags':
      return t.designLab.sample.meta;
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  card: { padding: Spacing.md, gap: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
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
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  metaText: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  chip: { paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: Radius.full },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
