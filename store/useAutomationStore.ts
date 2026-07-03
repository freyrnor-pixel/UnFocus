/**
 * useAutomationStore.ts — simple IFTTT-style "when X, do Y" rules
 *
 * Zustand store for user-defined automation rules: a trigger (something that
 * already happens in the app) paired with an action (something the app does
 * in response). Deliberately minimal — two trigger types, two action types —
 * per the "don't over-engineer" project guideline. fireTrigger() is called by
 * the trigger sites themselves (useTaskStore's toggle, app/shopping.tsx's
 * mount effect), not the other way around, so this store has no knowledge of
 * when its triggers fire.
 *
 * Connections:
 *   Imports → components/AppModal, lib/db, lib/dataAccess, lib/i18n, lib/id, store/useSettingsStore, store/useShoppingStore
 *   Used by → app/automations.tsx, app/shopping.tsx, store/useTaskStore.ts
 *   Data    → defines a Zustand store; owns SQLite table ifttt_rules
 *
 * Edit notes:
 *   - trigger_params is left at its DB default ('{}') — neither trigger type takes
 *     parameters today. Add a column-backed field only when a trigger actually needs one.
 *   - executeAction's 'show_message' branch uses showAppModal() directly (not
 *     ConfirmationBanner) because it must work from non-component call sites
 *     (store methods), where there's no screen-owned banner state to set — showAppModal()
 *     is a plain function, safe to call outside React.
 *   - New trigger/action types go through TriggerType/ActionType here AND the
 *     automations.tsx picker UI AND the call site that should fire them.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, loadAll, insertRow, updateRow, readStr, readInt, readBool, readJson } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { getTranslations } from '@/lib/i18n';
import { showAppModal } from '@/components/AppModal';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useShoppingStore } from '@/store/useShoppingStore';

export type TriggerType = 'task_completed' | 'shopping_opened';
export type ActionType = 'show_message' | 'add_shopping_item';

export type AutomationRule = {
  id: string;
  triggerType: TriggerType;
  actionType: ActionType;
  actionParams: Record<string, string>;
  active: boolean;
  createdAt: number;
};

type AutomationStore = {
  rules: AutomationRule[];
  load: () => void;
  add: (triggerType: TriggerType, actionType: ActionType, actionParams: Record<string, string>) => void;
  toggleActive: (id: string) => void;
  remove: (id: string) => void;
  fireTrigger: (type: TriggerType) => void;
};

function rowToRule(row: Row): AutomationRule {
  return {
    id: readStr(row, 'id'),
    triggerType: readStr(row, 'trigger_type') as TriggerType,
    actionType: readStr(row, 'action_type') as ActionType,
    actionParams: readJson<Record<string, string>>(row, 'action_params', {}),
    active: readBool(row, 'active'),
    createdAt: readInt(row, 'created_at'),
  };
}

function executeAction(rule: AutomationRule) {
  if (rule.actionType === 'show_message') {
    const message = rule.actionParams.message?.trim();
    if (!message) return;
    const t = getTranslations(useSettingsStore.getState().language);
    showAppModal(t.automations.alertTitle, message);
  } else if (rule.actionType === 'add_shopping_item') {
    const name = rule.actionParams.name?.trim();
    if (!name) return;
    const listType = rule.actionParams.listType === 'monthly' ? 'monthly' : 'weekly';
    useShoppingStore.getState().add({
      name,
      amount: '1',
      unit: '',
      listType,
      store: '',
      price: 0,
      inventoryQty: 0,
      status: listType === 'monthly' ? 'catalog' : 'inWeeklyList',
    });
  }
}

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  rules: [],

  load() {
    set({ rules: loadAll('ifttt_rules', rowToRule, { orderBy: 'created_at' }) });
  },

  add(triggerType, actionType, actionParams) {
    const id = generateId();
    const createdAt = Date.now();
    insertRow('ifttt_rules', {
      id,
      trigger_type: triggerType,
      action_type: actionType,
      action_params: JSON.stringify(actionParams),
      active: 1,
      created_at: createdAt,
    });
    set((s) => ({
      rules: [...s.rules, { id, triggerType, actionType, actionParams, active: true, createdAt }],
    }));
  },

  toggleActive(id) {
    const rule = get().rules.find((r) => r.id === id);
    if (!rule) return;
    const active = !rule.active;
    updateRow('ifttt_rules', { active: active ? 1 : 0 }, 'id = ?', [id]);
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, active } : r)) }));
  },

  remove(id) {
    db.runSync('DELETE FROM ifttt_rules WHERE id = ?', [id]);
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
  },

  fireTrigger(type) {
    get().rules.filter((r) => r.active && r.triggerType === type).forEach(executeAction);
  },
}));
