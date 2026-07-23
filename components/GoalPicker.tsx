/**
 * GoalPicker.tsx — connect a task or habit to a Goal (the ONLY place goals are managed).
 *
 * A self-contained form field: shows the currently-linked goal (with its living-glow dot)
 * or a muted "not linked" state; opens an inline list of existing goals to pick from, each
 * with a delete affordance; and offers an inline "new goal" input to create one on the spot.
 * There is no dedicated Goals screen — create/select/delete all happen here. Modeled on the
 * "Then" follower picker in app/task-form.tsx.
 *
 * Connections:
 *   Imports → components/Button, components/IconButton, components/PressableScale,
 *             components/GoalGlowDot, components/FormControls (Input), constants/theme,
 *             lib/useAppTheme, lib/i18n, lib/haptics, store/useGoalStore, components/AppModal
 *   Used by → app/task-form.tsx, app/habit-form.tsx
 *   Data    → reads/writes useGoalStore (goals table) via add/rename/remove; the selected
 *             goalId is owned by the parent form and flows in via `value`/`onChange`
 *
 * Edit notes:
 *   - One goal per item: `value` is a single goalId | null. Picking replaces; the close
 *     button unlinks (onChange(null)) without deleting the goal itself.
 *   - Deleting a goal here removes it everywhere (useGoalStore.remove nulls every linked
 *     task/habit); if the deleted goal was the current selection, we also unlink it locally.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import PressableScale from '@/components/PressableScale';
import { Input } from '@/components/FormControls';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { showAppModal } from '@/components/AppModal';
import { Spacing, Radius, FontSize, Fonts } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { selection, tap } from '@/lib/haptics';
import { useGoalStore } from '@/store/useGoalStore';

type Props = {
  value: string | null;
  onChange: (goalId: string | null) => void;
};

export function GoalPicker({ value, onChange }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const goals = useGoalStore((s) => s.goals);
  const addGoal = useGoalStore((s) => s.add);
  const removeGoal = useGoalStore((s) => s.remove);

  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const selected = value ? goals.find((g) => g.id === value) ?? null : null;

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
    showAppModal(t.goals.deleteConfirmTitle(title || t.goals.pickerLabel), t.goals.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.goals.deleteLabel,
        style: 'destructive',
        onPress: () => {
          removeGoal(id);
          if (value === id) onChange(null);
        },
      },
    ]);
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{t.goals.pickerLabel}</Text>

      {selected ? (
        <View style={[styles.row, { backgroundColor: theme.surfaceMuted }]}>
          <GoalGlowDot color={selected.color} strength={selected.strength} strengthUpdatedAt={selected.strengthUpdatedAt} />
          <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>
            {selected.title}
          </Text>
          <IconButton icon="close-circle" label={t.goals.remove} onPress={() => onChange(null)} size={28} />
        </View>
      ) : (
        <>
          <Text style={[styles.hint, { color: theme.textMuted }]}>{t.goals.none}</Text>
          <Button
            label={t.goals.pick}
            variant="secondary"
            size="sm"
            onPress={() => setOpen((v) => !v)}
            style={styles.pickBtn}
          />
        </>
      )}

      {open && !selected && (
        <View style={[styles.list, { backgroundColor: theme.surfaceMuted }]}>
          {goals.length === 0 ? (
            <Text style={[styles.hint, styles.emptyPad, { color: theme.textMuted }]}>{t.goals.emptyList}</Text>
          ) : (
            goals.map((g, i) => (
              <View
                key={g.id}
                style={[
                  styles.pickRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                ]}
              >
                <PressableScale style={styles.pickRowMain} onPress={() => pick(g.id)} scaleTo={0.97}>
                  <GoalGlowDot color={g.color} strength={g.strength} strengthUpdatedAt={g.strengthUpdatedAt} />
                  <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>
                    {g.title}
                  </Text>
                </PressableScale>
                <IconButton icon="trash-outline" label={t.goals.deleteLabel} onPress={() => confirmDelete(g.id, g.title)} size={26} />
              </View>
            ))
          )}
          <View style={[styles.newRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <View style={styles.newInputWrap}>
              <Input
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={t.goals.newPlaceholder}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
            </View>
            <IconButton icon="add" label={t.goals.add} onPress={handleCreate} />
          </View>
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  hint: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  rowText: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  pickBtn: { alignSelf: 'flex-start' },
  list: { borderRadius: Radius.md, marginTop: Spacing.xs, overflow: 'hidden' },
  emptyPad: { padding: Spacing.md, marginTop: 0 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.sm },
  pickRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm },
  newInputWrap: { flex: 1 },
});
