/**
 * ScreenHeader.tsx — the standard screen top bar with tier-aware chrome.
 *
 * Tier 'site' (Decision 034): title left-aligned; the Settings (gear) and other
 * controls grouped in the opposite corner. Right-handed (default): title upper-left,
 * controls upper-right (gear outermost). Left-handed mirrors the whole row — controls
 * upper-left (gear outermost), title upper-right — so the controls stay thumb-reachable.
 * Tier 'sub': back link left (iOS only), title immediately right of it and left-aligned,
 * right slot for the screen-specific action (not mirrored).
 *
 * **The card is ALWAYS there, and it is OPAQUE (2026-08-20).** Maintainer: *"Make top header
 * card always visible"*, together with *"the corners should show content behind it"*. Those two
 * are one decision, and the second is what forces the first:
 * `components/ScreenScaffold.tsx`'s clip window runs the chrome's full height again, so cards
 * genuinely scroll BEHIND this row — which means the row needs a fill at every scroll offset,
 * and that fill has to hide what passes under it. `theme.surfaceRaised` is the same opaque rung
 * `Surface`'s `overlay` context paints, and there is no `BlurView`: an opaque fill under a live
 * blur still smears the card behind onto the pane (the 2026-08-18 lesson from the card menu),
 * so the fill and the frost come off together or not at all.
 *
 * This reverses TWO shipped passes, deliberately, and neither comes back piecemeal:
 *   - **2026-08-16, "no pill background at rest"** — the row sat directly on
 *     `components/ScreenBackground.tsx` with nothing behind it, and a `scrolled` prop mounted a
 *     frosted backdrop only once the ScrollView had moved. There is no `scrolled` prop any more;
 *     a header that is only sometimes a card is exactly what the maintainer asked to end.
 *   - **2026-08-15's frosted chrome** — the frost was correct while content could not reach
 *     behind the glass. It can now, so frost here means reading the app's own cards through the
 *     title. Same reasoning, same answer as `Surface`'s `overlapsCards`, which the nav bar now
 *     takes for the identical reason.
 * `settings.glassSurfaces` (reduce-transparency) needs no branch here — opaque is already what
 * it would ask for.
 *
 * Also owns the self-contained debug-mode controls (2026-07-13, expanded 2026-07-19): every
 * screen's title is long-press-annotatable via DebugNoteAnchor (the title anchor is keyed
 * `screen:${pathname}` = the whole-screen note). While debug mode is ON, site-tier headers
 * carry three icons: a bug (tap = turn debug back off), a green checkmark (email ALL notes
 * via mailto:, Share fallback) and a red circle (delete all, confirmed). All three are
 * hidden while it's off — turning debug ON is Settings → Advanced only (2026-07-25). Home
 * also shows an OTA "update available" icon. All read their own state directly from
 * settings/feedback/expo-updates — no props threaded down.
 *
 * Site-tier headers also accept an optional `onSharePress` — when a screen passes it, a share
 * icon appears in the controls group. `onScanPress` still exists but **no screen passes it any
 * more** (2026-08-13): the camera moved to a per-card action, because one header icon could not
 * know which list you meant and so could only ever ADD rows. See lib/scanTarget.ts.
 *
 * Connections:
 *   Imports → constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, lib/feedbackMail
 *             (buildDebugNotesMailUrl/formatDebugNotesMessage), store/useSettingsStore,
 *             store/useFeedbackStore, components/PressableScale, components/DebugNoteAnchor,
 *             components/AppModal (showAppModal), expo-router, expo-updates, expo-constants,
 *             react-native (Share, Linking, AppState, ActivityIndicator)
 *             (2026-08-20: expo-blur is NO LONGER imported — the card is opaque, see above)
 *   Used by → ScreenScaffold (composition layer)
 *   Data    → reads `leftHanded`/`debugModeEnabled` + writes `debugModeEnabled`
 *             (bug toggle) on the settings store; reads/emails/clears useFeedbackStore's notes;
 *             reads expo-updates' isEnabled/checkForUpdateAsync
 *
 * Edit notes:
 *   - tier='site' is for top-level screens (Shopping, Plans, Home, Health, Scan)
 *   - tier='sub' is for sub-screens (forms, editors, modals)
 *   - Settings (gear) press navigates to /settings. Site-tier chrome placement is
 *     handedness-aware (reads `leftHanded`, Decision 034): title + the grouped controls
 *     controls swap sides together — controls right (title left) by default, both left
 *     (title right) when left-handed. gear is always the outermost control.
 *   - iOS-only back link on sub-screens; Android uses system back
 *   - **Corners are decided by ScreenScaffold, not here (updated 2026-07-23)**: `styles.header`
 *     still defaults `borderRadius: 0`, but ScreenScaffold's floated-header pass now passes a
 *     `borderRadius: Radius.lg` in the `style` prop (which wins over styles.header in the array)
 *     for every screen EXCEPT plainBackground (Settings). Floating is safe to round because the
 *     scaffold also adds side margins and a gap below the header, so the old failure mode — a
 *     rounded bottom corner colliding with the first content row's square corner (the reason 0
 *     was forced on 2026-07-13) — no longer applies. Settings keeps the square edge-to-edge
 *     app-bar. Don't hard-code rounding back on here; it's the scaffold's call per screen.
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
 *     Shopping's then-5-icon control group (bug/scan/share/info/gear, vs. Home's 3) left
 *     titleWrap's flex:1 too narrow for "SHOPPING"/"HANDLELISTE", which ellipsized.
 *     **Autosize hack REMOVED (2026-07-24 second pass)**: the `adjustsFontSizeToFit` +
 *     `minimumFontScale` approach (first unconditional, then gated on a `shrinkTitle`
 *     control-count check) is gone entirely. On Android `adjustsFontSizeToFit` with
 *     `numberOfLines={1}` in a narrow box shrinks the font FAR below `minimumFontScale`
 *     (a known RN Android bug), which made Shopping's title render tiny — the visible
 *     defect. Every header now renders its title at the single fixed `getHeaderMetrics`
 *     `titleFontSize`/`titleLineHeight` (still applied inline with `allowFontScaling={false}`),
 *     so all screens match. Horizontal room for the long title next to 5 icons comes from
 *     tightening the layout instead: `styles.controls` gap and the header row `gap` both
 *     dropped Spacing.md → Spacing.sm, and `HEADER_TITLE_BASE_SIZE` (constants/theme.ts)
 *     dropped 28 → 24 (a deliberate, uniform reduction — the maintainer wants one consistent
 *     header size). Band-height stays in lockstep because getHeaderMetrics derives it from the
 *     same base size. Note: with debug mode ON, Shopping shows up to 7 icons (adds bug + email
 *     + delete), which can still ellipsize the long title — an accepted tester-only edge. Since
 *     2026-07-25 the default is lighter: bug/email/delete are hidden unless debug is on, and
 *     scan/share only appear when their feature flags are on. **Since 2026-08-13 the ⓘ is gone
 *     too** (maintainer: "Having the info button in the header section with settings showing
 *     when you press it makes No sense") — a screen's explanation is an inline, closable intro
 *     card at the top of its content now (components/HintCard's `noPill` mode +
 *     lib/useFirstVisitHint). So a fresh install's Shopping header is just [scan] [gear], and
 *     `infoActive`/`onInfoToggle` no longer exist on this component or on ScreenScaffold.
 *   - **Debug notes (2026-07-13, replaces the old DebugOverlay)**: the title is wrapped in
 *     DebugNoteAnchor keyed off the (translated) `title` string — see that component's own
 *     edit note on the language-switch caveat this implies. The export icon (site-tier only)
 *     is gated on `debugModeEnabled` and shares export text/format with app/settings.tsx's
 *     Reset action; dimmed (not hidden) when there are zero notes, matching the old
 *     DebugOverlay's disabled-button convention. The bug icon itself is gated the same way
 *     now — it only ever turns debug OFF, so it can't be the way a new user turns it on.
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
import { FontSize, Fonts, OpticalCenter, Spacing, getHeaderMetrics, HitSlop } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { buildDebugNotesMailUrl, formatDebugNotesMessage } from '@/lib/feedbackMail';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import PressableScale from '@/components/PressableScale';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import { confirmDestructive, showAppModal } from '@/components/AppModal';

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
  /** Site-tier only. When provided, a share icon appears in the header controls. */
  onSharePress?: () => void;
  /** Site-tier only. When provided, a scan icon appears in the header controls. */
  onScanPress?: () => void;
  /** Opens this surface's card-layout picker (components/LayoutPickerSheet.tsx). */
  onLayoutPress?: () => void;
};

