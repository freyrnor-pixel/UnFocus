/**
 * HomeHealthCard.tsx — Home-screen card for Health: today's medicine trays + issues active this
 * week, mirroring HomeHabitsCard/HomeNotesCard's Surface + domain-colored-border layout.
 *
 * New (2026-08-20, "full-screen card expansion" pass) — Health left the bottom nav and moved
 * here. All of the real content lives in components/HealthSurface.tsx (`embedded`), the same
 * component app/health.tsx (the back-compat pushed route) and CardExpandHost's `homeHealth`
 * body mount — this file is only the card shell: badge, title, the expand/menu buttons, and the
 * Surface that gives it its one edge colour.
 *
 * Connections:
 *   Imports → components/HealthSurface (`embedded`), components/Surface, components/CardAccent
 *             (CardAccentBadge), components/CardMenuSheet (CardMenuButton), components/PressableScale,
 *             components/CardExpandButton, lib/useCardExpand, lib/screenColor, lib/i18n,
 *             lib/useAppTheme, constants/theme
 *   Used by → app/(tabs)/index.tsx (Home's card stack, `HOME_CARD_KINDS` — 'health')
 *   Data    → none directly — HealthSurface drives store/useHealthStore
 *
 * Edit notes:
 *   - **The no-scoreboard rule is load-bearing here, same as the standalone screen**: no
 *     streak, no "better than last week", no total, no colour that escalates with a count, and
 *     no congratulation for a quiet week. Nothing in this shell adds a number HealthSurface
 *     doesn't already draw — see that file's own header before adding one.
 *   - **The title press expands** (`cardExpand.onExpand`), unlike Habits' or Shopping's, which
 *     still push/navigate to a genuinely deeper screen. There is no deeper Health destination
 *     any more: app/health.tsx is back-compat only, and nothing in the UI pushes to it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge } from '@/components/CardAccent';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import CardExpandButton from '@/components/CardExpandButton';
import HealthSurface from '@/components/HealthSurface';
import { useCardExpand } from '@/lib/useCardExpand';
import { Fonts, OpticalCenter, PAD_GUTTER, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { getScreenColor } from '@/lib/screenColor';

type Props = {
  /** Home's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
};

export default function HomeHealthCard({ cardMenu }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const screenColor = getScreenColor(theme, 'health');
  const cardExpand = useCardExpand('homeHealth');

  return (
    <View ref={cardExpand.ref} collapsable={false}>
      <Surface surfaceContext="ambient" style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <PressableScale onPress={cardExpand.onExpand} style={styles.headerLeft} scaleTo={0.98}>
              <CardAccentBadge domain="health" icon="pulse" size={32} accentOverride={screenColor.base} />
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {t.home.healthCardTitle}
                </Text>
              </View>
            </PressableScale>
            <CardExpandButton expanded={cardExpand.expanded} onExpand={cardExpand.onExpand} onCollapse={cardExpand.onCollapse} />
            {cardMenu ? <CardMenuButton cardTitle={t.home.healthCardTitle} {...cardMenu} /> : null}
          </View>

          <HealthSurface embedded />
        </View>
      </Surface>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md },
  cardContent: { paddingHorizontal: PAD_GUTTER, paddingTop: PAD_GUTTER, paddingBottom: PAD_GUTTER },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, ...OpticalCenter },
});
