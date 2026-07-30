/**
 * index.tsx — Onboarding name capture + finish (final guided step)
 *
 * The last screen of the guided flow, reached from the feature picker. Captures the
 * user's name, then finishes onboarding: marks setup complete, applies the new-user
 * defaults, and schedules any reminders. Kept short so it never scrolls — the feature
 * highlights moved to the intro tour (onboarding/intro.tsx), and the per-feature
 * settings the old wizard collected now default and are taught on each screen's ⓘ hint.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/date (todayStr), @/lib/i18n, @/constants/theme,
 *             @/lib/useAppTheme, @/components/Button
 *   Used by → Expo Router route "/onboarding" (pushed from onboarding/intro.tsx)
 *   Data    → useSettingsStore (writes `userName`, `setupComplete`, `lastMonthlyReset`);
 *             schedules reminders via syncReminders() + useTaskStore.syncAllTaskNotifications()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - showPoints/showHints are NOT written here any more (2026-07-25) — nothing in the app
 *     ever read either flag, so setting them was a promise with no behaviour behind it.
 *   - finish() writes userName (trimmed) + setupComplete + lastMonthlyReset (stamped to
 *     today, 2026-07-26), then schedules reminders the same way onboarding/guided.tsx's
 *     Explore path does, then router.replace('/'). This is the one normal place
 *     setupComplete is set for the guided flow. The lastMonthlyReset stamp exists so
 *     Shopping's auto-reset-review sheet (gated on lastMonthlyReset vs. today's
 *     YYYY-MM, default monthlyResetDate=1) doesn't fire on a brand-new install's very
 *     first Shopping visit — it otherwise always satisfied "haven't reset this period",
 *     covering the first-visit ⓘ hint underneath it (the bug this fixes).
 *   - finish() ends on router.replace('/first-run') unless firstRunComplete is already
 *     set (i.e. the user re-ran onboarding from Settings), in which case it goes to '/'.
 *     Routing via '/' unconditionally would flash a frame of Home before app/_layout.tsx's
 *     guard bounced them to the same place.
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
import { usePeopleStore } from '@/store/usePeopleStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { todayStr } from '@/lib/date';
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
      // Stamp the payday-reset baseline to today so Shopping's auto-reset-review sheet
      // (app/(tabs)/shopping.tsx, gated on lastMonthlyReset) doesn't immediately fire on
      // a brand-new install with no data — its default '' otherwise always satisfies
      // "haven't reset this period yet", covering the first-visit ⓘ hint underneath it.
      lastMonthlyReset: todayStr(),
    });
    // The People registry's self row was created nameless during the app bootstrap —
    // that runs before this screen exists — so this is where it learns who you are.
    usePeopleStore.getState().publishSelfName(name.trim());
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
    // Straight into first-run personalization (app/first-run.tsx) unless it's already been
    // seen — which it will have been if the user re-ran onboarding from Settings. Going
    // via '/' instead would show a frame of Home before app/_layout.tsx's guard bounced
    // them; this makes that guard a pure safety net.
    router.replace(settings.firstRunComplete ? '/' : '/first-run');
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
  content: { flex: 1, paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg, justifyContent: 'center', gap: Spacing.xl },
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
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
});
