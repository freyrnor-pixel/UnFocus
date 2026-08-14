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
 *             (Domain), lib/haptics (tap, warning), lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/HomeNotesCard.tsx (the ⋯ on a note row) and app/notes.tsx (the ⋯ on
 *             a note row THERE, 2026-08-01 — this line claimed the notes screen for months
 *             before it was true; it is now)
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
 *     `domain="task"` with the same flag glyph components/SubScreenLinkButton.tsx uses for it
 *     (that file dropped its own `domain` prop on 2026-08-08 and draws the flag as a bare
 *     glyph in the screen hue — the GLYPH is what is shared here, not the badge).
 *     Note "todo" here means the Plans/day view (`domain="plan"`) — same hue either way.
 *   - **The Goals row says "Personal goals", and that is deliberate (2026-08-13).** The two
 *     Goals drawers were renamed apart that day — Personal on Habits, Practical on To-do — and
 *     `lib/prefill.ts`'s `goals` slot lands on the HABITS tab, so this target opens the
 *     personal one. Counterintuitive next to the "To-do" row right above it, which is why the
 *     label names the destination rather than the feature. If the prefill slot is ever
 *     re-pointed at the To-do drawer, this string has to move with it.
 *   - Closes itself on pick (the caller is about to navigate); no confirm step, because the
 *     created row lands focused and editable, which IS the confirm.
 *   - **The optional delete row is not a fifth target** (2026-08-01, app/notes.tsx). It sits
 *     under a rule, carries no identity badge, and fires `warning()` rather than `tap()`,
 *     because everything above it moves the note somewhere and this one ends it. It exists
 *     because the row rule allows a row ONE action button: on the notes screen that button is
 *     this sheet, so a per-row delete has nowhere else to live. It still deletes immediately
 *     with no confirm — the sheet itself is the deliberate step, and a note is one row.
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
import { tap, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Where a note can be sent. */
export type SendToTarget = 'shopping' | 'habits' | 'goals' | 'todo';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (target: SendToTarget) => void;
  /**
   * Optional destructive row under the targets, separated by a rule. app/notes.tsx passes it:
   * that screen's row-level ⋯ is the ONE action button the row rule allows, so "delete this
   * note" has nowhere else to be. Omitted (Home's pad) renders nothing — the sheet is still a
   * send-to picker first.
   */
  onDelete?: () => void;
  deleteLabel?: string;
};

export default function SendToSheet({ visible, onClose, onPick, onDelete, deleteLabel }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const featureGoals = useSettingsStore((s) => s.featureGoals);

  // Identity hue rides the badge FILL, never the glyph colour — see the header's A.4 note.
  const targets: { id: SendToTarget; label: string; icon: keyof typeof Ionicons.glyphMap; domain: Domain }[] = [
    { id: 'todo', label: t.sendTo.todo, icon: 'calendar', domain: 'plan' },
    { id: 'shopping', label: t.sendTo.shopping, icon: 'cart', domain: 'shop' },
    { id: 'habits', label: t.sendTo.habits, icon: 'repeat', domain: 'habit' },
    // Goals is the one target whose destination can be switched off (2026-08-12). It used to
    // have a screen of its own that stayed reachable with the feature off; now it is a drawer
    // on the Habits tab that `featureGoals` removes outright — and picking a target TICKS THE
    // NOTE OFF, so offering a destination that isn't mounted would quietly consume the note.
    ...(featureGoals
      ? [{ id: 'goals' as const, label: t.sendTo.goals, icon: 'flag' as const, domain: 'task' as const }]
      : []),
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

        {onDelete ? (
          <>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
            <PressableScale
              style={[styles.option, { borderColor: theme.border }]}
              onPress={() => {
                warning();
                onDelete();
                onClose();
              }}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={deleteLabel ?? t.deleteConfirmBtn}
            >
              {/* No badge: this is not a destination, and a filled identity badge is how the
                  four above say that they are. A bare glyph in `bad` reads as the one row
                  that does something to the note rather than with it. */}
              <Ionicons name="trash-outline" size={20} color={theme.bad} style={styles.deleteIcon} />
              <Text style={[styles.optionLabel, { color: theme.bad }]}>{deleteLabel ?? t.deleteConfirmBtn}</Text>
            </PressableScale>
          </>
        ) : null}
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
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.xs },
  // Sits where a target's 28px badge would, so the labels line up down the sheet.
  deleteIcon: { width: 28, textAlign: 'center' },
});
