/**
 * NewMonthlyListRow.tsx — "+ New list" inline creator for the Monthly tab's named,
 * budgeted Monthly lists (store/useMonthlyListStore.ts).
 *
 * Same collapse→expand "+ makes a new row" idiom as components/InlineAddItem.tsx, sized
 * down to the one field a Monthly list needs at creation: its name. The name field shows
 * only a greyed placeholder ("List name") — standard TextInput placeholder behaviour, so
 * it disappears the moment the user types — never a real value, so a blank Create never
 * silently makes an unnamed list (the button stays disabled until the trimmed name is
 * non-empty).
 *
 * Connections:
 *   Imports → components/FormControls (Input), components/PressableScale, constants/theme,
 *             lib/i18n, lib/useAppTheme, lib/haptics
 *   Used by → app/(tabs)/shopping.tsx (Monthly tab, below the last list card)
 *   Data    → none directly — creation flows out via onCreate(name); the parent calls
 *             useMonthlyListStore.add()
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing, contrastOn } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { Input } from '@/components/FormControls';
import PressableScale from '@/components/PressableScale';

type Props = {
  onCreate: (name: string) => void;
};

export default function NewMonthlyListRow({ onCreate }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');

  function collapse() {
    setName('');
    setExpanded(false);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    hapticConfirm();
    collapse();
  }

  if (!expanded) {
    return (
      <PressableScale
        style={[styles.addBar, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel={t.newMonthlyListBtn}
        scaleTo={0.97}
      >
        <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
        <Text style={[styles.addBarLabel, { color: theme.accent }]} numberOfLines={1}>{t.newMonthlyListBtn}</Text>
      </PressableScale>
    );
  }

  const canCreate = name.trim().length > 0;
  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Input
        value={name}
        onChangeText={setName}
        placeholder={t.newMonthlyListNamePlaceholder}
        returnKeyType="done"
        autoFocus
        onSubmitEditing={handleCreate}
        onBlur={() => { if (!name.trim()) setExpanded(false); }}
      />
      <View style={styles.actionsRow}>
        <PressableScale style={styles.ghostBtn} onPress={collapse} scaleTo={0.97}>
          <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancel}</Text>
        </PressableScale>
        <PressableScale
          style={[styles.primaryBtn, { backgroundColor: canCreate ? theme.accent : theme.surfaceMuted }]}
          onPress={handleCreate}
          disabled={!canCreate}
          scaleTo={0.95}
        >
          <Text style={[styles.primaryBtnText, { color: canCreate ? contrastOn(theme.accent) : theme.textMuted }]}>
            {t.createMonthlyListBtn}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  addBarLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  panel: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
