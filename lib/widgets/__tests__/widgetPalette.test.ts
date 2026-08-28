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
 *
 * **Widened 2026-08-28 from colour to MATERIAL.** The palette had been in step since 2026-08-15
 * and the widgets still did not look like the app, because what had drifted by then was the
 * SHAPE: the app's card was rebuilt twice (round 19's surface reset, round 20's corrected
 * screens) and the one surface that renders with the app process dead got none of it. So four
 * composited layers — the badge plate, a boxed row's fill and edge, the card's lit lip — are
 * recomputed here from the app source that owns each, exactly as the flat tokens already were,
 * and the structural rules that carry the anatomy (a right-hand check, a peek under the title,
 * a key with nothing written on its hue) are asserted by source scan, because none of them is
 * visible to tsc and nothing in this repo renders a widget.
 */
import fs from 'fs';
import path from 'path';
import { getThemePalette, IDENTITY_HUES } from '@/constants/colors';
import { getBadgeFrost, getGlassEdge, glassKey, mix, relLuminance } from '@/constants/theme';
import { WIDGET_ACCENT } from '@/lib/widgets/snapshot';

const LIGHT = getThemePalette('default', false);
const DARK = getThemePalette('default', true);

const SRC = fs.readFileSync(path.join(__dirname, '..', 'WidgetViews.tsx'), 'utf8');
const PAD_SHEET = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'components', 'PadSheet.tsx'),
  'utf8'
);

/** `rgba(r, g, b, a)` → the same colour composited over `base`. See WidgetViews' `composite`. */
function flatten(rgbaStr: string, base: string): string {
  const m = /rgba\((\d+), ?(\d+), ?(\d+), ?([\d.]+)\)/.exec(rgbaStr);
  if (!m) throw new Error(`not an rgba(): ${rgbaStr}`);
  const to = (n: string) => Number(n).toString(16).padStart(2, '0');
  return mix(base, `#${to(m[1])}${to(m[2])}${to(m[3])}`, Number(m[4])).toUpperCase();
}

/**
 * WidgetViews.tsx with its prose removed — block comments and whole-line `//` comments.
 *
 * The structural scans below have to read CODE, not the file: this component documents its own
 * omissions in detail ("RemoteViews has one text shadow and no view shadow at all", "the app
 * bans `fontStyle: 'italic'`"), so a scan for the thing being omitted matches the sentence
 * saying it was omitted. Trailing `// Radius.md`-style comments are kept, because the geometry
 * assertion reads them deliberately.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** One of components/PadSheet.tsx's private ROW_BOX_* constants, by name. */
function rowBox(name: string): string {
  const m = new RegExp(`const ${name} = '([^']+)'`).exec(PAD_SHEET);
  if (!m) throw new Error(`${name} not found in PadSheet.tsx — did the boxed row change shape?`);
  return m[1];
}

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

describe('the composited layers equal the app layers they stand in for', () => {
  // Every translucent thing the app draws is baked here as an opaque colour, because a widget
  // has no backdrop of its own — only the user's wallpaper — so an alpha would let a photo
  // through the pane and make "one step off the card" depend on what that photo is. Each value
  // is recomputed from the app source that OWNS the recipe, never from a number retyped here.
  const cases: [string, boolean, ReturnType<typeof getThemePalette>][] = [
    ['DARK', true, DARK],
    ['LIGHT', false, LIGHT],
  ];

  it.each(cases)('%s badge plate is getBadgeFrost() composited over the card', (name, isDark, theme) => {
    const p = literalTable(name);
    expect(p.PLATE).toBe(getBadgeFrost(theme.surface, isDark).plate.toUpperCase());
  });

  it.each(cases)('%s row box is PadSheet\'s own fill and edge, composited', (name, isDark, theme) => {
    const p = literalTable(name);
    const suffix = isDark ? 'DARK' : 'LIGHT';
    expect(p.ROWFILL).toBe(flatten(rowBox(`ROW_BOX_FILL_${suffix}`), theme.surface));
    expect(p.ROWEDGE).toBe(flatten(rowBox(`ROW_BOX_EDGE_${suffix}`), theme.surface));
  });

  it.each(cases)('%s card edge is getGlassEdge()\'s lit lip, and its shade side IS `line`', (name, isDark, theme) => {
    const p = literalTable(name);
    const ramp = getGlassEdge(theme.border, isDark, 'card');
    expect(p.EDGELIT).toBe(flatten(ramp.colors[0], theme.surface));
    // There is no fifth composited field on purpose: GLASS_EDGE.card carries no `shadeDark`, so
    // the shaded end resolves to plain `theme.border` at full alpha in both modes — which is
    // `line`, already in the table. If that ever stops being true this assertion is what says so.
    expect(ramp.colors[ramp.colors.length - 1]).toBe(`rgba(${[1, 3, 5]
      .map((i) => parseInt(theme.border.slice(i, i + 2), 16))
      .join(', ')}, 1)`);
  });

  it.each(cases)('%s matte key equals glassKey() for every hue a widget can wear', (name, isDark, theme) => {
    // keyStyle() is arithmetic rather than a table (the body is the HUE's own wash, so it
    // varies per widget) — so this recomputes the whole style rather than one value, including
    // light mode's hue-tinted shade side, which is the half most likely to be "simplified".
    const alphas = { body: isDark ? 0.14 : 0.16, lit: isDark ? 0.3 : 0.9, shade: isDark ? 0.07 : 0.35 };
    for (const hue of Object.values(IDENTITY_HUES).map((h) => h.hue)) {
      const app = glassKey(hue, isDark, 'key', 1.25);
      expect(flatten(app.backgroundColor, theme.surface)).toBe(
        mix(theme.surface, hue, alphas.body).toUpperCase()
      );
      expect(flatten(app.borderTopColor, theme.surface)).toBe(
        mix(theme.surface, '#FFFFFF', alphas.lit).toUpperCase()
      );
      expect(flatten(app.borderBottomColor, theme.surface)).toBe(
        mix(theme.surface, isDark ? '#FFFFFF' : hue, alphas.shade).toUpperCase()
      );
    }
    // ...and that keyStyle() is still built from those same three numbers. The loop above
    // proves the app's recipe; this proves the widget copied THAT recipe and not another one.
    const keyBody = /function keyStyle\(([\s\S]*?)\n}/.exec(CODE)?.[1] ?? '';
    expect(keyBody).toContain('p.dark ? 0.14 : 0.16');
    expect(keyBody).toContain('p.dark ? 0.3 : 0.9');
    expect(keyBody).toContain('0.07');
    expect(keyBody).toContain('0.35');
  });
});

