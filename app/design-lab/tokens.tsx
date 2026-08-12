/**
 * design-lab/tokens.tsx — the app's own knobs: colour, shape, and the shape of a control.
 *
 * The other half of the design lab. `index.tsx` is where a card gets built; this is where the
 * values every card is made of get turned — the 34 palette tokens, the 11 geometry numbers, the
 * 7 control jobs and the 4 row positions. It also owns the export, because a report is about a
 * whole session rather than about one screen.
 *
 * **Why this is a pushed screen and not a fifth tab.** It used to be three tabs beside a card
 * editor, under a preview pinned to the top of the screen. The playground needs the header, the
 * screen switcher, the card area and the inspector all at once — that is the whole viewport —
 * and turning a token is a "go and tune it, come back" errand rather than something interleaved
 * with dragging. Splitting it gets a real back button, its own wrap-audit scan, and lets these
 * three panels move across unchanged.
 *
 * Connections:
 *   Imports → components/{ScreenScaffold,Surface,Button,ExpandableCard,PressableScale,TabSlider,
 *             Slider,DesignLabBench,ColorPickerSheet,FormControls,AppModal}, constants/theme,
 *             lib/{designLab,designLabExport,useDesignLab,useAppTheme,i18n,haptics,date},
 *             store/useSettingsStore, expo-constants
 *   Used by → app/design-lab/index.tsx (a header button)
 *   Data    → reads/writes `settings.designLab` through `useLabDraft`, and `settings.
 *             designLabApply`. Flips `settings.darkMode` from the appearance button. Touches
 *             nothing else — no task, habit, note or health row is read or written here.
 *
 * Edit notes:
 *   - **The knobs are NOT inside the preview's provider, and must not be.** They render in the
 *     app's own styling on purpose: a maintainer dragging a colour through black must not lose
 *     the control they are dragging. `components/DesignLabBench.tsx` is the only thing on this
 *     screen that previews the draft, and it wraps itself.
 *   - **Colour is edited per MODE**, and the appearance button flips `settings.darkMode` — the
 *     same switch Settings owns, not a second theming path. Light and dark keep separate maps,
 *     because a value that works on white rarely works on navy.
 *   - **A knob's `usedBy`/`source` is EXPORT metadata and must not render.** It is English by
 *     design (its reader is an agent); an English hint under a Norwegian label is exactly what
 *     the first wrap audit of this screen caught. What DOES render raw is a token name
 *     (`accent`) and a variant id (`segmented`), deliberately: those are the words the exported
 *     document uses, and translating them would make the screen and the report disagree.
 *     `t.designLab.idNote` says so on screen.
 *   - New knob? It goes in lib/designLab.ts, not here — every panel enumerates from that
 *     registry, so an entry added there shows up already wired. The only thing this file needs
 *     is the i18n pair, which `no: typeof en` will demand at compile time.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import TabSlider, { TAB_SLIDER_HEIGHT } from '@/components/TabSlider';
import Slider from '@/components/Slider';
import DesignLabBench from '@/components/DesignLabBench';
import ColorPickerSheet from '@/components/ColorPickerSheet';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { confirmDestructive, showAppModal } from '@/components/AppModal';
import {
  COLOR_KNOBS,
  CONTROL_KNOBS,
  EMPTY_OVERRIDES,
  SHAPE_KNOBS,
  SLOT_KNOBS,
  clampShape,
  describeCards,
  describeOverrides,
  describePlayground,
  resolveControl,
  resolveShape,
  resolveSlot,
  type ColorGroup,
  type ControlSlot,
  type ShapeOverrides,
  type SlotId,
} from '@/lib/designLab';
import { exportDesignLab, exportDesignLabToDevice, hasSomethingToExport } from '@/lib/designLabExport';
import { useLabDraft } from '@/lib/useDesignLab';
import { FontSize, Fonts, HitSlop, MIN_TAP_TARGET, Radius, Spacing, TabularNums } from '@/constants/theme';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { nowHHMM, todayStr } from '@/lib/date';

type TokenTab = 'color' | 'shape' | 'controls';

/** The order the colour panel draws its groups in — mirrors constants/colors.ts's own. */
const COLOR_GROUP_ORDER: ColorGroup[] = [
  'accent', 'surfaces', 'text', 'borders', 'screens', 'semantic', 'hint', 'identity',
];

