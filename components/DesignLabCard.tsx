/**
 * DesignLabCard.tsx — draws one `CardSpec` with the app's own components.
 *
 * The lab's bench used to show a fixed specimen strip and nothing else, so the maintainer
 * could judge a colour or a corner radius but never the thing they were actually asking
 * about, which is a particular card on a particular screen. This renders whichever card was
 * picked, composed of whichever parts they have added, moved or taken away, live under the
 * knobs.
 *
 * **Where the honesty line falls.** `DesignLabBench`'s promise was "the real thing, never a
 * lookalike", and that promise has to be restated rather than quietly dropped: **every PART
 * here is the app's real component — `Surface`, `PadSheet`, `PadRow`, `Button`, `Slider`,
 * `FormControls`, `Stepper`, `ProgressBar` — but the ARRANGEMENT is the lab's.** A composed
 * card is a proposal drawn out of real pieces, not a screenshot of shipped code, and that is
 * exactly why the export exists: the maintainer decides here, an agent wires it up for real
 * there. Do not let this file grow a hand-drawn stand-in for a component the app already has;
 * that is the line worth keeping.
 *
 * Connections:
 *   Imports → components/{Surface,PadSheet,PadRow,Button,Slider,Stepper,ProgressBar,
 *             FormControls}, constants/theme, lib/designLab (the spec + part model),
 *             lib/domainColor, lib/screenColor, lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/DesignLabBench.tsx (which owns the provider), app/design-lab.tsx
 *   Data    → none. Every value is local sample state; nothing here writes to a store, and
 *             the sample rows are not real tasks, habits or medicines.
 *
 * Edit notes:
 *   - **Row slots go through `PadRow`, everything else goes in the card's own space.** The
 *     eight row slots map exactly onto PadRow's props, so a part in one of them is subject to
 *     the real row's real rules — one meta line, one right-hand value, the trailing cluster's
 *     spacing. That constraint is a feature: if a composition doesn't fit the row, that is a
 *     true report about the row, not a gap in the mock.
 *   - **A part's `label` is optional and `''` means "use the sample".** The sample text is
 *     localized and lives in `t.designLab.partSample.*`; the registry stays free of copy so
 *     `lib/designLab.ts` can keep importing nothing but `constants/theme`.
 *   - Sample state is local `useState` per part id, on purpose. A specimen the maintainer can
 *     tick, drag and type into is the point; writing any of it anywhere would put fake rows in
 *     the app.
 *   - `PadRow`'s `rightValue` takes a STRING, not a node — that is what keeps a column of
 *     values in tabular figures. A part in the `right` slot therefore renders as text however
 *     it is styled, which is why `SLOTS_FOR_KIND` only lets text-ish kinds go there.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import Button from '@/components/Button';
import Slider from '@/components/Slider';
import Stepper from '@/components/Stepper';
import ProgressBar from '@/components/ProgressBar';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  orderedParts,
  type CardId,
  type CardPart,
  type CardSpec,
  type PartSize,
  type PartSlot,
  type PartWeight,
} from '@/lib/designLab';
import { cardKnob } from '@/lib/designLab';
import { getDomainColor, type Domain } from '@/lib/domainColor';
import { getScreenColor, type ScreenKey } from '@/lib/screenColor';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  id: CardId;
  spec: CardSpec;
  /** Highlights one part while its editor is open, so the maintainer can see which it is. */
  focusedPartId?: string;
};

const SIZE_TO_FONT: Record<PartSize, number> = {
  xs: FontSize.xs,
  sm: FontSize.sm,
  md: FontSize.md,
  lg: FontSize.lg,
};

const WEIGHT_TO_FONT: Record<PartWeight, string> = {
  regular: Fonts.regular,
  semibold: Fonts.semibold,
  bold: Fonts.bold,
};

