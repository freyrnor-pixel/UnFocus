/**
 * HintCard.tsx — collapsible instructions button shown on most screens.
 *
 * Renders as a small pill button (info icon + chevron) that expands, on tap,
 * into the flat bordered hint body with a left accent bar. Collapsed by
 * default — instructions are opt-in, not always-on chrome. Always renders
 * (showHints setting removed — the pill is always available, just collapsed).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme,
 *             lib/i18n (useT), components/PressableScale
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx,
 *             app/(tabs)/health.tsx (this-week summary), app/(tabs)/habits.tsx,
 *             app/scan.tsx, app/meals.tsx, app/habit-form.tsx,
 *             app/notes.tsx, app/health-form.tsx, app/health-log.tsx
 *   Data    → reads colours from
 *             useAppTheme(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - **Not the same thing as components/StarterCard.tsx** (2026-07-26). This is the ⓘ
 *     "instructions for this screen" card — opt-in, accent-barred, and (since 2026-07-31)
 *     collapsed until the header ⓘ is tapped on EVERY screen: lib/useFirstVisitHint.ts no
 *     longer auto-opens it on first visit. StarterCard is the neutral-bordered empty-state
 *     explainer that renders inline while a surface has no content, and is gated on a plain
 *     `length === 0`. They deliberately look different so a screen showing both at once
 *     doesn't read as the same card twice.
 *   - **`example` is DELETED (2026-08-17, "kill the text bloat").** Every banner used to carry
 *     a second, italic, muted line under its instruction — *"Draining tasks get a minus,
 *     restoring ones a plus."*, *"e.g. milk weekly, washing powder monthly."*, *"e.g. 'Headache'
 *     at 3 of 5 — a couple of weeks shows a pattern."* Maintainer: *"Remove all italicized
 *     explanatory examples from the top info banners. Keep only the absolute shortest, primary
 *     instruction."* So the prop is gone from the component AND the `hints.*.example` keys are
 *     gone from lib/i18n.ts — leaving the strings behind would guarantee the next session wires
 *     them back in. Note this does NOT touch components/StarterCard.tsx's `example`, which is a
 *     different thing entirely: a real, addable example ROW, not a sentence about one.
 *   - Optional `children` render below the instruction — used to embed a setting control
 *     (shopping reset cadence, notifications) that lives nowhere else. Since the card no
 *     longer auto-opens, those controls are reachable only via the info button; don't assume a
 *     user has seen one. See app/(tabs)/shopping.tsx / plans.tsx / index.tsx.
 *   - Always renders the how-to button (collapsed by default) — callers should still pass `text`.
 *   - `text` is passed in already-localized; this component does not call useT() itself
 *     except for the toggle button's own label (t.showHint/t.hideHint).
 *   - **The instruction is clamped to `HINT_LINES` and the card has real padding (2026-08-17).**
 *     Both are brief section 3's "standardize text placement & padding"; see those two blocks
 *     for the reasoning, and don't remove the clamp to fit a longer hint — shorten the hint.
 *   - Uses theme.hintBg/hintBorder/hintAccent (Decision 006 token layer) —
 *     theme-tuned per palette, not a fixed hue.
 *   - Pill path expand/collapse uses LayoutAnimation here (same pattern as ExpandableCard),
 *     gated on reducedMotion per ANIMATION_GUIDELINES §7; toggle button is PressableScale so
 *     it gets the standard tap haptic + press-scale for free.
 *   - noPill (header-driven) mode does NOT animate from this file — the body is mounted/
 *     unmounted by the parent's `open` prop. The animation for that path lives in
 *     lib/useFirstVisitHint.ts, whose wrapped setter runs LayoutAnimation.configureNext
 *     before every open/close (auto-open, blur, and the header ⓘ toggle).
 */
