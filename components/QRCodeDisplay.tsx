/**
 * QRCodeDisplay.tsx — renders a QR code from a string using stacked Views.
 *
 * Encodes `data` with qrcode-generator and draws the module grid as nested
 * Views (no SVG/canvas dependency). Returns null if encoding fails.
 *
 * Connections:
 *   Imports → qrcode-generator
 *   Used by → app/share-modal.tsx (not ported yet — this is a leaf ahead of its screen)
 *   Data    → none (presentational); encodes the `data` string prop only
 *
 * Edit notes:
 *   - The grid is memoized on `data`; large payloads produce many module Views and can be expensive to render.
 *   - `size` includes an 8px white quiet-zone border on each side (cellSize derives from size - 16).
 *   - Black/white module colors are fixed, not Decision 006 tokens — a QR code's
 *     dark/light modules are a functional encoding (scanner contrast), not app chrome.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import qrcode from 'qrcode-generator';

type Props = {
  data: string;
  size?: number;
};

export default function QRCodeDisplay({ data, size = 240 }: Props) {
  const modules = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(data);
      qr.make();
      const count = qr.getModuleCount();
      const grid: boolean[][] = [];
      for (let row = 0; row < count; row++) {
        const cells: boolean[] = [];
        for (let col = 0; col < count; col++) {
          cells.push(qr.isDark(row, col));
        }
        grid.push(cells);
      }
      return grid;
    } catch {
      return null;
    }
  }, [data]);

  if (!modules) return null;

  const inner = size - 16; // 8px white border each side
  const cellSize = inner / modules.length;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {modules.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((dark, ci) => (
            <View
              key={ci}
              style={{ width: cellSize, height: cellSize, backgroundColor: dark ? '#000' : '#fff' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', padding: 8, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
});
