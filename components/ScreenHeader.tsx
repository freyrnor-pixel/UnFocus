/**
 * ScreenHeader.tsx — the standard screen top bar with tier-aware chrome.
 *
 * Tier 'site' (Decision 034): title left-aligned; Settings (gear) + Focus-mode (eye)
 * grouped in the opposite corner. Right-handed (default): title upper-left, controls
 * upper-right (Focus then gear outermost). Left-handed mirrors the whole row — controls
 * upper-left (gear outermost), title upper-right — so the controls stay thumb-reachable.
 * Tier 'sub': back link left (iOS only), title immediately right of it and left-aligned,
 * right slot for the screen-specific action (not mirrored). Wrapped in a translucent
 * Surface using surfaceContext="overlay" (stronger blur) since this header floats over
 * live scrolling content, not the calm ScreenBackground backdrop — the ambient default
 * let scrolled text read through it.
 *
 * Also owns two self-contained, opt-out-by-default extras (2026-07-13): every screen's
 * title is long-press-annotatable via DebugNoteAnchor (debug notes), and site-tier headers
 * show a debug-mode "export all notes" icon plus (Home only) an OTA "update available" icon.
 * Both read their own state directly from settings/expo-updates — no props threaded down
 * from individual screens.
 *
 * Connections:
 *   Imports → constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, store/useSettingsStore,
 *             store/useFeedbackStore, components/Surface, components/PressableScale,
 *             components/DebugNoteAnchor, components/AppModal (showAppModal), expo-router,
 *             expo-updates, react-native (Share, AppState, ActivityIndicator)
 *   Used by → ScreenScaffold (composition layer)
 *   Data    → reads `leftHanded`/`debugModeEnabled` from the settings store; reads/exports
 *             useFeedbackStore's notes; reads expo-updates' isEnabled/checkForUpdateAsync
 *
 * Edit notes:
 *   - tier='site' is for top-level screens (Shopping, Plans, Home, Health, Scan)
 *   - tier='sub' is for sub-screens (forms, editors, modals)
 *   - **Focus-mode toggle (Decisions 009 #4 / 001a / 018)**: the right-slot eye is a live
 *     toggle ONLY when the screen passes `onToggleFocus` (Home does). Its user-facing label
 *     is "Calm view" (`t.calmView*`) — deliberately distinct from the persisted Settings
 *     "Focus mode" (`config.essentials`) so the two names don't collide (Point 2). `focusActive` drives
 *     the filled ('eye') vs outline ('eye-outline') glyph and the accent tint. Focus mode is
 *     Home-only + ephemeral, so every other site screen omits both props and the eye stays a
 *     harmless no-op placeholder (its historical Phase-1 state) rather than showing an active
 *     control that does nothing. Home additionally gets a "Focus mode" text label next to the
 *     icon (reuses `t.config.essentials.label`) — the eye alone was too non-obvious an
 *     affordance; the label is gated on `onToggleFocus` so it never appears on the inert
 *     placeholder elsewhere.
 *   - Settings (gear) press navigates to /settings. Site-tier chrome placement is
 *     handedness-aware (reads `leftHanded`, Decision 034): title + the grouped gear/eye
 *     controls swap sides together — controls right (title left) by default, both left
 *     (title right) when left-handed. gear is always the outermost control.
 *   - iOS-only back link on sub-screens; Android uses system back
 *   - **Square corners (2026-07-13)**: `styles.header` forces `borderRadius: 0` — the
 *     header is an edge-to-edge full-width bar (no side margins), so Surface's default
 *     rounded-card corners had no floating card to belong to and, once the glass fill
 *     was stretched flush against the first content row, read as chopped-off corners.
 *     Don't re-add rounding here without also reintroducing a gap below the header.
 *   - **Debug notes (2026-07-13, replaces the old DebugOverlay)**: the title is wrapped in
 *     DebugNoteAnchor keyed off the (translated) `title` string — see that component's own
 *     edit note on the language-switch caveat this implies. The export icon (site-tier only)
 *     is gated on `debugModeEnabled` and shares export text/format with app/settings.tsx's
 *     Reset action; dimmed (not hidden) when there are zero notes, matching the old
 *     DebugOverlay's disabled-button convention.
 *   - **OTA update button (Home only)**: checks once on mount (i.e. once per app launch),
 *     again on every AppState 'active' transition, and on a 60s interval while the app
 *     stays open/foregrounded (Home's tab is kept alive by the pager, so this effect runs
 *     for the lifetime of the app, not just Home's own focus). `Updates.isEnabled` is false
 *     in dev/debug builds, so the button never renders there.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Share, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import { showAppModal } from '@/components/AppModal';

type Tier = 'site' | 'sub';

type Props = {
  title: string;
  tier: Tier;
  /** Home only — gates the OTA "update available" button. */
  isHome?: boolean;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Focus-mode toggle (Home only). When provided, the focus button is live. */
  focusActive?: boolean;
  onToggleFocus?: () => void;
  /** Info/hint toggle (optional). When provided, an ⓘ icon appears left of the focus button. */
  infoActive?: boolean;
  onInfoToggle?: () => void;
};

