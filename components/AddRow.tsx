/**
 * AddRow.tsx — ONE of the app's three "add a row" composers (design criteria 2, 3, 4).
 *
 * ⚠️ **This header used to open "the ONE add-a-row affordance". That is not true and has not
 * been for some time** (corrected 2026-08-08). It replaced the *older* mix — the floating
 * AddFAB, the AddDivider line+dot, dashed "new" cards — but two other composers grew up
 * beside it, each with its own idea of which settings matter while you type:
 *   - **`components/PadTypeRow.tsx` + `QuickAddOptionsPanel`** — a bordered field, always
 *     open, over a wrapping grid of labelled option cells. Home's four cards, the Habits tab,
 *     the To-do timeline. This is the newest of the three and the one with a real settings
 *     hierarchy.
 *   - **`components/InlineAddItem.tsx`** — collapsed bar → a whole panel (name + catalog
 *     autocomplete + price + category chips + qty stepper + temporary toggle). Shopping and
 *     inventory only.
 *   - **this file** — collapsed `+ label` pill → input + Save/Delete, plus an `extras` slot
 *     and a `panel` slot. Plans, Health, Goals, Food, Catalogue, Medicine.
 * **The fields are ALREADY converged** — all three draw the same bordered, focus-showing field
 * (this one got it on 2026-08-05; `InlineAddItem` by using `FormControls`' `Input` outright),
 * and `panel` below takes the same `QuickAddOptionsPanel` node under the same
 * one-of-`extras`/`panel` contract as `PadTypeRow`'s prop of the same name. So "converge the
 * composers" is not the open work and shouldn't be re-proposed.
 *
 * What differs is the TIERING of settings, and this file's gap is specific: **it has no tier 3.**
 * `PadTypeRow` carries an `onMore` button opening a fuller editor; there is no equivalent here,
 * so a surface built on this composer cannot offer one from the line. That is a known gap, not
 * an oversight — see AGENTS.md "The hierarchy of settings when making a row" for the contract
 * and the who-implements-what table. Don't cite this file as the settled shape, and don't add
 * a fourth composer.
 *
 * A two-state add control mounted at the bottom of (or within) whatever list/section it
 * feeds — so the add control stays visually connected to the thing it adds to (criterion 1).
 *
 * Two states (2026-07-19, "make + intuitive"): it now COLLAPSES to a labelled "+ <placeholder>"
 * bar by default instead of sitting as a permanent empty input (which read as clutter / an
 * unclear affordance). Tapping the bar EXPANDS it into an editable row — an autofocused input
 * plus two explicit buttons: a **Save** confirm (the old accent-fill button; disabled/recessed
 * until there's text) and a **Delete** discard (neutral "close") that drops the in-progress row.
 * Saving commits via onSubmit and collapses back to the "+" bar (discrete one-row-at-a-time);
 * Delete (or blurring an empty row) also collapses. Both bar and editing row share one fixed
 * ~44px container, so the swap is snappy with no layout jump.
 *
 * The confirm/Save button reads as inert while the input is empty — it IS disabled then
 * (submitting needs text), so it's a flat, recessed well (surfaceMuted + a neutral edge, no
 * shadow) rather than masquerading as a ready-to-tap control. Once there's text it becomes
 * raised and pressable-looking — fills with `accent` (default theme.good) + Shadow.button + a
 * uniform light edge, depth "toward the user". (2026-07-24: was a top-only border, which renders
 * as a stray arc/seam on a fully-rounded circle — switched to a uniform borderWidth all round,
 * matching IconButton's keycap-edge convention.) It defaults to a "+" glyph; callers whose row
 * already shows a +/− stepper in `extras` pass confirmIcon="checkmark" so two identical "+"
 * buttons never sit adjacent (criterion 6).
 *
 * Connections:
 *   Imports → constants/theme (BORDER_WIDTH, computeBorderTone, …), lib/useAppTheme,
 *             lib/screenColor, lib/i18n, lib/haptics, components/PressableScale,
 *             components/ScreenScaffold (ScrollIntoViewContext), @expo/vector-icons
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/health.tsx, app/health-log.tsx, app/goals.tsx,
 *             components/GoalsSheet.tsx, components/CatalogueTab.tsx, components/FoodTab.tsx,
 *             components/MedicineTrayCard.tsx
 *             (re-measured 2026-08-08 — this list previously named shopping.tsx, habits.tsx
 *             and automations.tsx, none of which import this file: shopping uses
 *             InlineAddItem, habits uses PadTypeRow, and app/automations.tsx still exists
 *             but no longer draws an AddRow)
 *   Data    → none — presentational; fires onSubmit
 *
 * Edit notes:
 *   - **Bordered "+" pill (2026-07-25, user report)**: the collapsed bar now carries a real
 *     `theme.border` outline + `Radius.md` corners (was borderless, just an icon chip + muted
 *     text), so it reads as one contained control sitting close to the list above it instead of
 *     bare text floating in blank space. Border color is neutral (`theme.border`), not `accent`
 *     — this component is used both inside domain-colored cards and on plain screens
 *     (automations, health-log), so a neutral edge is the one choice that's always correct;
 *     the "+" chip itself still carries the accent fill.
 *   - Mount inside the section's Surface (like ExpandableCard) — do NOT wrap it in
 *     its own card, or the add row detaches from its list.
 *   - `accent` should come from lib/domainColor.getDomainColor(theme, domain).accent
 *     so the "+" bar glyph and the confirm fill match the screen's identity color.
 *   - Confirm/Delete targets are padded to ≥44px; the row itself is minHeight 44.
 *   - Collapse/expand is an instant content swap (both states share the ~44px row height), so
 *     there's no LinearTransition/Collapsible height animation to get wrong — the intuitive
 *     signal is the autofocus + the appearing Save/Delete buttons. PressableScale supplies the
 *     press haptic on the "+" bar; Save fires confirm() at the commit moment.
 *   - **Keyboard-avoidance (2026-07-13, fixes taps going dead; 2026-07-16 made row-relative)**:
 *     Android's default `windowSoftInputMode=resize` can leave this row hidden behind the
 *     keyboard once it opens (the viewport shrinks but nothing scrolls to compensate) — the
 *     input+confirm button silently become untappable. On focus (and on `keyboardDidShow`)
 *     this component hands the enclosing ScreenScaffold its OWN View node via
 *     ScrollIntoViewContext, which measures the row and lifts just it above the keyboard.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
import { useT } from '@/lib/i18n';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { BORDER_WIDTH, computeBorderTone, FontSize, Fonts, Radius, Shadow, Spacing, contrastOn, MIN_TAP_TARGET, HitSlop } from '@/constants/theme';
import PressableScale from '@/components/PressableScale';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';

type Props = {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Confirm-fill color when the input is non-empty (default theme.good). Also tints the "+" bar. */
  accent?: string;
  /** Icon on the confirm/Save button. Use "checkmark" when `extras` contains a +/− stepper. */
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  /** Optional controls rendered between the input and the confirm button (e.g. a qty stepper). */
  extras?: React.ReactNode;
  /** The full-width labeled options panel (components/QuickAddOptionsPanel), rendered on its
   *  own line between the input and the Save/Delete row instead of inline — see
   *  components/PadTypeRow.tsx's `panel` prop for the full rationale. Pass one of `extras`/
   *  `panel`, not both. */
  panel?: React.ReactNode;
  /** Hairline top divider so the row reads as appended to the list above (default true).
   *
   * **Reviewed and KEPT in the 2026-08-10 pass — read this before deleting it.** It looks
   * like the last survivor of the 2026-08-09 `FieldDivider` cull, and it is not the same
   * thing. Those 14 lines were deleted because two sat directly UNDER a text field (making an
   * unbordered input read as floating over a rule) and the rest re-stated a card boundary the
   * 2026-08-05 reset had already given to borders. This one sits ABOVE a composer that draws
   * its own border, and it is already opt-IN in practice: of ten call sites, six pass
   * `false`, and the two that keep it pass a CONDITION — `app/(tabs)/plans.tsx`'s `!wrapped`
   * and `MedicineTrayCard`'s `medicines.length > 0` — i.e. it is drawn exactly when there is
   * a list above for the composer to be appended to, and suppressed when there isn't. That is
   * a working separator, not decoration, and neither of those two containers carries a `gap`
   * to fall back on.
   *
   * What DID change: it draws `theme.rule` now, not `theme.border`. `border` is the
   * 3:1-contrast token that marks where a CONTROL is (`constants/colors.ts`); a decorative
   * hairline between a list and the thing below it is precisely what `rule` was split out
   * for, and this was the app's last consumer still confusing the two outside `PadSheet`.
   */
  showDivider?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function AddRow({
  placeholder,
  value,
  onChangeText,
  onSubmit,
  disabled,
  accent,
  confirmIcon = 'add',
  extras,
  panel,
  showDivider = true,
  accessibilityLabel,
  style,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const fieldHue = useScreenColor() ?? theme.border;
  const t = useT();
  const active = value.trim().length > 0 && !disabled;
  const fill = accent ?? theme.good;

  // Collapsed by default: a "+ <placeholder>" bar. Tapping it expands into the editing row.
  const [expanded, setExpanded] = useState(false);
  // Drives the field's focus border (2026-08-05). `isFocusedRef` below can't: a ref change
  // doesn't re-render, and the border has to repaint the moment focus lands.
  const [focused, setFocused] = useState(false);

  // Scroll THIS row above the keyboard once it opens, but only while THIS row's input is
  // the one focused (a screen may have other, unrelated inputs elsewhere that shouldn't
  // trigger it). We hand the scaffold this row's own View node so it lifts just this row —
  // correct whether the row is last-in-list or mid-list. See ScreenScaffold's
  // ScrollIntoViewContext doc for why this is needed.
  const scrollIntoView = useContext(ScrollIntoViewContext);
  const rowRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollIntoView?.(rowRef.current);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  const containerStyle = [
    styles.row,
    showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule },
    disabled && styles.gated,
    style,
  ];

  function expand() {
    setExpanded(true);
    // Focus on the next frame — the input mounts this render, so it isn't focusable yet.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function collapse() {
    onChangeText('');
    setExpanded(false);
  }

  function commit() {
    if (!active) return;
    onSubmit();
    hapticConfirm();
    setExpanded(false); // discrete: back to the "+" bar after each save
  }

  // ── Collapsed: labelled "+ <placeholder>" bar ──
  if (!expanded) {
    return (
      <View ref={rowRef} style={containerStyle} pointerEvents={disabled ? 'none' : 'auto'}>
        <PressableScale
          style={[styles.addBar, { borderColor: theme.border }]}
          onPress={expand}
          disabled={disabled}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? placeholder ?? t.a11yAdd}
        >
          <View style={[styles.addBarChip, { backgroundColor: fill }]}>
            <Ionicons name="add" size={16} color={contrastOn(fill)} />
          </View>
          <Text style={[styles.addBarLabel, { color: theme.textMuted }]} numberOfLines={1}>
            {placeholder}
          </Text>
        </PressableScale>
      </View>
    );
  }

  const inputField = (
    <TextInput
      ref={inputRef}
      style={[
        styles.input,
        {
          color: theme.text,
          // White/plain surface fill (2026-08-06, user report: "text-boxes are too grey" —
          // matches components/FormControls.tsx's Input and what a text field looks like in
          // most web/native apps), not the sunken `surfaceMuted` well a disabled control uses.
          backgroundColor: theme.surface,
          // Same field shape and same colour rule as components/PadTypeRow.tsx — see its
          // header. `theme.border` is the ≥3:1 control-boundary token; the accent marks focus.
          // Screen hue at the FIELD rung at rest, the surface's own fill while focused — the same
          // shape components/PadTypeRow.tsx uses, so the app's two composers are one control
          // (card design reset, 2026-08-05).
          borderColor: focused ? fill : computeBorderTone(fieldHue, isDark, 'field'),
        },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      returnKeyType="done"
      onSubmitEditing={commit}
      editable={!disabled}
      onFocus={() => {
        setFocused(true);
        isFocusedRef.current = true;
        // Covers the keyboard-already-open case (switching focus to this input doesn't
        // re-fire keyboardDidShow); the listener above covers the keyboard-opening-fresh
        // case. Harmless to call both — scrollIntoView() is idempotent.
        scrollIntoView?.(rowRef.current);
      }}
      onBlur={() => {
        setFocused(false);
        isFocusedRef.current = false;
        // Blurring an empty row backs out of the add — collapse to the "+" bar so we don't
        // strand an open empty input. A row with text stays open (the user is mid-entry).
        if (value.trim().length === 0) setExpanded(false);
      }}
    />
  );

  const discardButton = (
    <PressableScale
      style={styles.discard}
      onPress={collapse}
      hitSlop={HitSlop.base}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={t.a11yDiscardRow}
    >
      <Ionicons name="close" size={18} color={theme.textMuted} />
    </PressableScale>
  );

  const confirmButton = (
    <PressableScale
      style={[
        styles.confirm,
        // Raised & pressable-looking ONLY when there's text to submit: real fill + button
        // shadow + a uniform light edge so it reads as lifted toward the user. While the input
        // is empty the button is inert (disabled — submitting needs text), so it drops all of
        // that and reads as a flat, recessed well (surfaceMuted + a neutral edge, no shadow) to
        // signal "type something first" instead of masquerading as a ready-to-tap control.
        active && Shadow.button,
        {
          backgroundColor: active ? fill : theme.surfaceMuted,
          borderColor: active ? 'rgba(255,255,255,0.5)' : theme.border,
        },
      ]}
      onPress={commit}
      disabled={!active}
      hitSlop={HitSlop.base}
      scaleTo={0.9}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t.a11yAdd}
    >
      <Ionicons name={confirmIcon} size={18} color={active ? contrastOn(fill) : theme.textMuted} />
    </PressableScale>
  );

  // ── Expanded, panel design: input alone, the labeled options panel below it, then
  // Save/Delete right-aligned below that — see the `panel` prop's doc for why this is a
  // separate layout from the inline `extras` row (components/PadTypeRow.tsx's own `panel`
  // branch is the same shape). ──
  if (panel !== undefined) {
    return (
      <View ref={rowRef} style={[containerStyle, styles.column]} pointerEvents={disabled ? 'none' : 'auto'}>
        <View style={styles.row}>{inputField}</View>
        <View style={styles.panelSlot}>{panel}</View>
        <View style={styles.panelButtonRow}>
          {discardButton}
          {confirmButton}
        </View>
      </View>
    );
  }

  // ── Expanded: editable row + Save + Delete ──
  return (
    <View
      ref={rowRef}
      style={containerStyle}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {inputField}
      {extras}
      {discardButton}
      {confirmButton}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
  },
  addBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    minHeight: 32,
    // Bordered pill (2026-07-25, user report: the "+ New task"/"Add a note" row read as
    // floating text next to an icon, disconnected from the card around it) — a visible edge
    // frames the affordance as one contained control instead of bare text sitting in blank
    // space, matching the 1.5 borderWidth every other bordered chip in this app (quickChip,
    // taskChip, AddRow's own confirm button) already uses.
    borderWidth: 1.5,
    borderRadius: Radius.md,
  },
  addBarChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBarLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  input: {
    flex: 1,
    // react-native-web renders this as a plain <input>, which carries a browser-default
    // intrinsic min-width (~170px) that `flex:1` alone doesn't override — the row's other
    // children (discard/confirm, plus whatever `extras` a caller passes) would get pushed
    // outside the card whenever their combined width + that intrinsic minimum exceeded the
    // row (found 2026-07-24 wiring PlanTaskCard/HomeShoppingCard's quick-add extras — the
    // confirm button silently rendered off-card). No effect on native, where 0 is already
    // the default.
    minWidth: 0,
    // A real bordered field (2026-08-05), matching components/PadTypeRow.tsx and
    // components/FormControls.tsx's `Input` — one field shape in the app. It used to be a
    // bare line: no border, no fill, no focus state, so an expanded add row read as a caret
    // floating on the card. Same class of bug as the "+ New task" bar being bare text before
    // its 2026-07-25 pill, and the same fix. Colours are applied inline (they need the theme).
    minHeight: MIN_TAP_TARGET,
    // Same weight as every other field-rung border (PadTypeRow's composer, PadSheet's row
    // boxes, QuickAddOptionRow's cells) — card design reset, 2026-08-05.
    borderWidth: BORDER_WIDTH.field,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  discard: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  gated: { opacity: 0.45 },
  // Panel layout (`panel` prop): a column instead of the single inline expanded row.
  column: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs },
  panelSlot: { width: '100%' },
  panelButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.xs },
});
