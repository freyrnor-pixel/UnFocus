/**
 * health-detail.tsx — single symptom's full history
 *
 * Sub-screen (Decision 001 tier='sub') showing one symptom's 90-day severity
 * sparkline plus its complete, unlimited entry list (newest-first). Reached by
 * tapping a symptom's row from either app/(tabs)/health.tsx's "This week"
 * overview or app/health-log.tsx's sectioned all-time overview. Each entry
 * row opens app/health-form.tsx to edit or delete that specific log.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/PressableScale,
 *             lib/i18n, lib/severity, lib/useAppTheme, store/useHealthStore
 *   Used by → Expo Router route "/health-detail"; pushed from app/(tabs)/health.tsx and
 *             app/health-log.tsx with params { symptomId, ailment, name }
 *   Data    → useHealthStore.logsForSymptom (read-only; edits happen in app/health-form.tsx)
 *
 * Edit notes:
 *   - This is the same 90-day-sparkline + entry-list view that used to be inline `detail`
 *     state on app/(tabs)/health.tsx — moved to its own route so it can be reached from both
 *     the weekly overview and the new all-time Health-log screen without duplicating it.
 *   - `logsForSymptom` matches by symptomId when present, else falls back to the (lowercased)
 *     ailment string for legacy rows — same convention used everywhere else in Health.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore } from '@/store/useHealthStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { useT } from '@/lib/i18n';
import { SEVERITY_COLORS, severities, severityInk } from '@/lib/severity';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

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

export default function HealthDetailScreen() {
  const router = useRouter();
  const { symptomId, ailment, name } = useLocalSearchParams<{ symptomId?: string; ailment?: string; name?: string }>();
  const logsForSymptom = useHealthStore((s) => s.logsForSymptom);
  const logs = useHealthStore((s) => s.logs);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  const target = { symptomId: symptomId ?? '', ailment: ailment ?? '', name: name || t.unnamedIssue };

  const data = useMemo(() => {
    const entries = logsForSymptom(target.symptomId, target.ailment); // newest-first
    const byDate = new Map<string, number>();
    for (const e of entries) {
      const prev = byDate.get(e.date);
      byDate.set(e.date, prev === undefined ? e.severity : Math.max(prev, e.severity));
    }
    const days = lastNDates(90).map((d) => ({ date: d, sev: byDate.get(d) ?? null }));
    return { entries, days };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.symptomId, target.ailment, logs, logsForSymptom]);

  return (
    <ScreenScaffold title={t.symptomHistoryTitle(target.name)} tier="sub" onBack={() => router.back()}>
      <View style={styles.content}>
        <Text style={[styles.detailSub, { color: theme.textMuted }]}>{t.symptomEntriesCount(data.entries.length)}</Text>

        {/* 90-day severity sparkline */}
        <Surface style={styles.overviewCard}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.last90Days}</Text>
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

        {/* Entry list — tap to edit/delete via health-form */}
        {data.entries.map((e) => {
          const sev = SEVERITIES.find((s) => s.value === e.severity);
          return (
            <PressableScale key={e.id} onPress={() => router.push({ pathname: '/health-form', params: { id: e.id } })} scaleTo={0.97}>
              <Surface style={styles.detailEntry}>
                <View style={styles.detailEntryHead}>
                  <Text style={[styles.detailEntryDate, { color: theme.text }]}>{e.date}</Text>
                  <View style={styles.detailEntryHeadRight}>
                    <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                      <Text style={[styles.severityBadgeText, { color: severityInk(e.severity) }]}>
                        {severityLabel(e.severity)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                  </View>
                </View>
                {e.notes ? <Text style={[styles.detailEntryNotes, { color: theme.textMuted }]}>{e.notes}</Text> : null}
              </Surface>
            </PressableScale>
          );
        })}
        <View style={{ height: 40 }} />
      </View>
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  overviewCard: { borderRadius: Radius.md, padding: Spacing.md },
  sectionLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
  detailSub: { fontSize: FontSize.sm },
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
  detailEntryHeadRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  detailEntryDate: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  detailEntryNotes: { fontSize: FontSize.sm },
  severityBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  severityBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
