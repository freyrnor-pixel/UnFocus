/**
 * CardStarterSheet.tsx — what "add a card" offers, and in what order.
 *
 * Three shapes first — **blank**, a row with a tick, a card with a heading — and then, under
 * their own heading and visibly below them, the eleven cards the app actually ships.
 *
 * **That order is the point.** The lab used to open on a picker of those eleven and nothing
 * else, so every session began by choosing which existing card to modify. Starting from
 * nothing was not merely inconvenient; it was unrepresentable, because the sanitizer deleted a
 * card that ended up with no parts. Building from blank is now the default path. The eleven
 * stay because they are what makes the export able to say *"the to-do card, but with the tick
 * moved"* — a diff against something real — and losing that would cost more than the clutter
 * of a second section.
 *
 * Connections:
 *   Imports → components/{Surface,PressableScale}, constants/theme, lib/designLab
 *             (CARD_SKELETONS + CARD_KNOBS), lib/haptics, lib/i18n, lib/useAppTheme
 *   Used by → app/design-lab/index.tsx (the "Add a card" row at the foot of a screen)
 *   Data    → none. The caller owns the write.
 *
 * Edit notes:
 *   - A plain list in a `Surface`, deliberately not a fourth bottom-sheet abstraction beside
 *     `AnimatedBottomSheet` and `AppModal` — the same call the design lab's own `ChoiceSheet`
 *     made, and this replaces that.
 *   - The skeletons and the real cards both enumerate from `lib/designLab.ts`. Adding a
 *     starting shape there shows up here already wired; the only thing this file needs is the
 *     i18n pair, which `no: typeof en` demands at compile time.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { CARD_KNOBS, CARD_SKELETONS, type CardOrigin } from '@/lib/designLab';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (origin: CardOrigin) => void;
};

export default function CardStarterSheet({ visible, onClose, onPick }: Props) {
  const theme = useAppTheme();
  const t = useT();
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: theme.overlay }]}>
      <PressableScale
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        scaleTo={1}
        accessibilityLabel={t.designLab.playground.addCard}
      />
      <Surface style={styles.sheet}>
        <Text style={[styles.title, { color: theme.text }]}>{t.designLab.playground.addCard}</Text>
        <ScrollView style={styles.scroll}>
          {CARD_SKELETONS.map((skeleton) => (
            <Row
              key={skeleton.origin}
              label={t.designLab.playground.starters[skeleton.origin]}
              hint={t.designLab.playground.starterHints[skeleton.origin]}
              onPress={() => { selection(); onPick(skeleton.origin); }}
            />
          ))}

          {/* Below, and under its own heading: still reachable, no longer the way in. */}
          <Text style={[styles.groupHeader, { color: theme.textMuted }]}>
            {t.designLab.playground.startFromReal}
          </Text>
          {CARD_KNOBS.map((knob) => (
            <Row
              key={knob.id}
              label={t.designLab.cards[knob.id]}
              onPress={() => { selection(); onPick(knob.id); }}
            />
          ))}
        </ScrollView>
      </Surface>
    </View>
  );
}

function Row({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
    >
      {/* flex + minWidth:0 so a long name yields rather than shoving the chevron off. */}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
        {hint ? (
          <Text style={[styles.rowHint, { color: theme.textMuted }]} numberOfLines={2}>{hint}</Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'flex-end', zIndex: 20 },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  scroll: { flexShrink: 1 },
  groupHeader: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  row: { justifyContent: 'center', minHeight: MIN_TAP_TARGET, paddingVertical: Spacing.xs },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  rowHint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
});
