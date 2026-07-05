/**
 * step6.tsx — Companion pet naming (guided step 6 of 6)
 *
 * Final wizard step: name and customize the companion pet, then complete
 * onboarding. On finish it marks setup complete, enables the pet, and requests
 * OS notification permission.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/i18n, @/constants/theme, @/constants/petData,
 *             @/lib/useAppTheme, @/components/Button, @/components/Creature
 *   Used by → Expo Router route "/onboarding/step6"
 *   Data    → useSettingsStore (writes `petEnabled`, `petName`, `petType`,
 *             `petColor`, `setupComplete`, `essentialsModeEnabled`, `showPoints`);
 *             requests notification permission via requestPermissions(), then
 *             schedules reminders via syncReminders() + useTaskStore
 *             .syncAllTaskNotifications(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - finish() sets `setupComplete:true` plus new-user defaults
 *     `essentialsModeEnabled:true` + `showPoints:true`, `petEnabled:true` and the
 *     name chosen here, then requests OS notification permission and, once it
 *     resolves, schedules reminders (syncReminders + syncAllTaskNotifications),
 *     then router.replace "/" to home.
 *   - Scheduling wiring (Decision 031): step4 turns remindersEnabled +
 *     taskNotificationsEnabled ON, so finish() must actually schedule against them.
 *     `lib/reminders.ts` (syncReminders) and useTaskStore.syncAllTaskNotifications()
 *     are both ported now, so the earlier "left out until ported" gap is closed.
 *   - Preview + type chooser are merged into one card: the drawn Creature sits
 *     centered in a habitat "stage" (glow from PET_PALETTES, chosen by useIsDark),
 *     with the type chips directly below. Tapping a type/colour writes straight to
 *     useSettingsStore; the preview reads petType/petColor reactively and updates in
 *     place. Creature is used directly (not the full home-screen Pet, whose
 *     absolute-positioned habitat/treats overlay is designed for the home corner and
 *     rendered misplaced when embedded inline).
 *   - The pet colour swatches are stored hex values (petColor is a hex string);
 *     theme.accent/theme.good seed the first two, the rest are the fixed palette
 *     shared with the (not-yet-ported) settings pet picker. Decision 006 tokens
 *     for all screen chrome.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, PetType } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles, useIsDark, useAccessibility } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Creature from '@/components/Creature';
import { PET_PALETTES, GLOW_OPACITY, furFor } from '@/constants/petData';

const PET_TYPES: PetType[] = ['cat', 'dog', 'bird', 'fox', 'bunny'];
const PET_EMOJIS: Record<PetType, string> = { cat: '🐱', dog: '🐶', bird: '🐦', fox: '🦊', bunny: '🐰' };

export default function OnboardingStep6() {
  const router = useRouter();
  const settings = useSettingsStore();
  const t = useT();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const [petNameInput, setPetNameInput] = useState(settings.petName);

  // Colour swatches for the pet picker — same fixed palette as settings.tsx's pet colour picker.
  const petSwatches = [theme.accent, theme.good, '#A78BFA', '#F472B6', '#60A5FA', '#34D399'];

  // Live preview: the chosen type's habitat glow behind the actual drawn creature, so
  // picking a type/colour below updates this single preview (merged preview + chooser).
  const palette = PET_PALETTES[settings.petType] ?? PET_PALETTES.cat;
  const habitat = isDark ? palette.dark : palette.light;
  const previewFur = furFor(settings.petType, settings.petColor);
  const glowOpacity = isDark ? GLOW_OPACITY.dark : GLOW_OPACITY.light;

  function finish() {
    settings.update({
      setupComplete: true,
      essentialsModeEnabled: true,
      showPoints: true,
      petEnabled: true,
      petName: petNameInput.trim(),
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="paw-outline" size={36} color={theme.accent} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>{t.onboarding.step6.title}</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>{t.onboarding.step6.subtitle}</Text>
          </View>

          {/* Merged live preview + type chooser: the drawn creature sits centered in
              its habitat glow, and the type chips right below update it in place. */}
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={[styles.petStage, { backgroundColor: habitat.sky }]}>
              <View
                style={[styles.stageGlow, { backgroundColor: habitat.glow, opacity: glowOpacity }]}
                pointerEvents="none"
              />
              <Creature
                type={settings.petType}
                mood="happy"
                fur={previewFur}
                scale={1.7}
                reducedMotion={reducedMotion}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.pet.type}</Text>
            <View style={styles.petTypeRow}>
              {PET_TYPES.map((pt) => (
                <Pressable
                  key={pt}
                  style={[
                    styles.petTypeCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: 'transparent' },
                    settings.petType === pt && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                  ]}
                  onPress={() => settings.update({ petType: pt })}
                >
                  <Text style={styles.petTypeEmoji}>{PET_EMOJIS[pt]}</Text>
                  <Text style={[styles.petTypeLabel, { color: theme.text }]}>{t.settings.pet.typeLabels[pt]}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.pet.name}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.surface }]}
              value={petNameInput}
              onChangeText={setPetNameInput}
              onBlur={() => settings.update({ petName: petNameInput.trim() })}
              placeholder={t.onboarding.step6.namePlaceholder}
              placeholderTextColor={theme.textMuted}
              returnKeyType="done"
            />
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.pet.colour}</Text>
            <View style={styles.swatchRow}>
              {petSwatches.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.petSwatch,
                    { backgroundColor: color, borderColor: 'transparent' },
                    settings.petColor === color && { borderColor: theme.text },
                  ]}
                  onPress={() => settings.update({ petColor: color })}
                />
              ))}
            </View>
          </View>

          <View style={styles.progress}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: theme.border },
                  i === 5 && { ...styles.dotActive, backgroundColor: theme.accent },
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
      </KeyboardAvoidingView>
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
  petStage: {
    height: 168,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  stageGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  fieldLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  input: { borderRadius: Radius.sm, borderWidth: 2, padding: Spacing.md, fontSize: FontSize.lg },
  petTypeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  petTypeCard: { flex: 1, minWidth: 60, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 2 },
  petTypeEmoji: { fontSize: 28 },
  petTypeLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  swatchRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  petSwatch: { width: 40, height: 40, borderRadius: Radius.full, borderWidth: 3 },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
});
