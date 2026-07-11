/**
 * scan.web.tsx — Web preview placeholder for app/(tabs)/scan.tsx.
 *
 * `@react-native-ml-kit/text-recognition` (OCR) has no web build, so the real
 * receipt-scan/QR-import screen can't bundle for web. Shows a minimal
 * "not available" placeholder instead of the full scanner.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, lib/i18n
 *   Used by → Expo Router route "/scan" (web bundle resolves this over scan.tsx)
 *   Data    → none
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenScaffold from '@/components/ScreenScaffold';
import { useT } from '@/lib/i18n';

export default function ScanScreenWeb() {
  const t = useT();
  return (
    <ScreenScaffold title={t.shopping.scan} tier="site" bottomNav={false} ownBackground={false}>
      <Text style={styles.text}>{t.webPreview.notAvailable}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'center', marginTop: 40, fontSize: 16 },
});
