/**
 * HealthIssuesSheet.tsx — "Health issues" popup: everything you keep an eye on, and a way to
 * add one or stop tracking one.
 *
 * Opened by pressing the NAME of the "Health issues" drawer at the foot of app/(tabs)/health.tsx
 * — the same two-tap-targets header (chevron previews, name opens) that Goals used to use on
 * Habits and To-do, before Goals dropped its half of that on 2026-08-12 (see
 * components/CollapsedSection.tsx's Edit notes) and became an in-card editor with no popup.
 * This sheet still mirrors the OLD plan components/GoalsSheet.tsx followed before it was
 * deleted: AnimatedBottomSheet shell, a card per row, a StarterCard while the list is empty, an
 * AddRow at the foot, a secondary "Done". Untracking a health issue is deliberately still a
 * pop-up-shaped job here — see the "Untracking deletes NOTHING" edit note below for why this
 * one didn't follow Goals' reversal.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/PressableScale,
 *             components/StarterCard, components/StarterSuggestionChip (2026-08-12 — the
 *             shared empty-state suggestion chip, replacing this file's own copy),
 *             components/AddRow, components/Button,
 *             components/AppModal (showAppModal), constants/theme, constants/motion (Travel),
 *             lib/date (todayStr, parseDateStr), lib/haptics, lib/i18n, lib/useAppTheme,
 *             lib/symptomSeed (SYMPTOM_SEED — the starter chips), store/useHealthStore
 *   Used by → app/(tabs)/health.tsx (the "Health issues" drawer's title)
 *   Data    → reads/writes useHealthStore: `ensureSymptom` to add, `setSymptomTracked` to
 *             untrack. Never touches health_logs. Schedules nothing.
 *
 * Edit notes:
 *   - **"Stop tracking" is not a delete, and the copy must keep saying so.** It flips
 *     `symptoms.tracked` to 0 and leaves every `health_logs` row alone — the history stays
 *     readable in /health-log and on the symptom's own page. Health entries are the rows in
 *     this app that most deserve not to be lost to a tidying gesture. components/GoalsEditor.tsx's
 *     equivalent action genuinely deletes (and unlinks tasks/habits), so do NOT copy its
 *     confirm wording across; the two only look alike.
 *   - There is no rename. A symptom's id is derived from its name (`sym_<name>`), so renaming
 *     would orphan every entry filed under the old one — the same trap lib/symptomSeed.ts's
 *     header warns about for seed entries.
 *   - **The starter chips are seed symptoms, and they are NOT translated.** Symptom names are
 *     deliberately Norwegian in both languages (lib/symptomSeed.ts's convention, shared with
 *     lib/catalogSeed.ts) — only the chrome around them follows the user's language. Chips are
 *     filtered to ones not already tracked, so the block empties out as it is used.
 *   - No severity, no trend, no "this one is getting worse". A row shows a size and a date; see
 *     components/HealthIssuesPreviewList.tsx's matching note and lib/episodes.ts's header for
 *     the standing limit on interpreting health data.
 *   - Decision 044b applies: the shell is AnimatedBottomSheet so it plays a real exit animation.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import StarterCard from '@/components/StarterCard';
import StarterSuggestionChip from '@/components/StarterSuggestionChip';
import AddRow from '@/components/AddRow';
import Button from '@/components/Button';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, HitSlop, Radius, Spacing, TabularNums, Type } from '@/constants/theme';
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
  visible: boolean;
  onClose: () => void;
  /** Screen hue — the accent for the add row, matching the drawer this opened from. */
  accent: string;
};

export default function HealthIssuesSheet({ visible, onClose, accent }: Props) {
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
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.healthIssues.title}</Text>
        {/* Said once. With nothing tracked yet the StarterCard below is the teaching surface
            and carries the explanation; once there is a list, the subtitle takes the job back.
            Same rule GoalsSheet's own subtitle used to follow, before it was deleted
            2026-08-12 — see components/GoalsEditor.tsx, its in-card replacement. */}
        {tracked.length > 0 && (
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t.healthIssues.subtitle}</Text>
        )}

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {tracked.length === 0 ? (
            <StarterCard
              text={t.healthIssues.emptyList}
              collapsible
            >
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
                      {/* No numberOfLines cap, same call GoalsSheet used to make before it was
                          deleted 2026-08-12 — its replacement, components/GoalsEditor.tsx,
                          draws goal rows through PadRow instead, which DOES cap the title at
                          one line (see that file's Edit notes for why). */}
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
                    {/* No meta line at all for a symptom with no entries yet (2026-08-12 —
                        dropped the "Nothing logged yet" filler). */}
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
        </ScrollView>

        {/* Secondary, like GoalsSheet's used to be: dismissing is not this sheet's main
            action. (GoalsEditor has no such button any more — there's nothing to dismiss;
            the drawer just collapses.) */}
        <Button label={t.healthIssues.close} onPress={onClose} variant="secondary" style={styles.doneBtn} />
      </Surface>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  subtitle: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  scroll: { flexGrow: 0 },
  list: { gap: Spacing.sm, marginBottom: Spacing.sm },
  issueCard: { borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  issueTitle: { flex: 1, minWidth: 0, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  issueMeta: { fontSize: FontSize.xs },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  // Button owns its own height, radius, padding and press travel; this only positions it.
  doneBtn: { marginTop: Spacing.xs },
});
