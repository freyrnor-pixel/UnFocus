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
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useVoiceCapture } from '@/lib/useVoiceCapture';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { FAB_LG_SIZE, FAB_DEFAULT_BOTTOM } from '@/components/AddFAB';
import PressableScale from '@/components/PressableScale';

type Props = {
  /** Fires once, with the recognized text, when a recording ends with non-empty speech. */
  onTranscript: (text: string) => void;
  /** When true, begin listening on mount — used by the Notes widget's voice deep-link
   *  (unfocus:///notes?capture=voice), so the mic button opens the app and records at once. */
  autoStart?: boolean;
};

export default function VoiceNoteFAB({ onTranscript, autoStart }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { listening, toggle } = useVoiceCapture(onTranscript);
  const autoStartedRef = useRef(false);

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
      style={[
        styles.base,
        {
          width: FAB_LG_SIZE,
          height: FAB_LG_SIZE,
          bottom: FAB_DEFAULT_BOTTOM,
          backgroundColor: listening ? theme.bad : theme.accent,
        },
      ]}
    >
      <Ionicons
        name={listening ? 'stop' : 'mic'}
        size={24}
        color={listening ? theme.textInverse : theme.accentInk}
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
    ...Shadow.fab,
  },
});
