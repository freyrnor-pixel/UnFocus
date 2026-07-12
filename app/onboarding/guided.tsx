/**
 * guided.tsx — Guided-setup vs Explore choice (after language)
 *
 * Branch point: "Guided" enters the 5-step wizard; "Explore" skips it and jumps
 * straight to the home screen, marking setup complete. Both enable showHints.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/Surface, @/components/PressableScale
 *   Used by → Expo Router route "/onboarding/guided"
 *   Data    → useSettingsStore (writes `showHints`; Explore also writes `setupComplete`)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - goGuided() → router.push "/onboarding" (continues wizard, leaves setupComplete unset).
 *   - goExplore() sets setupComplete:true + new-user defaults and router.replace "/" — a
 *     legitimate "skip the wizard, use defaults" path (theme is locked to 'default' and no
 *     longer user-selectable, so nothing visual is missed by skipping; see step5.tsx).
 *   - Each whole option card is a PressableScale (was: only the small "Neste →" Button was
 *     tappable, so taps on the title/description did nothing). A trailing arrow-forward icon
 *     shows the affordance; distinct leading icons (list vs compass) tell the two apart.
 *   - Guided option card uses <Surface tint={theme.accent}> (Decision 008 material); its
 *     label/icon read theme.accentInk (text-on-accent-fill). Decision 006 tokens throughout.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
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
    settings.update({ showHints: true });
    router.push('/onboarding');
  }

  function goExplore() {
    // W-E: new-user defaults — start with Focus/Essentials mode OFF (Notes/Shopping
    // previews visible) and points visible. Onboarding-only.
    settings.update({ showHints: true, setupComplete: true, essentialsModeEnabled: false, showPoints: true });
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
          {/* Whole card is the tap target (was: only the small "Neste →" button registered
              taps, so tapping the title/description did nothing). A trailing arrow shows the
              affordance; distinct leading icons keep the two adjacent cards tellable apart. */}
          <PressableScale
            onPress={goGuided}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.guidedBtn}
          >
            <Surface tint={theme.accent} style={styles.optionCard}>
              <Ionicons name="list-outline" size={24} color={theme.accentInk} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.accentInk }]}>{t.guidedBtn}</Text>
                <Text style={[styles.optionDesc, { color: theme.accentInk }]}>{t.guidedDesc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color={theme.accentInk} />
            </Surface>
          </PressableScale>

          <PressableScale
            onPress={goExplore}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.exploreBtn}
          >
            <Surface style={styles.optionCard}>
              <Ionicons name="compass-outline" size={24} color={theme.accent} style={styles.optionIcon} />
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
  optionIcon: {},
  optionText: { flex: 1, gap: 2 },
  optionLabel: {
    fontSize: FontSize.lg,
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
