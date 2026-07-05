/**
 * Pet.tsx — animated home-screen companion (Decision 039 redesign)
 *
 * The companion lives in the bottom-left corner of the home screen inside a soft
 * "glow habitat" (sky + radial glow + fading floor, no hard edges). It is drawn by
 * components/Creature.tsx as a real, breathing character — never an emoji. It
 * blinks and breathes at idle, tilts + floats hearts when tapped, hops with a glow
 * burst + particles when a task/habit is completed, and closes its eyes into a cozy
 * nighttime rest between 23:00–07:00. A three-treat tray below the habitat can be
 * dragged onto the creature to feed it.
 *
 * Connections:
 *   Imports → components/Creature, constants/petData, lib/haptics, lib/i18n,
 *             lib/useAppTheme, store/useSettingsStore
 *   Used by → app/index.tsx (onboarding step6 draws Creature directly for its inline preview)
 *   Props   → completedToday: bumping it triggers the celebration/excited moment
 *   Data    → reads petType + petColor from useSettingsStore; no writes
 *
 * Edit notes:
 *   - Habitat sky/floor/glow come from PET_PALETTES keyed by pet type, and the
 *     light-vs-dark table is chosen by useIsDark() — that is what makes the
 *     companion "fit the theme". Fur is per-type (design default) unless the user
 *     picked a swatch (petColor); see furFor() in constants/petData.ts.
 *   - The tray now holds 3 abstract treat circles (design spec) rather than the old
 *     shopping-list food chips — feeding is a generic "drop a snack" gesture again.
 *   - Reduced motion: transient moods still reshape the face (and haptics still
 *     fire), but every loop/spring is skipped per ANIMATION_GUIDELINES §7–8.
 *   - Only the speech bubble is app chrome (surface/border/text tokens); the
 *     habitat + creature palette are fixed decorative hex (see petData header).
 */
