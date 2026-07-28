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
import { Ionicons } from '@expo/vector-icons';
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
          {/* Ionicons, not emoji (2026-07-28). A full-colour 🔒 glyph at 72px is a different
              vendor's artwork on every device, ignores the theme entirely, and reads as
              clip-art next to the app's own outline iconography — on the FIRST screen a new
              user sees. Outline glyphs in the theme's accent match the rest of the app and
              follow dark mode. */}
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.accent} />
          </View>
          <Text style={[styles.headline, { color: theme.text }]}>{t.onboarding.privacy.headline}</Text>
        </View>

        <View style={[styles.bulletCard, { backgroundColor: theme.surface }]}>
          <View style={styles.bulletRow}>
            <Ionicons name="phone-portrait-outline" size={22} color={theme.accent} style={styles.bullet} />
            <Text style={[styles.bulletText, { color: theme.text }]}>{t.onboarding.privacy.local}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Ionicons name="heart-outline" size={22} color={theme.good} style={styles.bullet} />
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
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: { alignItems: 'center', gap: Spacing.md },
  // A soft accent disc behind the glyph, so the hero icon still has the visual weight the
  // 72px emoji had without being a picture.
  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  // Horizontal padding trimmed lg -> md (2026-07-28 wrap audit): this card sat inside the
  // screen's own padding, and the two together left its text only 238px of a 393px phone —
  // 40% of the width gone to chrome, which is what pushed "UnFocus er gratis og vil alltid
  // være det." onto a second line. Vertical padding is untouched; onboarding still breathes.
  bulletCard: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    width: '100%',
    ...Shadow.card,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  // Nudged down a hair so a 22px glyph sits on the first text line's optical centre.
  bullet: { marginTop: 1 },
  bulletText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  footer: { paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
