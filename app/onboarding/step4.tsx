/**
 * step4.tsx — Notification confirmation (guided step 4 of 6)
 *
 * Informs the user that task notifications and weekly shopping reminders are
 * enabled by default. No toggles — they can adjust in Settings later.
 * The actual OS permission request fires in step6 on finish.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button
 *   Used by → Expo Router route "/onboarding/step4"
 *   Data    → useSettingsStore (sets remindersEnabled + taskNotificationsEnabled defaults)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - No OS permission prompt or scheduling here — step6.finish() does that.
 *   - next() → router.push "/onboarding/step5"; Previous uses router.back().
 *   - Decision 006 tokens throughout — task check icon uses `good`, shopping icon
 *     uses feature accent `featShop`.
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

export default function OnboardingStep4() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  // Notifications are ON by default; shopping reminder fires Saturday 14:00.
  useEffect(() => {
    settings.update({
      remindersEnabled: true,
      taskNotificationsEnabled: true,
      reminderTime: '14:00',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="notifications-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.notificationsOnboarding}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.notificationsSub}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={22} color={theme.good} style={styles.infoIconView} />
            <Text style={[styles.infoText, { color: theme.text }]}>{t.taskNotifications} — {t.taskNotificationsHintOnboarding}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="cart-outline" size={22} color={theme.featShop} style={styles.infoIconView} />
            <Text style={[styles.infoText, { color: theme.text }]}>{t.weeklyRemindersOnboarding} — {t.weeklyRemindersHint}</Text>
          </View>
        </View>

        <View style={[styles.noteBox, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.noteText, { color: theme.text }]}>{t.onboardingSettingsNote}</Text>
        </View>

        <View style={styles.progress}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.surfaceMuted },
                i === 3 && { ...styles.dotActive, backgroundColor: theme.accent },
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
          onPress={() => router.push('/onboarding/step5')}
          variant="primary"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.md },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  sub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoIconView: { marginTop: 1 },
  infoText: { flex: 1, fontSize: FontSize.md, lineHeight: 22 },
  divider: { height: 1, marginVertical: Spacing.xs },
  noteBox: { borderRadius: Radius.md, padding: Spacing.md },
  noteText: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