export default function ScreenHeader({ title, tier, isHome, onBack, headerRight, style, onSharePress, onScanPress, onLayoutPress }: Props) {
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
    if (feedbackNotes.length === 0) return;
    confirmDestructive({
      title: t.resetConfirmTitle(t.debug.resetNotes.toLowerCase()),
      message: t.resetConfirmBody,
      confirmLabel: t.resetConfirmBtn,
      onConfirm: () => clearAllNotes(),
    });
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
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.settingsTitle}
      scaleTo={0.9}
    >
      <Ionicons name="settings-outline" size={24} color={theme.text} />
    </PressableScale>
  );
  const shareButton = onSharePress ? (
    <PressableScale
      onPress={onSharePress}
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.shareTitle}
      scaleTo={0.9}
    >
      <Ionicons name="share-social-outline" size={22} color={theme.text} />
    </PressableScale>
  ) : null;
  const scanButton = onScanPress ? (
    <PressableScale
      onPress={onScanPress}
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.shopping.scan}
      scaleTo={0.9}
    >
      <Ionicons name="camera-outline" size={22} color={theme.text} />
    </PressableScale>
  ) : null;
  // "How this list looks" — opens the surface's own LayoutPickerSheet. Lives on the header
  // rather than in Settings so the choice is made while looking at the list it changes; the
  // global default still lives in Settings → Personal → Layout.
  const layoutButton = onLayoutPress ? (
    <PressableScale
      onPress={onLayoutPress}
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.config.layouts.title}
      scaleTo={0.9}
    >
      <Ionicons name="list-outline" size={22} color={theme.text} />
    </PressableScale>
  ) : null;

  // Home-only OTA update icon (see edit notes) — a small spinner while fetching.
  const updateButton = isHome && updateAvailable ? (
    <PressableScale
      onPress={handleUpdatePress}
      hitSlop={HitSlop.base}
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

  // Debug/annotate toggle (site-tier only) — shown ONLY while debug mode is already on,
  // as the one-tap way back out; the email + delete satellites below appear alongside it.
  // Turning debug ON now lives solely in Settings → Advanced (2026-07-25 reorganization):
  // this icon used to render on every site-tier header for every user, so a first-time
  // user could switch on the tester annotation tooling by accident, and it was a
  // permanent 5th icon in Shopping's control group (the title-truncation pressure
  // documented above).
  const bugButton = debugModeEnabled ? (
    <PressableScale
      onPress={handleDebugTogglePress}
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.debug.toggleLabel}
      accessibilityState={{ selected: debugModeEnabled }}
      scaleTo={0.9}
    >
      <Ionicons name="bug" size={22} color={theme.accent} />
    </PressableScale>
  ) : null;
  // Green checkmark: email all notes. Dimmed, not hidden, when there are none.
  const emailButton = debugModeEnabled ? (
    <PressableScale
      onPress={handleEmailNotesPress}
      hitSlop={HitSlop.base}
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
      hitSlop={HitSlop.base}
      accessibilityRole="button"
      accessibilityLabel={t.debug.deleteAllNotes}
      scaleTo={0.9}
      style={feedbackNotes.length === 0 ? styles.dimmed : undefined}
    >
      <Ionicons name="close-circle" size={24} color={theme.bad} />
    </PressableScale>
  ) : null;

  // Site-tier control count, needed before titleNode below decides whether to shrink-to-fit.
  // Grouped controls order (right-handed, left-to-right): [update] [bug] [✓ email] [✕ delete]
  // [layout] [scan] [share] [ⓘ info] [gear]. Bug + email + delete all render only while debug
  // mode is on (null otherwise), so the default header is two icons lighter than it used to be;
  // layout/share/scan only render when the screen passes onLayoutPress/onSharePress/onScanPress,
  // which Shopping now does only when the matching feature flag is on. Gear is outermost on
  // whichever side the group sits (Decision 034). Items that don't apply are null/filtered.
  const siteControls = tier === 'site'
    ? ([updateButton, bugButton, emailButton, deleteButton, layoutButton, scanButton, shareButton, gearButton].filter(Boolean) as React.ReactNode[])
    : [];

  // The card itself (see the file header's "The card is ALWAYS there" note): one opaque
  // absoluteFill wash on the same `surfaceRaised` rung `Surface`'s `overlay` context paints,
  // mounted unconditionally. No scroll gate — a header that is only sometimes a card is what
  // this replaced — and no `BlurView`, because content genuinely passes behind this row now and
  // frost would make the app's own cards legible through the title. `styles.headerClip` is what
  // keeps it inside whatever corner radius ScreenScaffold passes.
  const headerBackdrop = (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceRaised }]} />
  );

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
    const controls = leftHanded ? [...siteControls].reverse() : siteControls;
    const controlsGroup = (
      <View style={styles.controls}>
        {controls.map((c, i) => (
          <View key={i}>{c}</View>
        ))}
      </View>
    );
    return (
      <View style={[styles.header, styles.headerClip, style]}>
        {headerBackdrop}
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
      </View>
    );
  }

  // Sub tier: back link (iOS) leftmost, title immediately right of it and left-aligned,
  // right slot for the screen-specific action. Not mirrored (back link is platform-fixed).
  return (
    <View style={[styles.header, styles.headerClip, style]}>
      {headerBackdrop}
      {Platform.OS === 'ios' && onBack ? (
        <PressableScale onPress={onBack} hitSlop={HitSlop.base} scaleTo={0.97}>
          <Text style={[styles.back, { color: theme.accent }]}>{t.back}</Text>
        </PressableScale>
      ) : null}

      {titleNode('left')}

      <View style={styles.rightSlot}>{headerRight}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    // Spacing.md (not .sm) top+bottom so this row's own height exactly fills
    // getHeaderMetrics' headerHeight (titleLineHeight + Spacing.sm*2 + Spacing.md — the two
    // constants sum the same either way since Spacing.md === Spacing.sm*2). Surface's inner
    // content view isn't stretched to the band's full height (it sizes to its own content,
    // see Surface.tsx's mask/content split), so with the old Spacing.sm padding the row fell
    // short of the band and sat top-aligned inside it, reading as "not centered" — the extra
    // Spacing.md of band slack all landed below the title as dead space instead of split
    // above/below it. Matching the row's own height to the band removes that leftover gap.
    paddingVertical: Spacing.md,
    // Row gap between the title (flex:1) and the controls group. Spacing.sm (was .md) so a
    // long title like "HANDLELISTE" gets a few more dp next to a crowded 5-icon control row —
    // part of the 2026-07-24 fix that dropped the Shopping-only autosize shrink hack. Vertical
    // padding stays Spacing.md (band-height math depends on it — do NOT change that one).
    gap: Spacing.sm,
    // Edge-to-edge top bar (no side margins), not a floating card — rounding here has
    // no visual purpose against a flush background. `ScreenScaffold` overrides this to
    // `Radius.lg` for floating screens, which `headerClip` (below) is what actually clips to.
    borderRadius: 0,
  },
  // `overflow: 'hidden'` so the card's absoluteFill wash clips to whatever `borderRadius` the
  // caller's `style` sets, instead of squaring off past the rounded corners `ScreenScaffold`
  // passes for a floating header. Load-bearing since 2026-08-20: the wash is opaque and always
  // mounted, so an unclipped one would paint over the very corner notches that are supposed to
  // show the content scrolling behind it.
  headerClip: {
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    // Spacing.sm (was .md) between control icons — tightens the group so Shopping's 5-icon
    // row (bug/scan/share/info/gear) leaves room for the full "HANDLELISTE" title without an
    // ellipsis, now that the per-screen autosize shrink hack is gone (2026-07-24).
    gap: Spacing.sm,
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
    // OpticalCenter stays on (#198): Android otherwise adds font-metric padding on top of
    // lineHeight, offsetting the glyph down inside the numberOfLines=1 box. Its
    // textAlignVertical half centers the glyph in the (1.45-ratio) line box, which reserves
    // room for descenders (j/g/p/y) AND top accents (å/ø).
    ...OpticalCenter,
    // Sentence-case title (2026-07-28 design review). The 2026-07-20 header-prominence pass
    // set `textTransform: 'uppercase'` here; at HEADER_TITLE_BASE_SIZE (24) that put all-caps
    // at a heading size, where platform convention (iOS grouped headers, Material overline)
    // reserves it for ≤13px labels. Prominence now comes from size + extrabold weight alone.
    // Small uppercase labels elsewhere (StarterCard's "EXAMPLE", the FontSize.xs sectionLabel
    // styles) are the correct use of it and are deliberately left alone.
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
