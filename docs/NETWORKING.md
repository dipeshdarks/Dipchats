# DIPCHATS — NETWORKING ARCHITECTURE

## Transport Abstraction, Mode Selection, Protocol Negotiation & Network State Management

**Project:** DipChats
**Transport Model:** Abstracted multi-transport with automatic selection
**Modes:** Online, Offline Local, Hybrid
**MVP Transports:** WebSocket (online), LAN TCP/WebSocket (offline)
**Future Transports:** BLE, Wi-Fi Direct, WebRTC

---

# 1. Networking Overview

DipChats networking is built on a **transport abstraction** that allows the messaging engine to operate identically regardless of the underlying network technology.

```text
Message Engine
      │
      ▼
Transport Manager
      │
      ├── WebSocket Transport      (online, server-relayed)
      ├── LAN Transport            (offline, direct peer)
      ├── Bluetooth Transport      (offline, mesh relay)     [v2]
      ├── Wi-Fi Direct Transport   (offline, high-bandwidth) [v2]
      ├── WebRTC Transport         (browser P2P)             [v2]
      └── Mesh Orchestrator        (combines offline transports)
```

The messaging engine never directly calls Bluetooth APIs, WebSocket libraries, or network interfaces. It communicates only through the Transport interface.

---

# 2. Transport Interface

## 2.1 Core Interface

```typescript
interface Transport {
  /** Unique transport identifier */
  readonly name: string;

  /** Whether this transport is currently available */
  isAvailable(): Promise<boolean>;

  /** Start the transport */
  start(): Promise<void>;

  /** Stop the transport */
  stop(): Promise<void>;

  /** Connect to a specific peer (if applicable) */
  connect(peerId: string): Promise<Connection>;

  /** Broadcast to all reachable peers (if applicable) */
  broadcast(data: Uint8Array): Promise<void>;

  /** Register data handler */
  onReceive(handler: (peerId: string, data: Uint8Array) => void): void;

  /** Register state change handler */
  onStateChange(handler: (state: TransportState) => void): void;

  /** Get transport capabilities */
  getCapabilities(): TransportCapabilities;

  /** Get current transport state */
  getState(): TransportState;
}

interface Connection {
  peerId: string;
  send(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  onClose(handler: () => void): void;
  getRemotePeerId(): string;
}

interface TransportCapabilities {
  maxPayloadSize: number;       // bytes
  supportsEncryption: boolean;
  supportsRelay: boolean;
  supportsMulticast: boolean;
  bandwidth: 'none' | 'low' | 'medium' | 'high';
  latency: 'unknown' | 'low' | 'medium' | 'high';
  batteryCost: 'unknown' | 'low' | 'medium' | 'high';
  requiresInternet: boolean;
  requiresPermissions: boolean;
}

type TransportState =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'error';
```

## 2.2 Transport Implementations

```text
Transport
├── WebSocketTransport
│   ├── name: "websocket"
│   ├── requiresInternet: true
│   ├── bandwidth: "high"
│   ├── latency: "low" (depends on server proximity)
│   └── supportsRelay: true (via server)
│
├── LANTransport
│   ├── name: "lan"
│   ├── requiresInternet: false
│   ├── bandwidth: "high"
│   ├── latency: "low"
│   └── supportsRelay: true (peer-to-peer)
│
├── BluetoothTransport [v2]
│   ├── name: "bluetooth"
│   ├── requiresInternet: false
│   ├── bandwidth: "low"
│   ├── latency: "medium"
│   └── supportsRelay: true (mesh)
│
├── WiFiDirectTransport [v2]
│   ├── name: "wifi-direct"
│   ├── requiresInternet: false
│   ├── bandwidth: "high"
│   ├── latency: "low"
│   └── supportsRelay: false
│
└── WebRTCTransport [v2]
    ├── name: "webrtc"
    ├── requiresInternet: false (after signaling)
    ├── bandwidth: "high"
    ├── latency: "medium"
    └── supportsRelay: true (via STUN/TURN)
```

