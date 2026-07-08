/**
 * step5.tsx — Handedness (guided step 5 of 6)
 *
 * Pick a handedness preference, then continue to the companion-pet step.
 * Finishing onboarding (setup complete + notification scheduling) happens in
 * step6.tsx.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button
 *   Used by → Expo Router route "/onboarding/step5"
 *   Data    → useSettingsStore (writes `leftHanded`); scaled
 *             fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - The colour-theme picker was removed: the app ships a single "Default" palette.
 *   - Next button → router.push "/onboarding/step6" (companion pet naming,
 *     which owns setupComplete + notification scheduling).
 *   - Previous uses router.back().
 */
import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

export default function OnboardingStep5() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="hand-left-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.handednessOnboarding}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.handednessOnboardingSub}</Text>
        </View>

        <View style={[styles.handednessCard, { backgroundColor: theme.surface }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.leftHanded}</Text>
              <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.leftHandedHint}</Text>
            </View>
            <Switch
              value={settings.leftHanded}
              onValueChange={(v) => settings.update({ leftHanded: v })}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={settings.leftHanded ? theme.accent : theme.textMuted}
            />
          </View>
        </View>

        <View style={styles.progress}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
                i === 4 && { ...styles.dotActive, backgroundColor: theme.accent },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t.previous}
          onPress={() => router.back()}
          variant="ghost"
          size="md"
        />
        <Button
          label={t.next}
          onPress={() => router.push('/onboarding/step6')}
          variant="primary"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing.xl, gap: Spacing.xl, justifyContent: 'center' },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  sub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  handednessCard: { borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  switchHint: { fontSize: FontSize.sm, marginTop: 2 },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
