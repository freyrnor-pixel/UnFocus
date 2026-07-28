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
 *             constants/theme (incl. HOME_PREVIEW_CARD_MIN_HEIGHT), constants/motion (Travel),
 *             lib/domainColor, lib/goalStarters, lib/goalStrength (decayedStrength),
 *             lib/haptics, lib/i18n, lib/useAppTheme (useAppTheme + useScaledStyles),
 *             expo-router, store/useGoalStore
 *   Used by → app/(tabs)/index.tsx (the Goals preview slot, gated on settings.featureGoals)
 *   Data    → reads useGoalStore; writes only via add() when a starter chip is tapped
 *
 * Edit notes:
 *   - Gated on `settings.featureGoals` by its CALL SITE, never here — turning the feature off
 *     must hide the surface and leave every goal and every link untouched.
 *   - `decayedStrength` on read, always. The stored `strength` alone is stale by definition;
 *     see lib/goalStrength.ts.
 *   - **Brought in line with its sibling Home cards (2026-07-28, user report on the empty
 *     Goals card: icon in the wrong corner, text not fitting).** This card had drifted from
 *     the Plans/Habits/Notes/Shopping preview cards on four counts, all fixed together:
 *     the `CardAccentBadge` was pinned top-RIGHT (now `top: Spacing.md + 4, left: Spacing.md`
 *     with `titleRow`'s matching `paddingLeft: 52`, so badge and title read as one header
 *     unit instead of sitting at opposite edges); the empty-state explainer had no
 *     `lineHeight` and wasn't italic/medium like the other two, so it set solid and read
 *     cramped; styles weren't run through `useScaledStyles`, so the card ignored the
 *     font-size accessibility setting its siblings honour; and it had no
 *     `HOME_PREVIEW_CARD_MIN_HEIGHT` floor, so an empty Goals card was visibly shorter than
 *     everything around it. Keep all four aligned if you touch any of them.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { getDomainColor } from '@/lib/domainColor';
import { GOAL_STARTERS } from '@/lib/goalStarters';
import { decayedStrength } from '@/lib/goalStrength';
import { success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
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
  const styles = useScaledStyles(baseStyles);
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
    <Surface surfaceContext="ambient" borderColor={domainColor.accent} style={[styles.card, styles.cardFloor]}>
      {/* Badge + wash mount OUTSIDE cardContent, directly in Surface — same reason as
          HomeHabitsCard/HomeNotesCard (native padding inheritance vs. react-native-web). */}
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

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Shared resting floor so Goals reads the same size as its Plans/Habits/Notes/Shopping
  // siblings — see constants/theme.ts. Goals has no expand/collapse, so it always applies.
  cardFloor: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // Upper LEFT, matching every other Home preview card (2026-07-28, user report: "the icon
  // should be in the upper left corner"). Goals was the only one pinning it top-right, which
  // stranded the title alone at the far left with a card-wide gap between the two.
  badgeFixed: { position: 'absolute', top: Spacing.md + 4, left: Spacing.md, zIndex: 2 },
  cardContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.md + 4,
    gap: Spacing.sm,
  },
  titleRowPressable: { alignSelf: 'stretch' },
  // paddingLeft 52 = badge offset 16 + badge size 32 + a 4px gap, so the title sits right
  // beside the pinned badge and the two read as one header unit (same value as the siblings).
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: 52, minHeight: 32 },
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, includeFontPadding: false, textAlignVertical: 'center' },
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
  rowTitle: { flex: 1, minWidth: 0, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  seeAll: { alignSelf: 'flex-end', paddingVertical: 4 },
  seeAllText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  emptyWrap: { gap: Spacing.sm },
  emptyTextRow: { flexDirection: 'row', gap: Spacing.xs },
  emptyBulb: { marginTop: 2 },
  // lineHeight + italic/medium match HomeHabitsCard's and HomeNotesCard's explainers exactly
  // — the three are one system, and without an explicit lineHeight this one set solid and
  // read cramped against the Norwegian copy's descenders (2026-07-28, user report).
  emptyExplainer: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  starterTapLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  starterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  // Content-sized pills, same shape as HomeHabitsCard's chips directly above this card on
  // Home. A goal title is a whole phrase rather than a word, so `flexShrink` on the label is
  // what keeps a long one (NO's "Være i bevegelse hver dag") from pushing its chip past the
  // card edge — it wraps the row instead, which is why STARTER_PREVIEW_COUNT is 2.
  starterChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    minHeight: 34,
  },
  starterChipText: { flexShrink: 1, minWidth: 0, fontSize: FontSize.xs, fontFamily: Fonts.medium },
});