---

# 3. Network State Management

## 3.1 Network States

```text
State               Description
───────────────────────────────────────────────────────────
ONLINE              Internet available, server reachable
LOCAL_NETWORK       No Internet, LAN peers available
MESH                No Internet, mesh-capable peers nearby
OFFLINE             No network connectivity
CONNECTING          Transitioning between states
UNKNOWN             State not yet determined
```

## 3.2 State Detection

```text
Network State Manager
       │
       ├── Monitor connectivity:
       │   ├── Periodic server ping (every 10s when online)
       │   ├── LAN peer discovery (broadcast/listen)
       │   ├── BLE scan (v2)
       │   └── Platform network APIs
       │
       ├── Determine state:
       │   ├── Server reachable → ONLINE
       │   ├── No server, LAN peers → LOCAL_NETWORK
       │   ├── No server, BLE peers → MESH
       │   └── No peers, no server → OFFLINE
       │
       └── Emit state change events
```

## 3.3 State Transitions

```text
                    ┌──────────┐
          ┌────────►│ CONNECTING│◄────────┐
          │         └─────┬────┘         │
          │               │              │
     reconnect        timeout       reconnect
          │               │              │
          │               ▼              │
    ┌─────┴──┐      ┌─────────┐    ┌────┴───┐
    │OFFLINE │─────►│  ONLINE  │◄──►│  MESH  │
    └────────┘      └─────────┘    └────────┘
          │               │              │
          │               │         peer lost
          │               │              │
          │               ▼              │
          │         ┌───────────┐        │
          └─────────│LOCAL_NET  │────────┘
                    └───────────┘
```

## 3.4 State Change Events

```typescript
interface NetworkStateEvent {
  previousState: NetworkState;
  currentState: NetworkState;
  timestamp: number;
  reason: 'server_reachable' | 'server_lost' | 'peer_found' | 'peer_lost' | 'timeout' | 'manual';
  availableTransports: string[];
}
```

---

# 4. Transport Manager

## 4.1 Responsibilities

```text
Transport Manager
│
├── Lifecycle
│   ├── Start all available transports
│   ├── Stop all transports on shutdown
│   ├── Restart failed transports
│   └── Handle platform permission changes
│
├── Selection
│   ├── Evaluate transport suitability
│   ├── Select best transport for message
│   ├── Failover on transport failure
│   └── Balance load across transports
│
├── Peer Management
│   ├── Track reachable peers per transport
│   ├── Merge peer lists from multiple transports
│   ├── Handle peer address changes
│   └── Expire stale peers
│
└── Monitoring
    ├── Track transport health
    ├── Report metrics
    ├── Alert on transport failures
    └── Log transport events
```

## 4.2 Transport Selection Algorithm

```text
For each outgoing message:

  1. Check message requirements:
     ├── Target peer or channel?
     ├── Size of payload?
     ├── Urgency level?
     └── Encryption requirements?

  2. Evaluate available transports:
     ├── Is transport available?
     ├── Is target peer reachable via this transport?
     ├── Does transport meet message requirements?
     └── What is the cost (battery, bandwidth)?

  3. Rank transports:
     ├── WebSocket (if online and target online)
     ├── Direct peer (if target in LAN)
     ├── Mesh relay (if target in mesh)
     ├── Courier (if store-and-forward needed)
     └── Local queue (if no transport available)

  4. Select highest-ranked transport

  5. Attempt delivery:
     ├── Success → done
     ├── Failure → try next transport
     └── All failed → queue locally for retry
```

## 4.3 Transport Priority Table

```text
Scenario                          Preferred Transport
──────────────────────────────────────────────────────────────────
Both online                       WebSocket (server relay)
Sender online, recipient offline  Store-and-forward (courier)
Both on same LAN                  LAN (direct peer)
BLE proximity (v2)                BLE (mesh relay)
Large file on LAN                 LAN (high bandwidth)
Large file online                 Chunked upload + WebSocket metadata
```

