/**
 * lanTransport.ts — Decision 038a: LAN peer transport (mDNS discovery + TCP stream).
 *
 * The single JS code path for local-network peer sync (iOS + Android parity).
 * Uses `react-native-zeroconf` (Bonjour/NSD) to advertise this device and find
 * peers on the same Wi-Fi, and `react-native-tcp-socket` for the byte stream
 * between them. Messages are newline-delimited JSON envelopes; the `payload`
 * field is opaque to this layer.
 *
 * SCOPE (038a only): this is the transport mechanism — advertise, discover,
 * connect, send/receive framed envelopes. It deliberately does NOT do trust,
 * pairing, or HMAC verification (Decision 038d) and does NOT define the sync
 * data model / conflict policy (Decision 038b). Those layers consume this one:
 * 038d verifies envelopes, 038b interprets `payload`. Keep them out of here.
 *
 * Connections:
 *   Imports → react-native-zeroconf, react-native-tcp-socket (both native — land
 *             in the Decision 038a/027 consolidated build), lib/id
 *   Used by → lib/syncService.ts, which owns the single running LanTransport
 *             instance (start/stop gated by settings.lanSyncEnabled from
 *             app/_layout.tsx) and only ever connects to already-paired peers
 *             (store/usePeersStore)
 *   Data    → none. Holds no SQLite state; identity (deviceId/name) is injected by
 *             the caller so persistence stays a 038d concern.
 *
 * Edit notes:
 *   - Native modules are NOT importable in Expo Go / web. Guard construction: only
 *     instantiate LanTransport inside a real build. `isTransportAvailable()` lets
 *     callers feature-detect before touching it.
 *   - Framing is newline-delimited JSON. Envelope payloads must not contain a raw
 *     newline pre-serialisation issue — JSON.stringify escapes them, so this holds.
 *   - Service type is `_unfocus._tcp`; must match the iOS NSBonjourServices entry
 *     and the Android NSD registration in app.json. Change both together.
 *   - Do not add trust/crypto or row-merge logic here — see SCOPE above.
 *   - react-native-zeroconf's 'remove' event fires with the mDNS service NAME (the
 *     display name), not the TXT record's deviceId `onPeerFound` uses — `nameToDeviceId`
 *     bridges that so `onPeerLost` still reports the right peer to callers keying
 *     connections by deviceId (e.g. lib/syncService.ts).
 *   - The advertised mDNS name is `${name}#${last 8 chars of deviceId}`, not the raw
 *     display name. react-native-zeroconf doesn't reliably deliver the TXT record on
 *     every platform/timing, and `resolved`'s peer-id fallback used to drop straight to
 *     `service.name` when TXT was missing — two devices left on their default name would
 *     then resolve to the *same* peerId and stomp each other's connection/secret lookup.
 *     Baking the deviceId suffix into the name itself (self.deviceId is already a stable
 *     per-install id, injected by the caller from useSettingsStore) means the fallback is
 *     collision-safe even without the TXT record. `splitAdvertisedName` strips the suffix
 *     back off for the human-facing `name` field.
 */
import Zeroconf from 'react-native-zeroconf';
import TcpSocket from 'react-native-tcp-socket';
import { generateId } from '@/lib/id';

/** Bonjour/NSD service identity. Mirror in app.json (iOS NSBonjourServices). */
export const SERVICE_TYPE = 'unfocus';
export const SERVICE_PROTOCOL = 'tcp';
export const SERVICE_DOMAIN = 'local.';
/** Default TCP port the peer listener binds. Chosen high/unprivileged. */
export const DEFAULT_PORT = 47653;

/** A discovered peer on the LAN (pre-trust — 038d decides if it is paired). */
export type LanPeer = {
  /** Advertised device id (from the TXT record). Stable per install once 038d persists it. */
  deviceId: string;
  /** Human-facing device name. */
  name: string;
  /** Resolved IP host. */
  host: string;
  /** TCP port the peer's listener is on. */
  port: number;
};

