/**
 * BlurTarget.tsx — wires expo-blur's Android backdrop-blur target ("Glass, take two", 2026-07-18).
 *
 * On Android, expo-blur's BlurView cannot frost "whatever is behind it" the way iOS/web do —
 * the Dimezis engine can only blur ONE designated view, handed to it as a `blurTarget` ref
 * (it snapshots that view's pixels). So the ambient backdrop (ScreenBackground) is wrapped in
 * a `<BlurTargetView>` here and its ref shared via context to every ambient glass Surface, whose
 * BlurView then blurs it with `blurMethod="dimezisBlurViewSdk31Plus"` (hardware RenderEffect on
 * SDK 31+, auto-fallback to 'none' below). iOS/web are unaffected: `BlurTargetView` is a plain
 * `View` there and GlassFill ignores the ref (their BlurView already blurs the real backdrop).
 *
 * Connections:
 *   Imports → react-native, expo-blur (BlurTargetView)
 *   Used by → app/(tabs)/_layout.tsx + components/ScreenScaffold (provide + wrap the backdrop),
 *             components/Surface → components/GlassFill (consume the ref via useBlurTarget)
 *   Data    → none (the on/off setting is `settings.glassBlur`, read in GlassFill)
 *
 * Edit notes:
 *   - Ref timing: BlurView reads `blurTarget.current` at render, but a child target's ref isn't
 *     attached until after commit. So the provider carries a `ready` flag flipped from the
 *     target's onLayout; flipping it changes the context value identity, which re-renders
 *     consumers so their BlurView re-resolves the now-attached node handle. Consumers must only
 *     use the ref once `ready` is true.
 *   - Only wrap STATIC backdrop layers in the source (ScreenBackground + hero), NOT the animated
 *     ParticleBackground — a continuously-dirty target forces the Dimezis engine to re-blur every
 *     frame. A static target is blurred once.
 *   - Never wrap an overlay/modal surface's backdrop: BlurTargetView can't cross a RN <Modal>'s
 *     separate native window (expo/expo#44165). Overlay/button glass keeps the dense wash instead.
 *   - The whole native-blur path is gated by `enabled` (settings.glassBlur) + Platform.OS: when
 *     off, the source renders a plain View and consumers get no ref, so nothing native is touched.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurTargetView } from 'expo-blur';

type BlurTargetValue = {
  /** Ref to the BlurTargetView wrapping the ambient backdrop (Android; a plain View elsewhere). */
  ref: React.RefObject<View | null>;
  /** True once the target has laid out and its ref node is attached — gate ref use on this. */
  ready: boolean;
  /** Flip `ready` true; called from the target's onLayout. */
  markReady: () => void;
};

const BlurTargetContext = createContext<BlurTargetValue | null>(null);

/** Ambient glass surfaces call this to get the backdrop blur target (or null if none in scope). */
export function useBlurTarget(): BlurTargetValue | null {
  return useContext(BlurTargetContext);
}

/**
 * Holds the shared backdrop-blur target ref and provides it to descendant glass surfaces.
 * Wrap the subtree that contains BOTH the backdrop (via BlurTargetSource) and the content whose
 * cards should frost it.
 */
export function BlurTargetProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<View | null>(null);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  // `ready` is in the memo deps so flipping it changes the value identity → consumers re-render
  // and their BlurView re-resolves the now-attached target node.
  const value = useMemo<BlurTargetValue>(() => ({ ref, ready, markReady }), [ready, markReady]);
  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

/**
 * Wraps the ambient backdrop so it can be sampled as a blur target. On Android (when `enabled`)
 * this is a real `<BlurTargetView>`; otherwise a plain `<View>` — so iOS/web and the disabled path
 * pay nothing. Always non-interactive (the backdrop never receives touches).
 */
export function BlurTargetSource({
  enabled,
  style,
  children,
}: {
  enabled: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const ctx = useContext(BlurTargetContext);
  const useNative = Platform.OS === 'android' && enabled && !!ctx;

  if (!useNative) {
    return (
      <View pointerEvents="none" style={style}>
        {children}
      </View>
    );
  }
  return (
    <BlurTargetView
      ref={ctx!.ref}
      pointerEvents="none"
      style={style ?? StyleSheet.absoluteFill}
      onLayout={ctx!.markReady}
    >
      {children}
    </BlurTargetView>
  );
}
