/**
 * HomeSharedCard.tsx — Home-screen preview of items shared with the user (useSharedStore).
 *
 * Mirrors HomeNotesCard's Surface + left-accent-bar layout: surfaces the incoming,
 * not-yet-actioned shared items (direction 'in') split into a Plans section and a
 * Shopping section within one card, with a "See all →" footer link to the full
 * /shared screen. Renders nothing when there's nothing incoming — same self-hide
 * pattern as HomeNotesCard, so it never shows an empty shell.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, lib/haptics,
 *             lib/i18n, lib/useAppTheme, store/useSharedStore
 *   Used by → app/(tabs)/index.tsx (Home — a preview card alongside Notes/Plans/Shopping)
 *   Data    → reads useSharedStore (shared_tasks + shared_shopping_items); no writes —
 *             accept/dismiss/toggle live on the /shared screen the "See all" link opens
 *
 * Edit notes:
 *   - Shows only incoming pending rows (direction === 'in' && !done) — the actionable
 *     ones. Outgoing/sent + done history stays on /shared (reached via "See all").
 *   - Rows are read-only previews; the whole card routes to /shared for actions, matching
 *     the calm "preview on Home, act on the real screen" convention (HomeNotesCard, PlanTaskCard).
 *   - No featShared colour token exists — uses theme.accent for the left bar (Shared is a
 *     cross-feature surface, so the primary accent fits rather than one feature's hue).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useSharedStore } from '@/store/useSharedStore';

const PREVIEW_PER_SECTION = 3;

export default function HomeSharedCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const sharedTasks = useSharedStore((s) => s.tasks);
  const sharedShopping = useSharedStore((s) => s.shoppingItems);

  const incomingTasks = sharedTasks.filter((x) => x.direction === 'in' && !x.done);
  const incomingShopping = sharedShopping.filter((i) => i.direction === 'in' && !i.done);
  const total = incomingTasks.length + incomingShopping.length;

  // Nothing incoming to act on — self-hide, mirroring HomeNotesCard.
  if (total === 0) return null;

  function openShared() {
    tap();
    router.push('/shared');
  }

  return (
    <Surface surfaceContext="ambient" style={[styles.card, styles.cardRow]}>
      <View style={[styles.accent, { backgroundColor: theme.accent }]} />
      <View style={styles.cardContent}>

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>{t.sharedTitle}</Text>
          <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.badgeText, { color: theme.accent }]}>{total}</Text>
          </View>
          <View style={styles.titleRight}>
            <PressableScale onPress={openShared} hitSlop={8} scaleTo={0.97}>
              <Text style={[styles.seeAll, { color: theme.accent }]}>{t.seeAll}</Text>
            </PressableScale>
          </View>
        </View>

        {/* Plans (tasks) section */}
        {incomingTasks.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.sharedTasksTab}</Text>
            {incomingTasks.slice(0, PREVIEW_PER_SECTION).map((item, idx) => (
              <PressableScale key={item.id} onPress={openShared} scaleTo={0.97}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.surfaceMuted }]} />}
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                    {t.sharedFromLabel(item.sharedBy)}
                  </Text>
                </View>
              </PressableScale>
            ))}
            {incomingTasks.length > PREVIEW_PER_SECTION && (
              <Text style={[styles.moreText, { color: theme.textMuted }]}>
                {`+${incomingTasks.length - PREVIEW_PER_SECTION}`}
              </Text>
            )}
          </View>
        )}

        {/* Shopping section */}
        {incomingShopping.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.sharedShoppingTab}</Text>
            {incomingShopping.slice(0, PREVIEW_PER_SECTION).map((item, idx) => (
              <PressableScale key={item.id} onPress={openShared} scaleTo={0.97}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.surfaceMuted }]} />}
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>
                    {`${item.amount} ${item.unit} ${item.name}`.replace(/\s+/g, ' ').trim()}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                    {t.sharedFromLabel(item.sharedBy)}
                  </Text>
                </View>
              </PressableScale>
            ))}
            {incomingShopping.length > PREVIEW_PER_SECTION && (
              <Text style={[styles.moreText, { color: theme.textMuted }]}>
                {`+${incomingShopping.length - PREVIEW_PER_SECTION}`}
              </Text>
            )}
          </View>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  cardRow: { flexDirection: 'row' },
  accent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  cardContent: { flex: 1, padding: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  titleRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md },
  seeAll: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  sectionBlock: { marginTop: Spacing.xs, gap: 2 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  row: { paddingVertical: Spacing.xs },
  rowLabel: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  rowMeta: { fontSize: FontSize.xs, fontFamily: Fonts.regular, marginTop: 1 },
  divider: { height: 1 },
  moreText: { fontSize: FontSize.xs, fontFamily: Fonts.regular, marginTop: 2 },
});
