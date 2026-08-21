/**
 * HomeMedicineCard.tsx — the Me tab's Medicine card: badge, title, reminder bell, fold, ⤢.
 *
 * New 2026-08-21. Medicine used to be a full `Surface` drawn INSIDE HomeHealthCard's `Surface`
 * (components/MedicineTrayCard.tsx, now components/MedicineSurface.tsx) — the card-in-a-card the
 * 2026-08-18 blueprint pass banned, and what `CONSISTENCY_AUDIT.md` §11 measured against the
 * report *"Each thing is its own card, like medicine and Health (which they currently are
 * not)."* Asked whether it should become a fourth top-level card beside Habits / Notes /
 * Health, the maintainer said *"Yes."*
 *
 * This is the shell only, the same split HomeHealthCard has around HealthSurface: everything
 * with content in it lives in components/MedicineSurface.tsx, which is also what
 * components/CardExpandHost.tsx mounts for the `homeMedicine` pane.
 *
 * Connections:
 *   Imports → components/MedicineSurface, components/MedicineReminderBell, components/Surface,
 *             components/CardAccent (CardAccentBadge), components/CardMenuSheet
 *             (CardMenuButton), components/CardCollapseToggle, components/CardExpandButton,
 *             components/Collapsible, components/PressableScale, lib/useCardExpand,
 *             lib/useCollapsedCard, lib/screenColor, lib/i18n, lib/useAppTheme, constants/theme
 *   Used by → app/(tabs)/index.tsx (Home's card stack, `HOME_CARD_KINDS` — 'medicine'), gated
 *             there on settings.featureMedicine
 *   Data    → none directly; MedicineSurface drives store/useMedicineStore, and the bell writes
 *             settings.medicineRemindersEnabled
 *
 * Edit notes:
 *   - **The gate is at the call site, not here.** app/(tabs)/index.tsx renders nothing for the
 *     'medicine' kind while `featureMedicine` is off, and lib/homeCards.ts keeps the kind in the
 *     stored order regardless — so turning the flag back on restores the card exactly where the
 *     user had dragged it. A flag that hides a surface must never also edit the data.
 *   - **Header control order, left to right: bell → ⋮ → fold → ⤢.** The bell is about the card's
 *     SUBJECT (do these trays remind you), so it keeps the innermost position it has always had;
 *     the fold only changes what is drawn; and the ⤢ is app-wide the right-most thing in a card
 *     header (2026-08-20), so it lands in the actual top-right corner on every surface.
 *   - **The tray reminders do not care about any of this.** Folding the card, hiding it from
 *     Home, or collapsing it while expanded changes nothing about what is scheduled —
 *     lib/medicineNotifications.ts reads the medicines and the tray times, never a card's state.
 *     The one control here that DOES change behaviour is the bell.
 *   - The title press expands rather than pushing, like HomeHealthCard's: there is no deeper
 *     medicine destination — app/medicine-form.tsx is a per-medicine editor, reached from a row.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import { CardAccentBadge } from '@/components/CardAccent';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import CardExpandButton from '@/components/CardExpandButton';
import MedicineReminderBell from '@/components/MedicineReminderBell';
import MedicineSurface from '@/components/MedicineSurface';
import { useCardExpand } from '@/lib/useCardExpand';
import { useCollapsedCard } from '@/lib/useCollapsedCard';
import { OpticalCenter, PAD_GUTTER, Radius, Spacing, Type } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { getScreenColor } from '@/lib/screenColor';

type Props = {
  /** Home's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
};

export default function HomeMedicineCard({ cardMenu }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const screenColor = getScreenColor(theme, 'health');
  const cardExpand = useCardExpand('homeMedicine');
  // Folded away, remembered across launches. Presentation only: a collapsed card still arms
  // every tray reminder. Rests CLOSED like every card bar the three lib/cardRegistry.ts's openAtRest excepts.
  const [collapsed, toggleCollapsed] = useCollapsedCard('homeMedicine');

  return (
    <View ref={cardExpand.ref} collapsable={false}>
      <Surface surfaceContext="ambient" style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <PressableScale onPress={cardExpand.onExpand} style={styles.headerLeft} scaleTo={0.98}>
              {/* `medkit`, not the domain default heart: Health's cards all fell back to
                  DOMAIN_ICON.health and read as the same badge repeated. Size 32 — a top-level
                  card takes the same badge size Me's other cards use. */}
              <CardAccentBadge domain="health" icon="medkit" size={32} accentOverride={screenColor.base} />
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {t.medicine.title}
                </Text>
              </View>
            </PressableScale>
            <MedicineReminderBell />
            {cardMenu ? <CardMenuButton cardTitle={t.medicine.title} {...cardMenu} /> : null}
            <CardCollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} cardLabel={t.medicine.title} />
            <CardExpandButton expanded={cardExpand.expanded} onExpand={cardExpand.onExpand} onCollapse={cardExpand.onCollapse} />
          </View>

          <Collapsible open={!collapsed}>
            <MedicineSurface />
          </Collapsible>
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
  // `Type.heading`, not a literal — see HomeHealthCard's matching note and CONSISTENCY_AUDIT §2.
  title: { fontSize: Type.heading.size, lineHeight: Type.heading.size * Type.heading.line, fontFamily: Type.heading.fontFamily, ...OpticalCenter },
});
