/**
 * composerFocusSteal.test.ts — a quick-add's own controls may take the field's focus, and the
 * composer must survive it (2026-08-18).
 *
 * The report was "when I pressed the one that chooses week, and I tried to change interval, it
 * froze. Not crashed, but froze" — a habit's "Hvor ofte?" picker on the merged Today card.
 * Nothing had frozen. The picker goes through `showAppModal`, which mounts a React Native
 * `<Modal>`, and a Modal takes window focus: the composer's TextInput blurs the moment the
 * dialog appears. Both composers read that blur as "the user left", and on an untitled line
 * that meant:
 *
 *   - `components/PadTypeRow.tsx` — `showControls` was `focused || hasText`, so the whole
 *     options panel UNMOUNTED behind the open dialog. The user picked "Weekly", the dialog
 *     closed, and the cells it had just configured were gone — including the interval stepper
 *     that the pick brings into existence. Taps in that area then landed on nothing.
 *   - `components/AddRow.tsx` — an empty row collapses to the "+" bar on blur, so
 *     `app/plans.tsx`'s Whenever composer folded away entirely on the same press. Its
 *     `extras` slot has the same defect without any modal involved:
 *     `components/FoodTab.tsx` puts sibling TextInputs there, and focusing one blurs the name.
 *
 * The state itself was never lost (it lives in the caller's hook, not in the panel) — only its
 * UI, which is exactly why this is reported as a freeze rather than as a reset.
 *
 * **Why a source scan and not a render test.** The trigger is a native `<Modal>` taking window
 * focus, which the node env has no concept of and which `npm run preview` reproduces only by
 * accident (react-native-web blurs on mousedown instead). What can be checked cheaply and
 * exactly is the SHAPE of the guard: that the gate has an engagement term, that the blur
 * branch is guarded by the capture-phase flag, and that every slot holding a caller's controls
 * actually spreads that capture handler — the last being the one a new slot would silently
 * miss. Precedent for the style: lib/__tests__/chromeRhythm.test.ts, exampleRows.test.ts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

/** Source with every comment removed — this repo's headers describe what they replaced, so an
 *  assertion about what the code does has to read code, not prose. */
