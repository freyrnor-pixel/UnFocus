/**
 * NarratorQuote.tsx — what an empty list says instead of naming its own emptiness (2026-08-19).
 *
 * `Ingen oppgaver` / `Tom liste` states a fact the user can already see, and on a bad day it
 * reads as a verdict on the day rather than a description of a list. This replaces every one
 * of those with a line from the app's narrator — a short, dry, first-person aside that admits
 * something rather than asking for something. The words live in lib/narratorQuotes.ts; this
 * file owns only how they are shown and how they are cycled.
 *
 * Connections:
 *   Imports → components/PressableScale (the cycle button), constants/theme, constants/motion,
 *             lib/narratorQuotes (the lines + the wrapping index), lib/useAppTheme
 *             (useAppTheme, useAccessibility for `reducedMotion`, useScaledStyles), lib/i18n
 *             (useT for the button's a11y label, and the active language), lib/haptics,
 *             react-native-reanimated, @expo/vector-icons
 *   Used by → app/(tabs)/plans.tsx (`DoneSplitList`'s empty branch — Today/This week/Whenever/
 *             a day group — and the Recurring section's own),
 *             app/(tabs)/shopping.tsx (an unlocked monthly list with nothing in it),
 *             app/(tabs)/health.tsx (a week with no entries),
 *             app/(tabs)/habits.tsx (a day with no habits due)
 *
 *             **Where it is deliberately NOT mounted**, so the gaps read as decisions:
 *             a search that matched nothing (shopping's `filteredCatalogItems`,
 *             `monthlyPreviewEmpty`) — the honest answer there is that the filter is too
 *             narrow, and a joke in its place hides a real state; an empty state that is
 *             itself a BUTTON (components/WeekListCard.tsx's locked+empty row, shopping's
 *             locked monthly row) — both were made tappable on 2026-08-11 precisely because
 *             the copy pointed at a control that wasn't rendered, and replacing the copy takes
 *             the only way out of that state with it; and a line that teaches what a list will
 *             CONTAIN (components/HealthIssuesPreviewList.tsx), which is information the user
 *             cannot get anywhere else on that surface.
 *   Data    → none. Presentation only — it reads the language and nothing else.
 *
 * Edit notes:
 *   - **⚠️ NO CONTAINER, and this is the instruction, not a default.** Maintainer: *"Do NOT
 *     wrap the quote in a card, box, background container, or border. It must sit directly on
 *     the card surface."* So: no `Surface`, no `backgroundColor`, no `borderWidth`, no radius,
 *     no padding of its own beyond the row's own breathing room. It is a line of text and a
 *     glyph sitting on whatever card already exists. Pinned by
 *     lib/__tests__/narratorQuotes.test.ts, because a later "tidy up the empty state" pass
 *     re-boxing it is exactly the kind of change that looks like an improvement in isolation.
 *   - **⚠️ It is ITALIC, and it is the app's ONE italic.** The 2026-08-18 blueprint pass
 *     deleted `fontStyle: 'italic'` from all 14 files that carried it (*"Remove all italicized
 *     text"*). This is a narrow, instructed exception the day after: *"Style as muted,
 *     translucent italic text… so it looks like a subtle note rather than primary UI."* The
 *     reasoning that made the ban right is what makes the exception right — italic was banned
 *     as a way of marking *teaching copy* as an aside beside real content, and there is no real
 *     content here; this IS the empty slot, and the slant is what stops it reading as a row.
 *     **Do not extend it to anything else**, and don't "finish the 2026-08-18 pass" by removing
 *     it. The test asserts the exception is exactly one file wide.
 *     ⚠️ **It is `Fonts.italic` — a real FACE — and NOT `fontStyle: 'italic'`.** RN does not map
 *     that style onto a named custom family, so the property beside `Fonts.regular` is
 *     synthesised on web and iOS and does **nothing at all on Android**. Every harness this repo
 *     can run — the web preview, `npm run wraps`, every screenshot in `review-bundle/`, `tsc` —
 *     would have shown a perfect slant while the shipped Android build rendered upright. That is
 *     why `Nunito_400Regular_Italic` is loaded at the font gate in app/_layout.tsx: one extra
 *     TTF, for one line, which is also why the token is documented as having one caller.
 *   - **Opacity is a real 0.55 on the view, not a lightened colour token.** The brief asks for
 *     "50–60% opacity white", and in dark mode `theme.text` IS `#FFFFFF`, so 0.55 over the card
 *     is literally that. Doing it as opacity rather than as `theme.textMuted` also keeps light
 *     mode honest — the same 55% of that mode's ink, rather than a token tuned for a different
 *     job. It sits BELOW the app's contrast floors on purpose; this is the one text in the app
 *     that is not meant to be read first, and it names nothing the user needs.
 *   - **The cycle is sequential, and the START is random.** A random pick per press repeats
 *     itself roughly a third of the time on a four-line category, which reads as a broken
 *     button. The counter only ever goes up and lib/narratorQuotes' `quoteAt` wraps it, so
 *     "next" can never run out. The random part is the mount index — several empty cards can
 *     be on one screen at once (Home), and all of them opening on the same line looks like the
 *     app has one joke.
 *   - **The swap fades through zero rather than crossfading two lines.** A crossfade needs both
 *     strings laid out at once, and they are different lengths, so the row would grow to the
 *     longer of the two mid-transition and settle back — the "jarring layout shift" this is
 *     supposed to avoid. Out, swap, in; the wrapper carries a `LinearTransition` so the height
 *     change itself is also animated rather than snapping.
 *   - **`runOnJS` around the state update is load-bearing, not ceremony.** A `withTiming`
 *     completion callback is auto-workletized by react-native-worklets with no directive in
 *     the source saying so (see AGENTS.md's Reanimated gotcha), and calling `setIndex` from the
 *     UI thread takes the app down on device while looking perfect in the web preview, where
 *     worklets run on the JS thread. `__tests__/workletSafety.test.ts` is what catches it.
 *   - The button's hit area is `HitSlop.loose` (18px) — comfortably past the brief's "at least
 *     12px", and the token that exists for exactly this case ("lifts a ≥12px glyph to target").
 *     Don't swap it for `HitSlop.base`: this is a 14px glyph, and 10px leaves it under target.
 */
