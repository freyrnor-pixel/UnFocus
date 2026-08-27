/**
 * CenterModalScreen.tsx — an editor that opens as a card in the middle of the screen.
 *
 * The shell every converted editor/form route uses instead of components/ScreenScaffold.tsx
 * (2026-08-20). Maintainer: *"Never go to another page, pop-up from the middle of the screen
 * instead."* A scrim, a centred `Surface` capped at a fraction of the viewport, a title row with
 * an × , and the body inside its own scroll — so opening a habit or a health entry no longer
 * takes the whole screen away and replaces it.
 *
 * **The route is unchanged, only its presentation.** Each converted screen is still its own
 * Expo Router route with its own params, still closes with `router.back()`, and still holds all
 * of its own state. What changed is one line in app/_layout.tsx: `presentation:
 * 'transparentModal'` instead of a push. That is why this was a shell swap rather than a
 * refactor — nothing had to be lifted into props, and `useLocalSearchParams` keeps working.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, constants/motion,
 *             lib/useAppTheme, lib/i18n, lib/haptics, lib/screenColor (the pane wears the
 *             domain hue its screen always had), react-native-safe-area-context
 *   Used by → the converted editor routes: app/habit-form.tsx, app/medicine-form.tsx,
 *             app/health-form.tsx, app/health-detail.tsx, app/health-log.tsx, app/day-log.tsx,
 *             app/notes.tsx, app/food.tsx, app/catalogue.tsx, app/habits.tsx, app/budget.tsx,
 *             app/inventory-edit.tsx
 *   Data    → none — presentation only.
 *
 * Edit notes:
 *   - **⚠️ It is the `overlay` surface tier, so it is OPAQUE and mounts no blur.** That is the
 *     2026-08-18 rule and it is not a style choice here: this pane is guaranteed to have the
 *     app's own cards behind it, and a translucent one smears them onto the editor's own
 *     fields. `Surface`'s `surfaceContext="overlay"` does both halves in one gate — an opaque fill
 *     under a live BlurView is the bug in a form that looks half-fixed.
 *   - **`screenKey` is kept from the screen it replaced**, so the pane still wears its domain's
 *     hue exactly as the pushed version did, and every ambient `Surface` inside it still adopts
 *     that hue through `ScreenColorContext`. Dropping it would leave every editor neutral —
 *     invisible in a screenshot, and a real loss of the "which part of the app is this" cue.
 *   - **The scrim dismisses, and that is safe HERE specifically**: every converted screen either
 *     commits as you type (the browse screens) or has its own explicit Save/Discard pair whose
 *     Discard is what a tap-away means anyway. A future editor with an unsaved-changes trap
 *     should pass `dismissOnScrim={false}` rather than teaching this component about drafts.
 *   - **`scrollable={false}` hands scrolling to the child**, same contract ScreenScaffold has,
 *     for a body that owns a FlatList (app/catalogue.tsx). The child then gets a bounded box
 *     rather than a growing one, which is what a nested list needs.
 *   - ⚠️ **`KeyboardAvoidingView` behaviour differs by platform and both are needed.** iOS
 *     `padding` shrinks the pane; Android relies on `windowSoftInputMode=resize` and needs
 *     `height` to avoid double-shifting. This is the one part of the file no harness here can
 *     check — react-native-web has no soft keyboard — so it needs a device pass.
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, HitSlop, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { getScreenColor, ScreenColorContext, type ScreenKey } from '@/lib/screenColor';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap } from '@/lib/haptics';

/**
 * How much of the viewport the pane may take. Deliberately short of the whole thing in both
 * axes: the point of the pop-up is that you can still SEE the screen you came from around it,
 * which is what makes it read as "over this" rather than "instead of this". A pane at 100%
 * would be a pushed screen with extra steps.
 */
const MAX_WIDTH = '92%' as const;
const MAX_HEIGHT_RATIO = 0.85;

