/**
 * DesignLabCard.tsx — draws one `CardSpec` with the app's own components, and lets it be edited.
 *
 * The lab's bench used to show a fixed specimen strip, so the maintainer could judge a colour
 * or a corner radius but never the thing they were actually asking about: a particular card on
 * a particular screen. This renders whichever card was picked, composed of whichever parts they
 * have added, moved or taken away — and in EDIT mode every part on it is a tap target, so the
 * card is the thing you work on rather than a picture of the thing you work on.
 *
 * **Where the honesty line falls.** `DesignLabBench`'s promise was "the real thing, never a
 * lookalike", and that promise has to be restated rather than quietly dropped: **every PART
 * here is the app's real component — `Surface`, `PadSheet`, `PadRow`, `Button`, `Slider`,
 * `FormControls`, `Stepper`, `ProgressBar` — but the ARRANGEMENT is the lab's.** A composed
 * card is a proposal drawn out of real pieces, not a screenshot of shipped code, and that is
 * exactly why the export exists: the maintainer decides here, an agent wires it up there. Do
 * not let this file grow a hand-drawn stand-in for a component the app already has.
 *
 * **Edit mode does not fork that.** Selection rings and drag handles arrive through `PadRow`'s
 * `slotWrapper` — one optional, layout-neutral render-prop on the REAL row — rather than
 * through a second row drawn here. Two row implementations to keep in step is the exact drift
 * `PadRow` was created to end, and the lab must not reintroduce it to get a hit region.
 *
 * Connections:
 *   Imports → components/{Surface,PadSheet,PadRow,Button,Slider,Stepper,ProgressBar,
 *             FormControls,PressableScale,Badge,TagChip,PersonChip}, constants/theme,
 *             lib/designLab (the spec + part model), lib/designLabPlace (the body grid),
 *             lib/domainColor, lib/screenColor, lib/haptics, lib/i18n, lib/useAppTheme,
 *             react-native-gesture-handler, @expo/vector-icons
 *   Used by → app/design-lab/index.tsx (every card on a playground screen)
 *   Data    → none. Every value is local sample state; nothing here writes to a store, and
 *             the sample rows are not real tasks, habits or medicines.
 *
 * Edit notes:
 *   - **Row slots go through `PadRow`, everything else goes in the card's own space.** The
 *     seven row slots map exactly onto PadRow's props, so a part in one of them is subject to
 *     the real row's real rules — one meta line, one right-hand value, the trailing cluster's
 *     spacing. That constraint is a feature: if a composition doesn't fit the row, that is a
 *     true report about the row, not a gap in the mock.
 *   - **The card's own space is a FOUR-COLUMN GRID, and that is where "place it freely" lives**
 *     (2026-08-07). A body row is a flex row whose cells carry `flex: span`, which is why the
 *     arrangement is expressible in real React Native at all. Do not "improve" this into
 *     absolute positioning: the arrangement is the lab's, but it has to be an arrangement the
 *     app can actually build, or the exported document stops being an instruction. The maths
 *     is in lib/designLabPlace.ts, split out because the gesture is untestable here.
 *   - **Every part is a REAL component, and two of them stopped being one.** `chip`,
 *     `personChip` and `badge` were hand-drawn `View` + `Text`, and `checkbox` drew a `Switch`
 *     — so the checkmark-circle turned into a toggle the moment it left a row. They now use
 *     `components/{Badge,TagChip,PersonChip,FormControls}.tsx`. If a part needs a shape this
 *     file does not have, the answer is the app's component, never a lookalike drawn here.
 *   - **A part's `label` is optional and `''` means "use the sample".** The sample text is
 *     localized and lives in `t.designLab.partSample.*`; the registry stays free of copy so
 *     `lib/designLab.ts` can keep importing nothing but `constants/theme`.
 *   - **In edit mode the card is not live, and that is the point of the switch.** A tick you
 *     can tap is a tick you cannot select; the maintainer gets both by turning Edit off, where
 *     the card behaves exactly as it will on the real screen.
 *   - **A selection ring must not move the row.** It is drawn as a border that is always
 *     present in edit mode and merely changes colour, so selecting a part cannot reflow the
 *     thing being judged. Same reason `slotWrapper` is documented as layout-neutral.
 *   - `PadRow`'s `rightValue` takes a STRING, not a node — that is what keeps a column of
 *     values in tabular figures. A part in the `right` slot therefore renders as text however
 *     it is styled, which is why `SLOTS_FOR_KIND` only lets text-ish kinds go there.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PadSheet from '@/components/PadSheet';
import PadRow, { type PadRowSlot } from '@/components/PadRow';
import Button from '@/components/Button';
import Slider from '@/components/Slider';
import Stepper from '@/components/Stepper';
import ProgressBar from '@/components/ProgressBar';
import PressableScale from '@/components/PressableScale';
import { Badge } from '@/components/Badge';
import TagChip from '@/components/TagChip';
import PersonChip, { PersonDot } from '@/components/PersonChip';
import { Checkbox, Input, SegmentedControl, Switch } from '@/components/FormControls';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  BODY_COLS,
  cardKnob,
  orderedParts,
  type CardId,
  type CardOrigin,
  type CardPart,
  type CardSpec,
  type PartSize,
  type PartSlot,
  type PartWeight,
} from '@/lib/designLab';
import { layoutBodyParts } from '@/lib/designLabPlace';
import { getDomainColor, type Domain } from '@/lib/domainColor';
import { getScreenColor, type ScreenKey } from '@/lib/screenColor';
import { selection as selectionHaptic, tap as tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

/** A measured drop target, in window coordinates. */
export type SlotRect = { slot: PartSlot; x: number; y: number; width: number; height: number };

