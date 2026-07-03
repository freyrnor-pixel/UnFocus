/**
 * step3.tsx — Shopping reset days (guided step 3 of 6)
 *
 * Captures the weekly shopping/reset day and the monthly reset date that drive
 * the shopping list's recurring resets.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/HintCard
 *   Used by → Expo Router route "/onboarding/step3"
 *   Data    → useSettingsStore (writes `weeklyResetDay`, `monthlyResetDate`); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - monthlyResetDate is committed live on valid input (1–31); onBlur reverts bad input.
 *   - Next button → router.push "/onboarding/step4"; Previous uses router.back().
 *   - `dateInput` is local edit state seeded from settings.monthlyResetDate.
 *   - The payday tip is a HintCard (Decision 010). Decision 006 tokens throughout —
 *     shopping cart icon uses theme.featShop (feature accent).
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import HintCard from '@/components/HintCard';

export default function OnboardingStep3() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [dateInput, setDateInput] = useState(String(settings.monthlyResetDate));

  // Weekly reset defaults to Monday (index 0) — no user choice needed in onboarding.
  useEffect(() => {
    settings.update({ weeklyResetDay: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="cart-outline" size={36} color={theme.featShop} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.shoppingOnboarding}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.shoppingOnboardingSub}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{t.monthlyResetDateQuestion}</Text>
          <TextInput
            style={[styles.dateInput, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.surface }]}
            value={dateInput}
            onChangeText={(v) => {
              setDateInput(v);
              const n = parseInt(v, 10);
              if (!isNaN(n) && n >= 1 && n <= 31) {
                settings.update({ monthlyResetDate: n });
              }
            }}
            onBlur={() => {
              const n = parseInt(dateInput, 10);
              if (isNaN(n) || n < 1 || n > 31) {
                setDateInput(String(settings.monthlyResetDate));
              }
            }}
            keyboardType="number-pad"
            placeholder="1–31"
            placeholderTextColor={theme.textMuted}
            maxLength={2}
            returnKeyType="done"
          />
          <Text style={[styles.hint, { color: theme.textMuted }]}>{t.monthlyDateInputHint}</Text>
        </View>

        <HintCard text={t.monthlyPaydayHint} />

        <View style={styles.progress}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.surfaceMuted },
                i === 2 && { ...styles.dotActive, backgroundColor: theme.accent },
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
          onPress={() => router.push('/onboarding/step4')}
          variant="primary"
          size="md"
        />
      </View>
      {/* W-E: gentle, always-visible skip so no step feels mandatory */}
      <Button
        label={t.config.skipForNow}
        onPress={() => router.push('/onboarding/step4')}
        variant="ghost"
        size="sm"
        style={styles.skipLink}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  skipLink: { alignItems: 'center', paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.md },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  sub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md, ...Shadow.card },
  cardTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  hint: { fontSize: FontSize.sm, fontStyle: 'italic' },
  dateInput: { borderRadius: Radius.sm, borderWidth: 2, padding: Spacing.md, fontSize: FontSize.xl, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
