/**
 * HealthIssuesPreviewList.tsx — the read-only issue list shown inside a "Health issues" drawer.
 *
 * One row per tracked issue: how many entries it has, and when it was last logged. Nothing here
 * edits anything — adding and untracking live in components/HealthIssuesEditor.tsx, which the
 * drawer's title opens.
 *
 * Was the direct counterpart of components/GoalsPreviewList.tsx, and deliberately built from
 * the same two primitives (PadSheet + PadRow) so the Goals drawer on Habits and the Health
 * issues drawer on Health were the same object with different rows in it. **That symmetry
 * broke on 2026-08-12**, when Goals' drawer stopped being a read-only preview onto a popup:
 * GoalsPreviewList.tsx is deleted and components/GoalsEditor.tsx — a full add/edit/delete
 * editor, no popup — replaced it. This file is unchanged and still reads exactly like the OLD
 * GoalsPreviewList shape (PadSheet + PadRow rows, a popup opened elsewhere) — the maintainer's
 * ask was specifically about Goals, not Health issues, so untracking here stays a pop-up job.
 *
 * Connections:
 *   Imports → components/PadSheet, components/PadRow, constants/theme,
 *             lib/date (todayStr, parseDateStr), lib/i18n, lib/useAppTheme, store/useHealthStore
 *   Used by → app/(tabs)/health.tsx — inside a components/CollapsedSection.tsx
 *             "Health issues" drawer
 *   Data    → reads useHealthStore only. Schedules nothing, writes nothing.
 *
 * Edit notes:
 *   - **The list is `tracked`, never the whole `symptoms` table.** The catalog is 36 seeded
 *     names that power the typeahead (lib/symptomSeed.ts); a drawer opening onto all of them
 *     would be a vocabulary list, not "the things you keep an eye on". See
 *     store/useHealthStore.ts's `tracked` doc.
 *   - **A row opens that issue's own page** (app/health-detail.tsx), not the sheet — a goal has
 *     no per-goal screen, so components/GoalsEditor.tsx's rows lead nowhere (they just display,
 *     with delete as their ⋯ action), while an issue has a real history view worth reaching.
 *     The sheet is still one tap away on the drawer's title.
 *   - **No severity, no trend, no "worse than last week".** A row carries a size (how many
 *     entries) and a date, and nothing that evaluates them. The same limit lib/episodes.ts
 *     documents for relief data: displayed, never interpreted.
 *   - **A quiet issue is not congratulated and an active one is not flagged.** There is
 *     deliberately no third band here the way components/GoalsEditor.tsx has three strength
 *     bands — a goal's momentum is something the user drives, a symptom is not.
 *   - The empty state is the quiet inset line, the same shape app/plans.tsx uses for an
 *     empty section. It lives HERE rather than at the call site so this drawer and
 *     components/HealthIssuesEditor.tsx's own empty state can't drift apart — the same reason
 *     the now-deleted GoalsPreviewList.tsx kept its empty state in one place before Goals
 *     dropped its popup entirely.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { parseDateStr, todayStr } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useHealthStore } from '@/store/useHealthStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to`, both YYYY-MM-DD. Never negative — a stray future-dated
 *  entry reads as "today" rather than as "in -2 days". */
function daysSince(from: string, to: string): number {
  const ms = parseDateStr(to).getTime() - parseDateStr(from).getTime();
  return Math.max(0, Math.floor(ms / MS_PER_DAY));
}

export default function HealthIssuesPreviewList({
  accent,
  onOpenIssue,
}: {
  accent: string;
  /** Push that issue's own history page. */
  onOpenIssue: (symptomId: string, ailment: string, name: string) => void;
}) {
  const t = useT();
  const theme = useAppTheme();
  const symptoms = useHealthStore((s) => s.symptoms);
  const logs = useHealthStore((s) => s.logs);

  // One pass over the log for every tracked issue's count + most recent date, rather than a
  // filter per row: the log reaches 365 days and this renders inside a drawer that may sit on
  // a screen with several other lists.
  const stats = useMemo(() => {
    const byId = new Map<string, { count: number; last: string }>();
    for (const l of logs) {
      if (!l.symptomId) continue;
      const prev = byId.get(l.symptomId);
      if (prev) {
        prev.count += 1;
        if (l.date > prev.last) prev.last = l.date;
      } else {
        byId.set(l.symptomId, { count: 1, last: l.date });
      }
    }
    return byId;
  }, [logs]);

  const tracked = useMemo(
    () =>
      symptoms
        .filter((s) => s.tracked)
        // Most recently logged first — the same "a quick way back into whatever's been going
        // on lately" ordering app/health-log.tsx uses, not alphabetical. An issue with no
        // entries at all (just added by hand in the sheet) sorts last, which is where a thing
        // you have not logged yet belongs.
        .sort((a, b) => (stats.get(b.id)?.last ?? '').localeCompare(stats.get(a.id)?.last ?? '')),
    [symptoms, stats]
  );

  if (tracked.length === 0) {
    return (
      <Text
        style={[
          styles.empty,
          { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        {t.healthIssues.emptyList}
      </Text>
    );
  }

  const today = todayStr();

  return (
    <PadSheet state="open">
      {tracked.map((symptom) => {
        const stat = stats.get(symptom.id);
        return (
          <PadRow
            key={symptom.id}
            title={symptom.name}
            accent={accent}
            rightValue={stat ? String(stat.count) : undefined}
            onPress={() => onOpenIssue(symptom.id, symptom.name, symptom.name)}
            // No meta line at all for a symptom with no entries yet (2026-08-12 — dropped the
            // "Nothing logged yet" filler; the row's title and empty right-hand count already
            // say that).
            meta={
              stat ? (
                <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
                  {`${t.healthIssues.entryCount(stat.count)} · ${t.healthIssues.lastLogged(
                    daysSince(stat.last, today)
                  )}`}
                </Text>
              ) : undefined
            }
          />
        );
      })}
    </PadSheet>
  );
}

const styles = StyleSheet.create({
  // The same quiet inset line app/plans.tsx draws for an empty section (`sectionEmpty`).
  empty: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  meta: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
});