/** The card body's own measured geometry, for `bodyCellAtPoint`. Window coordinates. */
export type BodyMetrics = {
  body: { x: number; y: number; width: number; height: number };
  rows: { row: number; y: number; height: number }[];
};

type Props = {
  /**
   * Which real card this one started from, for the badge hue and the sample domain. A
   * skeleton or a blank card names no real card and gets the neutral default.
   */
  origin?: CardOrigin;
  /** The playground screen it sits on (a lib/screenColor key) — decides the border hue. */
  screen?: string;
  spec: CardSpec;
  /** Parts become tap-to-select and hold-to-drag instead of live controls. */
  editing?: boolean;
  /** Draws the selection ring, and tells the screen which part its editor panel is for. */
  selectedPartId?: string;
  onSelect?: (partId: string) => void;
  /** A held part started moving. The screen owns the drag so the palette can share it. */
  onDragStart?: (partId: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: () => void;
  /** Each position reports its measured box up, so the screen can hit-test a drop. */
  onSlotRect?: (rect: SlotRect) => void;
  /** The body's own box and its rows' bands, for the grid half of the hit-test. */
  onBodyMetrics?: (metrics: BodyMetrics) => void;
  /** The slot currently under the finger — highlighted as the place it will land. */
  dropSlot?: PartSlot | null;
  /** The grid cell currently under the finger, for the body's own drop hint. */
  dropCell?: { row: number; insert: boolean } | null;
  /** True while ANY drag is running, so the card can show where things may go. */
  dragging?: boolean;
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

/** PadRow's own positions, and the `PartSlot` each one is. They share names deliberately. */
const ROW_SLOTS: PartSlot[] = ['leading', 'title', 'meta', 'right', 'action', 'check', 'trailing'];

export default function DesignLabCard({
  origin,
  screen,
  spec,
  editing,
  selectedPartId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onSlotRect,
  onBodyMetrics,
  dropSlot,
  dropCell,
  dragging,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const knob = cardKnob(origin as CardId);
  const domain = getDomainColor(theme, (knob?.domain ?? 'task') as Domain);
  // The SCREEN owns the edge hue, not the card — that is the whole rule `lib/screenColor.ts`
  // was revived for. A card started from a real card keeps its badge hue (`domain`) but wears
  // the hue of wherever it has been put, exactly as a real card does.
  const edge = getScreenColor(theme, (screen ?? '') as ScreenKey);

  // Sample state, keyed by part id — local, never persisted. See the Edit notes.
  const [ticked, setTicked] = useState(false);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const read = (part: CardPart, fallback: string | number | boolean) =>
    values[part.id] ?? fallback;
  const write = (part: CardPart, next: string | number | boolean) =>
    setValues((prev) => ({ ...prev, [part.id]: next }));

  const parts = useMemo(() => orderedParts(spec), [spec]);
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

  /**
   * Only in edit mode — outside it the row draws exactly as the app draws it.
   *
   * A position can legitimately hold more than one part (three things on a meta line). The
   * FIRST is what a tap there selects; the rest stay reachable from the parts list, which is
   * why that list remains the exhaustive route to any part.
   */
  const slotWrapper = editing
    ? (slot: PadRowSlot, node: React.ReactNode) => {
      const part = bySlot(slot as PartSlot)[0];
      return (
        <PartHandle
          slot={slot as PartSlot}
          part={part}
          selected={!!part && part.id === selectedPartId}
          dropSlot={dropSlot}
          dragging={dragging}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onSlotRect={onSlotRect}
        >
          {node}
        </PartHandle>
      );
    }
    : undefined;

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
            disabled={editing}
            color={color}
            accessibilityLabel={words(part)}
          />
        );
      // A boolean is a Switch (DESIGN_RULES 19a) — but a CHECK is not a boolean control, it is
      // a completion mark, and drawing one as a toggle is what made the checkmark-circle turn
      // into a slider the moment it left a row.
      case 'toggle':
        return <Switch checked={Boolean(read(part, true))} onChange={(v) => write(part, v)} />;
      case 'checkbox':
        return (
          <Checkbox
            checked={Boolean(read(part, false))}
            onChange={(v) => write(part, v)}
            label={part.label || undefined}
          />
        );
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
            editable={!editing}
          />
        );
      case 'timeField':
        return (
          <Input
            value={String(read(part, ''))}
            onChangeText={(v) => write(part, v)}
            placeholder="08:00"
            keyboardType="number-pad"
            editable={!editing}
          />
        );
      case 'progress':
        return <ProgressBar value={0.6} color={color} />;
      case 'divider':
        return <View style={[styles.divider, { backgroundColor: color ?? theme.border }]} />;
      case 'icon':
        return <Ionicons name="ellipsis-horizontal" size={18} color={color ?? theme.textMuted} />;
      case 'badge':
        return <Badge label={words(part)} bg={color} />;
      case 'dot':
        return <View style={[styles.dot, { backgroundColor: color ?? domain.accent }]} />;
      case 'chip':
        return <TagChip label={words(part)} />;
      case 'personChip':
        return <PersonChip label={words(part)} color={color} name={words(part)} />;
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
        return <Badge label={words(part)} bg={tint(part)} />;
      case 'dot':
        return <View style={[styles.dot, { backgroundColor: tint(part) ?? domain.accent }]} />;
      case 'chip':
        return <TagChip label={words(part)} small />;
      // Beside a title there is room for the avatar and not for the name — which is exactly
      // what `PersonDot` is, and why it is exported separately from `PersonChip`.
      case 'personChip':
        return <PersonDot color={tint(part) ?? domain.accent} name={words(part)} />;
      default:
        return <Text style={textStyle(part, theme.textMuted)}>{words(part)}</Text>;
    }
  }

  /** A body/footer part with its own label above it, where the kind doesn't carry its words. */
  const renderBodyPart = (part: CardPart) => (
    <View style={styles.block}>
      {part.label && LABELLED_KINDS.includes(part.kind) ? (
        <Text style={[styles.blockLabel, { color: theme.textMuted }]}>{part.label}</Text>
      ) : null}
      {renderBlock(part)}
    </View>
  );

  const leading = bySlot('leading');
  const meta = bySlot('meta');
  const right = bySlot('right');
  const trailing = bySlot('trailing');
  const titleParts = bySlot('title');
  const hasAction = bySlot('action').length > 0;
  const hasCheck = bySlot('check').length > 0;
  const titleField = titleParts.find((p) => p.kind === 'field');
  const titleText = titleParts.find((p) => p.kind !== 'field');
  const hasRow = parts.some((p) => ROW_SLOTS.includes(p.slot));

  return (
    <Surface style={styles.card} borderColor={edge.base}>
      {bySlot('header').map((part) => (
        <Block
          key={part.id}
          part={part}
          editing={editing}
          selectedPartId={selectedPartId}
          dropSlot={dropSlot}
          dragging={dragging}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onSlotRect={onSlotRect}
        >
          <Text style={textStyle(part, theme.text)}>{words(part)}</Text>
        </Block>
      ))}

      {/* The row. Drawn only when something actually belongs in one — a card composed
          entirely of body parts should not carry an empty ruled line. */}
      {hasRow ? (
        <PadSheet state="open">
          <PadRow
            title={titleText ? words(titleText) : (titleField ? words(titleField) : ' ')}
            accent={domain.accent}
            done={ticked}
            slotWrapper={slotWrapper}
            leading={leading.length ? (
              <View style={styles.inlineCluster}>
                {leading.map((part) => <View key={part.id}>{renderInline(part)}</View>)}
              </View>
            ) : undefined}
            titleInput={titleField ? (
              <Input
                value={String(read(titleField, ''))}
                onChangeText={(v) => write(titleField, v)}
                placeholder={words(titleField)}
                editable={!editing}
                style={textStyle(titleField, theme.text)}
              />
            ) : undefined}
            meta={meta.length ? (
              <View style={styles.inlineCluster}>
                {meta.map((part) => <View key={part.id}>{renderInline(part)}</View>)}
              </View>
            ) : undefined}
            // A string, not a node: that is what keeps a column of values in tabular figures.
            rightValue={right.length ? right.map(words).join(' ') : undefined}
            onAction={hasAction ? () => {} : undefined}
            onToggle={hasCheck ? () => { if (!editing) setTicked((v) => !v); } : undefined}
            trailing={trailing.length ? (
              <View style={styles.inlineCluster}>
                {trailing.map((part) => <View key={part.id}>{renderBlock(part)}</View>)}
              </View>
            ) : undefined}
          />
        </PadSheet>
      ) : null}

      <BodyGrid
        parts={bySlot('body')}
        editing={editing}
        selectedPartId={selectedPartId}
        dropSlot={dropSlot}
        dropCell={dropCell}
        dragging={dragging}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onSlotRect={onSlotRect}
        onBodyMetrics={onBodyMetrics}
        renderPart={renderBodyPart}
      />

      <BodyGrid
        parts={bySlot('footer')}
        editing={editing}
        selectedPartId={selectedPartId}
        dropSlot={dropSlot}
        dragging={dragging}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onSlotRect={onSlotRect}
        renderPart={renderBodyPart}
      />

      {parts.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.designLab.cardEmpty}</Text>
      ) : null}
    </Surface>
  );
}

