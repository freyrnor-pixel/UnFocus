/**
 * pair-device.tsx — LAN live-sync pairing + paired-devices list (Decision 038 wiring)
 *
 * Lets the user turn on Wi-Fi live sync and pair another phone via a two-step,
 * in-person QR handshake (Decision 038d): one phone shows its code, the other
 * scans it, then shows the SAME shared secret back (reusing what it just scanned,
 * not generating a new one) so both phones end up trusting each other with one
 * identical HMAC secret. Also lists already-paired devices with a remove action.
 *
 * Connections:
 *   Imports → components/AppModal, components/Button, components/QRCodeDisplay,
 *             components/ScreenScaffold, components/Surface, components/FormControls
 *             (Switch), constants/theme, expo-camera, lib/date, lib/i18n, lib/peerAuth
 *             (generateSecret), lib/share (encode/decodeSharePayload), lib/syncService
 *             (isSyncAvailable), lib/useAppTheme, store/usePeersStore, store/useSettingsStore
 *   Used by → Expo Router route "/pair-device" — pushed from app/settings.tsx's
 *             Data group "Live sync" card
 *   Data    → reads/writes store/usePeersStore (peers table); reads/writes
 *             useSettingsStore.lanSyncEnabled (starts/stops lib/syncService via
 *             app/_layout.tsx's effect, not directly here)
 *
 * Edit notes:
 *   - The pairing secret is generated ONCE per handshake by whichever phone starts
 *     as "Show my code" (the initiator); the responder reuses the exact secret it
 *     scanned when it shows its own code back. Two independently-generated secrets
 *     would leave the two sides unable to verify each other — see lib/syncService's
 *     header for why the secret must be identical on both ends.
 *   - Camera chrome for the scan step reuses app/scan.tsx's fixed dark camera
 *     convention (Decision 025) rather than theme tokens — same rationale (a live
 *     viewfinder doesn't fit the light-first token set).
 *   - Does not touch app/scan.tsx's own QR scanner, which deliberately rejects 'p'
 *     (pairing) payloads — pairing scans only ever happen from this screen.
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { usePeersStore } from '@/store/usePeersStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { generateSecret } from '@/lib/peerAuth';
import { encodeSharePayload, decodeSharePayload } from '@/lib/share';
import { isSyncAvailable } from '@/lib/syncService';
import { dateStr, formatDisplayDate } from '@/lib/date';
import { showAppModal } from '@/components/AppModal';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { Switch as FormSwitch } from '@/components/FormControls';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

const QR_BG = '#000000';
const QR_FG = '#FFFFFF';
const QR_HINT = 'rgba(255,255,255,0.6)';

type WizardStep = 'choose' | 'show' | 'scan';
type Role = 'initiator' | 'responder' | null;

export default function PairDeviceScreen() {
  const router = useRouter();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const peers = usePeersStore((s) => s.peers);
  const loadPeers = usePeersStore((s) => s.load);
  const addPeer = usePeersStore((s) => s.addPeer);
  const removePeer = usePeersStore((s) => s.removePeer);

  const deviceId = useSettingsStore((s) => s.deviceId);
  const userName = useSettingsStore((s) => s.userName);
  const lang = useSettingsStore((s) => s.language);
  const lanSyncEnabled = useSettingsStore((s) => s.lanSyncEnabled);
  const updateSettings = useSettingsStore((s) => s.update);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [wizardVisible, setWizardVisible] = useState(false);
  const [step, setStep] = useState<WizardStep>('choose');
  const [role, setRole] = useState<Role>(null);
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPeers();
    }, [loadPeers])
  );

  const syncAvailable = isSyncAvailable();

  function closeWizard() {
    setWizardVisible(false);
    setStep('choose');
    setRole(null);
    setSessionSecret(null);
    setScanned(false);
  }

  function openWizard() {
    setStep('choose');
    setRole(null);
    setSessionSecret(null);
    setScanned(false);
    setWizardVisible(true);
  }

  function startAsInitiator() {
    setRole('initiator');
    setSessionSecret(generateSecret());
    setStep('show');
  }

  async function startAsResponder() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        showAppModal(t.permissionTitle, t.permissionBody);
        return;
      }
    }
    setRole('responder');
    setScanned(false);
    setStep('scan');
  }

  async function goToScanStep() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        showAppModal(t.permissionTitle, t.permissionBody);
        return;
      }
    }
    setScanned(false);
    setStep('scan');
  }

  function handleScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const payload = decodeSharePayload(data);
    if (!payload || payload.k !== 'p') {
      showAppModal('', t.peers.pairInvalid, [{ text: t.ok, onPress: () => setScanned(false) }]);
      return;
    }
    if (role === 'initiator') {
      // We generated the secret; use OURS, never whatever the scanned code carries.
      addPeer({ deviceId: payload.id, name: payload.nm, secret: sessionSecret! });
      showAppModal(t.peers.pairedSuccessTitle, t.peers.pairedSuccessBody(payload.nm), [
        { text: t.ok, onPress: () => closeWizard() },
      ]);
    } else {
      // We're the responder: adopt the secret we just scanned, then show it back.
      setSessionSecret(payload.s);
      addPeer({ deviceId: payload.id, name: payload.nm, secret: payload.s });
      setStep('show');
    }
  }

  function confirmRemove(peerId: string) {
    showAppModal(t.peers.removeConfirmTitle, t.peers.removeConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.peers.removeDevice, style: 'destructive', onPress: () => removePeer(peerId) },
    ]);
  }

  const qrPayload =
    role && sessionSecret
      ? encodeSharePayload({ v: 1, k: 'p', id: deviceId, nm: userName || 'UnFocus', s: sessionSecret })
      : '';

  return (
    <>
      <ScreenScaffold title={t.peers.title} tier="sub" onBack={() => router.back()}>
        <View style={styles.content}>
          <Surface style={styles.card}>
            {syncAvailable ? (
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>{t.peers.syncToggleLabel}</Text>
                <FormSwitch checked={lanSyncEnabled} onChange={(v) => updateSettings({ lanSyncEnabled: v })} />
              </View>
            ) : (
              <Text style={[styles.explain, { color: theme.textMuted }]}>{t.peers.syncUnavailable}</Text>
            )}
          </Surface>

          <Surface style={styles.card}>
            {peers.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.peers.noPeers}</Text>
            ) : (
              peers.map((peer) => (
                <View key={peer.deviceId} style={[styles.peerRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.peerText}>
                    <Text style={[styles.peerName, { color: theme.text }]}>{peer.name || peer.deviceId}</Text>
                    <Text style={[styles.peerSub, { color: theme.textMuted }]}>
                      {t.peers.pairedAt(formatDisplayDate(dateStr(new Date(peer.pairedAt)), lang))}
                    </Text>
                  </View>
                  <Pressable onPress={() => confirmRemove(peer.deviceId)} hitSlop={8}>
                    <Text style={[styles.removeLink, { color: theme.bad }]}>{t.peers.removeDevice}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Surface>

          {syncAvailable && <Button label={t.peers.addDevice} onPress={openWizard} />}

          <View style={{ height: 40 }} />
        </View>
      </ScreenScaffold>

      <Modal visible={wizardVisible} animationType="slide" onRequestClose={closeWizard}>
        {step === 'choose' ? (
          <SafeAreaView style={[styles.wizardSafe, { backgroundColor: theme.bg }]}>
            <View style={styles.wizardContent}>
              <Text style={[styles.wizardTitle, { color: theme.text }]}>{t.peers.chooseRoleTitle}</Text>
              <Text style={[styles.explain, { color: theme.textMuted }]}>{t.peers.chooseRoleExplain}</Text>
              <Button label={t.peers.showMyCode} onPress={startAsInitiator} />
              <Button label={t.peers.scanACode} variant="secondary" onPress={startAsResponder} />
              <Pressable style={styles.wizardCancel} onPress={closeWizard}>
                <Text style={[styles.wizardCancelText, { color: theme.textMuted }]}>{t.cancel}</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        ) : step === 'show' ? (
          <SafeAreaView style={[styles.wizardSafe, { backgroundColor: theme.bg }]}>
            <View style={styles.wizardContent}>
              <Text style={[styles.wizardTitle, { color: theme.text }]}>{t.peers.title}</Text>
              <Text style={[styles.explain, { color: theme.textMuted }]}>{t.peers.showCodeInstructions}</Text>
              <View style={styles.qrWrap}>
                <QRCodeDisplay data={qrPayload} size={240} />
              </View>
              {role === 'initiator' ? (
                <Button label={t.peers.showCodeNext} onPress={goToScanStep} />
              ) : (
                <Button label={t.peers.showCodeDone} onPress={closeWizard} />
              )}
              <Pressable style={styles.wizardCancel} onPress={closeWizard}>
                <Text style={[styles.wizardCancelText, { color: theme.textMuted }]}>{t.cancel}</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        ) : (
          <View style={[styles.qrModal, { backgroundColor: QR_BG }]}>
            <SafeAreaView style={styles.qrSafeArea}>
              <View style={styles.qrHeader}>
                <Pressable onPress={closeWizard}>
                  <Text style={[styles.backLink, { color: theme.accent }]}>{t.cancel}</Text>
                </Pressable>
                <Text style={[styles.qrTitle, { color: QR_FG }]}>{t.peers.title}</Text>
                <View style={{ width: 60 }} />
              </View>
              <Text style={[styles.qrHint, { color: QR_HINT }]}>{t.peers.scanInstructions}</Text>
              <CameraView
                style={styles.qrCamera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleScanned}
              />
              <View style={styles.qrOverlay} pointerEvents="none">
                <View style={[styles.qrFrame, { borderColor: QR_FG }]} />
              </View>
            </SafeAreaView>
          </View>
        )}
      </Modal>
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  explain: { fontSize: FontSize.sm, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: FontSize.md, fontWeight: '600' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.md },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  peerText: { flex: 1 },
  peerName: { fontSize: FontSize.md, fontWeight: '600' },
  peerSub: { fontSize: FontSize.xs, marginTop: 1 },
  removeLink: { fontSize: FontSize.sm, fontWeight: '600' },

  wizardSafe: { flex: 1 },
  wizardContent: { flex: 1, padding: Spacing.lg, gap: Spacing.md, justifyContent: 'center' },
  wizardTitle: { fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center' },
  wizardCancel: { alignItems: 'center', paddingVertical: Spacing.sm },
  wizardCancelText: { fontSize: FontSize.sm, fontWeight: '600' },
  qrWrap: { alignItems: 'center', marginVertical: Spacing.md },

  qrModal: { flex: 1 },
  qrSafeArea: { flex: 1 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  qrTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  qrHint: { textAlign: 'center', fontSize: FontSize.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  qrCamera: { flex: 1 },
  backLink: { fontSize: FontSize.sm, fontWeight: '700' },
  qrOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  qrFrame: { width: 220, height: 220, borderWidth: 2, borderRadius: Radius.md, backgroundColor: 'transparent' },
});
