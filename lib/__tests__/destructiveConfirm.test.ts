/**
 * destructiveConfirm.test.ts — one "are you sure?", one pair of haptics (2026-08-12).
 *
 * Sixteen screens built the same two-button confirm by hand: Cancel, plus a red button, over
 * `showAppModal`. The buttons were fine everywhere. The HAPTICS were not, and could not be
 * seen: ANIMATION_GUIDELINES.md §5 says `warning()` before a destructive dialog and `heavy()`
 * the moment it is confirmed — and marks the pattern "✅ implemented" — but in practice five
 * sites opened with `tap()` or with nothing at all, and eight never fired `heavy()`. Nothing
 * catches that. It isn't a type error, it doesn't render differently, no screenshot shows it,
 * the web preview has no haptics at all, and it is not the sort of thing a user reports; it
 * just quietly means a delete feels like a tap on some screens and like a delete on others.
 *
 * `confirmDestructive` (components/AppModal.tsx) makes the contract true by construction. This
 * file keeps it that way, by asserting the shape rather than the feel:
 *
 *   1. No file hand-rolls a confirm dialog — a `showAppModal` call carrying BOTH a `cancel`
 *      button and a `destructive` one — outside the helper itself.
 *   2. The three call sites that legitimately still name `style: 'destructive'` are named
 *      here, with what makes each one not a confirm dialog. Without this half the rule above
 *      would read as "no destructive buttons outside AppModal", which is false, and the next
 *      session would either convert them wrongly or delete the test.
 *   3. No caller fires the haptics itself any more — a `warning()` immediately before a
 *      `confirmDestructive` call is a double beat, and the reflex of anyone converting the
 *      seventeenth site.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Every .tsx under app/ and components/ — the surfaces that can open a modal. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'components'));
  return out;
}

/**
 * The argument text of every `showAppModal(...)` call in `source`, paren-balanced.
 *
 * A regex can't do this: the button arrays contain arrow functions, nested `showAppModal`
 * calls (the backup flow opens a second dialog from the first one's onPress) and string
 * literals with parentheses in them.
 */
function showAppModalCalls(source: string): string[] {
  const calls: string[] = [];
  const needle = 'showAppModal(';
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) break;
    let depth = 0;
    let i = start + needle.length - 1;
    for (; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    calls.push(source.slice(start, i + 1));
    from = i + 1;
  }
  return calls;
}

const buttonCount = (call: string) => (call.match(/\btext:/g) ?? []).length;

/**
 * A confirm dialog is TWO buttons: back out, or do the destructive thing.
 *
 * The button styles alone don't identify one — the app's ⋯ menus carry a destructive row AND a
 * cancel row, and are not questions. The count is what separates "are you sure?" from "which
 * of these five things did you want?".
 */
const isConfirmDialog = (call: string) =>
  buttonCount(call) === 2 &&
  call.includes("style: 'cancel'") &&
  call.includes("style: 'destructive'");

describe('every destructive confirm goes through confirmDestructive', () => {
  it('finds no hand-rolled Cancel + red-button dialog anywhere', () => {
    const offenders = sourceFiles()
      .filter((file) => file !== 'components/AppModal.tsx')
      .filter((file) => showAppModalCalls(read(file)).some(isConfirmDialog));
    expect(offenders).toEqual([]);
  });

  it('parses the helper itself as the one confirm dialog in the app', () => {
    // Guards the detector, not the app: a `showAppModalCalls` that silently matched nothing —
    // or an `isConfirmDialog` that matched nothing — would make the assertion above pass
    // forever, including on the day someone hand-rolls the seventeenth dialog.
    const calls = showAppModalCalls(read('components/AppModal.tsx'));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter(isConfirmDialog)).toHaveLength(1);
  });

  it('fires both documented beats, in the helper and nowhere near a caller', () => {
    const appModal = read('components/AppModal.tsx');
    expect(appModal).toMatch(/warning\(\);\s*\n\s*showAppModal\(/); // before the dialog
    expect(appModal).toMatch(/heavy\(\);/); // on confirm

    for (const file of sourceFiles()) {
      // The reflex when converting a site is to leave the warning() above the call.
      expect(read(file)).not.toMatch(/(warning|tap)\(\);\s*\n\s*confirmDestructive\(/);
    }
  });
});

describe('the destructive rows that are NOT confirm dialogs', () => {
  const destructiveCalls = (file: string) =>
    showAppModalCalls(read(file)).filter((c) => c.includes("style: 'destructive'"));

  it('a ⋯ menu keeps its Delete row — it is a list of actions, not a question', () => {
    // WeekListCard: Saved lists / Save as template / Sync / Settings / Delete / Cancel. It has
    // a cancel row AND a destructive row, which is exactly why the rule above counts buttons.
    const calls = destructiveCalls('components/WeekListCard.tsx');
    expect(calls).toHaveLength(1);
    expect(buttonCount(calls[0])).toBeGreaterThan(2);
  });

  it("Shopping keeps a menu and a three-way choice, and neither is an 'are you sure?'", () => {
    // The monthly-list ⋮ menu (Reset / Delete / Cancel), and the unsaved-changes question —
    // Save and lock / Discard and lock / Cancel. The second one is the interesting case: it is
    // a confirm-shaped dialog whose red button is one of two ways FORWARD, not the only one.
    // Routing it through the helper would drop the Save branch, i.e. the point of asking.
    const calls = destructiveCalls('app/(tabs)/shopping.tsx');
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => buttonCount(c) > 2)).toBe(true);
  });
});