---

# 5. WebSocket Transport (Online)

## 5.1 Connection

```text
Client                                    Server
  │                                         │
  │  1. DNS resolve + TCP connect           │
  │  2. TLS 1.3 handshake                  │
  │  3. WebSocket upgrade                   │
  │  4. connection.ready received           │
  │  5. auth.authenticate sent              │
  │  6. auth.authenticated received         │
  │  7. channel.subscribe sent              │
  │  8. Ready for messaging                 │
  │                                         │
```

## 5.2 Capabilities

```typescript
const websocketCapabilities: TransportCapabilities = {
  maxPayloadSize: 1_048_576,  // 1 MB
  supportsEncryption: true,    // TLS
  supportsRelay: true,         // Server relays
  supportsMulticast: false,
  bandwidth: 'high',
  latency: 'low',
  batteryCost: 'low',
  requiresInternet: true,
  requiresPermissions: false,
};
```

## 5.3 Reconnection

```text
Disconnect detected
      │
      ▼
Exponential backoff:
  Attempt 1: wait 1s
  Attempt 2: wait 2s
  Attempt 3: wait 4s
  Attempt 4: wait 8s
  Attempt 5: wait 16s
  Attempt 6+: wait 30s (cap)
      │
      ▼
On reconnect:
  1. Re-authenticate
  2. Send sync request with last cursor
  3. Receive missing events
  4. Resume normal operation
```

---

# 6. LAN Transport (MVP Offline)

## 6.1 Peer Discovery

```text
LAN Peer Discovery
       │
       ├── Method 1: UDP Broadcast
       │   ├── Broadcast discovery packet on UDP port
       │   ├── Include: device_id, public_key_fingerprint, protocol_version
       │   ├── Listen for responses
       │   └── Frequency: every 5 seconds
       │
       ├── Method 2: mDNS/DNS-SD
       │   ├── Register _dipchats._tcp service
       │   ├── Include device info in TXT record
       │   └── Browse for _dipchats._tcp services
       │
       └── Method 3: Manual
           └── Enter peer IP:port directly
```

## 6.2 Discovery Packet

```json
{
  "protocol": "dipchats",
  "version": 1,
  "device_id": "a1b2c3d4",
  "public_key_fingerprint": "sha256_hash",
  "display_name": "Alice",
  "capabilities": ["message", "relay", "file_transfer"],
  "listening_port": 4100,
  "timestamp": 1724246400000,
  "signature": "ed25519_signature"
}
```

## 6.3 Connection

```text
Peer A (client)                    Peer B (server)
  │                                    │
  │  1. TCP connect to B:port          │
  │  2. TLS handshake (self-signed)    │
  │  3. Exchange identities            │
  │  4. Verify signatures              │
  │  5. Establish Noise XX session     │
  │  6. Ready for messaging            │
  │                                    │
```

## 6.4 Capabilities

```typescript
const lanCapabilities: TransportCapabilities = {
  maxPayloadSize: 10_485_760,  // 10 MB
  supportsEncryption: true,     // Noise XX
  supportsRelay: true,          // Peer-to-peer relay
  supportsMulticast: true,      // Broadcast discovery
  bandwidth: 'high',
  latency: 'low',
  batteryCost: 'medium',
  requiresInternet: false,
  requiresPermissions: false,
};
```

---

# 7. Bluetooth Transport (v2)

## 7.1 BLE Mesh

```text
BLE Mesh Architecture
       │
       ├── Each device is both:
       │   ├── GATT Central (scanner)
       │   └── GATT Peripheral (advertiser)
       │
       ├── Advertising
       │   ├── Service UUID: DipChats-specific
       │   ├── Payload: compressed device info
       │   └── Interval: 100ms-1s (adaptive)
       │
       ├── Scanning
       │   ├── Active scan for DipChats devices
       │   ├── RSSI-based proximity filtering
       │   └── Connection scheduling (duty-cycled)
       │
       └── Data Transfer
           ├── MTU negotiation (max 512 bytes)
           ├── Chunking for larger payloads
           └── Reliable transfer with ACK
```

