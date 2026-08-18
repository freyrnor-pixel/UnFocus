/**
 * TabSlider.tsx — in-screen tab bar: a single accent pill SLIDES to sit behind
 * whichever tab is active, instead of each tab carrying its own independent
 * highlight box (the old `components/TabBoxHighlight.tsx` pattern, retired
 * 2026-07-23 in favour of this).
 *
 * **THE TWO-TIER RULE FOR PICK-ONE CONTROLS (2026-08-09) — read before adding a third.**
 * The app has exactly two, and the tier is carried by the ACTIVE TREATMENT, not by the
 * corner radius:
 *
 *   - **Screen tier — this file.** A SOFT TRANSLUCENT sliding pill in the tab's own colour,
 *     with the label in `theme.text`. At most one per screen: Today/This week/All tasks,
 *     Weekly/Monthly, Settings' three category tabs. It switches what the whole screen is
 *     showing. (It was an accent-FILLED pill + `accentInk` until 2026-08-18 — maintainer:
 *     *"Active Top Tabs should use a soft, translucent pill strictly behind the text/icon."*
 *     The tier is still carried by the ACTIVE TREATMENT rather than by the corner radius; what
 *     changed is that the screen tier is now the hued-wash one and the form tier below is the
 *     raised-white one, which is a bigger difference between them than a fill opacity was.)
 *   - **Form tier — `FormControls`' `SegmentedControl`.** A raised white sliding pill
 *     (`theme.surface` + `theme.text`). Everything nested inside a card, form or editor —
 *     a property of the thing being edited, not of the screen.
 *
 * There used to be a third, `components/SlideSelector.tsx`, deleted in this pass. It was a
 * form-tier control wearing the screen tier's accent fill, so "how often does this repeat"
 * rendered two different ways depending on whether you asked a habit (SegmentedControl) or a
 * task (SlideSelector). Its own header encoded the tier in the RADIUS instead (main → boxed,
 * sub → pill), which is a weaker signal than the fill and had already been flipped once. The
 * reason the fill is the right channel: accent is meant to be scarce (DESIGN_RULES.md rule
 * 15, one focal point per screen) — a task editor was rendering up to five saturated accent
 * pills competing with the screen's one primary action.
 *
 * Unlike `SegmentedControl` (equal-width segments, a pure value picker),
 * this is meant for navigation tab bars: options can carry a per-tab accent
 * colour and an arbitrary `accessory` node (a count badge, a cue dot). Every
 * segment sizes itself to its own label (flexGrow/flexShrink, no fixed/equal
 * width mode) — see the removed `sizing` prop note below for why. The pill's
 * position AND width are driven off each segment's own measured layout
 * (`onLayout`), not analytic math, so a segment's highlight always matches
 * its actual rendered width, whatever that turns out to be.
 *
 * **Never scrollable, by design (2026-07-23)**: there is deliberately no horizontal-scroll
 * mode. A tab bar the user has to drag isn't a natural fit for a small, fixed set of
 * top-level views — if a caller's options don't fit in one non-scrolling row, the fix is
 * the caller's: shorten the labels (see app/settings.tsx's `config.tabs.*` — kept to single
 * short words for exactly this reason) or merge two tabs into one, not add scrolling back.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme (useAppTheme, useAccessibility), lib/haptics,
 *             components/PressableScale, react-native-reanimated
 *   Used by → app/plans.tsx (Today/This week/All tasks), app/(tabs)/shopping.tsx
 *             (Weekly/Monthly), app/settings.tsx (category tabs)
 *   Data    → none (controlled; value/options/onChange from props)
 *
 * Edit notes:
 *   - **No `sizing` prop (removed 2026-07-24)**: this used to offer an 'equal' mode (flex:1,
 *     every segment the same width) alongside 'content' (flexGrow/flexShrink, sized to each
 *     label). 'equal' was a trap — it looked fine for whichever language a screen was built
 *     and eyeballed in, then silently truncated a tab the moment a translation came out
 *     longer (Settings' Norwegian "Generelt" → "Gene…", 2026-07-24, while English's similarly-
 *     short "General" never showed the bug). Fixing that meant manually flipping the prop
 *     per screen, which only holds until the next label edit makes some other screen's tabs
 *     uneven again. Every segment now always sizes to its own content (flexGrow/flexShrink,
 *     still filling the full row width so a short set of tabs reads as one naturally
 *     centered/evenly-spaced group, never left-justified with dead space) — this adapts
 *     automatically to any label/language change, with nothing per-caller to keep in sync.
 *   - `radius`: defaults to Radius.sm (boxed chip look, every caller — Plans/Shopping
 *     included). Settings passes Radius.md instead — purely a visual choice per caller,
 *     doesn't change layout/sizing. **Radius no longer encodes tier** — the fill does (see
 *     the two-tier rule above). Don't reintroduce a pill/boxed convention on top of it.
 *     The StyleSheet's `wrap`/`pill`/`segment`
 *     carry no `borderRadius` of their own because the inline `radius` prop always overrides
 *     it — adding one there is a no-op.
 *   - The pill is the FIRST child of the row so it paints below the segment labels (paint
 *     order = document order) — same convention as `FormControls`' `SegmentedControl`.
 *   - **Pill vertical inset (fixed 2026-07-24)**: `onLayout` measures the INNER `row`, NOT
 *     the outer `wrap`. `wrap` has `borderWidth: 1`, so measuring it made trackH include
 *     the 2px border; pillH = trackH - TRACK_PAD*2 then left the pill ~3px from the top but
 *     only ~1px from the bottom (asymmetric → "crooked / slapped on top"). The `row` has
 *     padding but no border, so its measured height is the pill's own coordinate space:
 *     pillH = rowHeight - TRACK_PAD*2 with `top: TRACK_PAD` yields EQUAL TRACK_PAD gaps top
 *     and bottom. Horizontal is unaffected — segments are still measured relative to `row`
 *     (their own `onLayout`), and the pill's `left`/translateX use those same row-relative x.
 *   - Same haptic contract as `SegmentedControl`: PressableScale's own `tap()` fires on every
 *     press, plus an extra `selection()` when the value actually changes.
 *   - `options[].accessory` is a plain ReactNode the caller builds per-render (e.g. a
 *     count badge or an animated cue) — it doesn't know about `active` state itself, so
 *     the caller must bake `isActive`-dependent styling into the node before passing it.
 *   - **Pill must SNAP on its first positioning, never animate in (fixed 2026-08-05)**: the
 *     active label's text colour was `theme.accentInk`, chosen for contrast against the FILLED
 *     pill, on the assumption the pill is already there. (It is `theme.text` since 2026-08-18,
 *     which reads on the bare track too — so this particular bug can no longer bite. The snap
 *     stays: a pill animating its width in from 0 on mount is wrong regardless of the ink.)
 *     But the pill only exists once the
 *     segment's `onLayout` has fired, and `withTiming` used to animate its width in from 0 even
 *     on that very first positioning — so the active tab's high-contrast text sat over the bare
 *     track, unreadable, for one `Duration.control` on every mount (reported as illegible
 *     "Ukelister" text on Shopping's default-active Weekly tab — that label reads
 *     "Handlelister" since 2026-08-13, but the tab is still the one that's
 *     genuinely on screen at cold launch when it's the configured start screen — the other four
 *     tabs pre-settle off-screen under the pager's `lazy: false`). `hasPositioned` (a ref, not
 *     state — this must never trigger a re-render) tracks whether the pill has been placed at
 *     all; the first placement always snaps instantly regardless of `reducedMotion`, and only
 *     a later tab CHANGE animates. Same seeded-not-animated-in contract as PressableScale's
 *     `sunk` prop.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Fonts, FontSize, OpticalCenter, Radius, rgba, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { selection } from '@/lib/haptics';
import PressableScale from '@/components/PressableScale';
import { Duration, Ease } from '@/constants/motion';

export type TabSliderOption<T extends string | number> = {
  value: T;
  label: string;
  color?: string;
  accessory?: React.ReactNode;
};

type Props<T extends string | number> = {
  options: TabSliderOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Track/pill corner radius. Default Radius.sm (boxed chip look — matches the old
   *  TabBoxHighlight). Pass a different value (e.g. Radius.md) to tweak the squareness. */
  radius?: number;
  /**
   * Square the TOP corners (2026-08-10). Set when the slider is mounted as a screen's
   * `stickyBelowHeader` and therefore sits flush against the header card, which squares its own
   * bottom corners to match — the two then read as one floating card rather than two stacked
   * ones. See components/ScreenScaffold.tsx's `headerAttachedBelow`.
   */
  attachedTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TRACK_PAD = 3;
