/**
 * health.tsx — health / symptom log
 *
 * Logs ailments with a date, 1–5 severity and notes. Shows a last-30-days
 * overview (top ailments by frequency, each with a current-week severity
 * strip) above the chronological log list, plus an inline habits summary.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/ConfirmationBanner,
 *             components/ExpandableCard, components/AddDivider, components/HabitIcon,
 *             components/PressableScale, components/Surface, components/AppModal,
 *             constants/theme, lib/date, lib/db, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useHealthStore, store/useHabitStore, store/useSettingsStore
 *   Used by → Expo Router route "/health" (BottomNav "Health" tab)
 *   Data    → useHealthStore (health_logs, incl. update()); useHabitStore (habits + habit_logs,
 *             read-only inline summary + increment/decrement)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome). ConfirmationBanner + no
 *     FAB; every log gets a leading AddDivider (handleAddLog).
 *   - **Decision 024 — severity ramp:** SEVERITY_COLORS is a fixed purple→blue 5-step data-viz
 *     ramp, deliberately NOT red/green (no alarm connotation) and theme-independent. It is a
 *     documented raw-hex exception to Decision 006 (no token ramp exists); the paired inks
 *     (SEV_INK_DARK/SEV_INK_LIGHT) are fixed for the same reason (the fill is theme-blind, so
 *     its text must be too). The explicit severity affordance is the labelled, colour-filled
 *     `leadingAction` badge on each log card — this is what satisfies Decision 014 (accentColor
 *     now tints only a 4px bar, so severity never relied on it here).
 *   - **Decision 024 — habit colours:** inline habit accent = build → `good`, break → `featTask`.
 *   - Log list is per-log lifted edit state (`edits`/`openIds`) with no durable draft buffer —
 *     a half-edited log commits straight to useHealthStore.update() on Save.
 *   - The date field is a free-text TextInput (no picker) — trusts the YYYY-MM-DD string entered.
 *   - Loads its stores on focus; initDb() is idempotent, guarded by a module flag.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import HabitIcon from '@/components/HabitIcon';
import PressableScale from '@/components/PressableScale';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import AddDivider from '@/components/AddDivider';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { initDb } from '@/lib/db';
import { todayStr, getWeekDates } from '@/lib/date';
import { FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { warning } from '@/lib/haptics';

// Decision 024: fixed purple→blue severity family, theme-independent, NOT red/green (no alarm).
// Documented raw-hex exception to Decision 006 — no token ramp exists.
const SEVERITY_COLORS = ['#C9D4F0', '#A9B8E8', '#8C9AE0', '#7C82D6', '#6E6BC8'];
// Fixed inks paired with the fixed ramp (fill is theme-blind, so its text must be too).
const SEV_INK_DARK = '#2A2A3A';
const SEV_INK_LIGHT = '#FFFFFF';

let dbBootstrapped = false;

function severities() {
  return SEVERITY_COLORS.map((color, i) => ({ value: i + 1, color }));
}

type HealthEditFields = { date: string; ailment: string; severity: number; notes: string };
type HealthEditState = { fields: HealthEditFields; dirty: boolean };

function fieldsFromLog(log: HealthLog): HealthEditFields {
  return { date: log.date, ailment: log.ailment, severity: log.severity, notes: log.notes };
}

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const add = useHealthStore((s) => s.add);
  const update = useHealthStore((s) => s.update);
  const remove = useHealthStore((s) => s.remove);
  const loadLogs = useHealthStore((s) => s.load);
  const allHabits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const loadHabits = useHabitStore((s) => s.load);
  const incrementHabit = useHabitStore((s) => s.increment);
  const decrementHabit = useHabitStore((s) => s.decrement);
  const loadSettings = useSettingsStore((s) => s.load);
  const habits = allHabits.filter((h) => h.childName === '');

  const [edits, setEdits] = useState<Record<string, HealthEditState>>({});
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadLogs();
      loadHabits();
    }, [loadSettings, loadLogs, loadHabits])
  );

  const today = todayStr();
  const weekDates = getWeekDates(today);

  function ensureEdit(logId: string) {
    if (edits[logId]) return;
    const log = logs.find((l) => l.id === logId);
    if (!log) return;
    setEdits((prev) => ({ ...prev, [logId]: { fields: fieldsFromLog(log), dirty: false } }));
  }

  function toggleOpen(logId: string) {
    const wasOpen = !!openIds[logId];
    if (!wasOpen) ensureEdit(logId);
    setOpenIds((prev) => ({ ...prev, [logId]: !wasOpen }));
  }

  function handleFieldChange<K extends keyof HealthEditFields>(logId: string, field: K, value: HealthEditFields[K]) {
    setEdits((prev) => {
      const edit = prev[logId];
      if (!edit) return prev;
      return { ...prev, [logId]: { fields: { ...edit.fields, [field]: value }, dirty: true } };
    });
  }

  function handleSave(logId: string) {
    const edit = edits[logId];
    if (!edit) return;
    update(logId, edit.fields);
    setEdits((prev) => ({ ...prev, [logId]: { fields: edit.fields, dirty: false } }));
    setConfirm(t.taskSavedSimple);
  }

  function handleDelete(logId: string) {
    remove(logId);
    setEdits((prev) => {
      const next = { ...prev };
      delete next[logId];
      return next;
    });
    setOpenIds((prev) => {
      const next = { ...prev };
      delete next[logId];
      return next;
    });
  }

  function confirmDelete(logId: string, ailment: string) {
    warning();
    showAppModal(t.deleteConfirmTitle(ailment || t.ailmentPlaceholder), t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteConfirmBtn, style: 'destructive', onPress: () => handleDelete(logId) },
    ]);
  }

  function handleAddLog() {
    const log = add({ date: todayStr(), ailment: '', severity: 2, notes: '' });
    setEdits((prev) => ({ ...prev, [log.id]: { fields: fieldsFromLog(log), dirty: false } }));
    setOpenIds((prev) => ({ ...prev, [log.id]: true }));
  }

  // Top ailments over the last 30 days + a per-(ailment,date) max-severity index, in one pass.
  const { topAilments, severityAt } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const counts: Record<string, number> = {};
    const sevByKey = new Map<string, number>(); // `${ailment}|${date}` -> max severity
    for (const l of logs) {
      if (new Date(l.date) >= cutoff) {
        counts[l.ailment] = (counts[l.ailment] ?? 0) + 1;
      }
      const key = `${l.ailment}|${l.date}`;
      const prev = sevByKey.get(key);
      sevByKey.set(key, prev === undefined ? l.severity : Math.max(prev, l.severity));
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const severityAt = (ailment: string, d: string): number | null =>
      sevByKey.get(`${ailment}|${d}`) ?? null;
    return { topAilments: top, severityAt };
  }, [logs]);

  return (
    <>
      <ScreenScaffold title={t.healthTitle} tier="site">
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} example={t.hints.health.example} />

          {/* Overview */}
          {topAilments.length > 0 && (
            <Surface style={styles.overviewCard}>
              <View style={[styles.sectionLabelBox, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.last30Days}</Text>
              </View>
              {topAilments.map(([name, count]) => {
                const weekSeverities = weekDates.map((d) => severityAt(name, d));
                return (
                  <View key={name} style={styles.overviewAilment}>
                    <View style={styles.overviewRow}>
                      <Text style={[styles.overviewName, { color: theme.text }]}>{name}</Text>
                      <View style={[styles.overviewBar, { backgroundColor: theme.surfaceMuted }]}>
                        <View
                          style={[
                            styles.overviewFill,
                            { backgroundColor: SEVERITY_COLORS[2], width: `${Math.min((count / (topAilments[0]?.[1] ?? 1)) * 100, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.overviewCount, { color: theme.textMuted }]}>{count}×</Text>
                    </View>
                    <View style={styles.ailmentWeekStrip}>
                      {weekDates.map((d, i) => {
                        const sev = weekSeverities[i];
                        const sevColor = sev ? (SEVERITIES.find((s) => s.value === sev)?.color ?? theme.border) : 'transparent';
                        const isFuture = d > today;
                        return (
                          <View key={d} style={styles.ailmentDotCol}>
                            <Text style={[styles.ailmentDayAbbr, { color: theme.textMuted }]}>{t.dayLabels[i][0]}</Text>
                            <View style={[
                              styles.ailmentDot,
                              {
                                backgroundColor: sev ? sevColor : 'transparent',
                                borderColor: isFuture ? theme.border : (sev ? sevColor : theme.border),
                                opacity: isFuture ? 0.3 : 1,
                              },
                            ]} />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </Surface>
          )}

          {/* Log list */}
          <View style={[styles.sectionLabelBox, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.logSection}</Text>
          </View>
          {logs.length === 0 && (
            <>
              <Surface tint={theme.surfaceMuted} style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noLogsGentle}</Text>
              </Surface>
              <AddDivider onPress={handleAddLog} />
            </>
          )}
          {logs.map((log) => {
            const sev = SEVERITIES.find((s) => s.value === log.severity);
            const fields = edits[log.id]?.fields ?? fieldsFromLog(log);
            return (
              <React.Fragment key={log.id}>
                <AddDivider onPress={handleAddLog} />
                <ExpandableCard
                  title={log.ailment || t.ailmentPlaceholder}
                  open={!!openIds[log.id]}
                  onToggle={() => toggleOpen(log.id)}
                  leadingAction={
                    <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                      <Text style={[styles.severityBadgeText, { color: log.severity >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK }]}>
                        {severityLabel(log.severity)}
                      </Text>
                    </View>
                  }
                >
                  <View style={styles.fieldsWrap}>
                    <View style={styles.field}>
                      <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.dateLabel}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                        value={fields.date}
                        onChangeText={(v) => handleFieldChange(log.id, 'date', v)}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.ailmentLabel}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                        value={fields.ailment}
                        onChangeText={(v) => handleFieldChange(log.id, 'ailment', v)}
                        placeholder={t.ailmentPlaceholder}
                        placeholderTextColor={theme.textMuted}
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.severityLabel}</Text>
                      {/* 5 large, clearly-labelled tap targets (not a slider). Stored value is 1–5. */}
                      <View style={styles.severityRow}>
                        {SEVERITIES.map((s) => {
                          const active = fields.severity === s.value;
                          const fg = s.value >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK;
                          return (
                            <PressableScale
                              key={s.value}
                              style={[
                                styles.severityTarget,
                                { backgroundColor: s.color },
                                active && [styles.severityActive, { borderColor: theme.text }],
                              ]}
                              onPress={() => handleFieldChange(log.id, 'severity', s.value)}
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

                    <View style={styles.field}>
                      <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.notesLabel}</Text>
                      <TextInput
                        style={[styles.input, styles.notesInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                        value={fields.notes}
                        onChangeText={(v) => handleFieldChange(log.id, 'notes', v)}
                        placeholder={t.notesPlaceholder}
                        placeholderTextColor={theme.textMuted}
                        multiline
                      />
                    </View>

                    {edits[log.id]?.dirty ? (
                      <Pressable style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={() => handleSave(log.id)}>
                        <Text style={[styles.saveBtnText, { color: theme.accentInk }]}>{t.save}</Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      style={[styles.deleteBtn, { backgroundColor: theme.badSoft }]}
                      onPress={() => confirmDelete(log.id, fields.ailment)}
                    >
                      <Text style={[styles.deleteBtnText, { color: theme.bad }]}>{t.deleteLogBtn}</Text>
                    </Pressable>
                  </View>
                </ExpandableCard>
              </React.Fragment>
            );
          })}

          {/* Habits */}
          <View style={styles.section}>
            <Pressable
              onPress={() => router.push('/habits')}
              accessibilityRole="button"
              accessibilityLabel={t.healthSeeAllHabits}
              style={styles.sectionHeader}
            >
              <View style={[styles.sectionLabelBox, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted, marginBottom: 0 }]}>{t.nav.habits}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>

            {habits.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
            ) : (
              habits.map((habit) => {
                const log = habitLogs.find((l) => l.habitId === habit.id && l.logDate === today);
                const count = log?.count ?? 0;
                const accent = habit.kind === 'break' ? theme.featTask : theme.good;
                return (
                  <ExpandableCard
                    key={habit.id}
                    title={habit.title}
                    leadingAction={<HabitIcon icon={habit.icon} size={20} color={accent} />}
                    onToggle={() => {}}
                    open={false}
                  >
                    <View style={styles.habitCardContent}>
                      <View style={styles.habitDetailRow}>
                        <Text style={[styles.habitLabel, { color: theme.textMuted }]}>{t.habitCue}</Text>
                        <Text style={[styles.habitValue, { color: theme.text }]}>
                          {habit.cue || t.notSet}
                        </Text>
                      </View>

                      {habit.notificationTimes && habit.notificationTimes.length > 0 && (
                        <View style={styles.habitDetailRow}>
                          <Text style={[styles.habitLabel, { color: theme.textMuted }]}>{t.reminders}</Text>
                          <Text style={[styles.habitValue, { color: theme.text }]}>
                            {habit.notificationTimes.join(', ')}
                          </Text>
                        </View>
                      )}

                      {habit.recurrence && (
                        <View style={styles.habitDetailRow}>
                          <Text style={[styles.habitLabel, { color: theme.textMuted }]}>{t.frequency}</Text>
                          <Text style={[styles.habitValue, { color: theme.text }]}>
                            {habit.recurrence}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.habitCountRow, { borderTopColor: theme.border }]}>
                        <Text style={[styles.habitCount, { color: theme.textMuted }]}>Today: {count}/{habit.dailyGoal}</Text>
                        <View style={styles.habitAdjustments}>
                          <Pressable
                            style={[styles.adjBtn, { backgroundColor: theme.surfaceMuted }]}
                            onPress={() => decrementHabit(habit.id, today)}
                            hitSlop={8}
                          >
                            <Text style={[styles.adjBtnText, { color: theme.textMuted }]}>−</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.adjBtn, { backgroundColor: accent }]}
                            onPress={() => incrementHabit(habit.id, today)}
                            hitSlop={8}
                          >
                            <Text style={[styles.adjBtnPlusText, { color: theme.accentInk }]}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </ExpandableCard>
                );
              })
            )}

            <Pressable
              onPress={() => router.push('/habit-form')}
              style={styles.addButtonIcon}
              accessibilityLabel={t.healthAddHabit}
            >
              <Ionicons name="add-circle-outline" size={24} color={theme.accent} />
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScreenScaffold>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  overviewCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  sectionLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
  sectionLabelBox: { borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  overviewAilment: { marginTop: Spacing.sm },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ailmentWeekStrip: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
    paddingLeft: 2,
  },
  ailmentDotCol: { alignItems: 'center', gap: 2 },
  ailmentDayAbbr: { fontSize: 7, fontFamily: Fonts.semibold },
  ailmentDot: { width: 9, height: 9, borderRadius: Radius.full, borderWidth: 1.5 },
  overviewName: { fontSize: FontSize.sm, width: 100 },
  overviewBar: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  overviewFill: { height: 8, borderRadius: Radius.full },
  overviewCount: { fontSize: FontSize.xs, width: 28, textAlign: 'right' },
  fieldsWrap: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  formLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  input: {
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    marginTop: 4,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
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
  saveBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  deleteBtn: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  deleteBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  emptyCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  emptyText: { fontSize: FontSize.sm },
  severityBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  severityBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  section: { gap: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  habitCardContent: {
    gap: Spacing.md,
  },
  habitDetailRow: {
    gap: Spacing.xs,
  },
  habitLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  habitValue: {
    fontSize: FontSize.sm,
  },
  habitCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  habitCount: { fontSize: FontSize.sm },
  habitAdjustments: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  adjBtn: {
    width: 26, height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnText: { fontSize: FontSize.md, lineHeight: 26 },
  adjBtnPlusText: { fontSize: FontSize.md, fontFamily: Fonts.bold, lineHeight: 26 },
  addButtonIcon: {
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
