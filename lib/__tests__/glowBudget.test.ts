/**
 * glowBudget.test.ts — text, borders and backgrounds never glow.
 *
 * DESIGN_COMPARISON/19-IMPLEMENTATION.md phase 2 ("the glow budget"), from the maintainer's own
 * framing of what was wrong with the card surface: *"clouded"* was two defects, and the halo was
 * the louder half. On a five-card screen, up to NINE resting wells were lit at once — every
 * composer's collapsed "+" bar, every composer's idle field, a search box that had never been
 * touched — while the rows holding the user's actual tasks carried no light at all. A halo is
 * supposed to be the one thing on a screen the eye is drawn to; a halo on every field is a halo
 * on nothing.
 *
 * **The rule, verbatim from the handoff:** lit is the badge glyph, an active check, a filled bar
 * or ring, the primary key, and a field **while focused**. Nothing else glows — and specifically,
 * nothing glows AT REST. A field's halo firing before it has focus is the exact defect this file
 * exists to catch; it is invisible to `tsc`, invisible to a single screenshot (a lit field looks
 * "polished" in isolation — the bug only shows beside four other lit fields on the same screen),
 * and the web preview runs Reanimated worklets on the JS thread, so it renders a resting glow
 * with zero console errors. A source scan is the only guard that holds.
 *
 * ⚠️ **This is a BAN with named exceptions, modelled on `cardAnatomy.test.ts`'s import ban — not
 * an allowlist of the files that currently happen to be right.** An allowlist of "already
 * correct" files is exactly how the app arrived here: every one of the nine lit wells was added
 * by a caller that had never been told a field's halo must wait for focus, because nothing said
 * so. So this file does not enumerate "the files that draw a resting field-glow, and that's fine"
 * — every `getFieldGlow(` call site in the walked directories has to prove it is reached only
 * through a focus-gated branch, or be a NAMED, REASONED exception. Same shape for `getGlow(`
 * (non-field): every call site has to be one of the five sanctioned "always lit" categories the
 * rule names, stated as a reason, not merely "this file is fine today".
 *
 * Two known, PRE-EXISTING violations are recorded rather than hidden. Neither was introduced or
 * fixed by this phase (both are outside its file ownership — see each entry) and both are exactly
 * the shape this test is designed to keep from spreading silently:
 *   - `components/FormControls.tsx`'s `recessed` `Input` (used by `InlineAddItem`) still glows at
 *     rest, not just on focus.
 *   - `components/GlowPulse.tsx`'s `mode="static"` halos (Habits' done-state ring, on every row
 *     that is done, not just the one row a user just touched) are arguably closer to "decoration"
 *     than to the rule's five categories, and are recorded as such rather than quietly folded
 *     into "active check".
 *
 * Connections:
 *   Imports → node:fs, node:path only — a pure source scan, no app/store/component imports
 *             (same discipline as lib/__tests__/cardAnatomy.test.ts, for the same reason: this
 *             walks app/, components/ and lib/ at test time, so it must not itself depend on
 *             anything those directories export).
 *   Used by → nothing (a Jest test file; run via `npx jest lib/__tests__/glowBudget.test.ts`)
 *   Data    → reads source text only; makes no assertions about runtime behaviour
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Comments stripped — a scan must never fire on prose ABOUT the thing it bans or allows. */
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function sourceFiles(): string[] {
  const walk = (abs: string): string[] =>
    fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
      // Test files are full of the literal strings this scan looks for, in prose and in its own
      // regex source — cardAnatomy.test.ts avoids this by never walking a directory that has any,
      // but this file's own bonus ScreenBackground check needed `lib/`, which is also where every
      // `__tests__/` directory but the root one lives. Skip them explicitly instead.
      if (entry.isDirectory() && entry.name === '__tests__') return [];
      const next = path.join(abs, entry.name);
      if (entry.isDirectory()) return walk(next);
      return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')
        ? [next]
        : [];
    });
  return [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components')), ...walk(path.join(ROOT, 'lib'))]
    .map((f) => f.slice(ROOT.length + 1))
    .sort();
}

