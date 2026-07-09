/**
 * SavedListsModal.tsx — saved/template shopping lists popup.
 *
 * Opened from WeekListCard's bookmark icon (weekly list header). Lists every
 * isTemplate=true shopping_lists row; tapping one instantiates it as a fresh
 * live list for the current week (useShoppingListStore.instantiateTemplate).
 * A bottom row lets the user save the list currently being viewed as a new
 * template (useShoppingListStore.saveAsTemplate).
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, constants/theme, lib/i18n,
 *             lib/useAppTheme, store/useShoppingListStore (ShoppingList type only)
 *   Used by → app/(tabs)/shopping.tsx
 *   Data    → none directly — `templates` and both callbacks are owned by the parent
 *
 * Edit notes:
 *   - **Decision 044b (2026-07-09):** the backdrop+slide-up shell now comes from
 *     components/AnimatedBottomSheet.tsx instead of a raw `<Modal animationType="slide">`
 *     — that native animation only ever played on open (see that component's header for
 *     why); this one plays a real timed exit too. No nullable "which item" prop here, so
 *     no last-known-value cache is needed on this file's side.
 *   - Structurally copies AddSourceChooser.tsx's single-step bottom sheet (backdrop +
 *     slide-up sheet with a handle) — no second "step" here, just one scrollable list.
 *   - Ported (2026-07-02, Session A2·2, expanded scope — see PROGRESS_LOG). Rebuilt on
 *     `<Surface surfaceContext="overlay">` (this repo's established sheet pattern — see
 *     ListSettingsSheet.tsx/UpdateSheet.tsx) instead of the old repo's bare `View` +
 *     `theme.white` + `Shadow.fab` — "Surface owns card/glass" per this session's standing
 *     constraints. `theme` prop dropped in favor of internal useAppTheme(). Token remap
 *     (Decision 006): white→surface (n/a, Surface owns fill now), grayLight(handle)→border,
 *     text→text, textLight→textMuted, greenLight/green(bookmark icon)→goodSoft/good,
 *     orange(save btn)→accent, hardcoded '#fff'→textInverse.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingList } from '@/store/useShoppingListStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';

type Props = {
  visible: boolean;
  templates: ShoppingList[];
  onClose: () => void;
  onSelectTemplate: (id: string) => void;
  onSaveCurrentAsTemplate: () => void;
};

export default function SavedListsModal({ visible, templates, onClose, onSelectTemplate, onSaveCurrentAsTemplate }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  function handleSelect(id: string) {
    onSelectTemplate(id);
    onClose();
  }

  function handleSaveCurrent() {
    onSaveCurrentAsTemplate();
    onClose();
  }

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.savedListsTitle}</Text>

        {templates.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.savedListsEmpty}</Text>
        ) : (
          <ScrollView style={styles.scroll}>
            {templates.map((template) => (
              <Pressable key={template.id} style={styles.row} onPress={() => handleSelect(template.id)}>
                <View style={[styles.rowIcon, { backgroundColor: theme.goodSoft }]}>
                  <Ionicons name="bookmark" size={16} color={theme.good} />
                </View>
                <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>{template.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleSaveCurrent}>
          <Ionicons name="add" size={18} color={theme.accentInk} />
          <Text style={[styles.saveBtnText, { color: theme.accentInk }]}>{t.saveListAsTemplateBtn}</Text>
        </Pressable>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '70%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  scroll: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  rowIcon: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderRadius: Radius.md, paddingVertical: Spacing.md, minHeight: 44 },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
