/**
 * AiSetupPreviewModal.tsx — scrollable preview/confirm sheet for an uploaded AI setup file.
 *
 * AppModal's body is a single non-scrolling string, which can't hold an itemized
 * summary across up to 10 domains — this is the scrollable counterpart, built on the
 * same shared AnimatedBottomSheet shell every other sheet uses. Shows what WOULD be
 * created/changed (from lib/aiSetupApply.ts's previewAiSetupConfig(), a dry run) before
 * the user confirms; nothing is written to the stores until onConfirm fires.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/PressableScale,
 *             constants/theme, lib/i18n, lib/useAppTheme, lib/aiSetupApply (AiSetupApplyResult)
 *   Used by → app/settings.tsx (Upload AI setup file flow)
 *   Data    → none — purely presentational; the parent owns preview state and calls
 *             applyAiSetupConfig() itself on confirm
 *
 * Edit notes:
 *   - `preview` goes null in the same update that flips `visible` false (same pattern as
 *     UpdateSheet.tsx's `lastItem`) — cached via `lastPreview` so content stays visible
 *     during AnimatedBottomSheet's exit animation.
 *   - Domain row order matches lib/aiSetupGuide.ts's guide schema section.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import type { AiSetupApplyResult, DomainResult } from '@/lib/aiSetupApply';

type Props = {
  visible: boolean;
  preview: AiSetupApplyResult | null;
  staleWarning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const DOMAIN_KEYS = [
  'tasks', 'habits', 'goals', 'notes', 'shoppingLists', 'shoppingItems',
  'inventoryItems', 'catalogueItems', 'meals', 'monthlyLists',
] as const;

export default function AiSetupPreviewModal({ visible, preview, staleWarning, onConfirm, onCancel }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  // preview goes null in the same update that flips visible false — cache the last
  // non-null value so the sheet still has content during the exit animation.
  const [lastPreview, setLastPreview] = useState(preview);
  useEffect(() => {
    if (preview) setLastPreview(preview);
  }, [preview]);

  if (!lastPreview) return null;

  const domainRows = DOMAIN_KEYS.map((key) => ({ key, label: t.aiSetup.domains[key], result: lastPreview[key] as DomainResult }))
    .filter((row) => row.result.created > 0 || row.result.skipped.length > 0);

  const settingsRow =
    lastPreview.settings.applied.length > 0 || lastPreview.settings.skipped.length > 0 ? lastPreview.settings : null;

  const nothingToDo = domainRows.length === 0 && !settingsRow;

  return (
    <AnimatedBottomSheet visible={visible} onClose={onCancel}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.aiSetup.previewTitle}</Text>

        {staleWarning && (
          <View style={[styles.warningBanner, { backgroundColor: theme.warnSoft }]}>
            <Text style={[styles.warningText, { color: theme.warn }]}>{t.aiSetup.staleWarning}</Text>
          </View>
        )}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {nothingToDo && (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.aiSetup.nothingToImport}</Text>
          )}

          {settingsRow && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.aiSetup.domains.settings}</Text>
              {settingsRow.applied.length > 0 && (
                <Text style={[styles.sectionLine, { color: theme.textMuted }]}>
                  {t.aiSetup.settingsWillChange(settingsRow.applied.length)}
                </Text>
              )}
              {settingsRow.skipped.map((s, i) => (
                <Text key={i} style={[styles.sectionLine, { color: theme.textMuted }]}>
                  {t.aiSetup.skippedField(s.field, t.aiSetup.skippedReason[s.reason] ?? s.reason)}
                </Text>
              ))}
            </View>
          )}

          {domainRows.map(({ key, label, result }) => (
            <View key={key} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{label}</Text>
              {result.created > 0 && (
                <Text style={[styles.sectionLine, { color: theme.textMuted }]}>
                  {t.aiSetup.itemsWillBeAdded(result.created)}
                </Text>
              )}
              {result.skipped.length > 0 && (
                <Text style={[styles.sectionLine, { color: theme.textMuted }]}>
                  {t.aiSetup.skippedCount(result.skipped.length)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.actionsRow}>
          <PressableScale style={styles.ghostBtn} onPress={onCancel} scaleTo={0.97}>
            <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancel}</Text>
          </PressableScale>
          <PressableScale
            style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: nothingToDo ? 0.5 : 1 }]}
            onPress={onConfirm}
            scaleTo={0.95}
            disabled={nothingToDo}
          >
            <Text style={[styles.primaryBtnText, { color: theme.accentInk }]}>{t.aiSetup.confirmImport}</Text>
          </PressableScale>
        </View>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
  warningBanner: { borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm },
  warningText: { fontSize: FontSize.sm, lineHeight: 18 },
  scroll: { maxHeight: 360 },
  scrollContent: { gap: Spacing.md, paddingBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', paddingVertical: Spacing.lg },
  section: { gap: 2 },
  sectionLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  sectionLine: { fontSize: FontSize.sm, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