## 7.2 Capabilities

```typescript
const bluetoothCapabilities: TransportCapabilities = {
  maxPayloadSize: 512,          // BLE MTU dependent
  supportsEncryption: true,      // Noise XX
  supportsRelay: true,           // Multi-hop mesh
  supportsMulticast: true,       // BLE broadcast
  bandwidth: 'low',
  latency: 'medium',
  batteryCost: 'medium',
  requiresInternet: false,
  requiresPermissions: true,     // BLE scan permission
};
```

---

# 8. Wi-Fi Direct Transport (v2)

## 8.1 Architecture

```text
Wi-Fi Direct
       │
       ├── Group Owner (GO)
       │   ├── One device becomes GO
       │   ├── Manages group
       │   └── Handles IP assignment
       │
       ├── Group Members
       │   ├── Connect to GO
       │   ├── Get IP address
       │   └── Direct communication
       │
       └── Discovery
           ├── Wi-Fi Direct service discovery
           ├── Include DipChats service
           └── Respond to discovery requests
```

## 8.2 Capabilities

```typescript
const wifiDirectCapabilities: TransportCapabilities = {
  maxPayloadSize: 10_485_760,  // 10 MB
  supportsEncryption: true,     // TLS over TCP
  supportsRelay: false,         // Direct connection only
  supportsMulticast: false,
  bandwidth: 'high',
  latency: 'low',
  batteryCost: 'high',
  requiresInternet: false,
  requiresPermissions: true,    // Wi-Fi permissions
};
```

---

# 9. Mesh Orchestrator

## 9.1 Purpose

The Mesh Orchestrator combines multiple offline transports into a unified mesh network:

```text
Mesh Orchestrator
       │
       ├── Manages multiple transports simultaneously
       ├── Merges peer lists from all transports
       ├── Routes messages across transport boundaries
       ├── Handles transport-specific packet formats
       └── Provides unified mesh interface to message engine
```

## 9.2 Cross-Transport Routing

```text
Alice (BLE only)     Relay (BLE + LAN)     Bob (LAN only)
       │                     │                     │
       │  BLE packet         │                     │
       │  ──────────────────►│                     │
       │                     │  Translate to LAN   │
       │                     │  ──────────────────►│
       │                     │                     │
       │  Alice sends via    │  Relay translates   │
       │  BLE                │  and forwards via   │
       │                     │  LAN                │
```

## 9.3 Packet Format

```text
Mesh Packet Header:
┌─────────────────────────────────────────────┐
│ Version (1 byte)    │ Type (1 byte)         │
│ Flags (1 byte)      │ TTL (1 byte)          │
│ Timestamp (8 bytes) │ Sender ID (8 bytes)   │
│ Recipient ID (8 bytes, optional)            │
│ Packet ID (16 bytes)                        │
│ Payload Length (2 bytes)                     │
│ Payload (variable)                          │
│ Signature (64 bytes, Ed25519)               │
└─────────────────────────────────────────────┘

Packet Types:
  0x01  Announcement
  0x02  Message (encrypted)
  0x03  Handshake
  0x04  Courier Envelope
  0x05  Sync Request
  0x06  Sync Response
  0x07  Fragment
  0x08  Fragment ACK
  0x09  File Transfer
  0x0A  File ACK
```

---

# 10. Protocol Negotiation

## 10.1 Version Negotiation

```text
During connection handshake:

Peer A                               Peer B
  │                                    │
  │  Hello(version=1,                  │
  │        supported_versions=[1,2])   │
  │  ─────────────────────────────────►│
  │                                    │
  │          Hello(version=1,          │
  │                negotiated=1)       │
  │  ◄─────────────────────────────────│
  │                                    │
  │  Use version 1 for session         │
```

