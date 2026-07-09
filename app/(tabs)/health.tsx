/**
 * health.tsx — health / symptom log (this-week overview)
 *
 * Shows only the current Mon–Sun week's symptom activity, grouped by catalog
 * symptom (predefined + custom) with a per-day severity strip. Tapping a
 * symptom's row opens its full history (app/health-detail.tsx). A "Health-log"
 * link opens the sectioned overview of every issue ever logged
 * (app/health-log.tsx), which is also where new entries are added — this
 * screen itself has no add affordance (Decision: the old inline "+ Log
 * symptom" FAB + editable card list were removed in favour of a dedicated
 * form, mirroring Tasks/Habits).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/Surface,
 *             constants/theme, lib/date, lib/db, lib/i18n, lib/severity, lib/useAppTheme,
 *             store/useHealthStore, store/useSettingsStore
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore (health_logs + symptoms catalog, read-only here — add/edit/delete
 *             now live in app/health-form.tsx)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - "This week" replaces the old "last 30 days" window — grouping/counting/severity-strip
 *     logic is unchanged, just windowed to `getWeekDates(today)` instead of a 30-day cutoff.
 *   - Grouping key is the symptom id when present, else the (lowercased) ailment string for
 *     legacy rows — same convention as health-log.tsx/health-detail.tsx.
 *   - Add/edit/delete + the per-symptom 90-day history view were extracted to
 *     app/health-form.tsx and app/health-detail.tsx respectively (previously inline state
 *     on this screen) so this screen is a pure read-only weekly summary.
 *   - Loads its store on focus; initDb() is idempotent, guarded by a module flag.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import Surface from '@/components/Surface';
import { useT } from '@/lib/i18n';
import { initDb } from '@/lib/db';
import { todayStr, getWeekDates } from '@/lib/date';
import { SEVERITY_COLORS, severities } from '@/lib/severity';
import { FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

let dbBootstrapped = false;

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const loadLogs = useHealthStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);

  const [hintOpen, setHintOpen] = useState(false);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadLogs();
      return () => setHintOpen(false);
    }, [loadSettings, loadLogs])
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

  return (
    <>
      <ScreenScaffold title={t.healthTitle} tier="site" bottomNav={false} ownBackground={false} infoActive={hintOpen} onInfoToggle={() => setHintOpen((v) => !v)}>
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} open={hintOpen} noPill />

          {/* This week */}
          <Surface style={styles.overviewCardRow}>
            <View style={[styles.overviewAccent, { backgroundColor: theme.featHealth }]} />
            <View style={styles.overviewCardContent}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.thisWeekLabel}</Text>
              {thisWeekSymptoms.length === 0 && (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noLogsThisWeek}</Text>
              )}
              {thisWeekSymptoms.map((s) => {
                const weekSeverities = weekDates.map((d) => severityAt(s.key, d));
                const maxCount = thisWeekSymptoms[0]?.count ?? 1;
                return (
                  <Pressable
                    key={s.key}
                    style={styles.overviewAilment}
                    onPress={() => openDetail(s.symptomId, s.ailment, s.name)}
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
            </View>
          </Surface>

          {/* Health-log — sectioned overview of every issue ever logged, and where new entries are added */}
          <Pressable
            onPress={() => router.push('/health-log')}
            accessibilityRole="button"
            accessibilityLabel={t.healthLogTitle}
            style={[styles.navLink, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.navLinkText, { color: theme.text }]}>{t.healthLogTitle}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          {/* Entry point to the Habits screen (no longer embedded — Logg is health-only). */}
          <Pressable
            onPress={() => router.push('/habits')}
            accessibilityRole="button"
            accessibilityLabel={t.healthSeeAllHabits}
            style={[styles.navLink, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.navLinkText, { color: theme.text }]}>{t.nav.habits}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          <View style={{ height: 80 }} />
        </View>
      </ScreenScaffold>
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  overviewCardRow: { borderRadius: Radius.md, flexDirection: 'row' },
  overviewAccent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  overviewCardContent: { flex: 1, padding: Spacing.md },
  sectionLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
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
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  navLinkText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
});
