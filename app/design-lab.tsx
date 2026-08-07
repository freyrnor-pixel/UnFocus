/**
 * design-lab.tsx — the workbench: build the card you want, then send it on.
 *
 * The app's visual decisions have repeatedly been made by describing a look in prose and
 * waiting an OTA to see the guess. This screen is the other way round: change it here, look at
 * it, and export a document that names every token and every part that moved, what it moved
 * from and to, and where it lives — so the agent applying it edits the real thing instead of
 * interpreting.
 *
 * **Nothing here is a user preference.** It is a scratchpad: off by default behind
 * `settings.featureDesignLab`, resettable in one tap, and opening it never changes the app
 * (the "use these everywhere" switch starts off and is stored off). The output is the file.
 *
 * Four tabs under a PINNED preview (2026-08-07). It was one long scroll, which meant that by
 * the time you reached a knob the thing it changed had scrolled off the top — you turned it,
 * scrolled back up, looked, scrolled down again. The card being worked on now stays under the
 * header while the controls scroll beneath it.
 *
 * Connections:
 *   Imports → components/{ScreenScaffold,Surface,Button,ExpandableCard,PressableScale,
 *             TabSlider,DesignLabCard,DesignLabBench,ColorPickerSheet,PartEditorSheet,
 *             DraggableTaskRow,FormControls,Slider,AppModal}, constants/theme,
 *             lib/{designLab,designLabExport,useDesignLab,useDragReorder,useAppTheme,i18n,
 *             haptics,date}, store/useSettingsStore, expo-constants
 *   Used by → app/settings.tsx (Advanced tab, a SubScreenLinkButton gated on featureDesignLab)
 *   Data    → reads/writes `settings.designLab` + `settings.designLabApply`, and flips
 *             `settings.darkMode` from the preview's light/dark button. Touches nothing else:
 *             no task, habit, note or health row is read or written from this screen.
 *
 * Edit notes:
 *   - **The draft lives in local state and is committed on every change**, the way every other
 *     control in app/settings.tsx applies immediately. There is deliberately no save step —
 *     but the local copy is what the preview draws, so a knob still moves the specimen on a
 *     device where the DB write fails (useSettingsStore.update keeps memory state either way).
 *   - **The knobs are NOT inside the preview's provider.** They render in the app's own
 *     styling on purpose: a maintainer dragging a colour through black must not lose the
 *     control they are dragging. `components/DesignLabCard.tsx` (in the sticky block) and
 *     `components/DesignLabBench.tsx` (the Controls tab's strip) are the only things that
 *     preview the draft, and each wraps itself.
 *   - **The pinned block must declare its own height** (`stickyBelowHeaderHeight`), which is
 *     why the preview has two fixed heights rather than sizing to its content. A card composed
 *     of a dozen parts would otherwise eat a small phone whole; the chevron collapses it to a
 *     peek and the declared height follows.
 *   - Colour is edited per MODE, and the light/dark button flips `settings.darkMode` — the
 *     same switch Settings owns, not a second theming path. Light and dark keep separate maps,
 *     because a value that works on white rarely works on navy.
 *   - **A knob's `usedBy`/`source` is EXPORT metadata, not UI copy.** It is English by design
 *     (its reader is an agent) and must not be rendered on screen — an English hint under a
 *     Norwegian label is exactly what the first wrap audit of this screen caught. What DOES
 *     render raw is a token name (`accent`) and a variant id (`segmented`), deliberately:
 *     those are the words the exported document uses, and translating them would make the
 *     screen and the report disagree. `t.designLab.idNote` says so on screen.
 *   - New knob or new card? It goes in lib/designLab.ts, not here. Every panel below
 *     enumerates from that registry, so an entry added there shows up already wired; the only
 *     thing this file needs is the i18n pair, which `no: typeof en` will demand at compile time.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import TabSlider from '@/components/TabSlider';
import Slider from '@/components/Slider';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import DesignLabCard from '@/components/DesignLabCard';
import DesignLabBench from '@/components/DesignLabBench';
import ColorPickerSheet from '@/components/ColorPickerSheet';
import PartEditorSheet from '@/components/PartEditorSheet';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import {
  CARD_KNOBS,
  COLOR_KNOBS,
  CONTROL_KNOBS,
  EMPTY_OVERRIDES,
  MAX_PARTS_PER_CARD,
  PART_KINDS,
  SHAPE_KNOBS,
  SLOTS_FOR_KIND,
  SLOT_KNOBS,
  clampShape,
  describeCards,
  describeOverrides,
  resolveCardSpec,
  resolveControl,
  resolveShape,
  resolveSlot,
  type CardId,
  type CardPart,
  type ColorGroup,
  type ControlSlot,
  type LabOverrides,
  type PartKind,
  type ShapeOverrides,
  type SlotId,
} from '@/lib/designLab';
import { exportDesignLab, exportDesignLabToDevice, hasSomethingToExport } from '@/lib/designLabExport';
import { DesignLabContext } from '@/lib/useDesignLab';
import { useDragReorder } from '@/lib/useDragReorder';
import { FontSize, Fonts, HitSlop, MIN_TAP_TARGET, Radius, Spacing, TabularNums } from '@/constants/theme';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { nowHHMM, todayStr } from '@/lib/date';

type LabTab = 'card' | 'color' | 'shape' | 'controls';

/** The order the colour panel draws its groups in — mirrors constants/colors.ts's own. */
const COLOR_GROUP_ORDER: ColorGroup[] = [
  'accent', 'surfaces', 'text', 'borders', 'screens', 'semantic', 'hint', 'identity',
];

