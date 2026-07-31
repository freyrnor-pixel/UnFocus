/**
 * useKeyboardLift.ts — reusable keyboard-avoidance for a single text field, extracted from
 * the fix proven in components/AddRow.tsx / components/PadTypeRow.tsx (2026-07-13/16/30).
 *
 * Android's default `windowSoftInputMode=resize` shrinks the visible viewport when the
 * keyboard opens but never scrolls content to compensate, so a field lower on a scrollable
 * screen can end up hidden behind the keyboard — typing continues, but the user can't see it.
 * This hook hands the enclosing ScreenScaffold the field's own node via ScrollIntoViewContext,
 * which measures it in window coords and scrolls just enough to clear the keyboard.
 *
 * Connections:
 *   Imports → components/ScreenScaffold (ScrollIntoViewContext)
 *   Used by → components/NoteRow.tsx, components/TaskCard.tsx, components/TagPickerRow.tsx,
 *             components/WeekListCard.tsx, components/HomeNotesCard.tsx,
 *             components/ShoppingFilterBar.tsx, app/automations.tsx, app/(tabs)/shopping.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - Attach `ref` directly to the TextInput (or a wrapping View if you need to lift a whole
 *     row, e.g. AddRow/PadTypeRow) — TextInput itself is a host component and supports
 *     `measureInWindow`, so no wrapper is required for a single field.
 *   - Spread/compose `onFocus`/`onBlur` onto that same field. If the field already has its own
 *     onFocus/onBlur, call this hook's alongside it — don't replace one with the other.
 *   - `null` outside a scrollable ScreenScaffold (non-scrollable/FlatList screens self-manage —
 *     see components/CatalogueTab.tsx, which uses FlatList's own scrollToIndex instead).
 */
import { useContext, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

export function useKeyboardLift<T extends Measurable>() {
  const scrollIntoView = useContext(ScrollIntoViewContext);
  const ref = useRef<T>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollIntoView?.(ref.current);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  function onFocus() {
    isFocusedRef.current = true;
    // Covers the keyboard-already-open case (switching focus to this field doesn't re-fire
    // keyboardDidShow); the listener above covers it opening fresh. Both are idempotent.
    scrollIntoView?.(ref.current);
  }

  function onBlur() {
    isFocusedRef.current = false;
  }

  return { ref, onFocus, onBlur };
}
