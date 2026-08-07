/**
 * design-lab.tsx — the workbench: turn the app's own design knobs, then send the result on.
 *
 * The app's visual decisions have repeatedly been made by describing a look in prose and
 * waiting an OTA to see the guess. This screen is the other way round: change it here, look at
 * it, and export a document that names every token that moved, what it moved from and to, and
 * where it lives — so the agent applying it edits the real thing instead of interpreting.
 *
 * **Nothing here is a user preference.** It is a scratchpad: off by default behind
 * `settings.featureDesignLab`, resettable in one tap, and opening it never changes the app
 * (the "use these everywhere" switch starts off and is stored off). The output is the file.
 *
 * Connections:
 *   Imports → components/{ScreenScaffold,Surface,Button,ExpandableCard,PressableScale,
 *             DesignLabBench,ColorPickerSheet,FormControls,Stepper,AppModal}, constants/theme,
 *             lib/designLab, lib/designLabExport, lib/useDesignLab, lib/useAppTheme,
 *             lib/i18n, lib/haptics, store/useSettingsStore, expo-constants
 *   Used by → app/settings.tsx (Advanced tab, a SubScreenLinkButton gated on featureDesignLab)
 *   Data    → reads/writes `settings.designLab` + `settings.designLabApply`. Touches nothing
 *             else: no task, habit, note or health row is read or written from this screen.
 *
 * Edit notes:
 *   - **The draft lives in local state and is committed on every change**, the way every other
 *     control in app/settings.tsx applies immediately. There is deliberately no save step —
 *     but the local copy is what the bench previews, so a knob still moves the specimen on a
 *     device where the DB write fails (useSettingsStore.update keeps memory state either way).
 *   - **The knobs themselves are NOT inside the bench's provider.** They render in the app's
 *     own styling on purpose: a maintainer dragging a colour through black must not lose the
 *     control they are dragging. Only components/DesignLabBench.tsx previews the draft.
 *   - Colour is edited per MODE. The screen shows whichever the app is currently in and says
 *     so — light and dark keep separate maps, because a value that works on white rarely works
 *     on navy and one shared field would quietly overwrite the other.
 *   - **A colour row is a door, not an editor (2026-08-07).** It shows the swatch, the raw
 *     token name and whether it has been changed; everything else — the range to pick from,
 *     the hue/strength/lightness sliders, the hex field, the per-token reset — lives in
 *     components/ColorPickerSheet.tsx. Thirty-four rows that each carry their own editor is
 *     what made this panel unreadable, and the ±8% lighten/darken pair it replaced could only
 *     ever answer "a bit darker".
 *   - **A knob's `usedBy`/`source` is EXPORT metadata, not UI copy.** It is English by design
 *     (its reader is an agent) and must not be rendered on screen — an English hint under a
 *     Norwegian label is exactly what the first wrap audit of this screen caught. The panels
 *     show `t.designLab.*` labels; the control panel has its own localized hints. What DOES
 *     render raw is a token name (`accent`) and a variant id (`segmented`), deliberately: those
 *     are the words the exported document uses, and translating them would make the screen and
 *     the report disagree about what was changed. `t.designLab.idNote` says so on screen.
 *   - New knob? It goes in lib/designLab.ts, not here. Every panel below enumerates from that
 *     registry, so a knob added there shows up with its label and range already wired; the only
 *     thing this file needs is the i18n pair, which `no: typeof en` will demand at compile time.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import Stepper from '@/components/Stepper';
import DesignLabBench from '@/components/DesignLabBench';
import ColorPickerSheet from '@/components/ColorPickerSheet';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import {
  COLOR_KNOBS,
  CONTROL_KNOBS,
  EMPTY_OVERRIDES,
  SHAPE_KNOBS,
  SLOT_KNOBS,
  clampShape,
  describeOverrides,
  resolveControl,
  resolveShape,
  resolveSlot,
  type ColorGroup,
  type ControlSlot,
  type LabOverrides,
  type ShapeOverrides,
  type SlotId,
} from '@/lib/designLab';
import { exportDesignLab, exportDesignLabToDevice, hasSomethingToExport } from '@/lib/designLabExport';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing, TabularNums } from '@/constants/theme';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { todayStr } from '@/lib/date';

/** The order the colour panel draws its groups in — mirrors constants/colors.ts's own. */
const COLOR_GROUP_ORDER: ColorGroup[] = [
  'accent', 'surfaces', 'text', 'borders', 'screens', 'semantic', 'hint', 'identity',
];

