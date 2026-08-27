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
 *      full painted footprint, and ScreenScaffold clips its scroll viewport — flush against two
 *      SQUARE chrome edges, with no resting gap at either end (2026-08-19).
 *   4. **A Button has three states, and the right variants wear them** (added 2026-08-12).
 *      Popped out = primary/danger only, flat = secondary, pressed in = sink + shadow to zero
 *      + the matte-glass body it now has. Same reason as 1: a press state is invisible
 *      in a screenshot, and the web preview runs worklets on the JS thread so it can't see one
 *      either — a source scan plus the contrast arithmetic is the only guard that holds.
 *   5. **A field's halo is cut to the field's own shape** (added 2026-08-19). `getFieldGlow`
 *      hands out the radius WITH the shadow, so the two cannot be separate decisions at a call
 *      site — which is how a square glow ended up around every rounded composer well.
 *   6. **The backdrop is the bottom layer, and it is orbs, not line art** (added 2026-08-17).
 *      All three backdrop layers and their group wrapper declare `zIndex: -1`, ScreenBackground
 *      draws no strokes, and — the one that carries weight elsewhere — no orb reaches the middle
 *      of the canvas at any growth level, which is what keeps
 *      `__tests__/glassMaterial.test.ts`'s `#000000` dark ground true.
 *
 * Precedent for reading source in a test: lib/__tests__/cardLayout.test.ts, and the "(b) Token
 * use" half of lib/__tests__/designTokens.test.ts. Same reasoning as both — the shape tests
 * alone can't see a component quietly opting back out.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getGlow, mix } from '@/constants/theme';
import { contrastRatio, IDENTITY_HUES, THEMES } from '@/constants/colors';
import { GROWTH_LEVELS } from '@/lib/growth';

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

  it('nothing rests sunk to say "this one is on" (2026-08-24)', () => {
    // `sunk` translates the cap down for as long as the state holds, so in a ROW of controls
    // the one that is on sits below its neighbours. Reported twice, from opposite ends of the
    // app: the bottom nav's selected tab (2026-08-12, "instead of the pressed down look, just
    // have the blue move") and the Katalog card header's locked lock sitting 4px under the
    // camera beside it. components/IconButton.tsx has the extra reason as of the 2026-08-18
    // matte-glass pass — its `keyBase` slab is deleted, so there is no base left to sink INTO
    // and the offset never read as depth, only as a button sitting low.
    //
    // The prop itself stays: it is what a momentary press animates through, and a caller may
    // still drive it from a transient. What is banned is wiring it straight to an `active`
    // flag. `sunk={active}` in components/BottomNav.tsx is asserted separately below.
    for (const file of ['components/IconButton.tsx', 'components/Button.tsx', 'components/BottomNav.tsx']) {
      expect([file, code(file).match(/sunk=\{active\}/)?.[0] ?? null]).toEqual([file, null]);
    }
    // On is still carried on three channels in IconButton — the deepened body, the accent
    // glyph and the outward halo — so removing the fourth costs no state legibility.
    const icon = code('components/IconButton.tsx');
    expect(icon).toMatch(/glassKey\(theme\.accent, isDark, 'key'\)/);
    expect(icon).toMatch(/active \? theme\.accent/);
    expect(icon).toMatch(/glow=\{active && !disabled/);
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
    // app/plans.tsx (later app/(tabs)/plans.tsx) was here until 2026-08-20, when the To-do tab
    // dropped its Today/This week/All tasks TabSlider for four always-stacked cards — see
    // components/TodoSurface.tsx. It reserves no sticky row any more, so it left this list
    // rather than being renamed within it (the assertion right below this one — no bare
    // literal — would otherwise pass by accident on a file with no sticky row at all).
    // app/(tabs)/shopping.tsx left the same way, same day, in the follow-up card-element
    // standardization pass: Weekly/Monthly's TabSlider became two always-visible SectionRail
    // groups (see that file's header note) — no more sticky row there either.
    for (const file of [
      'app/settings.tsx',
      'app/design-lab/tokens.tsx',
    ]) {
      const s = code(file);
      expect(s).toMatch(/TAB_SLIDER_HEIGHT/);
      // The literals these replaced: 46 (plans, shopping), 48 (settings), 56 (design lab).
      expect(s).not.toMatch(/const (STICKY_HEIGHT|STICKY_HEIGHT_TABS|TAB_BAR_HEIGHT) = \d+;/);
    }
  });

  it('the To-do tab and Shopping have no TabSlider left to reserve height for (2026-08-20)', () => {
    for (const file of [
      'app/(tabs)/plans.tsx',
      'components/TodoSurface.tsx',
      'app/(tabs)/shopping.tsx',
    ]) {
      expect(code(file)).not.toMatch(/TabSlider|TAB_SLIDER_HEIGHT/);
    }
  });
});

