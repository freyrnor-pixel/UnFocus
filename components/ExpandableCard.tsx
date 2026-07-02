/**
 * ExpandableCard.tsx — collapsible card with animated header chevron.
 *
 * Generic accordion container: shows a title/subtitle/badge row that toggles a
 * body section with a LayoutAnimation expand and a rotating arrow. Content,
 * labels, and optional right action are all passed in as children/props.
 *
 * Connections:
 *   Imports → components/Surface, constants/theme, lib/useAppTheme
 *   Used by → components/WeekListCard.tsx (dish groups + collapsed "bought this week"
 *             history, uncontrolled), app/shopping.tsx (Monthly catalog dish groups);
 *             later Phase 3/6 sessions will also wire this into PlanTaskCard (controlled)
 *             and InboxSection/meals/health per Decision 009
 *   Data    → driven by props; reads reducedMotion + scaled fontSize via useAccessibility()/useScaledStyles()
 *
 * Edit notes:
 *   - LayoutAnimation is enabled on Android via UIManager at module load — keep that guard if refactoring imports.
 *   - `leadingAction` renders before the title/subtitle stack inside headerLeft (same
 *     stopPropagation-wrapped Pressable pattern as `rightAction`) — e.g. a severity badge
 *     needs to sit leading rather than trailing, where a checkbox lives on the right.
 *   - Decision 008: the card face is a `<Surface surfaceContext="ambient">` (default —
 *     override by passing `material` through, same as before) rather than a hand-rolled
 *     two-layer getMaterialStyle() mask. This is a deliberate change from the old source,
 *     which built its own mask/sheen/border directly: Surface now owns that rendering
 *     (fill, sheen, border, shadow, and blur-when-glass) so this composite doesn't
 *     duplicate Decision 008's blur logic. One behavioural difference from old source:
 *     `accentColor` now only tints the left accent bar, not the mask border/shadow — the
 *     old code computed getMaterialStyle(accentColor, finish) for border/shadow but still
 *     hard-coded the mask fill to theme.white regardless, so the border-tint effect was
 *     already inconsistent with the fill; Surface's `tint` prop doesn't support "tint
 *     border only, not fill", so that inconsistent effect is dropped rather than ported.
 *   - Optional controlled mode: pass both `open` and `onToggle` to let the parent own the
 *     open/closed state (needed when a screen must aggregate state across many instances,
 *     e.g. per-task dirty tracking). Omit both and it behaves exactly as before (internal
 *     useState).
 *   - `rightAction` is wrapped in its own Pressable that calls `e.stopPropagation()` so taps on
 *     a checkbox/save-pill passed as rightAction don't also toggle the header.
 *   - `material` is forwarded straight to Surface — when omitted, Surface itself falls back
 *     to the user's `bubbleMaterial` setting, so this component doesn't need its own
 *     useSettingsStore read.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { Radius, Spacing, FontSize, MaterialName } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  leadingAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  accentColor?: string;
  material?: MaterialName;
};

export default function ExpandableCard({
  title,
  subtitle,
  badge,
  children,
  leadingAction,
  rightAction,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  accentColor,
  material,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [openState, setOpenState] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : openState;
  const rotate = useRef(new Animated.Value(open ? 1 : 0)).current;
  const mountedRef = useRef(false);
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);

  function animateTo(next: boolean) {
    if (reducedMotion) {
      rotate.setValue(next ? 1 : 0);
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Animated.timing(rotate, {
        toValue: next ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }

  // In controlled mode, the parent owns `open` — react to it changing externally
  // instead of animating on mount.
  useEffect(() => {
    if (!isControlled) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    animateTo(open);
  }, [open, isControlled]);

  function toggle() {
    if (isControlled) {
      onToggle?.();
      return;
    }
    animateTo(!openState);
    setOpenState((v) => !v);
  }

  const arrow = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Surface material={material} surfaceContext="ambient" style={[styles.card, styles.cardRow]}>
      {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
      <View style={styles.cardContent}>
        <Pressable style={styles.header} onPress={toggle}>
          <View style={styles.headerLeft}>
            {leadingAction ? (
              <Pressable onPress={(e) => e.stopPropagation()}>{leadingAction}</Pressable>
            ) : null}
            <View style={styles.headerLeftText}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>{badge}</Text>
              </View>
            ) : null}
            {rightAction ? <Pressable onPress={(e) => e.stopPropagation()}>{rightAction}</Pressable> : null}
            <Animated.View style={{ transform: [{ rotate: arrow }] }}>
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
            </Animated.View>
          </View>
        </Pressable>
        {open ? <View style={[styles.body, { borderTopColor: theme.border }]}>{children}</View> : null}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLeftText: { flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
  },
});
