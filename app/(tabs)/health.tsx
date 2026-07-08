/**
 * health.tsx — health / symptom log
 *
 * Logs symptoms with a date, 1–5 severity and notes, each linked to a catalog
 * symptom (predefined + custom) so trend review groups by symptom rather than
 * free text. Shows a last-30-days overview (top symptoms by frequency, each with a
 * current-week severity strip); tapping a symptom opens its own 90-day history.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/ConfirmationBanner,
 *             components/ExpandableCard, components/AddFAB, components/PressableScale,
 *             components/Surface, components/AppModal,
 *             constants/theme, lib/date, lib/db, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useHealthStore, store/useSettingsStore
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore (health_logs + symptoms catalog, incl. add/update/suggest/ensureSymptom)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome). ConfirmationBanner + a single
 *     AddFAB (handleAddLog) — the only "add" affordance on this screen, matching Tasks/Home.
 *     Habits are NOT embedded here anymore (they live on /habits); "Logg" is health-only.
 *   - **Decision 024 — severity ramp:** SEVERITY_COLORS is a fixed purple→blue 5-step data-viz
 *     ramp, deliberately NOT red/green (no alarm connotation) and theme-independent. Documented
 *     raw-hex exception to Decision 006; paired inks (SEV_INK_DARK/SEV_INK_LIGHT) are fixed too.
 *   - Symptom field is a catalog picker (typeahead over useHealthStore.suggest() + recent chips);
 *     picking/creating sets both `ailment` (display name) and `symptomId` (stable trend key).
 *   - Log list is per-log lifted edit state (`edits`/`openIds`) with no durable draft buffer —
 *     a half-edited log commits straight to useHealthStore.update() on Save.
 *   - `detail` state swaps the whole content for a single-symptom 90-day history + entry list.
 *   - The date field is a free-text TextInput (no picker) — trusts the YYYY-MM-DD string entered.
 *   - Loads its store on focus; initDb() is idempotent, guarded by a module flag.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog, Symptom } from '@/store/useHealthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import PressableScale from '@/components/PressableScale';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import AddFAB from '@/components/AddFAB';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { initDb } from '@/lib/db';
import { todayStr, getWeekDates } from '@/lib/date';
import { FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { warning } from '@/lib/haptics';

// Decision 024: fixed purple→blue severity family, theme-independent, NOT red/green (no alarm).
const SEVERITY_COLORS = ['#C9D4F0', '#A9B8E8', '#8C9AE0', '#7C82D6', '#6E6BC8'];
const SEV_INK_DARK = '#2A2A3A';
const SEV_INK_LIGHT = '#FFFFFF';

let dbBootstrapped = false;

function severities() {
  return SEVERITY_COLORS.map((color, i) => ({ value: i + 1, color }));
}

type HealthEditFields = { date: string; ailment: string; symptomId: string; severity: number; notes: string };
type HealthEditState = { fields: HealthEditFields; dirty: boolean };
type DetailTarget = { symptomId: string; ailment: string; name: string };

function fieldsFromLog(log: HealthLog): HealthEditFields {
  return { date: log.date, ailment: log.ailment, symptomId: log.symptomId, severity: log.severity, notes: log.notes };
}

/** Last N calendar dates (oldest→newest) as YYYY-MM-DD, for the history sparkline. */
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const cur = new Date(d);
    cur.setDate(d.getDate() - i);
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const add = useHealthStore((s) => s.add);
  const update = useHealthStore((s) => s.update);
  const remove = useHealthStore((s) => s.remove);
  const loadLogs = useHealthStore((s) => s.load);
  const suggest = useHealthStore((s) => s.suggest);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);
  const logsForSymptom = useHealthStore((s) => s.logsForSymptom);
  const loadSettings = useSettingsStore((s) => s.load);

  const [edits, setEdits] = useState<Record<string, HealthEditState>>({});
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
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
      return () => { setHintOpen(false); setDetail(null); };
    }, [loadSettings, loadLogs])
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

  /** Picking/typing a symptom sets both the display name and the stable trend key. */
  function handleSymptomText(logId: string, text: string) {
    setEdits((prev) => {
      const edit = prev[logId];
      if (!edit) return prev;
      // Free typing clears the catalog link until a suggestion/new symptom is committed.
      return { ...prev, [logId]: { fields: { ...edit.fields, ailment: text, symptomId: '' }, dirty: true } };
    });
  }

  function handlePickSymptom(logId: string, sym: Symptom) {
    setEdits((prev) => {
      const edit = prev[logId];
      if (!edit) return prev;
      return { ...prev, [logId]: { fields: { ...edit.fields, ailment: sym.name, symptomId: sym.id }, dirty: true } };
    });
  }

  function handleSave(logId: string) {
    const edit = edits[logId];
    if (!edit) return;
    let fields = edit.fields;
    // Commit the symptom to the catalog if the user typed a new name without picking a suggestion.
    if (fields.ailment.trim() && !fields.symptomId) {
      const sym = ensureSymptom(fields.ailment.trim());
      fields = { ...fields, ailment: sym.name, symptomId: sym.id };
    }
    update(logId, fields);
    setEdits((prev) => ({ ...prev, [logId]: { fields, dirty: false } }));
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
    const log = add({ date: todayStr(), ailment: '', symptomId: '', severity: 2, notes: '' });
    setEdits((prev) => ({ ...prev, [log.id]: { fields: fieldsFromLog(log), dirty: false } }));
    setOpenIds((prev) => ({ ...prev, [log.id]: true }));
  }

  // Top symptoms over the last 30 days + a per-(symptom,date) max-severity index, in one pass.
  // Grouping key is the symptom id when present, else the (lowercased) ailment string for legacy rows.
  const { topSymptoms, severityAt } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const counts: Record<string, { name: string; symptomId: string; ailment: string; count: number }> = {};
    const sevByKey = new Map<string, number>(); // `${groupKey}|${date}` -> max severity
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      if (new Date(l.date) >= cutoff) {
        const entry = counts[key] ?? { name: l.ailment, symptomId: l.symptomId, ailment: l.ailment, count: 0 };
        entry.count += 1;
        counts[key] = entry;
      }
      const sk = `${key}|${l.date}`;
      const prev = sevByKey.get(sk);
      sevByKey.set(sk, prev === undefined ? l.severity : Math.max(prev, l.severity));
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, v]) => ({ key, ...v }));
    const severityAt = (key: string, d: string): number | null => sevByKey.get(`${key}|${d}`) ?? null;
    return { topSymptoms: top, severityAt };
  }, [logs]);

  // ---- Per-symptom history (detail view) ----
  const detailData = useMemo(() => {
    if (!detail) return null;
    const entries = logsForSymptom(detail.symptomId, detail.ailment); // newest-first
    const byDate = new Map<string, number>();
    for (const e of entries) {
      const prev = byDate.get(e.date);
      byDate.set(e.date, prev === undefined ? e.severity : Math.max(prev, e.severity));
    }
    const days = lastNDates(90).map((d) => ({ date: d, sev: byDate.get(d) ?? null }));
    return { entries, days };
  }, [detail, logs, logsForSymptom]);

  function renderDetail(d: DetailTarget) {
    const data = detailData;
    if (!data) return null;
    return (
      <View style={styles.content}>
        <Pressable onPress={() => setDetail(null)} style={styles.backRow} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={theme.accent} />
          <Text style={[styles.backText, { color: theme.accent }]}>{t.backToLog}</Text>
        </Pressable>

        <Text style={[styles.detailTitle, { color: theme.text }]}>{t.symptomHistoryTitle(d.name)}</Text>
        <Text style={[styles.detailSub, { color: theme.textMuted }]}>{t.symptomEntriesCount(data.entries.length)}</Text>

        {/* 90-day severity sparkline */}
        <Surface style={styles.overviewCard}>
          <View style={[styles.sectionLabelBox, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.last90Days}</Text>
          </View>
          <View style={styles.sparkRow}>
            {data.days.map((day) => {
              const color = day.sev ? SEVERITY_COLORS[day.sev - 1] : 'transparent';
              const h = day.sev ? 6 + day.sev * 6 : 3;
              return (
                <View
                  key={day.date}
                  style={[
                    styles.sparkBar,
                    { height: h, backgroundColor: day.sev ? color : theme.surfaceMuted },
                  ]}
                />
              );
            })}
          </View>
        </Surface>

        {/* Entry list */}
        {data.entries.map((e) => {
          const sev = SEVERITIES.find((s) => s.value === e.severity);
          return (
            <Surface key={e.id} style={styles.detailEntry}>
              <View style={styles.detailEntryHead}>
                <Text style={[styles.detailEntryDate, { color: theme.text }]}>{e.date}</Text>
                <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                  <Text style={[styles.severityBadgeText, { color: e.severity >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK }]}>
                    {severityLabel(e.severity)}
                  </Text>
                </View>
              </View>
              {e.notes ? <Text style={[styles.detailEntryNotes, { color: theme.textMuted }]}>{e.notes}</Text> : null}
            </Surface>
          );
        })}
        <View style={{ height: 40 }} />
      </View>
    );
  }

  return (
    <>
      <ScreenScaffold title={t.healthTitle} tier="site" bottomNav={false} ownBackground={false} infoActive={hintOpen} onInfoToggle={() => setHintOpen((v) => !v)}>
        {detail ? renderDetail(detail) : (
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} open={hintOpen} noPill />
          {/* Overview */}
          {topSymptoms.length > 0 && (
            <Surface style={styles.overviewCard}>
              <View style={[styles.sectionLabelBox, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.last30Days}</Text>
              </View>
              {topSymptoms.map((s) => {
                const weekSeverities = weekDates.map((d) => severityAt(s.key, d));
                const maxCount = topSymptoms[0]?.count ?? 1;
                return (
                  <Pressable
                    key={s.key}
                    style={styles.overviewAilment}
                    onPress={() => setDetail({ symptomId: s.symptomId, ailment: s.ailment, name: s.name })}
                    accessibilityRole="button"
                    accessibilityLabel={t.symptomHistoryTitle(s.name)}
                  >
                    <View style={styles.overviewRow}>
                      <Text style={[styles.overviewName, { color: theme.text }]}>{s.name}</Text>
                      <View style={[styles.overviewBar, { backgroundColor: theme.surfaceMuted }]}>
                        <View
                          style={[
                            styles.overviewFill,
                            { backgroundColor: SEVERITY_COLORS[2], width: `${Math.min((s.count / maxCount) * 100, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.overviewCount, { color: theme.textMuted }]}>{s.count}×</Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                    </View>
                    <View style={styles.ailmentWeekStrip}>
                      {weekDates.map((d, i) => {
                        const sev = weekSeverities[i];
                        const sevColor = sev ? (SEVERITIES.find((x) => x.value === sev)?.color ?? theme.border) : 'transparent';
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
                  </Pressable>
                );
              })}
            </Surface>
          )}

          {/* Log list */}
          <View style={[styles.sectionLabelBox, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.logSection}</Text>
          </View>
          {logs.length === 0 && (
            <Surface tint={theme.surfaceMuted} style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noLogsGentle}</Text>
            </Surface>
          )}
          {logs.map((log) => {
            const sev = SEVERITIES.find((s) => s.value === log.severity);
            const fields = edits[log.id]?.fields ?? fieldsFromLog(log);
            const query = fields.symptomId ? '' : fields.ailment;
            const suggestions = query.trim() ? suggest(query) : [];
            const exactMatch = suggestions.some((x) => x.name.toLowerCase() === query.trim().toLowerCase());
            return (
              <ExpandableCard
                key={log.id}
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
                      onChangeText={(v) => handleSymptomText(log.id, v)}
                      placeholder={t.symptomSearchPlaceholder}
                      placeholderTextColor={theme.textMuted}
                    />
                    {/* Typeahead over the catalog + "Add new" when no exact match */}
                    {suggestions.length > 0 && (
                      <View style={styles.suggestList}>
                        {suggestions.map((sug) => (
                          <Pressable
                            key={sug.id}
                            style={[styles.suggestRow, { borderTopColor: theme.border }]}
                            onPress={() => handlePickSymptom(log.id, sug)}
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
                        onPress={() => handlePickSymptom(log.id, ensureSymptom(query.trim()))}
                      >
                        <Ionicons name="add" size={16} color={theme.accent} />
                        <Text style={[styles.addSymptomText, { color: theme.accent }]}>{t.addSymptomOption(query.trim())}</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.severityLabel}</Text>
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
            );
          })}

          {/* Entry point to the Habits screen (no longer embedded — Logg is health-only). */}
          <Pressable
            onPress={() => router.push('/habits')}
            accessibilityRole="button"
            accessibilityLabel={t.healthSeeAllHabits}
            style={[styles.habitsLink, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.habitsLinkText, { color: theme.text }]}>{t.nav.habits}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          <View style={{ height: 80 }} />
        </View>
        )}
      </ScreenScaffold>

      {!detail && <AddFAB onPress={handleAddLog} accessibilityLabel={t.logSymptomTrigger} />}
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
  // Detail (per-symptom history)
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  detailTitle: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  detailSub: { fontSize: FontSize.sm, marginTop: -Spacing.xs },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    marginTop: Spacing.sm,
    minHeight: 40,
  },
  sparkBar: { flex: 1, borderRadius: 1 },
  detailEntry: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  detailEntryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailEntryDate: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  detailEntryNotes: { fontSize: FontSize.sm },
  habitsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  habitsLinkText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
});
