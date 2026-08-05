/**
 * designTokens.test.ts — DESIGN_RULES.md rules 1, 17 and 21, enforced.
 *
 * Two kinds of check:
 *   (a) Token *shape* — the scales are internally consistent, MIN_TAP_TARGET is 44, every
 *       HitSlop token actually lifts the control size it claims to, hitSlopFor() does the
 *       arithmetic right, and essential transitions stay inside the ≤200ms band.
 *   (b) Token *use* — a source scan over components/ and app/ that fails when a bare `44`,
 *       `hitSlop={8}` or `duration: 220` reappears at a call site. This is the half that
 *       actually stops drift; the shape tests alone can't see a component hardcoding 44.
 *
 * The allowlists in (b) are a ratchet, like jest.config.js's coverage thresholds: they may
 * shrink, never grow. Adding an entry means writing down why the literal is not a violation.
 * Precedent for reading source in a test: lib/__tests__/cardLayout.test.ts.
 *
 * NOT asserted here, deliberately: the 4/8/12/16/24/32 spacing set, the 3-type-size and
 * 2-font-weight caps, and the one-accent rule. Those are open conflicts #1/#3/#4/#5 in
 * DESIGN_RULES.md — pinning a disputed number in a test would make the conflict harder to
 * resolve, not easier. See DESIGN_RULES_AUDIT.md.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { Duration } from '@/constants/motion';
import { HitSlop, MIN_TAP_TARGET, Radius, RowTrailing, Spacing, hitSlopFor } from '@/constants/theme';

// constants/motion.ts imports reanimated's `Easing` to build the `Ease` presets, and
// reanimated's native worklets half throws on require in the node env. Only `Duration`
// (plain numbers) is under test here, so a bare Easing stub is enough to let the module
// resolve — same approach as jest.setup.js's AppModal/LAN-transport stubs. babel-jest
// hoists this above the imports above, so the stub is in place before they evaluate.
jest.mock('react-native-reanimated', () => ({
  Easing: { out: () => null, in: () => null, inOut: () => null, cubic: null, bezier: () => null },
}));

// ── (a) Token shape ──────────────────────────────────────────────────────────

describe('DESIGN_RULES.md rule 1 — spacing & radius scales', () => {
  test('every Spacing step is a positive multiple of 4', () => {
    // Compared as a whole map so a failure names the offending step instead of just "4 !== 0".
    const offScale = Object.entries(Spacing).filter(([, v]) => v <= 0 || v % 4 !== 0);
    expect(offScale).toEqual([]);
  });

  test('Spacing steps are strictly ascending in declaration order', () => {
    const values = Object.values(Spacing);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  test('every Radius step is a positive multiple of 4 (full is the pill exception)', () => {
    Object.entries(Radius).forEach(([name, value]) => {
      expect(value).toBeGreaterThan(0);
      if (name !== 'full') expect(value % 4).toBe(0);
    });
  });
});

describe('DESIGN_RULES.md rule 17 — tap targets', () => {
  test('MIN_TAP_TARGET is the WCAG 2.2 minimum of 44', () => {
    expect(MIN_TAP_TARGET).toBe(44);
  });

  test('every HitSlop token is symmetric and positive', () => {
    Object.entries(HitSlop).forEach(([, slop]) => {
      expect(slop.top).toBe(slop.bottom);
      expect(slop.left).toBe(slop.right);
      expect(slop.top).toBe(slop.left);
      expect(slop.top).toBeGreaterThan(0);
    });
  });

  // Each token's doc comment promises a smallest compliant control size. If someone edits a
  // token's px value without editing its label, this is what catches it.
  test.each([
    ['tight', 36, HitSlop.tight],
    ['snug', 32, HitSlop.snug],
    ['base', 28, HitSlop.base],
    ['check', 22, HitSlop.check],
    ['loose', 12, HitSlop.loose],
  ])('HitSlop.%s lifts a %dpx control to at least MIN_TAP_TARGET', (_name, smallestControl, slop) => {
    expect(smallestControl + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  // The trailing cluster is the app's only pair of independent targets sitting side by side,
  // and it is the pair rule 17 names by example ("complete and delete"). Until 2026-08-01 the
  // two carried symmetric HitSlop tokens across a Spacing.sm gap and their touch areas
  // overlapped by 13-15px; RN resolves an overlap to the LAST sibling, so the check swallowed
  // the right edge of the ⋯/×. These pin the arithmetic that fixed it — the failure was
  // invisible in review and silent at runtime, so it needs a test rather than a comment.
  describe('RowTrailing — the ⋯/× and ○ pair', () => {
    test('the two touch areas never overlap, and leave 8px belonging to neither', () => {
      const dead = RowTrailing.gap - RowTrailing.actionSlop.right - RowTrailing.checkSlop.left;
      expect(dead).toBeGreaterThanOrEqual(8);
    });

    test('both controls still reach MIN_TAP_TARGET on the axis a thumb misses on', () => {
      // Vertical: a row in a scrolling list is short and wide, so this is the tight axis.
      // Horizontal deliberately lands at 39-40px — two fully compliant targets 8px apart need
      // 96px of row and a 360px Norwegian shopping row hasn't got it. See RowTrailing's doc.
      const { actionSize, checkSize, actionSlop, checkSlop } = RowTrailing;
      expect(actionSize + actionSlop.top + actionSlop.bottom).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      expect(checkSize + checkSlop.top + checkSlop.bottom).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    });

    test('each control is clipped only on the side it shares with its neighbour', () => {
      // Asymmetry is the whole mechanism. If someone "tidies" these back to a symmetric
      // HitSlop.* token the overlap returns, so assert the shared edges stay the narrow ones.
      expect(RowTrailing.actionSlop.right).toBeLessThan(RowTrailing.actionSlop.left);
      expect(RowTrailing.checkSlop.left).toBeLessThan(RowTrailing.checkSlop.right);
    });

    test('the rows that draw the pair use RowTrailing, not a symmetric HitSlop token', () => {
      const offenders = ['components/PadRow.tsx', 'components/ShoppingRow.tsx'].filter((f) =>
        /hitSlop=\{HitSlop\./.test(readCode(join(ROOT, f))),
      );
      expect(offenders).toEqual([]);
    });
  });

  test('hitSlopFor() always reaches MIN_TAP_TARGET, and never pads an already-big control', () => {
    for (let size = 1; size <= 80; size++) {
      const slop = hitSlopFor(size);
      expect(slop.top).toBe(slop.bottom);
      if (size >= MIN_TAP_TARGET) {
        expect(slop.top).toBe(0);
      } else {
        expect(size + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
        // …without overshooting by more than the rounding of one odd pixel.
        expect(size + slop.top + slop.bottom).toBeLessThanOrEqual(MIN_TAP_TARGET + 1);
      }
    }
  });
});

describe('DESIGN_RULES.md rule 21 — motion', () => {
  // "Keep essential transitions short (≤200ms feel)". The modal/list bands and the
  // deliberately-long `hold`/`celebration` dwells are not essential transitions.
  test.each(['micro', 'control', 'tabSwitch', 'cardOut'] as const)(
    'Duration.%s is within the ≤200ms essential-transition band',
    (key) => {
      expect(Duration[key]).toBeLessThanOrEqual(200);
    },
  );

  test('exits are never slower than their matching entrances (ANIMATION_GUIDELINES §1)', () => {
    expect(Duration.cardOut).toBeLessThanOrEqual(Duration.card);
    expect(Duration.modalOut).toBeLessThanOrEqual(Duration.modalIn);
  });

  test('every Duration is a positive number of milliseconds', () => {
    Object.values(Duration).forEach((ms) => {
      expect(typeof ms).toBe('number');
      expect(ms).toBeGreaterThan(0);
    });
  });
});

// ── (b) Token use — the source scan ──────────────────────────────────────────

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.web\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const SCANNED = [join(ROOT, 'components'), join(ROOT, 'app')].flatMap(sourceFiles);

/** Report as repo-relative paths so a failure message is clickable. */
const rel = (f: string) => f.slice(ROOT.length + 1);

