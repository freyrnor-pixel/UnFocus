/**
 * Pet.tsx — animated home-screen companion (redesigned, Decision 039)
 *
 * A small emoji pet living in a cohesive per-type habitat in the bottom-left
 * corner of the home screen. It is a POSITIVE-ONLY companion: it bobs gently at
 * idle, bounces when pressed, and does an excited wiggle + praise bubble when a
 * task/habit is completed (via the `completedToday` prop). It has NO negative
 * states — no hunger decay, no sad/neglected pet, no guilt or nag mechanics;
 * `resting` is a cozy late-night state, never neglect. Feeding is an OPTIONAL
 * delight: drag a snack plate onto the pet for a happy eating reaction. Feeding
 * is made discoverable (subtle wobble on the snack plates + a one-time
 * "Drag a snack to me!" hint bubble) but never required and never expires.
 *
 * Connections:
 *   Imports → constants/petData, lib/haptics, lib/i18n (useT),
 *             lib/useAppTheme (useAppTheme, useAccessibility),
 *             store/useSettingsStore, store/useShoppingStore
 *   Used by → app/index.tsx, app/onboarding/step6.tsx
 *   Props   → completedToday: triggers excited animation when it increases
 *
 * Edit notes:
 *   - Token remap (Decision 006 / 039 §6): only the speech bubble is app chrome
 *     — surface/border/text use semantic tokens. Habitat sky/floor/accent and
 *     food emoji are fixed decorative hex from constants/petData.ts (same
 *     precedent as HomeHeroBackground.tsx's sky/orb palette).
 *   - All user-visible strings route through useT() (`t.pet.*`) in EN + NO
 *     (Decision 039 §7). Do not reintroduce hardcoded message arrays here.
 *   - Weekly-list membership: this repo's useShoppingStore marks weekly rows as
 *     `status === 'inWeeklyList'` (no `listType` field); `category` is optional
 *     and falls back to 'other'.
 *   - Legacy `Animated` API (not reanimated) drives the pet body per
 *     ANIMATION_GUIDELINES §8 "match the existing file's API"; reanimated drives
 *     only the draggable food chips (gesture-handler requirement).
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { tap, success, tug } from '@/lib/haptics';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import {
  PetState,
  FoodChip,
  PET_EMOJIS,
  PET_HABITATS,
  DEFAULT_FOOD_ITEMS,
  shoppingItemToFoodChip,
  reactionCategory,
} from '@/constants/petData';

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isNight(): boolean {
  const h = new Date().getHours();
  return h < 7 || h >= 23;
}

// ─── Draggable food chip ──────────────────────────────────────────────────────

type FoodProps = {
  item: FoodChip;
  index: number;
  petRef: React.RefObject<View | null>;
  onFedRef: React.MutableRefObject<(category: string) => void>;
  reducedMotion: boolean;
  bg: string;
  border: string;
  textMuted: string;
};

function DraggableFoodItem({
  item, index, petRef, onFedRef, reducedMotion, bg, border, textMuted,
}: FoodProps) {
  const translateX  = useSharedValue(0);
  const translateY  = useSharedValue(0);
  const chipScale   = useSharedValue(1);
  const chipOpacity = useSharedValue(1);
  // Subtle idle wobble — the discoverability affordance that says "grab me".
  const wobble      = useSharedValue(0);

  // Gentle, staggered, low-amplitude tilt loop (reduced-motion aware).
  useEffect(() => {
    if (reducedMotion) return;
    wobble.value = withDelay(
      index * 260,
      withRepeat(
        withSequence(
          withTiming(1,  { duration: 900 }),
          withTiming(-1, { duration: 900 }),
        ),
        -1,
        true,
      ),
    );
  }, [reducedMotion, index, wobble]);

  function checkHitAndFeed(absX: number, absY: number) {
    petRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
      const HIT = 28;
      const isOver =
        absX >= pageX - HIT && absX <= pageX + w + HIT &&
        absY >= pageY - HIT && absY <= pageY + h + HIT;

      if (isOver) {
        chipOpacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(onFedRef.current)(item.category);
          chipOpacity.value = 1;
          chipScale.value   = 1;
          translateX.value  = 0;
          translateY.value  = 0;
        });
        chipScale.value = withSpring(1.9, { damping: 10, stiffness: 150 });
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 80 });
        translateY.value = withSpring(0, { damping: 14, stiffness: 80 });
      }
    });
  }

  const panGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(tug)();
      chipScale.value = withSpring(1.3, { damping: 10, stiffness: 250 });
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      chipScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      runOnJS(checkHitAndFeed)(e.absoluteX, e.absoluteY);
    });

  const animStyle = useAnimatedStyle(() => ({
    opacity: chipOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${wobble.value * 7}deg` },
      { scale: chipScale.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[styles.foodWrap, animStyle]}>
        <View style={[styles.foodPlate, { backgroundColor: bg, borderColor: border }]}>
          <Text style={styles.foodEmoji}>{item.emoji}</Text>
        </View>
        <Text style={[styles.foodLabel, { color: textMuted }]} numberOfLines={1}>
          {item.label}
        </Text>
      </Reanimated.View>
    </GestureDetector>
  );
}

// ─── Pet ──────────────────────────────────────────────────────────────────────

type Props = { completedToday: number };

export default function Pet({ completedToday }: Props) {
  const theme    = useAppTheme();
  const t        = useT();
  const { reducedMotion } = useAccessibility();
  const petType  = useSettingsStore((s) => s.petType);
  const petColor = useSettingsStore((s) => s.petColor);
  const habitat  = PET_HABITATS[petType] ?? PET_HABITATS.cat;

  const shoppingItems = useShoppingStore((s) => s.items);
  const foodChips = useMemo(() => {
    const unchecked = shoppingItems.filter(
      (i) => i.status === 'inWeeklyList' && !i.checked
    );
    if (unchecked.length === 0) return DEFAULT_FOOD_ITEMS;
    return unchecked
      .slice(0, 4)
      .map((i) => shoppingItemToFoodChip({ name: i.name, category: i.category ?? 'other' }));
  }, [shoppingItems]);

  const [petState, setPetState] = useState<PetState>(() => (isNight() ? 'resting' : 'idle'));
  const [bubbleText, setBubbleText] = useState('');
  const [showBubble, setShowBubble] = useState(false);

  const petRef        = useRef<View>(null);
  const stateTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCompleted = useRef(completedToday);

  // Stable ref so DraggableFoodItem (created once) always calls the current
  // triggerEating without stale-closure issues.
  const onFedRef = useRef<(category: string) => void>(() => {});

  // ── Animated values (react-native Animated — native driver) ───────────────
  const bobAnim       = useRef(new Animated.Value(0)).current;
  const scaleAnim     = useRef(new Animated.Value(1)).current;
  const rotateAnim    = useRef(new Animated.Value(0)).current;
  const heartOpacity  = useRef(new Animated.Value(0)).current;
  const heartY        = useRef(new Animated.Value(0)).current;
  const heartScale    = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  // ── Idle bob (runs forever; skipped when resting or reduced-motion) ────────
  useEffect(() => {
    if (reducedMotion || petState === 'resting') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -5, duration: 1400, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0,  duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bobAnim, reducedMotion, petState]);

  // ── One-time feeding hint (discoverability) ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!stateTimeout.current) showBubbleMsg(t.pet.feedHint, 2400);
    }, 900);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── React to completed-task count ─────────────────────────────────────────
  useEffect(() => {
    if (completedToday > prevCompleted.current) {
      triggerExcited();
    }
    prevCompleted.current = completedToday;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedToday]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function clearState() {
    if (stateTimeout.current) clearTimeout(stateTimeout.current);
  }

  function returnToIdle(ms = 2200) {
    clearState();
    stateTimeout.current = setTimeout(() => {
      stateTimeout.current = null;
      setPetState(isNight() ? 'resting' : 'idle');
    }, ms);
  }

  function showBubbleMsg(text: string, holdMs = 1100) {
    setBubbleText(text);
    setShowBubble(true);
    bubbleOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(bubbleOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(holdMs),
      Animated.timing(bubbleOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setShowBubble(false));
  }

  // ── Interactions ───────────────────────────────────────────────────────────
  function triggerHappy() {
    clearState();
    setPetState('happy');
    if (!reducedMotion) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.5, useNativeDriver: true, tension: 280, friction: 4 }),
        Animated.spring(scaleAnim, { toValue: 1,   useNativeDriver: true, tension: 80,  friction: 6 }),
      ]).start();
      heartOpacity.setValue(1);
      heartY.setValue(0);
      heartScale.setValue(0.6);
      Animated.parallel([
        Animated.timing(heartOpacity, { toValue: 0,   duration: 1300, useNativeDriver: true }),
        Animated.spring(heartY,       { toValue: -54, useNativeDriver: true, tension: 50, friction: 8 }),
        Animated.spring(heartScale,   { toValue: 1.6, useNativeDriver: true, tension: 80, friction: 6 }),
      ]).start();
    }
    showBubbleMsg(pick(t.pet.happy));
    returnToIdle(2000);
  }

  function triggerExcited() {
    clearState();
    setPetState('excited');
    if (!reducedMotion) {
      const steps = [8, -8, 6, -6, 4, -4, 0].map((v, i) =>
        Animated.timing(rotateAnim, { toValue: v, duration: 70 + i * 5, useNativeDriver: true })
      );
      Animated.sequence(steps).start();
    }
    showBubbleMsg(pick(t.pet.excited));
    returnToIdle(2500);
  }

  function triggerEating(category: string) {
    clearState();
    setPetState('eating');
    success();
    if (!reducedMotion) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.82, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.18, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
      ]).start();
    }
    const pool = t.pet.reactions[reactionCategory(category)] ?? t.pet.reactions.other;
    showBubbleMsg(pick(pool));
    returnToIdle(2000);
  }

  onFedRef.current = triggerEating;

  // Clean up any pending timer on unmount.
  useEffect(() => () => clearState(), []);

  const currentEmoji = (PET_EMOJIS[petType] ?? PET_EMOJIS.cat)[petState];

  const rotateStr = rotateAnim.interpolate({
    inputRange: [-10, 10],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Speech bubble */}
      {showBubble && (
        <Animated.View
          style={[
            styles.bubble,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: bubbleOpacity },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.bubbleText, { color: theme.text }]}>{bubbleText}</Text>
          <View style={[styles.bubbleTail, { borderTopColor: theme.surface }]} />
        </Animated.View>
      )}

      {/* Hearts float up when happy */}
      <Animated.Text
        style={[
          styles.hearts,
          { opacity: heartOpacity, transform: [{ translateY: heartY }, { scale: heartScale }] },
        ]}
        pointerEvents="none"
      >
        💕
      </Animated.Text>

      {/* Food tray — draggable snack plates from the weekly shopping list */}
      <View style={styles.foodTray} pointerEvents="box-none">
        {foodChips.map((chip, i) => (
          <DraggableFoodItem
            key={`${chip.emoji}-${chip.label}-${i}`}
            item={chip}
            index={i}
            petRef={petRef}
            onFedRef={onFedRef}
            reducedMotion={reducedMotion}
            bg={theme.surface}
            border={theme.border}
            textMuted={theme.textMuted}
          />
        ))}
      </View>

      {/* Pet in habitat — measurement anchor (ref on outer, animation on inner) */}
      <Pressable onPress={() => { tap(); triggerHappy(); }} hitSlop={10}>
        <View ref={petRef} style={styles.petAnchor}>
          <Animated.View
            style={{
              transform: [
                { translateY: bobAnim },
                { rotate: rotateStr },
                { scale: scaleAnim },
              ],
            }}
          >
            <View
              style={[
                styles.petHabitat,
                { backgroundColor: habitat.sky, borderRadius: habitat.radius, borderColor: petColor },
              ]}
            >
              {/* soft accent halo behind the pet */}
              <View style={[styles.habitatHalo, { backgroundColor: habitat.accent }]} />
              <Text style={styles.petEmoji}>{currentEmoji}</Text>
              <View style={[styles.habitatFloor, { backgroundColor: habitat.floorBg }]}>
                <Text style={styles.floorEmoji}>{habitat.floor}</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  bubble: {
    position: 'absolute',
    bottom: 152,
    alignSelf: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  hearts: {
    position: 'absolute',
    bottom: 134,
    alignSelf: 'center',
    fontSize: 20,
    zIndex: 11,
  },
  foodTray: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    justifyContent: 'center',
  },
  foodWrap: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  foodPlate: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  foodEmoji: {
    fontSize: 20,
  },
  foodLabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  petAnchor: {
    width: 100,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petHabitat: {
    width: 94,
    height: 102,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 5,
  },
  habitatHalo: {
    position: 'absolute',
    top: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    opacity: 0.7,
  },
  petEmoji: {
    fontSize: 46,
    lineHeight: 54,
  },
  habitatFloor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorEmoji: {
    fontSize: 16,
  },
});
