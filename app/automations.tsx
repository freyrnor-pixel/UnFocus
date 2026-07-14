/**
 * automations.tsx — simple IFTTT-style "when X, do Y" rule builder
 *
 * Lists the user's automation rules (When … → Then …), each with an active toggle
 * and delete. The "+ New automation" form is a simple inline card (not a modal route)
 * since there are only two trigger types and two action types to pick from.
 *
 * Connections:
 *   Imports → components/AppModal, components/ScreenScaffold, components/Surface,
 *             components/Collapsible (animated add-rule form reveal),
 *             components/PressableScale, constants/theme, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useAutomationStore
 *   Used by → Expo Router route "/automations"
 *   Data    → useAutomationStore (ifttt_rules table)
 *
 * Edit notes:
 *   - Decision 001 tier='sub' ScreenScaffold (back arrow, no BottomNav). Old SafeAreaView/
 *     ScreenHeader/SiteSwipeView/BottomNav chrome dropped — the scaffold owns it.
 *   - Trigger/action picker is two rows of chips, not a dropdown — only two options each today.
 *   - Saving is disabled until the action's required field (message / item name) is non-empty.
 *   - "New automation" is a bordered trigger pill (design-consistency pass — replaced the
 *     floating circular AddFAB, which floated disconnected from the rule list it fed) sitting
 *     right above the rule list, toggling showForm. NewRuleForm's own Cancel/Save footer stays
 *     put (it's a quick inline form with a chip picker, not a single-field AddRow candidate).
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen has no
 *     per-screen focus-load.
 */
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAutomationStore, AutomationRule, TriggerType, ActionType } from '@/store/useAutomationStore';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import { useT } from '@/lib/i18n';
import { warning, heavy } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

function triggerLabel(t: ReturnType<typeof useT>, type: TriggerType): string {
  return type === 'task_completed' ? t.automations.triggerTaskCompleted : t.automations.triggerShoppingOpened;
}

function actionLabel(t: ReturnType<typeof useT>, type: ActionType): string {
  return type === 'show_message' ? t.automations.actionShowMessage : t.automations.actionAddShoppingItem;
}

function actionDetail(t: ReturnType<typeof useT>, rule: AutomationRule): string {
  if (rule.actionType === 'show_message') return rule.actionParams.message ?? '';
  return rule.actionParams.name ?? '';
}

function RuleCard({ rule, onToggle, onDelete }: {
  rule: AutomationRule;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  function confirmDelete() {
    warning();
    showAppModal(t.automations.deleteTitle, t.automations.deleteBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.automations.deleteBtn, style: 'destructive', onPress: () => { heavy(); onDelete(rule.id); } },
    ]);
  }

  return (
    <Surface style={styles.ruleCard}>
      <View style={styles.ruleTextWrap}>
        <Text style={[styles.ruleSummary, { color: theme.text }]}>
          {t.automations.ruleSummary(triggerLabel(t, rule.triggerType), actionLabel(t, rule.actionType))}
        </Text>
        {!!actionDetail(t, rule) && (
          <Text style={[styles.ruleDetail, { color: theme.textMuted }]} numberOfLines={1}>
            {actionDetail(t, rule)}
          </Text>
        )}
      </View>
      <Switch
        value={rule.active}
        onValueChange={() => onToggle(rule.id)}
        trackColor={{ false: theme.border, true: theme.accentSoft }}
        thumbColor={rule.active ? theme.accent : theme.textMuted}
      />
      <PressableScale onPress={confirmDelete} hitSlop={8} style={styles.deleteBtn} scaleTo={0.93}>
        <Ionicons name="close" size={18} color={theme.textMuted} />
      </PressableScale>
    </Surface>
  );
}

