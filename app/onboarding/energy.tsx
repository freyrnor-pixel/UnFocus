/**
 * energy.tsx — what "Energy" is, explained once, on its own screen
 *
 * Energy is the system in the app that is easiest to mistake for scoring, and it had nowhere
 * in onboarding that could explain it — it was one line in the old intro slideshow and
 * nothing else. So it gets a screen, with room to say what it actually does:
 *
 *   - **Energy** (`energySystemEnabled`, ON by default) — a budget, not a score. Tasks and
 *     habits can carry an energy cost, and the meter shows what today has left. It gates
 *     SURFACES only: turning it off hides the meter and the steppers but keeps every stored
 *     per-task value, so turning it back on restores all of them untouched.
 *
 * The copy's job is that distinction: Energy is about TODAY and is a planning aid, not a
 * measurement of the user. Keep any new wording on that line, and keep it off the "you're
 * behind" side of it entirely — see lib/__tests__/copyTone.test.ts.
 *
 * **This screen used to explain two systems side by side** (2026-07-31): Quiet growth
 * (`showGrowth`) had the second card, having moved here out of the feature picker because a
 * bare switch asks you to opt into a phrase whose meaning the app has not explained yet. It
 * was removed the same day, along with the picker itself, to cut onboarding down. Quiet
 * growth is untouched as a FEATURE — it still ships off by default and is still a real toggle
 * in Settings → Advanced → Features; onboarding simply no longer offers it. Hence the layout
 * here is a single centred explanation rather than a stack with one item in it.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/lib/haptics, @/components/Button, @/components/Surface, @/components/Motif,
 *             @/components/FormControls (Switch)
 *   Used by → Expo Router route "/onboarding/energy" (pushed from onboarding/guided.tsx)
 *   Data    → useSettingsStore — writes `energySystemEnabled` on continue
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - The choice is held locally and written in ONE update() on continue. Deliberately NOT
 *     written per-tap: a half-finished screen should leave the settings row alone.
 *   - **The switch is seeded from the CURRENT setting, not from `false`.** Energy ships ON,
 *     so starting unticked would quietly propose turning it off. (The deleted feature picker
 *     did seed from `false`, which is why re-running onboarding used to switch its flags off
 *     — that bug went with it.)
 *   - `halo-ring` is one holder motif for this surface — don't stack a second motif on the
 *     same card (decorativemotifs.md's "one holder per surface").
 *   - Next goes straight to '/onboarding' (the name step). The feature picker that used to
 *     sit between them is deleted — app/onboarding/features.tsx no longer exists.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { selection } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Surface from '@/components/Surface';
import Motif from '@/components/Motif';
import { Switch as FormSwitch } from '@/components/FormControls';

export default function OnboardingEnergy() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  // Seeded from what is actually applied — Energy ships on. See Edit notes.
  const [enabled, setEnabled] = useState(settings.energySystemEnabled);

  function toggle(value: boolean) {
    selection();
    setEnabled(value);
  }

  function next() {
    settings.update({ energySystemEnabled: enabled });
    router.push('/onboarding');
  }

  const copy = t.energyIntro.energy;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: theme.text }]}>{t.energyIntro.title}</Text>

        <Surface style={styles.card}>
          {/* One holder motif for this surface, sat behind the icon. */}
          <View style={styles.iconWrap}>
            <Motif id="halo-ring" color={theme.accent} fit="meet" style={styles.iconMotif} />
            <Ionicons name="battery-half-outline" size={38} color={theme.accent} />
          </View>

          <Text style={[styles.cardTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[styles.cardText, { color: theme.textMuted }]}>{copy.body}</Text>

          {/* The "you can turn this off" line sits WITH the control it describes, rather than
              above it as a third centred paragraph — it is the switch's explanation, and it
              is the only thing on the screen that isn't centred prose. */}
          <View style={[styles.noteRow, { borderColor: theme.border }]}>
            <Text style={[styles.cardNote, { color: theme.textMuted }]}>{copy.note}</Text>
            <FormSwitch checked={enabled} onChange={toggle} />
          </View>
        </Surface>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.previous} onPress={() => router.back()} variant="ghost" size="md" />
        <Button label={t.next} onPress={next} variant="primary" size="md" />
      </View>
    </SafeAreaView>
  );
}

// One explanation, centred in the page. The two-card version was a row-per-card stack — an
// icon gutter down the left, a `gap` sized to separate a pair, and a screen-level footnote
// tying the two together. None of that survives a single item: the icon moves on top of the
// text and the card centres itself instead of filling a column.
const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    // flexGrow + centre puts the one card in the middle of the page rather than at the top of
    // an otherwise empty column. When the copy outgrows the viewport (large text setting) the
    // content simply exceeds the free space and the ScrollView takes over — nothing clips.
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Spelled out, not spread from StyleSheet.absoluteFill — that is a registered style id, and
  // spreading it yields `{}`, which silently un-positions whatever needed it.
  iconMotif: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cardTitle: { fontSize: FontSize.xl, fontFamily: Fonts.semibold, textAlign: 'center' },
  cardText: { fontSize: FontSize.md, lineHeight: 22, textAlign: 'center' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
  },
  cardNote: { flex: 1, fontSize: FontSize.sm, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