import React, { useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, HitSlop, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import PressableScale from '@/components/PressableScale';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

/**
 * How many lines the banner's instruction may take (2026-08-17, brief §3: *"Secondary
 * descriptive text must be heavily clamped… to prevent it from pushing functional UI elements
 * off the screen."*).
 *
 * TWO, not one. Every hint was trimmed to a short imperative in the same pass, and all of them
 * fit one line in English — but Norwegian runs ~15% longer and this card is the only place on
 * some screens that carries a control in `children` (the shopping reset cadence, the
 * notification row), so a hard one-line clamp would truncate the instruction on the exact
 * screens where it does the most work. Two lines is the ceiling that keeps a card from ever
 * growing into a paragraph again; if a hint needs three, shorten the hint.
 */
const HINT_LINES = 2;

type Props = {
  text: string;
  /** Controlled open state — when provided, the internal state is bypassed. */
  open?: boolean;
  /** Controlled toggle — called instead of internal setState when provided. */
  onToggle?: () => void;
  /**
   * Header-driven mode: suppress the in-content pill entirely and only
   * render the card body (controlled by `open`). Use when the screen
   * wires the ScreenScaffold infoActive/onInfoToggle props to drive the
   * hint — the header ⓘ button IS the toggle, so the pill is redundant.
   */
  noPill?: boolean;
  /**
   * Optional interactive content rendered inside the hint body, below the
   * instruction. Used to embed a first-run setting control (e.g. shopping
   * reset day, work mode) that the old onboarding wizard used to collect —
   * the hint teaches it in context on first visit. See app/(tabs)/*.
   */
  children?: React.ReactNode;
  /**
   * `noPill` only — the intro card's "X" (2026-08-13). When given, the card draws a dismiss
   * button in its top-right corner; the caller persists the dismissal (lib/useFirstVisitHint's
   * `dismiss`, which writes settings.dismissedHints) and stops passing `open`.
   *
   * Optional because the pill path has no use for it: that card is already one tap from being
   * closed by the pill that opened it.
   */
  onDismiss?: () => void;
};

export default function HintCard({ text, open: openProp, onToggle: onToggleProp, noPill, children, onDismiss }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [openInternal, setOpenInternal] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;

  function toggle() {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isControlled) onToggleProp?.();
    else setOpenInternal((v) => !v);
  }

  // Intro-card mode: no pill, just the card body, open until the caller says otherwise.
  // Named `noPill` from when the header ⓘ was the toggle; the flag now means "the screen owns
  // whether this shows" and the ⓘ is gone (2026-08-13 — see lib/useFirstVisitHint.ts).
  if (noPill) {
    if (!openProp) return null;
    return (
      <View style={[styles.wrap, styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
        <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
        <View style={[styles.body, onDismiss && styles.bodyDismissable]}>
          <Text style={[styles.text, { color: theme.text }]} numberOfLines={HINT_LINES}>{text}</Text>
          {children ? <View style={styles.childrenSlot}>{children}</View> : null}
        </View>
        {/* Same dismiss affordance as components/StarterCard.tsx's — an intro card and an
            empty-state explainer are the same promise ("this will go away"), so they close the
            same way. Absolutely positioned rather than a row child, so it sits in the CORNER
            (see `dismiss`) instead of being centred against a tall body. */}
        {onDismiss ? (
          <PressableScale
            onPress={onDismiss}
            hitSlop={HitSlop.base}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={t.starters.dismiss}
            style={styles.dismiss}
          >
            <Ionicons name="close" size={16} color={theme.textMuted} />
          </PressableScale>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={toggle}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel={open ? t.hideHint : t.showHint}
        accessibilityState={{ expanded: open }}
        style={[styles.toggle, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}
      >
        <Ionicons name="information-circle-outline" size={18} color={theme.hintAccent} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={theme.hintAccent} />
      </PressableScale>
      {open && (
        <View style={[styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
          <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
          <View style={styles.body}>
            <Text style={[styles.text, { color: theme.text }]} numberOfLines={HINT_LINES}>{text}</Text>
            {children ? <View style={styles.childrenSlot}>{children}</View> : null}
          </View>
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // No vertical margin (2026-08-08): the screen's content container owns the gap between
  // stacked cards (`SCREEN_GAP`, constants/theme.ts). Was `marginBottom: Spacing.sm`, which
  // made the hint the one card on a screen that sat 8px from its neighbour while everything
  // else sat 32 or 0.
  wrap: {},
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  card: {
    // `relative` so the absolutely-positioned dismiss below anchors to THIS box.
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    // Standard native padding on all four sides (2026-08-17, brief §3: "Text should not crowd
    // the edges of its container"). It was `sm` vertical and `md` on the right only, with the
    // left inset coming from the accent bar's own margin plus an `xs` on the body — so the text
    // sat 3px from a hard edge on the left and 8px from the top. `alignItems` moved from
    // 'flex-start' to 'center' with it: with the italic example gone the body is one short
    // block, and top-aligning it against a stretched accent bar left the text riding high.
    paddingVertical: Spacing.md,
    paddingRight: Spacing.md,
    marginTop: Spacing.xs,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: Spacing.md,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  // The dismiss is out of flow, so the text has to reserve its own clearance or it runs
  // under the glyph. Only applied when there IS one — an undismissable card keeps the full width.
  bodyDismissable: {
    paddingRight: Spacing.lg,
  },
  text: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Fonts.medium,
  },
  childrenSlot: {
    marginTop: Spacing.sm,
  },
  // **In the corner, where every other app puts it (2026-08-14).** This was a row child with
  // `alignSelf: 'flex-start'` + `justifyContent: 'center'`, which top-aligned the 48px TAP BOX
  // and then centred the 16px glyph inside it — so against a two-line body the × landed at the
  // text's vertical midpoint, ~16px down from the card's top edge. It only ever read as
  // "top-right" on a one-line card. Maintainer: *"X for remove should always be placed like it
  // would in every other app/webpage/element."*
  //
  // Absolute at top/right of the card, with the glyph pushed into that corner by
  // `flex-start`/`flex-end` plus a Spacing.sm inset. The 48px target stays INSIDE the card on
  // purpose: `card` is `overflow: 'hidden'`, and Android clips touches to the parent's bounds,
  // so a box that overhangs to sit nearer the edge would lose the overhanging part of its own
  // hit area. `body` reserves the width via `bodyDismissable`.
  dismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: Spacing.sm,
    paddingRight: Spacing.sm,
  },
});
