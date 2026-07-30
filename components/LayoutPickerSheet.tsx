/**
 * LayoutPickerSheet.tsx — "how should this list look" picker for one surface.
 *
 * Opened from a surface's own header (Shopping, Plans), so the choice is made while looking
 * at the thing it changes rather than three screens away in Settings. Lists every layout
 * lib/cardLayout.ts declares for that surface, each with a plain-language name and a
 * one-line hint, plus a "Same as my usual" row that clears the per-surface override and
 * hands the surface back to `settings.layoutDetail`.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/PressableScale, components/Surface,
 *             constants/theme, lib/cardLayout, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useSettingsStore
 *   Used by → app/(tabs)/shopping.tsx, app/(tabs)/plans.tsx
 *   Data    → settings.cardLayouts / settings.layoutDetail via useSettingsStore.update.
 *             Writes nothing else — picking a layout changes how rows are drawn and
 *             nothing about what the app does with them (no reminder is scheduled,
 *             cancelled, or re-synced by this sheet).
 *
 * Edit notes:
 *   - Applies immediately on tap, like every other control in app/settings.tsx — there is
 *     no separate save step. The trailing button is a dismiss, not a commit, so backing out
 *     of the sheet never silently discards a choice the user already saw take effect.
 *   - The selected row is the RESOLVED layout, so a surface following the global default
 *     shows its inherited choice ticked as well as "Same as my usual" — the user can see
 *     both what they get and where it came from.
 *   - Layout names come from `t.config.layouts.<id>.label`. A new layout added to
 *     SURFACE_LAYOUTS without its i18n pair will fail `npx tsc --noEmit` (lib/i18n.ts's
 *     `no: typeof en`), which is the intended tripwire — don't defend against it here.
 *   - Decision 044b applies: the sheet shell is AnimatedBottomSheet so it plays a real exit
 *     animation; keep `surface` cached if you ever make it nullable like ListSettingsSheet.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Fonts, FontSize, Radius, Spacing, MIN_TAP_TARGET } from '@/constants/theme';
import {
  LayoutId,
  LayoutSurface,
  SURFACE_LAYOUTS,
  resolveLayout,
  withSurfaceLayout,
} from '@/lib/cardLayout';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

type Props = {
  visible: boolean;
  surface: LayoutSurface;
  onClose: () => void;
};

export default function LayoutPickerSheet({ visible, surface, onClose }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const cardLayouts = useSettingsStore((s) => s.cardLayouts);
  const layoutDetail = useSettingsStore((s) => s.layoutDetail);
  const update = useSettingsStore((s) => s.update);

  const resolved = resolveLayout(surface, cardLayouts, layoutDetail);
  const hasOverride = cardLayouts[surface] !== undefined;
  const options = SURFACE_LAYOUTS[surface];

  function choose(id: LayoutId | null) {
    selection();
    update({ cardLayouts: withSurfaceLayout(cardLayouts, surface, id) });
  }

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.config.layouts.title}</Text>

        {/* Clearing the override is a first-class row, not a hidden reset: a user who
            experimented needs an obvious way back to whatever they normally run. */}
        <PressableScale
          style={[
            styles.option,
            { borderColor: hasOverride ? theme.border : theme.accent, backgroundColor: theme.surfaceMuted },
          ]}
          onPress={() => choose(null)}
          scaleTo={0.98}
          accessibilityRole="radio"
          accessibilityState={{ selected: !hasOverride }}
        >
          <View style={styles.optionText}>
            <Text style={[styles.optionLabel, { color: theme.text }]}>{t.config.layouts.followsDefault}</Text>
            <Text style={[styles.optionHint, { color: theme.textMuted }]}>
              {t.config.layouts[layoutDetail].label}
            </Text>
          </View>
          {!hasOverride ? <Ionicons name="checkmark-circle" size={22} color={theme.accent} /> : null}
        </PressableScale>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {options.map((id) => {
          const active = hasOverride && resolved === id;
          // A surface following the global default still ticks the layout it inherits, so
          // the sheet shows what you get as well as where it came from.
          const inherited = !hasOverride && resolved === id;
          return (
            <PressableScale
              key={id}
              style={[
                styles.option,
                {
                  borderColor: active ? theme.accent : theme.border,
                  backgroundColor: active ? theme.accentSoft : theme.surfaceMuted,
                },
              ]}
              onPress={() => choose(id)}
              scaleTo={0.98}
              accessibilityRole="radio"
              accessibilityState={{ selected: active || inherited }}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>
                  {t.config.layouts[id].label}
                </Text>
                <Text style={[styles.optionHint, { color: theme.textMuted }]}>
                  {t.config.layouts[id].hint}
                </Text>
              </View>
              {active || inherited ? (
                <Ionicons
                  name={active ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={22}
                  color={theme.accent}
                />
              ) : null}
            </PressableScale>
          );
        })}

        <PressableScale
          style={[styles.doneBtn, { backgroundColor: theme.accent }]}
          onPress={onClose}
          scaleTo={0.95}
        >
          <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.config.layouts.close}</Text>
        </PressableScale>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  optionHint: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  doneBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
