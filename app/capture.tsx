/**
 * capture.tsx — quick-capture inbox entry point (AP-02)
 *
 * Single-purpose screen: type a thought, tap Capture, it lands in the inbox
 * (store/useInboxStore.ts) instantly — no date, time, or category to decide on
 * up front. In add-mode it stays open after each capture (input cleared +
 * refocused) so several thoughts can be jotted down in one sitting; in edit-mode
 * (?id=) it pre-fills the row, saves via update(), then closes.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Button, components/ConfirmationBanner,
 *             constants/theme, lib/i18n, lib/useAppTheme, store/useInboxStore
 *   Used by → Expo Router route "/capture", components/InboxSection.tsx (edit affordance,
 *             passes ?id= per Decision 012)
 *   Data    → useInboxStore.add() inserts into inbox_items; useInboxStore.update() edits an existing row
 *
 * Edit notes:
 *   - All visible strings go through useT() (t.inbox.*).
 *   - Deliberately no task-form-style fields here (date/time/importance) — those
 *     decisions happen later when promoting an item via components/InboxSection.tsx.
 *   - Decision 001 tier='sub' scaffold (back link left, iOS-only). The
 *     ConfirmationBanner renders as a sibling overlay of ScreenScaffold, same
 *     pattern app/task-form.tsx uses.
 *   - Decision 006 tokens only (surface/text/accent) — old theme.white/orange retired.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import ScreenScaffold from '@/components/ScreenScaffold';
import Button from '@/components/Button';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useInboxStore } from '@/store/useInboxStore';

export default function CaptureScreen() {
  const router = useRouter();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const addItem = useInboxStore((s) => s.add);
  const updateItem = useInboxStore((s) => s.update);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useInboxStore((s) => (id ? s.items.find((i) => i.id === id) : undefined));
  const isEditing = !!id;

  const [text, setText] = useState(existing?.text ?? '');
  const [confirm, setConfirm] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  function capture() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isEditing && id) {
      updateItem(id, trimmed);
      router.back();
      return;
    }
    addItem(trimmed);
    setText('');
    setConfirm(t.inbox.captured);
    inputRef.current?.focus();
  }

  return (
    <>
      <ScreenScaffold
        title={isEditing ? t.inbox.editTitle : t.inbox.title}
        tier="sub"
        onBack={() => router.back()}
      >
        <View style={styles.content}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={text}
            onChangeText={setText}
            placeholder={t.inbox.placeholder}
            placeholderTextColor={theme.textMuted}
            multiline
            returnKeyType="done"
            onSubmitEditing={capture}
          />
          <Button
            label={isEditing ? t.inbox.saveButton : t.inbox.captureButton}
            onPress={capture}
            disabled={!text.trim()}
          />
        </View>
      </ScreenScaffold>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  input: {
    minHeight: 160,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    textAlignVertical: 'top',
  },
});