function NewRuleForm({ onSave, onCancel }: { onSave: (triggerType: TriggerType, actionType: ActionType, params: Record<string, string>) => void; onCancel: () => void }) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [triggerType, setTriggerType] = useState<TriggerType>('task_completed');
  const [actionType, setActionType] = useState<ActionType>('show_message');
  const [message, setMessage] = useState('');
  const [itemName, setItemName] = useState('');

  const canSave = actionType === 'show_message' ? message.trim().length > 0 : itemName.trim().length > 0;

  function save() {
    if (!canSave) return;
    const params: Record<string, string> = actionType === 'show_message' ? { message: message.trim() } : { name: itemName.trim() };
    onSave(triggerType, actionType, params);
  }

  return (
    <Surface style={styles.formCard}>
      <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.automations.whenLabel}</Text>
      <View style={styles.chipRow}>
        {(['task_completed', 'shopping_opened'] as TriggerType[]).map((type) => (
          <PressableScale
            key={type}
            style={[
              styles.chip,
              { borderColor: theme.border },
              triggerType === type && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
            onPress={() => setTriggerType(type)}
            scaleTo={0.97}
          >
            <Text style={[styles.chipText, { color: triggerType === type ? theme.accentInk : theme.text }]}>
              {triggerLabel(t, type)}
            </Text>
          </PressableScale>
        ))}
      </View>

      <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.automations.thenLabel}</Text>
      <View style={styles.chipRow}>
        {(['show_message', 'add_shopping_item'] as ActionType[]).map((type) => (
          <PressableScale
            key={type}
            style={[
              styles.chip,
              { borderColor: theme.border },
              actionType === type && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
            onPress={() => setActionType(type)}
            scaleTo={0.97}
          >
            <Text style={[styles.chipText, { color: actionType === type ? theme.accentInk : theme.text }]}>
              {actionLabel(t, type)}
            </Text>
          </PressableScale>
        ))}
      </View>

      {actionType === 'show_message' ? (
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          value={message}
          onChangeText={setMessage}
          placeholder={t.automations.messagePlaceholder}
          placeholderTextColor={theme.textMuted}
        />
      ) : (
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          value={itemName}
          onChangeText={setItemName}
          placeholder={t.automations.itemNamePlaceholder}
          placeholderTextColor={theme.textMuted}
        />
      )}

      <View style={styles.formActions}>
        <PressableScale onPress={onCancel} style={styles.formCancelBtn} scaleTo={0.97}>
          <Text style={[styles.formCancelText, { color: theme.textMuted }]}>{t.cancel}</Text>
        </PressableScale>
        <PressableScale
          onPress={save}
          disabled={!canSave}
          style={[styles.formSaveBtn, { backgroundColor: canSave ? theme.accent : theme.surfaceMuted }]}
          scaleTo={0.95}
        >
          <Text style={[styles.formSaveText, { color: canSave ? theme.accentInk : theme.textMuted }]}>
            {t.automations.saveBtn}
          </Text>
        </PressableScale>
      </View>
    </Surface>
  );
}

export default function AutomationsScreen() {
  const router = useRouter();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const rules = useAutomationStore((s) => s.rules);
  const addRule = useAutomationStore((s) => s.add);
  const toggleActive = useAutomationStore((s) => s.toggleActive);
  const removeRule = useAutomationStore((s) => s.remove);
  const [showForm, setShowForm] = useState(false);

  function save(triggerType: TriggerType, actionType: ActionType, params: Record<string, string>) {
    addRule(triggerType, actionType, params);
    setShowForm(false);
  }

  return (
    <ScreenScaffold title={t.automations.title} tier="sub" onBack={() => router.back()}>
      <View style={styles.content}>
        {/* Design-consistency pass: the floating circular AddFAB (disconnected from the rule
            list it affects) is replaced by a bordered trigger pill attached right above the
            list — matching the "tap to open a fuller add flow" pill used on Shopping
            (monthlyTrigger / addTrigger / newListTrigger). NewRuleForm needs a trigger/action
            chip picker, so it isn't a single-field AddRow candidate. */}
        {!showForm && (
          <PressableScale
            style={[styles.addTrigger, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
            onPress={() => setShowForm(true)}
            accessibilityRole="button"
            accessibilityLabel={t.automations.addNew}
            scaleTo={0.97}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
            <Text style={[styles.addTriggerText, { color: theme.accent }]}>{t.automations.addNew}</Text>
          </PressableScale>
        )}
        <Collapsible open={showForm}>
          <NewRuleForm onSave={save} onCancel={() => setShowForm(false)} />
        </Collapsible>

        {rules.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>{t.automations.emptyState}</Text>
        ) : (
          rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onToggle={toggleActive} onDelete={removeRule} />
          ))
        )}
      </View>
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.sm },
  // Bordered trigger pill — same shape as Shopping's monthlyTrigger/addTrigger/newListTrigger
  // (design-consistency pass: one shared "tap to open a fuller add flow" affordance).
  addTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  addTriggerText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  empty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },

  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  ruleTextWrap: { flex: 1 },
  ruleSummary: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  ruleDetail: { fontSize: FontSize.xs, marginTop: 2 },
  deleteBtn: { padding: Spacing.xs },

  formCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  formLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: '600' },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: FontSize.sm,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  formCancelBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  formCancelText: { fontSize: FontSize.sm, fontWeight: '600' },
  formSaveBtn: { borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  formSaveText: { fontSize: FontSize.sm, fontWeight: '700' },
});
