/**
 * HomeNotesCard.tsx — Home-screen preview of the real Notes feature (useNotesStore).
 *
 * Mirrors PlanTaskCard's Surface + left-accent-bar layout: always shows a collapsed
 * preview of the first COLLAPSED_COUNT active notes, with a footer toggle to reveal
 * the rest. Inline checkbox taps mark notes checked/unchecked; a "+" header action
 * creates a blank note and routes to /notes; a "See all →" footer link opens the full
 * Notes screen. Renders nothing when the notes list is empty.
 *
 * Connections:
 *   Imports → components/Surface, constants/theme, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useNotesStore
 *   Used by → app/(tabs)/index.tsx (replaces InboxSection in the Notes preview slot)
 *   Data    → reads/writes useNotesStore (notes table): toggleChecked, add
 *
 * Edit notes:
 *   - Note rows are read-only previews (no inline TextInput) — editing is the /notes screen's job.
 *   - Checked notes are shown in a dimmed collapsed sub-section only when fully expanded,
 *     mirroring PlanTaskCard's done zone.
 *   - "+" add creates a blank note via add() then navigates to /notes so the user can fill it.
 *     success() haptic fires on add; tap() haptic on toggle/expand.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useNotesStore } from '@/store/useNotesStore';

const COLLAPSED_COUNT = 3;

export default function HomeNotesCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const notes = useNotesStore((s) => s.notes);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const addNote = useNotesStore((s) => s.add);

  const [expanded, setExpanded] = useState(false);
  const [checkedOpen, setCheckedOpen] = useState(false);

  const activeNotes = notes.filter((n) => !n.checked);
  const checkedNotes = notes.filter((n) => n.checked);

  if (notes.length === 0) return null;

  const visibleActive = expanded ? activeNotes : activeNotes.slice(0, COLLAPSED_COUNT);
  const showToggle = activeNotes.length > COLLAPSED_COUNT;

  function handleAdd() {
    success();
    addNote();
    router.push('/notes');
  }

  function handleToggle(id: string) {
    tap();
    toggleChecked(id);
  }

  return (
    <Surface surfaceContext="ambient" style={[styles.card, styles.cardRow]}>
      <View style={[styles.accent, { backgroundColor: theme.featNote }]} />
      <View style={styles.cardContent}>

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>{t.notes.title}</Text>
          {activeNotes.length > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>{activeNotes.length}</Text>
            </View>
          )}
          <View style={styles.titleRight}>
            <Pressable onPress={handleAdd} hitSlop={8} accessibilityLabel={t.notes.addNote}>
              <Ionicons name="add" size={20} color={theme.accent} />
            </Pressable>
            <Pressable onPress={() => router.push('/notes')} hitSlop={8}>
              <Text style={[styles.seeAll, { color: theme.accent }]}>{t.seeAll}</Text>
            </Pressable>
          </View>
        </View>

        {/* Active note rows */}
        {activeNotes.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.notes.emptyState}</Text>
        ) : (
          <View style={styles.rows}>
            {visibleActive.map((note, idx) => (
              <View key={note.id}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.surfaceMuted }]} />}
                <View style={styles.noteRow}>
                  <Pressable
                    style={[styles.check, { borderColor: theme.featNote }]}
                    onPress={() => handleToggle(note.id)}
                    hitSlop={8}
                    accessibilityLabel={t.notes.checkedLabel}
                  >
                    {/* circle only — tap marks it checked and it moves to the done section */}
                  </Pressable>
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
        )}

        {/* Expand/collapse active notes */}
        {showToggle && (
          <Pressable
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
          >
            <Text style={[styles.footerBtnText, { color: theme.accent }]}>
              {expanded ? t.home.notesCollapse : t.home.notesExpand}
            </Text>
          </Pressable>
        )}

        {/* Checked/done zone — only shown when expanded, mirroring PlanTaskCard done zone */}
        {expanded && checkedNotes.length > 0 && (
          <View style={[styles.doneZone, { borderTopColor: theme.border }]}>
            <Pressable
              style={styles.doneHeader}
              onPress={() => { tap(); setCheckedOpen((v) => !v); }}
            >
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>
                {t.notes.checkedLabel} ({checkedNotes.length})
              </Text>
              <Ionicons
                name={checkedOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.textMuted}
              />
            </Pressable>
            {checkedOpen && checkedNotes.map((note, idx) => (
              <View key={note.id}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.surfaceMuted }]} />}
                <View style={styles.noteRow}>
                  <Pressable
                    style={[styles.check, { borderColor: theme.featNote, backgroundColor: theme.featNote }]}
                    onPress={() => handleToggle(note.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="checkmark" size={12} color={theme.bg} />
                  </Pressable>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  titleRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md },
  seeAll: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  rows: { gap: 0 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm, gap: Spacing.sm },
  check: {
    width: 20,
    height: 20,
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
  doneZone: { marginTop: Spacing.xs, borderTopWidth: 1 },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
