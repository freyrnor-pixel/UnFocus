/**
 * health-form.tsx — add / edit a health-log entry
 *
 * Sub-screen (Decision 001 tier='sub') for a single symptom/issue log: Issue (a
 * catalog-backed symptom picker, mirrors the old inline typeahead), Severity
 * (1–5 ramp), When started (backdate shortcuts + date + optional time) and When finished
 * (a Still going / It's over pair, with a date + optional time once it's over), an optional
 * "Possibly from" medicine attribution, and a free-text Note.
 * Structure is copied from app/task-form.tsx (weekRow + collapsible
 * DatePickerCalendar for date entry, checkmark-in-header save, confirm-gated
 * delete) and adapted to symptom logging. Presence of an `id` route param
 * switches it into edit mode.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls,
 *             components/DateChipRow (the Mon–Sun chips + collapsible calendar, extracted from
 *             this file 2026-08-01 so components/EpisodeCloseSheet.tsx could share it),
 *             components/HintCard, components/ConfirmationBanner,
 *             components/Button, components/AppModal, components/PressableScale,
 *             components/FieldDivider, components/OptionalTag,
 *             lib/date, lib/episodes (backdatedStart), lib/haptics, lib/i18n, lib/severity,
 *             lib/useAppTheme, store/useHealthStore,
 *             store/useMedicineStore (the "Possibly from" chip row — read-only)
 *   Used by → Expo Router route "/health-form"; pushed from app/(tabs)/health.tsx's "This week"
 *             rows, app/health-log.tsx's AddRow (passes a `name` param to prefill the Issue
 *             field), and app/health-detail.tsx's entry rows
 *   Data    → useHealthStore (health_logs + symptoms catalog) via add/update/remove/suggest/ensureSymptom;
 *             reads useMedicineStore.medicines to offer the optional `medicineId` attribution
 *
 * Edit notes:
 *   - **Field dividers + Opt tags (2026-07-30)**: a hairline `FieldDivider` now separates each
 *     field block (matching app/settings.tsx's long-standing in-card divider convention), and
 *     Note + "Possibly from" carry `OptionalTag`/`Input`'s `optional` prop since neither is
 *     required to save — only Issue actually blocks save(). `notesLabel`'s old inline
 *     "(optional)" text was dropped from lib/i18n.ts in favour of the tag.
 *   - Picking/typing the Issue field sets both `ailment` (display name) and `symptomId` (stable
 *     trend key), same as the old inline health.tsx editor; a typed name with no picked
 *     suggestion is committed to the catalog via ensureSymptom() on save. A `name` route param
 *     (from the Health-log AddRow) prefills `ailment` for a new entry.
 *   - **"When finished" is a Still going / It's over pair, defaulting to It's over (2026-08-01).**
 *     This replaced an `Ongoing` Switch that defaulted to ON, on the reasoning that most logging
 *     happens afterwards — during it, people are not opening apps. The maintainer ruled on the
 *     flip (EPISODES.md D5) against this file's own former header claim; to reverse it, change
 *     the one `useState` below and the matching default in app/(tabs)/health.tsx's Quick log.
 *   - **Openness is `episodeState`, not `!endDate`.** Editing an entry seeds the control from
 *     the stored state; an old entry with a blank end date is a 'point' entry, not an open one.
 *   - The **backdate shortcuts** under "When started" (Just now / This morning / Last night)
 *     set the date + time fields below them, which stay visible and editable — they are a
 *     shortcut, not a replacement. `Last night` crossing the date boundary is why the
 *     resolution lives in lib/episodes.ts's backdatedStart() rather than inline here.
 *   - The date field is components/DateChipRow.tsx (weekRow + calendar toggle). It was a local
 *     `DateChipPicker` subcomponent here until 2026-08-01; the close sheet needed the same
 *     control, so it moved out verbatim. app/task-form.tsx still has its own inline copy.
 *   - On save a ConfirmationBanner is shown, then navigation is delayed ~900ms so it's visible,
 *     matching task-form.tsx.
 *   - **"Possibly from" (2026-07-27)** sets `medicineId` — the symptom↔medicine correlation.
 *     The whole field is hidden when no medicine exists, and "Not sure" ('') is the default,
 *     so this never becomes a question a user has to answer. A `medicineId` route param
 *     pre-selects it (app/medicine-form.tsx's "note something it caused" button).
 *   - **Keyboard fix (2026-07-31)**: the whole screen is wrapped in a `KeyboardAvoidingView`
 *     (iOS `padding` only — Android already resizes the window via
 *     `windowSoftInputMode=resize`, so a second RN-level shrink would double up and misplace
 *     content, see ScreenScaffold's header note). Fixes the Note field (and Ailment, at the
 *     top) being covered by the keyboard on iOS — this screen was missing the wrapper that
 *     app/habit-form.tsx and app/medicine-form.tsx already have, since ScreenScaffold itself
 *     has no keyboard-avoidance for a plain sub-screen ScrollView.
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHealthStore, Symptom } from '@/store/useHealthStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { backdatedStart, type BackdatePreset } from '@/lib/episodes';
import { tap, warning } from '@/lib/haptics';
import { severities, severityInk } from '@/lib/severity';
import ScreenScaffold from '@/components/ScreenScaffold';
import { Input } from '@/components/FormControls';
import PressableScale from '@/components/PressableScale';
import HintCard from '@/components/HintCard';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import DateChipRow from '@/components/DateChipRow';
import FieldDivider from '@/components/FieldDivider';
import OptionalTag from '@/components/OptionalTag';
import Button from '@/components/Button';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, Radius, Spacing, HitSlop } from '@/constants/theme';

/** The three one-tap start shortcuts, in the order they read as a timeline back from now. */
const BACKDATE_PRESETS: BackdatePreset[] = ['now', 'thisMorning', 'lastNight'];

