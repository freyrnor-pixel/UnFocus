/**
 * lanTransport.web.ts — Web preview shim for lib/lanTransport.ts.
 *
 * `react-native-zeroconf` / `react-native-tcp-socket` have no web build, so LAN
 * sync is always unavailable in the web preview. `isTransportAvailable()` false
 * means `lib/syncService.ts` never constructs `LanTransport`, so this class body
 * is never actually exercised — it only needs to satisfy the type surface.
 *
 * Connections:
 *   Imports → lib/id
 *   Used by → lib/syncService.ts (web bundle resolves this over lib/lanTransport.ts)
 *   Data    → none
 */
import { generateId } from '@/lib/id';

export const SERVICE_TYPE = 'unfocus';
export const SERVICE_PROTOCOL = 'tcp';
export const SERVICE_DOMAIN = 'local.';
export const DEFAULT_PORT = 47653;

export type LanPeer = {
  deviceId: string;
  name: string;
  host: string;
  port: number;
};

export type LanEnvelope = {
  from: string;
  fromName: string;
  payload: unknown;
};

export type LanConnection = {
  peerHost: string;
  peerPort: number;
  send: (payload: unknown) => boolean;
  close: () => void;
};

type Listeners = {
  onPeerFound?: (peer: LanPeer) => void;
  onPeerLost?: (deviceId: string) => void;
  onEnvelope?: (envelope: LanEnvelope, connection: LanConnection) => void;
  onConnection?: (connection: LanConnection) => void;
};

export function isTransportAvailable(): boolean {
  return false;
}

export class LanTransport {
  private readonly self: { deviceId: string; name: string };

  constructor(opts: { deviceId?: string; name: string; port?: number }) {
    this.self = { deviceId: opts.deviceId ?? generateId(), name: opts.name };
  }

  get deviceId(): string {
    return this.self.deviceId;
  }

  on(_listeners: Listeners): void {}

  start(): void {}

  connect(peer: LanPeer): LanConnection {
    return {
      peerHost: peer.host,
      peerPort: peer.port,
      send: () => false,
      close: () => {},
    };
  }

  stop(): void {}
}