type Props = {
  title: string;
  /** Closes the pop-up. Every caller passes `router.back()` — the route is still a real route. */
  onClose: () => void;
  /** The domain hue this editor's pushed version wore. See the edit note. */
  screenKey?: ScreenKey;
  /** Header-side controls (a Save action, the catalogue's camera + lock). */
  headerRight?: React.ReactNode;
  /** False when the child owns its own scrolling (a FlatList). Same contract as ScreenScaffold. */
  scrollable?: boolean;
  /** Off for an editor that would lose unsaved work to a stray tap. See the edit note. */
  dismissOnScrim?: boolean;
  children: React.ReactNode;
};

export default function CenterModalScreen({
  title,
  onClose,
  screenKey,
  headerRight,
  scrollable = true,
  dismissOnScrim = true,
  children,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  // The pane is centred inside the SAFE area, not the raw window: at 85% of a notched screen
  // the header row is the part that would otherwise sit under the notch.
  const insets = useSafeAreaInsets();

  const screenHue = React.useMemo(
    // `null` for a deliberately-neutral key, not that key's grey base — same collapse
    // components/ScreenScaffold.tsx makes, and for the same reason: every consumer already
    // falls back to `theme.border`, so nothing drawn changes, and `null` starts meaning
    // "no hue" rather than "grey" for `useControlHue`.
    () => {
      if (!screenKey) return null;
      const hue = getScreenColor(theme, screenKey);
      return hue.neutral ? null : hue.base;
    },
    [theme, screenKey],
  );

  function close() {
    tap();
    onClose();
  }

  return (
    <ScreenColorContext.Provider value={screenHue}>
      <View style={styles.root}>
        {/* The scrim. `Pressable` rather than a tappable View so it takes the touch that would
            otherwise land on whatever is behind the modal — a transparentModal does not block
            input by itself. */}
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={dismissOnScrim ? close : undefined}
          accessibilityRole="button"
          accessibilityLabel={t.closePopupLabel}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.centre, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}
          pointerEvents="box-none"
        >
          {/* `surfaceContext="overlay"` is the load-bearing prop — see the edit note. It is
              what makes this pane opaque AND blur-less in one gate. */}
          <Surface surfaceContext="overlay" style={styles.pane}>
            <View style={[styles.header, { borderBottomColor: theme.rule }]}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {title}
              </Text>
              {headerRight}
              {/* × is LAST, after the caller's own controls — the same ordering rule the card
                  headers settled on in this pass, for the same reason: the control that
                  DISMISSES the surface belongs in its corner. */}
              <PressableScale
                onPress={close}
                hitSlop={HitSlop.base}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={t.closePopupLabel}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </PressableScale>
            </View>
            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              // The child scrolls itself; it gets a BOUNDED box so its own list can size
              // against something, which a growing container would not give it.
              <View style={[styles.body, styles.bodyContent]}>{children}</View>
            )}
          </Surface>
        </KeyboardAvoidingView>
      </View>
    </ScreenColorContext.Provider>
  );
}

const baseStyles = StyleSheet.create({
  root: { flex: 1 },
  // Deliberately not `theme.bg`: the scrim's job is to dim what is behind it, which means it
  // has to be the same on both palettes. Matches components/AppModal.tsx's own backdrop.
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  pane: {
    width: MAX_WIDTH,
    maxHeight: `${Math.round(MAX_HEIGHT_RATIO * 100)}%`,
    borderRadius: Radius.lg,
    // No padding on the pane itself — the header owns its own, and the body owns its own, so
    // the header's hairline can run the full width of the card instead of stopping short of it.
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // `flex: 1` + `minWidth: 0` so the title takes the slack and the trailing controls stay
  // clustered at the right edge — the wrap-audit pairing, without which a long Norwegian title
  // shoves the × past the pane's clip.
  title: { flex: 1, minWidth: 0, fontFamily: Fonts.bold, fontSize: FontSize.lg },
  closeBtn: { padding: Spacing.xs },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: Spacing.md, gap: Spacing.md },
});
