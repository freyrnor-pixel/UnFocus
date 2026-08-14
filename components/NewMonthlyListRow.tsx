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
 * **Collapsed trigger**: a big-ish plain white/surface button with a "+" glyph AND its label.
 * It was icon-only from the 2026-07-23 declutter pass until 2026-08-03, with the words left to
 * `accessibilityLabel`. The word is back: that pass was reasoning about a crowded populated
 * card header, and this trigger's hardest moment is the opposite one — on an empty Shopping
 * tab it is the only thing on screen, and it was the one primary add in the app that didn't
 * say what it does (To-do and Habits both draw a labelled "Type task"/"Type habit" line).
 * See the comment at the trigger itself.
 *
 * Connections:
 *   Imports → components/FormControls (Input), components/PressableScale, constants/theme,
 *             lib/i18n, lib/useAppTheme (useAccessibility for reducedMotion), lib/haptics,
 *             lib/useKeyboardLift
 *   Used by → app/(tabs)/shopping.tsx (Monthly tab, below the last list card)
 *   Data    → none directly — creation flows out via onCreate(name); the parent calls
 *             useMonthlyListStore.add()
 *
 * Edit notes:
 *   - **Secondary weight, accent-tinted (2026-08-09)**: the collapsed trigger was the only
 *     neutral-white add on the Shopping tab while "Add item" and "Add dish" were both
 *     accent-tinted, which read as a difference in kind rather than in what gets created. It
 *     now matches them. The screen's single primary is `InlineAddItem`'s solid bar — see
 *     app/(tabs)/shopping.tsx's "One primary, everything else secondary" header note, and
 *     keep this file and that file's `newListTrigger` identical; they are twins on purpose.
 *   - The collapsed "+" tile and the expanded name-entry panel are very different heights, so
 *     every expand/collapse wraps the state change in `LayoutAnimation.configureNext` (gated on
 *     `!reducedMotion`, same idiom as InlineAddItem.tsx/HomeCardManager/MonthlyResetReviewSheet)
 *     so the height change glides instead of popping.
 *   - **Keyboard-avoidance (2026-07-31)**: `useKeyboardLift` lifts the whole panel (not just the
 *     field) above the keyboard — this row sits below the last Monthly list card, so on a
 *     populated Monthly tab it's easily hidden behind the keyboard. FormControls' `Input` isn't
 *     a forwardRef component, so the ref/onFocus/onBlur trio targets this panel View instead of
 *     the field itself (still accurate: the whole panel moves together).
 */
import React, { useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, MIN_TAP_TARGET, OpticalCenter, Radius, Spacing, contrastOn } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { Input } from '@/components/FormControls';
import PressableScale from '@/components/PressableScale';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

type Props = {
  onCreate: (name: string) => void;
};

export default function NewMonthlyListRow({ onCreate }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const lift = useKeyboardLift<View>();

  function collapse() {
    setName('');
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    // Big-ish plain white/surface button. The 2026-07-23 declutter pass made this icon-only
    // and left the label to `accessibilityLabel`; the WORD came back on 2026-08-03, because
    // that pass was reasoning about a crowded, populated card header and this trigger's
    // hardest moment is the opposite one. On an empty Shopping tab it is the only thing on
    // screen, and a first-time-user walkthrough found it the one primary add in the app that
    // does not say what it does — To-do and Habits both draw a labelled "Type task"/"Type
    // habit" line. A bare glyph declutters a busy row; on an empty tab there is nothing to
    // declutter and everything to explain. The icon stays, so nothing about the affordance
    // changed — it just reads now.
    return (
      <PressableScale
        // SECONDARY — accent-tinted, matching "Add dish" and (before 2026-08-09) the item
        // composer. It used to be the one neutral-white trigger on a screen whose other two
        // adds were accent-tinted, which read as a difference in KIND when it is only a
        // difference in what gets created. The screen's single primary is InlineAddItem's
        // solid bar; everything else on it is this weight.
        style={[styles.addBar, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
        onPress={() => {
          if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t.newMonthlyListBtn}
        scaleTo={0.97}
      >
        <Ionicons name="add" size={22} color={theme.accent} />
        <Text style={[styles.addBarLabel, { color: theme.accent }]}>{t.newMonthlyListBtn}</Text>
      </PressableScale>
    );
  }

  const canCreate = name.trim().length > 0;
  return (
    <View
      ref={lift.ref}
      style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Input
        value={name}
        onChangeText={setName}
        placeholder={t.newMonthlyListNamePlaceholder}
        returnKeyType="done"
        autoFocus
        onSubmitEditing={handleCreate}
        onFocus={lift.onFocus}
        onBlur={() => {
          lift.onBlur();
          if (name.trim()) return;
          if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(false);
        }}
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
    // Sits between the glyph and its label (2026-08-03). `gap` rather than a margin on the
    // Text so the pair stays centred as one unit at any font scale.
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  addBarLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold, ...OpticalCenter },
  panel: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  // `minHeight: MIN_TAP_TARGET` + justifyContent (2026-08-13): `paddingVertical: Spacing.sm`
  // around a FontSize.md line came to ~40px, under DESIGN_RULES.md rule 17's 48. The padding
  // stays so the buttons don't shrink at a large font scale — the floor only applies at small.
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold, ...OpticalCenter },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md, ...OpticalCenter },
});
