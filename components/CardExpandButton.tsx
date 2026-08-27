/**
 * CardExpandButton.tsx — the header affordance that grows a card to fill the screen.
 *
 * One component, two mount points: a card's own header (expand-outline, measures the card and
 * calls expandCard) AND — with `expanded` fixed true — the expanded pane's own close control
 * (contract-outline, calls collapseCard). Same icon-swap idea as the header's ⋯/check pair,
 * just one button doing both directions of one gesture.
 *
 * Connections:
 *   Imports → components/IconButton, lib/i18n
 *   Used by → every card's header action cluster (via lib/useCardExpand.ts), and
 *             components/CardExpandHost.tsx's own pane chrome
 *   Data    → none — purely presentational; the measuring/calling happens in
 *             lib/useCardExpand.ts (the caller) and components/CardExpandHost.tsx (the host)
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import IconButton from '@/components/IconButton';
import { IconSize } from '@/constants/theme';
import { useT } from '@/lib/i18n';

type Props = {
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function CardExpandButton({ expanded, onExpand, onCollapse, style }: Props) {
  const t = useT();
  return (
    <IconButton
      icon={expanded ? 'contract-outline' : 'expand-outline'}
      label={expanded ? t.collapseCardLabel : t.expandCardLabel}
      onPress={expanded ? onCollapse : onExpand}
      // ⚠️ **`compact` (30), not the default `action` (36) — 2026-08-27, round 20.** The drawn
      // screens put a 29px control in the card header, and the difference is not fussiness: at
      // 36 this is the widest single item in the cluster, and on a closed card it is a filled
      // circle competing with the badge for the eye on a header whose whole job is to say one
      // name. 30 is the token nearest the drawn 29; 29 itself is not on the scale.
      //   The tap target does NOT shrink with it. `IconButton` floors its hit target at
      // `max(MIN_TAP_TARGET, size + Spacing.sm)`, so this still reaches 48 — which is the only
      // reason the visual may move at all (DESIGN_RULES rule 17, and round 20's own ground rule).
      size={IconSize.compact}
      style={style}
    />
  );
}
