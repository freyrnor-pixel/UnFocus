/**
 * HealthIssuesEditor.tsx — the standing list of what you keep an eye on, with a way to add one
 * or stop tracking one.
 *
 * ⚠️ **This was `components/HealthIssuesSheet.tsx` until 2026-09-01, and the change is about the
 * CONTROL, not the content.** The `healthIssues` card opened its fuller surface with an
 * `IconButton icon="open-outline"` at `IconSize.action` (36) passed through `Card`'s `controls`
 * slot — where every other card in the app draws a `CardExpandButton` `expand-outline` at
 * `IconSize.compact` (30), one position further out, with the card's TITLE as a second way in.
 * Different glyph, different size, different slot, and a title that did nothing. Maintainer:
 * *"Helseplager in Health screen has a different button than the fullscreen."*
 *
 * So the card is an ordinary expandable card now and this is its pane body. The registry's old
 * `expandDeclined` reasoning — *"a pane would be a third way to see the same names"* — was
 * correct while the sheet existed and stops holding once it is the pane.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/StarterCard,
 *             components/StarterSuggestionChip, components/AddRow, components/AppModal
 *             (showAppModal), constants/theme, constants/motion (Travel), lib/date
 *             (todayStr, parseDateStr), lib/haptics, lib/i18n, lib/useAppTheme,
 *             lib/symptomSeed (SYMPTOM_SEED — the starter chips), store/useHealthStore
 *   Used by → components/CardExpandHost (the `healthIssues` pane body)
 *   Data    → reads/writes useHealthStore: `ensureSymptom` to add, `setSymptomTracked` to
 *             untrack. Never touches health_logs. Schedules nothing.
 *
 * Edit notes:
 *   - **No `Surface` of its own, no scroll of its own, no title, no dismiss button.** The pane
 *     supplies all four — this follows the same `embedded` contract `NotesSurface` and
 *     `HealthSurface` do, and a Surface inside the pane's Surface is the nested panel the
 *     2026-08-18 blueprint pass banned. That is also why the sheet's "Done" is gone: a pane has
 *     its own close control.
 *   - **"Stop tracking" is not a delete, and the copy must keep saying so.** It flips
 *     `symptoms.tracked` to 0 and leaves every `health_logs` row alone — the history stays
 *     readable in /health-log and on the symptom's own page. Health entries are the rows in this
 *     app that most deserve not to be lost to a tidying gesture. `components/GoalsEditor.tsx`'s
 *     equivalent action genuinely deletes (and unlinks tasks/habits), so do NOT copy its confirm
 *     wording across; the two only look alike. The modal button is deliberately not `destructive`.
 *   - There is no rename. A symptom's id is derived from its name (`sym_<name>`), so renaming
 *     would orphan every entry filed under the old one — the same trap lib/symptomSeed.ts warns
 *     about for seed entries.
 *   - **The starter chips are seed symptoms, and they are NOT translated.** Symptom names are
 *     deliberately Norwegian in every language (lib/symptomSeed.ts's convention, shared with
 *     lib/catalogSeed.ts) — only the chrome around them follows the user's language. Chips are
 *     filtered to ones not already tracked, so the block empties out as it is used.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import StarterCard from '@/components/StarterCard';
import StarterSuggestionChip from '@/components/StarterSuggestionChip';
import AddRow from '@/components/AddRow';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, HitSlop, Spacing, TabularNums } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { parseDateStr, todayStr } from '@/lib/date';
import { tap, success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { SYMPTOM_SEED } from '@/lib/symptomSeed';
import { useHealthStore } from '@/store/useHealthStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** How many seed suggestions the empty state offers. Four, like GOAL_STARTERS. */
const ISSUE_STARTER_CHIPS = 4;

function daysSince(from: string, to: string): number {
  return Math.max(0, Math.floor((parseDateStr(to).getTime() - parseDateStr(from).getTime()) / MS_PER_DAY));
}

type Props = {
  /** Screen hue — the accent for the add row, matching the card this belongs to. */
  accent: string;
};