/** An opaque message crossing the wire. `payload` is defined by 038b, not here. */
export type LanEnvelope = {
  /** Sender's device id — lets the receiver attribute/verify (038d) the message. */
  from: string;
  /** Sender's device name at send time (convenience for UI; not a trust anchor). */
  fromName: string;
  /** Opaque application payload. Transport neither reads nor validates its shape. */
  payload: unknown;
};

/** Live connection to one peer. Wraps a TCP socket + newline-frame buffer. */
export type LanConnection = {
  peerHost: string;
  peerPort: number;
  /** Serialise + frame + write one envelope. Returns false if the socket is gone. */
  send: (payload: unknown) => boolean;
  /** Close the underlying socket. */
  close: () => void;
};

type Listeners = {
  onPeerFound?: (peer: LanPeer) => void;
  onPeerLost?: (deviceId: string) => void;
  /** Fired for every fully-framed inbound envelope on any connection. */
  onEnvelope?: (envelope: LanEnvelope, connection: LanConnection) => void;
  /** Fired when a remote peer opens a connection to our listener. */
  onConnection?: (connection: LanConnection) => void;
};

/**
 * True when the native transport modules are linked (a real dev/prod build).
 * In Expo Go, web, or before the 038a build is cut, this is false and callers
 * should treat LAN sync as unavailable rather than constructing LanTransport.
 */
export function isTransportAvailable(): boolean {
  return !!Zeroconf && !!TcpSocket;
}

/** Separator between the human-facing name and the per-install deviceId suffix in the
 * advertised mDNS name (see the header edit note on the peer-id fallback). */
const NAME_SUFFIX_SEP = '#';

/** Build the mDNS instance name we actually publish: display name + stable suffix. */
function buildAdvertisedName(name: string, deviceId: string): string {
  return `${name}${NAME_SUFFIX_SEP}${deviceId.slice(-8)}`;
}

/** Reverse buildAdvertisedName: recover the display name and the deviceId suffix (if any)
 * from a raw mDNS service name — used as the TXT-record fallback for peer identity. */
function splitAdvertisedName(rawName: string): { name: string; suffix: string | null } {
  const i = rawName.lastIndexOf(NAME_SUFFIX_SEP);
  if (i < 0) return { name: rawName, suffix: null };
  return { name: rawName.slice(0, i), suffix: rawName.slice(i + 1) };
}

/**
 * Wrap a raw TCP socket with newline-JSON framing. `self` is our own identity,
 * stamped onto every outbound envelope. Inbound complete lines are parsed and
 * handed to `onEnvelope`.
 */
function wrapSocket(
  socket: any,
  self: { deviceId: string; name: string },
  onEnvelope: (envelope: LanEnvelope, connection: LanConnection) => void,
): LanConnection {
  let buffer = '';
  let alive = true;

  const connection: LanConnection = {
    peerHost: socket.remoteAddress ?? '',
    peerPort: socket.remotePort ?? 0,
    send(payload: unknown) {
      if (!alive) return false;
      const envelope: LanEnvelope = { from: self.deviceId, fromName: self.name, payload };
      try {
        socket.write(JSON.stringify(envelope) + '\n');
        return true;
      } catch {
        return false;
      }
    },
    close() {
      alive = false;
      try {
        socket.destroy();
      } catch {
        /* already closed */
      }
    },
  };

  socket.on('data', (data: Buffer | string) => {
    buffer += typeof data === 'string' ? data : data.toString('utf8');
    let newlineIndex: number;
    // Process every complete newline-terminated frame; keep any partial tail.
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed.from === 'string' && 'payload' in parsed) {
          onEnvelope(parsed as LanEnvelope, connection);
        }
      } catch {
        /* drop malformed frame — a 038d verify layer would also reject it */
      }
    }
  });
  socket.on('error', () => {
    alive = false;
  });
  socket.on('close', () => {
    alive = false;
  });

  return connection;
}

/**
 * Foundation transport for LAN peer sync. Construct one per app; it owns the
 * zeroconf browser/publisher and the TCP listener. Identity is injected so this
 * layer never touches persistence (a 038d concern).
 */
export class LanTransport {
  private zeroconf: Zeroconf;
  private server: any = null;
  private listeners: Listeners = {};
  private readonly self: { deviceId: string; name: string };
  private readonly port: number;
  private started = false;
  /** mDNS service name -> deviceId, so the 'remove' event (which only carries the
   * service name, not the TXT record) can still report the right peer to onPeerLost. */
  private nameToDeviceId = new Map<string, string>();

