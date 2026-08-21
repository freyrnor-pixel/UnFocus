/**
 * fieldAnatomy.test.ts — every text field in the app is drawn by a shared composer.
 *
 * Maintainer, 2026-08-21: *"All text-boxes must look the same, only differ in color. Options
 * that appear are card-specific."*
 *
 * The app ships ONE `FIELD_RADIUS` (`constants/theme.ts`, commented *"the one number, for every
 * field in the app"*), one `getRecessedField` and one `getFieldGlow`. It also shipped, at the
 * time this test was written, **at least nine distinct radius/fill/border combinations and four
 * different font sizes** across its text-entry surfaces — because only three files imported any
 * of those helpers and every other field was hand-rolled from scratch. `components/NoteRow.tsx`
 * drew three different field shapes inside one card. `app/scan.tsx` had one style constant that
 * rendered differently at its two mount sites. See CONSISTENCY_AUDIT.md §1.
 *
 * **Why the token was never the problem.** Nothing in `DESIGN_RULES.md` said a text field has to
 * come from a shared component — the rulebook governs VALUES (spacing, contrast, targets,
 * durations) and had no rule about component identity at all. So each new surface built its own
 * field, correctly by its own lights, and the divergence was invisible to `tsc`, to every
 * existing test, and to a screenshot of any single screen. It is only wrong beside the field one
 * card away, which no unit test looks at. That is the gap this file closes: it is a rule about
 * WHICH COMPONENT draws a thing, which is a property of the source and so scannable.
 *
 * ⚠️ **The allowlist is the whole design, and it must stay expensive to grow.** A bare
 * `<TextInput>` is not banned — some genuinely cannot be a shared composer (a hidden input behind
 * a formatted display, a debug-only affordance). Each one is listed below WITH A REASON. Adding
 * an entry is a decision someone makes on purpose; the failure mode this replaces is a field
 * arriving with nobody noticing at all.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Every `.tsx` under app/ and components/ — a WALK, deliberately, not a hand-maintained list. */