export default function ScreenHeader({ title, tier, isHome, onBack, headerRight, style, focusActive, onToggleFocus, infoActive, onInfoToggle }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const router = useRouter();
  const leftHanded = useSettingsStore((s) => s.leftHanded);
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);
  const feedbackNotes = useFeedbackStore((s) => s.notes);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  // OTA update check — Home only (see edit notes). Checks once on mount (app launch),
  // again whenever the app comes back to the foreground, and every 10min while the app
  // stays open so an update published mid-session still surfaces without needing a
  // background/foreground cycle. (Was every 60s — that's redundant with the foreground
  // check for a value that only changes when someone publishes an OTA, so it was mostly
  // idle network wake-ups; 10min keeps the same "surfaces without backgrounding" guarantee
  // at a fraction of the polling cost.)
  useEffect(() => {
    if (!isHome || !Updates.isEnabled) return;
    let cancelled = false;
    const check = () => {
      Updates.checkForUpdateAsync()
        .then((res) => { if (!cancelled) setUpdateAvailable(res.isAvailable); })
        .catch(() => { /* background check — silent, button just stays hidden */ });
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const interval = setInterval(check, 10 * 60_000);
    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(interval);
    };
  }, [isHome]);

  async function handleUpdatePress() {
    if (applyingUpdate) return;
    tap();
    setApplyingUpdate(true);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setApplyingUpdate(false);
      showAppModal(t.version.title, t.version.failed);
    }
  }

  async function handleExportPress() {
    tap();
    if (feedbackNotes.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const lines = [t.debug.exportHeading(date), ''];
    for (const n of feedbackNotes) {
      lines.push(`${n.anchorLabel} (${n.screen})`, n.note, '');
    }
    try {
      await Share.share({ message: lines.join('\n').trim() });
    } catch {
      // user cancelled or the share sheet failed — nothing to recover, no-op
    }
  }

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  const handleFocusPress = () => {
    // Live only when a screen wires it (Home, per Decisions 009 #4 / 018). Elsewhere a no-op.
    onToggleFocus?.();
  };

  // Site-tier chrome: the settings gear and the Focus-mode eye. Their corners follow
  // the `leftHanded` setting (whose label promises it "moves the menu button to the
  // left side"): gear sits top-right by default, and swaps to top-left when left-handed.
  const gearButton = (
    <PressableScale
      onPress={handleSettingsPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.settingsTitle}
      scaleTo={0.9}
    >
      <Ionicons name="settings-outline" size={24} color={theme.text} />
    </PressableScale>
  );
  const infoButton = onInfoToggle ? (
    <PressableScale
      onPress={onInfoToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={infoActive ? t.hideHint : t.showHint}
      accessibilityState={{ selected: !!infoActive }}
      scaleTo={0.9}
    >
      <Ionicons
        name={infoActive ? 'information-circle' : 'information-circle-outline'}
        size={24}
        color={infoActive ? theme.accent : theme.text}
      />
    </PressableScale>
  ) : null;

  const focusButton = (
    <PressableScale
      onPress={handleFocusPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!focusActive }}
      accessibilityLabel={focusActive ? t.calmViewActive : t.calmViewInactive}
      style={styles.focusButton}
      scaleTo={0.9}
    >
      {/* Label only where the toggle is live (Home) — elsewhere nothing is shown. */}
      {onToggleFocus && (
        <Text
          style={[styles.focusLabel, { color: focusActive ? theme.accent : theme.textMuted }]}
          numberOfLines={1}
        >
          {t.config.essentials.label}
        </Text>
      )}
    </PressableScale>
  );

  // Home-only OTA update icon (see edit notes) — a small spinner while fetching.
  const updateButton = isHome && updateAvailable ? (
    <PressableScale
      onPress={handleUpdatePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.version.updateAvailable}
      scaleTo={0.9}
    >
      {applyingUpdate ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <Ionicons name="cloud-download-outline" size={22} color={theme.accent} />
      )}
    </PressableScale>
  ) : null;

  // Debug-mode "export all notes" icon (site-tier only) — dimmed, not hidden, when empty
  // (matches the old DebugOverlay's disabled-button convention).
  const exportButton = debugModeEnabled ? (
    <PressableScale
      onPress={handleExportPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.debug.exportNotes}
      scaleTo={0.9}
      style={feedbackNotes.length === 0 ? styles.dimmed : undefined}
    >
      <Ionicons name="share-outline" size={22} color={theme.text} />
    </PressableScale>
  ) : null;

  const titleNode = (align: 'left' | 'right') => (
    <DebugNoteAnchor id={`header:${title}`} label={title} style={styles.titleWrap}>
      <Text
        style={[styles.title, { color: theme.text, textAlign: align }]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </DebugNoteAnchor>
  );

  if (tier === 'site') {
    // Grouped controls. Order (right-handed, left-to-right): [update] [export] [ⓘ info]
    // [Focus mode] [gear]. Gear is outermost on whichever side the group sits (Decision 034).
    // Left-handed mirrors the whole row. Items that don't apply to this screen are null/filtered.
    const focusButtonOrNull = onToggleFocus ? focusButton : null;
    const controlItems = [updateButton, exportButton, infoButton, focusButtonOrNull, gearButton].filter(Boolean) as React.ReactNode[];
    const controls = leftHanded ? [...controlItems].reverse() : controlItems;
    const controlsGroup = (
      <View style={styles.controls}>
        {controls.map((c, i) => (
          <View key={i}>{c}</View>
        ))}
      </View>
    );
    return (
      <Surface surfaceContext="overlay" style={[styles.header, style]}>
        {leftHanded ? (
          <>
            {controlsGroup}
            {titleNode('right')}
          </>
        ) : (
          <>
            {titleNode('left')}
            {controlsGroup}
          </>
        )}
      </Surface>
    );
  }

  // Sub tier: back link (iOS) leftmost, title immediately right of it and left-aligned,
  // right slot for the screen-specific action. Not mirrored (back link is platform-fixed).
  return (
    <Surface surfaceContext="overlay" style={[styles.header, style]}>
      {Platform.OS === 'ios' && onBack ? (
        <PressableScale onPress={onBack} hitSlop={8} scaleTo={0.97}>
          <Text style={[styles.back, { color: theme.accent }]}>{t.back}</Text>
        </PressableScale>
      ) : null}

      {titleNode('left')}

      <View style={styles.rightSlot}>{headerRight}</View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    // Edge-to-edge top bar (no side margins), not a floating card — rounding here has
    // no visual purpose and, since the glass Surface now fills the whole fixed-height
    // header band flush against the first content row (2026-07-13 dead-band fix), a
    // rounded bottom edge just collides with that content's square corner and reads as
    // "cut off". Square corners match the conventional full-bleed app-bar look.
    borderRadius: 0,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  focusLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    fontSize: FontSize.xxl,
    fontFamily: Fonts.bold,
    // Explicit, generous lineHeight (not just a bigger fontSize) — without it the
    // line box RN computes for bold text can be tighter than descenders (g/j/p/q/y)
    // need, clipping their bottoms regardless of how much room the header container
    // has. This was the real "header cutoff" bug; bumping HEADER_HEIGHT alone
    // (ScreenScaffold.tsx) never fixed it because the clip wasn't from that outer box.
    lineHeight: 36,
  },
  titleWrap: {
    flex: 1,
  },
  dimmed: {
    opacity: 0.4,
  },
  rightSlot: {
    minWidth: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  back: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
