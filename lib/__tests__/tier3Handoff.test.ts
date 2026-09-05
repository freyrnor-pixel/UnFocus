/**
 * tier3Handoff.test.ts — the three composers that offer "More" all commit, then hand off, in the
 * one shape (round 20 phase 5, R20.6).
 *
 * `components/AddRow.tsx` gained `onMore` in R20.5 with no caller. This pins the three callers
 * that wire it, and the property that keeps breaking in this repo when several surfaces grow the
 * same affordance: *do they agree*. Precedent for the style — a source scan rather than a render
 * — is `composerFocusSteal.test.ts` and `chromeRhythm.test.ts`: these components mount native
 * modules the node env has no concept of, and what can be checked cheaply and exactly is the
 * SHAPE of the wiring.
 *
 * The behaviour of the guard itself is a real test, not a scan: see `commitOnce.test.ts`.
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

const todo = code('components/TodoSurface.tsx');
const medicine = code('components/MedicineSurface.tsx');

describe('one helper, not four shapes', () => {
  it('TodoSurface routes its hand-off through the shared single-flight guard', () => {
    expect(todo).toMatch(/import\s*\{\s*useCommitOnce\s*\}\s*from\s*'@\/lib\/commitOnce'/);
    // The helper: commit, take the returned Task, push it into expandTaskId.
    expect(todo).toMatch(/function\s+useCommitAndEdit\s*\(\)/);
    expect(todo).toMatch(/commitOnce\(create,\s*\(task\)\s*=>\s*router\.setParams\(\{\s*expandTaskId:\s*task\.id\s*\}\)\)/);
  });

  it('does not hand off outside the helper — no second shape', () => {
    // Every setParams({ expandTaskId }) that COMMITS must go through useCommitAndEdit. The two
    // legitimate non-committing ones (the day-log jump and onPressTask) navigate to a task that
    // already exists, so they are not commit-then-hand-off and are listed here deliberately.
    const handOffs = todo.match(/router\.setParams\(\{\s*expandTaskId:/g) ?? [];
    expect(handOffs).toHaveLength(3);
    expect(todo).toMatch(/router\.setParams\(\{\s*expandTaskId:\s*entry\.sourceId\s*\}\)/);
    expect(todo).toMatch(/onPressTask=\{\(task: Task\)\s*=>\s*router\.setParams\(\{\s*expandTaskId:\s*task\.id\s*\}\)\}/);
  });

  it('MedicineSurface reuses the same guard rather than rolling its own', () => {
    expect(medicine).toMatch(/import\s*\{\s*useCommitOnce\s*\}\s*from\s*'@\/lib\/commitOnce'/);
    expect(medicine).toMatch(/commitOnce\(\s*\(\)\s*=>\s*commitAdd\(name\)/);
  });
});

describe('site 1 — Whenever', () => {
  it('commitWhenever returns the created Task so it can be handed off', () => {
    const fn = todo.match(/const commitWhenever = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/const task = addTask\(\{/);
    expect(fn).toMatch(/return task;/);
    // Empty line writes nothing at all.
    expect(fn).toMatch(/if \(!title\) return undefined;/);
  });

  it('wires onMore through the helper and is inert on an empty line', () => {
    expect(todo).toMatch(/onSubmit=\{commitWhenever\}[\s\S]{0,200}?onMore=\{\(text\)\s*=>\s*\{[\s\S]{0,120}?if \(!text\) return;[\s\S]{0,120}?commitAndEdit\(commitWhenever\);/);
  });
});

describe('site 2 — the shared Today / Calendar / Recurring composer', () => {
  it('commit returns the created Task', () => {
    const fn = todo.match(/const commit = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[value,/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/const task = addTask\(\{/);
    expect(fn).toMatch(/return task;/);
    expect(fn).toMatch(/if \(!title\) return undefined;/);
  });

  it('wires onMore through the helper and is inert on an empty line', () => {
    expect(todo).toMatch(/onSubmit=\{commit\}[\s\S]{0,200}?onMore=\{\(text\)\s*=>\s*\{[\s\S]{0,120}?if \(!text\) return;[\s\S]{0,120}?commitAndEdit\(commit\);/);
  });
});

describe('site 3 — Medicine', () => {
  it('commitAdd returns the created Medicine', () => {
    const fn = medicine.match(/function commitAdd\(name: string\) \{[\s\S]*?\n  \}/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/const med = addMedicine\(\{/);
    expect(fn).toMatch(/return med;/);
  });

  it('hands off to medicine-form by id — reusing its edit path, not a create mode', () => {
    expect(medicine).toMatch(
      /router\.push\(\{\s*pathname:\s*'\/medicine-form',\s*params:\s*\{\s*id:\s*med\.id\s*\}\s*\}\)/
    );
    // The STOP gate: this session must not have taught the form a name-prefilled create mode.
    const form = code('app/medicine-form.tsx');
    expect(form).not.toMatch(/params:\s*\{[^}]*\bname\b/);
  });

  it('the composer only offers More when a caller passes one, and is inert on empty', () => {
    const composer = medicine.match(
      /function MedicineComposer\(\{[\s\S]*?(?=export default function MedicineSurface)/
    )?.[0];
    expect(composer).toBeTruthy();
    expect(composer).toMatch(/onMore=\{\s*onMore\s*&&/);
    expect(composer).toMatch(/if \(!name\) return;/);
  });
});

describe('the pre-existing timeline path is unchanged by the extraction', () => {
  it('still guards an empty title, still calls handleTimelineAddTask with the same args', () => {
    const fn = todo.match(/const handleTimelineAddTaskAndEdit = useCallback\([\s\S]*?\n  \);/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/if \(!title\) return;/);
    expect(fn).toMatch(/commitAndEdit\(\(\) => handleTimelineAddTask\(title, extra\)\)/);
    // It must not have grown a second creation call or reordered anything around it.
    expect(fn!.match(/handleTimelineAddTask\(/g)).toHaveLength(1);
  });

  it('still feeds PlanTaskCard the same prop', () => {
    expect(todo).toMatch(/onAddTaskAndEdit=\{handleTimelineAddTaskAndEdit\}/);
  });
});