describe('a hue stays legible on every ground a widget composites it onto', () => {
  const hues: string[] = [...Object.values(IDENTITY_HUES).map((h) => h.hue), WIDGET_ACCENT.overview];
  const inkTable = literalTable('LIGHT_INK');
  /** WCAG 1.4.11: a shape that carries meaning needs 3:1. The badge's own floor is 3.3. */
  const BADGE_FLOOR = 3.3;
  const SHAPE_FLOOR = 3;

  it('DARK passes raw hues straight onto the badge plate, and they clear the badge floor', () => {
    // The app derives its badge glyph per hue with badgeGlyphFor(); the widget passes the raw
    // hue through in dark, which is only safe while every hue clears the floor unaided. If a
    // future hue does not, this fails — and the fix is a dark ink table, not a lower floor.
    const plate = getBadgeFrost(DARK.surface, true).plate;
    for (const hue of hues) expect(contrast(hue, plate)).toBeGreaterThanOrEqual(BADGE_FLOOR);
  });

  it('LIGHT_INK clears the badge floor on the light plate — one ink table, not two', () => {
    // LIGHT_INK targets 4.5:1 on the CARD, which is stricter than badgeGlyphFor's 3.3 on the
    // PLATE, so the one table serves both. This is what makes a second baked table unnecessary
    // rather than merely absent.
    const plate = getBadgeFrost(LIGHT.surface, false).plate;
    for (const hue of hues) expect(contrast(inkTable[hue.toUpperCase()], plate)).toBeGreaterThanOrEqual(BADGE_FLOOR);
  });

  it('a filled check clears the shape floor on the boxed row it sits in, in both modes', () => {
    const darkRow = flatten(rowBox('ROW_BOX_FILL_DARK'), DARK.surface);
    const lightRow = flatten(rowBox('ROW_BOX_FILL_LIGHT'), LIGHT.surface);
    for (const hue of hues) {
      expect(contrast(hue, darkRow)).toBeGreaterThanOrEqual(SHAPE_FLOOR);
      expect(contrast(inkTable[hue.toUpperCase()], lightRow)).toBeGreaterThanOrEqual(SHAPE_FLOOR);
    }
  });

  it('an EMPTY check ring clears the shape floor too — it is a control boundary', () => {
    expect(contrast(DARK.border, flatten(rowBox('ROW_BOX_FILL_DARK'), DARK.surface))).toBeGreaterThanOrEqual(SHAPE_FLOOR);
    expect(contrast(LIGHT.border, flatten(rowBox('ROW_BOX_FILL_LIGHT'), LIGHT.surface))).toBeGreaterThanOrEqual(SHAPE_FLOOR);
  });
});