import React, { useCallback, useState } from 'react';
// No plain `Text` — the quote is an `Animated.Text` so the fade can drive its opacity.
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from '@/components/PressableScale';
import { Duration, Ease } from '@/constants/motion';
import { FontSize, Fonts, HitSlop, Spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useT, useLang } from '@/lib/i18n';
import { quoteAt, randomQuoteIndex, type NarratorCategory } from '@/lib/narratorQuotes';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

/**
 * How faint the line is. The brief's band is 50–60%; 0.55 is its middle, and in dark mode —
 * where `theme.text` is pure `#FFFFFF` — it is the literal "55% opacity white" asked for.
 */
const NARRATOR_OPACITY = 0.55;

/**
 * The ceiling on how tall one quote may stand. Three lines is roughly the longest line in
 * lib/narratorQuotes at the largest text size; the clamp exists so a future addition can't
 * quietly turn the empty state into a paragraph, the same job `STARTER_TEXT_LINES` does one
 * card up.
 */
const NARRATOR_LINES = 3;

type Props = {
  /** Which surface is empty. See lib/narratorQuotes' `NarratorCategory`. */
  category: NarratorCategory;
  /** Optional extra layout (a caller's own margin). Never a background, border or radius. */
  style?: View['props']['style'];
};

export default function NarratorQuote({ category, style }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const lang = useLang();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();

  // Lazy initialiser, not a bare call: `randomQuoteIndex()` in the argument position would
  // re-roll on every render and the line would change under the user as the card re-renders
  // for reasons that have nothing to do with them.
  const [index, setIndex] = useState(() => randomQuoteIndex(category, lang));
  const opacity = useSharedValue(1);

  const textStyle = useAnimatedStyle(() => ({ opacity: opacity.value * NARRATOR_OPACITY }));

  // Runs on the JS thread — see the header's `runOnJS` note. Advancing and fading back in are
  // one step so the new line can never be shown at zero opacity if the fade-in is dropped.
  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    opacity.value = withTiming(1, { duration: Duration.control, easing: Ease.enter });
  }, [opacity]);

  function cycle() {
    tap();
    if (reducedMotion) {
      // No fade at all, rather than a zero-duration one: a zero-duration timing still hands
      // the swap to the UI thread and back, which is a round trip for nothing.
      setIndex((i) => i + 1);
      return;
    }
    opacity.value = withTiming(0, { duration: Duration.micro, easing: Ease.exit }, (finished) => {
      if (finished) runOnJS(advance)();
    });
  }

  return (
    // No Surface, no fill, no edge — see the header. The only thing this View does is put the
    // glyph beside the line and let the row reflow when a longer quote arrives.
    <Animated.View
      style={[styles.row, style]}
      layout={reducedMotion ? undefined : LinearTransition.duration(Duration.listMove).easing(Ease.move)}
    >
      <Animated.Text
        style={[styles.quote, textStyle, { color: theme.text }]}
        numberOfLines={NARRATOR_LINES}
      >
        {quoteAt(category, lang, index)}
      </Animated.Text>
      <PressableScale
        onPress={cycle}
        hitSlop={HitSlop.loose}
        accessibilityRole="button"
        accessibilityLabel={t.narrator.nextQuote}
        style={styles.cycle}
      >
        <Ionicons name="refresh" size={14} color={theme.textMuted} />
      </PressableScale>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  // `alignItems: 'flex-start'` so the glyph sits beside the FIRST line of a wrapping quote
  // rather than floating in the middle of a three-line block — the same defect StarterCard's
  // dismiss × had before it was corner-anchored.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  quote: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    lineHeight: 20,
    // The app's one italic — a real FACE, not `fontStyle: 'italic'`, which does nothing on
    // Android beside a named custom family. See the header and constants/theme's `Fonts.italic`
    // before removing or copying it.
    fontFamily: Fonts.italic,
  },
  // Nudged down so a 14px glyph optically centres on the first line's cap height rather than
  // sitting on top of it. No fill and no ring: it is a mark, not a control surface.
  cycle: {
    marginTop: 2,
  },
});
