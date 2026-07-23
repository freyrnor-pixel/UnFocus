/**
 * SavedListsModal.tsx — saved/template shopping lists browse-and-pick popup.
 *
 * Opened from WeekListCard's kebab menu ("Saved lists") and the Weekly tab's "+ New
 * list" chooser. Lists every isTemplate=true shopping_lists row; tapping one routes
 * through app/(tabs)/shopping.tsx's `addTemplateToWeek` (current week, same dedup +
 * instantiateTemplate path components/SavedListsSection.tsx's drag/tap flow uses) rather
 * than calling useShoppingListStore.instantiateTemplate directly — see that component's
 * header for the 2026-07-22 drag/sync-back redesign this now shares logic with.
 *
 * **"Save as template" moved out (2026-07-23 declutter pass)**: this modal used to also
 * carry a bottom "Save current list as template" button, but that only made sense when
 * opened from an existing list's kebab — opened from the Weekly tab's "+ New list"
 * chooser (browsing to START a new list) there's no "current list" yet, so the button sat
 * there meaninglessly. It's now its own direct entry in WeekListCard's kebab menu
 * (`onSaveAsTemplate`), right beside "Saved lists" — one tap instead of opening this
 * modal, scrolling past the template list, and tapping a button at the bottom. This modal
 * is now a pure browse-and-pick popup — no `onSaveCurrentAsTemplate` prop.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/PressableScale,
 *             constants/theme, lib/i18n, lib/useAppTheme, store/useShoppingListStore
 *             (ShoppingList type only)
 *   Used by → app/(tabs)/shopping.tsx
 *   Data    → none directly — `templates` and the callback are owned by the parent
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
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingList } from '@/store/useShoppingListStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';

type Props = {
  visible: boolean;
  templates: ShoppingList[];
  onClose: () => void;
  onSelectTemplate: (id: string) => void;
};

export default function SavedListsModal({ visible, templates, onClose, onSelectTemplate }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  function handleSelect(id: string) {
    onSelectTemplate(id);
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
              <PressableScale key={template.id} style={styles.row} onPress={() => handleSelect(template.id)} scaleTo={0.97}>
                <View style={[styles.rowIcon, { backgroundColor: theme.goodSoft }]}>
                  <Ionicons name="bookmark" size={16} color={theme.good} />
                </View>
                <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>{template.name}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}
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
});
