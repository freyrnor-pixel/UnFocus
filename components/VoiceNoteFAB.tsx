/**
 * VoiceNoteFAB.tsx — floating mic button that captures a voice note via on-device
 * speech-to-text and reports the finished transcript to its parent.
 *
 * Sits in the same bottom-right slot AddFAB used to occupy on the Notes screen — Notes
 * has no separate "add" affordance anymore; recording a note IS how a note gets created.
 * Tap to start listening, tap again (or pause speaking) to stop; onTranscript fires once
 * with the recognized text when a recording ends with something to say. Never touches the
 * note's header — that starts empty and stays whatever the user types, per app/notes.tsx.
 *
 * Connections:
 *   Imports → components/AddFAB (FAB_LG_SIZE/FAB_DEFAULT_BOTTOM), components/PressableScale,
 *             constants/theme, lib/i18n, lib/useAppTheme, lib/useVoiceCapture
 *   Used by → app/notes.tsx (replaces AddFAB there)
 *   Data    → none directly — reports the transcript up via onTranscript; the parent owns
 *             note creation/update
 *
 * Edit notes:
 *   - The recording state machine (permission, start/stop, transcript, error handling) lives
 *     in lib/useVoiceCapture.ts — shared with components/HomeNotesCard.tsx's inline mic
 *     button. This file is now just the big floating-button UI + the autoStart wiring.
 *   - `autoStart` begins listening once on mount — app/notes.tsx passes it when opened via the
 *     Notes widget's voice deep-link (unfocus:///notes?capture=voice). Guarded by a ref so it
 *     fires a single time per mount.
 *   - expo-speech-recognition ships as a reserve-only native module already in this build
 *     (Decision 040/AGENTS.md) — using it here is a normal JS change, no new native build needed.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useVoiceCapture } from '@/lib/useVoiceCapture';
import { glassKey, Radius, Spacing } from '@/constants/theme';
import { FAB_LG_SIZE, FAB_DEFAULT_BOTTOM } from '@/components/AddFAB';
import PressableScale from '@/components/PressableScale';
import { Travel } from '@/constants/motion';
import { useControlHue } from '@/lib/screenColor';

type Props = {
  /** Fires once, with the recognized text, when a recording ends with non-empty speech. */
  onTranscript: (text: string) => void;
  /** When true, begin listening on mount — used by the Notes widget's voice deep-link
   *  (unfocus:///notes?capture=voice), so the mic button opens the app and records at once. */
  autoStart?: boolean;
};

export default function VoiceNoteFAB({ onTranscript, autoStart }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const { listening, toggle } = useVoiceCapture(onTranscript);
  const autoStartedRef = useRef(false);
  // **Idle wears the screen's hue in dark, not the app's accent (2026-08-27, round 20).** This
  // FAB lives on Notes, whose hue is violet, and it was blooming blue in the corner of it —
  // one of the three sites round 20's *"never blue on a pink or cyan screen"* named. Listening
  // keeps `theme.bad`: recording is a state of the WORLD, not of the screen, and a red stop
  // button must not borrow the colour of the tab it happens to be on — the same carve-out
  // components/Button.tsx's `danger` variant makes. Body and halo read one value, so the two
  // can never disagree about which colour the key is.
  const idleHue = useControlHue(theme, isDark);
  const keyHue = listening ? theme.bad : idleHue;
  const key = glassKey(keyHue, isDark, listening ? 'loud' : 'key');

  // Auto-start once when opened via the widget's voice deep-link.
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <PressableScale
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={listening ? t.notes.stopRecording : t.notes.recordVoiceNote}
      scaleTo={0.9}
      // Matte glass, like every other key in the app since 2026-08-17/18: a flat translucent
      // wash of its own hue and one lit top-left edge, with an outward halo instead of a cast
      // shadow. **The opaque `theme.surface` disc under it is the one thing specific to a
      // FLOATING key** — this button hangs over a scrolling list rather than sitting on a card,
      // and a body that is only a 14–24% wash would let note rows travel through the middle of
      // it. Same answer the chrome got in the same pass: keep the glass, put the app's own
      // ground behind it so what shows through is a surface and never content.
      glow={{ color: keyHue, radius: Radius.full }}
      travel={Travel.fab}
      style={[
        styles.base,
        {
          width: FAB_LG_SIZE,
          height: FAB_LG_SIZE,
          bottom: FAB_DEFAULT_BOTTOM,
          // The opaque ground; the translucent body is the child below.
          backgroundColor: theme.surface,
          borderWidth: key.borderWidth,
          borderTopColor: key.borderTopColor,
          borderLeftColor: key.borderLeftColor,
          borderBottomColor: key.borderBottomColor,
          borderRightColor: key.borderRightColor,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.body, { backgroundColor: key.backgroundColor }]}
      />
      <Ionicons
        name={listening ? 'stop' : 'mic'}
        size={24}
        color={theme.text}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    // No `Shadow.fab` (2026-08-18): a 16px black blur is the "inner/heavy shadow" family the
    // matte-glass ruling drops. The outward `glow` is the key's only light now.
  },
  // The translucent key body, painted over the opaque ground and under the glyph. Full radius
  // so the wash follows the circle rather than filling its bounding box.
  body: {
    borderRadius: Radius.full,
  },
});
