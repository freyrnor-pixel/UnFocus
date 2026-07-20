/**
 * InboxSection.tsx — home-screen list of captured quick-capture items (AP-02)
 *
 * Shows whatever's currently sitting in the inbox (store/useInboxStore.ts) so a
 * captured thought doesn't get forgotten: each row offers a one-tap "→ Task"
 * promotion (sensible defaults, no intermediate form), an edit affordance that
 * routes to /capture?id= (not a new inline text-edit UI — see Decision 009
 * Session A), or a "Discard" dismiss. Renders nothing when the inbox is empty
 * — mirrors app/index.tsx's Backlog section (incidental leftover data, not a
 * permanent fixture like Plans/Shopping).
 *
 * Connections:
 *   Imports → components/ExpandableCard, components/PressableScale, constants/theme,
 *             expo-router, lib/date, lib/haptics, lib/i18n, lib/useAppTheme, store/useInboxStore
 *   Used by → (no longer mounted on Home — replaced by components/HomeNotesCard which reads useNotesStore)
 *   Data    → reads/writes useInboxStore (inbox_items, Phase 5 stub); promoteToTask()
 *             also writes useTaskStore; Edit routes to /capture?id= to edit a row
 *             (route not ported yet either — out of scope per this component's own port)
 *
 * Edit notes:
 *   - Decision 009 Session A refactor (superseding the old Surface-wrapped flat
 *     list): the whole section is now ONE `ExpandableCard` (title = section title,
 *     badge = item count, `defaultOpen` true for visibility parity with the old
 *     always-shown card) rather than a bare `<Surface>` — matches Decision 009 #2's
 *     "all three Home previews render through ExpandableCard." No "See more →" link
 *     is added: unlike Plans/Shopping, the inbox has no separate full-list screen to
 *     route to (items get promoted or discarded, not browsed) — inventing one would
 *     be out of scope for this component-only refactor.
 *   - Decision 012: note editing is a shipped, working feature, not a gap — this
 *     refactor's "edit" affordance is the SAME existing `/capture?id=` route the old
 *     component already had, just relocated into the new card body. Per Decision 009
 *     Session A's explicit instruction, this is "surface the existing route as an
 *     edit affordance," not a new inline-text-edit UI with its own draft state.
 *   - Promotion defaults: today's date, start-at type, no recurrence, regular
 *     importance — deliberately skips task-form so capture stays frictionless;
 *     the user can still open the resulting task to fine-tune it later.
 *   - success() fires on promote (haptic={false} on that button so it doesn't also
 *     fire PressableScale's default tap()); discard keeps PressableScale's default
 *     tap() — dismissing a quick note isn't a destructive confirmation flow.
 *   - Token remap (Decision 006): offWhite→surfaceMuted (row divider), text→text,
 *     orangeLight/orange→accentSoft/accent (promote pill), grayLight→surfaceMuted
 *     (edit/discard pills), textLight→textMuted (edit/discard pill text).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { success } from '@/lib/haptics';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import ExpandableCard from '@/components/ExpandableCard';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useInboxStore } from '@/store/useInboxStore';

export default function InboxSection() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const items = useInboxStore((s) => s.items);
  const promoteToTask = useInboxStore((s) => s.promoteToTask);
  const remove = useInboxStore((s) => s.remove);

  if (items.length === 0) return null;

  function handlePromote(id: string, text: string) {
    success();
    promoteToTask(id, {
      title: text,
      date: todayStr(),
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      sortOrder: 0,
    });
  }

  return (
    <ExpandableCard
      title={t.inbox.sectionTitle}
      badge={String(items.length)}
      defaultOpen
    >
      {items.map((item, i) => (
        <View
          key={item.id}
          style={[styles.row, i > 0 && { borderTopColor: theme.surfaceMuted, borderTopWidth: 1, paddingTop: Spacing.sm }]}
        >
          <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={2}>
            {item.text}
          </Text>
          <View style={styles.actions}>
            <PressableScale
              style={[styles.actionBtn, { backgroundColor: theme.accentSoft }]}
              onPress={() => handlePromote(item.id, item.text)}
              haptic={false}
              scaleTo={0.97}
            >
              <Text style={[styles.actionBtnText, { color: theme.accent }]}>{t.inbox.promote}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => router.push({ pathname: '/capture', params: { id: item.id } })}
              scaleTo={0.97}
            >
              <Text style={[styles.actionBtnText, { color: theme.textMuted }]}>{t.inbox.edit}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
              onPress={() => remove(item.id)}
              scaleTo={0.97}
            >
              <Text style={[styles.actionBtnText, { color: theme.textMuted }]}>{t.inbox.discard}</Text>
            </PressableScale>
          </View>
        </View>
      ))}
    </ExpandableCard>
  );
}

const baseStyles = StyleSheet.create({
  row: { gap: Spacing.xs, paddingBottom: Spacing.sm },
  itemText: { fontSize: FontSize.sm, fontFamily: Fonts.regular },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  actionBtnText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
