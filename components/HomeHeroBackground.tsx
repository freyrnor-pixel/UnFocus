/**
 * HomeHeroBackground.tsx — a soft extra focal glow that gives the Home tab a touch more warmth.
 *
 * As of 2026-07-19 (abstract-branch background) this is a single ADDITIVE upper-centre glow
 * layered OVER the shared ScreenBackground (gradient + corner branches). ScreenBackground now
 * carries the whole field on every screen, so Home no longer needs its own sky/orb/ground stack —
 * it just gets one stronger blue focal glow, cross-faded in when Home is focused (see
 * app/(tabs)/_layout.tsx). Transparent everywhere else so the shared field shows through. Fully
 * STATIC — no motion (the ambient drift comes from ParticleBackground).
 *
 * Connections:
 *   Imports → lib/useAppTheme (useIsDark), react-native-svg
 *   Used by → app/(tabs)/_layout.tsx (hoisted behind the whole tabs pager, cross-faded in when
 *             the home tab is focused — see that file's header), layered over ScreenBackground.
 *             components/ScreenScaffold still mounts it directly (isHome prop) for any isHome
 *             screen with ownBackground=true.
 *
 * Edit notes:
 *   - Render as the first child inside the SafeAreaView, same contract as ScreenBackground:
 *     absolutely positioned, pointerEvents="none". Transparent — it only ADDS a glow.
 *   - No looping motion here — ParticleBackground supplies the ambient rising-dot field; a static
 *     glow keeps swipes cheap (ANIMATION_GUIDELINES §6). Because it's static, no reducedMotion gate.
 *   - The glow is centred at 50%/34% (upper third), reinforcing ScreenBackground's own focal glow
 *     so Home reads a shade brighter/warmer than the other tabs.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useIsDark } from '@/lib/useAppTheme';

function HomeHeroBackground() {
  const isDark = useIsDark();
  // A stronger blue focal glow than ScreenBackground's base top-glow, so fading it in on Home
  // lifts the upper-centre a touch. Additive over the shared field (transparent elsewhere).
  const color = isDark ? 'rgb(90,150,255)' : 'rgb(140,180,255)';
  const peak = isDark ? 0.32 : 0.22;

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="homeHeroGlow" cx="50%" cy="34%" rx="70%" ry="46%">
          <Stop offset="0" stopColor={color} stopOpacity={peak} />
          <Stop offset="0.55" stopColor={color} stopOpacity={peak * 0.38} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeHeroGlow)" />
    </Svg>
  );
}

// Memoised: this layer stays mounted behind the whole tabs pager and takes NO props, but its
// parent (app/(tabs)/_layout.tsx) re-renders on every tab change (it tracks the active route in
// state to cross-fade this layer's opacity). Without memo, that re-render reconciles this SVG
// radial right at the swipe boundary. useIsDark still re-renders it on a real theme change.
export default React.memo(HomeHeroBackground);