export default function HealthIssuesEditor({ accent }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const symptoms = useHealthStore((s) => s.symptoms);
  const logs = useHealthStore((s) => s.logs);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);
  const setSymptomTracked = useHealthStore((s) => s.setSymptomTracked);
  const [draft, setDraft] = useState('');

  // One pass for every issue's count + most recent date — same shape as
  // HealthIssuesPreviewList's, and for the same reason (the log reaches 365 days).
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
        .sort((a, b) => (stats.get(b.id)?.last ?? '').localeCompare(stats.get(a.id)?.last ?? '')),
    [symptoms, stats]
  );

  // Seed suggestions the user isn't already tracking — so the block shrinks as it's used
  // rather than offering something already in the list above it.
  const starters = useMemo(() => {
    const trackedNames = new Set(tracked.map((s) => s.name.toLowerCase()));
    return SYMPTOM_SEED.filter((s) => !trackedNames.has(s.name.toLowerCase())).slice(0, ISSUE_STARTER_CHIPS);
  }, [tracked]);

  function commitAdd() {
    const name = draft.trim();
    if (!name) return;
    success();
    ensureSymptom(name);
    setDraft('');
  }

  function addStarter(name: string, category: string) {
    success();
    ensureSymptom(name, category);
  }

  function confirmUntrack(id: string, name: string) {
    tap();
    showAppModal(t.healthIssues.untrackConfirmTitle(name), t.healthIssues.untrackConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      // NOT 'destructive': nothing is destroyed. The entries stay in the health log — see
      // this file's Edit notes.
      { text: t.healthIssues.untrackLabel, onPress: () => setSymptomTracked(id, false) },
    ]);
  }

  const today = todayStr();

  return (
    <View style={styles.root}>
      {/* Said once. With nothing tracked yet the StarterCard below is the teaching surface and
          carries the explanation; once there is a list, the subtitle takes the job back. */}
      {tracked.length > 0 && (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t.healthIssues.subtitle}</Text>
      )}

      {tracked.length === 0 ? (
        <StarterCard text={t.healthIssues.emptyList} collapsible>
          <View style={styles.starterChips}>
            {starters.map((starter) => (
              <StarterSuggestionChip
                key={starter.name}
                label={starter.name}
                icon="medical-outline"
                onAdd={() => addStarter(starter.name, starter.category)}
                addLabel={t.starters.addExample}
              />
            ))}
          </View>
        </StarterCard>
      ) : (
        <View style={styles.list}>
          {tracked.map((symptom) => {
            const stat = stats.get(symptom.id);
            return (
              <Surface key={symptom.id} style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <Ionicons name="medical-outline" size={16} color={theme.textMuted} />
                  <Text style={[styles.issueTitle, { color: theme.text }]}>{symptom.name}</Text>
                  <PressableScale
                    onPress={() => confirmUntrack(symptom.id, symptom.name)}
                    hitSlop={HitSlop.base}
                    travel={Travel.sm}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.healthIssues.untrackLabel} ${symptom.name}`}
                  >
                    <Ionicons name="close-outline" size={18} color={theme.textMuted} />
                  </PressableScale>
                </View>
                {/* No meta line at all for a symptom with no entries yet (2026-08-12 — dropped
                    the "Nothing logged yet" filler). */}
                {stat ? (
                  <Text style={[styles.issueMeta, TabularNums, { color: theme.textMuted }]}>
                    {`${t.healthIssues.entryCount(stat.count)} · ${t.healthIssues.lastLogged(
                      daysSince(stat.last, today)
                    )}`}
                  </Text>
                ) : null}
              </Surface>
            );
          })}
        </View>
      )}

      <AddRow
        value={draft}
        onChangeText={setDraft}
        onSubmit={commitAdd}
        placeholder={t.healthIssues.newPlaceholder}
        accent={accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  subtitle: { fontSize: FontSize.sm },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  list: { gap: Spacing.sm },
  issueCard: { padding: Spacing.sm, gap: Spacing.xs },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  issueTitle: { flex: 1, minWidth: 0, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  issueMeta: { fontSize: FontSize.xs },
});
