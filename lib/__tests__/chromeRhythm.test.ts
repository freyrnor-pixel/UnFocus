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
 *
 * Precedent for reading source in a test: lib/__tests__/cardLayout.test.ts, and the "(b) Token
 * use" half of lib/__tests__/designTokens.test.ts. Same reasoning as both — the shape tests
 * alone can't see a component quietly opting back out.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

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

  it('splits the bar\'s footprint: the band below it clips, the card itself pads', () => {
    // 2026-08-11. The whole footprint as ONE margin (`marginBottom: bottomNavClearance`) put the
    // clip edge on the bar's NEAR edge: content was cut where the bar starts instead of passing
    // behind it, and the corner notch it is supposed to peek through — a wedge *inside* the bar's
    // rectangle, beside its top-corner arc — sat below that edge, unreachable at any radius.
    // Split in two, each half landing where something opaque actually is.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).toMatch(/marginBottom: pagerFloatingNav \? bottomInset \+ NAV_FLOAT_GAP : 0/);
    expect(source).toMatch(/paddingBottom: reserveBottomNav \? BOTTOM_NAV_HEIGHT : 0/);
    // Neither half may be spelled as the whole clearance again — that constant is now only the
    // DebugGeneralNoteButton's offset from the screen edge.
    expect(source).not.toMatch(/(margin|padding)Bottom: bottomNavClearance/);
  });

  it('starts the clip at the header card\'s own top edge, not below it', () => {
    // `contentTopClear` folds in `headerFloatBottom`, so using it as the viewport's margin put
    // the top clip edge 8px BELOW the header card, in transparent backdrop — a card scrolling
    // past was guillotined mid-glyph with nothing over the cut (the reported bug). The box starts
    // at `topInset` (= the header card's top, since headerFloatTop is 0) and `contentTopClear`
    // is the content's RESTING padding instead.
    const source = code('components/ScreenScaffold.tsx');
    expect(source).not.toMatch(/marginTop: contentTopClear/);
    expect(source).toMatch(/paddingTop: contentTopClear/);
  });

  it('clips the scroll viewport AND pads the content — one clearance each', () => {
    const source = code('components/ScreenScaffold.tsx');
    // `overflow: hidden` is the mechanism; without it the margins are just a differently-spelled
    // padding and every strip leaks again.
    expect(source).toMatch(/viewport:\s*\{[^}]*overflow:\s*'hidden'/s);
    expect(source).toMatch(/const viewportInset = \{/);
    // The resting gap is the content's padding, and it reaches BOTH branches — the ScrollView's
    // contentContainer and the non-scrollable (FlatList) wrapper.
    expect(source).toMatch(/const contentPad = \{/);
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

describe('BottomNav — the pill never disappears', () => {
  const source = code('components/BottomNav.tsx');

  it('gives Home a real slot instead of fading out and unmounting', () => {
    expect(source).not.toMatch(/pillOpacity/);
    expect(source).not.toMatch(/setPillMounted/);
    expect(source).toMatch(/const homeSize = Math\.min\(centreTrack\.w \+ HOME_RING \* 2/);
  });

  it('sizes Home\'s ring from HOME_RING and centres it on the button', () => {
    // 2026-08-11, user report + screenshots. The ring used to ask for `PILL_GROW_X * 2` past
    // the FAB — 72px inside a 72px masked box, i.e. a plate the height of the whole bar — and
    // was then squeezed by `maxPillH` and shoved by `clampTop`. Sizing from the ring outward
    // and centring on the button is what makes it a frame; the cap comes last and is
    // arithmetic (`homeFit`), not a guard.
    expect(source).toMatch(/const homeCentreY = centreTrack\.y \+ centreTrack\.h \/ 2;/);
    expect(source).toMatch(/const homeTop = homeCentreY - homeSize \/ 2;/);
    expect(source).toMatch(/const homeX = centreTrack\.x \+ centreTrack\.w \/ 2 - homeSize \/ 2;/);
    // ...and NOT through the clamp, which can only shove — see the next test.
    expect(source).not.toMatch(/homeTop = clampTop\(/);
  });

  it('no longer rests any tab sunk while selected — the pill alone marks it (2026-08-12)', () => {
    // Reverses the "Pressed = on" side-tab rule the two tests above this one used to pin
    // (maintainer: "Instead of the pressed down look, just have the blue move between when
    // going between screens"). `sunk={active}` is gone from NavTabItem's PressableScale —
    // the sliding pill's colour and position are the only thing that marks the current tab,
    // side tabs and Home alike. See components/BottomNav.tsx's own header for the full account.
    expect(source).not.toMatch(/sunk=\{active\}/);
  });

  it('carries no side-pill travel offset any more — nothing rests sunk to compensate for (2026-08-12)', () => {
    // The `+ Travel.sm` arithmetic existed only to shift the pill down to meet a side tab
    // resting sunk; with `sunk={active}` gone, an unsunk tab needs no such offset (keeping it
    // would frame the icon a few px low). Same reasoning killed Home's `+ Travel.md` a day
    // earlier. Neither should come back without the sunk state they compensated for.
    expect(source).not.toMatch(/\+ Travel\.sm,/);
    expect(source).not.toMatch(/\+ Travel\.md,/);
  });

  // The bar is a Surface, and a Surface clips its children to its rounded mask — so a pill
  // that doesn't fit is drawn SLICED, not overflowing. Home's ring was 72px in a 72px bar (a
  // flattened squircle) and a side pill's bottom corner ran into the bar's own Radius.lg arc.
  it('keeps the pill inside the bar rather than letting the mask slice it', () => {
    // Both slots shrink to fit...
    expect(source).toMatch(/const maxPillH = Math\.max\(0, innerH - PILL_INSET \* 2\)/);
    expect(source).toMatch(/const pillHeight = Math\.min\(/);
    expect(source).toMatch(/const homeSize = Math\.min\(/);
    // ...the side pill's position goes through the clamp rather than straight from its
    // measured track (Home is fitted by construction instead — see above).
    expect(source).toMatch(/const sideTop = clampTop\(/);
    // Against the MEASURED box, never the constant — this bar's padding is useScaledStyles'd,
    // so BOTTOM_NAV_HEIGHT is only true at font scale 1.0.
    expect(source).toMatch(/setInnerH/);
    expect(source).not.toMatch(/innerH = BOTTOM_NAV_HEIGHT/);
  });

  it('measures the box the pill lives in, not the box the Surface paints', () => {
    // 2026-08-11. Surface's outer view is 2 × BORDER_WIDTH.card bigger than the mask that
    // clips its children, so measuring it made every "keep N px off the edge" sum 3px
    // optimistic — which is how Home's ring ended up 1px off that mask. An absoluteFill probe
    // rendered beside the pill shares the pill's containing block by definition, so the two
    // cannot disagree. A `<Surface … onLayout=` here means someone measured the wrong box.
    expect(source).toMatch(/style=\{StyleSheet\.absoluteFill\}/);
    // Bounded to the opening tag ([^>], not [\s\S]) — the probe's own onLayout sits further
    // down the same file and would otherwise match.
    expect(source).not.toMatch(/<Surface[^>]*onLayout=/);
    expect(code('components/Surface.tsx')).not.toMatch(/onLayout/);
  });

  it('clamps the side pill horizontally too, not just vertically', () => {
    // The first clamp pass (above) only closed the vertical axis; the outermost tabs (Shop,
    // Health) sit close enough to the bar's own rounded corners that a pill could still catch
    // the diagonal corner arc horizontally — same failure mode, other axis.
    expect(source).toMatch(/const clampLeft = \(/);
    expect(source).toMatch(/setInnerW/);
    expect(source).toMatch(/return clampLeft\(leftTrack\.x/);
    expect(source).toMatch(/return clampLeft\(rightTrack\.x/);
  });

  it('keeps grey depth off the pill and off the Home button, in either state', () => {
    // A card drop-shadow is a hue-less grey blur. Under the pale accentSoft plate it read as a
    // dirty donut; Shadow.fab's 16px blur smeared across the ring when Home was active, and
    // drew a grey collar around the blue circle when it wasn't (2026-08-11 report). The bar is
    // a Surface and already casts one shadow for the whole cluster.
    expect(source).not.toMatch(/getLayeredShadow/);
    expect(source).not.toMatch(/Shadow\.fab/);
  });
});

// ── 4. The clip window is the chrome's shape ─────────────────────────────────

describe('ScreenScaffold — the clipped viewport matches the floating chrome', () => {
  const source = code('components/ScreenScaffold.tsx');

  it('takes the chrome\'s side margins, and rounds only the OUTER corner pairs', () => {
    // The margins close the 8px gutters beside the header/bar, where no chrome covers content.
    expect(source).toMatch(/marginHorizontal: headerFloatH/);
    // The corner radius is back (2026-08-11) — but it means something different now, which is
    // why this assertion flipped twice. The viewport spans the chrome's OUTER footprint, so its
    // own corners land on the header's TOP pair and the bar's BOTTOM pair: the two pairs where
    // nothing should show. The pairs the maintainer wants a scrolled card in — the bar's top,
    // the header's bottom — are in the MIDDLE of this box and need no treatment at all: "visible
    // in the bottom nav's cut corners at the top, not the two bottom ones — same for the header
    // but the opposite". The 2026-08-10 cut had the box spanning the band BETWEEN the cards
    // instead, so the same radius closed the wanted notches and un-rounding it (the pass after)
    // couldn't open them either — they were outside the box entirely.
    expect(source).toMatch(/borderTopLeftRadius: Radius\.lg/);
    expect(source).toMatch(/borderBottomLeftRadius: Radius\.lg/);
    // The bottom pair only where a bar is actually reserved — on a sub-tier screen that edge is
    // just the safe area, with no chrome card for a corner to line up with.
    expect(source).toMatch(/floatChrome && reserveBottomNav/);
  });

  it('bleeds the scroll box back out so no card is resized by the inset', () => {
    // The 8px this clips off each side is empty backdrop (every screen's content container
    // already pads by Spacing.md). Drop the mirror-image negative margin and every card in
    // the app gets narrower.
    expect(source).toMatch(/const viewportBleed = \{ marginHorizontal: -headerFloatH \}/);
    expect(source.match(/viewportBleed/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