/**
 * A file's source with its leading JSDoc header stripped.
 *
 * Files in this repo document their own constraints, so a header legitimately NAMES the very
 * literals this scan bans — components/TourSpotlight.tsx's header says "bare `44`, `hitSlop: 8`
 * or `duration: 220` are CI failures", and that sentence used to fail the scan. Matching prose
 * has a nasty second-order effect: the cheapest way to get green is to delete the explanation.
 * Same reasoning and the same fix as __tests__/coldStart.test.ts's readCode().
 */
const readCode = (f: string) => {
  const src = readFileSync(f, 'utf8');
  return src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
};

describe('DESIGN_RULES.md — no bare design literals at call sites', () => {
  test('scan actually found the source tree', () => {
    expect(SCANNED.length).toBeGreaterThan(50);
  });

  test('no hardcoded 44 tap target — use MIN_TAP_TARGET', () => {
    // Coincidental 44s that are NOT tap targets: display boxes and text columns whose width
    // just happens to be 44. Shrinking this list means proving the 44 is a real target.
    const ALLOW = new Set([
      'components/PlanTaskCard.tsx', // timeBox minWidth + hNowMarker width — display boxes
      'app/scan.tsx', // itemPrice minWidth — a right-aligned text column
      'components/FoodTab.tsx', // amountInput width — a numeric field's layout width
      // app/onboarding/guided.tsx (optionBadge) was here until 2026-08-03 — the screen was
      // deleted in the two-screen onboarding cut, so the exemption went with it.
    ]);
    const offenders = SCANNED.filter(
      (f) => !ALLOW.has(rel(f)) && /\b(minHeight|minWidth|height|width): 44\b/.test(readCode(f)),
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  test('no bare numeric hitSlop — use HitSlop.* or hitSlopFor(size)', () => {
    // 10 and 12 survive because rounding them to a token would change the touch area, and
    // whether that is a fix or a regression needs each call site's visual size measured.
    const ALLOW_VALUES = new Set(['10', '12']);
    const offenders: string[] = [];
    for (const f of SCANNED) {
      for (const m of readCode(f).matchAll(/hitSlop=\{(\d+)\}/g)) {
        if (!ALLOW_VALUES.has(m[1])) offenders.push(`${rel(f)}: hitSlop={${m[1]}}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('Button sizes with minHeight, never a fixed height', () => {
    // 2026-08-05: every `size="sm"` button shipped with its label's descenders sliced off.
    // `height: SIZE_HEIGHT[size]` plus the glass path's overflow mask left a 14px Nunito label
    // 15px of content box, and the OS text scale (up to MAX_FONT_SCALE) grows the label without
    // growing the box.
    //
    // This is a source scan and not a measurement because **the web preview cannot see this
    // bug** — verified by putting the fixed height back and re-running `npm run wraps`, which
    // reported 0 either way. CSS flexbox lets the label overflow the mask's padding box without
    // crossing its border box, so nothing measures as clipped; Yoga squeezes it instead. Same
    // family as `adjustsFontSizeToFit` and Android's SP lineHeight conversion — real on device,
    // invisible on react-native-web. A scan is the only guard that actually holds here.
    const src = readCode(join(ROOT, 'components/Button.tsx'));
    expect(src).toMatch(/minHeight:\s*SIZE_HEIGHT\[size\]/);
    expect(src).not.toMatch(/[^n]height:\s*SIZE_HEIGHT\[size\]/);
  });

  test('no raw millisecond literals in animated code — use Duration.*', () => {
    const ALLOW = new Set([
      // Per-particle drift times for ambient background scenery — data describing a scene,
      // not the timing of any interaction. Already gated on reducedMotion + a user setting.
      'components/ParticleBackground.tsx',
    ]);
    const offenders: string[] = [];
    for (const f of SCANNED) {
      if (ALLOW.has(rel(f))) continue;
      const src = readCode(f);
      for (const m of src.matchAll(/\bduration:\s*(\d+)/g)) offenders.push(`${rel(f)}: duration: ${m[1]}`);
      for (const m of src.matchAll(/\.duration\((\d+)\)/g)) offenders.push(`${rel(f)}: .duration(${m[1]})`);
    }
    expect(offenders).toEqual([]);
  });
});
