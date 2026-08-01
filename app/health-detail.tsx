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
 *             components/EpisodeCloseSheet (closing an ongoing entry from history),
 *             constants/theme (TabularNums), lib/episodes (isOpen, episodeDurationMinutes,
 *             describeDuration), lib/i18n, lib/severity, lib/useAppTheme, store/useHealthStore,
 *             store/useMedicineStore (naming a recorded relief medicine — read-only)
 *   Used by → Expo Router route "/health-detail"; pushed from app/(tabs)/health.tsx and
 *             app/health-log.tsx with params { symptomId, ailment, name }
 *   Data    → useHealthStore.logsForSymptom (read-only; edits happen in app/health-form.tsx).
 *             EpisodeCloseSheet writes through useHealthStore.closeEpisode.
 *
 * Edit notes:
 *   - **This is the ONLY place a duration is rendered** (2026-08-01), and it is always plain
 *     language from lib/episodes.ts's buckets — `About 4 hours`, never `3h 47m`, never a total,
 *     average, minimum, maximum or trend. The underlying data is a wall-clock pair the user
 *     typed from memory; rendering it to the minute implies a precision it does not have.
 *     When it isn't computable (a legacy row, a missing time) the row shows NOTHING — not
 *     "unknown", not "—".
 *   - An ongoing entry shows the word `Ongoing`/`Pågår` in the same slot. **Never a live
 *     count**, no minutes, no "since 09:14", and the row does not animate, pulse or change
 *     colour with age — one appearance, from minute one to day nine. The severity colour is
 *     unchanged either way: openness is not a severity.
 *   - The value column carries `TabularNums` so a mixed column of `Ongoing` / `About 4 hours` /
 *     `Under an hour` stays aligned row to row.
 *   - Relief data (`reliefNote`/`reliefMedicineId`) is shown on the entry's own line only, and
 *     is NEVER aggregated across entries or turned into a claim about what works. See
 *     lib/episodes.ts's header for the full limit before adding anything here.
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
import { useHealthStore, type HealthLog } from '@/store/useHealthStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import EpisodeCloseSheet from '@/components/EpisodeCloseSheet';
import { describeDuration, episodeDurationMinutes, isOpen } from '@/lib/episodes';
import { useT } from '@/lib/i18n';
import { SEVERITY_COLORS, severities, severityInk } from '@/lib/severity';
import { FontSize, Fonts, Radius, Spacing, TabularNums } from '@/constants/theme';
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
  // Read-only: names a recorded relief medicine. Never used to infer anything about it.
  const medicines = useMedicineStore((s) => s.medicines);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  const [closing, setClosing] = React.useState<HealthLog | null>(null);

  const target = { symptomId: symptomId ?? '', ailment: ailment ?? '', name: name || t.unnamedIssue };

  /** The row's one right-hand value: `Ongoing` while it's happening, a plain-language
   *  duration once it's over, and nothing at all when it isn't computable. */
  function valueFor(entry: HealthLog): string | null {
    if (isOpen(entry)) return t.episodes.ongoing;
    const described = describeDuration(episodeDurationMinutes(entry));
    if (!described) return null;
    switch (described.kind) {
      case 'hours':
        return t.episodes.duration.hours(described.n);
      case 'days':
        return t.episodes.duration.days(described.n);
      default:
        return t.episodes.duration[described.kind];
    }
  }

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
          const value = valueFor(e);
          const reliefMedicine = e.reliefMedicineId
            ? medicines.find((m) => m.id === e.reliefMedicineId)
            : undefined;
          return (
            <PressableScale key={e.id} onPress={() => router.push({ pathname: '/health-form', params: { id: e.id } })} scaleTo={0.97}>
              <Surface style={styles.detailEntry}>
                <View style={styles.detailEntryHead}>
                  <Text style={[styles.detailEntryDate, { color: theme.text }]}>{e.date}</Text>
                  <View style={styles.detailEntryHeadRight}>
                    {value ? (
                      <Text
                        style={[styles.detailEntryValue, TabularNums, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {value}
                      </Text>
                    ) : null}
                    <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                      <Text style={[styles.severityBadgeText, { color: severityInk(e.severity) }]}>
                        {severityLabel(e.severity)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                  </View>
                </View>
                {e.notes ? <Text style={[styles.detailEntryNotes, { color: theme.textMuted }]}>{e.notes}</Text> : null}
                {/* What was recorded, shown plainly. Never a claim that it helped. */}
                {e.reliefNote || reliefMedicine ? (
                  <Text style={[styles.detailEntryNotes, { color: theme.textMuted }]}>
                    {[reliefMedicine?.name, e.reliefNote].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {/* Closing from history — the same sheet the tab's prompt opens, so a
                    forgotten episode can be finished wherever it is noticed. */}
                {isOpen(e) && (
                  <PressableScale
                    onPress={() => setClosing(e)}
                    accessibilityRole="button"
                    accessibilityLabel={t.episodes.itsOver}
                    scaleTo={0.97}
                    style={styles.closeRow}
                  >
                    <Text style={[styles.closeRowText, { color: theme.accent }]}>{t.episodes.itsOver}</Text>
                  </PressableScale>
                )}
              </Surface>
            </PressableScale>
          );
        })}
        <View style={{ height: 40 }} />
      </View>

      <EpisodeCloseSheet log={closing} onClose={() => setClosing(null)} />
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
  // Shrinks rather than pushing the date off: the longest NO bucket ("Mesteparten av en dag")
  // is a near-miss against a 360px screen once the severity badge and chevron are counted.
  detailEntryHeadRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
  detailEntryDate: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  // The row's ONE right-hand value — `Ongoing` or a plain-language duration, never a count.
  detailEntryValue: { fontSize: FontSize.xs },
  closeRow: { alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  closeRowText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  detailEntryNotes: { fontSize: FontSize.sm },
  severityBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  severityBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
