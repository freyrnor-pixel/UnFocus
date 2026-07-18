/**
 * HomeNotesCard.tsx — Home-screen preview of the real Notes feature (useNotesStore).
 *
 * Mirrors PlanTaskCard's Surface + domain-colored-border layout: always shows a collapsed
 * preview of the first COLLAPSED_COUNT active notes, with a footer toggle to reveal
 * the rest. Inline checkbox taps mark notes checked/unchecked; a "+" header action
 * creates a blank note and routes to /notes; a "See all →" footer link opens the full
 * Notes screen. Shows an empty-state message inline when the notes list is empty
 * (always-render-header per Decision 043 rule 4) — it does not render nothing/null.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/HomePreviewEmpty,
 *             components/Collapsible + components/AnimatedChevron (checked-zone clip reveal),
 *             constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, lib/domainColor,
 *             lib/useVoiceCapture, store/useNotesStore
 *   Used by → app/(tabs)/index.tsx (replaces InboxSection in the Notes preview slot)
 *   Data    → reads/writes useNotesStore (notes table): toggleChecked, add, update
 *
 * Edit notes:
 *   - **Collapsed sizing (2026-07-13)**: `cardCollapsed` (minHeight:
 *     `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a compact shared *resting* floor
 *     applied only while `!expanded`, so this card reads the same size as
 *     PlanTaskCard/HomeShoppingCard when light — then grows per note row above it;
 *     `noteRow`'s paddingVertical was trimmed to `Spacing.xs` for a slimmer collapsed row.
 *   - **Empty state**: an empty list renders the shared `HomePreviewEmpty` (icon disc + the
 *     `t.notes.emptyState` message), which fills the resting floor as one inviting block
 *     instead of leaving a bare band under a single line of text.
 *   - Note rows are read-only previews (no inline TextInput) — editing is the /notes screen's job.
 *   - Checked notes are shown in a dimmed collapsed sub-section only when fully expanded,
 *     mirroring PlanTaskCard's done zone.
 *   - **Inline mic button (title row)**: records a voice note without leaving Home, via
 *     lib/useVoiceCapture (the same recording logic app/notes.tsx's VoiceNoteFAB uses) — on a
 *     finished transcript it creates a note (add() + update({body})), matching notes.tsx's own
 *     onTranscript handler exactly, so a note recorded from Home is identical to one recorded
 *     from /notes. Sits as a sibling of the title's PressableScale (not nested inside it) so
 *     its tap doesn't also trigger the title's navigate-to-/notes press. success() haptic on
 *     a created note; tap() haptic on toggle/expand.
 *   - **Touch target (2026-07-11)**: check circle is visually 22x22 but `hitSlop={13}`
 *     brings the tappable area to ~48dp, meeting Android's minimum touch-target size.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import HomePreviewEmpty from '@/components/HomePreviewEmpty';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useNotesStore } from '@/store/useNotesStore';
import { getDomainColor } from '@/lib/domainColor';
import { useVoiceCapture } from '@/lib/useVoiceCapture';

const COLLAPSED_COUNT = 5;

export default function HomeNotesCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'note');

  const notes = useNotesStore((s) => s.notes);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);

  const [expanded, setExpanded] = useState(false);
  const [checkedOpen, setCheckedOpen] = useState(false);

  const { listening, toggle: toggleVoiceCapture } = useVoiceCapture((text) => {
    const note = addNote();
    updateNote(note.id, { body: text });
    success();
  });

  const activeNotes = notes.filter((n) => !n.checked);
  const checkedNotes = notes.filter((n) => n.checked);

  const visibleActive = expanded ? activeNotes : activeNotes.slice(0, COLLAPSED_COUNT);
  const showToggle = activeNotes.length > COLLAPSED_COUNT;

  function handleToggle(id: string) {
    tap();
    toggleChecked(id);
  }

  function handleTitlePress() {
    router.push('/notes');
  }

  return (
    <Surface
      surfaceContext="ambient"
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>

        {/* Title row — title/badge (navigates to /notes) and the mic button are siblings,
            not nested Pressables, so tapping the mic doesn't also fire the title's navigate. */}
        <View style={styles.titleRow}>
          <PressableScale onPress={handleTitlePress} style={styles.titleLeftPressable} scaleTo={0.97}>
            <View style={styles.titleLeft}>
              <Text style={[styles.title, { color: theme.text }]}>{t.notes.title}</Text>
              {activeNotes.length > 0 && (
                <View style={[styles.badge, { backgroundColor: domainColor.soft }]}>
                  <Text style={[styles.badgeText, { color: domainColor.accent }]}>{activeNotes.length}</Text>
                </View>
              )}
            </View>
          </PressableScale>
          <PressableScale
            onPress={toggleVoiceCapture}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={listening ? t.notes.stopRecording : t.notes.recordVoiceNote}
            scaleTo={0.9}
          >
            <View
              style={[
                styles.micButton,
                { backgroundColor: listening ? theme.badSoft : domainColor.soft },
              ]}
            >
              <Ionicons name={listening ? 'stop' : 'mic'} size={15} color={listening ? theme.bad : domainColor.accent} />
            </View>
          </PressableScale>
        </View>

        {/* Active note rows */}
        {activeNotes.length === 0 ? (
          <HomePreviewEmpty icon="mic-outline" text={t.notes.emptyState} domainColor={domainColor} />
        ) : (
          <View style={styles.rowsContainer}>
            <View style={styles.rows}>
              {visibleActive.map((note, idx) => (
                <View key={note.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                  <View style={styles.noteRow}>
                    <PressableScale
                      style={[styles.check, { borderColor: domainColor.accent }]}
                      onPress={() => handleToggle(note.id)}
                      hitSlop={13}
                      accessibilityLabel={t.notes.checkedLabel}
                      scaleTo={0.97}
                    >
                      {/* circle only — tap marks it checked and it moves to the done section */}
                    </PressableScale>
                    <View style={styles.noteText}>
                      <Text
                        style={[styles.noteHeader, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {note.header || t.notes.headerPlaceholder}
                      </Text>
                      {!!note.body && (
                        <Text
                          style={[styles.noteBody, { color: theme.textMuted }]}
                          numberOfLines={1}
                        >
                          {note.body}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Expand/collapse active notes */}
        {showToggle && (
          <PressableScale
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
            scaleTo={0.97}
          >
            <Text style={[styles.footerBtnText, { color: theme.accent }]}>
              {expanded ? t.home.notesCollapse : t.home.notesExpand}
            </Text>
          </PressableScale>
        )}

        {/* Checked/done zone — only shown when expanded, mirroring PlanTaskCard done zone */}
        {expanded && checkedNotes.length > 0 && (
          <View style={styles.rowsContainer}>
            <PressableScale
              style={styles.doneHeader}
              onPress={() => { tap(); setCheckedOpen((v) => !v); }}
              scaleTo={0.97}
            >
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>
                {t.notes.checkedLabel} ({checkedNotes.length})
              </Text>
              <AnimatedChevron open={checkedOpen} size={14} color={theme.textMuted} />
            </PressableScale>
            {/* Clip-reveal (unveil), not a pop/fade — the checked notes feel folded away, still
                there, matching the Tasks/PlanTaskCard done zones (see Collapsible header). */}
            <Collapsible open={checkedOpen}>
              {checkedNotes.map((note, idx) => (
                <View key={note.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                  <View style={styles.noteRow}>
                    <PressableScale
                      style={[styles.check, { borderColor: domainColor.accent, backgroundColor: domainColor.accent }]}
                      onPress={() => handleToggle(note.id)}
                      hitSlop={8}
                      scaleTo={0.97}
                    >
                      <Ionicons name="checkmark" size={12} color={theme.accentInk} />
                    </PressableScale>
                    <View style={styles.noteText}>
                      <Text
                        style={[styles.noteHeader, { color: theme.textMuted, textDecorationLine: 'line-through' }]}
                        numberOfLines={1}
                      >
                        {note.header || t.notes.headerPlaceholder}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Collapsible>
          </View>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Collapsed-only floor so Notes/Plans/Shopping read as the same size regardless of how
  // little content one of them has (e.g. a single note) — see constants/theme.ts.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  cardContent: { flex: 1, padding: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, gap: Spacing.sm },
  titleLeftPressable: { flexShrink: 1 },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  micButton: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  // Wells removed (2026-07-13 grouping pass): rows sit directly on the card face so the
  // whole section reads as one thing, instead of a flat surfaceMuted box-in-a-box.
  rowsContainer: { marginBottom: Spacing.sm },
  rows: { gap: 0 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.xs, gap: Spacing.sm },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noteText: { flex: 1 },
  noteHeader: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  noteBody: { fontSize: FontSize.xs, fontFamily: Fonts.regular, marginTop: 1 },
  divider: { height: 1 },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