  /**
   * @param opts.deviceId Stable id to advertise. Falls back to an ephemeral id;
   *   038d supplies a persisted one so peers survive relaunch.
   * @param opts.name    Human-facing device name shown to peers.
   * @param opts.port    TCP listen port (default DEFAULT_PORT).
   */
  constructor(opts: { deviceId?: string; name: string; port?: number }) {
    this.zeroconf = new Zeroconf();
    this.self = { deviceId: opts.deviceId ?? generateId(), name: opts.name };
    this.port = opts.port ?? DEFAULT_PORT;
  }

  /** This device's advertised id (whatever was injected or generated). */
  get deviceId(): string {
    return this.self.deviceId;
  }

  /** The mDNS instance name actually published — display name + deviceId suffix. */
  private get advertisedName(): string {
    return buildAdvertisedName(this.self.name, this.self.deviceId);
  }

  on(listeners: Listeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * Bind the TCP listener, publish our service, and start browsing for peers.
   * Idempotent — a second call is a no-op while already started.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.server = TcpSocket.createServer((socket: any) => {
      const connection = wrapSocket(socket, this.self, (env, conn) =>
        this.listeners.onEnvelope?.(env, conn),
      );
      this.listeners.onConnection?.(connection);
    });
    this.server.listen({ port: this.port, host: '0.0.0.0' });

    // Advertise ourselves. TXT record carries the deviceId so a resolved peer is
    // attributable before any connection opens; the deviceId suffix baked into the
    // advertised name itself keeps the fallback below collision-safe when the TXT
    // record doesn't make it across (see header edit note).
    this.zeroconf.publishService(
      SERVICE_TYPE,
      SERVICE_PROTOCOL,
      SERVICE_DOMAIN,
      this.advertisedName,
      this.port,
      { deviceId: this.self.deviceId },
    );

    this.zeroconf.on('resolved', (service: any) => {
      const host: string | undefined = service?.addresses?.[0] ?? service?.host;
      if (!host) return;
      const rawName: string | undefined = service?.name;
      const { name: displayName, suffix } = rawName
        ? splitAdvertisedName(rawName)
        : { name: undefined, suffix: null };
      // Ignore our own advertisement echoing back.
      const peerId = service?.txt?.deviceId ?? suffix ?? rawName ?? host;
      if (peerId === this.self.deviceId) return;
      if (rawName) this.nameToDeviceId.set(rawName, peerId);
      this.listeners.onPeerFound?.({
        deviceId: peerId,
        name: displayName ?? peerId,
        host,
        port: service?.port ?? this.port,
      });
    });
    // react-native-zeroconf's 'remove' event fires with the mDNS service NAME (the
    // display name passed to publishService), not the TXT record's deviceId — translate
    // it back via the map 'resolved' populated, or onPeerLost would key on the wrong
    // value and syncService's connections map (keyed by deviceId) would never clean up.
    this.zeroconf.on('remove', (name: string) => {
      const deviceId = this.nameToDeviceId.get(name);
      this.nameToDeviceId.delete(name);
      if (deviceId) this.listeners.onPeerLost?.(deviceId);
    });

    this.zeroconf.scan(SERVICE_TYPE, SERVICE_PROTOCOL, SERVICE_DOMAIN);
  }

  /** Open an outbound connection to a discovered peer. */
  connect(peer: LanPeer): LanConnection {
    const socket = TcpSocket.createConnection({ host: peer.host, port: peer.port }, () => {
      /* connected */
    });
    return wrapSocket(socket, this.self, (env, conn) =>
      this.listeners.onEnvelope?.(env, conn),
    );
  }

  /** Tear everything down: stop advertising/browsing and close the listener. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    try {
      this.zeroconf.stop();
      this.zeroconf.unpublishService(this.advertisedName);
      this.zeroconf.removeDeviceListeners();
    } catch {
      /* zeroconf already down */
    }
    try {
      this.server?.close();
    } catch {
      /* server already closed */
    }
    this.server = null;
  }
}
