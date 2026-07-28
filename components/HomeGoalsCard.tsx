/**
 * HomeGoalsCard.tsx — Home-screen preview of Goals (store/useGoalStore).
 *
 * Mirrors HomeHabitsCard/HomeNotesCard: a Surface with the domain wash + badge, a title that
 * taps through to the full screen, a short preview of the strongest goals, and its own inline
 * empty state (never null — Decision 043 rule 4). Goals had no presence on Home at all before
 * this; they were a glow dot on a linked row and nothing else.
 *
 * Goals are sorted by their DECAYED strength, so the card shows what's actually got momentum
 * right now rather than whatever was created first. There is deliberately no "weakest goal"
 * or "you've neglected this" framing anywhere — a goal that hasn't been worked simply cooled
 * back toward neutral (lib/goalStrength.ts floors at 0), and the copy has to agree with the
 * mechanic. See app/goals.tsx's header for why cutting-back lives here.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/CardAccent
 *             (badge + wash), components/GoalGlowDot,
 *             constants/theme, constants/motion (Travel), lib/domainColor, lib/goalStarters,
 *             lib/goalStrength (decayedStrength), lib/haptics, lib/i18n, lib/useAppTheme,
 *             expo-router, store/useGoalStore
 *   Used by → app/(tabs)/index.tsx (the Goals preview slot, gated on settings.featureGoals)
 *   Data    → reads useGoalStore; writes only via add() when a starter chip is tapped
 *
 * Edit notes:
 *   - Gated on `settings.featureGoals` by its CALL SITE, never here — turning the feature off
 *     must hide the surface and leave every goal and every link untouched.
 *   - `decayedStrength` on read, always. The stored `strength` alone is stale by definition;
 *     see lib/goalStrength.ts.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { FontSize, Radius, Spacing, Type, rgba } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { getDomainColor } from '@/lib/domainColor';
import { GOAL_STARTERS } from '@/lib/goalStarters';
import { decayedStrength } from '@/lib/goalStrength';
import { success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useGoalStore } from '@/store/useGoalStore';

/** How many goals the card previews before "See all →". */
const PREVIEW_COUNT = 3;
/**
 * How many starter chips the EMPTY card offers. Two, not the full four: a goal title is a
 * whole phrase, so each chip takes a full line at 360px — the wrap audit caught all four
 * stacking into a four-line block, which is a lot of Home for an empty state. The rest are
 * on the Goals screen, one tap away through the title.
 */
const STARTER_PREVIEW_COUNT = 2;

export default function HomeGoalsCard() {
  const t = useT();
  const theme = useAppTheme();
  const router = useRouter();
  const goals = useGoalStore((s) => s.goals);
  const addGoal = useGoalStore((s) => s.add);
  // 'habit' — goals are what habits and to-dos add up to, and this card sits with them.
  const domainColor = getDomainColor(theme, 'habit');

  const sorted = React.useMemo(
    () =>
      [...goals].sort(
        (a, b) =>
          decayedStrength(b.strength, b.strengthUpdatedAt, Date.now()) -
          decayedStrength(a.strength, a.strengthUpdatedAt, Date.now())
      ),
    [goals]
  );
  const preview = sorted.slice(0, PREVIEW_COUNT);

  return (
    <Surface surfaceContext="ambient" borderColor={domainColor.accent} style={styles.card}>
      <CardAccentWash domain="habit" />
      <CardAccentBadge domain="habit" size={32} style={styles.badgeFixed} />
      <View style={styles.cardContent}>
        <PressableScale onPress={() => router.push('/goals')} style={styles.titleRowPressable} scaleTo={0.97}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{t.goals.title}</Text>
          </View>
        </PressableScale>

        {goals.length === 0 ? (
          // Inlined rather than wrapped in a StarterCard: a Surface inside a Surface reads as
          // a nested panel (same call the other Home preview cards already make).
          <View style={styles.emptyWrap}>
            <View style={styles.emptyTextRow}>
              <Ionicons name="bulb-outline" size={14} color={theme.textMuted} style={styles.emptyBulb} />
              <Text style={[styles.emptyExplainer, { color: theme.text }]}>{t.starters.goals.text}</Text>
            </View>
            <Text style={[styles.starterTapLabel, { color: theme.textMuted }]}>{t.starters.goals.tapToAdd}</Text>
            <View style={styles.starterChips}>
              {GOAL_STARTERS.slice(0, STARTER_PREVIEW_COUNT).map((starter) => (
                <PressableScale
                  key={starter.key}
                  style={[styles.starterChip, { backgroundColor: theme.surface, borderColor: rgba(domainColor.accent, 0.35) }]}
                  onPress={() => { success(); addGoal(t.starters.goals.suggestions[starter.key]); }}
                  travel={Travel.sm}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.starters.addExample} ${t.starters.goals.suggestions[starter.key]}`}
                >
                  <Ionicons name={starter.icon} size={14} color={domainColor.accent} />
                  <Text style={[styles.starterChipText, { color: theme.text }]}>
                    {t.starters.goals.suggestions[starter.key]}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.rows}>
            {preview.map((goal) => (
              <View
                key={goal.id}
                style={[
                  styles.row,
                  { backgroundColor: rgba(domainColor.accent, 0.05), borderColor: rgba(domainColor.accent, 0.2) },
                ]}
              >
                <GoalGlowDot
                  color={goal.color}
                  strength={goal.strength}
                  strengthUpdatedAt={goal.strengthUpdatedAt}
                  size={12}
                />
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{goal.title}</Text>
              </View>
            ))}
            {goals.length > PREVIEW_COUNT && (
              <PressableScale onPress={() => router.push('/goals')} style={styles.seeAll} scaleTo={0.97}>
                <Text style={[styles.seeAllText, { color: domainColor.accent }]}>{t.goals.seeAll}</Text>
              </PressableScale>
            )}
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  badgeFixed: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
  cardContent: { padding: Spacing.md, gap: Spacing.sm },
  titleRowPressable: { alignSelf: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontFamily: Type.heading.fontFamily, fontSize: Type.heading.size },
  rows: { gap: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  rowTitle: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Type.label.fontFamily },
  seeAll: { alignSelf: 'flex-end', paddingVertical: 4 },
  seeAllText: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
  emptyWrap: { gap: Spacing.xs },
  emptyTextRow: { flexDirection: 'row', gap: 6 },
  emptyBulb: { marginTop: 2 },
  emptyExplainer: { flex: 1, minWidth: 0, fontSize: FontSize.sm },
  starterTapLabel: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily, marginTop: 2 },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    minHeight: 34,
  },
  starterChipText: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
});