export default function DesignLabCard({ id, spec, focusedPartId }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const knob = cardKnob(id);
  const domain = getDomainColor(theme, (knob?.domain ?? 'task') as Domain);
  const edge = getScreenColor(theme, (knob?.screen ?? 'plans') as ScreenKey);

  // Sample state, keyed by part id — local, never persisted. See the Edit notes.
  const [ticked, setTicked] = useState(false);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const read = (part: CardPart, fallback: string | number | boolean) =>
    values[part.id] ?? fallback;
  const write = (part: CardPart, next: string | number | boolean) =>
    setValues((prev) => ({ ...prev, [part.id]: next }));

  const parts = orderedParts(spec);
  const bySlot = (slot: PartSlot) => parts.filter((p) => p.slot === slot);

  /** A part's visible words: the maintainer's if they typed any, the sample otherwise. */
  const words = (part: CardPart) => part.label || t.designLab.partSample[part.kind];

  /** A part's colour: a palette token, a hex, or nothing (inherit from its position). */
  const tint = (part: CardPart): string | undefined => {
    if (!part.color) return undefined;
    if (part.color.startsWith('#')) return part.color;
    return (theme as unknown as Record<string, string>)[part.color];
  };

  const textStyle = (part: CardPart, fallbackColor: string) => ({
    fontSize: SIZE_TO_FONT[part.size],
    fontFamily: WEIGHT_TO_FONT[part.weight],
    color: tint(part) ?? fallbackColor,
  });

  /** The wash that marks the part currently open in the editor. */
  const focusStyle = (part: CardPart) =>
    part.id === focusedPartId ? { backgroundColor: theme.accentSoft, borderRadius: Radius.sm } : null;

  /** Anything that isn't a row slot — drawn in the card's own space, above or below the row. */
  function renderBlock(part: CardPart): React.ReactNode {
    const color = tint(part);
    switch (part.kind) {
      case 'button':
        return <Button label={words(part)} onPress={() => {}} size="sm" />;
      case 'slider':
        return (
          <Slider
            value={Number(read(part, 3))}
            onChange={(n) => write(part, n)}
            min={0}
            max={10}
            step={1}
            color={color}
            accessibilityLabel={words(part)}
          />
        );
      case 'toggle':
        return <Switch checked={Boolean(read(part, true))} onChange={(v) => write(part, v)} />;
      case 'checkbox':
        return <Switch checked={Boolean(read(part, false))} onChange={(v) => write(part, v)} />;
      case 'stepper':
        return <Stepper value={Number(read(part, 2))} onChange={(n) => write(part, n)} min={0} max={9} />;
      case 'segmented':
      case 'chips':
        return (
          <SegmentedControl
            value={String(read(part, 'b'))}
            onChange={(v) => write(part, v)}
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
              { value: 'c', label: 'C' },
            ]}
          />
        );
      case 'field':
        return (
          <Input
            value={String(read(part, ''))}
            onChangeText={(v) => write(part, v)}
            placeholder={words(part)}
          />
        );
      case 'timeField':
        return (
          <Input
            value={String(read(part, ''))}
            onChangeText={(v) => write(part, v)}
            placeholder="08:00"
            keyboardType="number-pad"
          />
        );
      case 'progress':
        return <ProgressBar value={0.6} color={color} />;
      case 'divider':
        return <View style={[styles.divider, { backgroundColor: color ?? theme.border }]} />;
      case 'icon':
        return <Ionicons name="ellipsis-horizontal" size={18} color={color ?? theme.textMuted} />;
      case 'badge':
        return <Ionicons name="flash-outline" size={16} color={color ?? theme.textMuted} />;
      case 'dot':
        return <View style={[styles.dot, { backgroundColor: color ?? domain.accent }]} />;
      case 'chip':
      case 'personChip':
        return (
          <View style={[styles.chip, { backgroundColor: color ?? theme.accentSoft }]}>
            <Text style={[styles.chipText, { color: theme.text }]}>{words(part).slice(0, 8)}</Text>
          </View>
        );
      default:
        return <Text style={textStyle(part, theme.text)}>{words(part)}</Text>;
    }
  }

  /** A row slot's inline content. Small by nature — this is what fits beside a title. */
  function renderInline(part: CardPart): React.ReactNode {
    switch (part.kind) {
      case 'icon':
        return <Ionicons name="leaf-outline" size={18} color={tint(part) ?? theme.textMuted} />;
      case 'badge':
        return <Ionicons name="flash-outline" size={14} color={tint(part) ?? theme.textMuted} />;
      case 'dot':
        return <View style={[styles.dot, { backgroundColor: tint(part) ?? domain.accent }]} />;
      case 'chip':
      case 'personChip':
        return (
          <View style={[styles.chip, { backgroundColor: tint(part) ?? theme.accentSoft }]}>
            <Text style={[styles.chipText, { color: theme.text }]}>{words(part).slice(0, 3)}</Text>
          </View>
        );
      default:
        return <Text style={textStyle(part, theme.textMuted)}>{words(part)}</Text>;
    }
  }

  const leading = bySlot('leading');
  const meta = bySlot('meta');
  const right = bySlot('right');
  const trailing = bySlot('trailing');
  const titleParts = bySlot('title');
  const hasAction = bySlot('action').length > 0;
  const hasCheck = bySlot('check').length > 0;
  const titleField = titleParts.find((p) => p.kind === 'field');
  const titleText = titleParts.find((p) => p.kind !== 'field');

  return (
    <Surface style={styles.card} borderColor={edge.base}>
      {bySlot('header').map((part) => (
        <View key={part.id} style={focusStyle(part)}>
          <Text style={textStyle(part, theme.text)}>{words(part)}</Text>
        </View>
      ))}

      {/* The row. Drawn only when something actually belongs in one — a card composed
          entirely of body parts should not carry an empty ruled line. */}
      {parts.some((p) => ROW_SLOTS.includes(p.slot)) ? (
        <PadSheet state="open">
          <PadRow
            title={titleText ? words(titleText) : (titleField ? words(titleField) : ' ')}
            accent={domain.accent}
            done={ticked}
            leading={leading.length ? (
              <View style={styles.inlineCluster}>
                {leading.map((part) => (
                  <View key={part.id} style={focusStyle(part)}>{renderInline(part)}</View>
                ))}
              </View>
            ) : undefined}
            titleInput={titleField ? (
              <Input
                value={String(read(titleField, ''))}
                onChangeText={(v) => write(titleField, v)}
                placeholder={words(titleField)}
                style={textStyle(titleField, theme.text)}
              />
            ) : undefined}
            meta={meta.length ? (
              <View style={styles.inlineCluster}>
                {meta.map((part) => (
                  <View key={part.id} style={focusStyle(part)}>{renderInline(part)}</View>
                ))}
              </View>
            ) : undefined}
            // A string, not a node: that is what keeps a column of values in tabular figures.
            rightValue={right.length ? right.map(words).join(' ') : undefined}
            onAction={hasAction ? () => {} : undefined}
            onToggle={hasCheck ? () => setTicked((v) => !v) : undefined}
            trailing={trailing.length ? (
              <View style={styles.inlineCluster}>
                {trailing.map((part) => (
                  <View key={part.id} style={focusStyle(part)}>{renderBlock(part)}</View>
                ))}
              </View>
            ) : undefined}
          />
        </PadSheet>
      ) : null}

      {[...bySlot('body'), ...bySlot('footer')].map((part) => (
        <View key={part.id} style={[styles.block, focusStyle(part)]}>
          {part.label && LABELLED_KINDS.includes(part.kind) ? (
            <Text style={[styles.blockLabel, { color: theme.textMuted }]}>{part.label}</Text>
          ) : null}
          {renderBlock(part)}
        </View>
      ))}

      {parts.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.designLab.cardEmpty}</Text>
      ) : null}
    </Surface>
  );
}

/** The slots that live inside `PadRow` rather than in the card's own space. */
const ROW_SLOTS: PartSlot[] = ['leading', 'title', 'meta', 'right', 'action', 'check', 'trailing'];

/** Kinds whose own words go INSIDE them, so a separate label above would say it twice. */
const LABELLED_KINDS = ['slider', 'toggle', 'checkbox', 'stepper', 'segmented', 'chips', 'progress'];

const styles = StyleSheet.create({
  card: { padding: Spacing.md, gap: Spacing.sm },
  block: { gap: 2 },
  blockLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  inlineCluster: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  divider: { height: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  chip: { paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: Radius.full },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular },
});
