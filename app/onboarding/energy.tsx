/**
 * energy.tsx — what "Energy" is, explained once, and the choice between the two modes
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
 * **The choice is TWO NAMED PEER MODES now (2026-08-02), not a switch.** The same one
 * `energySystemEnabled` boolean, the same single guard at every call site — only the framing
 * changed. `false` is **Rewards mode**: no meter, no costs, and completing something gives
 * the check-fill and the light haptic the app already ships, which is the whole of it. It is
 * a real answer to "how do you want finishing something to land", not an absence, so it must
 * never be drawn as the un-set side of anything. The control is a two-option
 * `components/SlideSelector.tsx` — INTERACTION_HANDOFF §1's "inline option picker inside a
 * card" tier, which is what a choice about one thing inside one card is. (Settings offers the
 * same two modes one tier up, as a `FormControls.SegmentedControl` form field — the tiers
 * differ on purpose; don't unify them by look.)
 *
 * **Heading + sub ratified 2026-08-01.** For one day this was the only onboarding screen with
 * a heading and no sub-heading: the two-card version's `sub` and `note` both opened with
 * "Both …", so they were deleted rather than rewritten when the second card went, and `title`
 * was left as a placeholder. The maintainer kept the placeholder title and took a new `sub`
 * written against it (`t.energyIntro.sub`). That line's job is to justify the interruption —
 * it says the rest of the app needs no such screen — so keep it OFF the subject of the meter,
 * which the card below already covers in `t.energyIntro.energy.body`.
 *
 * **PLACEHOLDER — awaiting maintainer wording.** `t.energyIntro.title` ("One thing worth
 * explaining") was ratified against a screen that explained ONE system and offered a switch.
 * The screen now offers a CHOICE between two named modes, and the heading does not say so.
 * It was left as-is on purpose rather than rewritten by an agent: the two-mode framing is
 * carried by `t.energyIntro.modes.label` on the control itself, which is where a first-time
 * user is looking when they need it, so the heading is imprecise rather than wrong. Treat
 * this as unfinished, not as settled, and don't delete this note when the wording lands.
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
 *             @/components/SlideSelector
 *   Used by → Expo Router route "/onboarding/energy" (pushed from onboarding/guided.tsx)
 *   Data    → useSettingsStore — writes `energySystemEnabled` on continue
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - The choice is held locally and written in ONE update() on continue. Deliberately NOT
 *     written per-tap: a half-finished screen should leave the settings row alone. This is
 *     also why the mode is a local `'energy' | 'rewards'` string rather than a boolean the
 *     control writes straight through.
 *   - **The mode is seeded from the CURRENT setting, not from a hard-coded default.** Energy
 *     ships ON, so starting on Rewards would quietly propose turning it off. (The deleted
 *     feature picker did seed from `false`, which is why re-running onboarding used to switch
 *     its flags off — that bug went with it.)
 *   - `SlideSelector` fires its own `selection()` haptic on change, so the screen does not
 *     add a second one.
 *   - Next still goes to '/onboarding'. Nothing here touches the flow order — that order is
 *     hard-coded across screens with a parallel `STEPS` backdrop array, and
 *     __tests__/onboardingFlow.test.ts is the only thing holding the two together.
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
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Surface from '@/components/Surface';
import Motif from '@/components/Motif';
import SlideSelector from '@/components/SlideSelector';

/** The two peer modes over the one `settings.energySystemEnabled` boolean. */
type EnergyModeChoice = 'energy' | 'rewards';

export default function OnboardingEnergy() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  // Seeded from what is actually applied — Energy ships on. See Edit notes.
  const [mode, setMode] = useState<EnergyModeChoice>(
    settings.energySystemEnabled ? 'energy' : 'rewards',
  );

  function next() {
    settings.update({ energySystemEnabled: mode === 'energy' });
    router.push('/onboarding');
  }

  const copy = t.energyIntro.energy;
  const modes = t.energyIntro.modes;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Heading and sub are ONE block: the ScrollView's own `gap` is Spacing.lg, sized to
            separate the heading from the card, which is far too much air between a heading and
            the line that belongs to it. The sub says why this screen exists at all and
            deliberately does NOT describe the meter — that is the card's own `energy.body`, a
            few lines below. Added 2026-08-01; until then this was the only onboarding screen
            with a heading and nothing under it.

            PLACEHOLDER — awaiting maintainer wording: `t.energyIntro.title` still reads
            "One thing worth explaining", written when this screen explained one system and
            offered a switch. It now offers a choice between two named modes and the heading
            doesn't say so. Not rewritten here on purpose — see this file's header note. */}
        <View style={styles.headingBlock}>
          <Text style={[styles.heading, { color: theme.text }]}>{t.energyIntro.title}</Text>
          <Text style={[styles.subheading, { color: theme.textMuted }]}>{t.energyIntro.sub}</Text>
        </View>

        <Surface style={styles.card}>
          {/* One holder motif for this surface, sat behind the icon. */}
          <View style={styles.iconWrap}>
            <Motif id="halo-ring" color={theme.accent} fit="meet" style={styles.iconMotif} />
            <Ionicons name="battery-half-outline" size={38} color={theme.accent} />
          </View>

          <Text style={[styles.cardTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[styles.cardText, { color: theme.textMuted }]}>{copy.body}</Text>

          {/* The choice, sat under the explanation it depends on and ruled off from it. This
              block is the only thing on the screen that isn't centred prose — a label, its
              control, and the SELECTED option's hint, left-aligned, the same shape Settings
              draws one tier up.

              `t.energyIntro.energy.note` ("Turning it off hides the meter…") is deliberately
              NOT rendered here any more (2026-08-02). It is the one line left on the screen
              that frames Rewards mode as Energy switched off, which is exactly the reading
              these two modes exist to prevent — and its promise (nothing you set is lost) is
              vacuous during onboarding, where the user has no per-task energy values yet. The
              key is left in lib/i18n.ts untouched; Settings still carries the losslessness
              guarantee where it can actually bite. */}
          <View style={[styles.modeBlock, { borderColor: theme.border }]}>
            <Text style={[styles.modeLabel, { color: theme.text }]}>{modes.label}</Text>
            <SlideSelector<EnergyModeChoice>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'energy', label: modes.energy.label },
                { value: 'rewards', label: modes.rewards.label },
              ]}
            />
            {/* One hint, for whichever mode is selected — not both at once. Two permanent
                descriptions would turn a choice into a comparison table, and the screen has
                already spent its explanation budget on the card above. */}
            <Text style={[styles.modeHint, { color: theme.textMuted }]}>
              {mode === 'energy' ? modes.energy.hint : modes.rewards.hint}
            </Text>
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
  headingBlock: { gap: Spacing.xs },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  // Muted, and a step down in size — it explains the heading rather than competing with it.
  // Centred to match, and allowed to wrap: at the `large` text setting in Norwegian this is
  // three lines, which is why it sits in its own block rather than being squeezed onto one.
  subheading: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
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
  // Stacked, not a row: the label sits above its control rather than beside it, because a
  // two-option selector wants the full card width. At 360px in Norwegian "Belønningsmodus" is
  // the widest label on the screen and the segment it sits in is the narrowest box the card
  // can give it — keep this block stretched, and don't add horizontal padding to it.
  modeBlock: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
  },
  modeLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  modeHint: { fontSize: FontSize.sm, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
