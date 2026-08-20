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
 *   Imports → constants/theme, lib/narratorQuotes (the lines + the wrapping index),
 *             lib/useAppTheme (useAppTheme, useScaledStyles), lib/i18n (useLang, for the
 *             active language)
 *   Used by → app/plans.tsx (`DoneSplitList`'s empty branch — Today/This week/Whenever/
 *             a day group — and the Recurring section's own),
 *             app/(tabs)/shopping.tsx (an unlocked monthly list with nothing in it),
 *             app/(tabs)/health.tsx (a week with no entries),
 *             app/habits.tsx (a day with no habits due)
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
 *   - **⚠️ There is no way to cycle the line, and that is deliberate (2026-08-20).** It shipped
 *     with a refresh glyph beside it that advanced through the category's lines; the maintainer
 *     removed it in the UI-consistency pass (*"Remove the refresh button for 'Quotes'"*). What
 *     went with it: the `index` state's setter, the `withTiming` fade-through-zero and its
 *     `runOnJS` hop, the `LinearTransition` on the wrapper (nothing changes height any more),
 *     the `reducedMotion` branch, the `tap()` haptic and `t.narrator.nextQuote`. **The random
 *     MOUNT index stays** — several empty cards can be on one screen at once (Me), and all of
 *     them opening on the same line looks like the app has one joke. A caller that wants a
 *     fresh line remounts the component with a new `key`, which is what
 *     components/TodoSurface.tsx's `emptyQuoteKey` already does.
 *   - `lib/narratorQuotes.ts` is UNCHANGED and still holds every line plus the wrapping
 *     `quoteAt`. Nothing about the words was reduced here — only the control.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useLang } from '@/lib/i18n';
import { quoteAt, randomQuoteIndex, type NarratorCategory } from '@/lib/narratorQuotes';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

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
  const lang = useLang();
  const styles = useScaledStyles(baseStyles);

  // Lazy initialiser, not a bare call: `randomQuoteIndex()` in the argument position would
  // re-roll on every render and the line would change under the user as the card re-renders
  // for reasons that have nothing to do with them. Picked ONCE, at mount, and never advanced
  // — see the header's note on the deleted cycle button.
  const [index] = useState(() => randomQuoteIndex(category, lang));

  return (
    // No Surface, no fill, no edge — see the header. The only thing this View does is give the
    // line its own breathing room on whatever card is already there.
    <View style={[styles.row, style]}>
      <Text style={[styles.quote, { color: theme.text }]} numberOfLines={NARRATOR_LINES}>
        {quoteAt(category, lang, index)}
      </Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.sm,
  },
  quote: {
    // The opacity is baked into the style rather than animated: with nothing to cycle there is
    // nothing to fade, and a static 0.55 is the same "55% opacity white" the brief asked for.
    opacity: NARRATOR_OPACITY,
    fontSize: FontSize.sm,
    lineHeight: 20,
    // The app's one italic — a real FACE, not `fontStyle: 'italic'`, which does nothing on
    // Android beside a named custom family. See the header and constants/theme's `Fonts.italic`
    // before removing or copying it.
    fontFamily: Fonts.italic,
  },
});
