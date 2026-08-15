/**
 * chromeRhythm.test.ts — the three invariants the 2026-08-10 UI-consistency pass established,
 * each pinned because the thing it protects is invisible in a screenshot until it is wrong.
 *
 *   1. **The press language has ONE default.** `PressableScale` is key mode unless a caller
 *      explicitly asks for `press="scale"`, and the release settles from a ref rather than the
 *      `sunk` prop (the bob fix). A source scan, because the behaviour lives in a Reanimated
 *      component the node env can't render.
 *   2. **The sticky tab-bar height has ONE source.** `TAB_SLIDER_HEIGHT` equals TabSlider's real
 *      natural content height, and no screen restates it as a literal. Four hand-copied copies
 *      of that number is exactly how the 2026-07-24 pill-inset bug happened.
 *   3. **Nothing peeks past the chrome.** `NAV_PEEK` is gone, the bottom reserve is the bar's
 *      full painted footprint, and ScreenScaffold clips its scroll viewport.
 *   4. **A Button has three states, and the right variants wear them** (added 2026-08-12).
 *      Popped out = primary/danger only, flat = secondary, pressed in = sink + shadow to zero
 *      + the matte-glass body it now has. Same reason as 1: a press state is invisible
 *      in a screenshot, and the web preview runs worklets on the JS thread so it can't see one
 *      either — a source scan plus the contrast arithmetic is the only guard that holds.
 *
 * Precedent for reading source in a test: lib/__tests__/cardLayout.test.ts, and the "(b) Token
 * use" half of lib/__tests__/designTokens.test.ts. Same reasoning as both — the shape tests
 * alone can't see a component quietly opting back out.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getGlow, mix } from '@/constants/theme';
import { contrastRatio, IDENTITY_HUES, THEMES } from '@/constants/colors';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Source with every comment removed.
 *
 * This matters more here than in most source-scanning tests: this repo's files carry long
 * JSDoc headers that deliberately NAME the thing they replaced ("`NAV_PEEK` lived here until…",
 * "it used to fade `pillOpacity` to 0"). That prose is the point — it's what stops a later
 * session re-adding a reversed decision — so a "this identifier is gone" assertion has to look
 * at code, not at the file. Use `read()` when asserting a comment exists, `code()` otherwise.
 */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ── 1. One press language ────────────────────────────────────────────────────

describe('PressableScale — sinks in, pops out, no bob', () => {
  const source = code('components/PressableScale.tsx');

  it('defaults to key mode, so an unannotated caller gets the sink', () => {
    // The signature default is what ~330 call sites inherit. If this flips back to 'scale',
    // every row, chip and sheet option in the app silently returns to shrink-and-dim.
    expect(source).toMatch(/press:\s*pressMode\s*=\s*'key'/);
    expect(source).toMatch(/travel\s*=\s*Travel\.sm/);
  });

  it('gates key mode on the MODE, not on `travel` being present', () => {
    // Before 2026-08-10 `isKey` was `travel != null && travel > 0`, so withholding `travel`
    // was how a caller opted out. With a default travel that no longer works — and a caller
    // still relying on it would get a sink it never asked for.
    expect(source).toMatch(/const isKey = pressMode === 'key' && travel > 0/);
  });

  it('settles the release from a ref, one tick late — the bob fix', () => {
    // RN only defers onPressOut past onPress for taps under 130ms. On a slower tap the
    // handler's closure sees the pre-tap `sunk`, so reading the prop there raises a control
    // that is about to be on: down, up, down. See PressableScale's own `sunkRef` edit note.
    expect(source).toMatch(/const sunkRef = React\.useRef\(sunk\)/);
    expect(source).toMatch(/const to = sunkRef\.current \? 1 : 0/);
    // The release is deferred, and clears any settle the previous tap left queued.
    expect(source).toMatch(/settleTimer\.current = setTimeout\(settle, 0\)/);

    // The *effect* still reads the prop directly, and must — that's how a caller flipping
    // `sunk` (a tab changing under you, a peer ticking a shared row) animates at all. It is
    // only the release handler that has to use the ref, so scope the assertion to it rather
    // than banning `sunk` from the file.
    const release = source.slice(source.indexOf('onPressOut={'), source.indexOf('onPress={('));
    expect(release).not.toMatch(/sunk/);
  });

  it('has exactly three opt-outs, each structural rather than a taste call', () => {
    // A `ghost` Button/IconButton has no fill and therefore no base to sink onto; Surface's
    // is the reduced-motion branch. Anything else reaching for press="scale" is drift —
    // read PressableScale's Edit notes first.
    const optOuts = ['components/Button.tsx', 'components/IconButton.tsx', 'components/Surface.tsx']
      .filter((f) => /press=\{[^}]*'scale'|press="scale"/.test(code(f)));
    expect(optOuts).toEqual([
      'components/Button.tsx',
      'components/IconButton.tsx',
      'components/Surface.tsx',
    ]);
    // Button's follows the same condition as its travel, so the two can't disagree.
    expect(code('components/Button.tsx')).toMatch(/press=\{isKeyShape \? 'key' : 'scale'\}/);
    // Surface's must stay conditional — an unconditional 'scale' would drop the sink for
    // everyone, not just for a user who asked for less motion.
    expect(code('components/Surface.tsx')).toMatch(/press=\{reducedMotion \? 'scale' : 'key'\}/);
  });
});