import React, { useRef, useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { tap, success } from '@/lib/haptics';
import { useAppTheme, useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import Creature from '@/components/Creature';
import {
  PetState,
  PET_PALETTES,
  GLOW_OPACITY,
  TREAT_COLORS,
  furFor,
} from '@/constants/petData';

const HABITAT_W = 94;
const HABITAT_H = 102;
// The creature's 84px art + this offset must clear the habitat's rounded top, so
// tall ears (bunny) aren't clipped by overflow:hidden — 16 leaves a 2px top margin.
const CREATURE_BOTTOM = 16;

// Shown at most once per app session (not persisted — avoids a DB migration).
let hintShownSession = false;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Draggable treat ────────────────────────────────────────────────────────

type TreatProps = {
  color: string;
  index: number;
  habitatRef: React.RefObject<View | null>;
  onFedRef: React.MutableRefObject<() => void>;
  reducedMotion: boolean;
};

function DraggableTreat({ color, index, habitatRef, onFedRef, reducedMotion }: TreatProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s = useSharedValue(1);
  const opacity = useSharedValue(1);
  const wobble = useSharedValue(0);

  // Idle treat wobble ±5° (paired with the tray shimmer).
  useEffect(() => {
    cancelAnimation(wobble);
    if (reducedMotion) {
      wobble.value = 0;
      return;
    }
    wobble.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(5, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(-5, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(wobble);
  }, [reducedMotion, index, wobble]);

  function checkHitAndFeed(absX: number, absY: number) {
    habitatRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
      const HIT = 24;
      const over =
        absX >= pageX - HIT && absX <= pageX + w + HIT &&
        absY >= pageY - HIT && absY <= pageY + h + HIT;
      if (over) {
        opacity.value = withTiming(0, { duration: 180 }, (done) => {
          if (done) {
            runOnJS(onFedRef.current)();
            opacity.value = 1;
            s.value = 1;
            tx.value = 0;
            ty.value = 0;
          }
        });
        s.value = withSpring(1.8, { damping: 10, stiffness: 150 });
      } else {
        tx.value = withSpring(0, { damping: 14, stiffness: 80 });
        ty.value = withSpring(0, { damping: 14, stiffness: 80 });
      }
    });
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      s.value = withSpring(1.3, { damping: 10, stiffness: 250 });
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      s.value = withSpring(1, { damping: 12, stiffness: 200 });
      runOnJS(checkHitAndFeed)(e.absoluteX, e.absoluteY);
    });

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${wobble.value}deg` },
      { scale: s.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[styles.treat, { backgroundColor: color }, style]} />
    </GestureDetector>
  );
}

// ─── Celebration particle ──────────────────────────────────────────────────────

function Particle({ dx, dy, color, nonce, reducedMotion }: {
  dx: number; dy: number; color: string; nonce: number; reducedMotion: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const op = useSharedValue(0);

  useEffect(() => {
    if (nonce === 0 || reducedMotion) return;
    tx.value = 0;
    ty.value = 0;
    op.value = 1;
    tx.value = withDelay(60, withSpring(dx, { damping: 8, stiffness: 180 }));
    ty.value = withDelay(60, withSpring(dy, { damping: 8, stiffness: 180 }));
    op.value = withDelay(60, withTiming(0, { duration: 280 }));
  }, [nonce, dx, dy, reducedMotion, tx, ty, op]);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return <Reanimated.View style={[styles.particle, { backgroundColor: color }, style]} pointerEvents="none" />;
}

// ─── Pet ────────────────────────────────────────────────────────────────────

type Props = { completedToday: number };

export default function Pet({ completedToday }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const { reducedMotion } = useAccessibility();

  const petType = useSettingsStore((s) => s.petType);
  const petColor = useSettingsStore((s) => s.petColor);
  const palette = PET_PALETTES[petType] ?? PET_PALETTES.cat;
  const habitat = isDark ? palette.dark : palette.light;
  const fur = furFor(petType, petColor);
  const baseGlow = isDark ? GLOW_OPACITY.dark : GLOW_OPACITY.light;

  const [mood, setMood] = useState<PetState>(() => {
    const h = new Date().getHours();
    return h < 7 || h >= 23 ? 'resting' : 'idle';
  });
  const [bubbleText, setBubbleText] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [particleNonce, setParticleNonce] = useState(0);

  const habitatRef = useRef<View>(null);
  const stateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCompleted = useRef(completedToday);
  const onFedRef = useRef<() => void>(() => {});

  // Animated values
  const breathe = useSharedValue(0);
  const hopY = useSharedValue(0);
  const leanZ = useSharedValue(0);
  const tiltZ = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(baseGlow);
  const shimmer = useSharedValue(0.15);
  const heartY = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartScale = useSharedValue(1);
  const bubbleOpacity = useSharedValue(0);

  // Keep glow at rest at the current theme's base opacity.
  useEffect(() => {
    glowOpacity.value = baseGlow;
  }, [baseGlow, glowOpacity]);

  // ── Breathe loop (period depends on mood) ─────────────────────────────────
  useEffect(() => {
    cancelAnimation(breathe);
    if (reducedMotion) {
      breathe.value = 0;
      return;
    }
    const half = mood === 'excited' ? 700 : mood === 'resting' ? 2800 : 1800;
    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [mood, reducedMotion, breathe]);

  // ── Glance lean toward the tray (idle only) ───────────────────────────────
  useEffect(() => {
    cancelAnimation(leanZ);
    if (mood !== 'idle' || reducedMotion) {
      leanZ.value = withTiming(0, { duration: 300 });
      return;
    }
    leanZ.value = withRepeat(
      withSequence(
        withDelay(4000, withTiming(-8, { duration: 2500 })),
        withDelay(1000, withTiming(0, { duration: 1000 })),
      ),
      -1,
    );
    return () => cancelAnimation(leanZ);
  }, [mood, reducedMotion, leanZ]);

  // ── Tray shimmer ──────────────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimation(shimmer);
    if (reducedMotion) {
      shimmer.value = 0.35;
      return;
    }
    shimmer.value = withRepeat(
      withTiming(0.55, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(shimmer);
  }, [reducedMotion, shimmer]);

  // ── React to completed-task count ─────────────────────────────────────────
  useEffect(() => {
    if (completedToday > prevCompleted.current) triggerExcited();
    prevCompleted.current = completedToday;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedToday]);

  // ── One-time feeding hint ─────────────────────────────────────────────────
  useEffect(() => {
    if (hintShownSession) return;
    hintShownSession = true;
    const id = setTimeout(() => showBubbleMsg(t.petCompanion.feedHint, 2600), 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (stateTimeout.current) clearTimeout(stateTimeout.current); }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function clearState() {
    if (stateTimeout.current) clearTimeout(stateTimeout.current);
  }

  function returnToIdle(ms: number) {
    clearState();
    stateTimeout.current = setTimeout(() => {
      const h = new Date().getHours();
      setMood(h < 7 || h >= 23 ? 'resting' : 'idle');
    }, ms);
  }

  function showBubbleMsg(text: string, holdMs = 1400) {
    setBubbleText(text);
    setShowBubble(true);
    bubbleOpacity.value = 0;
    bubbleOpacity.value = withSequence(
      withTiming(1, { duration: 180 }),
      withDelay(holdMs, withTiming(0, { duration: 320 }, (done) => {
        if (done) runOnJS(setShowBubble)(false);
      })),
    );
  }

  // ── Interactions ───────────────────────────────────────────────────────────
  function triggerHappy() {
    clearState();
    setMood('happy');
    if (!reducedMotion) {
      tiltZ.value = withSequence(withTiming(-5, { duration: 200 }), withDelay(500, withTiming(0, { duration: 300 })));
      heartY.value = 0;
      heartOpacity.value = 1;
      heartScale.value = 0.6;
      heartY.value = withTiming(-54, { duration: 1300 });
      heartOpacity.value = withTiming(0, { duration: 1300 });
      heartScale.value = withSpring(1.6, { damping: 8, stiffness: 80 });
    }
    returnToIdle(1900);
  }

  function triggerExcited() {
    clearState();
    setMood('excited');
    success();
    if (!reducedMotion) {
      hopY.value = withSequence(
        withSpring(-18, { damping: 5, stiffness: 220 }),
        withSpring(0, { damping: 9, stiffness: 180 }),
      );
      glowScale.value = withSequence(withTiming(1.6, { duration: 160 }), withTiming(1, { duration: 420 }));
      glowOpacity.value = withSequence(withTiming(0.9, { duration: 160 }), withTiming(baseGlow, { duration: 420 }));
      setParticleNonce((n) => n + 1);
    }
    showBubbleMsg(pick(t.petCompanion.praise), 1600);
    returnToIdle(700);
  }

  function triggerEating() {
    clearState();
    setMood('eating');
    if (!reducedMotion) {
      hopY.value = withRepeat(
        withSequence(withTiming(-3, { duration: 120 }), withTiming(0, { duration: 120 })),
        3,
        false,
      );
    }
    showBubbleMsg(t.petCompanion.feedThanks, 2000);
    returnToIdle(1400);
  }

  onFedRef.current = triggerEating;

  // ── Animated styles ──────────────────────────────────────────────────────
  const creatureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -1 * breathe.value + hopY.value },
      { rotate: `${leanZ.value + tiltZ.value}deg` },
      { scale: 1 + 0.045 * breathe.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ translateY: heartY.value }, { scale: heartScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  const bubbleStyle = useAnimatedStyle(() => ({ opacity: bubbleOpacity.value }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Speech bubble */}
      {showBubble && (
        <Reanimated.View
          style={[styles.bubble, { backgroundColor: theme.surface, borderColor: theme.border }, bubbleStyle]}
          pointerEvents="none"
        >
          <Text style={[styles.bubbleText, { color: theme.text }]}>{bubbleText}</Text>
          <View style={[styles.bubbleTail, { borderTopColor: theme.border }]} />
        </Reanimated.View>
      )}

      {/* Floating hearts (tap) */}
      <Reanimated.Text style={[styles.hearts, heartStyle]} pointerEvents="none">💕</Reanimated.Text>

      {/* Habitat */}
      <Pressable onPress={() => { tap(); triggerHappy(); }} hitSlop={8}>
        <View ref={habitatRef} style={[styles.habitat, { backgroundColor: habitat.sky }]}>
          {/* Glow */}
          <Reanimated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
            <Svg width={HABITAT_W} height={HABITAT_H}>
              <Defs>
                <RadialGradient id="petGlow" cx="50%" cy="60%" rx="64%" ry="56%">
                  <Stop offset="0%" stopColor={habitat.glow} stopOpacity="1" />
                  <Stop offset="70%" stopColor={habitat.glow} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={HABITAT_W} height={HABITAT_H} fill="url(#petGlow)" />
            </Svg>
          </Reanimated.View>

          {/* Floor */}
          <View style={styles.floor} pointerEvents="none">
            <Svg width={HABITAT_W} height={50}>
              <Defs>
                <LinearGradient id="petFloor" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0" stopColor={habitat.floor} stopOpacity="1" />
                  <Stop offset="0.3" stopColor={habitat.floor} stopOpacity="1" />
                  <Stop offset="0.7" stopColor={habitat.floor} stopOpacity="0.3" />
                  <Stop offset="1" stopColor={habitat.floor} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={HABITAT_W} height={50} fill="url(#petFloor)" />
            </Svg>
          </View>

          {/* Particles (celebration) */}
          <View style={styles.particleField} pointerEvents="none">
            <Particle dx={-22} dy={-18} color={habitat.floor} nonce={particleNonce} reducedMotion={reducedMotion} />
            <Particle dx={0} dy={-28} color={habitat.floor} nonce={particleNonce} reducedMotion={reducedMotion} />
            <Particle dx={22} dy={-18} color={habitat.floor} nonce={particleNonce} reducedMotion={reducedMotion} />
          </View>

          {/* Creature */}
          <Reanimated.View style={[styles.creatureWrap, creatureStyle]}>
            <Creature type={petType} mood={mood} fur={fur} reducedMotion={reducedMotion} />
          </Reanimated.View>
        </View>
      </Pressable>

      {/* Treat tray */}
      <View style={styles.tray} pointerEvents="box-none">
        <Reanimated.View style={[styles.trayShimmer, shimmerStyle]} pointerEvents="none" />
        {TREAT_COLORS.map((color, i) => (
          <DraggableTreat
            key={color}
            color={color}
            index={i}
            habitatRef={habitatRef}
            onFedRef={onFedRef}
            reducedMotion={reducedMotion}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 88,
    left: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  habitat: {
    width: HABITAT_W,
    height: HABITAT_H,
    borderRadius: 20,
    overflow: 'hidden',
  },
  floor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  particleField: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatureWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: CREATURE_BOTTOM,
    alignItems: 'center',
  },
  tray: {
    width: HABITAT_W,
    height: 34,
    borderRadius: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trayShimmer: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: '#FFFFFF',
  },
  treat: {
    width: 15,
    height: 15,
    borderRadius: 999,
    // subtle inset-like depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1,
    elevation: 2,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bubble: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    maxWidth: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    left: 14,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  hearts: {
    position: 'absolute',
    bottom: 132,
    alignSelf: 'center',
    fontSize: 20,
    zIndex: 11,
  },
});
