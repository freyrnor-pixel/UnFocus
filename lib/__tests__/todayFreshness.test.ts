/**
 * todayFreshness.test.ts — a tab screen that derives `today` at render must also subscribe
 * to the minute tick, or its date silently rots.
 *
 * The bug this pins (2026-08-13, app/(tabs)/habits.tsx): the Habits tab computed
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

const TABS_DIR = path.join(__dirname, '..', '..', 'app', '(tabs)');

/**
 * Render scope is identified by INDENTATION — two spaces is a component body, deeper is inside
 * a callback. That matters: app/(tabs)/shopping.tsx declares the same `const today = todayStr()`
 * six spaces in, inside a `useFocusEffect`, where it is re-derived on every focus and so is
 * correct as it stands. A date read at call time is never stale; only one captured across
 * renders is.
 */
const RENDER_SCOPE_TODAY = /^ {2}const today = todayStr\(\);$/m;

const tabScreens = fs
  .readdirSync(TABS_DIR)
  .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
  .map((f) => ({ file: f, source: fs.readFileSync(path.join(TABS_DIR, f), 'utf8') }));

describe('a render-scope `today` is paired with the minute tick', () => {
  it('finds the tab screens at all (guards against a silently empty scan)', () => {
    expect(tabScreens.length).toBeGreaterThanOrEqual(5);
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
   */
  it('covers the four screens that capture one', () => {
    const capturing = tabScreens.filter((s) => RENDER_SCOPE_TODAY.test(s.source)).map((s) => s.file);
    expect(capturing.sort()).toEqual(['habits.tsx', 'health.tsx', 'index.tsx', 'plans.tsx']);
  });
});
