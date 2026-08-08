/**
 * workletSafety.test.ts — nothing that runs on the UI thread may call a JS function directly.
 *
 * `react-native-worklets`' Babel plugin AUTO-WORKLETIZES a fixed set of callbacks: every
 * `Gesture.*` builder method (`onBegin`/`onStart`/`onUpdate`/`onEnd`/`onFinalize`/…), the
 * Reanimated hooks (`useAnimatedStyle`, `useDerivedValue`, `useAnimatedReaction`,
 * `useAnimatedProps`, `useAnimatedScrollHandler`, `useFrameCallback`), the animation
 * COMPLETION callbacks (`withTiming`/`withSpring`/`withDecay`/`withRepeat`) and `runOnUI`.
 * Those bodies run on the UI thread with **no `'worklet'` directive in the source to warn
 * you** — and calling an ordinary JS function from one throws "tried to synchronously call a
 * non-worklet function on the UI thread", which takes the app down.
 *
 * That is what crashed the design lab on 2026-08-08: `PartPalette`'s shelf chip called the
 * haptic and its drag callbacks straight out of `.onStart`/`.onFinalize`. **`onFinalize` fires
 * on a plain TAP** — a pan that never activates still finalizes when the finger lifts — so the
 * crash was on the most ordinary interaction the screen has, not on the long-press drag.
 *
 * **This is a source scan because nothing else in the repo can see it.** On web, worklets run
 * on the JS thread, so `npm run preview` renders the broken screen perfectly and reports zero
 * page and zero console errors; the bug exists only on device, which is also where the drag
 * gesture itself is unreachable by every automated check we have (AGENTS.md). Scanning the
 * source is the only headless guard available — the same reasoning behind the scans in
 * `lib/__tests__/episodes.test.ts` and `lib/__tests__/dayLog.test.ts`.
 *
 * The rule: inside a workletized body, every call must be `runOnJS(...)`, a Reanimated
 * worklet-safe API, a function the file marks `'worklet'`, or a local declared in that body.
 *
 * Edit notes:
 *   - **`WORKLETIZED_ARGS` mirrors the plugin's own table**, argument index and all, and it is
 *     the thing to re-check when Reanimated is upgraded — a hook added there is a context this
 *     scan would otherwise walk straight past. It lives in
 *     `react-native-worklets/plugin`'s `reanimatedFunctionArgsToWorkletize`.
 *   - The coverage assertion is not ceremony: every check here is "we found nothing wrong", so
 *     a parser change that silently matched nothing would pass in perfect silence.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components', 'lib', 'store'];

/** The `Gesture.*` builder methods the plugin workletizes. */
const GESTURE_METHODS = [
  'onBegin', 'onStart', 'onEnd', 'onFinalize', 'onUpdate', 'onChange',
  'onTouchesDown', 'onTouchesMove', 'onTouchesUp', 'onTouchesCancelled',
];

/** Which ARGUMENT of which call is workletized. Mirrors the plugin's own table — see notes. */
const WORKLETIZED_ARGS = new Map<string, number[]>([
  ['useFrameCallback', [0]],
  ['useAnimatedStyle', [0]],
  ['useAnimatedProps', [0]],
  ['createAnimatedPropAdapter', [0]],
  ['useDerivedValue', [0]],
  ['useAnimatedScrollHandler', [0]],
  ['useAnimatedReaction', [0, 1]],
  // Animation completion callbacks — the trailing `(finished) => …`.
  ['withTiming', [2]],
  ['withSpring', [2]],
  ['withDecay', [1]],
  ['withRepeat', [3]],
  ['runOnUI', [0]],
  ['scheduleOnUI', [0]],
]);

/** Callable on the UI thread: the hop itself, plus Reanimated's worklet-safe API. */
const UI_SAFE = new Set([
  'runOnJS', 'runOnUI', 'scheduleOnRN', 'scheduleOnUI',
  'withTiming', 'withSpring', 'withDelay', 'withSequence', 'withRepeat', 'withDecay',
  'cancelAnimation', 'interpolate', 'interpolateColor', 'clamp',
  'Number', 'String', 'Boolean', 'Array', 'Object', 'Set', 'Map', 'isNaN', 'parseInt', 'parseFloat',
]);

