/**
 * syncService.ts — LAN live-sync orchestration (Decision 038 app integration).
 *
 * Ties lib/lanTransport (mDNS discovery + TCP), lib/peerAuth (HMAC sign/verify),
 * lib/liveSync (LWW delta model), and store/usePeersStore (trusted peers) into one
 * running sync loop: a peer is only ever connected to if it's already paired
 * (present in usePeersStore) — discovery alone never grants trust. Every inbound
 * envelope is verified against the sender's stored secret before applyDelta()
 * touches SQLite; every local mutation on a synced table (store/useTaskStore,
 * store/useShoppingStore) stamps itself via lib/liveSync's touchRow/softDelete and
 * calls broadcastRow() here to push the new state to every connected peer.
 *
 * Connections:
 *   Imports → lib/lanTransport, lib/peerAuth, lib/liveSync, store/usePeersStore
 *   Used by → app/_layout.tsx (start/stop on settings.lanSyncEnabled), app/pair-device.tsx
 *             + app/settings.tsx (isSyncAvailable, to gate the sync UI on a real build),
 *             store/useTaskStore.ts, store/useShoppingStore.ts (broadcastRow after
 *             every local touchRow/softDelete)
 *   Data    → none directly; drives lib/liveSync's SQLite reads/writes indirectly
 *
 * Edit notes:
 *   - Untrusted peers (not yet paired via app/pair-device.tsx) are discovered but
 *     NEVER connected to — that's the whole point of Decision 038d's pairing gate;
 *     don't add a trust-on-first-use shortcut here.
 *   - One LanTransport instance lives at a time (module-level singleton, mirroring
 *     LanTransport's own start()/stop() idempotency). isSyncAvailable() must be
 *     checked before startSync() — the native modules aren't linked in Expo Go/web.
 *   - broadcastRow() is a no-op (silently) when sync isn't running or the row has no
 *     connected trusted peers — callers don't need to check whether sync is running first.
 */
import { LanTransport, LanConnection, LanPeer, isTransportAvailable } from '@/lib/lanTransport';
import { signOutbound, verifyInbound } from '@/lib/peerAuth';
import { SyncTable, RowDelta, buildDelta, applyDelta, parseDelta } from '@/lib/liveSync';
import { usePeersStore } from '@/store/usePeersStore';

let transport: LanTransport | null = null;
/** deviceId -> live outbound/inbound connection, for every currently-reachable trusted peer. */
const connections = new Map<string, LanConnection>();

/** Replace a peer's connection slot, closing whatever was there first so an outbound
 * connect() and a later inbound onEnvelope() for the same peer can never leak a socket. */
function setConnection(deviceId: string, conn: LanConnection): void {
  const existing = connections.get(deviceId);
  if (existing && existing !== conn) existing.close();
  connections.set(deviceId, conn);
}

/** True when the native transport modules are linked (real dev/prod build, not Expo Go/web). */
export function isSyncAvailable(): boolean {
  return isTransportAvailable();
}

/** Start advertising + browsing, connecting only to already-paired peers. Idempotent. */
export function startSync(self: { deviceId: string; name: string }): void {
  if (transport || !isTransportAvailable()) return;

  transport = new LanTransport({ deviceId: self.deviceId, name: self.name });

  transport.on({
    onPeerFound(peer: LanPeer) {
      // Discovery never implies trust — only connect if this device was already
      // paired (has a stored secret) via the QR handshake.
      if (!usePeersStore.getState().getSecret(peer.deviceId)) return;
      if (connections.has(peer.deviceId)) return;
      const conn = transport!.connect(peer);
      setConnection(peer.deviceId, conn);
    },
    onPeerLost(deviceId: string) {
      connections.get(deviceId)?.close();
      connections.delete(deviceId);
    },
    // No onConnection handler: an inbound connection from a peer's own outbound
    // connect() isn't attributable to a deviceId until its first envelope arrives —
    // onEnvelope below is what actually keys it via setConnection().
    onEnvelope(envelope, conn) {
      const secret = usePeersStore.getState().getSecret(envelope.from);
      if (!secret) return; // unknown/unpaired sender — reject, never auto-trust
      const delta = verifyInbound<RowDelta>(secret, envelope.from, envelope.payload);
      if (!delta) return; // bad tag — reject BEFORE trusting the claimed `from`, so a
      // spoofed envelope can never hijack a real peer's connection slot below
      const parsed = parseDelta(delta);
      if (!parsed) return; // malformed delta body — reject
      // Only now, with a cryptographically verified sender, associate this
      // connection with that peer's deviceId for future broadcastRow() sends.
      setConnection(envelope.from, conn);
      applyDelta(parsed);
    },
  });

  transport.start();
}

/** Stop advertising/browsing and close every live connection. Idempotent. */
export function stopSync(): void {
  transport?.stop();
  transport = null;
  connections.forEach((c) => c.close());
  connections.clear();
}

/**
 * Broadcast one row's current state to every connected trusted peer. Call this
 * after lib/liveSync's touchRow()/softDelete() on any local mutation of a synced
 * table. No-op if sync isn't running, the row is gone, or there are no connected
 * peers yet — callers don't need to guard this themselves.
 */
export function broadcastRow(table: SyncTable, id: string): void {
  if (!transport || connections.size === 0) return;
  const delta = buildDelta(table, id);
  if (!delta) return;
  connections.forEach((conn, deviceId) => {
    const secret = usePeersStore.getState().getSecret(deviceId);
    if (!secret) return; // peer was un-paired since connecting — don't leak to it
    const wrapper = signOutbound(secret, transport!.deviceId, delta);
    conn.send(wrapper);
  });
}
