/**
 * ScreenHeader.tsx — the standard screen top bar with tier-aware chrome.
 *
 * Tier 'site' (Decision 034): title left-aligned; the Settings (gear) and other
 * controls grouped in the opposite corner. Right-handed (default): title upper-left,
 * controls upper-right (gear outermost). Left-handed mirrors the whole row — controls
 * upper-left (gear outermost), title upper-right — so the controls stay thumb-reachable.
 * Tier 'sub': back link left (iOS only), title immediately right of it and left-aligned,
 * right slot for the screen-specific action (not mirrored). Wrapped in a translucent
 * Surface using surfaceContext="overlay" (stronger blur) since this header floats over
 * live scrolling content, not the calm ScreenBackground backdrop — the ambient default
 * let scrolled text read through it.
 *
 * Also owns the self-contained debug-mode controls (2026-07-13, expanded 2026-07-19): every
 * screen's title is long-press-annotatable via DebugNoteAnchor (the title anchor is keyed
 * `screen:${pathname}` = the whole-screen note), and site-tier headers carry a bug-icon
 * toggle that flips `settings.debugModeEnabled` from anywhere. When debug is on, a green
 * checkmark (email ALL notes via mailto:, Share fallback) and a red circle (delete all,
 * confirmed) appear next to it. Home also shows an OTA "update available" icon. All read
 * their own state directly from settings/feedback/expo-updates — no props threaded down.
 *
 * Connections:
 *   Imports → constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, lib/feedbackMail
 *             (buildDebugNotesMailUrl/formatDebugNotesMessage), store/useSettingsStore,
 *             store/useFeedbackStore, components/Surface, components/PressableScale,
 *             components/DebugNoteAnchor, components/AppModal (showAppModal), expo-router,
 *             expo-updates, expo-constants, react-native (Share, Linking, AppState, ActivityIndicator)
 *   Used by → ScreenScaffold (composition layer)
 *   Data    → reads `leftHanded`/`debugModeEnabled` + writes `debugModeEnabled` (bug toggle)
 *             on the settings store; reads/emails/clears useFeedbackStore's notes; reads
 *             expo-updates' isEnabled/checkForUpdateAsync
 *
 * Edit notes:
 *   - tier='site' is for top-level screens (Shopping, Plans, Home, Health, Scan)
 *   - tier='sub' is for sub-screens (forms, editors, modals)
 *   - Settings (gear) press navigates to /settings. Site-tier chrome placement is
 *     handedness-aware (reads `leftHanded`, Decision 034): title + the grouped controls
 *     controls swap sides together — controls right (title left) by default, both left
 *     (title right) when left-handed. gear is always the outermost control.
 *   - iOS-only back link on sub-screens; Android uses system back
 *   - **Square corners (2026-07-13)**: `styles.header` forces `borderRadius: 0` — the
 *     header is an edge-to-edge full-width bar (no side margins), so Surface's default
 *     rounded-card corners had no floating card to belong to and, once the glass fill
 *     was stretched flush against the first content row, read as chopped-off corners.
 *     Don't re-add rounding here without also reintroducing a gap below the header.
 *   - **Header title clip — the full story (2026-07-16, see HEADER_CLIP_DEBUG.md)**: TWO
 *     real defects, fixed in rounds. (1) THE root cause: `styles.title` had `flex: 1` — once
 *     the Text was wrapped in titleWrap (a COLUMN View, added with DebugNoteAnchor Jul 13),
 *     that meant flexBasis:0 on its HEIGHT; Yoga (Android) then computes the Text frame 0dp
 *     tall WITHOUT ever calling the text measure function, so the glyphs paint from a
 *     zero-height frame and slice in a straight line — immune to every font/band fix, and
 *     invisible on react-native-web (browser flexbox resolves the same style from content).
 *     Do NOT re-add flex to the title Text. (2) Also real: with `allowFontScaling` on,
 *     Android treats style lineHeight as SP and multiplies by the font scale AGAIN
 *     (`TextAttributes.effectiveLineHeight`), so the title takes fontSize AND lineHeight
 *     verbatim (pre-scaled once by `getHeaderMetrics`) with `allowFontScaling={false}`.
 *     `includeFontPadding: false` + `textAlignVertical: 'center'` (#198) are kept. Debug
 *     mode renders a numbers caption (fontScale/sizes/onLayout box) + colored outlines
 *     (BLUE band in ScreenScaffold, RED Surface edge, GREEN title frame) so one tester
 *     screenshot pins any remaining clip to its exact box.
 *   - **Debug notes (2026-07-13, replaces the old DebugOverlay)**: the title is wrapped in
 *     DebugNoteAnchor keyed off the (translated) `title` string — see that component's own
 *     edit note on the language-switch caveat this implies. The export icon (site-tier only)
 *     is gated on `debugModeEnabled` and shares export text/format with app/settings.tsx's
 *     Reset action; dimmed (not hidden) when there are zero notes, matching the old
 *     DebugOverlay's disabled-button convention.
 *   - **OTA update button (Home only)**: visibility is driven by `Updates.useUpdates()` —
 *     shown when `isUpdateAvailable` (a newer update is on the server) OR `isUpdatePending`
 *     (one has already downloaded and is waiting for a reload to apply). The pending case is
 *     essential: expo-updates auto-downloads on launch but only applies on the *next* cold
 *     start, so a downloaded update is otherwise invisible (checkForUpdateAsync returns
 *     isAvailable:false once it's downloaded) and the app strands the user on the old bundle —
 *     the "published updates never arrive" bug. A separate effect still polls
 *     checkForUpdateAsync on mount / foreground / 10-min interval to surface mid-session
 *     server publishes; its results feed the hook. Tapping applies: reloadAsync() directly
 *     if pending, else fetchUpdateAsync()+reloadAsync(). `Updates.isEnabled` is false in
 *     dev/debug builds, so the button never renders there.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, PixelRatio, Platform, Share, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { FontSize, Fonts, Spacing, getHeaderMetrics } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { buildDebugNotesMailUrl, formatDebugNotesMessage } from '@/lib/feedbackMail';
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
  /** Info/hint toggle (optional). When provided, an ⓘ icon appears in the header controls. */
  infoActive?: boolean;
  onInfoToggle?: () => void;
};

