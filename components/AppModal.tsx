/**
 * AppModal.tsx — single shared in-app popup, replacing every native Alert.alert.
 *
 * One imperative call — showAppModal(title, message?, buttons?) — mirrors Alert.alert's
 * signature so call sites swap in with minimal churn. <AppModalHost/> is mounted once at
 * the app root (app/_layout.tsx) and renders whatever was last requested; there is only
 * ever one popup on screen at a time, matching native Alert semantics.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, lib/haptics
 *             (confirmDestructive's two beats), lib/i18n, lib/useAppTheme,
 *             react-native-reanimated
 *   Used by → <AppModalHost/> mounted in app/_layout.tsx (2026-07-02, Session A2·2);
 *             showAppModal() called from app/shopping.tsx (delete-list confirm,
 *             done-shopping receipt choice, manual monthly-reset confirm, new-list chooser)
 *             and ~20 other sites; confirmDestructive() by every delete/reset confirm in the
 *             app (16 call sites across app/ and components/ as of 2026-08-12)
 *   Data    → none — purely presentational; buttons carry their own onPress callbacks
 *
 * Edit notes:
 *   - **Reach for `confirmDestructive`, not `showAppModal`, for anything that destroys data.**
 *     See its own doc: it is the same modal with the Cancel/red-button pair and the two
 *     haptic beats built in, because those beats had drifted across 16 hand-rolled copies.
 *   - showAppModal() is a plain function, not a hook — it has to work from non-component
 *     call sites too (e.g. a Zustand action). It talks to the mounted host through a
 *     single module-level listener ref, not React context.
 *   - Only one request is held at a time, same as Alert.alert — a second call while a popup
 *     is showing replaces it.
 *   - A button's onPress can itself call showAppModal() again (e.g. a menu's "Delete"
 *     option opening a confirm dialog) — dismiss() guards against that with a `seq`
 *     counter so its own exit animation doesn't clobber the freshly-queued modal.
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
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Fonts, FontSize, glassKey, Radius, Spacing } from '@/constants/theme';
import { heavy, warning } from '@/lib/haptics';
import { getTranslations } from '@/lib/i18n';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { Duration, Ease } from '@/constants/motion';

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

type ConfirmDestructiveOptions = {
  title: string;
  message?: string;
  /** The word on the red button — "Delete", "Reset", "Stop tracking". Never a bare "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  /** Only when a screen has a better word than "Cancel" for backing out. */
  cancelLabel?: string;
};