export default function DesignLabScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const settings = useSettingsStore();
  const [draft, setDraft] = useState<LabOverrides>(settings.designLab);
  const [busy, setBusy] = useState(false);

  // The live palette WITHOUT the draft applied — the "before" column of the report, and the
  // swatch a knob starts from. `useAppTheme()` here already carries any applied overrides, so
  // this reads the untouched token straight from the resolved theme when nothing is applied.
  const changes = useMemo(() => describeOverrides(draft, theme, isDark), [draft, theme, isDark]);
  const shape = useMemo(() => resolveShape(draft), [draft]);

  /** Every write goes through here: local state for the bench, the store for persistence. */
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

  const reset = () => {
    commit(EMPTY_OVERRIDES);
    settings.update({ designLabApply: false });
  };

  const meta = () => ({
    stamp: todayStr(),
    appVersion: String(Constants.expoConfig?.version ?? ''),
    isDark,
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

  return (
    <ScreenScaffold title={t.designLab.title} tier="sub" onBack={() => router.back()}>
      <View style={styles.page}>
        <Text style={[styles.intro, { color: theme.textMuted }]}>{t.designLab.intro}</Text>

        {/* The specimens. First, so the thing being judged is above the thing doing the
            judging — scrolling down to a knob keeps the result in view on the way back up. */}
        <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.benchTitle}</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.benchHint}</Text>
        <DesignLabBench overrides={draft} />

        {/* Apply / reset / export. */}
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
            {t.designLab.changeCount(changes.length)}
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

        {/* ── Colour ─────────────────────────────────────────────────────── */}
        <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.groups.color}</Text>
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

        {/* ── Shape ──────────────────────────────────────────────────────── */}
        <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.groups.shape}</Text>
        <Surface style={styles.card}>
          {SHAPE_KNOBS.map((knob) => (
            <View key={knob.id} style={styles.controlRow}>
              <View style={styles.switchTextCol}>
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t.designLab.shape[knob.id]}</Text>
              </View>
              <Stepper
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

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.groups.controls}</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.idNote}</Text>
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

        {/* ── Slots ──────────────────────────────────────────────────────── */}
        <Text style={[styles.groupHeader, { color: theme.textMuted }]}>{t.designLab.groups.slots}</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.designLab.slotsNote}</Text>
        <Surface style={styles.card}>
          {SLOT_KNOBS.map((knob) => (
            <View key={knob.id} style={styles.stackedRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>{t.designLab.slots[knob.id]}</Text>
              <View style={styles.optionCloud}>
                {knob.options.map((opt) => {
                  const active = resolveSlot(knob.id, draft) === opt;
                  return (
                    <PressableScale
                      key={opt}
                      onPress={() => setSlot(knob.id, opt)}
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
                        {opt}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ))}
        </Surface>

        <View style={{ height: 40 }} />
      </View>
    </ScreenScaffold>
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
  intro: { fontSize: FontSize.sm, fontFamily: Fonts.regular },
  groupHeader: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.md, textTransform: 'uppercase' },
  hint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  card: { padding: Spacing.md, gap: Spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  // flex + minWidth:0 so a long label yields instead of shoving the control off the card.
  switchTextCol: { flex: 1, minWidth: 0, gap: 1 },
  switchLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stackedRow: { gap: Spacing.xs },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  noteInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: Spacing.xs },
  // minHeight, not a fixed one: the whole row is the tap target now that it opens a sheet.
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
