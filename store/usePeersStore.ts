/**
 * usePeersStore.ts — remembered LAN peers from the QR pairing handshake (Decision 038d).
 *
 * Zustand store over the `peers` SQLite table: one row per device paired via the
 * QR key-exchange (lib/share.ts pairing payload). Each peer carries the shared
 * HMAC secret that lib/peerAuth.ts uses to verify inbound LAN envelopes from that
 * device. Pairing is deliberate and physical (scan in the same room); there is no
 * server trust anchor.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess
 *   Used by → lib/syncService.ts (getSecret on every inbound/outbound envelope),
 *             app/pair-device.tsx (addPeer/removePeer from the QR pairing wizard,
 *             renders the paired-devices list), app/_layout.tsx (load() in the
 *             app-wide bootstrap, so peers are hydrated before syncService can
 *             discover anyone)
 *   Data    → owns reads/writes of the `peers` table (device_id, name, secret, paired_at)
 *
 * Edit notes:
 *   - `secret` is the shared HMAC key — never render it in UI or logs. It leaves
 *     the device only inside the one-time QR payload during pairing.
 *   - device_id is the PRIMARY KEY: re-pairing an existing device REPLACEs its row
 *     (rotates the secret) rather than duplicating — see addPeer's upsert.
 *   - This is a config-like table; pruneOldData() in lib/db.ts leaves it untouched.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, loadAll, readStr } from '@/lib/dataAccess';

export type Peer = {
  deviceId: string;
  name: string;
  /** Shared HMAC secret — sensitive; do not surface in UI. */
  secret: string;
  pairedAt: string;
};

function rowToPeer(row: Row): Peer {
  return {
    deviceId: readStr(row, 'device_id'),
    name: readStr(row, 'name'),
    secret: readStr(row, 'secret'),
    pairedAt: readStr(row, 'paired_at'),
  };
}

type PeersStore = {
  peers: Peer[];
  load: () => void;
  /** Insert or rotate a paired device (device_id is the key). */
  addPeer: (peer: { deviceId: string; name: string; secret: string }) => void;
  removePeer: (deviceId: string) => void;
  /** Look up a paired peer's secret for verification. Undefined = unknown/untrusted. */
  getSecret: (deviceId: string) => string | undefined;
};

export const usePeersStore = create<PeersStore>((set, get) => ({
  peers: [],

  load() {
    set({ peers: loadAll('peers', rowToPeer, { orderBy: 'paired_at DESC' }) });
  },

  addPeer({ deviceId, name, secret }) {
    const pairedAt = new Date().toISOString();
    // REPLACE upserts on the device_id primary key — re-pairing rotates the secret.
    db.runSync(
      'INSERT OR REPLACE INTO peers (device_id, name, secret, paired_at) VALUES (?, ?, ?, ?)',
      [deviceId, name, secret, pairedAt],
    );
    set((s) => ({
      peers: [{ deviceId, name, secret, pairedAt }, ...s.peers.filter((p) => p.deviceId !== deviceId)],
    }));
  },

  removePeer(deviceId) {
    db.runSync('DELETE FROM peers WHERE device_id = ?', [deviceId]);
    set((s) => ({ peers: s.peers.filter((p) => p.deviceId !== deviceId) }));
  },

  getSecret(deviceId) {
    return get().peers.find((p) => p.deviceId === deviceId)?.secret;
  },
}));
