/**
 * index.tsx — Onboarding name capture + finish (final guided step)
 *
 * The last screen of the guided flow, reached from the intro tour. Captures the
 * user's name, then finishes onboarding: marks setup complete, applies the new-user
 * defaults, and schedules any reminders. Kept short so it never scrolls — the feature
 * highlights moved to the intro tour (onboarding/intro.tsx), and the per-feature
 * settings the old wizard collected now default and are taught on each screen's ⓘ hint.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button
 *   Used by → Expo Router route "/onboarding" (pushed from onboarding/intro.tsx)
 *   Data    → useSettingsStore (writes `userName`, `setupComplete`,
 *             `showPoints`); schedules reminders via
 *             syncReminders() + useTaskStore.syncAllTaskNotifications()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - finish() writes userName (trimmed) + completion flags, then schedules reminders
 *     the same way onboarding/guided.tsx's Explore path does, then router.replace('/').
 *     This is the one normal place setupComplete is set for the guided flow.
 *   - Notifications default OFF now (no notification step), so the requestPermissions
 *     branch is skipped unless the user enabled them via a first-run hint beforehand.
 *   - Decision 006 tokens throughout — no raw hex, no legacy theme.* names.
 */
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

export default function OnboardingName() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [name, setName] = useState('');

  function finish() {
    settings.update({
      userName: name.trim(),
      setupComplete: true,
      showPoints: true,
    });
    // Notifications default OFF (no notification step). If a flag ended up enabled,
    // request the OS permission as a safety net; either way, schedule reminders.
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
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.top}>
            <View style={styles.logoShadow}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" fadeDuration={0} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>{t.whatsYourName}</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>{t.nameHint}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.surface }]}
              value={name}
              onChangeText={setName}
              placeholder={t.namePlaceholder}
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.accent}
              returnKeyType="done"
              onSubmitEditing={finish}
              autoFocus={false}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button label={t.previous} onPress={() => router.back()} variant="ghost" size="md" />
          <Button label={t.finishBtn} onPress={finish} variant="primary" size="md" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.xl },
  top: { alignItems: 'center', gap: Spacing.md },
  logoShadow: { borderRadius: Radius.lg, ...Shadow.card },
  logo: { width: 96, height: 96, borderRadius: Radius.lg, overflow: 'hidden' },
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
  card: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.card,
  },
  input: {
    borderRadius: Radius.sm,
    borderWidth: 2,
    padding: Spacing.md,
    fontSize: FontSize.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
});
