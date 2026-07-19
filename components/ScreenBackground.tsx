/**
 * ScreenBackground.tsx — the calm, neutral per-screen backdrop behind a screen's content.
 *
 * As of 2026-07-19 the backdrop is NEUTRAL: a flat, calm `theme.bg` fill with no per-screen hue
 * field. The earlier "colour-architecture inversion" painted a rich per-screen colour gradient
 * here (green Shopping, indigo Plans, …) and let it show through the frosted cards; per maintainer
 * feedback that read as too much colour in the background ("remove the background colour"), so the
 * COLOUR now lives ONLY in the card borders/accents (components/Surface's thin beveled edge, keyed
 * to the screen/domain hue) and the CTAs — never the backdrop. Cards frost this neutral bg, so a
 * card reads as a clean near-surface pane over a soft neutral field.
 *
 * Connections:
 *   Imports → lib/useAppTheme (useAppTheme)
 *   Used by → app/(tabs)/_layout.tsx (one shared instance behind the whole pager); components/
 *             ScreenScaffold (its own first child, for sub-tier and non-pager site screens)
 *   Data    → —
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the screen's
 *     SafeAreaView/ScrollView be transparent on top of it.
 *   - `activeRoute` is accepted for backwards-compatibility with callers (the pager passes the
 *     active tab) but is no longer used — the backdrop is the same neutral fill on every screen,
 *     so there is nothing to crossfade. Keeping the prop avoids churn at the call sites.
 *   - If a hint of ambient tone is ever wanted back, tint this fill VERY subtly — but the
 *     standing direction is a neutral background with colour reserved for borders/accents.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Accepted for call-site compatibility (the pager passes the active tab); no longer used —
   *  the backdrop is a single neutral fill on every screen. */
  activeRoute?: string;
};

export default function ScreenBackground(_props: Props) {
  const theme = useAppTheme();
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}
    />
  );
}
