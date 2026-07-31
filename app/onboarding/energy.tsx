/**
 * energy.tsx — "Energy" vs "Quiet growth", explained side by side
 *
 * These are the two systems in the app that are easy to confuse — both sound like scoring,
 * neither is — and neither had anywhere in onboarding that could explain them. Energy was
 * only ever mentioned as one line in the old intro slideshow, and Quiet growth was a bare
 * switch in the feature picker labelled with a phrase you had not been told the meaning of.
 * So they get a screen, with room to say what each one actually does:
 *
 *   - **Energy** (`energySystemEnabled`, ON by default) — a budget, not a score. Tasks and
 *     habits can carry an energy cost, and the meter shows what today has left. It gates
 *     SURFACES only: turning it off hides the meter and the steppers but keeps every stored
 *     per-task value, so turning it back on restores all of them untouched.
 *   - **Quiet growth** (`showGrowth`, OFF by default) — the reward, and deliberately the
 *     opposite of a streak counter: it shows NO number anywhere. The backdrop's tree tints
 *     and grows a branch as active days accumulate, and fades back to exactly the art the app
 *     always had when they don't. There is no "you broke it" state.
 *
 * The copy's job is the distinction: Energy is about TODAY and is a planning aid; growth is
 * about the long run and is scenery. Keep any new wording on that line, and keep it off the
 * "you're behind" side of it entirely — see lib/__tests__/copyTone.test.ts.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/lib/haptics, @/components/Button, @/components/Surface, @/components/Motif,
 *             @/components/FormControls (Switch)
 *   Used by → Expo Router route "/onboarding/energy" (pushed from onboarding/guided.tsx)
 *   Data    → useSettingsStore — writes `energySystemEnabled` + `showGrowth` on continue
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Selections are held locally and written in ONE update() on continue, the same shape as
 *     app/onboarding/features.tsx. Deliberately NOT written per-tap: a half-finished screen
 *     should leave the settings row alone.
 *   - **The switches are seeded from the CURRENT settings, not from `false`** — unlike
 *     features.tsx, whose whole framing is "off unless you ask for it". Here one of the two
 *     (Energy) ships ON, so starting both unticked would quietly propose turning Energy off.
 *   - There is deliberately no live preview of growth. It would be a lie on a fresh install:
 *     the backdrop is driven by a real streak read from habit_logs/tasks, so on day one
 *     toggling `showGrowth` changes nothing visible. The motif illustration says what will
 *     happen instead of pretending to show it.
 *   - `halo-ring` and `canopy-corner` are one holder motif each, per surface — don't stack a
 *     second motif on the same card (decorativemotifs.md's "one holder per surface").
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
import type { MotifId } from '@/constants/motifs';

type Key = 'energySystemEnabled' | 'showGrowth';

const CARDS: {
  key: Key;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  motif: MotifId;
  copy: (t: ReturnType<typeof useT>) => { title: string; body: string; note: string };
}[] = [
  {
    key: 'energySystemEnabled',
    icon: 'battery-half-outline',
    motif: 'halo-ring',
    copy: (t) => t.energyIntro.energy,
  },
  {
    key: 'showGrowth',
    icon: 'leaf-outline',
    motif: 'canopy-corner',
    copy: (t) => t.energyIntro.growth,
  },
];

export default function OnboardingEnergy() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  // Seeded from what is actually applied — Energy ships on, growth ships off. See Edit notes.
  const [picked, setPicked] = useState<Record<Key, boolean>>({
    energySystemEnabled: settings.energySystemEnabled,
    showGrowth: settings.showGrowth,
  });

  function toggle(key: Key, value: boolean) {
    selection();
    setPicked((p) => ({ ...p, [key]: value }));
  }

  function next() {
    settings.update(picked);
    router.push('/onboarding/features');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={[styles.heading, { color: theme.text }]}>{t.energyIntro.title}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.energyIntro.sub}</Text>
        </View>

        {CARDS.map(({ key, icon, motif, copy }) => {
          const c = copy(t);
          return (
            <Surface key={key} style={styles.card}>
              {/* One holder motif per card, sat behind the icon. */}
              <View style={styles.iconWrap}>
                <Motif id={motif} color={theme.accent} fit="meet" style={styles.iconMotif} />
                <Ionicons name={icon} size={26} color={theme.accent} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{c.title}</Text>
                  <FormSwitch checked={picked[key]} onChange={(v) => toggle(key, v)} />
                </View>
                <Text style={[styles.cardText, { color: theme.textMuted }]}>{c.body}</Text>
                <Text style={[styles.cardNote, { color: theme.textMuted, borderColor: theme.border }]}>
                  {c.note}
                </Text>
              </View>
            </Surface>
          );
        })}

        <View style={[styles.footNote, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
          <Text style={[styles.footNoteText, { color: theme.textMuted }]}>{t.energyIntro.note}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.previous} onPress={() => router.back()} variant="ghost" size="md" />
        <Button label={t.next} onPress={next} variant="primary" size="md" />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  top: { gap: Spacing.xs },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold },
  sub: { fontSize: FontSize.md, lineHeight: 22 },
  card: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Spelled out, not spread from StyleSheet.absoluteFill — that is a registered style id, and
  // spreading it yields `{}`, which silently un-positions whatever needed it.
  iconMotif: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cardBody: { flex: 1, gap: Spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  cardText: { fontSize: FontSize.sm, lineHeight: 20 },
  cardNote: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    borderLeftWidth: 2,
    paddingLeft: Spacing.sm,
    marginTop: 2,
  },
  footNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  footNoteText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
