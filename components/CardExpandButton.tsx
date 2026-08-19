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
      style={style}
    />
  );
}