const TRACK_GAP = 3;
/** Segment height. 34 since 2026-08-10 (was 38) — the maintainer asked for the sticky tab row
 *  to be "slightly vertically slimmer". Deliberately under MIN_TAP_TARGET, which widens
 *  DESIGN_RULES.md open conflict #6 rather than introducing a new exception: `PAD_ROW_HEIGHT`
 *  (38) and Button size `sm` (36) already live there. */
const SEGMENT_HEIGHT = 34;
/**
 * How strongly the active pill carries its tab's colour (2026-08-18).
 *
 * Higher in dark than in light because the wash composites over a near-black ground there and
 * loses most of its strength doing so, where in light it is already sitting on a pale track.
 * Both are tuned so the pill is unmistakably present behind the label and the label itself is
 * read as `theme.text` — full contrast, on every hue a caller can pass, in both modes. Raise
 * either and the label starts competing with its own background; that is the failure the
 * BottomNav plate hit in the 2026-08-16 pass.
 */
const PILL_ALPHA = { light: 0.16, dark: 0.24 };
/**
 * The slider's natural content height — `borderWidth 1 × 2 + TRACK_PAD × 2 + SEGMENT_HEIGHT`.
 *
 * Exported because a caller mounting this as `stickyBelowHeader` must hand ScreenScaffold a
 * `stickyBelowHeaderHeight`, and every surplus px becomes leftover space that the caller's
 * `justifyContent: 'center'` splits top/bottom — making the pill's vertical inset bigger than
 * its horizontal one (the 2026-07-24 bug, when Plans said 56 and Shopping said 60 against a
 * real 46). Five call sites each restated that number by hand; they import this instead now.
 * **Change SEGMENT_HEIGHT and this follows automatically — never hardcode either at a caller.**
 */