/**
 * The card's own space, laid out on the four-column grid.
 *
 * One flex row per grid row, each cell `flex: span` — so a composition is expressible in real
 * React Native, which is the entire reason placement is a grid and not a coordinate. A row
 * whose spans don't fill the width gets a spacer rather than stretching its cells, or dropping
 * one thing on a row would silently resize whatever was already there.
 *
 * Rows report their own measured band up, and they do it when `dragging` flips true rather
 * than on layout: this card scrolls inside a scrolling screen, and a scroll fires no
 * `onLayout`, so a mount-time box describes where the card used to be.
 */
function BodyGrid({
  parts,
  renderPart,
  onBodyMetrics,
  dropCell,
  ...rest
}: {
  parts: CardPart[];
  renderPart: (part: CardPart) => React.ReactNode;
  onBodyMetrics?: (metrics: BodyMetrics) => void;
  dropCell?: { row: number; insert: boolean } | null;
  editing?: boolean;
  selectedPartId?: string;
  dropSlot?: PartSlot | null;
  dragging?: boolean;
  onSelect?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: () => void;
  onSlotRect?: (rect: SlotRect) => void;
}) {
  const theme = useAppTheme();
  const rows = useMemo(() => layoutBodyParts(parts), [parts]);
  const bodyRef = useRef<View | null>(null);
  const rowRefs = useRef<Map<number, View | null>>(new Map());

  useEffect(() => {
    if (!rest.dragging || !onBodyMetrics) return;
    const body = bodyRef.current as unknown as Measurable | null;
    if (!body?.measureInWindow) return;
    body.measureInWindow((x, y, width, height) => {
      const bands: BodyMetrics['rows'] = [];
      let pending = rows.length;
      if (pending === 0) {
        onBodyMetrics({ body: { x, y, width, height }, rows: [] });
        return;
      }
      for (const row of rows) {
        const node = rowRefs.current.get(row.row) as unknown as Measurable | null;
        if (!node?.measureInWindow) {
          pending -= 1;
          if (pending === 0) onBodyMetrics({ body: { x, y, width, height }, rows: bands });
          continue;
        }
        node.measureInWindow((_rx, ry, _rw, rh) => {
          bands.push({ row: row.row, y: ry, height: rh });
          pending -= 1;
          if (pending === 0) onBodyMetrics({ body: { x, y, width, height }, rows: bands });
        });
      }
    });
  }, [rest.dragging, onBodyMetrics, rows]);

  if (rows.length === 0 && !rest.dragging) return null;

  return (
    <View ref={bodyRef} collapsable={false} style={styles.grid}>
      {rows.map((row) => {
        const used = row.cells.reduce((sum, cell) => sum + cell.span, 0);
        const spare = Math.max(0, BODY_COLS - used);
        const marked = dropCell?.insert === false && dropCell.row === row.row;
        return (
          <View
            key={row.row}
            ref={(node) => { rowRefs.current.set(row.row, node); }}
            collapsable={false}
            style={[styles.gridRow, marked && { backgroundColor: theme.accentSoft }]}
          >
            {row.cells.map((cell) => (
              // minWidth: 0 alongside flex, or a long label refuses to shrink and shoves its
              // neighbour off the card — the fix AGENTS.md's wrap-audit notes spell out.
              <View key={cell.part.id} style={{ flex: cell.span, minWidth: 0 }}>
                <Block part={cell.part} {...rest}>{renderPart(cell.part)}</Block>
              </View>
            ))}
            {spare > 0 ? <View style={{ flex: spare }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

/**
 * A part in the card's OWN space (header / body / footer), selectable in edit mode.
 *
 * Outside edit mode it renders the part and nothing else — no wrapper, no gesture, no border —
 * which is what makes the Edit switch a real switch rather than a styling change: with it off
 * the card is exactly the tree the app would draw.
 */
function Block({
  part,
  editing,
  selectedPartId,
  children,
  ...rest
}: {
  part: CardPart;
  editing?: boolean;
  selectedPartId?: string;
  dropSlot?: PartSlot | null;
  dragging?: boolean;
  onSelect?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: () => void;
  onSlotRect?: (rect: SlotRect) => void;
  children: React.ReactNode;
}) {
  if (!editing) return <>{children}</>;
  return (
    <PartHandle part={part} slot={part.slot} selected={part.id === selectedPartId} {...rest}>
      {children}
    </PartHandle>
  );
}

/**
 * One selectable, draggable, measurable position on the card.
 *
 * **Hoisted to module scope on purpose.** Defined inside `DesignLabCard` it would be a NEW
 * component type on every render, so React would unmount and remount the whole row subtree
 * each time — losing the sample state the card exists to let you play with, and remounting a
 * gesture handler mid-drag.
 *
 * `part` is optional because a row POSITION can be empty while still being drawn (the check
 * ring is there whether or not the maintainer has a part in that slot). An empty one measures
 * itself as a drop target but has nothing to select.
 */
function PartHandle({
  part,
  slot,
  selected,
  dropSlot,
  dragging,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onSlotRect,
  children,
}: {
  part?: CardPart;
  slot: PartSlot;
  selected?: boolean;
  dropSlot?: PartSlot | null;
  dragging?: boolean;
  onSelect?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: () => void;
  onSlotRect?: (rect: SlotRect) => void;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  const t = useT();
  const ref = React.useRef<Measurable | null>(null);
  const isDrop = dropSlot === slot;

  const measure = React.useCallback(() => {
    // Window coordinates, because the palette lives outside this card and both drags
    // hit-test against the same set of boxes.
    ref.current?.measureInWindow?.((x, y, width, height) => {
      onSlotRect?.({ slot, x, y, width, height });
    });
  }, [onSlotRect, slot]);

  // Re-measure when a drag STARTS, not only on layout. The card scrolls inside the pinned
  // preview, and a scroll fires no `onLayout` — so boxes measured at mount describe where the
  // card used to be, and every drop would land on the wrong slot or on none. Same
  // measure-at-drag-start rule lib/useDragReorder.ts follows, and for the same reason.
  React.useEffect(() => {
    if (dragging) measure();
  }, [dragging, measure]);

  const pan = Gesture.Pan()
    // The app's universal drag gesture (lib/useDragReorder.ts, components/DraggableTaskRow.tsx):
    // hold, then move. A drag that activated instantly would eat the preview's own scroll.
    .activateAfterLongPress(400)
    .enabled(!!part)
    .onStart(() => { if (part) { tapHaptic(); onDragStart?.(part.id); } })
    .onUpdate((e) => onDragMove?.(e.absoluteX, e.absoluteY))
    .onFinalize(() => onDragEnd?.());

  return (
    <GestureDetector gesture={pan}>
      <View
        ref={(node) => { ref.current = node as Measurable | null; }}
        onLayout={measure}
        style={[
          styles.handle,
          { borderColor: isDrop || selected ? theme.accent : dragging ? theme.border : 'transparent' },
          isDrop && { backgroundColor: theme.accentSoft },
        ]}
      >
        <PressableScale
          onPress={() => { if (part) { selectionHaptic(); onSelect?.(part.id); } }}
          disabled={!part}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={part ? (part.label || t.designLab.parts[part.kind]) : undefined}
        >
          {children}
        </PressableScale>
      </View>
    </GestureDetector>
  );
}

/** Kinds whose own words go INSIDE them, so a separate label above would say it twice. */
const LABELLED_KINDS = ['slider', 'toggle', 'checkbox', 'stepper', 'segmented', 'chips', 'progress'];

const styles = StyleSheet.create({
  card: { padding: Spacing.md, gap: Spacing.sm },
  block: { gap: 2 },
  blockLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  inlineCluster: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // The ring is always 1px and only its colour changes — a border that appears on selection
  // would reflow the very card being judged. See the Edit notes.
  handle: { borderWidth: 1, borderRadius: Radius.sm, borderColor: 'transparent' },
  divider: { height: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  // The card's own space. `chip`/`chipText` used to live here for a hand-drawn stand-in;
  // components/TagChip.tsx and components/PersonChip.tsx do that job now — see the Edit notes.
  grid: { gap: Spacing.xs },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.sm },
  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular },
});
