/**
 * HomeNotesCard.tsx — Home-screen preview of the real Notes feature (useNotesStore).
 *
 * Mirrors PlanTaskCard's Surface + left-accent-bar layout: always shows a collapsed
 * preview of the first COLLAPSED_COUNT active notes, with a footer toggle to reveal
 * the rest. Inline checkbox taps mark notes checked/unchecked; a "+" header action
 * creates a blank note and routes to /notes; a "See all →" footer link opens the full
 * Notes screen. Shows an empty-state message inline when the notes list is empty
 * (always-render-header per Decision 043 rule 4) — it does not render nothing/null.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, lib/haptics,
 *             lib/i18n, lib/useAppTheme, lib/domainColor, store/useNotesStore
 *   Used by → app/(tabs)/index.tsx (replaces InboxSection in the Notes preview slot)
 *   Data    → reads/writes useNotesStore (notes table): toggleChecked, add
 *
 * Edit notes:
 *   - Note rows are read-only previews (no inline TextInput) — editing is the /notes screen's job.
 *   - Checked notes are shown in a dimmed collapsed sub-section only when fully expanded,
 *     mirroring PlanTaskCard's done zone.
 *   - "+" add creates a blank note via add() then navigates to /notes so the user can fill it.
 *     success() haptic fires on add; tap() haptic on toggle/expand.
 *   - **Touch target (2026-07-11)**: check circle is visually 22x22 but `hitSlop={13}`
 *     brings the tappable area to ~48dp, meeting Android's minimum touch-target size.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useNotesStore } from '@/store/useNotesStore';
import { getDomainColor } from '@/lib/domainColor';

const COLLAPSED_COUNT = 5;

export default function HomeNotesCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'note');

  const notes = useNotesStore((s) => s.notes);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);

  const [expanded, setExpanded] = useState(false);
  const [checkedOpen, setCheckedOpen] = useState(false);

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
    <Surface surfaceContext="ambient" tint={domainColor.tint} style={[styles.card, styles.cardRow]}>
      <View style={[styles.accent, { backgroundColor: domainColor.accent }]} />
      <View style={styles.cardContent}>

        {/* Title row */}
        <PressableScale onPress={handleTitlePress} style={styles.titleRowPressable} scaleTo={0.97}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>{t.notes.title}</Text>
            {activeNotes.length > 0 && (
              <View style={[styles.badge, { backgroundColor: domainColor.soft }]}>
                <Text style={[styles.badgeText, { color: domainColor.accent }]}>{activeNotes.length}</Text>
              </View>
            )}
          </View>
        </PressableScale>

        {/* Active note rows */}
        {activeNotes.length === 0 ? (
          <View style={styles.rowsContainer}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.notes.emptyState}</Text>
          </View>
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
              <Ionicons
                name={checkedOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.textMuted}
              />
            </PressableScale>
            {checkedOpen && checkedNotes.map((note, idx) => (
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
          </View>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  cardRow: { flexDirection: 'row' },
  accent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  cardContent: { flex: 1, padding: Spacing.md },
  titleRowPressable: { marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  // Wells removed (2026-07-13 grouping pass): rows sit directly on the domain-tinted card
  // face so the whole section reads as one thing, instead of a flat surfaceMuted box-in-a-box.
  rowsContainer: { marginBottom: Spacing.sm },
  rows: { gap: 0 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm, gap: Spacing.sm },
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
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.sm },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