// From TabSlider itself since 2026-08-10 — this was 56 against a real 46, the biggest of the
// four hand-copied surpluses. See TAB_SLIDER_HEIGHT's doc.
const TAB_BAR_HEIGHT = TAB_SLIDER_HEIGHT;

export default function DesignLabTokensScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const settings = useSettingsStore();
  const { draft, commit, flush } = useLabDraft();
  const [tab, setTab] = useState<TokenTab>('color');
  const [busy, setBusy] = useState(false);

  // The "before" column of the report, and the swatch a knob starts from. `useAppTheme()` here
  // already carries any APPLIED overrides, so this reads the untouched token straight from the
  // resolved theme when the app-wide switch is off — which is what it re-opens at.
  const changes = useMemo(() => describeOverrides(draft, theme, isDark), [draft, theme, isDark]);
  const cardChanges = useMemo(() => describeCards(draft), [draft]);
  const screenChanges = useMemo(() => describePlayground(draft), [draft]);
  const shape = useMemo(() => resolveShape(draft), [draft]);

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

  const reset = () => {
    confirmDestructive({
      title: t.designLab.title,
      message: t.designLab.reset,
      confirmLabel: t.designLab.resetConfirm,
      onConfirm: () => {
        commit(EMPTY_OVERRIDES);
        flush();
        settings.update({ designLabApply: false });
      },
    });
  };

  const meta = () => ({
    // With the time, so two exports on one day are told apart.
    stamp: `${todayStr()} ${nowHHMM()}`,
    appVersion: String(Constants.expoConfig?.version ?? ''),
    isDark,
  });

  const runExport = async (toDevice: boolean) => {
    // Whatever is still sitting in the debounce has to reach the column before a report is
    // built from it — otherwise the file and the app disagree by up to 400ms of typing.
    flush();
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

  const tabBar = (
    <View style={[styles.tabWrap, { backgroundColor: theme.bg }]}>
      <TabSlider
        attachedTop
        value={tab}
        onChange={setTab}
        options={[
          { value: 'color' as const, label: t.designLab.tabs.color },
          { value: 'shape' as const, label: t.designLab.tabs.shape },
          { value: 'controls' as const, label: t.designLab.tabs.controls },
        ]}
      />
    </View>
  );

  return (
    <ScreenScaffold
      title={t.designLab.tokensTitle}
      tier="sub"
      onBack={() => { flush(); router.back(); }}
      stickyGapColor="transparent"
      stickyBelowHeader={tabBar}
      stickyBelowHeaderHeight={TAB_BAR_HEIGHT}
      headerRight={(
        <PressableScale
          onPress={() => { selection(); settings.update({ darkMode: isDark ? 'off' : 'on' }); }}
          scaleTo={0.9}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={isDark ? t.designLab.preview.light : t.designLab.preview.dark}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.textMuted} />
        </PressableScale>
      )}
    >
      <View style={styles.page}>
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
            {t.designLab.changeCount(changes.length + cardChanges.length + screenChanges.length)}
          </Text>
          <Input
            label={t.designLab.noteLabel}
            placeholder={t.designLab.notePlaceholder}
            value={draft.note}
            onChangeText={(v) => commit({ ...draft, note: v })}
            onBlur={flush}
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
    </ScreenScaffold>
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
 * One colour token: a swatch of what it is now, its raw name, and a way in to change it.
 *
 * The row itself is just the door. It used to BE the editor — a hex field plus a ±8%
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
  // Positioned chrome: the scroll body passes underneath it, so it carries an opaque fill.
  tabWrap: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs, justifyContent: 'center', flex: 1 },
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
