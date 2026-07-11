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
 *   Imports → expo-speech-recognition, components/AddFAB (FAB_LG_SIZE/FAB_DEFAULT_BOTTOM),
 *             components/AppModal (showAppModal), constants/theme, lib/i18n, lib/useAppTheme,
 *             store/useSettingsStore (language, for the recognizer locale)
 *   Used by → app/notes.tsx (replaces AddFAB there)
 *   Data    → none directly — reports the transcript up via onTranscript; the parent owns
 *             note creation/update
 *
 * Edit notes:
 *   - Locale passed to ExpoSpeechRecognitionModule.start() is derived from
 *     useSettingsStore's language ('no' → 'nb-NO', 'en' → 'en-US'), not hardcoded.
 *   - interimResults:false + continuous:false — the OS recognizer auto-ends on a speech
 *     pause (like Siri/Google dictation) and only ever emits final results, so there's no
 *     separate "finalize" step beyond the tap-to-stop affordance for cutting a recording short.
 *   - transcriptRef holds the latest "result" event's text; "end" reads it once and clears
 *     it, so a stop with no speech captured doesn't create a blank note.
 *   - "no-speech"/"aborted" errors are expected (silence, or the user stopped early) and are
 *     swallowed; any other error surfaces via showAppModal.
 *   - `autoStart` begins listening once on mount — app/notes.tsx passes it when opened via the
 *     Notes widget's voice deep-link (unfocus:///notes?capture=voice). Guarded by a ref so it
 *     fires a single time per mount.
 *   - expo-speech-recognition ships as a reserve-only native module already in this build
 *     (Decision 040/AGENTS.md) — using it here is a normal JS change, no new native build needed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import { showAppModal } from '@/components/AppModal';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { FAB_LG_SIZE, FAB_DEFAULT_BOTTOM } from '@/components/AddFAB';

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
  const language = useSettingsStore((s) => s.language);
  const [listening, setListening] = useState(false);
  const transcriptRef = useRef('');
  const autoStartedRef = useRef(false);

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (text) transcriptRef.current = text;
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const text = transcriptRef.current.trim();
    transcriptRef.current = '';
    if (text) onTranscript(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    transcriptRef.current = '';
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    showAppModal(
      t.permissionTitle,
      event.error === 'not-allowed' ? t.notes.micPermissionBody : t.notes.micErrorBody
    );
  });

  async function handlePress() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      showAppModal(t.permissionTitle, t.notes.micPermissionBody);
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: language === 'no' ? 'nb-NO' : 'en-US',
      interimResults: false,
      continuous: false,
      addsPunctuation: true,
    });
  }

  // Auto-start once when opened via the widget's voice deep-link.
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void handlePress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={listening ? t.notes.stopRecording : t.notes.recordVoiceNote}
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
    </Pressable>
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
