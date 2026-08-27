/**
 * CardHintLine.tsx — one muted italic line under a card's header, prefixed by a bulb.
 *
 * A card's own short explanation of what it is for, drawn directly under the header rule and
 * above the card's content.
 *
 * ⚠️ **This REVIVES a tier that was deleted on purpose, and the reversal is the maintainer's**
 * (2026-08-27, round 20). `components/CardHintNote.tsx` was deleted on 2026-08-17 — *"A native
 * app should not read like a manual. You are placing way too much text on the screen. Delete all
 * lightbulb (💡) sections entirely."* — along with the 💡 glyph and `fontStyle: 'italic'` from all
 * 14 files that carried it. Round 20's drawn screens put an italic, bulb-prefixed line back on
 * every content card, and the maintainer ruled for the mockup. Read
 * `DESIGN_COMPARISON/20-IMPLEMENTATION.md` before undoing it, and do not undo it piecemeal: the
 * 2026-08-17 pass's real complaint was a TIER of explanatory text — banners, explainer lines and
 * starter copy all on screen at once — so bringing one line back is only safe while the others
 * stay gone.
 *
 * ⚠️ **It draws only on a card that HAS content, and that gate is what keeps it off the empty
 * state.** An empty surface already speaks: `components/StarterCard.tsx`'s one line, or
 * `components/NarratorQuote.tsx`'s aside. Drawing this as well would stack two muted italic
 * lines with nothing between them, which is both ugly and the exact "reads like a manual"
 * failure the deletion was about. The gate lives at the CALL SITE (each card knows what
 * "empty" means for it — `AGENTS.md`'s empty-state note lists five different predicates), not
 * here, so this component takes a string and draws it.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → components/Card.tsx (the `hint` prop — the only mount site)
 *   Data    → none, presentational
 *
 * Edit notes:
 *   - ⚠️ **`Fonts.italic`, never `fontStyle: 'italic'`.** React Native does not synthesise a
 *     style onto a named custom family, so `fontStyle` beside `Fonts.regular` renders upright on
 *     **Android** while every harness in this repo — the web preview, `npm run wraps`, every
 *     screenshot, `tsc` — shows a perfect slant. `components/NarratorQuote.tsx` learned this the
 *     same way and its header says so. `lib/__tests__/narratorQuotes.test.ts` pins both files.
 *   - Two lines maximum. It is a reminder, not the documentation; a third line means the
 *     sentence is wrong, not that the clamp is.
 *   - No Surface, no border, no fill. A box here is the "box inside a card" the 2026-08-18
 *     blueprint pass deleted everywhere; the separation is the card header's own rule above it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

/** Two lines, then ellipsis — see the header. */
export const CARD_HINT_LINES = 2;

export default function CardHintLine({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <Ionicons name="bulb-outline" size={14} color={theme.textMuted} style={styles.glyph} />
      {/* `testID` is how `scripts/measure-wraps.mjs` finds a hint to measure it. A clamp that
          ellipsises is invisible to that script's other passes — they compare WIDTHS, and a
          two-line clamp overflows in HEIGHT — so the guard has to name the element. */}
      <Text
        testID="card-hint"
        style={[styles.text, { color: theme.textMuted }]}
        numberOfLines={CARD_HINT_LINES}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  // Nudged down to sit on the first line's optical centre rather than its box top — the glyph
  // box is square and the line box is not.
  glyph: { marginTop: 1 },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontFamily: Fonts.italic,
  },
});
