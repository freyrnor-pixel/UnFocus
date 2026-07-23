/**
 * health.tsx — health / symptom log (quick-log + this-week overview)
 *
 * Shows only the current Mon–Sun week's symptom activity, grouped by catalog
 * symptom (predefined + custom) with a per-day severity strip. Tapping a
 * symptom's row opens its full history (app/health-detail.tsx). A "Health-log"
 * link opens the sectioned overview of every issue ever logged
 * (app/health-log.tsx), for browsing history or adding a multi-field entry
 * (severity/dates/notes) via app/health-form.tsx.
 *
 * A "Quick log" card above the weekly summary (2026-07-23) lets a symptom be
 * recorded straight from this tab: type a name + optionally pick a severity,
 * it saves instantly (dated today, no notes/times) — no navigation. This
 * reinstates an add affordance on this screen (after an earlier same-day
 * decision removed the old FAB in favour of the dedicated form) but keeps it
 * deliberately essentials-only; the full form stays the place for richer
 * entries and for editing.
 *
 * **Habits moved out (2026-07-23, UX audit finding E1)**: this screen used to also
 * embed a full Habits section (today/week/month views, per-habit cards) below the
 * symptom summary — but "Health" as a tab name/icon only promises symptom tracking,
 * and a whole separate habit-building system living inside it was a name-vs-content
 * mismatch a user had to learn by accident. That section is now app/(tabs)/habits.tsx,
 * its own bottom-nav tab (replacing Scan — see lib/siteNav.ts). This file is purely the
 * symptom-tracking half now.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/Surface,
 *             components/PressableScale, components/DebugNoteAnchor, components/AddRow,
 *             constants/theme, lib/date, lib/i18n, lib/severity, lib/useAppTheme,
 *             lib/useFirstVisitHint, lib/domainColor, lib/screenColor, store/useHealthStore
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore — reads `logs` for the weekly summary, and calls `add()` +
 *             `ensureSymptom()` directly for the Quick log card (full multi-field edit/delete
 *             still lives in app/health-form.tsx)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - "This week" replaces the old "last 30 days" window — grouping/counting/severity-strip
 *     logic is unchanged, just windowed to `getWeekDates(today)` instead of a 30-day cutoff.
 *   - Grouping key is the symptom id when present, else the (lowercased) ailment string for
 *     legacy rows — same convention as health-log.tsx/health-detail.tsx.
 *   - Quick log card: essentials-only (name + severity, dated today, no notes/times) instant
 *     save via useHealthStore's existing add()/ensureSymptom() — no new DB columns. Editing an
 *     entry's times/notes, or the full picker/typeahead, still goes through app/health-form.tsx
 *     (via app/health-detail.tsx or app/health-log.tsx's own AddRow).
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus
 *     effect only closes the hint on blur.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import { useT } from '@/lib/i18n';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { todayStr, getWeekDates } from '@/lib/date';
import { SEVERITY_COLORS, severities, severityInk } from '@/lib/severity';
import { FontSize, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const addLog = useHealthStore((s) => s.add);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);

  const [hintOpen, setHintOpen] = useFirstVisitHint('health');
  const [quickDraft, setQuickDraft] = useState('');
  const [quickSeverity, setQuickSeverity] = useState(3);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const healthDomainColor = getDomainColor(theme, 'health');
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  useFocusEffect(
    useCallback(() => {
      return () => { setHintOpen(false); };
    }, [])
  );

  const today = todayStr();
  const weekDates = getWeekDates(today);

  // Symptoms with at least one entry this week + a per-(symptom,date) max-severity index.
  const { thisWeekSymptoms, severityAt } = useMemo(() => {
    const weekSet = new Set(weekDates);
    const counts: Record<string, { name: string; symptomId: string; ailment: string; count: number }> = {};
    const sevByKey = new Map<string, number>(); // `${groupKey}|${date}` -> max severity
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      if (weekSet.has(l.date)) {
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
      .map(([key, v]) => ({ key, ...v }));
    const severityAt = (key: string, d: string): number | null => sevByKey.get(`${key}|${d}`) ?? null;
    return { thisWeekSymptoms: top, severityAt };
  }, [logs, weekDates]);

  function openDetail(symptomId: string, ailment: string, name: string) {
    router.push({ pathname: '/health-detail', params: { symptomId, ailment, name } });
  }

  function handleQuickLog() {
    const name = quickDraft.trim();
    if (!name) return;
    const sym = ensureSymptom(name);
    addLog({
      date: todayStr(),
      startTime: '',
      endDate: '',
      endTime: '',
      ailment: sym.name,
      symptomId: sym.id,
      severity: quickSeverity,
      notes: '',
    });
    setQuickDraft('');
    setQuickSeverity(3);
  }

  return (
    <>
      <ScreenScaffold
        title={t.healthTitle}
        tier="site"
        bottomNav={false}
        ownBackground={false}
        screenColor={getScreenColor(theme, 'health').base}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
      >
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} open={hintOpen} noPill />

          {/* Quick log — essentials-only instant record (name + severity, dated today). */}
          <DebugNoteAnchor id="health.quickLog" label="Health — Quick log">
          <Surface borderColor={healthDomainColor.accent} style={styles.overviewCardRow}>
            <View style={styles.overviewCardContent}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.quickLogLabel}</Text>
              <AddRow
                placeholder={t.logSymptomTrigger}
                value={quickDraft}
                onChangeText={setQuickDraft}
                onSubmit={handleQuickLog}
                accent={healthDomainColor.accent}
                confirmIcon="checkmark"
                showDivider={false}
                accessibilityLabel={t.logSymptomTrigger}
              />
              {quickDraft.trim().length > 0 && (
                <View style={styles.quickSeverityRow}>
                  <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>{t.severityLabel}</Text>
                  <View style={styles.quickSeverityChips}>
                    {SEVERITIES.map((s) => {
                      const active = quickSeverity === s.value;
                      return (
                        <PressableScale
                          key={s.value}
                          onPress={() => setQuickSeverity(s.value)}
                          style={[
                            styles.quickSevChip,
                            { backgroundColor: s.color },
                            active && { borderColor: theme.text, borderWidth: 2 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={severityLabel(s.value)}
                        >
                          <Text style={[styles.quickSevChipText, { color: severityInk(s.value) }]}>{s.value}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </Surface>
          </DebugNoteAnchor>

          {/* This week — debug notes: one anchor per region (the card, not its inner rows). */}
          <DebugNoteAnchor id="health.overview" label="Health — This week">
          <Surface borderColor={healthDomainColor.accent} style={styles.overviewCardRow}>
            <View style={styles.overviewCardContent}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.thisWeekLabel}</Text>
              {thisWeekSymptoms.length === 0 && (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noLogsThisWeek}</Text>
              )}
              {thisWeekSymptoms.map((s) => {
                const weekSeverities = weekDates.map((d) => severityAt(s.key, d));
                const maxCount = thisWeekSymptoms[0]?.count ?? 1;
                return (
                  <PressableScale
                    key={s.key}
                    style={styles.overviewAilment}
                    onPress={() => openDetail(s.symptomId, s.ailment, s.name)}
                    accessibilityRole="button"
                    accessibilityLabel={t.symptomHistoryTitle(s.name)}
                    scaleTo={0.97}
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
                  </PressableScale>
                );
              })}
              {/* Open full log — folded into the This week card (debug-note 2026-07-21):
                  one consolidated card instead of a separate nav card below. Shown even on
                  an empty week so there's always a clear way into the full log. */}
              <PressableScale
                onPress={() => router.push('/health-log')}
                accessibilityRole="button"
                accessibilityLabel={t.healthLogTitle}
                scaleTo={0.98}
                style={[styles.overviewLogLink, { borderTopColor: theme.border }]}
              >
                <Ionicons name="document-text-outline" size={18} color={healthDomainColor.accent} />
                <Text style={[styles.navCardText, { color: theme.text }]}>{t.healthLogTitle}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </PressableScale>
            </View>
          </Surface>
          </DebugNoteAnchor>

          <View style={{ height: Spacing.xl + Spacing.xxl }} />
        </View>
      </ScreenScaffold>
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md },
  // Decision 043 rule 2: Spacing.xl above every section.
  overviewCardRow: { borderRadius: Radius.md, marginTop: Spacing.xl },
  overviewCardContent: { flex: 1, padding: Spacing.md },
  sectionLabel: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size, marginBottom: Spacing.sm },
  quickSeverityRow: { marginTop: Spacing.sm, gap: Spacing.xs },
  quickSeverityLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  quickSeverityChips: { flexDirection: 'row', gap: Spacing.xs },
  quickSevChip: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quickSevChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
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
  emptyText: { fontSize: FontSize.sm },
  // Health-log link, folded into the foot of the This week card (2026-07-21) — a hairline
  // top border makes it read as a card footer rather than another symptom row.
  overviewLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  navCardText: { flex: 1, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
});