// ── 3. Nothing above the header, nothing under the nav ───────────────────────

describe('chrome edges — content is clipped, not merely padded', () => {
  it('has no NAV_PEEK constant left, and no peek for it to describe', () => {
    // 2026-07-26 shaved Radius.lg off the clearance so a card edge showed in the bar's corner
    // notches. Reversed 2026-08-10, restored the same day, reversed again 2026-08-18 ("only the
    // backdrop" behind the chrome), and asked for once more on 2026-08-20 ("the corners should
    // show content behind it"). The peek is BACK — but the fixed-px-shave MECHANISM has never
    // been the thing that came back, in any of those five turns: the window geometry decides it,
    // so there is still no `NAV_PEEK` name anywhere to reintroduce.
    expect(code('components/BottomNav.tsx')).not.toMatch(/NAV_PEEK/);
    expect(code('components/ScreenScaffold.tsx')).not.toMatch(/NAV_PEEK/);
  });

  it('clips only the band BELOW the nav card, so a card can pass behind the bar', () => {
    // 2026-08-20, restoring the 2026-08-11 split: `marginBottom` is the band under the bar,
    // `paddingBottom` is the bar's own card height. The 2026-08-18 pass summed them into the
    // margin so nothing could travel behind the glass — right while the bar was frosted, and
    // moot now that it is opaque (`Surface`'s `overlapsCards` covers `nav`). Maintainer:
    // *"both header card and bottom nav should only have rounded corners. And yes, the corners
    // should show content behind it"* — which cannot happen unless content gets behind the bar.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).toMatch(/marginBottom: pagerFloatingNav \? bottomInset \+ NAV_FLOAT_GAP : 0,/);
    // The other half is the RESTING clearance, and it is padding, never a second margin — one
    // clearance each, never both, is the one rule that has survived every one of these passes.
    expect(source).toMatch(
      /paddingBottom: reserveBottomNav \? BOTTOM_NAV_HEIGHT \+ CHROME_REST_GAP : 0,/,
    );
    // And still never spelled as the whole clearance constant, which is only the
    // DebugGeneralNoteButton's offset from the screen edge.
    expect(source).not.toMatch(/(margin|padding)Bottom: bottomNavClearance/);
  });

  it('starts the clip at the header card\'s TOP edge — i.e. adds no marginTop at all', () => {
    // Same restoration, top end. The box already begins at `topInset`, which is exactly where
    // the header card's top edge is (`headerFloatTop` is 0), so the window runs the header's
    // full height and a card travels behind it — hidden by the opaque fill everywhere except
    // the two bottom-corner notches, which is the peek that was asked for.
    //   The resting clearance is `contentPad.paddingTop`, and `stickyBelowHeaderHeight` belongs
    // in THAT: a screen's sticky tab row is chrome too, and the first card has to clear it.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).not.toMatch(/marginTop: contentTopClear/);
    expect(source).toMatch(
      /paddingTop:\s*contentTopClear \+\s*CHROME_REST_GAP \+\s*\(stickyBelowHeader \? stickyBelowHeaderHeight \+ stickyGap : 0\),/,
    );
  });

  it('clips the scroll viewport, and rests content one CHROME_REST_GAP off the chrome at BOTH ends', () => {
    const source = code('components/ScreenScaffold.tsx');
    // `overflow: hidden` is the mechanism; without it the margins are just a differently-spelled
    // padding and every strip leaks again.
    expect(source).toMatch(/viewport:\s*\{[^}]*overflow:\s*'hidden'/s);
    expect(source).toMatch(/const viewportInset = \{/);
    // `contentPad` reaches BOTH branches — the ScrollView's contentContainer and the
    // non-scrollable (FlatList) wrapper.
    expect(source).toMatch(/contentContainerStyle=\{\[styles\.contentContainer, contentPad\]\}/);
    expect(source).toMatch(/\[styles\.scrollView, viewportBleed, contentPad\]/);
    // `headerFloatBottom` stays 0 — the header's FOOTPRINT still ends where its card ends, which
    // is what keeps the clip window and the resting clearance derived from one number.
    expect(source).toMatch(/const headerFloatBottom = 0;/);
    // ⚠️ **The resting gap is spent on `contentPad` and NOWHERE else (2026-08-27, round 20).**
    // 2026-08-19's "flush at rest too" and 2026-08-20's "no gaps" were about the strip a card is
    // sliced across while scrolling and about the corner-notch lens — both `viewportInset`. Put
    // the gap there instead and you re-create exactly what those rulings deleted, while the
    // resting gap the round 20 mockup asks for still would not appear.
    expect(source).not.toMatch(/marginTop: CHROME_REST_GAP|marginBottom:[^,]*CHROME_REST_GAP/);
    expect(source).toMatch(/const viewportBleed = \{ marginHorizontal: -headerFloatH \};/);
  });

  it('insets the header, the nav and the content by ONE shared number', () => {
    // The bug this pins is a drift, not a value. `ScreenScaffold` spelled `Spacing.sm` and
    // `app/(tabs)/_layout.tsx` spelled `NAV_FLOAT_GAP` — both 8, which made the header and the
    // bar agree with each other and disagree with every content card, which pads `Spacing.md`.
    // The 2026-07-24 note that set it only ever asked those two to match *each other*; the third
    // card on screen was never in the comparison. So assert the two chrome sites read the SAME
    // constant, and that it is the one the screens pad by.
    expect(code('components/ScreenScaffold.tsx')).toMatch(
      /const headerFloatH = floatChrome \? CHROME_FLOAT_INSET : 0;/,
    );
    expect(code('app/(tabs)/_layout.tsx')).toMatch(/paddingHorizontal: CHROME_FLOAT_INSET,/);
    // ...and the vertical float is deliberately NOT the same question. If a later pass changes
    // the side inset, the band under the bar must not follow it.
    expect(code('app/(tabs)/_layout.tsx')).toMatch(/paddingBottom: insetsBottom \+ NAV_FLOAT_GAP,/);
    const theme = code('constants/theme.ts');
    expect(theme).toMatch(/export const CHROME_FLOAT_INSET = Spacing\.md;/);
    expect(theme).toMatch(/export const SCREEN_GAP = Spacing\.md;/);
  });

  it('rests the same gap at the top and the bottom', () => {
    // The round 20 mockup drew 12px above the first card and 28px below the last, because its
    // 96px bottom padding overshot a 54px nav in a 14px inset. Nobody chose that asymmetry — it
    // fell out of two numbers written at different times, which is the failure mode a single
    // named constant at both ends exists to prevent. Assert the constant reaches both.
    const source = code('components/ScreenScaffold.tsx');
    const pad = source.slice(source.indexOf('const contentPad = {'));
    const body = pad.slice(0, pad.indexOf('};'));
    expect(body.match(/CHROME_REST_GAP/g)).toHaveLength(2);
  });

  it('keeps the header card mounted at every scroll offset', () => {
    // 2026-08-20, maintainer: *"Make top header card always visible"*. From 2026-08-16 the
    // scaffold derived a `scrolled` boolean and ScreenHeader mounted its backdrop only past a
    // few px — so a screenshot at the top of any screen showed a title floating on bare
    // backdrop. Both halves are gone; a header that is only sometimes a card is the report.
    expect(code('components/ScreenScaffold.tsx')).not.toMatch(/headerScrolled|HEADER_SCROLL_THRESHOLD/);
    const header = code('components/ScreenHeader.tsx');
    expect(header).not.toMatch(/scrolled\?:/);
    // ...and the fill is opaque, with no BlurView: content passes behind this row now, and frost
    // would make the app's own cards legible through the title (the 2026-08-18 card-menu lesson).
    expect(header).toMatch(/backgroundColor: theme\.surfaceRaised/);
    expect(header).not.toMatch(/BlurView/);
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

  it('takes the chrome\'s side margins, and follows the two corner pairs it MEETS', () => {
    // The margins close the 8px gutters beside the header/bar, where no chrome covers content.
    expect(source).toMatch(/marginHorizontal: headerFloatH/);
    // **Sixth flip, and back to the 2026-08-11 answer (2026-08-20).** Five of the six followed
    // the WINDOW moving; this one follows the window moving BACK, because the chrome went opaque
    // instead. The window is the chrome's OUTER footprint again, so the corners it lands on are
    // the header's TOP pair and the bar's BOTTOM pair — the two places the card curves away from
    // the screen's own corner with nothing behind it, where a square window would show content
    // OUTSIDE the card. The header's bottom pair and the bar's top pair are deliberately absent:
    // they sit mid-viewport, and a card filling them as it scrolls past is the corner peek.
    expect(source).toMatch(
      /\.\.\.\(floatChrome \? \{ borderTopLeftRadius: Radius\.lg, borderTopRightRadius: Radius\.lg \} : null\)/,
    );
    expect(source).toMatch(/borderBottomLeftRadius: Radius\.lg, borderBottomRightRadius: Radius\.lg/);
  });

  it('rounds every corner of both chrome cards, squaring only the chrome-to-chrome seam', () => {
    // Maintainer, 2026-08-20: *"both header card and bottom nav should only have rounded corners.
    // And yes, the corners should show content behind it, no gaps like has been before."* This
    // reverses the 2026-08-19 seam pass across three files at once. The rule that replaced it:
    // an edge is squared only where it meets ANOTHER CHROME CARD (the header ↔ sticky tab bar
    // seam, which is what makes the two read as one card); every edge that faces content is
    // rounded, because content is no longer cut there — it passes behind and fills the notch.
    expect(source).not.toMatch(/chromeFacingSquare/);
    expect(source).toMatch(/floatChrome && \{ borderRadius: Radius\.lg \}/);
    expect(source).toMatch(
      /headerAttachedBelow && \{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 \}/,
    );

    // The bar at the other end: one radius, all four corners.
    const bar = code('components/BottomNav.tsx').match(/bar: \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(bar).toMatch(/borderRadius: Radius\.lg/);
    expect(bar).not.toMatch(/borderTopLeftRadius: 0/);

    // ...and a sticky tab bar keeps its top pair square (it abuts the header) while its bottom
    // pair — the edge facing content — goes back to the caller's own radius.
    expect(code('components/TabSlider.tsx')).toMatch(
      /attachedTop && \{ borderTopLeftRadius: 0, borderTopRightRadius: 0 \}/,
    );
  });

  it('keeps both chrome cards OPAQUE, which is what makes the peek legible', () => {
    // The peek and the 2026-08-18 "only the backdrop" ruling are compatible in exactly one
    // configuration: content travels behind the chrome, and the chrome hides it. A frosted
    // header over a moving card is that card read through the title — the same defect the card
    // menu was reported for. So the nav bar joins `overlay` in `Surface`'s opaque set, and the
    // header (which doesn't route through Surface) paints its own `surfaceRaised` fill.
    expect(code('components/Surface.tsx')).toMatch(
      /const overlapsCards = surfaceContext === 'overlay' \|\| surfaceContext === 'nav';/,
    );
    expect(code('components/ScreenHeader.tsx')).toMatch(/backgroundColor: theme\.surfaceRaised/);
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

// ── 5. A field's halo is the field's shape ───────────────────────────────────

describe('getFieldGlow — the light and the corner are one decision', () => {
  const theme = code('constants/theme.ts');

  // 2026-08-19, user report: *"The glow is squared, but the text-boxes inside are rounded. Do not
  // just make them the same shape, link them/merge them so it works universally."*
  //   A `boxShadow` is cut to the border-box of the view it is set on, so a halo is round only if
  // that exact view is round. Two of the three composers set the glow ON the input, which carries
  // a radius, and were right by luck; `PadTypeRow` hangs it on a wrapper View (Android renders a
  // boxShadow on a TextInput unreliably, and that field needs the wrapper for its absolutely
  // positioned submit arrow) whose style was `{ flex: 1, minWidth: 0, justifyContent: 'center' }`
  // — no radius, hence a square halo around every Home card's rounded well.
  //   The fix is not "add the radius there too", which is a fourth copy of `Radius.sm` free to
  // drift. It is that the helper returns BOTH, so a caller cannot take the light without the
  // shape it is cast from, wherever it hangs it.
  it('returns the radius together with the shadow', () => {
    expect(theme).toMatch(/export const FIELD_RADIUS = Radius\.sm;/);
    expect(theme).toMatch(
      /export function getFieldGlow\([\s\S]*?borderRadius: FIELD_RADIUS \* radiusScale,[\s\S]*?\.\.\.getGlow\(color, level, FIELD_GLOW_RADIUS\[level\]\),/,
    );
  });

  // 2026-08-21, screenshotted on Health's "Logg noe" composer: getGlow's button-tuned bloom
  // (15/22, blooming to 27/40px with the outer pass) has nowhere to go once it's inside a
  // field — a field is always mounted inside a card, and a card's Surface clips its content at
  // `Spacing.md` (16px) padding. A halo that wide hit that clip line before it had faded, so
  // what should have read as a soft light instead read as a hard-edged rectangle. The field's
  // own radii stay well under that 16px on both rungs, so the tail fades out before the mask
  // ever has to cut it.
  // 2026-08-21, screenshotted on Health's "Logg noe" composer: getGlow's button-tuned bloom
  // (15/22, blooming to 27/40px with the outer pass) has nowhere to go once it's inside a field.
  //
  // ⚠️ **That cut sized the bloom against 16px of card padding that a composer never sits
  // inside** (2026-08-24, user report: *"Neon in/around text boxes are visually bugged,
  // again."*). What clips a field is the card BODY's fold — `components/Card.tsx` draws it with
  // a `Collapsible`, i.e. `overflow: 'hidden'` — which is INSIDE that padding, and a composer is
  // a full-width child of it. Measured with `npm run halos`: **31 of 36 haloed fields in the app
  // had zero room**, so the left and right halves of every composer's light were sliced off flat
  // at the field's own edges. The one that looked right (the Today card's) was the one with a
  // padded wrapper of its own.
  //
  // So the number has to be paired with a clearance that actually exists, and the clearance has
  // to be spent by the component that owns the field — the same shape of fix as `getFieldGlow`
  // returning the radius with the light: a caller cannot mount the field without the room its
  // glow fades into.
  it('sizes the bloom to fade inside the clearance a field reserves for itself', () => {
    expect(theme).toMatch(/const FIELD_GLOW_RADIUS = \{ soft: 3, strong: 4 \};/);
    expect(theme).toMatch(/export const FIELD_GLOW_CLEARANCE = Spacing\.sm;/);
    const CLEARANCE = 8; // Spacing.sm
    for (const [level, radius] of [['soft', 3], ['strong', 4]] as const) {
      // getGlow's outer pass is 1.8x the inner one, and it is the one that reaches furthest.
      expect({ level, outer: Math.round(radius * 1.8) < CLEARANCE }).toEqual({ level, outer: true });
    }
  });

  // The clearance is only real if the components that draw a field spend it. A source scan
  // cannot see a clip — `npm run halos` measures that on the real app — but it can see a
  // composer that stopped reserving room, which is how this regressed the first time.
  it('is reserved by every component that mounts a haloed field flush inside a card', () => {
    for (const file of [
      'components/PadTypeRow.tsx',   // both layouts: the pad's type line
      'components/AddRow.tsx',       // both states: the collapsed "+" bar glows too
      'components/CatalogueTab.tsx', // the search field, one box wide as the list under it
      'components/MedicineSurface.tsx', // the four tray wells
    ]) {
      const s = code(file);
      expect({ file, reserves: /FIELD_GLOW_CLEARANCE/.test(s) }).toEqual({ file, reserves: true });
    }
    // ...and it is spent on the OUTERMOST view only. PadTypeRow's panel layout draws
    // `styles.row` again as its inner line, so putting the clearance in that shared style
    // would pay it twice there and push the field off its own centre.
    expect(code('components/PadTypeRow.tsx')).toMatch(/glowClearance: \{ padding: FIELD_GLOW_CLEARANCE \},/);
    expect(code('components/PadTypeRow.tsx')).not.toMatch(/row: \{[^}]*FIELD_GLOW_CLEARANCE/s);
    // An edge-specific padding beats the shorthand in Yoga whatever the key order, so a
    // `paddingBottom` left on the panel column silently wins over the clearance — which is
    // exactly how the bottom of the halo stayed clipped after the sides were fixed.
    expect(code('components/PadTypeRow.tsx')).toMatch(/column: \{ gap: Spacing\.xs \},/);
  });

  it('is what every field-shaped surface draws its halo with', () => {
    for (const file of ['components/PadTypeRow.tsx', 'components/AddRow.tsx', 'components/FormControls.tsx']) {
      const s = code(file);
      expect({ file, glows: /getFieldGlow\(/.test(s) }).toEqual({ file, glows: true });
    }
    // ...and none of them reaches past it to the raw halo for a FIELD. `FormControls` still calls
    // `getGlow` directly for two non-field surfaces (the checkbox box, the Switch track), both of
    // which set their own radius on the same view — the rule is about the field/halo PAIR, not a
    // ban on the primitive.
    expect(code('components/PadTypeRow.tsx')).not.toMatch(/getGlow\(/);
    expect(code('components/AddRow.tsx')).not.toMatch(/getGlow\(/);
  });

  it('leaves no second copy of the field radius at a call site', () => {
    // The whole point of merging them: one number, one place. A `borderRadius: Radius.sm` back on
    // one of these fields is the drift this replaced — the halo would keep following the helper
    // while the box followed the literal.
    expect(code('components/PadTypeRow.tsx')).toMatch(/borderRadius: FIELD_RADIUS,/);
    expect(code('components/FormControls.tsx')).toMatch(/borderRadius: FIELD_RADIUS \* shape\.radiusScale,/);
    // AddRow's input takes its radius from the helper's spread alone — it has no style of its own
    // to restate it in.
    expect(code('components/AddRow.tsx')).not.toMatch(/borderRadius: Radius\.sm/);
  });

  // 2026-08-21, user report + screenshot of the To-do tab: *"Text-boxes have still not been
  // fixed. Even with 2 or 3 tries."* The two composers one card apart were two different
  // controls — "I dag" drew the recessed, haloed well every field in the app draws, while
  // "Når som helst" drew a 1.5px outlined pill at `Radius.md`, sitting inside a wrapper card
  // with a 4px accent bar down its left edge. Three edges around one control, and a shape that
  // changed the moment you tapped it. Both halves are asserted, because either one alone still
  // reads as "the text boxes are wrong".
  // ⚠️ Amended 2026-08-26 by the glow-budget pass (phase 2 of the card surface reset): text,
  // borders and backgrounds never glow, and a field is lit only WHILE FOCUSED. The bar's resting
  // halo was the loudest thing in the app — up to nine lit wells on a five-card screen, while the
  // tasks themselves carried none. The rule this test exists for is unchanged and is what is
  // still asserted: the collapsed bar and the field it becomes are ONE control, so neither may
  // glow at rest. `lib/__tests__/glowBudget.test.ts` owns the budget itself.
  it('draws the collapsed "+" bar as the same well as the expanded field', () => {
    const s = code('components/AddRow.tsx');
    // No halo at rest, on the bar or on the input — the two agree, on the new budget.
    expect(s).not.toMatch(/styles\.addBar,\s*\n\s*getFieldGlow\(/);
    expect(s).not.toMatch(/getFieldGlow\(fill, 'soft'\)/);
    // The well, and no resting stroke — the same pair the input below it applies.
    expect(s).toMatch(/\{ backgroundColor: recess\.paint, borderColor: 'transparent' \}/);
    // No outlined-pill leftovers: the bar takes the field's border weight and the helper's
    // radius, so it cannot be a different shape from the thing it becomes.
    const addBar = s.slice(s.indexOf('  addBar: {'), s.indexOf('  addBarChip: {'));
    expect(addBar).toMatch(/borderWidth: BORDER_WIDTH\.field,/);
    expect(addBar).not.toMatch(/borderRadius/);
    expect(addBar).toMatch(/minHeight: MIN_TAP_TARGET,/);
  });

  it('mounts a composer with nothing drawn around it', () => {
    // A wrapper that paints a fill, an edge or an accent rail re-creates the box-inside-a-card
    // the 2026-08-18 blueprint pass deleted, and puts a second (and third) shape around a
    // control that already draws its own. The slot may carry spacing and nothing else.
    const s = code('components/TodoSurface.tsx');
    expect(s).toMatch(/addRowSlot: \{ marginTop: Spacing\.sm \},/);
    expect(s).not.toMatch(/addRowCard/);
    expect(s).not.toMatch(/borderLeftWidth/);
  });
});

// ── 6. The backdrop is the bottom layer, and it is orbs ──────────────────────

describe('the backdrop — under everything, and out of the middle', () => {
  // 2026-08-17, maintainer: *"The current blue line-art background is causing severe visual
  // interference. It is rendering ON TOP of the bottom navigation and text… Delete the sharp,
  // chaotic vine/line art… place 2 or 3 large, absolutely positioned circles in the background
  // corners… drop their opacity to 10-15%."*
  //   Every property below is invisible to `tsc` (they are style values and SVG geometry), to a
  // unit test that renders nothing, and largely to a screenshot — a z-order bug shows up only on
  // the platform whose sorting rule you happened not to be looking at, and "does an orb reach the
  // middle of the screen" is arithmetic nobody eyeballs correctly. Hence a source scan.

  const LAYERS = [
    'components/ScreenBackground.tsx',
    'components/HomeHeroBackground.tsx',
    'components/ParticleBackground.tsx',
  ];

  it('pins every backdrop layer under the chrome', () => {
    // The old contract was "be the first child and hope" — but each of these mounts beside
    // siblings that declare a z (ScreenScaffold's header/sticky/bottom blocks at 99-100, the
    // pager layout's nav overlay at 100), and the moment any sibling declares one, Android sorts
    // the whole group rather than drawing it in document order. Saying -1 out loud is what makes
    // "the background drew over the nav" unreachable rather than merely unlikely.
    for (const file of LAYERS) {
      const s = code(file);
      expect({ file, pinned: /zIndex: -1/.test(s) }).toEqual({ file, pinned: true });
    }
    // ...and the GROUP wrapper too, since a child's z only orders it among its own siblings —
    // three pinned children inside an unpinned parent are still an unpinned parent.
    expect(code('app/(tabs)/_layout.tsx')).toMatch(/bgLayer:\s*\{[^}]*zIndex: -1/);
  });

  it('draws no line art', () => {
    const s = code('components/ScreenBackground.tsx');
    // The vines and leaves are DELETED, not unmounted, so nothing can be quietly rewired back.
    // A `<Path>` or a `stroke` in this file is the whole family returning.
    expect(s).not.toMatch(/<Path/);
    expect(s).not.toMatch(/stroke=/);
    expect(s).not.toMatch(/BRANCHES|GROWTH_STROKES|GROWTH_LEAVES|leafD/);
  });

  it('is two or three orbs at the brief\'s opacity, in both themes', () => {
    const s = code('components/ScreenBackground.tsx');
    const orbs = [...s.matchAll(/\{\s*cx:\s*(-?[\d.]+),\s*cy:\s*(-?[\d.]+),\s*r:\s*([\d.]+),\s*tone:/g)];
    // "2 or 3" is a cap, not a starting point: a fourth circle appearing at a growth tier would
    // read as a new element rather than as the same field growing.
    expect(orbs.length).toBeGreaterThanOrEqual(2);
    expect(orbs.length).toBeLessThanOrEqual(3);

    const peaks = [...s.matchAll(/orbOpacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(peaks).toHaveLength(2); // one per theme, and neither may be forgotten
    for (const peak of peaks) {
      expect(peak).toBeGreaterThanOrEqual(0.1);
      expect(peak).toBeLessThanOrEqual(0.15);
    }
  });

  it('leaves the middle of the canvas at a true zero, at every growth level', () => {
    // **This is the assertion `__tests__/glassMaterial.test.ts` leans on.** That file measures
    // every glass token against a `#000000` dark ground, which is only honest while nothing
    // lights the pixels a card sits on. Both of the full-canvas radial glows are held at opacity
    // 0 for exactly that reason; the orbs are allowed a lift only because they are anchored at or
    // outside a corner and reach zero before the middle. Move one inward and the composite
    // assertions over there keep passing while measuring a colour the app no longer draws — the
    // shape of the PR #540 bug, which is why the geometry is checked here rather than described
    // in a comment there.
    const s = code('components/ScreenBackground.tsx');
    const step = Number(s.match(/const ORB_GROWTH_STEP = ([\d.]+);/)![1]);
    // The widest an orb ever gets: the top growth tier lib/growth.ts can report.
    const grow = step * (GROWTH_LEVELS.length - 1);

    const orbs = [...s.matchAll(/\{\s*cx:\s*(-?[\d.]+),\s*cy:\s*(-?[\d.]+),\s*r:\s*([\d.]+),\s*tone:/g)];
    expect(orbs.length).toBeGreaterThan(0); // a parse that silently matched nothing proves nothing
    // The viewBox this file declares, and its centre — where cards and text live.
    const [, vw, vh] = code('components/ScreenBackground.tsx').match(/viewBox="0 0 (\d+) (\d+)"/)!;
    const mid = { x: Number(vw) / 2, y: Number(vh) / 2 };

    for (const [, cx, cy, r] of orbs) {
      const dist = Math.hypot(Number(cx) - mid.x, Number(cy) - mid.y);
      expect({ cx, cy, reachesMiddle: dist <= Number(r) + grow }).toEqual({ cx, cy, reachesMiddle: false });
    }
  });

  it('draws the screen-hue copy on the SAME discs, never new ones', () => {
    // ⚠️ **The card surface has NO contrast headroom, and that is why this is checked rather
    // than trusted** (measured 2026-08-27, round 20). `surfaceGlass` over `#000000` composites
    // to `#242424`, which measures **L 0.0176** — against a ceiling of **0.0178** for Notes
    // (`#B660FF`, the ladder's bottom rung) to clear AA 4.5:1 on it. A ground of grey **1** is
    // already enough to push the composite over. So the safety of every chromatic token rests
    // entirely on nothing lighting the pixels a card sits on: not on the wash being DIM, which
    // is what round 20's brief and this repo's own first reading of it both assumed, but on the
    // GEOMETRY. A per-tab hue is therefore free — and a per-tab hue on a new, more central disc
    // would not be, at any opacity.
    const s = code('components/ScreenBackground.tsx');
    // The hue field indexes into ORBS rather than declaring geometry of its own. Anything else
    // (a literal cx/cy/r, a second array) is a disc this file's centre check never sees.
    expect(s).toMatch(/const SCREEN_HUE_ORB_INDEXES = \[[\d,\s]+\] as const;/);
    expect(s).toMatch(/SCREEN_HUE_ORB_INDEXES\.map\(\(i\) => \(/);
    expect(s).toMatch(/cx=\{ORBS\[i\]\.cx\} cy=\{ORBS\[i\]\.cy\} r=\{ORBS\[i\]\.r \+ grow\}/);
    // Every index it names must exist in ORBS.
    const orbCount = [...s.matchAll(/\{\s*cx:\s*-?[\d.]+,\s*cy:\s*-?[\d.]+,\s*r:\s*[\d.]+,\s*tone:/g)].length;
    const idx = s.match(/const SCREEN_HUE_ORB_INDEXES = \[([\d,\s]+)\]/)![1]
      .split(',').map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n));
    expect(idx.length).toBeGreaterThan(0);
    for (const i of idx) expect(i).toBeLessThan(orbCount);
  });
});

describe('an expanded card is an overlay-tier surface — no blur, opaque fill', () => {
  // 2026-08-20, "full-screen card expansion": components/CardExpandHost.tsx's pane sits over
  // the app's own card stack by definition (that IS what it expanded from), so the 2026-08-18
  // rule for anything that overlaps cards applies — same reasoning components/CardMenuSheet.tsx
  // and every other `overlay`-tier Surface already follow (see this file's earlier
  // `surfaceContext` assertions and __tests__/glassMaterial.test.ts).
  it("passes surfaceContext=\"overlay\" to its Surface, never the ambient default", () => {
    const source = code('components/CardExpandHost.tsx');
    expect(source).toMatch(/surfaceContext="overlay"/);
  });

  it('mounts no BlurView of its own', () => {
    // Surface itself decides whether `overlay` gets a BlurView (it does, via `nav`/`overlay`'s
    // shared branch) — the guarantee this file owns is that CardExpandHost doesn't ALSO import
    // expo-blur directly, the same discipline components/AppModal.tsx's header states for its
    // own overlay Surface.
    const source = code('components/CardExpandHost.tsx');
    expect(source).not.toMatch(/expo-blur|BlurView/);
  });

  it('animates rect + radius with Duration.cardExpand/cardExpandOut, never a raw literal', () => {
    // ⚠️ These were `Duration.card`/`cardOut` (220/200) until 2026-08-19. The rule this test
    // owns is DESIGN_RULES.md 21 — the timing goes through a named token, never a millisecond
    // literal — and the token NAMES were only ever incidental to it; they moved because this
    // one animation travels the whole viewport, which ANIMATION_GUIDELINES.md §1 files under
    // "hero transitions: modals, screen navigation, full panels" at 300-400ms rather than the
    // 200-300ms "expanding cards" band `card` is named for. At 220 the growth was over before
    // the eye could follow the pane's edges, which read as a cut to a new screen rather than as
    // the card getting bigger — the whole point of the mechanism. So the assertion is now BOTH
    // halves stated separately: the enter/exit pair by name, and the absence of a literal, so
    // that a future retune has to come here and say what it is trading.
    const source = code('components/CardExpandHost.tsx');
    expect(source).toMatch(/Duration\.cardExpand\b/);
    expect(source).toMatch(/Duration\.cardExpandOut\b/);
    // No `duration: 320`-style literal anywhere in the file, whatever the token set becomes.
    expect(source).not.toMatch(/duration:\s*\d/);
  });

  it('does not render BottomNav — an expanded card covers it, it does not sit above it', () => {
    const source = code('components/CardExpandHost.tsx');
    expect(source).not.toMatch(/BottomNav|PagerFloatingNav/);
  });
});
