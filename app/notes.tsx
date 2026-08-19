/**
 * notes.tsx — Notes site ("Notater"): free-form notes, back-compat pushed route.
 *
 * The row list moved to components/NotesSurface.tsx (2026-08-20, "full-screen card expansion")
 * — Home's Notes card title press now expands in place instead of pushing here, so nothing in
 * the UI reaches this file any more except deep links. VoiceNoteFAB stays a ScreenScaffold
 * SIBLING here (never a child — see NotesSurface's header note on why a floating FAB can be
 * clipped by the scroll viewport the same way a toast can).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/NotesSurface, components/VoiceNoteFAB,
 *             lib/i18n, store/useNotesStore
 *   Used by → Expo Router route "/notes" — deep links only (unfocus:///notes?capture=voice,
 *             the Notes home-screen widget's mic button, still lands here)
 *   Data    → useNotesStore (add/update, for VoiceNoteFAB's transcript capture) — everything
 *             else lives in NotesSurface
 *
 * Edit notes:
 *   - Deep link `unfocus:///notes?capture=voice` → VoiceNoteFAB `autoStart` begins recording on
 *     mount. This is the one behaviour that still needs this screen to exist at all.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNotesStore } from '@/store/useNotesStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import NotesSurface from '@/components/NotesSurface';
import VoiceNoteFAB from '@/components/VoiceNoteFAB';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';

export default function NotesScreen() {
  const router = useRouter();
  const t = useT();
  const { capture } = useLocalSearchParams<{ capture?: string }>();
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);

  return (
    <>
      <ScreenScaffold title={t.notes.title} tier="sub" screenKey="notes" onBack={() => router.back()}>
        <View style={styles.content}>
          <NotesSurface />
        </View>
      </ScreenScaffold>

      <VoiceNoteFAB
        autoStart={capture === 'voice'}
        onTranscript={(text) => {
          const note = addNote();
          updateNote(note.id, { body: text });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // A pushed sub-screen reserves no bottom nav, so its lower edge lands on the safe area
  // rather than on chrome, and keeps its own paddingBottom (lib/__tests__/screenRhythm.test.ts)
  // — the vertical rhythm (gap) itself lives in NotesSurface's own `content` style, since that
  // component is also mounted inside CardExpandHost, which needs the same internal spacing
  // regardless of caller.
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
});