describe('the widget card is built like the app card', () => {
  // None of this is visible to tsc, and nothing in this repo renders a widget — the web preview
  // no-ops them (lib/widgets/sync.web.ts) and no screenshot in review-bundle/ contains one. A
  // source scan is the only guard that holds, which is the same reason the palette has one.

  it('carries a lit top-left edge and the boundary token bottom-right', () => {
    for (const side of ['borderTopColor: p.edgeLit', 'borderLeftColor: p.edgeLit']) {
      expect(SRC).toContain(side);
    }
    expect(SRC).toContain('borderBottomColor: p.line');
    expect(SRC).toContain('borderRightColor: p.line');
  });

  it('uses the app\'s own geometry tokens rather than widget-only numbers', () => {
    // Radius.md / Radius.sm / BORDER_WIDTH.card / BORDER_WIDTH.field, named in comments and
    // spelled once each. The values, not the names, are what a RemoteViews tree can carry.
    expect(SRC).toMatch(/const CARD_RADIUS = 16; \/\/ Radius\.md/);
    expect(SRC).toMatch(/const ROW_RADIUS = 12; \/\/ Radius\.sm/);
    expect(SRC).toMatch(/const CARD_EDGE = 1\.5; \/\/ BORDER_WIDTH\.card/);
    expect(SRC).toMatch(/const ROW_EDGE = 1\.25; \/\/ BORDER_WIDTH\.field/);
  });

  it('boxes its rows, and stacks them at a gap rather than flush', () => {
    // The fill/edge pair is PadSheet's, composited; the GAP is the widget's own smallest rung,
    // not `Spacing.xs`. Two 1.25px borders butted together paint a line heavier than the card's
    // own edge, so what matters is that there IS a gap — see the geometry block in WidgetViews.
    expect(SRC).toContain('backgroundColor: p.rowFill');
    expect(SRC).toContain('borderColor: p.rowEdge');
    expect(/function rowStyle\(([\s\S]*?)\n}/.exec(CODE)?.[1]).toContain('marginBottom: S.xxs');
  });

  it('scales its rhythm below the app\'s while keeping the app\'s shape', () => {
    // The split the geometry block states: radii and edge widths are the app's tokens (asserted
    // above), spacing is one rung down. Spending Spacing.md here costs a 110dp-tall widget its
    // second row — measured. This is what stops "make it match the app exactly" undoing that.
    expect(SRC).toMatch(/const S = \{ xxs: 3, xs: 6, sm: 8, md: 12 \};/);
  });

  it('puts the check on the RIGHT, and nothing on the left of a pressable row', () => {
    // The 2026-07-30 row rule, which the widgets never got: `title → right value → [○ check]`.
    // `marginLeft` on the check is what makes it trailing; a leading marker would carry
    // marginRight, and the only two that still do are Health's read-only ongoing/settled marks.
    const checkBody = /function Check\(([\s\S]*?)\n}/.exec(CODE)?.[1] ?? '';
    expect(checkBody).toContain('marginLeft: S.sm');
    expect(checkBody).not.toContain('marginRight');
    // Every actionable row goes through CheckRow or TrayRow, so there is one place the order
    // is spelled — the card-registry lesson, at the scale this file can have it.
    for (const action of ['TOGGLE_TASK', 'TOGGLE_HABIT', 'TOGGLE_NOTE', 'CYCLE_SHOP_ITEM']) {
      expect(SRC).toContain(action);
    }
    expect(CODE.match(/<Check /g)?.length).toBe(2); // CheckRow and TrayRow, and nowhere else.
  });

  it('draws the subtitle as a peek UNDER the title, never as an accent chip beside it', () => {
    // Round 20: a card says what it holds, in words, under its name. The old header hung the
    // subtitle off the right edge in the hue, which is both a colour the label should not carry
    // and a second thing competing with the title for one row's width.
    expect(SRC).toContain('peek={s.subtitle}');
    expect(SRC).not.toMatch(/style=\{\{ fontSize: 12, fontWeight: '500', color: accent \}\}/);
  });

  it('writes nothing on a hue — the mic key is a wash with a `text` label', () => {
    // constants/theme.ts's glassKey (2026-08-17). onInk() is deleted with the solid accent pill
    // it existed to serve; asserting its absence is what stops it being reintroduced alongside a
    // "just make the button solid again" edit.
    expect(SRC).not.toContain('function onInk');
    expect(SRC).toContain('keyStyle(accent, p)');
    expect(SRC).toContain("color: p.text }} />"); // the mic label
  });

  it('mounts no glow, no gradient and no icon font', () => {
    // The three app layers a RemoteViews tree cannot carry. Each is a documented omission in
    // WidgetViews' header; this is what keeps them omissions rather than oversights.
    expect(CODE).not.toContain('backgroundGradient');
    expect(CODE).not.toContain('IconWidget');
    expect(CODE).not.toMatch(/shadow/i);
  });

  it('keeps `fontStyle: italic` to the one line the app would draw italic too', () => {
    // Safe here and banned in the app: RN does not synthesise italic onto a NAMED custom family
    // on Android, which is why components/NarratorQuote.tsx loads a real face. A widget names no
    // family, so the system font's synthetic italic is exactly what renders.
    expect(CODE.match(/fontStyle: 'italic'/g)?.length).toBe(1);
    expect(/function Empty\(([\s\S]*?)\n}/.exec(CODE)?.[1]).toContain("fontStyle: 'italic'");
  });
});
