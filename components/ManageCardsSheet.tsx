/**
 * ManageCardsSheet.tsx — "which cards do I want on this screen", scoped to ONE screen.
 *
 * Maintainer, 2026-08-30, asked whether hiding should be a per-card "⋮" (matching Home) or one
 * control per screen: *"One for each screen, not per card."* So this opens from a single header
 * icon (`ScreenScaffold`'s `onManageCardsPress`, the same shape as `onLayoutPress`) and lists
 * every card the registry declares for that screen with a switch each.
 *
 * ⚠️ **Hiding AND restoring both happen here, which is why these screens need no "Retired"
 * shelf.** Home has one because its only hide affordance is per-card, so something else has to
 * name what is gone; here the entry point already lists everything, present or not. Don't add a
 * shelf to a screen that has this sheet — it would be a second place saying the same thing.
 *
 * Modelled on components/LayoutPickerSheet.tsx, which is the same shape of thing: opened from a
 * surface's own header so the choice is made while looking at what it changes, applying
 * immediately, with a trailing DISMISS rather than a commit — backing out never silently
 * discards a change the user already watched happen.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/FormControls (Switch — rule 19a's one
 *             boolean shape), components/PressableScale, components/Surface, constants/theme,
 *             lib/cardRegistry (cardsForScreen + cardSpec — this is `cardsForScreen`'s first
 *             real consumer), lib/haptics, lib/i18n, lib/useAppTheme, lib/useHiddenCard
 *   Used by → app/(tabs)/shopping.tsx, plans.tsx, habits.tsx, health.tsx
 *   Data    → settings.hiddenCards via lib/useHiddenCard.ts. Writes nothing else — hiding a card
 *             changes what is DRAWN and nothing about what the app does with its rows: reminders
 *             still fire, counts still count. See lib/hiddenCards.ts.
 *
 * Edit notes:
 *   - **Home is deliberately not a caller.** Its cards are previews of other tabs and carry a
 *     forced-restore rule (`RESTORED_KINDS` in lib/homeCards.ts) that exists precisely because
 *     they are previews; components/HomeCardManager.tsx keeps that screen. A card on Shop/To-do/
 *     Habits/Health IS the thing itself, so hiding one is always a real choice.
 *   - **There is no floor of one visible card.** A screen can be emptied, and that is safe here
 *     in a way it was not for Home's old "Edit cards" mode: this entry point is permanent header
 *     chrome, so the cards are always one tap from coming back.
 *   - Card titles come from the registry (`cardSpec(key).title(t)`), never restated here — a
 *     card is NAMED, not described, which is the whole contract lib/cardRegistry.ts exists for.
 *   - Decision 044b applies: the shell is AnimatedBottomSheet so it plays a real exit animation.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Switch } from '@/components/FormControls';
import { Fonts, FontSize, glassKey, Radius, Spacing, MIN_TAP_TARGET } from '@/constants/theme';
import { CardScreen, cardsForScreen, cardSpec } from '@/lib/cardRegistry';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { useHiddenCard } from '@/lib/useHiddenCard';
import type { CardKey } from '@/lib/cardRegistry';

type Props = {
  visible: boolean;
  screen: CardScreen;
  onClose: () => void;
};

/**
 * One row. Split into its own component because `useHiddenCard` is a hook and the list is a
 * `.map()` — the same reason components/SettingRow.tsx exists rather than inlining a switch.
 */
function CardRow({ id }: { id: CardKey }) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [hidden, setHidden] = useHiddenCard(id);
  const label = cardSpec(id).title(t);

  return (
    <View style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <Text style={[styles.optionLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Switch
        checked={!hidden}
        onChange={(next) => {
          selection();
          setHidden(!next);
        }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function ManageCardsSheet({ visible, screen, onClose }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  // The registry is the source of truth for what belongs on a screen and in what order — this is
  // `cardsForScreen`'s first real consumer, and it reads the same list the screen itself draws.
  const cards = cardsForScreen(screen);

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.manageCards.title}</Text>
        {/* One short line, because "off" here is not "deleted" and that is the one thing a user
            could reasonably fear. */}
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.manageCards.hint}</Text>

        {cards.map((id) => <CardRow key={id} id={id} />)}

        <PressableScale
          style={[styles.doneBtn, glassKey(theme.accent, isDark)]}
          onPress={onClose}
          scaleTo={0.95}
          accessibilityRole="button"
        >
          <Text style={[styles.doneBtnText, { color: theme.text }]}>{t.manageCards.close}</Text>
        </PressableScale>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
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
  hint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
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
  // `flex: 1` + `minWidth: 0` together, never `flex: 1` alone — see components/TaskCard.tsx's
  // note: without the minWidth a long title refuses to shrink and pushes the switch out.
  optionLabel: { flex: 1, minWidth: 0, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  doneBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