## 10.2 Capability Negotiation

```text
During connection handshake:

Peer A                               Peer B
  │                                    │
  │  Hello(capabilities=[              │
  │    "message",                      │
  │    "relay",                        │
  │    "file_transfer"                 │
  │  ])                                │
  │  ─────────────────────────────────►│
  │                                    │
  │  Check mutual capabilities:        │
  │  - Both support relay → enable     │
  │  - Both support file → enable      │
  │  - B doesn't support X → disable   │
  │                                    │
  │  Hello(negotiated_capabilities=[]) │
  │  ◄─────────────────────────────────│
```

---

# 11. Message Routing

## 11.1 Online Routing

```text
Sender ──► Server ──► Recipient(s)

Server handles:
  - Channel fan-out
  - DM delivery to all devices
  - Presence-based routing
  - Offline message queuing
```

## 11.2 Mesh Routing

```text
Sender ──► [Relay A] ──► [Relay B] ──► Recipient

Mesh handles:
  - TTL-based hop limiting
  - Deduplication (LRU seen-set)
  - Source routing (when path known)
  - Flooding (when path unknown)
  - Store-and-forward (courier)
```

## 11.3 Hybrid Routing

```text
Message Router
       │
       ├── Check if recipient online (via server)
       │   ├── Yes → WebSocket delivery
       │   └── No ↓
       │
       ├── Check if recipient in mesh
       │   ├── Direct peer → Direct delivery
       │   ├── Relay available → Relay delivery
       │   └── Not reachable ↓
       │
       ├── Check courier availability
       │   ├── Courier available → Store-and-forward
       │   └── No courier ↓
       │
       └── Queue locally for retry
```

---

# 12. Rate Limiting

```text
Scope                    Limit                 Window
──────────────────────────────────────────────────────────
Per IP (HTTP)            100 requests          1 minute
Per device (messages)    60 messages           1 minute
Per device (API)         200 requests          1 minute
Per channel (messages)   120 messages          1 minute
Per peer (mesh packets)  30 packets            1 second
Per peer (mesh bytes)    100 KB                1 second
Typing indicators        10 events             5 seconds
Presence updates         5 updates             60 seconds
```

---

# 13. Connection Limits

```text
Resource                      Limit
──────────────────────────────────────────────────
Max connections per device    3 (multi-device)
Max connections per IP        10
Max WebSocket per server      10,000 (single node)
Max mesh peers per device     50
Max relay peers per device    20
Max concurrent file transfers 3
Max pending messages          1,000
Max courier envelopes         20
```

---

# 14. Error Recovery

```text
Transport Error
      │
      ├── Transient error (timeout, temporary failure)
      │   ├── Retry with backoff
      │   ├── Switch to alternative transport
      │   └── Queue locally if all fail
      │
      ├── Permanent error (certificate, protocol mismatch)
      │   ├── Log error
      │   ├── Disable transport
      │   ├── Notify user
      │   └── Wait for manual recovery
      │
      └── Security error (auth failure, invalid signature)
          ├── Log error
          ├── Close connection
          ├── Notify user
          └── Do not retry automatically
```

---

# 15. Non-Negotiable Networking Rules

1. **Never assume Internet connectivity.**
2. **Never assume a specific transport is available.**
3. **Never send unencrypted data over any transport.**
4. **Never trust peer-provided metadata without verification.**
5. **Never allow unlimited packet rates from peers.**
6. **Never relay packets without TTL limits.**
7. **Never skip deduplication for mesh packets.**
8. **Never assume a route remains stable.**
9. **Never block the UI thread on network operations.**
10. **Never store private keys in transport-layer code.**
11. **Never assume background networking behaves identically across platforms.**
12. **Never allow one peer to exhaust another peer's battery, storage, or bandwidth.**

---

*This document defines the networking architecture for DipChats. The transport abstraction allows the same messaging engine to operate across online, offline, and hybrid network conditions.*