type Body = { context: string; line: number; source: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The source between the parens opening at `open`, balanced over nesting. */
function balanced(src: string, open: number): { inner: string; end: number } | null {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { inner: src.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** An argument list split on its TOP-level commas, so a nested call stays one argument. */
function splitArgs(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      current += ch;
      if (ch === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) { out.push(current); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out;
}

const stripped = (src: string) => src
  .replace(/\/\/[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length;

/** Every workletized body in a file. */
function workletBodies(src: string): Body[] {
  const out: Body[] = [];

  const gesture = new RegExp(`\\.(${GESTURE_METHODS.join('|')})\\s*\\(`, 'g');
  let match: RegExpExecArray | null;
  while ((match = gesture.exec(src)) !== null) {
    const found = balanced(src, match.index + match[0].length - 1);
    if (!found) continue;
    out.push({ context: `.${match[1]}()`, line: lineOf(src, match.index), source: found.inner });
    gesture.lastIndex = found.end;
  }

  for (const [fn, indexes] of WORKLETIZED_ARGS) {
    const call = new RegExp(`(^|[^\\w$.])${fn}\\s*\\(`, 'g');
    while ((match = call.exec(src)) !== null) {
      const found = balanced(src, match.index + match[0].length - 1);
      if (!found) continue;
      const args = splitArgs(found.inner);
      for (const index of indexes) {
        if (args[index] === undefined) continue;
        out.push({ context: `${fn}() argument ${index}`, line: lineOf(src, match.index), source: args[index] });
      }
      call.lastIndex = found.end;
    }
  }

  return out;
}

/** Names the file declares as worklets — legitimate to call from the UI thread. */
function workletNames(src: string): Set<string> {
  const names = new Set<string>();
  const pattern = /(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)[^\n]*?(?:=>|\{)\s*\n?\s*['"]worklet['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(src)) !== null) names.add(match[1]);
  return names;
}

/** Names declared INSIDE a body — a helper defined in the worklet runs in it. */
function localNames(body: string): Set<string> {
  const names = new Set<string>();
  const pattern = /(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) names.add(match[1]);
  return names;
}

/** Bare-identifier calls (`foo(`, `foo?.(`) — a member call is left to the allowlist. */
function calledIdentifiers(body: string): string[] {
  const out: string[] = [];
  const pattern = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*(\?\.)?\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stripped(body))) !== null) {
    const name = match[2];
    if (['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'await'].includes(name)) continue;
    out.push(name);
  }
  return out;
}

/** Every direct JS call this file makes from the UI thread. Empty is the passing state. */
export function unsafeCalls(src: string): string[] {
  const worklets = workletNames(src);
  const offenders: string[] = [];
  for (const body of workletBodies(src)) {
    const locals = localNames(body.source);
    for (const name of calledIdentifiers(body.source)) {
      if (UI_SAFE.has(name) || worklets.has(name) || locals.has(name)) continue;
      offenders.push(`${body.context} at line ${body.line} calls ${name}() directly`);
    }
  }
  return offenders;
}

const FILES = DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const SCANNED = FILES
  .map((file) => ({ file, src: fs.readFileSync(file, 'utf8') }))
  .map((entry) => ({ ...entry, bodies: workletBodies(entry.src) }))
  .filter((entry) => entry.bodies.length > 0);

describe('UI-thread code calls nothing that lives on the JS thread', () => {
  // Every assertion below is an absence, so a parser that quietly matched nothing would pass.
  it('scans a real number of worklet bodies across the app', () => {
    const total = SCANNED.reduce((sum, entry) => sum + entry.bodies.length, 0);
    expect(SCANNED.length).toBeGreaterThanOrEqual(15);
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it('covers gesture callbacks and Reanimated hooks alike, not just one of them', () => {
    const contexts = new Set(SCANNED.flatMap((e) => e.bodies.map((b) => b.context.split(' ')[0])));
    expect(contexts).toContain('.onStart()');
    expect(contexts).toContain('.onFinalize()');
    expect(contexts).toContain('useAnimatedStyle()');
    expect(contexts).toContain('withTiming()');
  });

  it.each(SCANNED.map((entry) => [path.relative(ROOT, entry.file), entry.src] as const))(
    '%s hops with runOnJS instead of calling JS directly',
    (_name, src) => {
      expect(unsafeCalls(src)).toEqual([]);
    },
  );
});