export const TAB_SLIDER_HEIGHT = 2 + TRACK_PAD * 2 + SEGMENT_HEIGHT;

export default function TabSlider<T extends string | number>({
  options,
  value,
  onChange,
  radius = Radius.sm,
  attachedTop = false,
  style,
}: Props<T>) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const [trackH, setTrackH] = useState(0);
  const [segLayouts, setSegLayouts] = useState<{ x: number; width: number }[]>([]);

  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const active = segLayouts[activeIndex];

  const tx = useSharedValue(0);
  const pw = useSharedValue(0);
  // Whether the pill has ever been positioned. The active label's text colour (accentInk)
  // assumes it's sitting on the filled pill from the first frame it renders — but `active`
  // only exists after the segment's own onLayout fires, and even then withTiming used to
  // animate the pill's WIDTH in from 0. That left the active tab's high-contrast text
  // floating over the bare (unfilled) track for one full Duration.control on every mount —
  // reliably reproducible, not a rare race, since it happens on every screen open (2026-08-05,
  // reported as illegible text on Shopping's default-active Weekly tab, "Ukelister" as it
  // was then labelled). Fixed the
  // same way PressableScale seeds a mounted-already-sunk control: snap straight to the
  // measured rect on the FIRST positioning, and only animate a pill move after that.
  const hasPositioned = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (reducedMotion || !hasPositioned.current) {
      tx.value = active.x;
      pw.value = active.width;
    } else {
      tx.value = withTiming(active.x, { duration: Duration.control, easing: Ease.enter });
      pw.value = withTiming(active.width, { duration: Duration.control, easing: Ease.enter });
    }
    hasPositioned.current = true;
  // Deliberately depends on active's primitives, not `active` itself, since segLayouts
  // recreates the object every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.x, active?.width, reducedMotion, tx, pw]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    width: pw.value,
  }));

  // Measured on the INNER `row` (not the outer bordered `wrap`) — see the pill-inset
  // note below. The row has padding but NO border, so its height is the pill's own
  // coordinate space; pillH = rowHeight - TRACK_PAD*2 then nests with equal TRACK_PAD
  // gaps top AND bottom.
  const onTrackLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setTrackH((prev) => (prev === h ? prev : h));
  };

  const setSegLayout = useCallback((index: number, x: number, width: number) => {
    setSegLayouts((prev) => {
      const cur = prev[index];
      if (cur && cur.x === x && cur.width === width) return prev;
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  }, []);

  const pillH = Math.max(0, trackH - TRACK_PAD * 2);
  // Concentric corners: the pill is inset from the track by TRACK_PAD on every side, so its
  // corner radius must be the track's radius MINUS that inset — otherwise the pill's rounded
  // corner isn't parallel to the track's, it bulges outward and reads as a rounder "pill
  // inside a box". Same geometry Surface.tsx uses for its inner mask (`innerRadius = radius -
  // EDGE_WIDTH`); the segment touch targets are transparent so they can keep the raw radius.
  const pillRadius = Math.max(0, radius - TRACK_PAD);

  const content = (
    <>
      {active && (
        <Animated.View
          pointerEvents="none"
          // Android only (2026-08-05): a view whose only visual is a Reanimated-driven
          // backgroundColor/width, and nothing else — no children, no static size — is exactly
          // what Android's native-view-flattening optimization targets for removal, and once an
          // ANCESTOR is forced non-flattening (`collapsable={false}`, as components/TourTarget.tsx
          // now does around Shopping's tab row so it can `measureInWindow`), this pill stopped
          // painting on-device even though its computed style was correct — reported as an
          // invisible accent pill behind the active Weekly tab, persisting across tab
          // switches. Reproduces only on native; the web preview renders it correctly (verified —
          // the pill's computed backgroundColor/width/position are all right there in the DOM),
          // which is why this needed a device report to actually pin down. `collapsable={false}`
          // is the standard fix for "a Reanimated view isn't visually updating on Android" —
          // forces this exact node to stay a real native view regardless of its ancestors.
          collapsable={false}
          style={[
            styles.pill,
            // **A soft translucent wash, never a solid fill (2026-08-18)** — maintainer:
            // *"Active Top Tabs should use a soft, translucent pill strictly behind the
            // text/icon."* It was `theme.accent` at full opacity, which is what made the label
            // need `accentInk` and made a row of screen tabs the loudest thing on the screen.
            // The hue still identifies the active tab; it just sits behind the word instead of
            // replacing the ground under it.
            { height: pillH, top: TRACK_PAD, borderRadius: pillRadius, backgroundColor: rgba(options[activeIndex]?.color ?? theme.accent, PILL_ALPHA[isDark ? 'dark' : 'light']) },
            pillStyle,
          ]}
        />
      )}
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        return (
          <PressableScale
            key={String(opt.value)}
            style={[styles.segment, { borderRadius: pillRadius }]}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width } = e.nativeEvent.layout;
              setSegLayout(i, x, width);
            }}
            onPress={() => {
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            scaleTo={0.97}
          >
            {/* Shrinks rather than clipping: a tab bar has a hard width, and a Norwegian label
                ("Handleliste", "Denne uka") overruns where its English twin fits. Truncating a
                control's own name is the one failure the row can't recover from — the same
                reason BottomNav auto-shrinks. `minimumFontScale` floors it at a legible size,
                so a label that still doesn't fit wraps the row instead of vanishing. */}
            {/* Full-contrast ink on the active tab, muted on the rest. It was `accentInk`,
                which only made sense while the pill under it was a solid accent fill — on a
                translucent wash that ink is being read against the screen's own ground, and
                `theme.text` is the only value that holds on every hue in both modes. */}
            <Text
              style={[styles.label, { color: isActive ? theme.text : theme.textMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {opt.label}
            </Text>
            {opt.accessory}
          </PressableScale>
        );
      })}
    </>
  );

  return (
    <View
      style={[
        styles.wrap,
        // **No visible track edge (2026-08-18)** — the bordered box around a row of tabs is
        // exactly the "box-in-a-box" the maintainer ruled out, and on the four screens that
        // mount this as `stickyBelowHeader` it drew a second rectangle immediately under the
        // header card's own. The stroke stays at `transparent` rather than going to width 0:
        // `TAB_SLIDER_HEIGHT` counts those 2px, and every caller reserves that number.
        { backgroundColor: theme.surfaceMuted, borderColor: 'transparent', borderRadius: radius },
        // Attached to the header above: square the top corners and drop the top border, so the
        // seam between the two is a single line rather than two stacked edges of different
        // colours. `paddingTop` gives the px back, keeping the rendered height exactly
        // TAB_SLIDER_HEIGHT — the caller reserves that number, and a surplus/deficit is what
        // knocks the pill's vertical inset out of true (see that constant's doc).
        // ...and the BOTTOM pair keeps its radius (2026-08-20, reversing the one-day 2026-08-19
        // squaring). That edge faces content, and content is no longer clipped against it: the
        // scroll viewport runs the whole chrome's height again, so a card passes behind this bar
        // and fills its bottom-corner notches rather than being cut beside them. Same rule the
        // header card and the bottom nav follow — see ScreenScaffold's `viewportInset`.
        attachedTop && { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
        style,
      ]}
    >
      <View style={styles.row} onLayout={onTrackLayout}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    padding: TRACK_PAD,
    gap: TRACK_GAP,
  },
  // Absolutely-positioned sliding accent fill. Rendered first so it paints beneath the labels.
  // No borderRadius here — the inline `radius` prop (see `pillStyle`'s caller) always wins.
  pill: {
    position: 'absolute',
    left: 0,
  },
  // flexGrow/flexShrink (not flex:1 fixed-equal): each segment sizes to its own label,
  // then shares any leftover/overflow row width — the only mode this component has (see
  // the "No `sizing` prop" edit note above for why a fixed-equal mode was removed).
  segment: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  // OpticalCenter: without it, Android adds font-metric padding below the glyph
  // baseline that flex's alignItems:'center' doesn't know about, so the label
  // optically sits low inside the segment (same bug/fix as ScreenHeader's title —
  // see that component's edit notes).
  label: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
    ...OpticalCenter,
  },
});
