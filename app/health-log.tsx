/**
 * health-log.tsx — sectioned overview of every issue ever logged
 *
 * Sub-screen (Decision 001 tier='sub') listing ALL health-log history, grouped
 * into one section per catalog symptom (predefined + custom) — not windowed
 * to a recent period like app/(tabs)/health.tsx's "This week" card. Tapping a
 * section opens that symptom's full history (app/health-detail.tsx). This is
 * also where new entries are created; the old inline "+ Log symptom" FAB on
 * the Health tab was removed in favour of this screen's add row, mirroring
 * how Tasks/Habits keep "add" on the full-list screen rather than the tab preview.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/EmptyState,
 *             components/Surface, components/PressableScale, lib/i18n,
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
 *   - **Add affordance (2026-07-13 rows pass)**: the shared AddRow (matching Plans/Shopping/
 *     Habits), always visible above the list. Because a symptom log is multi-field (symptom,
 *     severity, date, notes), confirming the row opens app/health-form.tsx prefilled with the
 *     typed name (`name` param) rather than creating a bare inline entry — the "rows" shape
 *     without losing the form's data quality. Replaced the earlier bordered trigger pill
 *     (which itself replaced a duplicate EmptyState button + floating AddFAB).
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
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import { useT } from '@/lib/i18n';
import { severities, severityInk } from '@/lib/severity';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getDomainColor } from '@/lib/domainColor';

export default function HealthLogScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';
  const domainColor = getDomainColor(theme, 'health');
  // Quick-add row: a symptom log is multi-field (severity/date/notes), so typing a name here
  // opens the full form prefilled with it rather than creating a bare entry inline.
  const [draft, setDraft] = React.useState('');

  function startLog() {
    const name = draft.trim();
    router.push({ pathname: '/health-form', params: name ? { name } : {} });
    setDraft('');
  }

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
    <ScreenScaffold title={t.healthLogTitle} tier="sub" onBack={() => router.back()}>
      <View style={styles.content}>
        <HintCard text={t.hints.health.text} />

        {/* Add-symptom affordance (2026-07-13 rows pass): the shared AddRow, matching the
            add-a-row shape used across Plans/Shopping/Habits. A symptom log is multi-field
            (symptom, severity, date, notes), so confirming here opens the full form prefilled
            with the typed name rather than creating a bare inline entry. */}
        <Surface borderColor={domainColor.accent} style={styles.addRowCard}>
          <AddRow
            placeholder={t.logSymptomTrigger}
            value={draft}
            onChangeText={setDraft}
            onSubmit={startLog}
            accent={domainColor.accent}
            confirmIcon="arrow-forward"
            showDivider={false}
            accessibilityLabel={t.logSymptomTrigger}
          />
        </Surface>

        {sections.length === 0 ? (
          <Surface style={styles.emptyCard}>
            <EmptyState title={t.noLogsGentle} />
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
      </View>
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.sm },
  // Inline add-symptom row card (shared AddRow shape).
  addRowCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
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
