/**
 * step5.tsx — Handedness (guided step 5 of 5, final step)
 *
 * Pick left/right-handed layout, then finish onboarding: marks setup
 * complete and, if the user opted into notifications on step4, requests the
 * OS notification permission as a safety net. Colour theme (locked to
 * 'default') and bubble material (locked to 'glass') are no longer
 * user-selectable anywhere in the app, so the swatch picker previously here
 * was removed.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button
 *   Used by → Expo Router route "/onboarding/step5"
 *   Data    → useSettingsStore (writes `leftHanded`, `setupComplete`,
 *             `essentialsModeEnabled`, `showPoints`); scaled fontSize via
 *             useScaledStyles(); requests notification permission via
 *             requestPermissions(), then schedules reminders via syncReminders() +
 *             useTaskStore.syncAllTaskNotifications()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Finish button → finish() sets setupComplete + new-user defaults
 *     (essentialsModeEnabled:false, showPoints:true). If either notification flag
 *     is on (set via step4's opt-in toggles, which already requested the OS
 *     permission there) it re-requests as a safety net; either way it schedules
 *     reminders (syncReminders + syncAllTaskNotifications), then router.replace
 *     "/" to home.
 *   - Previous uses router.back().
 */
import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
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

  function finish() {
    settings.update({
      setupComplete: true,
      essentialsModeEnabled: false,
      showPoints: true,
    });
    // step4 already requests the OS permission the moment a toggle is switched
    // on; this is a safety net for a flag that ended up enabled without that
    // prompt firing. Skip the prompt entirely if the user opted out of both.
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
          {[0, 1, 2, 3, 4].map((i) => (
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
          label={t.finishBtn}
          onPress={finish}
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