const code = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('PadTypeRow — the options panel outlives a picker that steals the focus', () => {
  const source = code('components/PadTypeRow.tsx');

  it('gates the controls on engagement, not on focus-or-text alone', () => {
    // The exact bug: `focused || hasText` is false while a modal opened FROM one of these
    // controls is on screen and the line has no title yet.
    expect(source).not.toMatch(/const\s+showControls\s*=\s*focused\s*\|\|\s*hasText\s*;/);
    expect(source).toMatch(/const\s+showControls\s*=\s*focused\s*\|\|\s*hasText\s*\|\|\s*engaged\s*;/);
  });

  it('sets engagement from the same capture-phase responder that flags an internal press', () => {
    const responder = source.match(
      /onStartShouldSetResponderCapture:\s*\(\)\s*=>\s*\{[\s\S]*?\}/
    )?.[0];
    expect(responder).toBeTruthy();
    expect(responder).toMatch(/internalPressRef\.current\s*=\s*true/);
    expect(responder).toMatch(/setEngaged\(true\)/);
    // …and returns false, so the child control still receives the touch as usual.
    expect(responder).toMatch(/return\s+false/);
  });

  it('clears engagement only when the line is genuinely finished or left', () => {
    // Committing the line and handing off to the tier-3 editor both end it.
    expect(source).toMatch(/function commit\(\)[\s\S]{0,400}setEngaged\(false\)/);
    expect(source).toMatch(/onPress=\{\(\)\s*=>\s*\{[\s\S]{0,200}setEngaged\(false\);[\s\S]{0,200}onMore\(\)/);
    // A blur that came from this row's own controls must NOT clear it — the early return has
    // to come first, or the picker's own blur folds the panel away again.
    const blur = source.match(/onBlur=\{\(\)\s*=>\s*\{[\s\S]*?\n\s{8}\}\}/)?.[0];
    expect(blur).toBeTruthy();
    expect(blur!.indexOf('internalPressRef.current')).toBeLessThan(blur!.indexOf('setEngaged(false)'));
  });

  it('re-arms the internal-press flag on focus, so it cannot leak into a later tap-away', () => {
    // Once a picker has been through here the field is blurred, so a control press sets the
    // flag with no blur to consume it. Left stale, the next genuine tap-away is swallowed and
    // a typed line silently fails to commit.
    expect(source).toMatch(/onFocus=\{\(\)\s*=>\s*\{[\s\S]{0,600}internalPressRef\.current\s*=\s*false/);
  });

  it('spreads the capture handler on every slot that renders a caller’s controls', () => {
    for (const slot of ['styles.panelSlot', 'styles.panelButtonRow', 'styles.extrasSlot']) {
      expect(source).toMatch(
        new RegExp(`style=\\{${slot.replace('.', '\\.')}\\}\\s*\\{\\.\\.\\.controlsResponderProps\\}`)
      );
    }
  });
});

describe('AddRow — an empty row is not collapsed by its own controls', () => {
  const source = code('components/AddRow.tsx');

  it('skips the blur-collapse when the blur came from one of its own controls', () => {
    const blur = source.match(/onBlur=\{\(\)\s*=>\s*\{[\s\S]*?\n\s{6}\}\}/)?.[0];
    expect(blur).toBeTruthy();
    // The guard has to precede the collapse, not sit after it.
    expect(blur!.indexOf('internalPressRef.current')).toBeLessThan(blur!.indexOf('setExpanded(false)'));
    expect(blur).toMatch(/if\s*\(internalPressRef\.current\)\s*\{[\s\S]{0,120}return;/);
  });

  it('re-arms the flag on focus', () => {
    expect(source).toMatch(/onFocus=\{\(\)\s*=>\s*\{[\s\S]{0,600}internalPressRef\.current\s*=\s*false/);
  });

  it('spreads the capture handler on every slot that renders a caller’s controls', () => {
    // `panel` (plans' Whenever repeat picker), `extras` (FoodTab's sibling amount/unit/price
    // inputs) and the Save/Discard pair. A new slot without this is the way the bug returns.
    for (const slot of ['styles.panelSlot', 'styles.panelButtonRow', 'styles.extrasSlot', 'styles.trailingSlot']) {
      expect(source).toMatch(
        new RegExp(`style=\\{${slot.replace('.', '\\.')}\\}\\s*\\{\\.\\.\\.controlsResponderProps\\}`)
      );
    }
  });

  it('wraps `extras` rather than emitting it bare beside the field', () => {
    // Bare siblings have nothing for the responder to sit on. The wrapper repeats the row's
    // own direction/gap, so it costs no layout.
    expect(source).not.toMatch(/\{inputField\}\s*\{extras\}/);
    expect(source).toMatch(/styles\.extrasSlot[\s\S]{0,200}\{extras\}/);
  });
});

describe('the composers this protects are the ones that open a focus-stealing picker', () => {
  // A map of the surfaces the fix covers, asserted so that a caller moving its picker
  // somewhere else shows up here rather than as another "it froze" report.
  const openers: Array<[string, RegExp]> = [
    // habits — the reported one; mounted by app/habits.tsx and components/HomeHabitsCard.tsx
    ['lib/useHabitRecurrenceDraft.ts', /showAppModal\(/],
    // a task's Repeat, inside PadTypeRow's panel
    ['components/PlanTaskCard.tsx', /function pickRecurring\(\)[\s\S]{0,600}showAppModal\(/],
    // shopping's destination-list picker, inside PadTypeRow's panel
    ['components/HomeShoppingCard.tsx', /function pickAddTarget\(\)[\s\S]{0,600}showAppModal\(/],
    // plans' Whenever repeat, inside AddRow's panel
    ['components/TodoSurface.tsx', /function pickWheneverRecurring\(\)[\s\S]{0,600}showAppModal\(/],
  ];

  it.each(openers)('%s still opens its picker through showAppModal', (file, pattern) => {
    expect(code(file)).toMatch(pattern);
  });
});