// ── 2. One tab-bar height ────────────────────────────────────────────────────

describe('TAB_SLIDER_HEIGHT — one number, not five', () => {
  const source = code('components/TabSlider.tsx');

  it('is derived from the component\'s own geometry, never written as a literal', () => {
    expect(source).toMatch(/export const TAB_SLIDER_HEIGHT = 2 \+ TRACK_PAD \* 2 \+ SEGMENT_HEIGHT;/);
  });

  it('matches the height the row actually renders', () => {
    // border 1×2 + TRACK_PAD×2 + segment minHeight. Any surplus at a caller becomes leftover
    // space its justifyContent:'center' splits around the pill, which is the 2026-07-24 bug.
    const trackPad = Number(source.match(/const TRACK_PAD = (\d+);/)![1]);
    const segment = Number(source.match(/const SEGMENT_HEIGHT = (\d+);/)![1]);
    expect(source).toMatch(/minHeight: SEGMENT_HEIGHT/);
    expect(2 + trackPad * 2 + segment).toBe(42);
  });

  it('is imported by every screen that reserves a sticky tab row', () => {
    for (const file of [
      'app/(tabs)/plans.tsx',
      'app/(tabs)/shopping.tsx',
      'app/settings.tsx',
      'app/design-lab/tokens.tsx',
    ]) {
      const s = code(file);
      expect(s).toMatch(/TAB_SLIDER_HEIGHT/);
      // The literals these replaced: 46 (plans, shopping), 48 (settings), 56 (design lab).
      expect(s).not.toMatch(/const (STICKY_HEIGHT|STICKY_HEIGHT_TABS|TAB_BAR_HEIGHT) = \d+;/);
    }
  });
});

// ── 3. Nothing above the header, nothing under the nav ───────────────────────

