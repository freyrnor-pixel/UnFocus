/**
 * KeyboardAwareScrollView.tsx — a vertical ScrollView that keeps the field being typed into
 * above the keyboard. Drop-in for `<ScrollView>` on any surface that hosts text fields and is
 * NOT a ScreenScaffold (which runs the same hook itself).
 *
 * It provides `ScrollIntoViewContext`, so every field inside — `Input` (components/FormControls),
 * AddRow, PadTypeRow, anything on `useKeyboardLift` — lifts itself on focus with no wiring at the
 * call site. See lib/useKeyboardAwareScroll.ts for the mechanics and why it was needed.
 *
 * Connections:
 *   Imports → lib/useKeyboardAwareScroll, lib/scrollIntoView
 *   Used by → components/CenterModalScreen.tsx, components/CardExpandHost.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - `keyboardShouldPersistTaps="handled"` is the default here (same as ScreenScaffold) so the
 *     first tap on a button while typing presses it instead of only closing the keyboard.
 *   - The keyboard padding is APPENDED to `contentContainerStyle`'s own paddingBottom by a
 *     trailing spacer, so the caller's padding stays untouched and nothing reflows when 0.
 */
import React, { useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useKeyboardAwareScroll } from '@/lib/useKeyboardAwareScroll';
import { ScrollIntoViewContext } from '@/lib/scrollIntoView';

export default function KeyboardAwareScrollView({ children, onScroll, onLayout, ...rest }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const kb = useKeyboardAwareScroll(ref);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...rest}
      ref={ref}
      onScroll={(e) => {
        kb.onScroll(e);
        onScroll?.(e);
      }}
      onLayout={(e) => {
        kb.onLayout(e);
        onLayout?.(e);
      }}
    >
      <ScrollIntoViewContext.Provider value={kb.scrollIntoView}>{children}</ScrollIntoViewContext.Provider>
      {kb.keyboardPad > 0 ? <View style={{ height: kb.keyboardPad }} /> : null}
    </ScrollView>
  );
}