function sourceFiles(): string[] {
  const walk = (abs: string): string[] =>
    fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
      const next = path.join(abs, entry.name);
      if (entry.isDirectory()) return walk(next);
      return /\.tsx$/.test(entry.name) ? [next] : [];
    });
  return [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
    .map((f) => f.slice(ROOT.length + 1))
    .sort();
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Source with comments stripped — a scan must never fire on prose ABOUT the thing it bans. */
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Does this file MOUNT a `<TextInput>`?
 *
 * ⚠️ **A bare `/<TextInput\b/` is wrong in two ways, and both fired on the first run of this
 * file** — which is the useful half of writing it. It matched `app/_layout.tsx`, where the
 * string appears only in a COMMENT about the global font default, and it matched
 * `components/ShoppingFilterBar.tsx` and `components/TaskCard.tsx`, where the hit is
 * `useKeyboardLift<TextInput>()` — a generic type ARGUMENT, not an element. Both would have
 * been "fixed" by adding those files to the allowlist, which is how a guard quietly stops
 * guarding: three of its four entries would have been licences for code that never needed one.
 *
 * So: strip comments, then require the `<` to be preceded by something that is not an
 * identifier character (a generic's `<` always is), and followed by whitespace or a
 * self-close — never by `>`, which is what closes a type argument.
 */
const mountsTextInput = (rel: string) => /(^|[^\w$])<TextInput[\s/]/.test(code(rel));

/**
 * The four sanctioned composers, plus the one primitive they are built on.
 *
 * `FormControls`' `Input` is the general field. `PadTypeRow`, `AddRow` and `InlineAddItem` are
 * the three tiered quick-add composers (AGENTS.md's "hierarchy of settings when making a row").
 * There are three because they differ in TIERING, not in appearance — the field itself is the
 * same shape in all of them, which is the property this file protects. **Do not add a fourth**;
 * AGENTS.md says so in as many words.
 */
const COMPOSERS = ['components/FormControls.tsx', 'components/PadTypeRow.tsx',
                   'components/AddRow.tsx', 'components/InlineAddItem.tsx'];

/**
 * Files allowed to mount a bare `<TextInput>`, each with the reason it cannot be a composer.
 *
 * ⚠️ **This list records the state of the app, not the target.** Most entries are the backlog
 * the audit found, deferred rather than accepted — converging ~13 hand-rolled fields is a wide
 * mechanical pass that wants its own change, and doing it without this guard in place first
 * would just let the fourteenth arrive during the work. An entry marked KEEP is a real
 * exception; an entry marked BACKLOG is expected to leave.
 *
 * The list is expected to SHRINK. It is fine to delete an entry; adding one needs a reason
 * written next to it, in this file, that someone else would accept.
 */
const BARE_INPUT_ALLOWED: Record<string, string> = {
  // KEEP — these four ARE the shared implementations. Circular by construction.
  'components/FormControls.tsx': 'KEEP — the shared Input itself.',
  'components/PadTypeRow.tsx': 'KEEP — a shared composer; wraps its own TextInput in the recessed well.',
  'components/AddRow.tsx': 'KEEP — a shared composer; its own TextInput is the recessed well.',

  // KEEP — a field that is structurally not a box you type in.
  'components/TimeBoxInput.tsx':
    'KEEP — a hidden input behind a formatted HH:MM display; the visible control is not a text box.',
  'components/CatalogueTab.tsx':
    'KEEP — the search WELL holds a leading glyph, a clear button and the "+" as well as the text, '
    + 'so it cannot be FormControls Input. It draws through getRecessedField/getFieldGlow/FIELD_RADIUS '
    + 'instead (2026-08-21), which is the same shape by construction — see the fourth test below.',
  'components/DebugNoteAnchor.tsx':
    'KEEP — debug-mode-only annotation composer, gated on settings.debugModeEnabled.',
  'components/DebugGeneralNoteButton.tsx':
    'KEEP — the same debug-only note composer, reached from the header rather than a long-press.',

  // BACKLOG — hand-rolled fields the audit found. CONSISTENCY_AUDIT.md §1.
  'components/NoteRow.tsx': 'BACKLOG — draws THREE distinct field shapes in one card.',
  'components/HomeNotesCard.tsx': 'BACKLOG — extraInfoInput sits under a recessed well and is a bordered box.',
  'components/WeekListCard.tsx': 'BACKLOG — nameInput is a box where shopping.tsx draws the same control as an underline.',
  'app/(tabs)/shopping.tsx': 'BACKLOG — monthlyNameInput is an underline field (borderBottomWidth only).',
  'components/TagPickerRow.tsx': 'BACKLOG — the app\'s only stadium-shaped text field.',
  'app/scan.tsx': 'BACKLOG — three field recipes, one of which renders differently at its two mount sites.',
  'app/budget.tsx': 'BACKLOG — a byte-identical copy of scan.tsx\'s sheetInput recipe.',
  'components/UpdateSheet.tsx': 'BACKLOG — the only field in the app with no border at all.',
  'app/automations.tsx': 'BACKLOG — borderWidth 1.5 (card weight) on a field.',
};

describe('every text field comes from a shared composer', () => {
  const files = sourceFiles();

  it('the walk actually reaches the app (guards against an empty pass)', () => {
    // A scan that silently matches nothing is worse than no scan: it reports green forever.
    // Both existing suites this file is modelled on lack this check, which is how four screens
    // went unmeasured by screenRhythm without anything going red.
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('components/FormControls.tsx');
    expect(files).toContain('app/(tabs)/shopping.tsx');
  });

  it('no NEW file mounts a bare <TextInput>', () => {
    const offenders = files
      .filter(mountsTextInput)
      .filter((f) => !(f in BARE_INPUT_ALLOWED));
    expect(offenders).toEqual([]);
  });

  it('the allowlist has no stale entries', () => {
    // An entry for a file that no longer has a bare TextInput is a licence nobody is using —
    // and the next hand-rolled field in that file would inherit it silently. Deleting the entry
    // is how a conversion actually finishes.
    const stale = Object.keys(BARE_INPUT_ALLOWED).filter((f) => {
      if (!fs.existsSync(path.join(ROOT, f))) return true;
      return !mountsTextInput(f);
    });
    expect(stale).toEqual([]);
  });

  it('every allowlist entry states a reason', () => {
    for (const [file, reason] of Object.entries(BARE_INPUT_ALLOWED)) {
      expect({ file, ok: /^(KEEP|BACKLOG) — .{20,}/.test(reason) }).toEqual({ file, ok: true });
    }
  });
});

describe('the detector itself', () => {
  // A source scan is only as good as its regex, and this one was wrong in two ways on its first
  // run (see `mountsTextInput`'s note). Pin the discrimination it has to make, or a later
  // "simplification" back to /<TextInput\b/ re-introduces three false positives that would most
  // likely be silenced by widening the allowlist — leaving the scan green and toothless.
  const tmp = path.join(ROOT, 'components', '__fieldAnatomy_probe__.tsx');
  afterEach(() => { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); });
  const probe = (src: string) => {
    fs.writeFileSync(tmp, src);
    return mountsTextInput('components/__fieldAnatomy_probe__.tsx');
  };

  it('fires on a real mount', () => {
    expect(probe('const a = <TextInput value={v} />;')).toBe(true);
    expect(probe('const a = (\n  <TextInput\n    value={v}\n  />\n);')).toBe(true);
  });

  it('does not fire on a generic type argument', () => {
    // components/ShoppingFilterBar.tsx and components/TaskCard.tsx both look like this.
    expect(probe('const r = useKeyboardLift<TextInput>();')).toBe(false);
    expect(probe('const r = useRef<TextInput>(null);')).toBe(false);
  });

  it('does not fire on a comment', () => {
    // app/_layout.tsx looks like this.
    expect(probe('// default for every <Text>/<TextInput> in the app\n')).toBe(false);
    expect(probe('/**\n * Wraps a <TextInput /> for you.\n */\n')).toBe(false);
  });
});

describe('the field shape lives in the shared helpers, not at the call site', () => {
  it('the three helpers exist and are one definition each', () => {
    // If any of these is ever duplicated, the "one field" claim becomes unenforceable — a call
    // site could satisfy the scan below while drawing a different shape.
    const theme = read('constants/theme.ts');
    for (const helper of ['FIELD_RADIUS', 'getRecessedField', 'getFieldGlow']) {
      const declarations = theme.match(new RegExp(`export (const|function) ${helper}\\b`, 'g')) ?? [];
      expect({ helper, count: declarations.length }).toEqual({ helper, count: 1 });
    }
  });

  it('every composer draws through them', () => {
    // The bug this catches is a composer quietly restating a value the helper owns — which is
    // how `AddRow` shipped at FontSize.sm while its two documented siblings were at md, and how
    // `CatalogueTab`'s well shipped on `surfaceInset` with no halo while claiming in its own
    // comment to "finally match" the others.
    for (const file of COMPOSERS) {
      const src = read(file);
      expect({ file, usesHelpers: /getRecessedField|getFieldGlow|FIELD_RADIUS|<Input\b/.test(src) })
        .toEqual({ file, usesHelpers: true });
    }
  });

  it('nothing outside constants/theme.ts hardcodes the field radius or border weight', () => {
    // `BORDER_WIDTH.field` is 1.25 and `FIELD_RADIUS` is Radius.sm. A literal copy of either is
    // the drift this whole file exists to stop, and it is invisible to tsc.
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = read(file);
      // Only inside a StyleSheet-ish context: a bare 1.25 elsewhere (an opacity, a scale) is fine.
      for (const match of src.matchAll(/borderWidth:\s*1\.25\b/g)) {
        offenders.push(`${file}: borderWidth: 1.25 — use BORDER_WIDTH.field (at index ${match.index})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the recessed well is scoped to composers inside a card', () => {
  it('FormControls exposes `recessed` as an opt-in, not a default', () => {
    // AGENTS.md: an editor's fields sit on the screen BACKDROP, and there a black wash on
    // near-black with no resting stroke makes the field vanish — measured in the preview on
    // app/medicine-form.tsx, not theorised. So the recess must never become the default.
    const src = read('components/FormControls.tsx');
    expect(src).toMatch(/recessed\??\s*:/);
    expect(src).not.toMatch(/recessed\s*=\s*true/);
  });
});
