/**
 * todayFreshness.test.ts — a screen that derives `today` at render must also subscribe
 * to the minute tick, or its date silently rots.
 *
 * The bug this pins (2026-08-13, app/habits.tsx): the Habits tab computed
 * `const today = todayStr()` in its render body and threaded it into HabitCard, which is what
 * `increment`/`decrement`/`markRestDay` WRITE. Nothing re-derived it — the tab pager keeps all
 * five screens mounted (`lazy: false`), that screen subscribes to `habits` but not to `logs`
 * (so logging re-rendered only the row), and the root foreground handler reloads only the
 * task/shopping/notes stores. Measured on the web preview with a faked clock: mounted at 23:58,
 * clock moved to 00:03, every tap wrote to the PREVIOUS day and never self-corrected, while
 * Home's habits card wrote the correct day in the same second — because Home re-renders on
 * `useNowMinutes`.
 *
 * Why a source scan rather than a real test: this is component render-scope behaviour, and the
 * repo has no React renderer in Jest. It is also invisible to `npx tsc --noEmit` (both versions
 * typecheck identically), to a screenshot, and to `npm run preview` unless the clock happens to
 * cross midnight mid-run. Same mechanism as the source scans in dayLog.test.ts, episodes.test.ts
 * and workletSafety.test.ts: assert the property in the text, since nothing else can see it.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const TABS_DIR = path.join(ROOT, 'app', '(tabs)');

/**
 * Pushed screens that are scanned alongside the tabs. app/habits.tsx left the pager on
 * 2026-08-20 (5 tabs → 3) — and the rule binds it MORE, not less: it is still long-lived (a
 * pushed screen stays mounted while you work in it), it still captures a render-scope `today`,
 * and it is the screen the original bug was measured on. A scan keyed on the tabs directory
 * alone would have stopped covering it the moment it moved, reporting green over exactly the
 * file it was written for. app/health.tsx crossed the SAME way hours later (the "full-screen
 * card expansion" pass) and joined it.
 */
const PUSHED_SCREENS = ['app/habits.tsx', 'app/health.tsx'] as const;
// ⚠️ Both entries above are thin route wrappers as of 2026-08-20 and capture nothing
// themselves — app/habits.tsx joined app/health.tsx there when components/HabitsSurface.tsx was
// extracted. They stay in the scan deliberately: the day one of them grows a `today` of its own
// again, the rule should bind it without anyone remembering to re-add it here.

/**
 * Extracted surface components (same pass) that carry the REAL `today` capture now — their
 * thin route wrappers (app/(tabs)/plans.tsx, app/health.tsx) mount them but derive nothing
 * themselves. Scanning only the wrapper would trivially pass ("nothing captured — fine") over
 * exactly the file that actually needs the pairing.
 */
const EXTRACTED_SURFACES = [
  'components/TodoSurface.tsx',
  'components/HealthSurface.tsx',
  // components/HabitsSurface.tsx joined them on 2026-08-20, extracted so the Me tab's Habits
  // card could have a real full-screen body. It carries the capture the original bug was
  // measured on, so this is the entry that keeps that coverage rather than losing it to the
  // move — exactly the failure mode the PUSHED_SCREENS note above describes.
  'components/HabitsSurface.tsx',
] as const;

/**
 * Render scope is identified by INDENTATION — two spaces is a component body, deeper is inside
 * a callback. That matters: app/(tabs)/shopping.tsx declares the same `const today = todayStr()`
 * six spaces in, inside a `useFocusEffect`, where it is re-derived on every focus and so is
 * correct as it stands. A date read at call time is never stale; only one captured across
 * renders is.
 */
const RENDER_SCOPE_TODAY = /^ {2}const today = todayStr\(\);$/m;

const tabScreens = [
  ...fs
    .readdirSync(TABS_DIR)
    .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
    .map((f) => ({ file: f, source: fs.readFileSync(path.join(TABS_DIR, f), 'utf8') })),
  ...PUSHED_SCREENS.map((rel) => ({
    file: path.basename(rel),
    source: fs.readFileSync(path.join(ROOT, rel), 'utf8'),
  })),
  ...EXTRACTED_SURFACES.map((rel) => ({
    file: path.basename(rel),
    source: fs.readFileSync(path.join(ROOT, rel), 'utf8'),
  })),
];

describe('a render-scope `today` is paired with the minute tick', () => {
  it('finds the screens at all (guards against a silently empty scan)', () => {
    // 3 tabs + the 2 pushed list screens + the 3 extracted surfaces.
    expect(tabScreens.length).toBeGreaterThanOrEqual(8);
  });

  it.each(tabScreens.map((s) => s.file))('%s', (file) => {
    const { source } = tabScreens.find((s) => s.file === file)!;
    if (!RENDER_SCOPE_TODAY.test(source)) return; // nothing captured across renders — fine
    expect(source).toMatch(/useNowMinutes\(\)/);
    expect(source).toMatch(/from '@\/lib\/useNowMinutes'/);
  });

  /**
   * The rule is worth nothing if every screen happens to opt out. Assert the four that
   * genuinely do capture a render-scope date are still covered, so a future edit that drops
   * the capture (fine) is told apart from one that drops the tick (not fine).
   *
   * The membership changed with the 2026-08-20 extraction: app/(tabs)/plans.tsx and
   * app/health.tsx are thin route wrappers now and capture nothing themselves —
   * components/TodoSurface.tsx and components/HealthSurface.tsx are where the real capture
   * (and its useNowMinutes pairing) live. It changed again on 2026-08-19: app/(tabs)/index.tsx
   * dropped out when Home became "Me" and stopped drawing the day's tasks — with the To-do
   * preview card gone, nothing on that screen reads a date at all. Three is now the floor; if
   * this list ever empties, the rule above has quietly stopped testing anything.
   */
  it('covers the screens/surfaces that capture one', () => {
    const capturing = tabScreens.filter((s) => RENDER_SCOPE_TODAY.test(s.source)).map((s) => s.file);
    // `habits.tsx` was here until 2026-08-20; the capture moved into HabitsSurface.tsx with the
    // rest of that screen's content. Still three, and still the same three surfaces.
    expect(capturing.sort()).toEqual(['HabitsSurface.tsx', 'HealthSurface.tsx', 'TodoSurface.tsx']);
  });
});
