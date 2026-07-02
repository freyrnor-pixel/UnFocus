/**
 * EnergyCheckIn.tsx — once-a-day energy level check-in
 *
 * A gentle 3-tile picker (low/medium/high). Selecting a level writes to
 * useEnergyStore (one row per day); on a 'low' day the Plans screen narrows
 * the visible today-task list to importance === 'essential' tasks only,
 * layered on top of any existing essentials/work-mode filter — never
 * replacing it.
 *
 * Connections:
 *   Imports → components/Surface, constants/theme, lib/date, lib/haptics, lib/i18n, lib/useAppTheme, store/useEnergyStore
 *   Used by → (not yet mounted — Decision 009 unmounts it from Home; ported ahead
 *             of its eventual call site per REBUILD_PLAN.md 3d)
 *   Data    → useEnergyStore (energy_logs table, one row per day) — Decision 015 stub for now
 *
 * Edit notes:
 *   - Reads `levels` (the raw map) rather than calling todayLevel() in the selector,
 *     so the tile highlight re-renders reactively — see useTaskStore's analogous
 *     "select the raw slice, not just a function ref" gotcha.
 *   - Tapping a tile re-selects; there's no "lock after first pick" — it just
 *     reflects whichever tile was tapped most recently today.
 *   - `theme.orange`/`orangeLight`/`grayLight`/`textLight` remapped to Decision 006
 *     tokens `accent`/`accentSoft`/`surfaceMuted`/`textMuted` during the port
 *     (2026-07-02, Phase 3d).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { selection } from '@/lib/haptics';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Surface from '@/components/Surface';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useEnergyStore, EnergyLevel } from '@/store/useEnergyStore';

const LEVELS: EnergyLevel[] = ['low', 'medium', 'high'];
const LEVEL_ICON: Record<EnergyLevel, string> = { low: '🔋', medium: '🔋🔋', high: '🔋🔋🔋' };

export default function EnergyCheckIn() {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const levels = useEnergyStore((s) => s.levels);
  const setToday = useEnergyStore((s) => s.setToday);
  const todayLevel = levels[todayStr()] ?? null;

  return (
    <Surface style={styles.card}>
      <Text style={[styles.prompt, { color: theme.textMuted }]}>{t.energy.checkInPrompt}</Text>
      <View style={styles.row}>
        {LEVELS.map((level) => {
          const active = todayLevel === level;
          return (
            <Pressable
              key={level}
              style={[
                styles.tile,
                { backgroundColor: theme.surfaceMuted },
                active && { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1.5 },
              ]}
              onPress={() => {
                selection();
                setToday(level);
              }}
            >
              <Text style={styles.tileIcon}>{LEVEL_ICON[level]}</Text>
              <Text
                style={[
                  styles.tileLabel,
                  { color: active ? theme.text : theme.textMuted },
                  active && { fontWeight: '700' },
                ]}
              >
                {level === 'low' ? t.energy.low : level === 'medium' ? t.energy.medium : t.energy.high}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {todayLevel === 'low' && (
        <Text style={[styles.hint, { color: theme.textMuted }]}>{t.energy.lowEnergyHint}</Text>
      )}
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  prompt: { fontSize: FontSize.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  tileIcon: { fontSize: FontSize.lg },
  tileLabel: { fontSize: FontSize.xs },
  hint: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },
});
