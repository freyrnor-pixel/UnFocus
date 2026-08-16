/**
 * medicine-form.tsx — add / edit one medicine
 *
 * Sub-screen (Decision 001 tier='sub') behind the Health tab's medicine card: name, dose,
 * which trays it belongs to (or "as needed" with a minimum gap + daily cap instead), who
 * it's for (People/family mode), a note, and an active switch. Presence of an `id` route
 * param switches it into edit mode. Reminders are NOT here — they're per-tray, shared by
 * every medicine in the tray, and edited on the card itself (components/MedicineTrayCard.tsx).
 *
 * In edit mode it also shows the two things a medicine's own page is for: how often it's
 * actually been taken this week, and everything logged as "possibly from" it — the
 * symptom↔medicine correlation ("this ADHD med gives me stomach issues"), with a button to
 * add one right now.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls
 *             (Input/Switch), components/Stepper, components/PressableScale,
 *             components/HintCard, components/OptionalTag,
 *             components/AppModal (delete confirm), constants/theme,
 *             lib/date (todayStr/getWeekDates), lib/haptics, lib/i18n, lib/severity
 *             (side-effect severity dots), lib/useAppTheme, lib/medicineSchedule (TRAY_IDS),
 *             store/useMedicineStore, store/useHealthStore (attributed symptom entries),
 *             store/useSettingsStore (People-mode profiles)
 *   Used by → Expo Router route "/medicine-form"; pushed from components/MedicineTrayCard.tsx
 *             (tapping a medicine's name) with params { id }
 *   Data    → useMedicineStore (medicines) via add/update/remove; reads its `doses` for the
 *             7-day count and useHealthStore.logs for entries whose medicineId matches
 *
 * Edit notes:
 *   - **Field dividers are GONE (2026-08-09); Opt tags stay.** `FieldDivider` hairlines used to
 *     separate each field block; the component is deleted app-wide and `styles.content`'s
 *     `gap: Spacing.lg` does the separating, per the 2026-08-05 card reset.
 *     Dose/For/Notes/the as-needed gap+cap fields carry `OptionalTag`/`optional` —
 *     only Name (and, unless "as needed" is on, the tray picker) actually block save().
 *   - **A medicine must be in at least one tray OR be as-needed** — save is blocked with an
 *     inline error otherwise, because a scheduled medicine in no tray would be invisible on
 *     the card. The store enforces the other half of the invariant (as-needed ⇒ no trays).
 *   - Turning "as needed" ON hides the tray picker rather than clearing it in place; the
 *     store drops the trays on write, so flipping back and forth in one session doesn't
 *     silently lose the picked trays until you actually save.
 *   - Deleting a medicine removes its dose history too (store/useMedicineStore.ts's remove),
 *     but deliberately leaves any attributed symptom entries alone — see useHealthStore's
 *     `medicineId` edit note.
 */
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import Stepper from '@/components/Stepper';
import PressableScale from '@/components/PressableScale';
import HintCard from '@/components/HintCard';
import OptionalTag from '@/components/OptionalTag';
import { confirmDestructive } from '@/components/AppModal';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import { personColor } from '@/lib/personColor';
import { useT } from '@/lib/i18n';
import { getWeekDates, todayStr } from '@/lib/date';
import { tap, warning } from '@/lib/haptics';
import { SEVERITY_COLORS } from '@/lib/severity';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { TRAY_IDS, TrayId } from '@/lib/medicineSchedule';
import { AspectRatio, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

/** Common as-needed gaps, in minutes. 0 = no guard at all. */
const GAP_OPTIONS = [0, 240, 360, 480, 720];

export default function MedicineFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const medicines = useMedicineStore((s) => s.medicines);
  const doses = useMedicineStore((s) => s.doses);
  const addMedicine = useMedicineStore((s) => s.add);
  const updateMedicine = useMedicineStore((s) => s.update);
  const removeMedicine = useMedicineStore((s) => s.remove);
  const healthLogs = useHealthStore((s) => s.logs);
  // People/family is part of the sharing surface that's hidden while the single-user basics
  // are reworked (2026-08-05) — see lib/sharingVisibility.ts. The setting keeps its stored
  // value and every person row stays in the DB, so an existing multi-person setup returns
  // intact when the switch flips back; only the UI stands down.
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled) && SHARING_VISIBLE;
  const people = usePeopleStore((s) => s.people);

  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const existing = isEdit ? medicines.find((m) => m.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [dose, setDose] = useState(existing?.dose ?? '');
  const [trays, setTrays] = useState<TrayId[]>(existing?.trays ?? ['morning']);
  const [asNeeded, setAsNeeded] = useState(existing?.asNeeded ?? false);
  const [minIntervalMin, setMinIntervalMin] = useState(existing?.minIntervalMin ?? 0);
  const [maxPerDay, setMaxPerDay] = useState(existing?.maxPerDay ?? 0);
  const [childName, setChildName] = useState(existing?.childName ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  /** Days in the last 7 with at least one dose — the "is this actually happening?" number. */
  const takenDays = useMemo(() => {
    if (!existing) return 0;
    const week = new Set(getWeekDates(todayStr()));
    const days = new Set(
      doses.filter((d) => d.medicineId === existing.id && week.has(d.date)).map((d) => d.date)
    );
    return days.size;
  }, [doses, existing]);

  /** Symptom entries the user attributed to this medicine, newest-first (logs already are). */
  const attributed = useMemo(
    () => (existing ? healthLogs.filter((l) => l.medicineId === existing.id) : []),
    [healthLogs, existing]
  );

  function toggleTray(tray: TrayId) {
    tap();
    setError(null);
    setTrays((prev) => (prev.includes(tray) ? prev.filter((x) => x !== tray) : [...prev, tray]));
  }

  function save() {
    if (!name.trim()) return;
    if (!asNeeded && trays.length === 0) {
      warning();
      setError(t.medicine.traysRequired);
      return;
    }
    const payload = {
      name: name.trim(),
      dose: dose.trim(),
      trays,
      asNeeded,
      minIntervalMin: asNeeded ? minIntervalMin : 0,
      maxPerDay: asNeeded ? maxPerDay : 0,
      childName,
      notes: notes.trim(),
      active,
    };
    if (isEdit && id) updateMedicine(id, payload);
    else addMedicine(payload);
    router.back();
  }

  function confirmDelete() {
    confirmDestructive({
      title: t.medicine.deleteConfirm,
      confirmLabel: t.deleteConfirmBtn,
      onConfirm: () => {
        if (id) removeMedicine(id);
        router.back();
      },
    });
  }

  const canSave = name.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScreenScaffold
        title={isEdit ? t.medicine.formTitleEdit : t.medicine.formTitleNew}
        tier="sub"
        screenKey="health"
        onBack={() => router.back()}
      >
        <View style={styles.content}>
          <HintCard text={t.hints.medicineForm.text} />

          <View style={styles.field}>
            <Input
              label={t.medicine.nameLabel}
              value={name}
              onChangeText={setName}
              placeholder={t.medicine.namePlaceholder}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Input
              label={t.medicine.doseLabel}
              optional
              value={dose}
              onChangeText={setDose}
              placeholder={t.medicine.dosePlaceholder}
            />
          </View>


          {/* As needed — flips the whole scheduling model, so it sits above the tray picker. */}
          <Surface style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t.medicine.asNeededSwitch}</Text>
            <Switch
              checked={asNeeded}
              onChange={(v) => {
                setAsNeeded(v);
                setError(null);
              }}
            />
          </Surface>


          {asNeeded ? (
            <>
              <Text style={[styles.hint, { color: theme.textMuted }]}>{t.medicine.asNeededHint}</Text>
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.textMuted }]}>{t.medicine.minIntervalLabel}</Text>
                  <OptionalTag />
                </View>
                {/* 2026-08-10: was five accent-filled pills. A fixed five-option exclusive
                    picker with short labels is what SegmentedControl is for; `compact`
                    because it sits inside a form field, not at screen tier. */}
                <SegmentedControl
                  compact
                  value={minIntervalMin}
                  onChange={setMinIntervalMin}
                  options={GAP_OPTIONS.map((min) => ({
                    value: min,
                    label: min === 0 ? t.medicine.minIntervalNone : t.medicine.gapHours(min / 60),
                  }))}
                />
              </View>
              <View style={[styles.field, styles.stepperRow]}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.textMuted }]}>{t.medicine.maxPerDayLabel}</Text>
                  <OptionalTag />
                </View>
                <Stepper value={maxPerDay} onChange={setMaxPerDay} min={0} max={12} accessibilityLabel={t.medicine.maxPerDayLabel} />
              </View>
              <Text style={[styles.hint, { color: theme.textMuted }]}>{t.medicine.maxPerDayPlaceholder}</Text>
            </>
          ) : (
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.medicine.traysLabel}</Text>
              <View style={styles.trayRow}>
                {TRAY_IDS.map((tray) => {
                  const isActive = trays.includes(tray);
                  return (
                    <PressableScale
                      key={tray}
                      style={[
                        styles.trayChip,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                      onPress={() => toggleTray(tray)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      scaleTo={0.97}
                    >
                      <Text
                        style={[styles.trayChipText, { color: theme.text }, isActive && { color: theme.accentInk }]}
                        numberOfLines={1}
                      >
                        {t.medicine.trays[tray]}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: theme.textMuted }]}>{t.medicine.traysHint}</Text>
              {error ? <Text style={[styles.error, { color: theme.bad }]}>{error}</Text> : null}
            </View>
          )}

          {/* For — person assignment (People/family mode), same chips as app/habit-form.tsx.
              Medicines store a NAME, not a person id: they never sync (medicine rows are the
              most sensitive in the DB and are deliberately outside SyncTable), so there is
              no second device that could disagree about who "Sam" is. */}
          {peopleModeEnabled && people.length > 1 && (
            <>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.medicine.personLabel}</Text>
                <OptionalTag />
              </View>
              <View style={styles.chipRow}>
                {people.map((person, index) => {
                  const value = person.isSelf ? '' : person.name;
                  return (
                    <PersonChip
                      key={person.id}
                      label={person.isSelf ? person.name || t.medicine.forMe : person.name}
                      name={person.name}
                      color={personColor(person.color, index)}
                      selected={childName === value}
                      onPress={() => { tap(); setChildName(value); }}
                    />
                  );
                })}
              </View>
            </View>
            </>
          )}


          <View style={styles.field}>
            <Input
              label={t.medicine.notesLabel}
              optional
              value={notes}
              onChangeText={setNotes}
              placeholder={t.medicine.notesPlaceholder}
              multiline
              style={styles.notesInput}
            />
          </View>


          <Surface style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t.medicine.activeLabel}</Text>
            <Switch checked={active} onChange={setActive} />
          </Surface>
          {!active && <Text style={[styles.hint, { color: theme.textMuted }]}>{t.medicine.inactiveHint}</Text>}

          {isEdit && existing && (
            <>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {takenDays > 0 ? t.medicine.takenRecently(takenDays) : t.medicine.takenNeverRecently}
              </Text>

              {/* Symptom↔medicine correlation: what's been noted alongside this one. */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.medicine.sideEffectsLabel}</Text>
                {attributed.length === 0 ? (
                  <Text style={[styles.hint, { color: theme.textMuted }]}>{t.medicine.sideEffectsEmpty}</Text>
                ) : (
                  attributed.slice(0, 8).map((log) => (
                    <PressableScale
                      key={log.id}
                      style={styles.effectRow}
                      onPress={() => router.push({ pathname: '/health-form', params: { id: log.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={log.ailment}
                      scaleTo={0.98}
                    >
                      <View
                        style={[
                          styles.effectDot,
                          { backgroundColor: SEVERITY_COLORS[Math.min(4, Math.max(0, log.severity - 1))] },
                        ]}
                      />
                      <Text style={[styles.effectName, { color: theme.text }]} numberOfLines={1}>
                        {log.ailment}
                      </Text>
                      <Text style={[styles.effectDate, { color: theme.textMuted }]}>{log.date}</Text>
                    </PressableScale>
                  ))
                )}
                <PressableScale
                  style={[styles.linkRow, { borderColor: theme.border }]}
                  onPress={() =>
                    router.push({ pathname: '/health-form', params: { medicineId: existing.id } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t.medicine.logSideEffect}
                  scaleTo={0.98}
                >
                  <Ionicons name="add-circle-outline" size={16} color={theme.accent} />
                  <Text style={[styles.linkText, { color: theme.accent }]}>{t.medicine.logSideEffect}</Text>
                </PressableScale>
              </View>
            </>
          )}

          {/* Bottom actions: Delete (left) · Discard / Save (right) — same row as habit-form. */}
          <View style={styles.bottomActionsRow}>
            {isEdit ? (
              <PressableScale
                style={styles.smallActionBtn}
                onPress={confirmDelete}
                scaleTo={0.93}
                accessibilityRole="button"
                accessibilityLabel={t.deleteConfirmBtn}
              >
                <Ionicons name="trash-outline" size={14} color={theme.bad} />
                <Text style={[styles.smallActionText, { color: theme.bad }]}>{t.deleteConfirmBtn}</Text>
              </PressableScale>
            ) : (
              <View />
            )}
            <View style={styles.bottomActionsRight}>
              <PressableScale
                style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5 }]}
                onPress={() => {
                  tap();
                  router.back();
                }}
                accessibilityRole="button"
                accessibilityLabel={t.taskDiscard}
                scaleTo={0.97}
              >
                <Ionicons name="close" size={14} color={theme.bad} />
                <Text style={[styles.smallActionText, { color: theme.bad }]}>{t.taskDiscard}</Text>
              </PressableScale>
              <PressableScale
                style={[
                  styles.smallActionBtn,
                  {
                    backgroundColor: canSave ? theme.accent : theme.surfaceMuted,
                    borderColor: canSave ? theme.accent : theme.border,
                    borderWidth: 1.5,
                    opacity: canSave ? 1 : 0.7,
                  },
                ]}
                onPress={save}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel={t.taskSave}
                scaleTo={0.97}
              >
                <Ionicons name="checkmark" size={14} color={canSave ? theme.accentInk : theme.textMuted} />
                <Text style={[styles.smallActionText, { color: canSave ? theme.accentInk : theme.textMuted }]}>
                  {t.taskSave}
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </ScreenScaffold>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  flex: { flex: 1 },
  // No paddingTop (2026-08-19): the first card meets the header's glass flush, the way
  // components/ScreenScaffold.tsx now clips every screen. The BOTTOM keeps its margin —
  // this screen reserves no nav, so that edge is the safe area, not chrome.
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  hint: { fontSize: FontSize.xs },
  error: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  switchLabel: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  // `chipRow` still wraps the person picker (unbounded option count → a real chip cloud, and
  // it draws shared `PersonChip`s). `chip`/`chipText` deleted 2026-08-10 with the min-gap
  // picker, which is a `SegmentedControl` now.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  trayRow: { flexDirection: 'row', gap: Spacing.xs },
  trayChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  trayChipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  effectDot: { width: 8, height: 8, borderRadius: Radius.full, aspectRatio: AspectRatio.square },
  effectName: { flex: 1, fontSize: FontSize.sm },
  effectDate: { fontSize: FontSize.xs },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  linkText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  bottomActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomActionsRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  smallActionText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
