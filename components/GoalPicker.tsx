/**
 * GoalPicker.tsx — connect a task or habit to a Goal, from a single dropdown field.
 *
 * A self-contained form field: the label ("Goal"/"Mål") is always shown, muted, whether or
 * not anything is linked. Below it, ONE dropdown box — the linked goal's title (with its
 * living-glow dot) or a muted "not linked" placeholder, plus a chevron — opens the SAME
 * column of active goals either way (2026-08-06: switching goals used to mean unlinking
 * first; now the box always opens the picker). That column also carries a delete affordance
 * per goal and an inline "new goal" row pinned at its bottom, so create/select/delete all
 * happen without leaving the field. (Goals can also be created/deleted from
 * components/GoalsEditor.tsx — this is the per-item picker, not the only
 * place goals are managed.) Modeled on the "Then" follower picker in components/TaskCard.tsx
 * (was app/task-form.tsx, retired 2026-07-23).
 *
 * Connections:
 *   Imports → components/IconButton, components/PressableScale,
 *             components/GoalGlowDot, components/FormControls (Input), components/OptionalTag,
 *             constants/theme, lib/useAppTheme, lib/i18n, lib/haptics, lib/useKeyboardLift,
 *             store/useGoalStore, components/AppModal, @expo/vector-icons (the chevron)
 *   Used by → components/TaskCard.tsx (was app/task-form.tsx, retired 2026-07-23, UX audit
 *             B1 — see that file's header), app/habit-form.tsx
 *   Data    → reads/writes useGoalStore (goals table) via add/rename/remove; the selected
 *             goalId is owned by the parent form and flows in via `value`/`onChange`
 *
 * Edit notes:
 *   - One goal per item: `value` is a single goalId | null. Picking replaces; the "X" beside
 *     the box unlinks (onChange(null)) without deleting the goal itself, and sits as a
 *     SIBLING of the box's main tap area rather than nested inside it — two independently
 *     tappable regions, not one Pressable inside another.
 *   - Deleting a goal here removes it everywhere (useGoalStore.remove nulls every linked
 *     task/habit); if the deleted goal was the current selection, we also unlink it locally.
 *   - **Keyboard-avoidance (2026-08-01)**: the inline "new goal" field self-lifts via
 *     `useKeyboardLift` (wrapping its `newInputWrap` View, since `Input` doesn't forward a
 *     ref) — needed when this picker is embedded in `TaskCard.tsx`, which has no page-level
 *     `KeyboardAvoidingView` of its own; harmless/no-op inside `habit-form.tsx`, which already
 *     wraps its whole form in one.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import IconButton from '@/components/IconButton';
import PressableScale from '@/components/PressableScale';
import { Input } from '@/components/FormControls';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { confirmDestructive } from '@/components/AppModal';
import OptionalTag from '@/components/OptionalTag';
import { Fonts, FontSize, IconSize, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { selection, tap } from '@/lib/haptics';
import { useGoalStore } from '@/store/useGoalStore';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

type Props = {
  value: string | null;
  onChange: (goalId: string | null) => void;
};

export function GoalPicker({ value, onChange }: Props) {
  const router = useRouter();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const goals = useGoalStore((s) => s.goals);
  const addGoal = useGoalStore((s) => s.add);
  const removeGoal = useGoalStore((s) => s.remove);

  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const newGoalLift = useKeyboardLift<View>();

  const selected = value ? (goals.find((g) => g.id === value) ?? null) : null;

  function pick(id: string) {
    selection();
    onChange(id);
    setOpen(false);
  }

  function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    tap();
    const goal = addGoal(title);
    setNewTitle('');
    onChange(goal.id);
    setOpen(false);
  }

  function confirmDelete(id: string, title: string) {
    confirmDestructive({
      title: t.goals.deleteConfirmTitle(title || t.goals.pickerLabel),
      message: t.goals.deleteConfirmBody,
      confirmLabel: t.goals.deleteLabel,
      onConfirm: () => {
        removeGoal(id);
        if (value === id) onChange(null);
      },
    });
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textMuted }]}>{t.goals.pickerLabel}</Text>
        <OptionalTag />
      </View>

      {/* One dropdown box, not "chip when picked / button when not" (2026-08-06) — tapping
          it ALWAYS opens the same column of active goals, whether or not one is already
          selected, so switching goals no longer means unlinking first. The "X" (when a goal
          IS selected) is a separate sibling target next to the box's main tap area rather
          than nested inside it, so the two touches never fight over the same responder. */}
      <View style={[styles.box, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <PressableScale
          style={styles.boxMain}
          onPress={() => { tap(); setOpen((v) => !v); }}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={t.goals.pickerLabel}
          accessibilityState={{ expanded: open }}
        >
          {selected ? (
            <GoalGlowDot
              color={selected.color}
              strength={selected.strength}
              strengthUpdatedAt={selected.strengthUpdatedAt}
            />
          ) : null}
          <Text
            style={[styles.rowText, { color: selected ? theme.text : theme.textMuted }]}
            numberOfLines={1}
          >
            {selected ? selected.title : t.goals.none}
          </Text>
        </PressableScale>
        {selected ? (
          <IconButton icon="close-circle" label={t.goals.remove} onPress={() => onChange(null)} size={IconSize.inline} />
        ) : null}
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textMuted}
          style={styles.chevron}
        />
      </View>

      {open && (
        <View style={[styles.list, { backgroundColor: theme.surfaceMuted }]}>
          {goals.length === 0 ? (
            <Text style={[styles.hint, styles.emptyPad, { color: theme.textMuted }]}>
              {t.goals.emptyList}
            </Text>
          ) : (
            goals.map((g, i) => (
              <View
                key={g.id}
                style={[
                  styles.pickRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.border,
                  },
                ]}
              >
                <PressableScale
                  style={styles.pickRowMain}
                  onPress={() => pick(g.id)}
                  scaleTo={0.97}
                >
                  <GoalGlowDot
                    color={g.color}
                    strength={g.strength}
                    strengthUpdatedAt={g.strengthUpdatedAt}
                  />
                  <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>
                    {g.title}
                  </Text>
                </PressableScale>
                <IconButton
                  icon="trash-outline"
                  label={t.goals.deleteLabel}
                  onPress={() => confirmDelete(g.id, g.title)}
                  size={IconSize.inline}
                />
              </View>
            ))
          )}
          <View
            style={[
              styles.newRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}
          >
            <View style={styles.newInputWrap} ref={newGoalLift.ref}>
              <Input
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={t.goals.newPlaceholder}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                onFocus={newGoalLift.onFocus}
                onBlur={newGoalLift.onBlur}
              />
            </View>
            <IconButton icon="add" label={t.goals.add} onPress={handleCreate} />
          </View>
          {/* ⚠️ **"Edit goals", pinned last (2026-09-01).** The two folded `GoalsEditor` sections
              — To-do's "Practical goals" and Habits' "Personal goals", the same editor over the
              same store under two labels on two tabs — are deleted, and the picker is the way in
              now. Maintainer: *"Goal editing is done by an 'Edit Goals' button that appears at
              the bottom of the drop-down-menu when user presses 'Goal' in card."*
                BELOW the inline new-goal row rather than instead of it: creating a goal you have
              already thought of should not cost a screen, and this is for everything the field
              cannot do (deleting several, reading strength — not renaming, which stays impossible
              because a goal's id is derived from its name).
                It closes the dropdown on the way out, so returning from the pop-up does not land
              on a menu the user has finished with. */}
          <PressableScale
            style={[styles.editRow, { borderTopColor: theme.border }]}
            onPress={() => {
              tap();
              setOpen(false);
              router.push('/goals-editor');
            }}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={t.goals.editGoals}
          >
            <Ionicons name="options-outline" size={16} color={theme.textMuted} />
            <Text style={[styles.rowText, { color: theme.textMuted }]}>{t.goals.editGoals}</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  hint: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  // The dropdown box (2026-08-06) — one shape whether or not a goal is selected. `boxMain`
  // is the tappable label area (opens the column below); the "X" unlink button and the
  // chevron are its siblings, not nested inside it — see the render-side note.
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  boxMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chevron: { marginLeft: 2 },
  rowText: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  list: { borderRadius: Radius.md, marginTop: Spacing.xs, overflow: 'hidden' },
  emptyPad: { padding: Spacing.md, marginTop: 0 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.sm },
  pickRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  // The "Edit goals" row at the foot of the open dropdown — see the call site. Floored at
  // MIN_TAP_TARGET because it is the last thing in a list of tappable rows and must not be the
  // one that is harder to hit.
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm },
  newInputWrap: { flex: 1 },
});
