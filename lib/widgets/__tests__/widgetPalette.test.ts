/**
 * widgetPalette.test.ts — the widget layer's hand-copied colours still equal the app's.
 *
 * Home-screen widgets render headless, in a bare JS context with the app process dead, so
 * they cannot call useAppTheme() and cannot safely evaluate constants/colors.ts's module
 * graph. Every colour they draw is therefore a hand-written copy of a real palette token,
 * in two places: `WIDGET_ACCENT` (lib/widgets/snapshot.ts) and the LIGHT/DARK/LIGHT_INK
 * tables in lib/widgets/WidgetViews.tsx.
 *
 * A copy with a comment telling the next session to keep it in step is not a mechanism —
 * that is exactly what the widget palette had, and it sat frozen at the 2026-07-14 values
 * through the true-black pass (2026-08-10), dark becoming the default (2026-08-16) and two
 * separate categorical-hue recalibrations. Nothing failed, nothing looked wrong in review,
 * and the only way to see it was to put a widget on a home screen. This test is the
 * mechanism: it recomputes each value from the real palette and fails the PR on a drift.
 *
 * WidgetViews.tsx is SOURCE-SCANNED rather than imported, because importing it pulls in
 * react-native-android-widget's native module for the sake of five hex literals.
 */
import fs from 'fs';
import path from 'path';
import { getThemePalette, IDENTITY_HUES } from '@/constants/colors';
import { mix, relLuminance } from '@/constants/theme';
import { WIDGET_ACCENT } from '@/lib/widgets/snapshot';

const LIGHT = getThemePalette('default', false);
const DARK = getThemePalette('default', true);

const SRC = fs.readFileSync(path.join(__dirname, '..', 'WidgetViews.tsx'), 'utf8');

/** Pull `const NAME: Palette = { … }` / `const NAME: Record<…> = { … }` into a key→hex map. */
function literalTable(name: string): Record<string, string> {
  const block = new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n?\\};`).exec(SRC);
  if (!block) throw new Error(`${name} not found in WidgetViews.tsx — did it get renamed?`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/'?([#\w]+)'?\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) {
    out[m[1].toUpperCase()] = m[2].toUpperCase();
  }
  return out;
}

function contrast(a: string, b: string): number {
  const [x, y] = [relLuminance(a), relLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('WIDGET_ACCENT mirrors the app identity hues', () => {
  it('uses each section\'s real categorical hue', () => {
    expect(WIDGET_ACCENT.task.toUpperCase()).toBe(IDENTITY_HUES.todo.hue.toUpperCase());
    expect(WIDGET_ACCENT.habits.toUpperCase()).toBe(IDENTITY_HUES.habits.hue.toUpperCase());
    expect(WIDGET_ACCENT.health.toUpperCase()).toBe(IDENTITY_HUES.health.hue.toUpperCase());
    expect(WIDGET_ACCENT.shop.toUpperCase()).toBe(IDENTITY_HUES.shopping.hue.toUpperCase());
    expect(WIDGET_ACCENT.notes.toUpperCase()).toBe(IDENTITY_HUES.notes.hue.toUpperCase());
  });

  it('gives the overview the palette accent — Home is the one surface with no identity hue', () => {
    expect(WIDGET_ACCENT.overview.toUpperCase()).toBe(DARK.accent.toUpperCase());
  });
});

describe('widget LIGHT/DARK palettes mirror constants/colors.ts', () => {
  it('DARK is the true-black palette, not the retired Midnight-glass navy', () => {
    const p = literalTable('DARK');
    expect(p.CARD).toBe(DARK.surface.toUpperCase());
    expect(p.TEXT).toBe(DARK.text.toUpperCase());
    expect(p.MUTED).toBe(DARK.textMuted.toUpperCase());
    expect(p.LINE).toBe(DARK.border.toUpperCase());
  });

  it('LIGHT matches the light palette', () => {
    const p = literalTable('LIGHT');
    expect(p.CARD).toBe(LIGHT.surface.toUpperCase());
    expect(p.TEXT).toBe(LIGHT.text.toUpperCase());
    expect(p.MUTED).toBe(LIGHT.textMuted.toUpperCase());
    expect(p.LINE).toBe(LIGHT.border.toUpperCase());
  });

  it('paints the frame with surface, never bg — a widget floats on a wallpaper, not on a page', () => {
    // `#000000` behind a widget dissolves it into any dark wallpaper, and the widget has no
    // page behind it to be the page colour OF.
    expect(SRC).toContain('backgroundColor: p.card');
    expect(SRC).not.toContain('backgroundColor: p.bg');
  });
});

describe('the picker previews are generated, not drawn', () => {
  // assets/widget-previews/*.png is what Android shows in the widget picker. They were
  // hand-drawn one-offs until 2026-08-15 and had gone a full palette out of date — the same
  // failure as the widget palette itself, one step further from anything that would catch it.
  // scripts/build-widget-previews.mjs regenerates them by EXTRACTING every colour from the
  // sources above at run time, so the only way it can drift is if someone types a hex into it.
  const GEN = path.join(__dirname, '..', '..', '..', 'scripts', 'build-widget-previews.mjs');

  it('the generator exists and bakes in no colour of its own', () => {
    const src = fs.readFileSync(GEN, 'utf8');
    expect(src.match(/#[0-9A-Fa-f]{6}\b/g)).toBeNull();
  });

  it('reads the tables this test also reads, so the two cannot disagree', () => {
    const src = fs.readFileSync(GEN, 'utf8');
    for (const name of ['DARK', 'LIGHT', 'LIGHT_INK', 'WIDGET_ACCENT']) expect(src).toContain(name);
  });

  it('has one PNG per live widget', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'assets', 'widget-previews');
    for (const name of ['shopping', 'tasks', 'notes', 'habits', 'health']) {
      expect(fs.existsSync(path.join(dir, `${name}.png`))).toBe(true);
    }
  });
});

describe('LIGHT_INK keeps every hue legible in light mode', () => {
  const table = literalTable('LIGHT_INK');
  const hues: string[] = [
    ...Object.values(IDENTITY_HUES).map((h) => h.hue),
    WIDGET_ACCENT.overview,
  ];

  it('covers every accent a widget can be handed', () => {
    for (const hue of hues) expect(table[hue.toUpperCase()]).toBeDefined();
  });

  it('is each hue darkened to exactly the first step clearing 4.5:1 on the light card', () => {
    // The same walk lib/domainColor.ts's badgeGlyphFor() does at runtime — recomputed here
    // rather than trusted, so moving a hue in constants/colors.ts moves the baked value too.
    for (const hue of hues) {
      let t = 0;
      let cur: string = hue;
      while (t < 1 && contrast(cur, LIGHT.surface) < 4.5) {
        t += 0.01;
        cur = mix(hue, '#000000', t);
      }
      expect(table[hue.toUpperCase()]).toBe(cur.toUpperCase());
      expect(contrast(cur, LIGHT.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the raw hues are AA on the dark card, which is why dark passes them straight through', () => {
    for (const hue of hues) expect(contrast(hue, DARK.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('needed the light-mode branch at all — every raw hue fails AA on the light card', () => {
    // Asserting the FAILURE too, so nobody "simplifies" ink() away on the assumption that a
    // hue tuned for a black card is fine on a white one. The worst is ~1.3:1.
    for (const hue of hues) expect(contrast(hue, LIGHT.surface)).toBeLessThan(4.5);
  });
});
