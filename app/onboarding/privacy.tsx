/**
 * privacy.tsx — Local-only trust screen (onboarding step between language and guided)
 *
 * Reassures the user that no data leaves the device and the app is always free.
 * Shown once during onboarding.
 *
 * Connections:
 *   Imports → @/lib/i18n, @/constants/theme, @/lib/useAppTheme, @/components/Button
 *   Used by → Expo Router route "/onboarding/privacy"
 *   Data    → none (no writes to settings; purely informational)
 *
 * Edit notes:
 *   - All strings through useT(); this screen has no local state.
 *   - "Got it" navigates to /onboarding/guided.
 *   - Previous navigates back to /onboarding/language.
 *   - Decision 006 tokens throughout — no raw hex, no legacy theme.* names.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

export default function PrivacyScreen() {
  const router = useRouter();
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
          <Text style={styles.icon}>🔒</Text>
          <Text style={[styles.headline, { color: theme.text }]}>{t.onboarding.privacy.headline}</Text>
        </View>

        <View style={[styles.bulletCard, { backgroundColor: theme.surface }]}>
          <View style={styles.bulletRow}>
            <Text style={styles.bullet}>📱</Text>
            <Text style={[styles.bulletText, { color: theme.text }]}>{t.onboarding.privacy.local}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bullet}>💚</Text>
            <Text style={[styles.bulletText, { color: theme.text }]}>{t.onboarding.privacy.free}</Text>
          </View>
        </View>

        <Button
          label={t.onboarding.privacy.cta}
          onPress={() => router.push('/onboarding/guided')}
          variant="primary"
          size="md"
        />
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
    flexGrow: 1,
    padding: Spacing.xl,
    gap: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: { alignItems: 'center', gap: Spacing.md },
  icon: { fontSize: 72 },
  headline: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  bulletCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    width: '100%',
    ...Shadow.card,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  bullet: { fontSize: 22, lineHeight: 26 },
  bulletText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  footer: { padding: Spacing.xl, paddingTop: Spacing.md },
});
