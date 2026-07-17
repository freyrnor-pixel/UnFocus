/**
 * useVoiceCapture.ts — shared on-device speech-to-text recording logic.
 *
 * Wraps expo-speech-recognition's permission + start/stop/result/error event flow into a
 * single hook so any mic-button UI can drive a recording without re-implementing the
 * native event plumbing. Extracted from components/VoiceNoteFAB.tsx so a second mic button
 * (components/HomeNotesCard.tsx's inline one) can reuse the exact same behavior.
 *
 * Connections:
 *   Imports → expo-speech-recognition, components/AppModal (showAppModal), lib/i18n,
 *             store/useSettingsStore
 *   Used by → components/VoiceNoteFAB.tsx (app/notes.tsx's FAB), components/HomeNotesCard.tsx
 *             (Home's inline mic button), app/task-form.tsx (Title field mic button,
 *             reserve-only, gated on settings.voiceNotesEnabled)
 *   Data    → none directly — reports the finished transcript via onTranscript
 *
 * Edit notes:
 *   - **Multi-instance guard**: `ExpoSpeechRecognitionModule`'s events are a single global
 *     native emitter — every mounted hook instance (Home's button AND the /notes FAB can
 *     both be mounted at once, since pushing /notes on top of the tabs stack doesn't unmount
 *     Home underneath) receives every 'start'/'result'/'end'/'error' event, not just the
 *     instance that called `.start()`. `activeRef` tracks whether *this* instance is the one
 *     that initiated the current recording (set true right before `.start()`, cleared on
 *     'end'/'error'); every handler bails out early unless it's set. Without this, both a
 *     Home recording AND the /notes FAB would fire `onTranscript` for the same utterance —
 *     e.g. two notes created from one recording.
 *   - Locale is derived from useSettingsStore's language ('no' → 'nb-NO', 'en' → 'en-US').
 *   - interimResults:false + continuous:false — the OS recognizer auto-ends on a speech
 *     pause (like Siri/Google dictation) and only ever emits final results.
 *   - "no-speech"/"aborted" errors are expected (silence, or the user stopped early) and are
 *     swallowed; any other error surfaces via showAppModal.
 */
import { useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import { showAppModal } from '@/components/AppModal';

export function useVoiceCapture(onTranscript: (text: string) => void) {
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const [listening, setListening] = useState(false);
  const transcriptRef = useRef('');
  const activeRef = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    if (!activeRef.current) return;
    setListening(true);
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!activeRef.current) return;
    const text = event.results[0]?.transcript;
    if (text) transcriptRef.current = text;
  });

  useSpeechRecognitionEvent('end', () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setListening(false);
    const text = transcriptRef.current.trim();
    transcriptRef.current = '';
    if (text) onTranscript(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setListening(false);
    transcriptRef.current = '';
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    showAppModal(
      t.permissionTitle,
      event.error === 'not-allowed' ? t.notes.micPermissionBody : t.notes.micErrorBody
    );
  });

  async function toggle() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      showAppModal(t.permissionTitle, t.notes.micPermissionBody);
      return;
    }
    activeRef.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: language === 'no' ? 'nb-NO' : 'en-US',
      interimResults: false,
      continuous: false,
      addsPunctuation: true,
    });
  }

  return { listening, toggle };
}
