/**
 * Pet.tsx — animated home-screen companion
 *
 * A small pet that lives in the bottom-left corner of the home screen inside
 * its appropriate habitat. It bobs gently at idle, bounces when pressed,
 * wiggles when tasks are completed, sleeps late at night, and can be fed by
 * dragging food chips onto it. Food chips come from the weekly shopping list
 * (falls back to defaults when the list is empty). Different food categories
 * trigger different speech-bubble reactions.
 *
 * Connections:
 *   Imports → constants/petData, constants/theme, lib/haptics, lib/useAppTheme,
 *             store/useSettingsStore, store/useShoppingStore
 *   Used by → app/index.tsx, app/onboarding/step6.tsx — neither ported yet; this
 *             is a leaf ahead of its screens
 *   Props   → completedToday: triggers excited animation when it increases
 *
 * Edit notes:
 *   - Token remap (Decision 006): only the speech bubble is app chrome —
 *     theme.white→surface, theme.border→border (unchanged name), theme.text→text
 *     (unchanged name). Habitat/food emoji + habitat background colours stay
 *     fixed decorative hex from constants/petData.ts (same precedent as
 *     HomeHeroBackground.tsx's sky/orb palette) — not Decision 006 tokens.
 *   - Weekly-list membership: old app filtered `item.listType === 'weekly'`;
 *     this repo's useShoppingStore stub (Decision 015/Session A2·2) never
 *     carried a `listType` field — weekly rows are `status === 'inWeeklyList'`
 *     instead (see useShoppingStore.ts's own header). `category` is optional
 *     here (re-added for this component, see useShoppingStore.ts edit notes)
 *     so it falls back to 'other' when absent.
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
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { tap } from '@/lib/haptics';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import {
  PetState,
  FoodChip,
  PET_EMOJIS,
  PET_HABITATS,
  DEFAULT_FOOD_ITEMS,
  shoppingItemToFoodChip,
  reactionForCategory,
} from '@/constants/petData';

const HAPPY_MSGS   = ['Yay! ✨', '♪ ♪', 'Hehe~', '💖'];
const EXCITED_MSGS = ['⭐!', 'Woah!', 'Yesss!', 'Great!'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Draggable food chip ──────────────────────────────────────────────────────

type FoodProps = {
  item: FoodChip;
  petRef: React.RefObject<View | null>;
  onFedRef: React.MutableRefObject<(category: string) => void>;
};

function DraggableFoodItem({ item, petRef, onFedRef }: FoodProps) {
  const theme = useAppTheme();
  const translateX  = useSharedValue(0);
  const translateY  = useSharedValue(0);
  const chipScale   = useSharedValue(1);
  const chipOpacity = useSharedValue(1);

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
      { scale: chipScale.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[styles.foodWrap, animStyle]}>
        <Text style={styles.foodEmoji}>{item.emoji}</Text>
        <Text style={[styles.foodLabel, { color: theme.textMuted }]} numberOfLines={1}>{item.label}</Text>
      </Reanimated.View>
    </GestureDetector>
  );
}

// ─── Pet ──────────────────────────────────────────────────────────────────────

type Props = { completedToday: number };

export default function Pet({ completedToday }: Props) {
  const theme    = useAppTheme();
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
      .slice(0, 5)
      .map((i) => shoppingItemToFoodChip({ name: i.name, category: i.category ?? 'other' }));
  }, [shoppingItems]);

  const [petState, setPetState] = useState<PetState>(() => {
    const h = new Date().getHours();
    return h < 7 || h >= 23 ? 'sleeping' : 'idle';
  });
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

  // ── Idle bob (runs forever) ────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -5, duration: 1400, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0,  duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bobAnim, reducedMotion]);

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
      const h = new Date().getHours();
      setPetState(h < 7 || h >= 23 ? 'sleeping' : 'idle');
    }, ms);
  }

  function showBubbleMsg(text: string) {
    setBubbleText(text);
    setShowBubble(true);
    bubbleOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(bubbleOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1100),
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
    showBubbleMsg(pick(HAPPY_MSGS));
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
    showBubbleMsg(pick(EXCITED_MSGS));
    returnToIdle(2500);
  }

  function triggerEating(category: string) {
    clearState();
    setPetState('eating');
    if (!reducedMotion) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.82, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.18, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
      ]).start();
    }
    showBubbleMsg(reactionForCategory(category));
    returnToIdle(2000);
  }

  onFedRef.current = triggerEating;

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
          <View style={[styles.bubbleTail, { borderTopColor: theme.border }]} />
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

      {/* Food tray — draggable chips from shopping list */}
      <View style={styles.foodTray} pointerEvents="box-none">
        {foodChips.map((chip, i) => (
          <DraggableFoodItem
            key={`${chip.emoji}-${chip.label}-${i}`}
            item={chip}
            petRef={petRef}
            onFedRef={onFedRef}
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
                {
                  backgroundColor: habitat.bg,
                  borderRadius: habitat.radius,
                  borderColor: petColor,
                },
              ]}
            >
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
    bottom: 148,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 64,
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
    bottom: 130,
    alignSelf: 'center',
    fontSize: 20,
    zIndex: 11,
  },
  foodTray: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  foodWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  foodEmoji: {
    fontSize: 20,
  },
  foodLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  petAnchor: {
    width: 96,
    height: 106,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petHabitat: {
    width: 90,
    height: 100,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  petEmoji: {
    fontSize: 44,
    lineHeight: 52,
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
