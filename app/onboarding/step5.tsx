/**
 * step5.tsx — Color theme + handedness (guided step 5 of 5, final step)
 *
 * Pick a color theme and handedness, then finish onboarding: marks setup
 * complete and requests OS notification permission.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/SwatchPicker
 *   Used by → Expo Router route "/onboarding/step5"
 *   Data    → useSettingsStore (writes `colorTheme`, `leftHanded`, `setupComplete`,
 *             `essentialsModeEnabled`, `showPoints`); scaled fontSize via
 *             useScaledStyles(); requests notification permission via
 *             requestPermissions(), then schedules reminders via syncReminders() +
 *             useTaskStore.syncAllTaskNotifications()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Finish button → finish() sets setupComplete + new-user defaults
 *     (essentialsModeEnabled:false, showPoints:true), requests OS notification
 *     permission and, once it resolves, schedules reminders (syncReminders +
 *     syncAllTaskNotifications), then router.replace "/" to home. This used to
 *     live in step6.tsx (companion-pet naming), which has been removed.
 *   - Previous uses router.back().
 *   - The swatch preview reads each theme's accent from the canonical palette
 *     (getThemePalette(key).accent in constants/colors.ts) — the SAME source that
 *     drives runtime chrome — so the picker set and the palette can never drift.
 *     (Previously sourced from the legacy theme.ts AppColors THEMES, whose theme
 *     set didn't match colors.ts, which is why Tech/Fluffy fell back to Default and
 *     Black & White couldn't be picked at all.)
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
import { FontSize, Fonts, Radius, Shadow, Spacing, contrastOn } from '@/constants/theme';
import { getThemePalette, THEMES as COLOR_PALETTES, THEME_ICONS, ThemeName } from '@/constants/colors';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import SwatchPicker from '@/components/SwatchPicker';

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
    // Request OS permission, then schedule the weekly/monthly reminders and every
    // task's per-task notification once permission resolves (mirrors the old app).
    requestPermissions().finally(() => {
      syncReminders();
      useTaskStore.getState().syncAllTaskNotifications();
    });
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
            <Ionicons name="color-palette-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.themeOnboarding}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.themeSub}</Text>
        </View>

        <SwatchPicker
          items={(Object.keys(COLOR_PALETTES) as ThemeName[])
            .map((key) => ({ key, label: t.themeNames[key] }))}
          value={settings.colorTheme}
          onChange={(key) => settings.update({ colorTheme: key as ThemeName })}
          renderSwatch={(key) => {
            const accent = getThemePalette(key as ThemeName, false).accent;
            return (
              <View style={[styles.swatchFill, { backgroundColor: accent }]}>
                <Ionicons name={THEME_ICONS[key as ThemeName] as any} size={24} color={contrastOn(accent)} />
              </View>
            );
          }}
        />

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
  swatchFill: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  handednessCard: { borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  switchHint: { fontSize: FontSize.sm, marginTop: 2 },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