describe('chrome edges — content is clipped, not merely padded', () => {
  it('has no NAV_PEEK constant left, even though the peek itself is back', () => {
    // 2026-07-26 shaved Radius.lg off the clearance so a card edge showed in the bar's corner
    // notches. Reversed 2026-08-10: "Nothing should be visible ... above the header, or under
    // the bottom nav." Reversed BACK, partially, the same day: the peek was wanted after all —
    // "should be visible in the bottom nav's cut corners at the top ... same for the header but
    // the opposite" — but the fixed-px-shave MECHANISM isn't what came back. The viewport's own
    // square corners produce the same peek for free (see ScreenScaffold's square-corner test
    // above), so there's still no `NAV_PEEK` name anywhere to reintroduce.
    expect(code('components/BottomNav.tsx')).not.toMatch(/NAV_PEEK/);
    expect(code('components/ScreenScaffold.tsx')).not.toMatch(/NAV_PEEK/);
  });

  it('clips the WHOLE nav footprint, so nothing travels behind the glass', () => {
    // 2026-08-18, reversing the 2026-08-11 split. That split (`marginBottom` = the band below
    // the bar, `paddingBottom` = the bar's own height) deliberately let content scroll behind
    // the card and be "hidden BY" it — correct while the bar was opaque, and false from
    // 2026-08-15, when it became frosted glass with a real BlurView. Maintainer: *"things like
    // header and bottom nav should still not show elements behind it when user is scrolling…
    // Only the backdrop."* Summed, the clearance is identical; all of it now CLIPS.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).toMatch(
      /marginBottom:\s*\n?\s*\(pagerFloatingNav \? bottomInset \+ NAV_FLOAT_GAP : 0\) \+ \(reserveBottomNav \? BOTTOM_NAV_HEIGHT : 0\)/,
    );
    // Not as content padding as well — that is the double-count that grows a blank band on
    // every screen. This is the surviving half of the old rule: one clearance each, never both.
    expect(source).not.toMatch(/paddingBottom: reserveBottomNav \? BOTTOM_NAV_HEIGHT : 0/);
    // And still never spelled as the whole clearance constant, which is now only the
    // DebugGeneralNoteButton's offset from the screen edge.
    expect(source).not.toMatch(/(margin|padding)Bottom: bottomNavClearance/);
  });

  it('starts the clip at the header card\'s BOTTOM edge, including any sticky bar', () => {
    // Same reversal, top end. The clip used to sit on the header card's OUTER (top) edge with
    // the resting gap as content padding; it is the chrome's INNER edge now, so a scrolled card
    // stops where the glass begins. `stickyBelowHeaderHeight` has to be in it — a screen's tab
    // row is chrome too, and content showing through THAT was the same defect one card lower.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).toMatch(
      /marginTop: contentTopClear \+ \(stickyBelowHeader \? stickyBelowHeaderHeight \+ stickyGap : 0\)/,
    );
    expect(source).not.toMatch(/paddingTop: contentTopClear/);
  });

  it('clips the scroll viewport AND pads the content — one clearance each', () => {
    const source = code('components/ScreenScaffold.tsx');
    // `overflow: hidden` is the mechanism; without it the margins are just a differently-spelled
    // padding and every strip leaks again.
    expect(source).toMatch(/viewport:\s*\{[^}]*overflow:\s*'hidden'/s);
    expect(source).toMatch(/const viewportInset = \{/);
    // `contentPad` still exists and still reaches BOTH branches — the ScrollView's
    // contentContainer and the non-scrollable (FlatList) wrapper — but it is zero on both axes
    // since 2026-08-18: the viewport's own margins are the whole clearance now. It is kept as
    // the one named place that decision is written down, so restoring a resting gap means
    // editing a documented constant rather than sprinkling padding at two call sites.
    expect(source).toMatch(/const contentPad = \{ paddingTop: 0, paddingBottom: 0 \}/);
    expect(source).toMatch(/contentContainerStyle=\{\[styles\.contentContainer, contentPad\]\}/);
    expect(source).toMatch(/\[styles\.scrollView, viewportBleed, contentPad\]/);
  });

  it('applies the floored top inset itself rather than letting SafeAreaView use the raw one', () => {
    // SafeAreaView pads a listed edge with the RAW insets.top; the header block floors the
    // same inset with StatusBar.currentHeight. Under the clip those must agree, or the
    // viewport's top edge sits above the header's bottom edge on Android's first frames.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).toMatch(/safeAreaEdges: Edge\[\] = pagerTabScene \? \['left', 'right'\]/);
    expect(source).toMatch(/paddingTop: topInset/);
  });

  it('lets touches through the chrome blocks\' transparent margins', () => {
    // Full-width zIndex 99/100 views with transparent side strips — without box-none they
    // swallow taps meant for the content under them.
    const source = code('components/ScreenScaffold.tsx');
    expect(source.match(/pointerEvents="box-none"/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

// ── The bottom nav's own indicator ───────────────────────────────────────────

describe('BottomNav — flat equality, no background shape', () => {
  const source = code('components/BottomNav.tsx');

  // 2026-08-18. Maintainer: *"Do not use massive asymmetrical background circles for the active
  // Bottom Nav icon… Bottom nav icons should have equal visual weight; the active state should
  // just be a filled icon in the active color with no background shape."*
  //   Every test in this block used to pin the OPPOSITE — a sliding pill measured against three
  // tracks, a ring sized from HOME_RING and centred on a 56px FAB, two clamps keeping both
  // inside the bar's mask. All of that is deleted, and these assertions are its mirror image so
  // it cannot be rebuilt from the (deliberately preserved) history notes in the component.
  it('draws nothing behind the active tab — no pill, no ring, no plate', () => {
    for (const gone of [/pill/i, /HOME_RING/, /PILL_INSET/, /PILL_GROW/, /clampTop/, /clampLeft/, /accentSoft/]) {
      expect({ pattern: String(gone), present: gone.test(source) })
        .toEqual({ pattern: String(gone), present: false });
    }
  });

  it('has no centre FAB — Home is an ordinary slot in an ordinary row', () => {
    // A 56px accent-filled circle with a gradient rim cannot coexist with "equal visual
    // weight", whatever is or isn't drawn behind the other four.
    expect(source).not.toMatch(/centreButton/);
    expect(source).not.toMatch(/renderCentre/);
    expect(source).not.toMatch(/LinearGradient/);
    // ...and the bar no longer slices SITE_ITEMS around a centre index, so reordering the tabs
    // needs no arithmetic here.
    expect(source).not.toMatch(/SITE_ITEMS\.slice/);
    expect(source).toMatch(/SITE_ITEMS\.map\(/);
  });

  it('marks the active tab with a filled glyph in the section colour, and nothing else', () => {
    expect(source).toMatch(/const tint = active \? navTabHue\(theme, isDark, item\) : theme\.textMuted/);
    expect(source).toMatch(/name=\{active \? item\.activeIcon : item\.icon\}/);
    expect(source).toMatch(/color=\{tint\}/);
  });

  it('gives every slot the same box', () => {
    // `flex: 1` on all five and no `gap`/`justifyContent` on the bar — the five divide the bar
    // evenly by construction. The old bar needed both because it was three children of unequal
    // width, and its raw-vs-scaled `gap` was itself a bug (2026-08-13).
    const item = source.match(/item: \{[^}]*\}/)?.[0] ?? '';
    expect(item).toMatch(/flex: 1/);
    const bar = source.match(/bar: \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(bar).not.toMatch(/gap:/);
    expect(bar).not.toMatch(/justifyContent/);
  });

  it('still rests no tab sunk while selected (2026-08-12), and carries no compensating offset', () => {
    // Maintainer, then: "Instead of the pressed down look, just have the blue move between when
    // going between screens." What moves between screens is now the colour rather than a plate,
    // but the ruling is unchanged — `sunk` is for a momentary press, not for "this is the tab
    // you are on". `travel` (the ordinary press sink) stays.
    expect(source).not.toMatch(/sunk=\{active\}/);
    expect(source).not.toMatch(/\+ Travel\.sm,/);
    expect(source).not.toMatch(/\+ Travel\.md,/);
    expect(source).toMatch(/travel=\{Travel\.sm\}/);
  });

  it('keeps grey depth and every halo off the bar', () => {
    // Each of these was deleted on its own user report in 2026-08-10/11 — a hue-less blur under
    // a pale plate read as a dirty donut, a 15px glow with 4px of clearance to a clipping mask
    // could never fade out, and Shadow.fab drew a grey collar rather than a float. The bar is a
    // Surface that already casts one shadow for the whole cluster.
    expect(source).not.toMatch(/getLayeredShadow/);
    expect(source).not.toMatch(/getGlow/);
    expect(source).not.toMatch(/Shadow\.fab/);
  });

  it('has no measurement or animation left at all, because it has nothing to move', () => {
    // The three measured tracks, the absoluteFill probe and every shared value existed only to
    // position the pill. A `useSharedValue` reappearing here means a background shape did too.
    expect(source).not.toMatch(/useSharedValue/);
    expect(source).not.toMatch(/withTiming/);
    expect(source).not.toMatch(/onLayout/);
  });
});

// ── 4. The clip window is the chrome's shape ─────────────────────────────────

describe('ScreenScaffold — the clipped viewport matches the floating chrome', () => {
  const source = code('components/ScreenScaffold.tsx');

  it('takes the chrome\'s side margins, and rounds no corner at all', () => {
    // The margins close the 8px gutters beside the header/bar, where no chrome covers content.
    expect(source).toMatch(/marginHorizontal: headerFloatH/);
    // **No corner radius any more (2026-08-18).** This assertion has now flipped three times,
    // and each flip followed the WINDOW moving rather than a taste change about corners: the
    // radii were for the two pairs where the viewport met a chrome card's OUTER corner (the
    // header's top, the bar's bottom). The window no longer reaches either — it is a plain
    // rectangle in the gap BETWEEN the two cards — so a radius here would round content's
    // corners against nothing. Both halves are asserted, so restoring one without moving the
    // window back fails.
    expect(source).not.toMatch(/borderTopLeftRadius: Radius\.lg/);
    expect(source).not.toMatch(/borderBottomLeftRadius: Radius\.lg/);
  });

  it('bleeds the scroll box back out so no card is resized by the inset', () => {
    // The 8px this clips off each side is empty backdrop (every screen's content container
    // already pads by Spacing.md). Drop the mirror-image negative margin and every card in
    // the app gets narrower.
    expect(source).toMatch(/const viewportBleed = \{ marginHorizontal: -headerFloatH \}/);
    expect(source.match(/viewportBleed/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

// ── 4. The matte-glass button ────────────────────────────────────────────────

describe('Button — matte glass, not plastic', () => {
  const button = code('components/Button.tsx');
  const pressable = code('components/PressableScale.tsx');
  const theme = code('constants/theme.ts');

  // ⚠️ **REWRITTEN 2026-08-17.** This block used to pin the "hardware key" build: a
  // `PRESS_DARKEN` face that darkened toward its `keyBase` housing, `pressFill` handing
  // `backgroundColor` to PressableScale, and `depth="raised"` + `housed` on primary/danger. The
  // maintainer's ruling is that the result read as *"glossy Web 2.0 plastic pills"*, so all of it
  // is deleted, and the assertions are rewritten to guard what replaced it rather than removed —
  // otherwise the next brief re-derives the same gloss from a clean slate. The one thing carried
  // over unchanged is the SINK, which is the last test in this block.

  it('draws the body as a flat translucent wash, never a solid fill', () => {
    // The brief's central instruction, and the half a screenshot cannot check: `rgba()` at a
    // single-digit-to-teens alpha, set statically on the pressable. Both halves matter — a
    // translucent body with `pressFill` still alive would put two owners on backgroundColor.
    expect(button).toMatch(/const key = glassKey\(hue, isDark, weight, edgeWidth\)/);
    expect(button).toMatch(/backgroundColor: colors\.bg,/);
    expect(button).not.toMatch(/pressFill/);
    // The alphas live in constants/theme.ts now, because Button is not the only caller — the ~18
    // hand-rolled action pills draw through the same helper, and two copies of these numbers is
    // exactly the drift `glassKey` exists to stop.
    for (const mode of ['dark', 'light'] as const) {
      const rungs = theme
        .match(new RegExp(`${mode}: \\{ key: ([\\d.]+), loud: ([\\d.]+), quiet: ([\\d.]+) \\}`))!
        .slice(1)
        .map(Number);
      // "the mapped categorical color at 10-15% opacity", with light a couple of points up, the
      // secondary rung one step back and `danger` at the top of the band (see glassKey's note).
      // Anything at or above 0.25 stops being a wash and starts being a fill again.
      for (const alpha of rungs) {
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThan(0.25);
      }
      const [key, loud, quiet] = rungs;
      expect(quiet).toBeLessThan(key);
      expect(loud).toBeGreaterThan(key);
    }
  });

  it('lights the top-left edge and keeps a boundary on the bottom-right', () => {
    // Per-side COLOURS at one width, not the brief's per-side widths — RN renders mixed border
    // widths on a Radius.full pill inconsistently, and dropping two sides takes away the
    // WCAG 1.4.11 control boundary a button (unlike a card) cannot afford to lose.
    expect(theme).toMatch(/borderTopColor: lit,\s+borderLeftColor: lit,/);
    expect(theme).toMatch(/borderBottomColor: shade,\s+borderRightColor: shade,/);
    // One width for all four sides, and it stays a token rather than a bare 1 — Button hands it
    // the design lab's own `edgeWidth`, and the default is BORDER_WIDTH.button.
    expect(theme).toMatch(/width = BORDER_WIDTH\.button/);
    expect(button).toMatch(/borderWidth: key\.borderWidth,/);
  });

  it('has no gloss layer left anywhere on a key', () => {
    // The three deleted layers, asserted as absences because each is invisible to a screenshot
    // in isolation and only reads as "plastic" in combination. `face` covers both the resting
    // highlight and the pressed inner shade — they were one prop.
    expect(pressable).not.toMatch(/face\?:/);
    expect(pressable).not.toMatch(/from 'expo-linear-gradient'/);
    expect(pressable).not.toMatch(/interpolateColor/);
    // …and the housing, which was the "solid heavy color" half of the same complaint.
    expect(button).not.toMatch(/keyBase/);
    expect(button).not.toMatch(/depth=/);
    expect(button).toMatch(/const button = pressable;/);
  });

  it('glows outward in the screen\'s categorical colour, on primary and danger only', () => {
    // The one lighting effect that survives, and the one the brief asks for by name. `hue` is
    // shared with the body and the shade edge, so the light and the tint cannot disagree.
    expect(button).toMatch(
      /const isRaised = !unfilled && \(variant === 'primary' \|\| variant === 'danger'\)/
    );
    expect(button).toMatch(/const glow = isRaised \? \{ color: hue, radius: Radius\.full \} : undefined/);
    // getGlow is a boxShadow with no offset — i.e. it projects outward, not inward.
    const glow = getGlow('#1E88FF', 'soft');
    expect(glow.boxShadow.every((s) => s.offsetX === 0 && s.offsetY === 0 && s.blurRadius > 0)).toBe(true);
  });

  it('reads on its own body in both modes, on every categorical hue', () => {
    // The contrast question the old build answered with `accentInk`. Nothing is written ON a hue
    // any more — the label is `theme.text` over a wash of the hue on the card — so this measures
    // the label against what the body actually composites to. AA on all five hues in both modes
    // is what makes a categorical primary button legal at all; if this fails, the fix is a lower
    // body alpha, not a per-hue ink table.
    for (const mode of ['light', 'dark'] as const) {
      const p = THEMES.default[mode];
      const alpha = mode === 'dark' ? 0.14 : 0.16;
      for (const { hue } of Object.values(IDENTITY_HUES)) {
        const composited = mix(p.surface, hue, alpha);
        expect(contrastRatio(p.text, composited)).toBeGreaterThanOrEqual(4.5);
      }
      // …and `danger`, at its own deeper rung. **The counter-case matters as much as the rule**:
      // a red LABEL on this wash measures 4.62 → 3.59:1 across the usable alpha range, i.e. it
      // fails AA everywhere, which is why the label is `theme.text` here too and the red lives in
      // the wash and the halo. Asserting the failure keeps the next session from "restoring" it.
      expect(contrastRatio(p.text, mix(p.surface, p.bad, 0.24))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.bad, mix(p.surface, p.bad, 0.24))).toBeLessThan(4.5);
    }
  });

  it('still sinks a flat variant its full travel', () => {
    // Flat is not inert: `travel` follows the shape, not the elevation. If this ever becomes
    // `isRaised ? SIZE_TRAVEL[size] : undefined`, a secondary button stops moving entirely.
    expect(button).toMatch(/const travel = isKeyShape \? SIZE_TRAVEL\[size\] : undefined/);
  });

  it('always puts the caller style on the pressable itself', () => {
    // With the housing gone there is no wrapper to move it to. It was `housed ? null : style`,
    // and a stale conditional here silently drops every button's caller-supplied width/margin.
    expect(button).toMatch(/\s+style,\s+\]\}/);
  });
});
