/**
 * settingRow.test.ts — one settings row, and every switch says its own name (2026-08-12).
 *
 * app/settings.tsx wrote out the same seven lines — a row, a label/hint column, a Switch —
 * twenty-three times, about 160 of that file's ~1000 lines, and four other files declared
 * their own copy of the row/label/hint style block. components/SettingRow.tsx is the one
 * implementation now (`ToggleRow`, plus `SettingLinkRow` for the arrow variant).
 *
 * The assertion worth having is not the line count. It is the accessibility default: a bare
 * `Switch` in a row announces only its state, so a screen-reader user hears "off" with nothing
 * saying what is off. Exactly one of the twenty-three hand-written rows had noticed — the
 * design-lab toggle, whose `accessibilityLabel` carried a comment reading "Named, unlike its
 * neighbours". Twenty-two neighbours, unnamed, for months. That is invisible to tsc, to a
 * screenshot, to the wrap audit and to the web preview; the only thing that can see it is a
 * rule saying the name is not optional.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const row = read('components/SettingRow.tsx');

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

describe('ToggleRow', () => {
  it('names the switch after the row, and lets a caller only OVERRIDE that', () => {
    expect(row).toMatch(/accessibilityLabel=\{accessibilityLabel \?\? label\}/);
    // `?? label`, never `accessibilityLabel={accessibilityLabel}` — a row that forgets the prop
    // must still be named, which is the entire point.
    expect(row).not.toMatch(/accessibilityLabel=\{accessibilityLabel\}/);
  });

  it('lets the label yield, and never the control', () => {
    // The wrap-audit lesson from the task editor (AGENTS.md): a fixed-size control has no width
    // to give, so a long Norwegian label has to be the thing that shrinks. `flex: 1` alone
    // doesn't do it — `minWidth: 0` is what actually lets a text column go below its content.
    expect(row).toMatch(/textCol: \{ flex: 1, minWidth: 0/);
  });

  it('draws no divider of its own', () => {
    // Cards own their rules: several of these rows are conditional, and a row drawing its own
    // divider leaves a hanging line the moment it unmounts.
    expect(row).not.toMatch(/borderBottomWidth|styles\.divider/);
  });
});

describe('nobody hand-rolls the row any more', () => {
  it('has no second copy of the label/hint column', () => {
    // `switchTextCol` was the giveaway: the label-over-hint column, declared in five files.
    const offenders = sourceFiles().filter((f) => read(f).includes('switchTextCol: {'));
    expect(offenders).toEqual([]);
  });

  it('leaves app/settings.tsx unable to mount a bare Switch by habit', () => {
    // Every boolean on that screen goes through ToggleRow, so the import isn't there to reach
    // for. A new setting that needs one is a signal to extend ToggleRow, not to re-copy it.
    expect(read('app/settings.tsx')).not.toMatch(/Switch\s+as\s+FormSwitch/);
  });
});