export default function HealthFormScreen() {
  const router = useRouter();
  const { id, name, medicineId: medicineIdParam } = useLocalSearchParams<{
    id?: string;
    name?: string;
    medicineId?: string;
  }>();
  const logs = useHealthStore((s) => s.logs);
  const medicines = useMedicineStore((s) => s.medicines);
  const addLog = useHealthStore((s) => s.add);
  const updateLog = useHealthStore((s) => s.update);
  const removeLog = useHealthStore((s) => s.remove);
  const suggest = useHealthStore((s) => s.suggest);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  // The post-save banner delays router.back() ~900ms; clear it on unmount so a user who
  // navigates away first doesn't trigger a late back()/setState on an unmounted screen.
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (backTimerRef.current) clearTimeout(backTimerRef.current); }, []);

  const existing = id ? logs.find((log) => log.id === id) : undefined;

  // `name` prefills the Issue field when opened from the Health-log AddRow (quick-add row →
  // full form). Only used for a new entry (no `id`/`existing`).
  const [ailment, setAilment] = useState(existing?.ailment ?? name ?? '');
  const [symptomId, setSymptomId] = useState(existing?.symptomId ?? '');
  const [severity, setSeverity] = useState(existing?.severity ?? 3);
  const [startDate, setStartDate] = useState(existing?.date ?? todayStr());
  const [startTime, setStartTime] = useState(existing?.startTime ?? '');
  // Seeded from the stored STATE, never from `!endDate` — an old entry with a blank end date
  // is a 'point' entry, not an open episode. A new entry defaults to "it's over" (D5).
  const [ongoing, setOngoing] = useState(existing ? existing.episodeState === 'ongoing' : false);
  const [endDate, setEndDate] = useState(existing?.endDate || existing?.date || todayStr());
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  // Symptom↔medicine attribution (2026-07-27). A route param (`medicineId`) pre-selects it
  // when this form is opened from a medicine's "note something it caused" button; otherwise
  // the chip row below is how you pick one. Only rendered when at least one medicine exists.
  const [medicineId, setMedicineId] = useState(existing?.medicineId ?? (medicineIdParam ?? ''));
  const [startCalExpanded, setStartCalExpanded] = useState(false);
  const [endCalExpanded, setEndCalExpanded] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const query = symptomId ? '' : ailment;
  const suggestions = query.trim() ? suggest(query) : [];
  const exactMatch = suggestions.some((x) => x.name.toLowerCase() === query.trim().toLowerCase());

  function handleAilmentText(text: string) {
    setAilment(text);
    setSymptomId('');
  }

  function handlePickSymptom(sym: Symptom) {
    setAilment(sym.name);
    setSymptomId(sym.id);
  }

  function save() {
    if (!ailment.trim()) return;
    let finalAilment = ailment.trim();
    let finalSymptomId = symptomId;
    if (!finalSymptomId) {
      const sym = ensureSymptom(finalAilment);
      finalAilment = sym.name;
      finalSymptomId = sym.id;
    }
    // `episodeState` is the source of truth; the end pair is cleared alongside it so a row is
    // never both open and ended. An entry that was ongoing and is now marked over becomes
    // 'closed'; one that was never ongoing stays a plain 'point' log.
    const wasOngoing = existing?.episodeState === 'ongoing';
    const payload = {
      date: startDate,
      startTime: startTime.trim(),
      endDate: ongoing ? '' : endDate,
      endTime: ongoing ? '' : endTime.trim(),
      ailment: finalAilment,
      symptomId: finalSymptomId,
      severity,
      notes: notes.trim(),
      medicineId,
      episodeState: ongoing ? ('ongoing' as const) : wasOngoing ? ('closed' as const) : ('point' as const),
      reliefNote: existing?.reliefNote ?? '',
      reliefMedicineId: existing?.reliefMedicineId ?? '',
    };
    if (existing) {
      updateLog(existing.id, payload);
    } else {
      addLog(payload);
    }
    setConfirm(t.taskSavedSimple);
    backTimerRef.current = setTimeout(() => router.back(), 900);
  }

  function performDelete() {
    if (existing) removeLog(existing.id);
    router.back();
  }

  function confirmDelete() {
    warning();
    showAppModal(t.deleteConfirmTitle(ailment || t.unnamedIssue), t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteConfirmBtn, style: 'destructive', onPress: performDelete },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
    <ScreenScaffold
      title={existing ? t.editHealthEntryTitle : t.newHealthEntryTitle}
      tier="sub"
      screenKey="health"
      onBack={() => router.back()}
      headerRight={
        <PressableScale onPress={save} hitSlop={HitSlop.base} accessibilityRole="button" accessibilityLabel={t.save} scaleTo={0.9}>
          <Ionicons name="checkmark" size={24} color={theme.accent} />
        </PressableScale>
      }
    >
      <View style={styles.content}>
        <HintCard text={t.hints.health.text} />

        {/* Issue — catalog-backed symptom typeahead */}
        <View style={styles.field}>
          <Input
            label={t.ailmentLabel}
            value={ailment}
            onChangeText={handleAilmentText}
            placeholder={t.symptomSearchPlaceholder}
            returnKeyType="next"
          />
          {suggestions.length > 0 && (
            <View style={[styles.suggestList, { backgroundColor: theme.surfaceMuted }]}>
              {suggestions.map((sug) => (
                <PressableScale
                  key={sug.id}
                  style={[styles.suggestRow, { borderTopColor: theme.border }]}
                  onPress={() => handlePickSymptom(sug)}
                  scaleTo={0.97}
                >
                  <Text style={[styles.suggestName, { color: theme.text }]}>{sug.name}</Text>
                  <Text style={[styles.suggestCat, { color: theme.textMuted }]}>
                    {t.symptomCategories[sug.category] ?? sug.category}
                  </Text>
                </PressableScale>
              ))}
            </View>
          )}
          {query.trim() && !exactMatch && (
            <PressableScale
              style={[styles.addSymptomRow, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => handlePickSymptom(ensureSymptom(query.trim()))}
              scaleTo={0.97}
            >
              <Ionicons name="add" size={16} color={theme.accent} />
              <Text style={[styles.addSymptomText, { color: theme.accent }]}>{t.addSymptomOption(query.trim())}</Text>
            </PressableScale>
          )}
        </View>

        <FieldDivider />

        {/* Severity */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.severityLabel}</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((s) => {
              const active = severity === s.value;
              const fg = severityInk(s.value);
              return (
                <PressableScale
                  key={s.value}
                  style={[
                    styles.severityTarget,
                    { backgroundColor: s.color },
                    active && [styles.severityActive, { borderColor: theme.text }],
                  ]}
                  onPress={() => setSeverity(s.value)}
                >
                  <Text style={[styles.severityNum, { color: fg }]}>{s.value}</Text>
                  <Text style={[styles.severityTargetLabel, { color: fg }]} numberOfLines={1}>
                    {severityLabel(s.value)}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <FieldDivider />

        {/* When started — the backdate shortcuts fill the fields below rather than replacing
            them, so a preset is a head start and everything stays editable. People log after
            the fact; a flow that assumes "now" produces wrong data on the majority path. */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.whenStartedLabel}</Text>
          <View style={styles.chipRow}>
            {BACKDATE_PRESETS.map((preset) => (
              <PressableScale
                key={preset}
                style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => {
                  tap();
                  const resolved = backdatedStart(preset, new Date());
                  setStartDate(resolved.date);
                  setStartTime(resolved.time);
                  setStartCalExpanded(false);
                }}
                accessibilityRole="button"
                scaleTo={0.97}
              >
                <Text style={[styles.chipText, { color: theme.text }]}>{t.episodes.when[preset === 'now' ? 'justNow' : preset]}</Text>
              </PressableScale>
            ))}
          </View>
          <DateChipRow
            value={startDate}
            onChange={setStartDate}
            expanded={startCalExpanded}
            setExpanded={setStartCalExpanded}
          />
          <Input
            value={startTime}
            onChangeText={setStartTime}
            placeholder={t.timeInputPlaceholder}
            keyboardType="numbers-and-punctuation"
            style={styles.timeInput}
          />
        </View>

        <FieldDivider />

        {/* When finished — Still going / It's over, defaulting to It's over. "Still going"
            hides the end fields entirely: an end and an open episode contradict. */}
        <View style={styles.field}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.textMuted }]}>{t.whenFinishedLabel}</Text>
          </View>
          <View style={styles.chipRow}>
            {[
              { open: true, label: t.episodes.stillGoing },
              { open: false, label: t.episodes.itsOver },
            ].map((option) => {
              const active = ongoing === option.open;
              return (
                <PressableScale
                  key={option.label}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    active && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => {
                    tap();
                    setOngoing(option.open);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  scaleTo={0.97}
                >
                  <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                    {option.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          {!ongoing && (
            <>
              <DateChipRow
                value={endDate}
                onChange={setEndDate}
                expanded={endCalExpanded}
                setExpanded={setEndCalExpanded}
              />
              <Input
                value={endTime}
                onChangeText={setEndTime}
                placeholder={t.timeInputPlaceholder}
                keyboardType="numbers-and-punctuation"
                style={styles.timeInput}
              />
            </>
          )}
        </View>

        {/* Possibly from — optional attribution to a medicine (2026-07-27). Hidden entirely
            when no medicine exists, so a user who doesn't use that feature never sees it.
            "Not sure" (medicineId '') is always available and is the default. */}
        {medicines.length > 0 && (
          <>
          <FieldDivider />
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.medicine.attributionLabel}</Text>
              <OptionalTag />
            </View>
            <View style={styles.chipRow}>
              {[{ id: '', name: t.medicine.attributionNone }, ...medicines.filter((m) => m.active)].map((m) => {
                const active = medicineId === m.id;
                return (
                  <PressableScale
                    key={m.id || '__none__'}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      active && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      setMedicineId(m.id);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    scaleTo={0.97}
                  >
                    <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                      {m.name}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
          </>
        )}

        <FieldDivider />

        {/* Note */}
        <View style={styles.field}>
          <Input
            label={t.notesLabel}
            optional
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notesPlaceholder}
            multiline
            style={styles.notesInput}
          />
        </View>

        {existing && (
          <Button label={t.deleteLogBtn} variant="danger" onPress={confirmDelete} style={styles.deleteBtn} />
        )}
      </View>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </ScreenScaffold>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Shared by the "Possibly from" medicine chips, the backdate shortcuts and the
  // Still going / It's over pair — same pill sizing as app/habit-form.tsx's chip rows.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5 },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  timeInput: { marginTop: Spacing.xs },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  suggestList: { marginTop: 4, borderRadius: Radius.sm, overflow: 'hidden' },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  suggestName: { fontSize: FontSize.md },
  suggestCat: { fontSize: FontSize.xs },
  addSymptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  addSymptomText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  severityRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  severityTarget: {
    flex: 1,
    minHeight: 60,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  severityActive: { borderWidth: 2 },
  severityNum: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  severityTargetLabel: { fontSize: 11, fontFamily: Fonts.semibold, textAlign: 'center' },
  deleteBtn: { marginTop: Spacing.md },
});
