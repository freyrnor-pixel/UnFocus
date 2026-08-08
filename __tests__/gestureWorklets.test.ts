/**
 * gestureWorklets.test.ts — a gesture callback may not call a JS function directly.
 *
 * `react-native-worklets`' Babel plugin AUTO-WORKLETIZES the callbacks passed to a
 * `Gesture.*` builder (`onBegin`/`onStart`/`onUpdate`/`onEnd`/`onFinalize`/…), so those bodies
 * run on the UI thread. Calling an ordinary JS function from one throws
 * "tried to synchronously call a non-worklet function on the UI thread" and takes the app
 * down — which is exactly what a tap on the design lab's part shelf did (2026-08-08):
 * `.onFinalize` fires when a pan that never activated ends, i.e. on every plain tap, so the
 * crash was on the most ordinary interaction the screen has.
 *
 * **This is a source scan because nothing else in the repo can see it.** On web, worklets run
 * on the JS thread, so `npm run preview` renders the broken screen perfectly and reports zero
 * console errors — the bug only exists on device, which is also where the drag gesture itself
 * is unreachable by every automated check we have (see AGENTS.md). A scan of the source is the
 * only headless guard available, the same reasoning behind the scans in
 * `lib/__tests__/episodes.test.ts` and `lib/__tests__/dayLog.test.ts`.
 *
 * The rule: inside a gesture callback, every call must be `runOnJS(...)`, a Reanimated
 * worklet-safe helper, or a function the file itself marks `'worklet'`.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components', 'lib', 'store'];

/** The builder methods the Babel plugin workletizes. Mirrors its own list. */
const CALLBACKS = [
  'onBegin', 'onStart', 'onEnd', 'onFinalize', 'onUpdate', 'onChange',
  'onTouchesDown', 'onTouchesMove', 'onTouchesUp', 'onTouchesCancelled',
];

/** Callable on the UI thread: the hop itself, plus Reanimated's own worklet-safe API. */
const UI_SAFE = new Set([
  'runOnJS', 'runOnUI', 'scheduleOnRN', 'scheduleOnUI',
  'withTiming', 'withSpring', 'withDelay', 'withSequence', 'withRepeat', 'withDecay',
  'cancelAnimation', 'interpolate', 'interpolateColor', 'clamp',
  'Number', 'String', 'Boolean', 'Array', 'Object', 'isNaN', 'parseInt', 'parseFloat',
]);

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

/** The source between the parens of `.<method>(` at `from`, balanced over nesting. */
function callBody(src: string, from: number): { body: string; end: number } | null {
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { body: src.slice(from + 1, i), end: i };
    }
  }
  return null;
}

/** Every gesture callback body in a file, with the line each one starts on. */
function gestureCallbacks(src: string): { method: string; line: number; body: string }[] {
  const out: { method: string; line: number; body: string }[] = [];
  const pattern = new RegExp(`\\.(${CALLBACKS.join('|')})\\s*\\(`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(src)) !== null) {
    const open = match.index + match[0].length - 1;
    const found = callBody(src, open);
    if (!found) continue;
    out.push({
      method: match[1],
      line: src.slice(0, match.index).split('\n').length,
      body: found.body,
    });
    pattern.lastIndex = found.end;
  }
  return out;
}

/** Names the file declares as worklets, so calling them from the UI thread is legitimate. */
function workletNames(src: string): Set<string> {
  const names = new Set<string>();
  const pattern = /(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)[^\n]*?(?:=>|\{)\s*\n?\s*['"]worklet['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(src)) !== null) names.add(match[1]);
  return names;
}

/** Bare-identifier calls (`foo(`, `foo?.(`) in a body — member calls are left to the allowlist. */
function calledIdentifiers(body: string): string[] {
  const stripped = body
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
  const out: string[] = [];
  const pattern = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*(\?\.)?\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stripped)) !== null) {
    const name = match[2];
    // Not calls: control flow and the worklet's own arrow/function headers.
    if (['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof'].includes(name)) continue;
    out.push(name);
  }
  return out;
}

describe('gesture callbacks are worklet-safe', () => {
  const files = DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
    .filter((file) => fs.readFileSync(file, 'utf8').includes('react-native-gesture-handler'));

  it('finds the files that build gestures, so the scan cannot silently cover nothing', () => {
    const withCallbacks = files.filter((f) => gestureCallbacks(fs.readFileSync(f, 'utf8')).length > 0);
    expect(withCallbacks.length).toBeGreaterThanOrEqual(4);
  });

  it.each(
    DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('react-native-gesture-handler'))
      .map((file) => [path.relative(ROOT, file), file] as const),
  )('%s calls nothing on the UI thread but runOnJS and worklets', (_name, file) => {
    const src = fs.readFileSync(file, 'utf8');
    const worklets = workletNames(src);
    const offenders: string[] = [];

    for (const cb of gestureCallbacks(src)) {
      for (const name of calledIdentifiers(cb.body)) {
        if (UI_SAFE.has(name) || worklets.has(name)) continue;
        offenders.push(`.${cb.method}() at line ${cb.line} calls ${name}() directly`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
