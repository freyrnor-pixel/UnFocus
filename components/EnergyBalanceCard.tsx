/**
 * EnergyBalanceCard.tsx — is the load actually shared? (2026-07-28, sharing phase 3).
 *
 * One bar per person, filled to how committed they are AS A FRACTION OF THEIR OWN stated
 * Energy capacity (lib/personEnergy.ts). Sits on the To-do tab under the filter rows, and
 * only when People mode has someone to compare against.
 *
 * **It compares pressure, not point totals.** Ranking the household by raw energy carried
 * would punish whoever set an honest, lower capacity — and per-person capacity exists
 * precisely because people differ. Two people at the same bar length can be carrying very
 * different absolute loads; that is the intended reading, not a rounding artefact.
 *
 * **It never says anyone is doing too little.** The card names the person carrying the most
 * and offers to move something, and otherwise says the load looks shared. There is no
 * "you're behind" state, on purpose — same no-shame framing as habits' rest days and the
 * medicine trays' "still due" (AGENTS.md).
 *
 * Connections:
 *   Imports → components/Surface, components/ProgressBar, components/PersonChip (PersonDot),
 *             components/TabSlider, constants/theme, lib/personColor, lib/personEnergy,
 *             lib/i18n, lib/useAppTheme, lib/haptics, store/usePeopleStore,
 *             store/useTaskStore, store/useHabitStore
 *   Used by → app/(tabs)/plans.tsx
 *   Data    → reads only; no writes. Capacity is edited on the self row in Settings, since
 *             lib/liveSync's LWW can't tell "I corrected mine" from "I overwrote yours"
 *             (see store/usePeopleStore.ts's "Only edit your OWN capacity" note).
 *
 * Edit notes:
 *   - A person with their own paired phone is marked `tasksOnly` — their habits live on
 *     that phone and habits don't sync, so their bar is a FLOOR. Say so in the row rather
 *     than rendering a confidently wrong total; a silent under-count here would make the
 *     card's one job (fairness) actively misleading.
 *   - Bars use each person's identity hue as a fill, which is legitimate — it's a bar, not
 *     a card border. See lib/personColor.ts's three-channel rule before extending this.
 *   - Over-committed (>1) draws in `theme.warn`, which OVERRIDES the identity hue. Status
 *     beats identity when they compete; that's the same precedence the task rows use.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import ProgressBar from '@/components/ProgressBar';
import { PersonDot } from '@/components/PersonChip';
import TabSlider from '@/components/TabSlider';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { personColor } from '@/lib/personColor';
import { householdEnergy, energyImbalance, type EnergyPeriod } from '@/lib/personEnergy';
import { useT } from '@/lib/i18n';
import { selection } from '@/lib/haptics';
import { useAppTheme } from '@/lib/useAppTheme';
import { usePeopleStore } from '@/store/usePeopleStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';

/**
 * How lopsided the household has to be before the card says so. Below this the bars are
 * still there to read — the sentence just doesn't editorialise. 0.25 = a quarter of a
 * capacity apart, which is roughly "one real chore" for a typical daily capacity.
 */
const IMBALANCE_THRESHOLD = 0.25;

type Props = {
  /** The day whose day/week the card reports on. */
  date: string;
};

export default function EnergyBalanceCard({ date }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const people = usePeopleStore((s) => s.people);
  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const [period, setPeriod] = useState<EnergyPeriod>('day');

  const rows = useMemo(
    () => householdEnergy(date, period, people, tasks, habits, habitLogs),
    [date, period, people, tasks, habits, habitLogs],
  );
  const imbalance = energyImbalance(rows);
  // rows is sorted most-committed first, so the heaviest person is simply the first —
  // but only worth naming if anything is actually booked against them.
  const heaviest = rows[0]?.pressure > 0 ? rows[0] : null;
  const lopsided = imbalance >= IMBALANCE_THRESHOLD && heaviest;

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="scale-outline" size={16} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>{t.energyBalance.title}</Text>
        </View>
        <TabSlider<EnergyPeriod>
          options={[
            { value: 'day', label: t.energyBalance.day },
            { value: 'week', label: t.energyBalance.week },
          ]}
          value={period}
          onChange={(k) => {
            selection();
            setPeriod(k);
          }}
        />
      </View>

      {rows.map((row) => {
        const person = people.find((p) => p.id === row.personId);
        if (!person) return null;
        const hue = personColor(person.color, people.indexOf(person));
        const over = row.pressure > 1;
        return (
          <View key={row.personId} style={styles.personRow}>
            <PersonDot color={hue} name={person.name} size={20} />
            <View style={styles.personBody}>
              <View style={styles.personLabelRow}>
                <Text style={[styles.personName, { color: theme.text }]} numberOfLines={1}>
                  {person.isSelf ? person.name || t.peopleMode.you : person.name}
                </Text>
                <Text style={[styles.personValue, { color: over ? theme.warn : theme.textMuted }]}>
                  {t.energyBalance.projected(row.projected, row.capacity)}
                </Text>
              </View>
              {/* Status beats identity: an over-committed bar goes warn, not their hue. */}
              <ProgressBar value={row.pressure} color={over ? theme.warn : hue} height={6} />
              {row.tasksOnly ? (
                <Text style={[styles.personNote, { color: theme.textMuted }]} numberOfLines={1}>
                  {t.energyBalance.tasksOnly}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Text style={[styles.summary, { color: lopsided ? theme.warn : theme.textMuted }]}>
        {lopsided
          ? t.energyBalance.lopsided(
              people.find((p) => p.id === heaviest.personId)?.name || t.peopleMode.you,
            )
          : t.energyBalance.shared}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  // No vertical margin (2026-08-08): the screen's content container owns the gap between
  // stacked cards (`SCREEN_GAP`, constants/theme.ts). Was `marginBottom: Spacing.sm`.
  card: { padding: Spacing.md, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // flex:1 with no minWidth — the row has to survive 360px with a dot and a value on it
  // (AGENTS.md's wrap audit: minWidth + flexWrap is what breaks control rows on small phones).
  personBody: { flex: 1, gap: 2 },
  personLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs },
  personName: { fontSize: FontSize.sm, fontFamily: Fonts.medium, flexShrink: 1 },
  personValue: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  personNote: { fontSize: FontSize.xs, fontFamily: Fonts.regular, fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.xs },
  summary: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
});
