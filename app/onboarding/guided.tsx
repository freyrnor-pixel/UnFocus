/**
 * guided.tsx — Guided-setup vs Explore choice (after language)
 *
 * Branch point: "Guided" runs the short intro tour, then the feature picker, then the name
 * step; "Explore" skips all three and jumps straight to the home screen, marking setup
 * complete and leaving every optional feature at its off default. The per-screen ⓘ hints
 * (which teach the settings the old wizard collected) are available on both paths —
 * components/HintCard.tsx always renders its pill, and first-visit auto-expand is driven by
 * settings.seenScreenHints.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/Surface, @/components/PressableScale
 *   Used by → Expo Router route "/onboarding/guided"
 *   Data    → useSettingsStore (Explore writes `setupComplete`, then schedules reminders
 *             like the name-step finish; Guided writes nothing here)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - goGuided() → router.push "/onboarding/intro" (the short tour → name step).
 *   - goExplore() sets setupComplete and runs the same reminder sync as the name step's
 *     finish() (parity), then router.replace "/".
 *   - Both option cards sit on the plain glass Surface (theme.text on surface = full
 *     contrast); the recommended (Guided) one is marked by an accent icon badge + a
 *     "Recommended" chip, NOT an accent fill (the old tint={theme.accent} fill put
 *     low-contrast accentInk text on a busy fill — the "too filled / low contrast"
 *     complaint). Decision 006 tokens throughout.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';

export default function GuidedScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  function goGuided() {
    router.push('/onboarding/intro');
  }

  function goExplore() {
    // Explore skips the tour, the feature picker and the name step, so it lands on the
    // plain opt-in defaults — every optional feature off, which is the whole promise of
    // "jump right in". Schedule reminders the same way the name-step finish() does, so
    // Explore users aren't left unscheduled.
    settings.update({ setupComplete: true });
    if (settings.taskNotificationsEnabled || settings.remindersEnabled) {
      requestPermissions().finally(() => {
        syncReminders();
        useTaskStore.getState().syncAllTaskNotifications();
      });
    } else {
      syncReminders();
      useTaskStore.getState().syncAllTaskNotifications();
    }
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="map-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.guidedTitle}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.guidedSub}</Text>
        </View>

        <View style={styles.options}>
          {/* Whole card is the tap target. Both cards read theme.text on the plain glass
              surface (full contrast); the recommended one is marked with an accent icon
              badge + chip rather than a low-contrast accent fill. */}
          <PressableScale
            onPress={goGuided}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.guidedBtn}
          >
            <Surface style={styles.optionCard}>
              <View style={[styles.optionBadge, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="list-outline" size={22} color={theme.accent} />
              </View>
              <View style={styles.optionText}>
                <View style={styles.optionLabelRow}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{t.guidedBtn}</Text>
                  <View style={[styles.recommendedChip, { backgroundColor: theme.accentSoft }]}>
                    <Text style={[styles.recommendedChipText, { color: theme.accent }]}>{t.recommended}</Text>
                  </View>
                </View>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{t.guidedDesc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color={theme.accent} />
            </Surface>
          </PressableScale>

          <PressableScale
            onPress={goExplore}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.exploreBtn}
          >
            <Surface style={styles.optionCard}>
              <View style={[styles.optionBadge, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="compass-outline" size={22} color={theme.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{t.exploreBtn}</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{t.exploreDesc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color={theme.textMuted} />
            </Surface>
          </PressableScale>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t.previous}
          onPress={() => router.back()}
          variant="ghost"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
  },
  heading: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  sub: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  options: { gap: Spacing.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  optionBadge: {
    width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  optionLabel: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semibold,
  },
  recommendedChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  recommendedChipText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
  optionDesc: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  footer: {
    padding: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
