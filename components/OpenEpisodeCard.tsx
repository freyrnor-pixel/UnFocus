/**
 * OpenEpisodeCard.tsx — "Headache — still going?", the one quiet prompt for an open episode
 *
 * Rendered on the Health tab, one card per still-happening symptom entry, so returning to the
 * tab is what asks — rather than a notification, a badge, or a counter.
 *
 * **This must not read as an alert, and that is the whole design.** Flat Surface, neutral
 * `theme.border` (deliberately NOT the health domain accent every other card here carries, and
 * never a severity colour), no accent bar, no CardAccentBadge, no warning glyph, no entrance
 * animation. It is simply present.
 *
 * **It is byte-for-byte identical on day 1 and day 9.** No colour change, no bolding, no
 * "still?", no day counter, no reordering up the screen, no second prompt. An episode open
 * for days is normal — migraine, flare-ups and chronic pain run long — and escalating at the
 * person living through it would be the app taking a tone it has nowhere else. Recoverability
 * is the answer to staleness instead: closing always allows backdating, so someone who
 * forgets for a week loses nothing and the app never has to guess on their behalf.
 *
 * Connections:
 *   Imports → components/Surface (its `onPress` key path — no PressableScale wrapper), components/Button,
 *             constants/theme, lib/haptics (tap), lib/i18n, lib/useAppTheme
 *   Used by → app/(tabs)/health.tsx (above MedicineTrayCard, below the StarterCard)
 *   Data    → none — presentational. The caller owns dismissal and calls closeEpisode.
 *
 * Edit notes:
 *   - **"Still going" writes NOTHING.** No column, no timestamp, no "last confirmed". The
 *     caller dismisses it for the session with in-memory state, because the app genuinely does
 *     not know whether it ended, and storing "I asked at 14:02 and you said yes" would be a
 *     timestamp about being unwell that this feature has no other reason to keep.
 *   - Never add a duration, an elapsed count, or a "since 09:14" line. An episode is a state,
 *     not a stretch of time; duration exists only retrospectively, in History.
 *   - No notification, ever — lib/__tests__/episodes.test.ts source-scans this file.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

type Props = {
  symptom: string;
  /** Dismiss for this session. Writes nothing, anywhere. */
  onStillGoing: () => void;
  /** Opens the close sheet. */
  onItsOver: () => void;
  /** Tapping the card body (not a button) opens the full entry. */
  onOpen: () => void;
};

export default function OpenEpisodeCard({ symptom, onStillGoing, onItsOver, onOpen }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  // Flat elevation — see the header. Do not pass `elevated`. This card used to also pass an
  // explicit neutral border to opt OUT of the screen hue every other card wore; every pane is
  // neutral since 2026-08-20, so the opt-out is the default and the prop is gone.
  // The press is Surface's own key path (task 16, 2026-08-04): the card sinks onto a base
  // rather than shrinking, which is why there is no PressableScale wrapper here any more.
  return (
    <Surface style={styles.card} onPress={onOpen} accessibilityRole="button">
        <Text style={[styles.prompt, { color: theme.text }]}>{t.episodes.stillGoingPrompt(symptom)}</Text>
        <View style={styles.actions}>
          <Button
            label={t.episodes.stillGoing}
            variant="ghost"
            size="sm"
            style={styles.action}
            onPress={() => {
              tap();
              onStillGoing();
            }}
          />
          <Button
            label={t.episodes.itsOver}
            variant="secondary"
            size="sm"
            style={styles.action}
            onPress={() => {
              tap();
              onItsOver();
            }}
          />
        </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  // No vertical margin (2026-08-08): the screen's content container owns the gap between
  // stacked cards (`SCREEN_GAP`, constants/theme.ts). Was `marginTop: Spacing.xl`.
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  prompt: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  action: { flex: 1 },
});
