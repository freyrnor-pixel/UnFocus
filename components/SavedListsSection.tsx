/**
 * SavedListsSection.tsx — inline expandable "Saved lists" container for the Weekly tab.
 *
 * Sits above the week-of-cycle sections in app/(tabs)/shopping.tsx. Expand it to see
 * every saved/template shopping_lists row as a draggable, bookmark-icon row: drag one
 * down onto a week section to instantiate it there (screen-owned window-coordinate
 * hit-test, same idiom as the existing week-drag reassignment), or tap the row for a
 * "Week 1/2/3/4" chooser as a non-drag fallback. A template already instantiated into
 * ANY week gets an "in use" badge here — it is never removed or disabled, so the user
 * can still copy it into other weeks too (only one instance of a given template per
 * week section is enforced by the parent's dedup check, not here).
 *
 * Connections:
 *   Imports → components/AppModal (showAppModal), components/DraggableTaskRow,
 *             components/ExpandableCard, components/PressableScale, components/Surface,
 *             constants/theme, lib/i18n, lib/useAppTheme, store/useShoppingListStore
 *             (ShoppingList type only)
 *   Used by → app/(tabs)/shopping.tsx (Weekly tab, above the week sections)
 *   Data    → none directly — `templates`/`usedTemplateIds` and every callback are owned
 *             by the parent, which also owns the actual instantiateTemplate/dedup logic
 *
 * Edit notes:
 *   - New file (2026-07-22, saved-lists drag/sync redesign). Renders null when there are
 *     no templates — nothing to expand into, and an always-visible empty accordion would
 *     just be one more thing to scroll past on a screen that already has Unallocated +
 *     4 week sections above/below it.
 *   - Drag measuring/hit-testing lives entirely in the parent (shopping.tsx reuses its
 *     existing `weekSectionNodes`/`weekSectionRectsRef` — the same registry the
 *     list-to-list week-reassign drag already measures) — this component only forwards
 *     DraggableTaskRow's onDragStart/onDragMove/onDragEnd per template id.
 *   - `isOpen={false}` on every DraggableTaskRow: rows here have no per-row expand state
 *     of their own, so drag is never gated off the way item rows gate on "not open".
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingList } from '@/store/useShoppingListStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import { showAppModal } from '@/components/AppModal';

type Props = {
  templates: ShoppingList[];
  /** Template ids that already have ≥1 live list instantiated from them (any week). */
  usedTemplateIds: Set<string>;
  onDragStart: (templateId: string) => void;
  onDragMove: (templateId: string, centerY: number) => void;
  onDragEnd: (templateId: string) => void;
  /** Tap-to-choose-week fallback — parent runs the same dedup + instantiate path as a drop. */
  onQuickAdd: (templateId: string, week: number) => void;
};

export default function SavedListsSection({ templates, usedTemplateIds, onDragStart, onDragMove, onDragEnd, onQuickAdd }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  if (templates.length === 0) return null;

  function openWeekChooser(template: ShoppingList) {
    showAppModal(template.name, t.savedListsChooseWeekBody, [
      ...[1, 2, 3, 4].map((week) => ({ text: t.weekNumberChip(week), onPress: () => onQuickAdd(template.id, week) })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  return (
    <Surface style={styles.card}>
      <ExpandableCard
        title={t.savedListsTitle}
        subtitle={t.savedListsSectionHint}
        badge={String(templates.length)}
        accentColor={theme.good}
        first
      >
        {templates.map((template, idx) => {
          const inUse = usedTemplateIds.has(template.id);
          return (
            <View key={template.id}>
              <DraggableTaskRow
                isOpen={false}
                onDragStart={() => onDragStart(template.id)}
                onDragMove={(centerY) => onDragMove(template.id, centerY)}
                onDragEnd={() => onDragEnd(template.id)}
              >
                <PressableScale style={styles.row} onPress={() => openWeekChooser(template)} scaleTo={0.98}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.goodSoft }]}>
                    <Ionicons name="bookmark" size={16} color={theme.good} />
                  </View>
                  <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>{template.name}</Text>
                  {inUse && (
                    <View style={[styles.inUseBadge, { backgroundColor: theme.accentSoft }]}>
                      <Ionicons name="checkmark" size={11} color={theme.accent} />
                      <Text style={[styles.inUseText, { color: theme.accent }]}>{t.savedListInUseLabel}</Text>
                    </View>
                  )}
                </PressableScale>
              </DraggableTaskRow>
              {idx < templates.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
            </View>
          );
        })}
      </ExpandableCard>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  rowIcon: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  rowDivider: { height: 1 },
  inUseBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  inUseText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
