/**
 * useKeyboardAwareScroll.test.ts — pins the pure lift arithmetic behind every keyboard lift
 * (ScreenScaffold, CenterModalScreen, CardExpandHost). The hook's native half (Keyboard
 * metrics, measureInWindow) is a blind class — see the hook's header.
 */
import { KEYBOARD_MARGIN, liftDelta } from '@/lib/useKeyboardAwareScroll';

describe('liftDelta', () => {
  const visibleTop = 100;
  const visibleBottom = 500; // keyboard top

  it('does not scroll a field already clear of the keyboard', () => {
    expect(liftDelta({ top: 200, bottom: 240 }, visibleTop, visibleBottom)).toBe(0);
  });

  it('scrolls a covered field by exactly its overlap plus the margin', () => {
    expect(liftDelta({ top: 520, bottom: 560 }, visibleTop, visibleBottom)).toBe(60 + KEYBOARD_MARGIN);
  });

  it('lifts a field that only just touches the keyboard', () => {
    expect(liftDelta({ top: 450, bottom: 495 }, visibleTop, visibleBottom)).toBe(-5 + KEYBOARD_MARGIN);
  });

  it('never pushes a tall field’s top out of the visible band', () => {
    // A 600px multiline note starting at 300: clearing its bottom would need 416, but its top
    // can only move up 300 - 100 - margin.
    expect(liftDelta({ top: 300, bottom: 900 }, visibleTop, visibleBottom)).toBe(300 - visibleTop - KEYBOARD_MARGIN);
  });

  it('never returns a negative scroll', () => {
    expect(liftDelta({ top: 90, bottom: 900 }, visibleTop, visibleBottom)).toBe(0);
  });
});
