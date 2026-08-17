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
 * **Brought into the ambient-orb register in DARK (2026-08-17)**, alongside the pass that replaced
 * ScreenBackground's line art — see that file's header for the brief. This layer was already the
 * right SHAPE (a big soft blurred glow, which is what the brief asks for), and wrong in the two
 * ways that made it the loudest thing on the app's default tab:
 *   - **It was `rgb(90,150,255)` at a 0.32 peak in dark.** That is more than double the 10-15% the
 *     brief allows an ambient wash, in a bright neon-adjacent blue, on the one screen a user opens
 *     first. Now a deeply muted blue at 0.13 — inside the brief's range, and in the same register
 *     as the three orbs it is layered over rather than shouting past them.
 *   - **It was centred at 50%/34%, i.e. straight through the card box.** ScreenBackground's whole
 *     reason for keeping its glows in the corners is that a full-canvas lift on `#000000` relights
 *     every pixel a card and every line of text sit on, which is exactly what destroys the OLED
 *     benefit. This one did that and was excluded from that reasoning only by living in a different
 *     file. It is anchored off the TOP edge now (50%/-6%), so what reaches the middle of the screen
 *     is the tail rather than the core.
 * LIGHT is untouched: its field is a blue gradient with two broad ellipses already in it, so an
 * additive blue lift there is coherent and has nothing to wash out.
 *
 * Edit notes:
 *   - Render as the first child inside the SafeAreaView, same contract as ScreenBackground:
 *     absolutely positioned, pointerEvents="none", `zIndex: -1`. Transparent — it only ADDS a glow.
 *   - No looping motion here — ParticleBackground supplies the ambient rising-dot field; a static
 *     glow keeps swipes cheap (ANIMATION_GUIDELINES §6). Because it's static, no reducedMotion gate.
 *   - **The centre and the peak are per-theme and are not free to converge.** Light's glow sits in
 *     the upper third and may; dark's is anchored above the top edge and may not come back down.
 *     See the block above — that is an OLED/legibility constraint, not a taste setting.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useIsDark } from '@/lib/useAppTheme';

function HomeHeroBackground() {
  const isDark = useIsDark();
  // Home's extra warmth, additive over the shared field (transparent elsewhere). Dark is a deeply
  // muted blue inside the ambient brief's 10-15%; light keeps the brighter lift its own blue field
  // can carry. See the block above before moving either number.
  const color = isDark ? 'rgb(58,96,164)' : 'rgb(140,180,255)';
  const peak = isDark ? 0.13 : 0.22;
  // Dark hangs the glow off the top edge so only its tail reaches the cards; light keeps the
  // upper-third focal point it has always had.
  const cy = isDark ? '-6%' : '34%';

  return (
    <Svg pointerEvents="none" style={styles.backdrop} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="homeHeroGlow" cx="50%" cy={cy} rx="70%" ry="46%">
          <Stop offset="0" stopColor={color} stopOpacity={peak} />
          <Stop offset="0.55" stopColor={color} stopOpacity={peak * 0.38} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeHeroGlow)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Same absolute-bottom-layer contract as ScreenBackground — see the `zIndex` note in that
  // file's `styles.backdrop`. This layer mounts beside the same zIndex 99/100 chrome blocks, so
  // it needs the same explicit -1 rather than relying on being declared first.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});

// Memoised: this layer stays mounted behind the whole tabs pager and takes NO props, but its
// parent (app/(tabs)/_layout.tsx) re-renders on every tab change (it tracks the active route in
// state to cross-fade this layer's opacity). Without memo, that re-render reconciles this SVG
// radial right at the swipe boundary. useIsDark still re-renders it on a real theme change.
export default React.memo(HomeHeroBackground);