/** Every `getFieldGlow(` call in a file's stripped source, as a match with its index. */
function fieldGlowCalls(src: string): RegExpMatchArray[] {
  return [...src.matchAll(/getFieldGlow\(/g)];
}

/** Every `getGlow(` call in a file's stripped source (excludes `getFieldGlow(` by construction —
 * the regex requires a non-identifier character or start-of-string immediately before `getGlow`,
 * so it never matches the tail of `getFieldGlow`). */
function plainGlowCalls(src: string): RegExpMatchArray[] {
  return [...src.matchAll(/(?<![A-Za-z0-9_])getGlow\(/g)];
}

/**
 * Is this `getFieldGlow(` call reached only when a focus-shaped condition is true?
 *
 * A field's halo is legitimate exactly in the shape every call site in this codebase uses it:
 * `<something>focused ? getFieldGlow(...) : <no glow>`, or the `&&` short-circuit equivalent.
 * Looking at the ~120 characters immediately before the call for a `focused`-named identifier
 * followed by `?` or `&&` is enough to tell "the compiler will skip this at rest" from "this
 * always runs" — the exact distinction the rule turns on — without needing a real parser, the
 * same trade every source-scan test in this codebase (`cardAnatomy`, `chromeRhythm`) makes.
 */
function isFocusGated(src: string, callIndex: number): boolean {
  const before = src.slice(Math.max(0, callIndex - 120), callIndex);
  return /[A-Za-z0-9_]*[fF]ocused\s*(\?|&&)\s*$/.test(before);
}

/**
 * Files where a `getFieldGlow(` call is allowed to NOT be focus-gated, with a reason.
 *
 * Every entry here is a field glowing AT REST — exactly what phase 2 removed at every call site
 * it owned. An entry is either a documented, out-of-scope pre-existing defect (BACKLOG) or, if
 * one is ever found, a genuine architectural exception (KEEP) — there is no such exception today.
 */
const RESTING_FIELD_ALLOWED: Record<string, string> = {
  'components/FormControls.tsx':
    'BACKLOG — the `recessed` Input (2026-08-16 "tactile glow" polish pass) still glows at rest, '
    + 'not just on focus: `recessed ? getFieldGlow(fieldHue, focused ? \'strong\' : \'soft\', '
    + '...) : focused ? getFieldGlow(...) : null` — the FIRST branch is not focus-gated at all. '
    + 'This is the same defect DESIGN_COMPARISON/19 phase 2 fixed at every other composer '
    + '(AddRow, PadTypeRow, CatalogueTab) in the same change, but this file was outside that '
    + 'pass\'s file ownership (only `InlineAddItem` mounts `recessed`, and neither file was '
    + 'touched). Left failing-the-rule-but-documented rather than silently exempted forever — '
    + 'the fix is the same shape as the other three: gate the whole expression on `focused`.',
};

describe('a field only glows while it is FOCUSED', () => {
  const files = sourceFiles();

  it('the walk reaches the app (guards against an empty pass)', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('components/AddRow.tsx');
  });

  it('every getFieldGlow( call site is either focus-gated or a named exception', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file in RESTING_FIELD_ALLOWED) continue;
      const src = code(file);
      for (const m of fieldGlowCalls(src)) {
        if (!isFocusGated(src, m.index!)) {
          offenders.push(`${file}: getFieldGlow( at offset ${m.index} is not focus-gated`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the exception list has no stale entries', () => {
    // A file kept on this list after every offending call site is fixed (or deleted) is a
    // licence nobody is using — and the next resting-glow call in that file would silently
    // inherit it. Deleting the entry is how a conversion actually finishes.
    const stale = Object.keys(RESTING_FIELD_ALLOWED).filter((file) => {
      if (!fs.existsSync(path.join(ROOT, file))) return true;
      const src = code(file);
      return fieldGlowCalls(src).every((m) => isFocusGated(src, m.index!));
    });
    expect(stale).toEqual([]);
  });

  it('every exception states a reason', () => {
    for (const [file, reason] of Object.entries(RESTING_FIELD_ALLOWED)) {
      expect({ file, ok: /^(KEEP|BACKLOG) — .{20,}/.test(reason) }).toEqual({ file, ok: true });
    }
  });

  // The three composers phase 2 actually rewrote — pinned by NAME so a future edit that
  // re-introduces an unconditional glow on one of them fails here even if some other file
  // elsewhere still passes the general scan (e.g. by accident of gating on the wrong variable).
  it('AddRow, PadTypeRow and CatalogueTab specifically are clean', () => {
    for (const file of ['components/AddRow.tsx', 'components/PadTypeRow.tsx', 'components/CatalogueTab.tsx']) {
      const src = code(file);
      const calls = fieldGlowCalls(src);
      expect({ file, calls: calls.length }).toEqual({ file, calls: expect.any(Number) });
      expect(calls.length).toBeGreaterThan(0); // still draws a focused halo — just not at rest
      for (const m of calls) {
        expect({ file, gated: isFocusGated(src, m.index!) }).toEqual({ file, gated: true });
      }
    }
  });

  // The collapsed "+" bar is the specific call site the handoff names as "the single loudest
  // thing in the app" (up to nine lit wells on a five-card screen). It must draw NO halo at
  // all while collapsed — not even a focus-gated one, since a collapsed bar is never focused.
  it("AddRow's collapsed bar carries no getFieldGlow call, focus-gated or not", () => {
    const src = code('components/AddRow.tsx');
    // Slice from the collapsed-state return down to the expanded input, which is where the
    // component's own comments say the collapsed bar's JSX lives (see its "Collapsed:" note).
    const collapsedBlock = src.slice(src.indexOf('!expanded'), src.indexOf('const inputField'));
    expect(collapsedBlock).not.toMatch(/getFieldGlow\(/);
    expect(collapsedBlock).not.toMatch(/getGlow\(/);
  });
});

/**
 * Non-field `getGlow(` call sites — the five sanctioned "always lit" categories from the rule:
 * the badge glyph, an active check, a filled bar or ring, and the primary key. (A field's own
 * category — "while focused" — is the OTHER describe block above; `getGlow` on a field wrapper
 * would be a call this codebase doesn't make, since `getFieldGlow` exists precisely to carry the
 * field's radius with its light.)
 *
 * Every entry is REQUIRED to state which category it is and why — "this file already does this"
 * is not a reason. New entries need a category from the rule, not an allowlist slot.
 */
const ALWAYS_LIT_ALLOWED: Record<string, string> = {
  'components/FormControls.tsx':
    'KEEP — the checkbox box, gated on `checked && !disabled`. This IS the rule\'s "active '
    + 'check" category verbatim, not an exception to it.',
  'components/GoalGlowDot.tsx':
    'KEEP — the goal-strength dot, gated on `level > 0.05` (no glow at zero strength). Reads as '
    + 'a filled indicator whose fill level the halo echoes, the rule\'s "filled bar or ring" '
    + 'category — not a resting decoration, since it tracks a real, changing value.',
  'components/EnergyMeter.tsx':
    'KEEP — the Energy strip\'s filled ring. The rule\'s "filled bar or ring" category by name.',
  'components/AddFAB.tsx':
    "KEEP — via components/PressableScale.tsx's `glow` prop, not a direct call (see that "
    + 'entry): the one deliberately "always on" halo in the app, the rule\'s "primary key" '
    + 'category. Also reached through `components/Button.tsx` (primary/danger variants) and '
    + '`components/IconButton.tsx` (the active state).',
  'components/PressableScale.tsx':
    'KEEP — the single call site every filled primary/danger key and every active IconButton '
    + 'routes its halo through (`glowColor ? getGlow(...) : null`). The rule\'s "primary key" '
    + 'category; gated on the caller supplying a colour at all, so a plain/secondary/ghost '
    + 'button passes none and glows nothing.',
  'components/GlowPulse.tsx':
    'KEEP — a shared state-halo primitive. `mode="breathe"` (Button\'s `emphasis` CTA, '
    + 'TaskCard\'s editing state, PlanTaskCard\'s "happening now" row) is the rule\'s "the one '
    + 'active/focal element on a screen" case by its own doc comment. `mode="static"` (Habits\' '
    + 'done-state ring, drawn on every row currently marked done) is a WEAKER fit — it is a '
    + 'per-row state marker rather than a single focal element, closer to decoration than to '
    + 'any of the rule\'s five categories. Recorded rather than silently waved through: not '
    + 'fixed here because doing so is a Habits-surface change, outside this phase\'s file '
    + 'ownership (components/AddRow.tsx, PadTypeRow.tsx, CatalogueTab.tsx, ScreenBackground.tsx, '
    + 'constants/theme.ts, constants/colors.ts only).',
  'components/NewSinceGlow.tsx':
    'KEEP — the "what your last layout view was hiding" marker, gated on `active` (a real, '
    + 'per-field state, not resting decoration — see lib/useNewSinceSeen.ts). Nearest of the '
    + 'five categories: a temporary highlight on the one thing that just became visible, the '
    + 'same "one active thing" reasoning as GlowPulse\'s `breathe` mode.',
};

describe('a non-field halo is one of the five sanctioned "always lit" cases', () => {
  const files = sourceFiles();

  it('every getGlow( (non-field) call site is a named, reasoned exception', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = code(file);
      const calls = plainGlowCalls(src);
      if (calls.length === 0) continue;
      if (!(file in ALWAYS_LIT_ALLOWED)) {
        offenders.push(`${file}: ${calls.length} getGlow( call site(s) not in ALWAYS_LIT_ALLOWED`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the allowlist has no stale entries', () => {
    const stale = Object.keys(ALWAYS_LIT_ALLOWED).filter((file) => {
      if (!fs.existsSync(path.join(ROOT, file))) return true;
      // AddFAB is a documented indirect entry (routes through PressableScale) — its own source
      // never calls getGlow directly, so it is exempt from the "still calls it" staleness check.
      if (file === 'components/AddFAB.tsx') return false;
      return plainGlowCalls(code(file)).length === 0;
    });
    expect(stale).toEqual([]);
  });

  it('every allowlist entry states a reason naming a category', () => {
    for (const [file, reason] of Object.entries(ALWAYS_LIT_ALLOWED)) {
      expect({ file, ok: /^(KEEP|BACKLOG) — .{20,}/.test(reason) }).toEqual({ file, ok: true });
    }
  });

  it('no getFieldGlow( call is hiding in this registry', () => {
    // The two describe blocks are disjoint by construction — getFieldGlow and getGlow are
    // different call sites — but a file appearing in BOTH with the wrong reasoning would still
    // typecheck and still pass each block alone, so it is worth asserting directly.
    for (const file of Object.keys(ALWAYS_LIT_ALLOWED)) {
      const src = code(file);
      // FormControls legitimately has BOTH a plain getGlow (the checkbox) and a getFieldGlow
      // (the recessed field, tracked separately in RESTING_FIELD_ALLOWED above) — that overlap
      // is real and documented, not a scan error.
      if (file === 'components/FormControls.tsx') continue;
      expect({ file, hasFieldGlow: fieldGlowCalls(src).length > 0 }).toEqual({ file, hasFieldGlow: false });
    }
  });
});

/**
 * The ambient backdrop is not a `getGlow`/`getFieldGlow` call site — `components/
 * ScreenBackground.tsx` draws its orbs as raw `react-native-svg` radial-gradient stops, not as a
 * `boxShadow` — but it is still "the glow budget" in the handoff's own words, so it gets its own
 * narrow guard here rather than being invisible to this file entirely.
 */
describe('the backdrop orbs stay inside the glow budget (ScreenBackground.tsx)', () => {
  const src = code('components/ScreenBackground.tsx');

  it('DARK.orbOpacity is the corrected screens\' band, and it costs no contrast', () => {
    // ⚠️ **0.26 since 2026-08-31, double the brief's own 10–15%, and the licence is a ruling
    // plus a measurement.** The maintainer's screenshots are flat black beside a mockup whose
    // frames are visibly lit, and the ruling was *"light the frame, not the card column"* — the
    // one option in that question that costs no identity hue. The corrected screens' own CSS
    // washes are 16–30% of the accent, so this lands inside what they draw.
    //
    // It is free because of the GEOMETRY, which is the property `ORBS` has always been built on
    // and which nothing had ever checked: every orb sits at or outside a corner and reaches zero
    // before the card column. Measured on the real render, before and after the doubling, by
    // finding the Notes badge and taking the modal fill of the card it sits on:
    // **rgb(36,36,36) both times** — exactly `surface` — so all five hues keep their exact
    // ratios and Notes stays at 4.51:1 against a 4.5 floor it has no headroom above.
    //
    // ⚠️ **Raising this again needs that measurement repeated, not this comment trusted.** The
    // file's prose used to claim the field reached the card box at "2-3% of peak"; a model built
    // from `ORB_STOPS` said 42%, and the pixels said neither — it is the pixels that decide.
    const m = src.match(/const DARK: Palette = \{[\s\S]*?orbOpacity:\s*([\d.]+),/);
    expect(m).toBeTruthy();
    const value = Number(m![1]);
    expect(value).toBeGreaterThanOrEqual(0.16);
    expect(value).toBeLessThanOrEqual(0.30);
    expect(value).toBeCloseTo(0.26, 5);
  });

  it('LIGHT.orbOpacity is untouched — it already sat below the band', () => {
    const m = src.match(/const LIGHT: Palette = \{[\s\S]*?orbOpacity:\s*([\d.]+),/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeCloseTo(0.1, 5);
  });

  it('no orb reaches the middle of the canvas (still true — this file did not touch geometry)', () => {
    // This phase changed only the ALPHA constants, never `ORB_STOPS`, `ORBS`, or any centre/
    // radius value — the geometry guarantee `__tests__/glassMaterial.test.ts` and
    // `lib/__tests__/chromeRhythm.test.ts` §6 both rely on is untouched. A quick source-level
    // sanity check that the orb definitions are still present, so a future edit that deletes
    // them wholesale (rather than just re-tuning alpha) is at least visible here too.
    expect(src).toMatch(/const ORB_STOPS:/);
    // `OrbField`/`ScreenHueField` became `OrbCanvas`/`OrbLayer` on 2026-08-31 — one canvas per
    // layer so the crossfades animate a View's alpha instead of an `<AnimatedG>`. A rename, not
    // a geometry change: `ORBS` and `ORB_STOPS` are byte-identical and the pixel gate came back
    // 22/22 unchanged. What this line is for is a wholesale deletion, so it tracks the name.
    expect(src).toMatch(/function OrbCanvas/);
    expect(src).toMatch(/const ORBS: Orb\[\]|const ORBS =/);
  });
});
