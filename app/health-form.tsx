/**
 * health-form.tsx — add / edit a health-log entry
 *
 * Sub-screen (Decision 001 tier='sub') for a single symptom/issue log: Issue (a
 * catalog-backed symptom picker, mirrors the old inline typeahead), Severity
 * (1–5 ramp), When started (date + optional time) and When finished (Ongoing
 * switch, or a date + optional time once resolved), and a free-text Note.
 * Structure is copied from app/task-form.tsx (weekRow + collapsible
 * DatePickerCalendar for date entry, checkmark-in-header save, confirm-gated
 * delete) and adapted to symptom logging. Presence of an `id` route param
 * switches it into edit mode.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls,
 *             components/HintCard, components/ConfirmationBanner, components/DatePickerCalendar,
 *             components/IconButton, components/Button, components/AppModal,
 *             lib/date, lib/haptics, lib/i18n, lib/severity, lib/useAppTheme, store/useHealthStore
 *   Used by → Expo Router route "/health-form"; pushed from app/(tabs)/health.tsx's "This week"
 *             rows, app/health-log.tsx's AddFAB, and app/health-detail.tsx's entry rows
 *   Data    → useHealthStore (health_logs + symptoms catalog) via add/update/remove/suggest/ensureSymptom
 *
 * Edit notes:
 *   - Picking/typing the Issue field sets both `ailment` (display name) and `symptomId` (stable
 *     trend key), same as the old inline health.tsx editor; a typed name with no picked
 *     suggestion is committed to the catalog via ensureSymptom() on save.
 *   - "When finished" defaults to Ongoing (endDate stays '') for a new entry — most symptoms are
 *     logged while still happening. Editing an entry whose endDate is already set starts with
 *     Ongoing off.
 *   - DateChipPicker is a small local subcomponent (weekRow + calendar toggle, copied from
 *     task-form.tsx's inline date UI) shared by the start/end date fields.
 *   - On save a ConfirmationBanner is shown, then navigation is delayed ~900ms so it's visible,
 *     matching task-form.tsx.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHealthStore, Symptom } from '@/store/useHealthStore';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, dayOfWeekMon0 } from '@/lib/date';
import { tap, warning } from '@/lib/haptics';
import { severities, severityInk } from '@/lib/severity';
import ScreenScaffold from '@/components/ScreenScaffold';
import { Input, Switch } from '@/components/FormControls';
import PressableScale from '@/components/PressableScale';
import HintCard from '@/components/HintCard';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import Button from '@/components/Button';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

/** Mon–Sun quick-pick row + collapsible full calendar — copied from task-form.tsx. */
function DateChipPicker({
  value, onChange, expanded, setExpanded,
}: {
  value: string; onChange: (d: string) => void; expanded: boolean; setExpanded: (v: boolean) => void;
}) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const { dayLabels } = t;

  const weekDays = useMemo(() => {
    const today = new Date();
    const mon0 = dayOfWeekMon0(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - mon0 + i);
      return { value: dateStr(d), dayIdx: i, dayNum: d.getDate() };
    });
  }, []);

  return (
    <>
      <View style={styles.weekRow}>
        {weekDays.map((wd) => {
          const active = value === wd.value;
          return (
            <Pressable
              key={wd.value}
              style={[
                styles.weekChip,
                { backgroundColor: theme.surfaceMuted },
                active && { backgroundColor: theme.accent },
              ]}
              onPress={() => {
                tap();
                onChange(wd.value);
                setExpanded(false);
              }}
            >
              <Text style={[styles.weekChipDay, { color: theme.textMuted }, active && { color: theme.accentInk }]}>
                {dayLabels[wd.dayIdx].slice(0, 2)}
              </Text>
              <Text
                style={[
                  styles.weekChipNum,
                  { color: theme.text },
                  active && { color: theme.accentInk, fontWeight: '700' },
                ]}
              >
                {wd.dayNum}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <IconButton
        icon="calendar-outline"
        label={expanded ? t.hideCalendar : t.pickOtherDate(value)}
        active={expanded}
        style={styles.calToggleBtn}
        onPress={() => {
          tap();
          setExpanded(!expanded);
        }}
      />
      {expanded && (
        <DatePickerCalendar
          value={value}
          onChange={(d) => {
            onChange(d);
            setExpanded(false);
          }}
          dayLabels={t.dayLabels}
          monthLabels={t.months}
          calendarLabels={t.calendar}
        />
      )}
    </>
  );
}

export default function HealthFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const logs = useHealthStore((s) => s.logs);
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

  const existing = id ? logs.find((log) => log.id === id) : undefined;

  const [ailment, setAilment] = useState(existing?.ailment ?? '');
  const [symptomId, setSymptomId] = useState(existing?.symptomId ?? '');
  const [severity, setSeverity] = useState(existing?.severity ?? 3);
  const [startDate, setStartDate] = useState(existing?.date ?? todayStr());
  const [startTime, setStartTime] = useState(existing?.startTime ?? '');
  const [ongoing, setOngoing] = useState(existing ? !existing.endDate : true);
  const [endDate, setEndDate] = useState(existing?.endDate || existing?.date || todayStr());
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
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
    const payload = {
      date: startDate,
      startTime: startTime.trim(),
      endDate: ongoing ? '' : endDate,
      endTime: ongoing ? '' : endTime.trim(),
      ailment: finalAilment,
      symptomId: finalSymptomId,
      severity,
      notes: notes.trim(),
    };
    if (existing) {
      updateLog(existing.id, payload);
    } else {
      addLog(payload);
    }
    setConfirm(t.taskSavedSimple);
    setTimeout(() => router.back(), 900);
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
    <ScreenScaffold
      title={existing ? t.editHealthEntryTitle : t.newHealthEntryTitle}
      tier="sub"
      onBack={() => router.back()}
      headerRight={
        <Pressable onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.save}>
          <Ionicons name="checkmark" size={24} color={theme.accent} />
        </Pressable>
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
                <Pressable
                  key={sug.id}
                  style={[styles.suggestRow, { borderTopColor: theme.border }]}
                  onPress={() => handlePickSymptom(sug)}
                >
                  <Text style={[styles.suggestName, { color: theme.text }]}>{sug.name}</Text>
                  <Text style={[styles.suggestCat, { color: theme.textMuted }]}>
                    {t.symptomCategories[sug.category] ?? sug.category}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {query.trim() && !exactMatch && (
            <Pressable
              style={[styles.addSymptomRow, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => handlePickSymptom(ensureSymptom(query.trim()))}
            >
              <Ionicons name="add" size={16} color={theme.accent} />
              <Text style={[styles.addSymptomText, { color: theme.accent }]}>{t.addSymptomOption(query.trim())}</Text>
            </Pressable>
          )}
        </View>

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

        {/* When started */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.whenStartedLabel}</Text>
          <DateChipPicker
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

        {/* When finished */}
        <View style={styles.field}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.textMuted }]}>{t.whenFinishedLabel}</Text>
          </View>
          <View style={styles.ongoingRow}>
            <Text style={[styles.ongoingLabel, { color: theme.text }]}>{t.ongoingLabel}</Text>
            <Switch checked={ongoing} onChange={setOngoing} />
          </View>
          {!ongoing && (
            <>
              <DateChipPicker
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

        {/* Note */}
        <View style={styles.field}>
          <Input
            label={t.notesLabel}
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
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -Spacing.xs,
  },
  ongoingLabel: { fontSize: FontSize.sm },
  weekRow: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  weekChip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', gap: 2 },
  weekChipDay: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  weekChipNum: { fontSize: FontSize.sm },
  calToggleBtn: { alignSelf: 'flex-start' },
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
