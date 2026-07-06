/**
 * step2.tsx — Work mode setup (guided step 2 of 5)
 *
 * Lets the user toggle work mode, auto-activation by work hours, and enter the
 * start/end work-hour strings used to switch the app's mode automatically.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/FormControls, @/components/HintCard
 *   Used by → Expo Router route "/onboarding/step2"
 *   Data    → useSettingsStore (writes `workModeEnabled`, `enforceWorkHours`,
 *             `workHoursStart`, `workHoursEnd`); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Switches write directly to settings.update() on change (no local state).
 *   - Next button → router.push "/onboarding/step3"; Previous uses router.back().
 *   - Hour inputs are free-text HH:MM strings via FormControls.Input — TimePickerWheel
 *     was never ported into this repo (same precedent as task-form.tsx / habit-form.tsx).
 *   - The work-mode tip is a HintCard (Decision 010, gated on showHints — set true in
 *     guided.tsx before the wizard). Decision 006 tokens throughout.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import { Input } from '@/components/FormControls';
import HintCard from '@/components/HintCard';

export default function OnboardingStep2() {
  const router = useRouter();
  const settings = useSettingsStore();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="briefcase-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.workModeOnboarding}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.workModeOnboardingSub}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>{t.startWithWorkMode}</Text>
              <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.canChangeAnytime}</Text>
            </View>
            <Switch
              value={settings.workModeEnabled}
              onValueChange={(v) => settings.update({ workModeEnabled: v })}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={settings.workModeEnabled ? theme.accent : theme.textMuted}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>{t.autoActivateWorkHours}</Text>
              <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.appSwitchesItself}</Text>
            </View>
            <Switch
              value={settings.enforceWorkHours}
              onValueChange={(v) => settings.update({ enforceWorkHours: v })}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={settings.enforceWorkHours ? theme.accent : theme.textMuted}
            />
          </View>

          {settings.enforceWorkHours && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.workHoursFormat}</Text>
              <View style={styles.hoursRow}>
                <View style={styles.hourField}>
                  <Input
                    label={t.workHoursFrom}
                    value={settings.workHoursStart || '07:00'}
                    onChangeText={(v) => settings.update({ workHoursStart: v })}
                    placeholder="07:00"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
                <View style={styles.hourField}>
                  <Input
                    label={t.workHoursTo}
                    value={settings.workHoursEnd || '17:00'}
                    onChangeText={(v) => settings.update({ workHoursEnd: v })}
                    placeholder="17:00"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        <HintCard text={t.tipWorkMode} />

        <View style={styles.progress}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
                i === 1 && { ...styles.dotActive, backgroundColor: theme.accent },
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
            onPress={() => router.push('/onboarding/step3')}
            variant="primary"
            size="md"
          />
        </View>
        {/* W-E: gentle, always-visible skip so no step feels mandatory */}
        <Button
          label={t.config.skipForNow}
          onPress={() => router.push('/onboarding/step3')}
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
  skipLink: { alignItems: 'center', paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.md },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  sub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  card: { borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLeft: { flex: 1, marginRight: Spacing.md },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  switchHint: { fontSize: FontSize.xs, marginTop: 2 },
  divider: { height: 1, marginVertical: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
  hoursRow: { flexDirection: 'row', gap: Spacing.md },
  hourField: { flex: 1 },
  tipBox: { borderRadius: Radius.md, padding: Spacing.md },
  tipText: { fontSize: FontSize.sm, lineHeight: 20 },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