export default function ScreenHeader({ title, tier, isHome, onBack, headerRight, style, infoActive, onInfoToggle }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const router = useRouter();
  const leftHanded = useSettingsStore((s) => s.leftHanded);
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);
  const updateSettings = useSettingsStore((s) => s.update);
  const feedbackNotes = useFeedbackStore((s) => s.notes);
  const clearAllNotes = useFeedbackStore((s) => s.clearAll);
  const pathname = usePathname();

  // Descender-safe title metrics, from the shared header helper (see getHeaderMetrics in
  // constants/theme.ts) so they stay in lockstep with the band height ScreenScaffold
  // derives from the same font scale. PRE-SCALED values — the title Text sets
  // `allowFontScaling={false}` and applies them verbatim; see the doc on getHeaderMetrics
  // for the double-scaling bug that arrangement fixes.
  const fontScale = PixelRatio.getFontScale();
  const { titleFontSize, titleLineHeight } = getHeaderMetrics(fontScale);

  // useUpdates() is reactive: isUpdateAvailable flips when a NEW server update is found;
  // isUpdatePending flips when one has finished DOWNLOADING and is waiting for a reload to
  // apply. expo-updates auto-downloads on launch but only applies on the *next* cold start,
  // so a downloaded update sits pending and invisible unless we surface isUpdatePending too —
  // that gap is why published updates seemed to "never arrive" (checkForUpdateAsync returns
  // isAvailable:false once the newest is already downloaded).
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const updateAvailable = isUpdateAvailable || isUpdatePending;
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
    // Actively poll the server for a newer update on mount, on every foreground, and every
    // 10min while open. Results flow into the useUpdates() hook above (checkForUpdateAsync
    // emits a state-change event it listens to), so there's no local state to set here — the
    // check just triggers; the hook drives the button. Errors stay silent (button hidden).
    const check = () => { Updates.checkForUpdateAsync().catch(() => {}); };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const interval = setInterval(check, 10 * 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [isHome]);

  async function handleUpdatePress() {
    if (applyingUpdate) return;
    tap();
    setApplyingUpdate(true);
    try {
      // If an update already finished downloading (pending), skip the fetch and just apply
      // it. Otherwise download it first. Either way reloadAsync() launches the new bundle.
      if (!isUpdatePending) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setApplyingUpdate(false);
      showAppModal(t.version.title, t.version.failed);
    }
  }

  // Toggle debug/annotate mode from the header bug icon — no notification re-sync needed
  // for this key, so a plain settings.update() is enough (matches how Settings toggles it).
  function handleDebugTogglePress() {
    tap();
    updateSettings({ debugModeEnabled: !debugModeEnabled });
  }

  // Green checkmark: email every note. Reuses the Send Feedback mailto: pattern
  // (buildDebugNotesMailUrl + Linking) with a Share-sheet fallback when no mail client
  // is available — OTA-safe, no expo-mail-composer dependency.
  async function handleEmailNotesPress() {
    tap();
    if (feedbackNotes.length === 0) return;
    const heading = t.debug.exportHeading(new Date().toISOString().slice(0, 10));
    const info = {
      appVersion: Constants.expoConfig?.version ?? '—',
      runtimeVersion: String(Updates.runtimeVersion ?? '—'),
      platform: Platform.OS,
      osVersion: Platform.Version,
    };
    const url = buildDebugNotesMailUrl(feedbackNotes, info, 'Unfocus@hlynsson.no', t.debug.mailSubject, heading);
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // fall through to Share
    }
    try {
      await Share.share({ message: formatDebugNotesMessage(feedbackNotes, heading) });
    } catch {
      // user cancelled or the share sheet failed — nothing to recover, no-op
    }
  }

  // Red delete circle: clear ALL notes, behind the shared reset-confirm modal.
  function handleDeleteAllPress() {
    tap();
    if (feedbackNotes.length === 0) return;
    showAppModal(t.resetConfirmTitle(t.debug.resetNotes.toLowerCase()), t.resetConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.resetConfirmBtn, style: 'destructive', onPress: () => clearAllNotes() },
    ]);
  }

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  // Site-tier chrome: the settings gear and sibling controls. Their corners follow
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

  // Debug/annotate toggle (site-tier only) — ALWAYS shown so testers can turn note-taking
  // on from anywhere; filled bug + accent tint when active. The email + delete satellites
  // below only appear once it's on.
  const bugButton = (
    <PressableScale
      onPress={handleDebugTogglePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.debug.toggleLabel}
      accessibilityState={{ selected: debugModeEnabled }}
      scaleTo={0.9}
    >
      <Ionicons name={debugModeEnabled ? 'bug' : 'bug-outline'} size={22} color={debugModeEnabled ? theme.accent : theme.text} />
    </PressableScale>
  );
  // Green checkmark: email all notes. Dimmed, not hidden, when there are none.
  const emailButton = debugModeEnabled ? (
    <PressableScale
      onPress={handleEmailNotesPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.debug.emailNotes}
      scaleTo={0.9}
      style={feedbackNotes.length === 0 ? styles.dimmed : undefined}
    >
      <Ionicons name="checkmark-circle" size={24} color={theme.good} />
    </PressableScale>
  ) : null;
  // Red circle: delete all notes (confirmed). Dimmed when empty.
  const deleteButton = debugModeEnabled ? (
    <PressableScale
      onPress={handleDeleteAllPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.debug.deleteAllNotes}
      scaleTo={0.9}
      style={feedbackNotes.length === 0 ? styles.dimmed : undefined}
    >
      <Ionicons name="close-circle" size={24} color={theme.bad} />
    </PressableScale>
  ) : null;

  const titleNode = (align: 'left' | 'right') => (
    <DebugNoteAnchor id={`screen:${pathname}`} label={title} style={styles.titleWrap}>
      {/* allowFontScaling MUST stay false: fontSize + lineHeight below are already scaled
          by getHeaderMetrics. With scaling left on, RN multiplies BOTH by the OS font
          scale again (Android treats them as SP — TextAttributes.effectiveLineHeight),
          double-scaling the line box past the single-scaled band = the header clip bug. */}
      <Text
        allowFontScaling={false}
        style={[
          styles.title,
          { color: theme.text, textAlign: align, fontSize: titleFontSize, lineHeight: titleLineHeight },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </DebugNoteAnchor>
  );

  if (tier === 'site') {
    // Grouped controls. Order (right-handed, left-to-right): [update] [bug] [✓ email]
    // [✕ delete] [ⓘ info] [gear]. The bug toggle is always present; the green
    // email + red delete only render when debug mode is on (they're null otherwise). Gear is
    // outermost on whichever side the group sits (Decision 034). Left-handed mirrors the whole
    // row. Items that don't apply to this screen are null/filtered.
    const controlItems = [updateButton, bugButton, emailButton, deleteButton, infoButton, gearButton].filter(Boolean) as React.ReactNode[];
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
  title: {
    // ⚠️ NO `flex: 1` here — THE root cause of the 7-fix header-clip saga (2026-07-16,
    // HEADER_CLIP_DEBUG.md round 2). This Text sits inside titleWrap (a COLUMN View via
    // DebugNoteAnchor), so flex:1 meant flexBasis:0 on its HEIGHT. Real-Yoga simulation
    // proved Android then computes the Text frame at 0dp tall WITHOUT EVER CALLING the
    // text measure function — the glyphs paint from a zero-height frame and get sliced
    // in a straight line, immune to every fontSize/lineHeight/band fix. Browser flexbox
    // (react-native-web) resolves the same style from content (41dp), so web never
    // reproduced it. Width is owned by titleWrap's flex:1 on the row axis; the Text
    // needs no flex at all.
    // extrabold (2026-07-18 typography pass) to match the Type.title role's weight — this
    // is a fontFamily-only change, it does NOT touch getHeaderMetrics' fontSize/lineHeight
    // math (see the file-level edit note above on why that must stay untouched).
    fontFamily: Fonts.extrabold,
    // fontSize AND lineHeight are applied INLINE from getHeaderMetrics (pre-scaled), with
    // `allowFontScaling={false}` on the Text — see the comment at titleNode and the
    // getHeaderMetrics doc for the double-scaling bug this arrangement fixes. Do NOT put a
    // fontSize/lineHeight back here or re-enable font scaling on the title.
    // includeFontPadding stays off (#198): Android otherwise adds font-metric padding on
    // top of lineHeight, offsetting the glyph down inside the numberOfLines=1 box.
    // textAlignVertical centers the glyph in the (1.45-ratio) line box, which reserves
    // room for descenders (j/g/p/y) AND top accents (å/ø).
    includeFontPadding: false,
    textAlignVertical: 'center',
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
    fontFamily: Fonts.semibold,
  },
});
