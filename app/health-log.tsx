/**
 * health-log.tsx — sectioned overview of every issue ever logged
 *
 * Sub-screen (Decision 001 tier='sub') listing ALL health-log history, grouped
 * into one section per catalog symptom (predefined + custom) — not windowed
 * to a recent period like app/(tabs)/health.tsx's "This week" card. Tapping a
 * section opens that symptom's full history (app/health-detail.tsx). This is
 * also where new entries are created; the old inline "+ Log symptom" FAB on
 * the Health tab was removed in favour of this screen's AddFAB, mirroring how
 * Tasks/Habits keep "add" on the full-list screen rather than the tab preview.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/EmptyState,
 *             components/Surface, components/AddFAB, components/PressableScale, lib/i18n,
 *             lib/severity, lib/useAppTheme, store/useHealthStore
 *   Note    → store hydration happens once at startup in app/_layout.tsx; this screen has
 *             no per-screen focus-load
 *   Used by → Expo Router route "/health-log"; pushed from app/(tabs)/health.tsx's
 *             "Health-log" link
 *   Data    → useHealthStore.logs (read-only; add/edit/delete happen in app/health-form.tsx)
 *
 * Edit notes:
 *   - Grouping key is the symptom id when present, else the (lowercased) ailment string for
 *     legacy rows — same convention as app/(tabs)/health.tsx and app/health-detail.tsx.
 *   - Sections are sorted by most recent activity (last logged date, newest first), not name
 *     or count — the point is a quick way back into whatever's been going on lately, same
 *     spirit as the old flat newest-first log list this screen replaces.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import EmptyState from '@/components/EmptyState';
import Surface from '@/components/Surface';
import AddFAB from '@/components/AddFAB';
import PressableScale from '@/components/PressableScale';
import { useT } from '@/lib/i18n';
import { severities, severityInk } from '@/lib/severity';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

export default function HealthLogScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  const sections = useMemo(() => {
    const groups: Record<string, {
      key: string; name: string; symptomId: string; ailment: string;
      count: number; lastDate: string; lastSeverity: number;
    }> = {};
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      const g = groups[key];
      if (!g || l.date >= g.lastDate) {
        groups[key] = {
          key,
          name: l.ailment || t.unnamedIssue,
          symptomId: l.symptomId,
          ailment: l.ailment,
          count: (g?.count ?? 0) + 1,
          lastDate: l.date,
          lastSeverity: l.severity,
        };
      } else {
        g.count += 1;
      }
    }
    return Object.values(groups).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [logs, t.unnamedIssue]);

  function openDetail(section: (typeof sections)[number]) {
    router.push({
      pathname: '/health-detail',
      params: { symptomId: section.symptomId, ailment: section.ailment, name: section.name },
    });
  }

  return (
    <>
      <ScreenScaffold title={t.healthLogTitle} tier="sub" onBack={() => router.back()}>
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} />

          {sections.length === 0 ? (
            <Surface style={styles.emptyCard}>
              <EmptyState
                title={t.noLogsGentle}
                action={{ label: t.logSymptomTrigger, onPress: () => router.push('/health-form') }}
              />
            </Surface>
          ) : (
            sections.map((s) => {
              const sev = SEVERITIES.find((x) => x.value === s.lastSeverity);
              return (
                <PressableScale key={s.key} onPress={() => openDetail(s)} scaleTo={0.97}>
                  <Surface style={styles.sectionRow}>
                    <View style={styles.sectionInfo}>
                      <Text style={[styles.sectionName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[styles.sectionMeta, { color: theme.textMuted }]}>
                        {t.symptomEntriesCount(s.count)} · {s.lastDate}
                      </Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                      <Text style={[styles.severityBadgeText, { color: severityInk(s.lastSeverity) }]}>
                        {severityLabel(s.lastSeverity)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                  </Surface>
                </PressableScale>
              );
            })
          )}

          <View style={{ height: 80 }} />
        </View>
      </ScreenScaffold>

      <AddFAB onPress={() => router.push('/health-form')} accessibilityLabel={t.logSymptomTrigger} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.sm },
  emptyCard: { borderRadius: Radius.md, padding: Spacing.md },
  sectionRow: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionInfo: { flex: 1, gap: 2 },
  sectionName: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  sectionMeta: { fontSize: FontSize.xs },
  severityBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  severityBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