/**
 * "Are you sure?" for something that destroys data: Cancel, plus one red button.
 *
 * The app had ~16 hand-rolled copies of this exact two-button array, and they had drifted in
 * the one respect nothing checks — the haptics. ANIMATION_GUIDELINES.md §5 is unambiguous
 * (`warning()` before the dialog, `heavy()` the moment it's confirmed) and even marks the
 * pattern "✅ implemented", but half the call sites fired `tap()` or nothing on open, and
 * eight never fired `heavy()` at all. That is invisible in a screenshot, invisible to tsc, and
 * not the kind of thing anyone reports; it just quietly meant a delete felt like a tap on some
 * screens and like a delete on others. Routing every one through here makes the documented
 * contract true by construction rather than by 16 people remembering it.
 *
 * `cancelLabel` defaults to the current language's "Cancel" — the same `getTranslations()`
 * read `showAppModal` already uses for its implicit OK, and correct for the same reason: this
 * is called at press time, not render time.
 *
 * NOT for a menu that happens to contain a destructive row (Shopping's ⋮ list options,
 * WeekListCard's), and not for a two-way choice with no cancel (Save / Discard) — this is the
 * confirm dialog specifically.
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  onConfirm,
  cancelLabel,
}: ConfirmDestructiveOptions) {
  warning();
  showAppModal(title, message, [
    { text: cancelLabel ?? getTranslations().cancel, style: 'cancel' },
    {
      text: confirmLabel,
      style: 'destructive',
      onPress: () => {
        heavy();
        onConfirm();
      },
    },
  ]);
}

export default function AppModalHost() {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const [request, setRequest] = useState<AppModalRequest | null>(null);
  const progress = useSharedValue(0);
  const seq = useRef(0);

  useEffect(() => {
    listener = (req) => {
      seq.current += 1;
      setRequest(req);
      progress.value = reducedMotion ? 1 : withTiming(1, { duration: Duration.modalIn, easing: Ease.enter });
    };
    return () => {
      listener = null;
    };
  }, [reducedMotion, progress]);

  function dismiss(onPress?: () => void) {
    const mySeq = seq.current;
    onPress?.();
    // onPress may have called showAppModal() again (e.g. a menu option opening a
    // confirm dialog) — if so, don't run our own exit animation over its entrance.
    if (seq.current !== mySeq) return;
    if (reducedMotion) {
      progress.value = 0;
      setRequest(null);
      return;
    }
    progress.value = withTiming(0, { duration: Duration.modalOut, easing: Ease.exit }, (done) => {
      if (done && seq.current === mySeq) runOnJS(setRequest)(null);
    });
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  if (!request) return null;

  /**
   * Matte glass (2026-08-17), through the same `glassKey()` components/Button.tsx draws — a
   * dialog button never went through that component, so it was one of the solid accent pills the
   * "glossy Web 2.0 plastic" ruling was actually about ("Start empty" is a button on this
   * component). `cancel` stays bodyless: a dialog needs one obvious way forward, and giving the
   * escape hatch a body of its own is what makes two buttons look like a choice between equals.
   *
   * Ink is `theme.text` on both filled styles, `destructive` included — see Button's note for the
   * measurement: a red label on a red wash fails AA at every usable alpha, so the red lives in
   * the (deeper, `loud`) wash instead of in the word.
   */
  function buttonLook(style?: AppModalButton['style']) {
    if (style === 'cancel') return { keyStyle: null, textColor: theme.textMuted, scaleTo: 0.97 };
    if (style === 'destructive')
      return { keyStyle: glassKey(theme.bad, isDark, 'loud'), textColor: theme.text, scaleTo: 0.93 };
    return { keyStyle: glassKey(theme.accent, isDark), textColor: theme.text, scaleTo: 0.95 };
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
                const { keyStyle, textColor, scaleTo } = buttonLook(btn.style);
                return (
                  <PressableScale
                    key={i}
                    style={[
                      styles.button,
                      // One or the other, never both, and neither is a `flex` shorthand —
                      // see the note on `buttonColumnItem`.
                      request.buttons.length === 2 ? styles.buttonRowItem : styles.buttonColumnItem,
                      keyStyle,
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
    fontFamily: Fonts.bold,
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
    // ⚠️ **NO `flex` HERE — see `buttonColumnItem`.** A `flex: N` shorthand alongside the
    // longhands below is what collapsed every stacked dialog on device. Each layout states
    // its own grow/shrink/basis, and neither states `flex`.
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  // Two buttons sit side by side and split the row — the `flex: 1` this replaces, spelled out
  // for the same reason the column's triple is (see below).
  buttonRowItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  buttonColumnItem: {
    // ⚠️ **These three must not be combined with a `flex` shorthand, and that is not a style
    // preference — it silently deletes the label on device (2026-08-18).**
    //
    // Yoga's `Node::processFlexBasis()` (ReactCommon/yoga/yoga/node/Node.cpp): when
    // `flexBasis` is `auto` it does NOT stop there — it falls through to `if (style.flex()
    // isDefined && > 0) return useWebDefaults() ? auto : points(0)`, and React Native leaves
    // `useWebDefaults_` false. So `flex: 1` + `flexBasis: 'auto'` resolves to **basis 0**, and
    // with `flexGrow: 0` beside it the button can never grow back: Yoga clamps it to
    // padding + border and the label is squeezed out of the box entirely. In a COLUMN
    // container that basis is the HEIGHT, so a stacked dialog rendered as blank pills — the
    // exact failure the header title had in 2026-07-16 (`HEADER_CLIP_DEBUG.md`; that file's
    // subtree, re-run in yoga-layout@3, still reproduces both).
    //
    // **Two buttons were never affected**, which is why this survived: `confirmDestructive` is
    // always Cancel + one red button, so it takes the ROW layout and never applies this style.
    // Only a 3+-button dialog stacks — the recurrence pickers, the destination picker, the
    // new-list chooser — and those are exactly the ones that shipped label-less.
    //
    // **react-native-web is the mirror image and cannot see it**, which is why the preview,
    // the wrap audit and every screenshot in `review-bundle/` show these dialogs correctly:
    // RNW emits the CSS `flex: 1` shorthand and then these longhands AFTER it, so
    // `flex-basis: auto` wins and the button sizes to its content. The comment that used to
    // sit here had it exactly backwards ("Native was always fine") because it was written from
    // the web symptom alone.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
  },
  buttonText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
});
