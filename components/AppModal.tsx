/**
 * AppModal.tsx — single shared in-app popup, replacing every native Alert.alert.
 *
 * One imperative call — showAppModal(title, message?, buttons?) — mirrors Alert.alert's
 * signature so call sites swap in with minimal churn. <AppModalHost/> is mounted once at
 * the app root (app/_layout.tsx) and renders whatever was last requested; there is only
 * ever one popup on screen at a time, matching native Alert semantics.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, lib/i18n,
 *             lib/useAppTheme, react-native-reanimated
 *   Used by → (not yet mounted — Phase 3a foundational port; app/_layout.tsx wires the
 *             host in during the screens phase; every screen/store that previously called
 *             Alert.alert will call showAppModal() at that point)
 *   Data    → none — purely presentational; buttons carry their own onPress callbacks
 *
 * Edit notes:
 *   - showAppModal() is a plain function, not a hook — it has to work from non-component
 *     call sites too (e.g. a Zustand action). It talks to the mounted host through a
 *     single module-level listener ref, not React context.
 *   - Only one request is held at a time, same as Alert.alert — a second call while a popup
 *     is showing replaces it.
 *   - Tapping the backdrop or the Android back button dismisses without running any
 *     button's onPress, matching Android's default cancelable Alert.alert behaviour.
 *   - Entrance/exit timing follows ANIMATION_GUIDELINES.md §1 (320ms ease-out in /
 *     220ms ease-in out — modal enter/exit band is 300-350ms / 200-250ms), gated by
 *     useAccessibility().reducedMotion.
 *   - Decision 008: the modal card is a glass Surface in `overlay` context — it sits over
 *     live scrolling content behind the backdrop, so it frosts harder than an `ambient`
 *     card would. Blur comes from Surface's BlurView; this file never imports expo-blur
 *     directly.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { getTranslations } from '@/lib/i18n';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

export type AppModalButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AppModalRequest = {
  title: string;
  message?: string;
  buttons: AppModalButton[];
};

let listener: ((req: AppModalRequest) => void) | null = null;

/** Drop-in replacement for Alert.alert(title, message?, buttons?). */
export function showAppModal(title: string, message?: string, buttons?: AppModalButton[]) {
  listener?.({
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: getTranslations().ok }],
  });
}

export default function AppModalHost() {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const [request, setRequest] = useState<AppModalRequest | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    listener = (req) => {
      setRequest(req);
      progress.value = reducedMotion ? 1 : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    };
    return () => {
      listener = null;
    };
  }, [reducedMotion, progress]);

  function dismiss(onPress?: () => void) {
    onPress?.();
    if (reducedMotion) {
      progress.value = 0;
      setRequest(null);
      return;
    }
    progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(setRequest)(null);
    });
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  if (!request) return null;

  function buttonLook(style?: AppModalButton['style']) {
    if (style === 'cancel') return { fill: 'transparent', textColor: theme.textMuted, scaleTo: 0.97 };
    if (style === 'destructive') return { fill: theme.bad, textColor: theme.textInverse, scaleTo: 0.93 };
    return { fill: theme.accent, textColor: theme.accentInk, scaleTo: 0.95 };
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => dismiss()}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Surface surfaceContext="overlay" style={styles.card}>
            {!!request.title && <Text style={[styles.title, { color: theme.text }]}>{request.title}</Text>}
            {!!request.message && <Text style={[styles.message, { color: theme.textMuted }]}>{request.message}</Text>}

            <View style={[styles.buttonRow, request.buttons.length !== 2 && styles.buttonColumn]}>
              {request.buttons.map((btn, i) => {
                const { fill, textColor, scaleTo } = buttonLook(btn.style);
                return (
                  <PressableScale
                    key={i}
                    style={[
                      styles.button,
                      request.buttons.length !== 2 && styles.buttonColumnItem,
                      { backgroundColor: fill },
                    ]}
                    scaleTo={scaleTo}
                    onPress={() => dismiss(btn.onPress)}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>{btn.text}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  buttonColumnItem: {
    flex: 0,
    width: '100%',
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
