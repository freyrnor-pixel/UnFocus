/**
 * ShoppingStoreMode.tsx — the in-the-store view of one week list, screen kept awake.
 *
 * A full-screen mode (not a sheet — it is a place you stand in for twenty minutes, not a
 * picker you dismiss) that draws a single week list as the three sections the shopping flow
 * actually has, and moves rows between them with WORDED buttons rather than a tick:
 *
 *   I liste (to buy)  →  I handlekurv (in cart)  →  Kjøpt (bought)
 *
 * Every transition is reversible from the row it lands on, so a mis-tap in a shop costs one
 * tap to undo and nothing is a one-way door.
 *
 * Connections:
 *   Imports → components/Surface, components/Button, components/PressableScale,
 *             constants/theme, lib/screenColor, lib/shoppingGroups (computeListGroups),
 *             lib/haptics, lib/i18n, lib/useAppTheme, store/useShoppingStore
 *   Used by → app/(tabs)/shopping.tsx (a "Store mode" button on each week list)
 *   Data    → useShoppingStore: reads `items`, writes via toggleCheck / markPurchased /
 *             unmarkPurchased. Holds an expo-keep-awake lock while mounted.
 *
 * Edit notes:
 *   - **`useKeepAwake()` lives in `StoreModeBody`, which mounts only while the mode is open,
 *     and that placement is the whole contract.** The hook acquires on mount and releases on
 *     unmount, so scoping it to a body that is conditionally rendered is what guarantees the
 *     lock cannot outlive the mode. Called in the outer component instead it would run for
 *     the lifetime of the Shopping screen and hold the screen awake for a user who never
 *     opened store mode — a battery bug with no visible symptom. Pinned by
 *     __tests__/shoppingStoreMode.test.ts, which asserts the hook is not called at the
 *     top level of the exported component.
 *   - **`expo-keep-awake` needs no new native build.** It is not a new native module here:
 *     `expo@56` already depends on `expo-keep-awake@~56.0.3`, so the native code is in every
 *     existing build and this is an ordinary OTA-safe JS change. It is listed in package.json
 *     as a direct dependency because this file imports it directly, pinned with `~` to the
 *     SDK-bundled version per AGENTS.md's dependency-pinning rule — do NOT float it off the
 *     SDK's version, that is exactly the JS-ahead-of-native mismatch that rule exists for.
 *   - **The three sections come from `computeListGroups`, not from a local filter.** That
 *     function is the one place the section contract lives (see its header) and Home and the
 *     week card read the same buckets; a second copy here would drift.
 *   - Dish-grouped rows are FLATTENED into their section here on purpose. Store mode is a
 *     "what do I pick up next" surface — a dish grouping is a planning affordance, and the
 *     week card is where it stays.
 *   - Rows are deliberately plain, not `PadRow`: this surface's row is a title plus one big
 *     worded button, with no meta line, no right-hand value and no tick, so PadRow's anatomy
 *     would be mostly empty slots. It is also the one place in the app whose row is sized for
 *     reading at arm's length in bad light.
 *   - No progress bar, count-up or "X of Y done" anywhere. Same reasoning as the day log and
 *     the health card: a shopping list is a set of errands, not a score.
 */
