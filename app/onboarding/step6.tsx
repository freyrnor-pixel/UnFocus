/**
 * step6.tsx — Companion pet naming (guided step 6 of 6)
 *
 * Final wizard step: name and customize the companion pet, then complete
 * onboarding. On finish it marks setup complete, enables the pet, and requests
 * OS notification permission.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/notifications, @/lib/i18n,
 *             @/constants/theme, @/lib/useAppTheme, @/components/Button, @/components/Pet
 *   Used by → Expo Router route "/onboarding/step6"
 *   Data    → useSettingsStore (writes `petEnabled`, `petName`, `petType`,
 *             `petColor`, `setupComplete`, `essentialsModeEnabled`, `showPoints`);
 *             requests notification permission via requestPermissions();
 *             scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - finish() sets `setupComplete:true` plus new-user defaults
 *     `essentialsModeEnabled:true` + `showPoints:true`, `petEnabled:true` and the
 *     name chosen here, then requests OS notification permission, then
 *     router.replace "/" to home.
 *   - NOTE (unported deps, flagged): the old app also called syncReminders()
 *     (lib/reminders.ts) and useTaskStore.syncAllTaskNotifications() here to
 *     schedule reminders on finish. Neither exists in this repo yet (weekly/
 *     monthly reminder + per-task notification scheduling is still unported — see
 *     PROGRESS_LOG Phase 6 flags). Left out until those modules are ported;
 *     requestPermissions() (which does exist) is kept so the OS prompt still fires.
 *   - Pet preview is live: tapping a type/colour writes straight to
 *     useSettingsStore, and Pet.tsx reads the same store reactively.
 *   - Pet.tsx's root container is `position: 'absolute'` (home-screen corner
 *     overlay) — wrapped here in a fixed-height `position: 'relative'` box so it
 *     renders inline as a preview.
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
import { requestPermissions } from '@/lib/notifications';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Pet from '@/components/Pet';

const PET_TYPES: PetType[] = ['cat', 'dog', 'bird', 'fox', 'bunny'];
const PET_EMOJIS: Record<PetType, string> = { cat: '🐱', dog: '🐶', bird: '🐦', fox: '🦊', bunny: '🐰' };

export default function OnboardingStep6() {
  const router = useRouter();
  const settings = useSettingsStore();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [petNameInput, setPetNameInput] = useState(settings.petName);

  // Colour swatches for the pet picker — same fixed palette as settings.tsx's pet colour picker.
  const petSwatches = [theme.accent, theme.good, '#A78BFA', '#F472B6', '#60A5FA', '#34D399'];

  function finish() {
    settings.update({
      setupComplete: true,
      essentialsModeEnabled: true,
      showPoints: true,
      petEnabled: true,
      petName: petNameInput.trim(),
    });
    // Reminder/task-notification scheduling is unported (see header note); still
    // request the OS permission so it's granted for when scheduling lands.
    void requestPermissions();
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

          <View style={styles.previewWrap}>
            <Pet completedToday={0} />
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
                  { backgroundColor: theme.surfaceMuted },
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
  previewWrap: { position: 'relative', height: 190, alignItems: 'center' },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
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