/**
 * The pinned preview's height bounds.
 *
 * `ScreenScaffold` positions the scroll body from `stickyBelowHeaderHeight`, so the number has
 * to be one the screen knows rather than one the layout works out — which is why the preview
 * measures its own card and reports it up, clamped to these. A fixed tall value left a plain
 * three-part card floating in 200px of nothing; a fixed short one cut a composed card in half.
 * `PREVIEW_SHORT` is the collapsed peek, and the chevron is the way to it.
 */
const PREVIEW_MAX = 320;
const PREVIEW_MIN = 88;
const PREVIEW_SHORT = 88;
const CHROME_HEIGHT = 100; // the picker row + the tab bar, both always drawn

const clampPreview = (n: number) => Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, Math.ceil(n)));

export default function DesignLabScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const settings = useSettingsStore();
  const [draft, setDraft] = useState<LabOverrides>(settings.designLab);
  const [tab, setTab] = useState<LabTab>('card');
  const [cardId, setCardId] = useState<CardId>('todo');
  const [pickingCard, setPickingCard] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [cardHeight, setCardHeight] = useState(PREVIEW_MIN);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [busy, setBusy] = useState(false);

  // The live palette WITHOUT the draft applied — the "before" column of the report, and the
  // swatch a knob starts from. `useAppTheme()` here already carries any applied overrides, so
  // this reads the untouched token straight from the resolved theme when nothing is applied.
  const changes = useMemo(() => describeOverrides(draft, theme, isDark), [draft, theme, isDark]);
  const cardChanges = useMemo(() => describeCards(draft), [draft]);
  const shape = useMemo(() => resolveShape(draft), [draft]);
  const spec = useMemo(() => resolveCardSpec(cardId, draft), [cardId, draft]);

  /** Every write goes through here: local state for the preview, the store for persistence. */
  const commit = (next: LabOverrides) => {
    setDraft(next);
    settings.update({ designLab: next });
  };

  const setColor = (id: string, hex: string | undefined) => {
    const mode = isDark ? 'dark' : 'light';
    const map = { ...draft.colors[mode] };
    if (hex === undefined) delete map[id as keyof typeof map];
    else map[id as keyof typeof map] = hex;
    commit({ ...draft, colors: { ...draft.colors, [mode]: map } });
  };

  const setShape = (id: keyof ShapeOverrides, value: number) => {
    // Rounded to 3 decimals because the small steps (0.02, 0.05) accumulate float noise that
    // would otherwise land in the exported document as `1.0500000000000003`.
    const next = { ...draft.shape, [id]: Math.round(clampShape(id, value) * 1000) / 1000 };
    commit({ ...draft, shape: next });
  };

  const setControl = (id: ControlSlot, variant: string) => {
    selection();
    commit({ ...draft, controls: { ...draft.controls, [id]: variant } });
  };

  const setSlot = (id: SlotId, value: string) => {
    selection();
    commit({ ...draft, slots: { ...draft.slots, [id]: value } });
  };

  /** Writing the card back always writes the WHOLE composition — see CardSpec's own doc. */
  const setParts = (parts: CardPart[], note = spec.note) => {
    commit({ ...draft, cards: { ...draft.cards, [cardId]: { parts, note } } });
  };

  const addPart = (kind: PartKind) => {
    if (spec.parts.length >= MAX_PARTS_PER_CARD) return;
    // A fresh id that can't collide with a shipped part's, so the report reads it as "added".
    let n = 1;
    while (spec.parts.some((p) => p.id === `${kind}-${n}`)) n += 1;
    const id = `${kind}-${n}`;
    setParts([
      ...spec.parts,
      { id, kind, slot: SLOTS_FOR_KIND[kind][0], label: '', color: '', size: 'sm', weight: 'regular' },
    ]);
    setAddingPart(false);
    setEditingPartId(id);
  };

  const updatePart = (next: CardPart) => {
    setParts(spec.parts.map((p) => (p.id === next.id ? next : p)));
  };

  const removePart = (id: string) => {
    setParts(spec.parts.filter((p) => p.id !== id));
    setEditingPartId(null);
  };

  /** Back to the card the app ships — by forgetting the composition, not by storing a copy. */
  const restoreCard = () => {
    const cards = { ...draft.cards };
    delete cards[cardId];
    commit({ ...draft, cards });
  };

  const reset = () => {
    showAppModal(t.designLab.title, t.designLab.reset, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.designLab.resetConfirm,
        style: 'destructive',
        onPress: () => {
          commit(EMPTY_OVERRIDES);
          settings.update({ designLabApply: false });
        },
      },
    ]);
  };

  const meta = () => ({
    // With the time, so two exports on one day are told apart. `todayStr()` alone is what it
    // used to pass, against a field documented as `YYYY-MM-DD HH:MM`.
    stamp: `${todayStr()} ${nowHHMM()}`,
    appVersion: String(Constants.expoConfig?.version ?? ''),
    isDark,
    fromScreen: cardId,
  });

  const runExport = async (toDevice: boolean) => {
    if (!hasSomethingToExport(draft)) {
      showAppModal(t.designLab.title, t.designLab.exportEmpty);
      return;
    }
    setBusy(true);
    try {
      if (toDevice) {
        const result = await exportDesignLabToDevice(draft, theme, meta());
        if (result.status === 'saved') showAppModal(t.designLab.title, t.designLab.savedTo(result.location));
        else if (result.status === 'unavailable') showAppModal(t.designLab.title, t.designLab.exportUnavailable);
      } else {
        const result = await exportDesignLab(draft, theme, meta());
        showAppModal(
          t.designLab.title,
          result === 'shared' ? t.designLab.exportShared : t.designLab.exportUnavailable,
        );
      }
    } catch {
      showAppModal(t.designLab.title, t.designLab.exportFailed);
    } finally {
      setBusy(false);
    }
  };

  const previewHeight = expanded ? clampPreview(cardHeight) : PREVIEW_SHORT;

  /**
   * The pinned block: which card, the card itself, and the tabs.
   *
   * The preview is the ONLY thing here inside the provider — see the Edit notes.
   *
   * It carries an OPAQUE background on purpose. It is positioned chrome, so the scroll body
   * passes underneath it; without a fill, list rows slide visibly through the specimen.
   */
  const pinned = (
    <View style={[styles.pinned, { height: previewHeight + CHROME_HEIGHT, backgroundColor: theme.bg }]}>
      <View style={styles.pickerRow}>
        <PressableScale
          onPress={() => { selection(); setPickingCard(true); }}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={t.designLab.whichCard}
          style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Text style={[styles.pickerText, { color: theme.text }]} numberOfLines={1}>
            {t.designLab.cards[cardId]}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
        </PressableScale>
        <PressableScale
          onPress={() => { selection(); settings.update({ darkMode: isDark ? 'off' : 'on' }); }}
          scaleTo={0.9}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={isDark ? t.designLab.preview.light : t.designLab.preview.dark}
          style={[styles.iconBtn, { borderColor: theme.border }]}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={theme.textMuted} />
        </PressableScale>
        <PressableScale
          onPress={() => { selection(); setExpanded((v) => !v); }}
          scaleTo={0.9}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={t.designLab.preview.collapse}
          style={[styles.iconBtn, { borderColor: theme.border }]}
        >
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
        </PressableScale>
      </View>

      <View style={{ height: previewHeight }}>
        <ScrollView contentContainerStyle={styles.previewBody} showsVerticalScrollIndicator={false}>
          {/* Measured, not guessed — see the note on PREVIEW_MAX. The card still scrolls
              inside its box once it outgrows the cap. */}
          <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>
            <DesignLabContext.Provider value={draft}>
              <DesignLabCard id={cardId} spec={spec} focusedPartId={editingPartId ?? undefined} />
            </DesignLabContext.Provider>
          </View>
        </ScrollView>
      </View>

      <TabSlider
        value={tab}
        onChange={setTab}
        options={[
          { value: 'card' as const, label: t.designLab.tabs.card },
          { value: 'color' as const, label: t.designLab.tabs.color },
          { value: 'shape' as const, label: t.designLab.tabs.shape },
          { value: 'controls' as const, label: t.designLab.tabs.controls },
        ]}
        style={styles.tabBar}
      />
    </View>
  );

  const editingPart = spec.parts.find((p) => p.id === editingPartId) ?? null;

  return (
    <ScreenScaffold
      title={t.designLab.title}
      tier="sub"
      onBack={() => router.back()}
      stickyGapColor="transparent"
      stickyBelowHeader={pinned}
      stickyBelowHeaderHeight={previewHeight + CHROME_HEIGHT}
    >
      <View style={styles.page}>
        {tab === 'card' && (
          <CardTab
            spec={spec}
            onEdit={setEditingPartId}
            onReorder={(ids) => setParts(ids.map((id) => spec.parts.find((p) => p.id === id)!).filter(Boolean))}
            onAdd={() => setAddingPart(true)}
            onNote={(note) => setParts(spec.parts, note)}
            onRestore={restoreCard}
            restorable={draft.cards[cardId] != null}
          />
        )}

        {tab === 'color' && (
          <>
            <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.modeNote}</Text>
            <Surface style={styles.card}>
              {COLOR_GROUP_ORDER.map((group, i) => (
                <ExpandableCard
                  key={group}
                  title={t.designLab.colorGroups[group]}
                  accentColor={theme.accent}
                  rounded
                  first={i === 0}
                >
                  {COLOR_KNOBS.filter((k) => k.group === group).map((knob) => (
                    <ColorRow
                      key={knob.id as string}
                      id={knob.id as string}
                      current={String(theme[knob.id] ?? '')}
                      override={(isDark ? draft.colors.dark : draft.colors.light)[knob.id]}
                      onChange={(hex) => setColor(knob.id as string, hex)}
                    />
                  ))}
                </ExpandableCard>
              ))}
            </Surface>
          </>
        )}

        {tab === 'shape' && (
          <Surface style={styles.card}>
            {SHAPE_KNOBS.map((knob) => (
              <View key={knob.id} style={styles.stackedRow}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>{t.designLab.shape[knob.id]}</Text>
                  <Text style={[styles.shapeValue, { color: theme.textMuted }]}>{shape[knob.id]}</Text>
                  <ResetKnob
                    visible={draft.shape[knob.id] !== undefined}
                    onPress={() => {
                      const next = { ...draft.shape };
                      delete next[knob.id];
                      commit({ ...draft, shape: next });
                    }}
                  />
                </View>
                <Slider
                  value={shape[knob.id]}
                  onChange={(v) => setShape(knob.id, v)}
                  min={knob.min}
                  max={knob.max}
                  step={knob.step}
                  accessibilityLabel={t.designLab.shape[knob.id]}
                />
              </View>
            ))}
          </Surface>
        )}

        {tab === 'controls' && (
          <>
            <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.idNote}</Text>
            <DesignLabBench overrides={draft} />
            <Surface style={styles.card}>
              {CONTROL_KNOBS.map((knob) => (
                <View key={knob.id} style={styles.stackedRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>{t.designLab.controls[knob.id]}</Text>
                  <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.controlHints[knob.id]}</Text>
                  <SegmentedControl
                    value={resolveControl(knob.id, draft)}
                    onChange={(v) => setControl(knob.id, v)}
                    options={knob.variants.map((v) => ({ value: v, label: v }))}
                  />
                </View>
              ))}
            </Surface>

            <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.groups.slots}</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.slotsNote}</Text>
            <Surface style={styles.card}>
              {SLOT_KNOBS.map((knob) => (
                <View key={knob.id} style={styles.stackedRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>{t.designLab.slots[knob.id]}</Text>
                  <View style={styles.optionCloud}>
                    {knob.options.map((opt) => (
                      <OptionPill
                        key={opt}
                        label={opt}
                        active={resolveSlot(knob.id, draft) === opt}
                        onPress={() => setSlot(knob.id, opt)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </Surface>
          </>
        )}

        {/* Apply / note / export. Mounted once, at the end of whichever tab is showing, so it
            is always a scroll away and never duplicated in the tree. */}
        <Surface style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>{t.designLab.applyLabel}</Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.applyHint}</Text>
            </View>
            <Switch
              checked={settings.designLabApply}
              onChange={(v) => { selection(); settings.update({ designLabApply: v }); }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {t.designLab.changeCount(changes.length + cardChanges.length)}
          </Text>
          <Input
            label={t.designLab.noteLabel}
            placeholder={t.designLab.notePlaceholder}
            value={draft.note}
            onChangeText={(v) => setDraft({ ...draft, note: v })}
            onBlur={() => settings.update({ designLab: draft })}
            multiline
            style={styles.noteInput}
          />
          <View style={styles.actionRow}>
            <Button label={t.designLab.exportLabel} onPress={() => runExport(false)} loading={busy} size="sm" />
            <Button label={t.designLab.saveLabel} onPress={() => runExport(true)} variant="ghost" size="sm" />
            <Button label={t.designLab.reset} onPress={reset} variant="ghost" size="sm" />
          </View>
        </Surface>

        <View style={{ height: 40 }} />
      </View>

      {/* Which card. A sheet rather than a TabSlider: that control is deliberately never
          scrollable, and eleven cards do not fit on one non-scrolling row. */}
      {pickingCard ? (
        <ChoiceSheet
          title={t.designLab.whichCard}
          onClose={() => setPickingCard(false)}
          options={CARD_KNOBS.map((knob) => ({ value: knob.id as string, label: t.designLab.cards[knob.id] }))}
          value={cardId}
          onPick={(v) => { setCardId(v as CardId); setPickingCard(false); }}
        />
      ) : null}

      {addingPart ? (
        <ChoiceSheet
          title={t.designLab.addPart}
          onClose={() => setAddingPart(false)}
          options={PART_KINDS.map((kind) => ({ value: kind, label: t.designLab.parts[kind] }))}
          onPick={(v) => addPart(v as PartKind)}
        />
      ) : null}

      <PartEditorSheet
        visible={editingPart != null}
        part={editingPart}
        onClose={() => setEditingPartId(null)}
        onChange={updatePart}
        onRemove={() => editingPart && removePart(editingPart.id)}
      />
    </ScreenScaffold>
  );
}

/**
 * The Card tab: what this card is made of, in the order it draws.
 *
 * Reordering is the app's universal hold-and-drag mechanic (lib/useDragReorder.ts), and the
 * "add" trigger sits at the BOTTOM of the list it appends to — the placement rule
 * components/NewMonthlyListRow.tsx established.
 */
function CardTab({
  spec,
  onEdit,
  onReorder,
  onAdd,
  onNote,
  onRestore,
  restorable,
}: {
  spec: { parts: CardPart[]; note: string };
  onEdit: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onAdd: () => void;
  onNote: (note: string) => void;
  onRestore: () => void;
  restorable: boolean;
}) {
  const theme = useAppTheme();
  const t = useT();
  const drag = useDragReorder(spec.parts.map((p) => p.id), onReorder);
  const byId = new Map(spec.parts.map((p) => [p.id, p]));

  return (
    <>
      <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.partsTitle}</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.partsHint}</Text>
      <Surface style={styles.card}>
        {/* Render in the hook's order, not the spec's — that is what moves under the finger. */}
        {drag.order.map((id) => {
          const part = byId.get(id);
          if (!part) return null;
          return (
            <DraggableTaskRow key={id} isOpen={false} {...drag.rowProps(id)}>
              <PressableScale
                onPress={() => { selection(); onEdit(id); }}
                scaleTo={0.98}
                accessibilityRole="button"
                accessibilityLabel={part.label || t.designLab.parts[part.kind]}
                style={styles.partRow}
              >
                <Ionicons name="reorder-three-outline" size={18} color={theme.textMuted} />
                <View style={styles.switchTextCol}>
                  <Text style={[styles.switchLabel, { color: theme.text }]} numberOfLines={1}>
                    {part.label || t.designLab.parts[part.kind]}
                  </Text>
                  <Text style={[styles.hint, { color: theme.textMuted }]} numberOfLines={1}>
                    {t.designLab.partSlots[part.slot]}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </PressableScale>
            </DraggableTaskRow>
          );
        })}

        {/* At the bottom of the list it appends to — never beside a card's expand toggle. */}
        <PressableScale
          onPress={() => { selection(); onAdd(); }}
          scaleTo={0.97}
          accessibilityRole="button"
          style={[styles.addRow, { borderColor: theme.border }]}
        >
          <Ionicons name="add" size={18} color={theme.accent} />
          <Text style={[styles.switchLabel, { color: theme.accent }]}>{t.designLab.addPart}</Text>
        </PressableScale>
      </Surface>

      <Surface style={styles.card}>
        <Input
          label={t.designLab.cardNoteLabel}
          placeholder={t.designLab.cardNotePlaceholder}
          value={spec.note}
          onChangeText={onNote}
          multiline
          style={styles.noteInput}
        />
        {restorable ? (
          <Button label={t.designLab.restoreCard} onPress={onRestore} variant="ghost" size="sm" />
        ) : null}
      </Surface>
    </>
  );
}

/** A per-knob "put this one back", drawn only when there is something to put back. */
function ResetKnob({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const t = useT();
  if (!visible) return null;
  return (
    <PressableScale
      onPress={() => { selection(); onPress(); }}
      scaleTo={0.9}
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.designLab.color.putBack}
    >
      <Ionicons name="arrow-undo-outline" size={16} color={theme.textMuted} />
    </PressableScale>
  );
}

/** One raw-id pill. The id renders untranslated on purpose — see the file header. */
function OptionPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[
        styles.optionPill,
        {
          backgroundColor: active ? theme.accent : 'transparent',
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={[styles.optionText, { color: active ? theme.accentInk : theme.textMuted }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * A scrolling list of choices in a modal — used for "which card" and "add a part".
 *
 * Both lists are too long for a row of pills and too shallow to deserve a screen. Kept local
 * to this file: it is a plain list in a `Surface`, and promoting it to `components/` would be
 * a third bottom-sheet abstraction next to `AnimatedBottomSheet` and `AppModal`.
 */
function ChoiceSheet({
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  options: { value: string; label: string }[];
  value?: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.choiceWrap, { backgroundColor: theme.overlay }]}>
      <PressableScale style={StyleSheet.absoluteFill} onPress={onClose} scaleTo={1} accessibilityLabel={title} />
      <Surface style={styles.choiceSheet}>
        <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
        <ScrollView style={styles.choiceScroll}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <PressableScale
                key={option.value}
                onPress={() => { selection(); onPick(option.value); }}
                scaleTo={0.98}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={styles.choiceRow}
              >
                <Text style={[styles.choiceLabel, { color: active ? theme.accent : theme.text }]}>
                  {option.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
              </PressableScale>
            );
          })}
        </ScrollView>
      </Surface>
    </View>
  );
}

/**
 * One colour token: a swatch of what it is now, its raw name, and a way in to change it.
 *
 * The row itself is now just the door. It used to BE the editor — a hex field plus a ±8%
 * lighten/darken pair — which could only answer "a bit darker": there was no way to reach a
 * different hue without already knowing the code. Tapping the row opens
 * components/ColorPickerSheet.tsx, which has the range and the fine-tuning; what stays here is
 * the one thing a list of 34 tokens actually needs, which is to show at a glance which ones
 * have been changed.
 */
function ColorRow({
  id,
  current,
  override,
  onChange,
}: {
  id: string;
  current: string;
  override?: string;
  onChange: (hex: string | undefined) => void;
}) {
  const theme = useAppTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const value = override ?? current;

  return (
    <>
      <PressableScale
        onPress={() => { selection(); setOpen(true); }}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={id}
        style={styles.colorRow}
      >
        <View style={[styles.swatch, { backgroundColor: value, borderColor: theme.border }]} />
        {/* The token's own name, not a translated label. It is what the exported document
            names and what the maintainer will quote back — a friendly rendering here would make
            the screen and the report disagree about what was changed. */}
        <Text style={[styles.tokenName, { color: theme.text }]} numberOfLines={1}>{id}</Text>
        {override ? (
          <Text style={[styles.changedTag, { color: theme.accent }]}>{t.designLab.changedTag}</Text>
        ) : null}
        <Text style={[styles.hexValue, { color: theme.textMuted }]}>{value}</Text>
      </PressableScale>
      <ColorPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        tokenName={id}
        shipped={current}
        value={value}
        overridden={override != null}
        onChange={(hex) => onChange(hex)}
        onClear={() => onChange(undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  hint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  groupHeader: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.sm, textTransform: 'uppercase' },
  card: { padding: Spacing.md, gap: Spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  // flex + minWidth:0 so a long label yields instead of shoving the control off the card.
  switchTextCol: { flex: 1, minWidth: 0, gap: 1 },
  switchLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  stackedRow: { gap: Spacing.xs },
  shapeValue: { fontSize: FontSize.sm, fontFamily: Fonts.regular, ...TabularNums },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  noteInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: Spacing.xs },
  // ── The pinned block ──────────────────────────────────────────────────────
  pinned: { paddingHorizontal: Spacing.md, gap: Spacing.xs, justifyContent: 'flex-start' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pickerBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  pickerText: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: { paddingBottom: Spacing.xs },
  tabBar: { marginTop: Spacing.xs },
  // ── The card tab ──────────────────────────────────────────────────────────
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  // ── The choice sheet ──────────────────────────────────────────────────────
  choiceWrap: { justifyContent: 'flex-end', zIndex: 20 },
  choiceSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  choiceTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  choiceScroll: { flexShrink: 1 },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
  },
  choiceLabel: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // ── Colour rows and option pills ──────────────────────────────────────────
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
  },
  swatch: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1 },
  hexValue: { fontSize: FontSize.xs, fontFamily: Fonts.regular, ...TabularNums },
  changedTag: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
  tokenName: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  optionCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  optionPill: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  optionText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