import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Fonts, FontSize, HitSlop, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { selection, success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { getScreenColor } from '@/lib/screenColor';
import { computeListGroups } from '@/lib/shoppingGroups';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';

type Props = {
  visible: boolean;
  listId: string;
  listName: string;
  onClose: () => void;
};

/**
 * The mode's real body. Separate from the default export so `useKeepAwake` mounts and
 * unmounts with the mode itself — see this file's header for why that placement matters.
 */
function StoreModeBody({ listId, listName, onClose }: Omit<Props, 'visible'>) {
  useKeepAwake('unfocus-store-mode');

  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const hue = getScreenColor(theme, 'shopping');

  const items = useShoppingStore((s) => s.items);
  const toggleCheck = useShoppingStore((s) => s.toggleCheck);
  const markPurchased = useShoppingStore((s) => s.markPurchased);
  const unmarkPurchased = useShoppingStore((s) => s.unmarkPurchased);

  const groups = useMemo(() => computeListGroups(items, listId), [items, listId]);

  // Dish rows are flattened into their section here — see the header note.
  const dishRows = useMemo(
    () => groups.dishGroups.flatMap(([, its]) => its),
    [groups.dishGroups]
  );
  const toBuy = useMemo(
    () => [...groups.ungroupedUnchecked, ...dishRows.filter((i) => !i.checked)],
    [groups.ungroupedUnchecked, dishRows]
  );
  const inCart = useMemo(
    () => [...groups.checked, ...dishRows.filter((i) => i.checked)],
    [groups.checked, dishRows]
  );

  const isEmpty = toBuy.length === 0 && inCart.length === 0 && groups.purchased.length === 0;

  const row = (item: ShoppingItem, action: () => void, label: string, back?: () => void) => (
    <View key={item.id} style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        {!!item.amount && item.amount !== '1' && (
          <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
            {item.amount}
            {item.unit ? ` ${item.unit}` : ''}
          </Text>
        )}
      </View>
      {back && (
        <PressableScale
          onPress={() => {
            selection();
            back();
          }}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={t.moveToListBtn}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-undo-outline" size={20} color={theme.textMuted} />
        </PressableScale>
      )}
      <Button label={label} size="sm" variant="secondary" onPress={action} />
    </View>
  );

  const section = (title: string, children: React.ReactNode) => (
    <Surface borderColor={hue.base} style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{title}</Text>
      {children}
    </Surface>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {listName || t.storeModeTitle}
          </Text>
          <Text style={[styles.awakeNote, { color: theme.textMuted }]}>{t.storeModeAwakeNote}</Text>
        </View>
        <PressableScale
          onPress={onClose}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={t.storeModeExitBtn}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={26} color={theme.text} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {isEmpty && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>{t.storeModeEmpty}</Text>
        )}

        {toBuy.length > 0 &&
          section(
            t.toBuySection(toBuy.length),
            toBuy.map((i) =>
              row(
                i,
                () => {
                  selection();
                  toggleCheck(i.id);
                },
                t.moveToCartBtn
              )
            )
          )}

        {inCart.length > 0 &&
          section(
            t.inCartSection(inCart.length),
            inCart.map((i) =>
              row(
                i,
                () => {
                  success();
                  markPurchased(i.id);
                },
                t.markBoughtBtn,
                () => toggleCheck(i.id)
              )
            )
          )}

        {groups.purchased.length > 0 &&
          section(
            t.purchasedSection(groups.purchased.length),
            groups.purchased.map((i) => (
              <View key={i.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text
                    style={[styles.rowTitle, styles.boughtTitle, { color: theme.textMuted }]}
                    numberOfLines={2}
                  >
                    {i.name}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => {
                    selection();
                    unmarkPurchased(i.id);
                  }}
                  hitSlop={HitSlop.base}
                  accessibilityRole="button"
                  accessibilityLabel={t.undoBoughtBtn}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-undo-outline" size={20} color={theme.textMuted} />
                </PressableScale>
              </View>
            ))
          )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.storeModeExitBtn} variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}

export default function ShoppingStoreMode({ visible, listId, listName, onClose }: Props) {
  // The body is rendered only while open, which is what scopes the keep-awake lock.
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? (
        <StoreModeBody listId={listId} listName={listName} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  awakeNote: { fontSize: FontSize.sm, fontFamily: Fonts.regular, marginTop: 2 },
  closeBtn: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  section: { padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
  },
  // flex + minWidth 0 together: flex alone will not let a long name shrink beside the
  // fixed-width button, which is the wrap-audit's documented near-miss shape.
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: FontSize.lg, fontFamily: Fonts.medium },
  boughtTitle: { textDecorationLine: 'line-through' },
  rowMeta: { fontSize: FontSize.sm, fontFamily: Fonts.regular, marginTop: 2 },
  backBtn: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: FontSize.md, fontFamily: Fonts.regular, textAlign: 'center', padding: Spacing.xl },
  footer: { padding: Spacing.md, borderRadius: Radius.lg },
});
