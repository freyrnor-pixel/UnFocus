/**
 * step4.tsx — Notification confirmation (guided step 4 of 5)
 *
 * Task notifications and the weekly shopping reminder default OFF — explicit
 * opt-in toggles here, each requesting the OS notification permission the
 * moment it's switched on (instead of a silent auto-enable resolved later).
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/notifications, @/lib/i18n,
 *             @/constants/theme, @/lib/useAppTheme, @/components/Button
 *   Used by → Expo Router route "/onboarding/step4"
 *   Data    → useSettingsStore (reminderTime seed + user-toggleable remindersEnabled /
 *             taskNotificationsEnabled)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Turning either switch on calls requestPermissions() right there; step5.finish()
 *     still calls it too (guarded on either flag) as a safety net for a user who
 *     enabled one, disabled it, then re-enabled without the prompt re-firing.
 *   - next() → router.push "/onboarding/step5"; Previous uses router.back();
 *     "Skip for now" (matching step2/step3) also advances to step5 unchanged.
 *   - Decision 006 tokens throughout — task check icon uses `good`, shopping icon
 *     uses feature accent `featShop`.
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { requestPermissions } from '@/lib/notifications';
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

  // Notifications default OFF; only seed the reminder time so it's sane
  // whenever the user opts in (here or later in Settings).
  useEffect(() => {
    settings.update({ reminderTime: '14:00' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTaskNotifications(v: boolean) {
    settings.update({ taskNotificationsEnabled: v });
    if (v) requestPermissions();
  }

  function toggleReminders(v: boolean) {
    settings.update({ remindersEnabled: v });
    if (v) requestPermissions();
  }

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
            <Switch
              value={settings.taskNotificationsEnabled}
              onValueChange={toggleTaskNotifications}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={settings.taskNotificationsEnabled ? theme.accent : theme.textMuted}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="cart-outline" size={22} color={theme.featShop} style={styles.infoIconView} />
            <Text style={[styles.infoText, { color: theme.text }]}>{t.weeklyRemindersOnboarding} — {t.weeklyRemindersHint}</Text>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={toggleReminders}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={settings.remindersEnabled ? theme.accent : theme.textMuted}
            />
          </View>
        </View>

        <View style={[styles.noteBox, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.noteText, { color: theme.text }]}>{t.onboardingSettingsNote}</Text>
        </View>

        <View style={styles.progress}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
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
      {/* W-E: gentle, always-visible skip so no step feels mandatory */}
      <Button
        label={t.config.skipForNow}
        onPress={() => router.push('/onboarding/step5')}
        variant="ghost"
        size="sm"
        style={styles.skipLink}
      />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  skipLink: { alignItems: 'center', paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.md },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  sub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoIconView: {},
  infoText: { flex: 1, fontSize: FontSize.md, lineHeight: 22 },
  divider: { height: 1, marginVertical: Spacing.xs },
  noteBox: { borderRadius: Radius.md, padding: Spacing.md },
  noteText: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
