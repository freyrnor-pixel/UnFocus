/**
 * SendToSheet.tsx — "send this somewhere": the picker behind a pad row's ⋯ button.
 *
 * A note is often the wrong shape for what it turns out to be — it's really a shopping item, a
 * habit, a goal, or a to-do. This sheet is the one-tap conversion (2026-07-30, user report:
 * "action button opens pop-up that asks user if they want to add to shopping, habits, goals or
 * to-do — if one is pressed, then app creates new row in the selected thing, and selects
 * text-box"). The caller does the creating; this only asks where.
 *
 * On pick, the caller's contract (see components/HomeNotesCard.tsx) is: navigate to that
 * surface with the note's text pre-filled and its field focused, and tick the note off — it
 * has been dealt with, so the pad clears itself as things are routed out of it.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/PressableScale, components/Surface,
 *             components/CardAccent (CardAccentBadge), constants/theme, lib/domainColor
 *             (Domain), lib/haptics (tap), lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/HomeNotesCard.tsx (the ⋯ on a note row), app/notes.tsx
 *   Data    → none — presentational; `onPick` carries the choice back to the caller
 *
 * Edit notes:
 *   - Option rows deliberately copy components/LayoutPickerSheet.tsx's geometry (minHeight 56,
 *     Radius.md, borderWidth 1, surfaceMuted fill) so the app has one bottom-sheet option row,
 *     not two that nearly match.
 *   - Each target carries its destination's OWN identity hue so the choice is colour-coded the
 *     same way the destination card is — as a `CardAccentBadge` FILL, not as a tinted icon.
 *     It was a bare `<Ionicons color={domainAccent}>` until 2026-07-31 (addendum A.4 rule 1:
 *     an identity hue is a fill, never an icon colour), which on the Shopping gold was a
 *     2.25:1 glyph on the row's muted fill. The badge keeps the distinction and fixes the
 *     contrast, since the badge picks its own ink.
 *   - Goals has no `Domain` entry of its own: A.3 gives goals the To-do hue, so it rides
 *     `domain="task"` with the flag glyph components/SubScreenLinkButton.tsx already uses for
 *     it. Note "todo" here means the Plans/day view (`domain="plan"`) — same hue either way.
 *   - Closes itself on pick (the caller is about to navigate); no confirm step, because the
 *     created row lands focused and editable, which IS the confirm.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { CardAccentBadge } from '@/components/CardAccent';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { Domain } from '@/lib/domainColor';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

/** Where a note can be sent. */
export type SendToTarget = 'shopping' | 'habits' | 'goals' | 'todo';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (target: SendToTarget) => void;
};

export default function SendToSheet({ visible, onClose, onPick }: Props) {
  const theme = useAppTheme();
  const t = useT();

  // Identity hue rides the badge FILL, never the glyph colour — see the header's A.4 note.
  const targets: { id: SendToTarget; label: string; icon: keyof typeof Ionicons.glyphMap; domain: Domain }[] = [
    { id: 'todo', label: t.sendTo.todo, icon: 'calendar', domain: 'plan' },
    { id: 'shopping', label: t.sendTo.shopping, icon: 'cart', domain: 'shop' },
    { id: 'habits', label: t.sendTo.habits, icon: 'repeat', domain: 'habit' },
    { id: 'goals', label: t.sendTo.goals, icon: 'flag', domain: 'task' },
  ];

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.sendTo.title}</Text>

        {targets.map((target) => (
          <PressableScale
            key={target.id}
            style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
            onPress={() => {
              tap();
              onPick(target.id);
              onClose();
            }}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={target.label}
          >
            <CardAccentBadge domain={target.domain} icon={target.icon} size={28} />
            <Text style={[styles.optionLabel, { color: theme.text }]}>{target.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </PressableScale>
        ))}
      </Surface>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
  },
  optionLabel: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
});
