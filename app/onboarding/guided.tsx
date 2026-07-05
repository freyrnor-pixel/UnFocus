/**
 * guided.tsx — Guided-setup vs Explore choice (after language)
 *
 * Branch point: "Guided" enters the 6-step wizard; "Explore" skips it and jumps
 * straight to the home screen, marking setup complete. Both enable showHints.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/Surface
 *   Used by → Expo Router route "/onboarding/guided"
 *   Data    → useSettingsStore (writes `showHints`; Explore also writes `setupComplete`)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - goGuided() → router.push "/onboarding" (continues wizard, leaves setupComplete unset).
 *   - goExplore() sets setupComplete:true and router.replace "/" — this is the onboarding
 *     completion flag; the wizard's own completion is set later in step6.tsx. Explore
 *     skips the companion-pet step too, so petEnabled stays at its default (false) until
 *     the user turns it on in Settings.
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
          <Surface tint={theme.accent} style={styles.optionCard}>
            <View style={styles.optionContent}>
              <Ionicons name="list-outline" size={24} color={theme.accentInk} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.accentInk }]}>{t.guidedBtn}</Text>
                <Text style={[styles.optionDesc, { color: theme.accentInk }]}>{t.guidedDesc}</Text>
              </View>
            </View>
            <Button
              label={t.next}
              onPress={goGuided}
              variant="ghost"
              size="sm"
              icon="arrow-forward"
            />
          </Surface>

          <Surface style={styles.optionCard}>
            <View style={styles.optionContent}>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{t.exploreBtn}</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{t.exploreDesc}</Text>
              </View>
            </View>
            <Button
              label={t.next}
              onPress={goExplore}
              variant="ghost"
              size="sm"
              icon="arrow-forward"
            />
          </Surface>
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
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
