/**
 * card-options.tsx — the ⋮ page of a screen's tabbed card (Variant C, 2026-10-15).
 *
 * Opened from components/Card.tsx's `CardTabs` footer with `?screen=<CardScreen>&card=<CardKey>`.
 * Holds what used to be the header's "Manage cards" sheet, reframed as tabs: the reorder +
 * show/hide list (components/ManageCardsSheet.tsx's `CardOrderList` — the same rows, one list)
 * and a one-tap "Hide this tab" for the tab you came from. The last visible tab cannot be
 * hidden, so the card can never end up empty with no way back.
 *
 * Connections:
 *   Imports → components/Card (TAB_EXCLUDE), components/CenterModalScreen, components/ManageCardsSheet (CardOrderList),
 *             components/PressableScale, constants/theme, lib/cardRegistry, lib/hiddenCards,
 *             lib/i18n, lib/useAppTheme, lib/useCardOrder, lib/useHiddenCard, lib/haptics,
 *             store/useSettingsStore
 *   Used by → Expo Router route "/card-options" (centre pop-up, app/_layout.tsx's
 *             CENTRE_MODAL_ROUTES); pushed from components/Card.tsx's `CardTabs`
 *   Data    → settings.cardOrder, settings.hiddenCards
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TAB_EXCLUDE } from '@/components/Card';
import CenterModalScreen from '@/components/CenterModalScreen';
import { CardOrderList } from '@/components/ManageCardsSheet';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { CARDS, CardKey, CardScreen, cardSpec } from '@/lib/cardRegistry';
import { isHidden } from '@/lib/hiddenCards';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useOrderedCards } from '@/lib/useCardOrder';
import { useHiddenCard } from '@/lib/useHiddenCard';
import { useSettingsStore } from '@/store/useSettingsStore';

const SCREENS: readonly CardScreen[] = ['home', 'todo', 'shop', 'habits', 'health'];

export default function CardOptionsScreen() {
  const params = useLocalSearchParams<{ screen?: string; card?: string }>();
  const screen = (SCREENS as readonly string[]).includes(params.screen ?? '') ? (params.screen as CardScreen) : 'home';
  const card = params.card && params.card in CARDS ? (params.card as CardKey) : null;
  return <CardOptions screen={screen} card={card} />;
}

function CardOptions({ screen, card }: { screen: CardScreen; card: CardKey | null }) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const router = useRouter();
  const ordered = useOrderedCards(screen);
  const hiddenCards = useSettingsStore((s) => s.hiddenCards);
  const exclude = TAB_EXCLUDE[screen];
  const visibleCount = ordered.filter((id) => !exclude?.includes(id) && !isHidden(hiddenCards, id)).length;
  const label = card ? cardSpec(card).title(t) : '';

  return (
    <CenterModalScreen
      title={card ? t.cardTabs.optionsTitle(label) : t.cardTabs.tabsSection}
      screenKey={card ? cardSpec(card).hue : undefined}
      onClose={() => router.back()}
    >
      <View style={styles.content}>
        {card && (
          <>
            <Text style={[styles.section, { color: theme.textMuted }]}>{t.cardTabs.thisTab}</Text>
            <HideThisTab card={card} label={label} isLast={visibleCount <= 1} onHidden={() => router.back()} />
          </>
        )}

        <Text style={[styles.section, { color: theme.textMuted }]}>{t.cardTabs.tabsSection}</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.cardTabs.tabsHint}</Text>
        <CardOrderList screen={screen} exclude={exclude} />

        <PressableScale
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          scaleTo={0.98}
          style={[styles.row, { borderColor: theme.border }]}
        >
          <Ionicons name="settings-outline" size={20} color={theme.textMuted} />
          <Text style={[styles.rowText, { color: theme.text }]}>{t.cardTabs.moreSettings}</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.textMuted} />
        </PressableScale>
      </View>
    </CenterModalScreen>
  );
}

function HideThisTab({
  card,
  label,
  isLast,
  onHidden,
}: {
  card: CardKey;
  label: string;
  isLast: boolean;
  onHidden: () => void;
}) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [hidden, setHidden] = useHiddenCard(card);
  const disabled = isLast || hidden;
  return (
    <>
      <PressableScale
        onPress={() => {
          if (disabled) return;
          selection();
          setHidden(true);
          onHidden();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={`${t.cardTabs.hideTab}: ${label}`}
        scaleTo={0.98}
        style={[styles.row, { borderColor: theme.border, opacity: disabled ? 0.45 : 1 }]}
      >
        <Ionicons name="eye-off-outline" size={20} color={theme.textMuted} />
        <Text style={[styles.rowText, { color: theme.text }]}>{t.cardTabs.hideTab}</Text>
      </PressableScale>
      {isLast && <Text style={[styles.hint, { color: theme.textMuted }]}>{t.cardTabs.lastTabHint}</Text>}
    </>
  );
}

const baseStyles = StyleSheet.create({
  // The centre pop-up pads its own body (components/CenterModalScreen.tsx) — only the gap here.
  content: { gap: Spacing.sm },
  section: { fontFamily: Fonts.bold, fontSize: FontSize.xs, paddingTop: Spacing.sm },
  hint: { fontFamily: Fonts.regular, fontSize: FontSize.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  rowText: { flex: 1, fontFamily: Fonts.semibold, fontSize: FontSize.sm },
});
