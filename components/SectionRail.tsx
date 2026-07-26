/**
 * SectionRail.tsx — section header: a hue dot (or domain gradient badge) + ALL-CAPS label
 * (+ optional count / right slot), underlined by a hue hairline rule.
 *
 * The header half of the 2026-07-13 "color rail" list redesign (Tasks screen first, meant as
 * the reusable section primitive for the other list screens too). Pairs with a stack of cards
 * that each carry a matching `railColor` left edge — the shared hue is what binds a header to
 * its rows, replacing the old flat-color pill (`sectionHeader()` in plans.tsx). The `hue` is a
 * domain accent from lib/domainColor.getDomainColor(theme, domain).accent, which has both a
 * light and a dark variant, so the label/dot stay distinct and legible in both modes.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/CardAccent (CardAccentBadge)
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/habits.tsx (via SectionCard),
 *             components/SharedTasksSection.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - `hue` should be a solid domain accent (works on any surface, both modes). The header is
 *     the app-wide unified card/section style (2026-07-19): a small dot + ALL-CAPS tracked
 *     title (uppercase, 20px, bold, letterSpacing 0.8) over a hairline rule tinted
 *     `rgba(hue, 0.25)` — NOT a filled pill (that soft-plate look was dropped). The label is
 *     NOT pure `hue` (that was a same-hue-on-same-hue pairing that read low-contrast, e.g.
 *     green on light green) — it's `mix(hue, text, 0.3)`, a darkened/lightened hue that stays
 *     legible on the neutral frosted fill in both modes, while the dot keeps the pure `hue`
 *     for identity. Pass a solid accent, not an already-translucent colour.
 *   - **(2026-07-26) Optional `domain` prop**: when the section has a real domain identity (not
 *     just an arbitrary hue like "Today" or a weekday group), pass `domain` to swap the plain
 *     10px dot for a small `CardAccentBadge` gradient badge — part of the same "bring the card
 *     colour back" pass that widened Surface's edge and restored Home's badge gradient. `hue`
 *     is still required (drives the label/divider tint) even when `domain` is set.
 *   - The header is always full-width (`container` alignSelf:'stretch') so the rule spans the
 *     header width; the right-slot control's `marginLeft:'auto'` still pushes it to the edge.
 *   - `count` is optional; omit it for sections where a tally adds noise (e.g. weekday groups).
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Fonts, FontSize, Spacing, mix, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { CardAccentBadge } from '@/components/CardAccent';
import { Domain } from '@/lib/domainColor';

type Props = {
  /** Solid domain accent (getDomainColor(theme, domain).accent). Colors the dot/badge + label. */
  hue: string;
  /** Section's domain identity, if any — swaps the flat dot for a small gradient badge. */
  domain?: Domain;
  label: string;
  /** Optional item tally shown after the label. */
  count?: number;
  /** Optional control rendered flush-right (e.g. a toggle). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SectionRail({ hue, domain, label, count, right, style }: Props) {
  const theme = useAppTheme();
  // 2026-07-16 contrast raise: the label was a solid hue on a 14% tint of the SAME hue — a
  // green/green (etc.) pairing that read low-contrast. Darken the label toward `text` (works
  // both modes: text is near-black in light, near-white in dark) so it's clearly legible,
  // and keep the dot at pure `hue` for the color identity. Firmer 18% pill plate too.
  const labelColor = mix(hue, theme.text, 0.3);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {domain ? (
          <CardAccentBadge domain={domain} size={24} />
        ) : (
          <View style={[styles.dot, { backgroundColor: hue }]} />
        )}
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {count != null && (
          <Text style={[styles.count, { color: theme.textMuted }]}>{count}</Text>
        )}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <View style={[styles.divider, { backgroundColor: rgba(hue, 0.25) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-width so the hairline rule spans the header; the tighter gap keeps the header
  // close to the card stack it labels instead of floating detached above it.
  container: { alignSelf: 'stretch', marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  // Unified card/section header title (2026-07-19): ALL-CAPS, tracked, bold — reads
  // unmistakably as a header, one step below the screen-level title (extrabold 28).
  label: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  count: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  right: { marginLeft: 'auto' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.xs },
});
