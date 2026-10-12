/**
 * BudgetFields.tsx — the Shopping Budget card's editable numbers: each Monthly list's budget and
 * the payday it resets on, typed straight into the card (2026-09-26).
 *
 * Maintainer, 2026-09-26: *"energi og månedsbudsjett må kunne redigeres i kortet, ikke via
 * innstillinger"*. Until then the card only DISPLAYED "Beløp per måned" and "Lønningsdag"; the
 * amount was reachable only through a Monthly list's Budget pill → app/budget.tsx, and payday only
 * through Settings. Its empty state even said *"Set a monthly budget in Settings"* — which was not
 * true, Settings has had no budget field since 2026-07-22. An empty card now shows its field.
 *
 * **One field per Monthly list, not one total.** Budget is per list since 2026-07-22
 * (store/useMonthlyListStore.ts); the card's figures are the sum. A single "total" field would
 * have to invent how to split a typed number across lists, so with two lists there are two fields,
 * each labelled with its list's name. The common single-list case reads as one plain field.
 *
 * **Commit on blur / submit, never per keystroke.** A half-typed "4" must not become the budget
 * and re-pace the card mid-word. An invalid value (not a number, payday outside 1–31) quietly
 * reverts to the stored one — no warning copy (DESIGN_RULES rule 23's spirit: nothing here
 * evaluates the number).
 *
 * **Paid once or twice a month (2026-10-12).** A segmented "Monthly / Twice a month" under the
 * payday; "twice" reveals a second payday field (settings.secondPayday, 0 = once). The card then
 * paces over the half-month it is in — lib/budget.ts's `payPeriod`.
 *
 * Connections:
 *   Imports → components/FormControls (Input, SegmentedControl), lib/budget (hasSecondPayday), constants/theme (Spacing, FIELD_GLOW_CLEARANCE), lib/i18n, lib/reminders
 *             (syncReminders — payday moves the monthly reminder, the same re-sync app/settings.tsx
 *             does for `monthlyResetDate`), lib/useAppTheme, store/useMonthlyListStore,
 *             store/useSettingsStore
 *   Used by → app/(tabs)/shopping.tsx (the `shopBudget` card)
 *   Data    → writes monthly_lists.budget_nok via useMonthlyListStore.setBudget, and
 *             settings.monthlyResetDate / secondPayday via useSettingsStore.update
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Input, SegmentedControl } from '@/components/FormControls';
import { hasSecondPayday } from '@/lib/budget';
import { FIELD_GLOW_CLEARANCE, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { syncReminders } from '@/lib/reminders';
import { useScaledStyles } from '@/lib/useAppTheme';
import { useMonthlyListStore, monthlyListLabel, type MonthlyList } from '@/store/useMonthlyListStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/** A number field that holds its own draft and commits on blur/submit. */
function NumberField({
  label,
  stored,
  parse,
  onCommit,
  maxLength,
  placeholder,
}: {
  label: string;
  stored: number;
  /** Returns the value to store, or null to revert to `stored`. */
  parse: (raw: string) => number | null;
  onCommit: (next: number) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  const shown = stored > 0 ? String(stored) : '';
  const [draft, setDraft] = useState(shown);
  // A write from elsewhere (app/budget.tsx, Settings, sync) replaces the draft.
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const next = parse(draft.trim());
    if (next === null) {
      setDraft(shown);
      return;
    }
    if (next !== stored) onCommit(next);
  };

  return (
    <Input
      recessed
      label={label}
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="number-pad"
      returnKeyType="done"
      maxLength={maxLength}
      placeholder={placeholder}
    />
  );
}

export default function BudgetFields() {
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const lists = useMonthlyListStore((s) => s.lists);
  const setBudget = useMonthlyListStore((s) => s.setBudget);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const secondPayday = useSettingsStore((s) => s.secondPayday);
  const twice = hasSecondPayday(monthlyResetDate, secondPayday);
  const updateSettings = useSettingsStore((s) => s.update);

  const parseAmount = (raw: string) => {
    if (raw === '') return 0;
    const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const parsePayday = (raw: string) => {
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
  };

  const amountLabel = (list: MonthlyList) =>
    lists.length > 1
      ? `${monthlyListLabel(list, t.defaultMonthlyListName)} · ${t.budget.amountPerMonth}`
      : t.budget.amountPerMonth;

  return (
    <View style={styles.fields}>
      {lists.map((list) => (
        <NumberField
          key={list.id}
          label={amountLabel(list)}
          stored={list.budgetNok}
          parse={parseAmount}
          onCommit={(n) => setBudget(list.id, n)}
          maxLength={9}
          placeholder="0"
        />
      ))}
      <NumberField
        label={t.budget.paydayLabel}
        stored={monthlyResetDate}
        parse={parsePayday}
        onCommit={(n) => {
          updateSettings({ monthlyResetDate: n });
          void syncReminders();
        }}
        maxLength={2}
        placeholder="1–31"
      />
      {/* Paid once or twice a month (2026-10-12). "Twice" seeds the second payday half a month
          on, so the choice works the moment it is made; the field below adjusts it. */}
      <SegmentedControl<'once' | 'twice'>
        options={[
          { value: 'once', label: t.budget.payOnce },
          { value: 'twice', label: t.budget.payTwice },
        ]}
        value={twice ? 'twice' : 'once'}
        onChange={(v) =>
          updateSettings({ secondPayday: v === 'twice' ? ((monthlyResetDate + 14) % 31) + 1 : 0 })
        }
      />
      {twice && (
        <NumberField
          label={t.budget.secondPaydayLabel}
          stored={secondPayday}
          parse={(raw) => {
            const n = parsePayday(raw);
            return n !== null && n !== monthlyResetDate ? n : null;
          }}
          onCommit={(n) => updateSettings({ secondPayday: n })}
          maxLength={2}
          placeholder="1–31"
        />
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // `padding: FIELD_GLOW_CLEARANCE` — the room each focused field's glow needs (constants/theme.ts);
  // flush inside the card, the halo audit measured 0px of it on every side.
  fields: { gap: Spacing.sm, padding: FIELD_GLOW_CLEARANCE },
});
