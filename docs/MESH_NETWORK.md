# DipChats Mesh Network Specification

**Version:** 1.0.0
**Status:** DRAFT
**Last Updated:** 2026-08-23

---

## Table of Contents

1. [Overview](#1-overview)
2. [Spray-and-Wait Courier System](#2-spray-and-wait-courier-system)
3. [Peer Discovery](#3-peer-discovery)
4. [Mesh Routing](#4-mesh-routing)
5. [Store-and-Forward](#5-store-and-forward)
6. [Gossip Sync](#6-gossip-sync)
7. [CRDT Offline Reconciliation](#7-crdt-offline-reconciliation)
8. [Multi-Hop Relay](#8-multi-hop-relay)
9. [Mesh Security](#9-mesh-security)
10. [File Sharing Over Mesh](#10-file-sharing-over-mesh)
11. [Battery Awareness](#11-battery-awareness)
12. [Mesh Manager Module Structure](#12-mesh-manager-module-structure)
13. [Testing Strategy](#13-testing-strategy)
14. [Non-Negotiable Rules](#14-non-negotiable-rules)
15. [Repository Structure](#15-repository-structure)

---

## 1. Overview

DipChats is a decentralized, serverless chat platform where all communication
happens over a peer-to-peer mesh network. There are no accounts, no passwords,
and no central authority. Identity is purely local — each peer generates a
long-lived keypair and derives all routing material from it.

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DipChats Mesh Network                        │
│                                                                     │
│  ┌──────────┐    spray    ┌──────────┐    spray    ┌──────────┐    │
│  │  Peer A  │────────────▶│ Courier  │────────────▶│  Peer B  │    │
│  │ (sender) │             │  Node X  │             │ (recipient)│   │
│  └──────────┘             └──────────┘             └──────────┘    │
│       │                        │                       ▲            │
│       │ direct                 │ direct                │ direct     │
│       ▼ encounter              ▼ encounter             │ encounter  │
│  ┌──────────┐             ┌──────────┐                │            │
│  │ Courier  │             │ Courier  │────────────────┘            │
│  │  Node Y  │             │  Node Z  │                             │
│  └──────────┘             └──────────┘                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Protocol Stack                          │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  Application Layer  (Chat UI, File Sharing)          │  │   │
│  │  ├───────────────────────────────────────────────────────┤  │   │
│  │  │  CRDT Layer  (Message DAG, Offline Merge)            │  │   │
│  │  ├───────────────────────────────────────────────────────┤  │   │
│  │  │  Gossip Layer  (Compact Filters, Inventory Exchange)  │  │   │
│  │  ├───────────────────────────────────────────────────────┤  │   │
│  │  │  Routing Layer  (TTL, Hop Count, Deduplication)       │  │   │
│  │  ├───────────────────────────────────────────────────────┤  │   │
│  │  │  Transport Layer  (TCP/WebSocket v1, BLE v2)          │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

| Principle | Rationale |
|-----------|-----------|
| No accounts | Identity is a keypair. No registration, no server. |
| Spray-and-wait | Messages ride with multiple couriers for redundancy. |
| Opaque routing | Relay nodes see only ciphertext envelopes. |
| Store-and-forward | Couriers hold messages until encounter. |
| CRDT-first | Offline editing merges deterministically. |
| LAN-first, mesh-next | MVP uses TCP/WebSocket; v2 adds BLE + Wi-Fi Direct. |

### 1.3 Threat Model

```
┌─────────────────────────────────────────────────────┐
│                Threat Actors                         │
│                                                      │
│  Passive Observer   Can see encrypted traffic flow   │
│  Active Adversary   Can inject, modify, drop packets │
│  Malicious Courier  Can inspect, delay, or drop msgs │
│  Sybil Attacker     Can spin up many fake peers      │
│  Eclipse Attacker   Can isolate a target peer        │
└─────────────────────────────────────────────────────┘
```

**Mitigations:**
- End-to-end encryption (Noise XX for sessions, XChaCha20-Poly1305 for courier envelopes)
- HMAC-based recipient tags prevent targeted inspection
- TTL + hop limits prevent indefinite relay
- Per-peer rate limiting thwarts flood attacks
- No peer ID is transmitted in plaintext during relay

---

## 2. Spray-and-Wait Courier System

### 2.1 Concept

When Peer A wants to send a message to Peer B (and B is not directly
reachable), A creates multiple encrypted copies of the message and gives
each copy to a different courier node. Couriers carry the message and
deliver it upon encountering Peer B.

```
┌─────────┐                              ┌─────────┐
│ Peer A  │ ──── envelope (k copies) ───▶ │ Courier │
│ (sender)│     ┌─────────────────┐       │  Node 1 │
│         │ ───▶│ Courier Node 2  │       │         │
│         │     └─────────────────┘       │         │
│         │ ───▶ Courier Node 3           │         │
└─────────┘                              └─────────┘
                                             │
                                     ┌───────┴───────┐
                                     │  On encounter  │
                                     │  with Peer B:  │
                                     │  deliver msg   │
                                     └───────┬───────┘
                                             │
                                       ┌─────▼─────┐
                                       │  Peer B   │
                                       │(recipient)│
                                       └───────────┘
```

### 2.2 Envelope Format

Each spray envelope is a self-contained encrypted blob. Couriers never
see plaintext.

```
┌──────────────────────────────────────────────────────────────┐
│                     Courier Envelope                         │
├──────────────────────────────────────────────────────────────┤
│ Byte Range  │ Field              │ Description               │
├─────────────┼────────────────────┼───────────────────────────┤
│ [0..1]      │ version (u16)      │ Protocol version (1)      │
│ [2..2]      │ type (u8)          │ 0x01 = courier envelope   │
│ [3..4]      │ flags (u16)        │ Bit flags (see below)     │
│ [5..36]     │ recipient_tag (32B)│ HMAC-SHA256 recipient tag  │
│ [37..68]    │ envelope_id (32B)  │ Random unique ID          │
│ [69..72]    │ ttl_seconds (u32)  │ Time-to-live in seconds   │
│ [73..76]    │ hop_count (u32)    │ Current hop count         │
│ [77..80]    │ max_hops (u32)     │ Maximum allowed hops      │
│ [81..112]   │ sender_pubkey (32B)│ X25519 public key         │
│ [113..114]  │ payload_len (u16)  │ Encrypted payload length  │
│ [115..N]    │ payload (var)      │ XChaCha20-Poly1305密文    │
│ [N+1..N+16]│ auth_tag (16B)     │ Poly1305 over header      │
└──────────────────────────────────────────────────────────────┘
```

**Flags:**

| Bit | Name | Description |
|-----|------|-------------|
| 0 | DELIVERED | Set to 1 when delivered to recipient |
| 1 | ACK_REQUESTED | Recipient should send delivery ack |
| 2 | IS_FRAGMENT | Message is a fragment of a larger payload |
| 3 | FRAG_FIRST | This is the first fragment |
| 4 | FRAG_LAST | This is the last fragment |

### 2.3 Recipient Tags

Recipient tags allow couriers to route messages without knowing the
recipient's identity. Each peer generates a **daily-rotating HMAC tag**
from their static public key and the current date.

```typescript
function deriveRecipientTag(
  privateKey: Uint8Array,      // Ed25519 seed (32 bytes)
  date: Date = new Date()
): Uint8Array {
  const daySeed = deriveDaySeed(privateKey, date);
  const hmac = createHmac('sha256', daySeed);
  hmac.update(new TextEncoder().encode('dipchats-recipient-tag'));
  return new Uint8Array(hmac.digest());  // 32 bytes
}

function deriveDaySeed(
  privateKey: Uint8Array,
  date: Date
): Uint8Array {
  const dateStr = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const hmac = createHmac('sha256', privateKey);
  hmac.update(new TextEncoder().encode(dateStr));
  return new Uint8Array(hmac.digest());
}
```

**Courier matching logic:**

```typescript
function courierMatchesEnvelope(
  courierKnownTags: Uint8Array[],   // Tags this courier knows about
  envelope: CourierEnvelope
): boolean {
  const tag = envelope.recipientTag;
  return courierKnownTags.some(
    known => constantTimeEqual(known, tag)  // Constant-time comparison
  );
}
```

Couriers periodically poll their known contacts for updated tags.
Tags are never transmitted directly — they are derived locally.

### 2.4 Spray Algorithm

```
SPRAY-AND-WAIT ALGORITHM
========================

Parameters:
  K = spray_factor (default: 5)    — number of copies per message
  R = redundancy  (default: 3)     — min couriers before drop
  T = ttl         (default: 3600s) — message time-to-live

procedure SPRAY(message, recipient_tag):
  msg_id = random_bytes(32)
  envelope = encryptEnvelope(message, recipient_tag, msg_id)

  available_couriers = FIND_COURIERS_FOR_TAG(recipient_tag)

  if length(available_couriers) < R:
    queue_for_later(envelope)    // Not enough couriers yet
    return QUEUED

  selected = RANDOM_SAMPLE(available_couriers, K)

  for courier in selected:
    DELIVER_TO_COURIER(courier, envelope)

  return SPRAYED
```

### 2.5 Courier Eligibility

A peer is eligible to act as a courier if and only if:

1. It has available storage budget (see Section 5)
2. It is not at battery-critical level (see Section 11)
3. It has the recipient's tag in its routing table
4. It is not currently rate-limited

```typescript
interface CourierEligibility {
  hasStorageBudget: boolean;
  batteryLevel: 'critical' | 'low' | 'normal' | 'full';
  hasRecipientTag: boolean;
  isRateLimited: boolean;
}

function isCourierEligible(
  peer: PeerState,
  envelope: CourierEnvelope,
  storageBudget: number
): boolean {
  const currentQueueSize = peer.courierQueue.length;
  return (
    currentQueueSize < storageBudget &&
    peer.batteryLevel !== 'critical' &&
    peer.knownTags.includes(envelope.recipientTag) &&
    !peer.isRateLimited
  );
}
```

### 2.6 Delivery on Encounter

```
ENCOUNTER DETECTED
      │
      ▼
┌──────────────┐     YES    ┌──────────────────┐
│ Peer is      │───────────▶│ Direct send to   │
│ recipient?   │            │ recipient        │
└──────┬───────┘            └──────────────────┘
       │ NO
       ▼
┌──────────────┐     YES    ┌──────────────────┐
│ Peer has     │───────────▶│ Forward to peer  │
│ recipient's  │            │ for next hop     │
│ route?       │            └──────────────────┘
└──────┬───────┘
       │ NO
       ▼
┌──────────────┐     YES    ┌──────────────────┐
│ Carrier has  │───────────▶│ Keep carrying     │
│ storage +    │            │ (no action)       │
│ TTL?         │            └──────────────────┘
└──────┬───────┘
       │ NO
       ▼
   DROP ENVELOPE
```

---

## 3. Peer Discovery

### 3.1 LAN Broadcast

On startup, each peer broadcasts its presence on the local network.

```
┌──────────────────────────────────────────────────────────┐
│               Discovery Packet Format                     │
├──────────────────────────────────────────────────────────┤
│ Field              │ Size    │ Description               │
├────────────────────┼─────────┼───────────────────────────┤
│ magic              │ 4B      │ 0x44495043 ("DIPC")       │
│ version            │ 2B      │ Protocol version          │
│ peer_id_hash       │ 32B     │ SHA-256 of public key     │
│ display_name       │ var+1   │ UTF-8 with length prefix  │
│ listen_port        │ 2B      │ TCP port (0 = no TCP)     │
│ ble_advertisement  │ 32B     │ BLE service UUID (v2)     │
│ capabilities       │ 4B      │ Bit flags                 │
│ signature          │ 64B     │ Ed25519 over all fields   │
└────────────────────┴─────────┴───────────────────────────┘
```

**Capabilities flags:**

| Bit | Capability |
|-----|-----------|
| 0 | Can act as courier |
| 1 | Can relay messages |
| 2 | Has file storage |
| 3 | Is battery-powered |
| 4 | Supports BLE transport |
| 5 | Supports Wi-Fi Direct |

### 3.2 mDNS

On networks that support multicast DNS:

```
Service Type: _dipchats._tcp.local.
Instance Name: <display_name>
TXT Records:
  ver=1             — protocol version
  cap=0x00000001    — capabilities bitmask
  pk=<base64>       — ephemeral public key (session-scoped)
```

mDNS advertisement is sent every **60 seconds** and expires after
**180 seconds** without refresh.

### 3.3 Announcement Lifecycle

```
         STARTUP
            │
            ▼
    ┌───────────────┐
    │ Generate      │
    │ ephemeral     │
    │ session key   │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐     BROADCAST every 60s
    │ Broadcast     │◀────────────────────────┐
    │ announcement  │                         │
    └───────┬───────┘                         │
            │                                 │
            ▼                                 │
    ┌───────────────┐                         │
    │ Receive       │                         │
    │ peer          │                         │
    │ announcements │                         │
    └───────┬───────┘                         │
            │                                 │
            ▼                                 │
    ┌───────────────┐     if no refresh       │
    │ Update peer   │     for 180s ──────────▶│
    │ table         │                         │
    └───────────────┘
```

### 3.4 Peer State Table

```typescript
interface PeerEntry {
  peerIdHash: string;           // SHA-256 of long-term public key
  displayname: string;
  ephemeralPubkey: Uint8Array;  // Session-scoped X25519 public key
  transport: TransportInfo;
  capabilities: CapabilityFlags;
  lastSeen: number;             // Timestamp (ms)
  rttEstimate: number;          // Round-trip time estimate (ms)
  score: number;                // Composite trust score (0-100)
}

interface TransportInfo {
  tcp?: { host: string; port: number };
  ble?: { deviceId: string; characteristicId: string };
  wifiDirect?: { deviceId: string; ssid: string };
}
```

---

## 4. Mesh Routing

### 4.1 Packet Structure

Every mesh packet carries routing metadata in a fixed-size header.

```
┌──────────────────────────────────────────────────────┐
│                  Mesh Packet Header                   │
├──────────────────────────────────────────────────────┤
│ Byte Range │ Field          │ Description            │
├────────────┼────────────────┼────────────────────────┤
│ [0..3]     │ magic          │ 0x444D5348 ("DMSH")   │
│ [4..5]     │ version        │ Routing version (1)    │
│ [6..7]     │ packet_type    │ Enum (see below)       │
│ [8..11]    │ flags          │ Routing flags          │
│ [12..43]   │ packet_id      │ 32B random nonce       │
│ [44..75]   │ source_hash    │ SHA-256(src pubkey)    │
│ [76..107]  │ dest_hash      │ SHA-256(dst pubkey)    │
│            │                │ (0=all for broadcast)  │
│ [108..111] │ ttl            │ Time-to-live (seconds) │
│ [112..115] │ hop_count      │ Current hops taken     │
│ [116..119] │ max_hops       │ Maximum hops allowed   │
│ [120..123] │ payload_len    │ Payload length (bytes) │
│ [124..N]   │ payload        │ Encrypted payload      │
│ [N+1..N+32]│ signature      │ HMAC-SHA256 of header  │
└──────────────────────────────────────────────────────┘
```

### 4.2 Packet Types

```typescript
enum PacketType {
  DATA            = 0x01,  // Encrypted data payload
  COURIER_ENVELOPE = 0x02, // Spray-and-wait envelope
  DISCOVERY       = 0x03,  // Peer discovery broadcast
  HEARTBEAT       = 0x04,  // Keepalive ping
  GOSSIP_ANNOUNCE = 0x05,  // Gossip inventory announce
  GOSSIP_REQUEST  = 0x06,  // Request specific items
  GOSSIP_DATA     = 0x07,  // Gossip data transfer
  RELAY_REQUEST   = 0x08,  // Request relay from peer
  RELAY_ACK       = 0x09,  // Relay acknowledgment
  FRAGMENT        = 0x0A,  // Message fragment
  FILE_INIT       = 0x0B,  // File transfer initiation
  FILE_CHUNK      = 0x0C,  // File data chunk
  FILE_ACK        = 0x0D,  // File transfer acknowledgment
}
```

### 4.3 Flooding with Deduplication

The primary routing strategy is **controlled flooding**:

```
PROCEDURE FLOOD_FORWARD(packet, received_from):
  // Step 1: Deduplication check
  if packet.packet_id in SEEN_CACHE:
    DROP
    return

  // Step 2: Add to seen cache (TTL-based eviction)
  SEEN_CACHE.add(packet.packet_id, NOW + SEEN_TTL)

  // Step 3: Check TTL and hop count
  if packet.ttl <= 0 OR packet.hop_count >= packet.max_hops:
    DROP
    return

  // Step 4: Check if we are the destination
  if packet.dest_hash == OUR_HASH:
    PROCESS Locally(packet)
    return

  // Step 5: Forward to all neighbors except sender
  for neighbor in NEIGHBORS:
    if neighbor.id != received_from.id:
      FORWARD(neighbor, packet)
```

### 4.4 Deduplication Cache

```typescript
interface DedupCache {
  seen: Map<string, number>;  // packet_id → expiry timestamp
  maxSize: number;            // Maximum entries (default: 10000)
}

function isDuplicate(cache: DedupCache, packetId: Uint8Array): boolean {
  const key = uint8ArrayToHex(packetId);
  const now = Date.now();

  // Evict expired entries
  evictExpired(cache, now);

  if (cache.seen.has(key)) {
    return true;
  }

  cache.seen.set(key, now + 300_000);  // 5-minute window
  return false;
}

function evictExpired(cache: DedupCache, now: number): void {
  if (cache.seen.size < cache.maxSize) return;

  for (const [key, expiry] of cache.seen) {
    if (expiry <= now) {
      cache.seen.delete(key);
    }
  }

  // If still over limit, evict oldest 10%
  if (cache.seen.size > cache.maxSize) {
    const entries = Array.from(cache.seen.entries())
      .sort((a, b) => a[1] - b[1]);
    const evictCount = Math.floor(entries.length * 0.1);
    for (let i = 0; i < evictCount; i++) {
      cache.seen.delete(entries[i][0]);
    }
  }
}
```

### 4.5 Source Routing (Optional, v2)

For known paths, source routing reduces flooding overhead:

```
┌──────────────────────────────────────────────────────┐
│              Source Route Header                      │
├──────────────────────────────────────────────────────┤
│ Field              │ Description                     │
├────────────────────┼─────────────────────────────────┤
│ route_length       │ Number of hops in source route  │
│ hop_0_hash         │ SHA-256 of first relay's key    │
│ hop_1_hash         │ SHA-256 of second relay's key   │
│ ...                │ ...                             │
│ current_hop_index  │ Which hop we are at             │
└──────────────────────────────────────────────────────┘
```

Source routes are built via route discovery and cached for reuse.

### 4.6 Loop Prevention

```typescript
interface LoopPrevention {
  seenCache: DedupCache;
  sourceRoutes: Map<string, SourceRoute>;
}

function wouldLoop(
  prevention: LoopPrevention,
  packet: MeshPacket,
  neighborId: string
): boolean {
  // Check 1: Already seen this packet
  if (isDuplicate(prevention.seenCache, packet.packetId)) {
    return true;
  }

  // Check 2: Neighbor is in our source route path
  if (packet.flags & PacketFlags.SOURCE_ROUTED) {
    const route = packet.sourceRoute;
    for (let i = route.currentIndex + 1; i < route.hops.length; i++) {
      if (route.hops[i] === neighborId) {
        return true;  // Would create a loop
      }
    }
  }

  return false;
}
```

---

## 5. Store-and-Forward

### 5.1 Sender Outbox

When a message cannot be delivered immediately, the sender places it
in its outbox for later spraying.

```typescript
interface OutboxEntry {
  envelopeId: string;
  recipientTag: Uint8Array;
  payload: Uint8Array;         // Encrypted envelope
  createdAt: number;
  expiresAt: number;
  retryCount: number;
  maxRetries: number;
  status: 'queued' | 'spraying' | 'delivered' | 'expired';
}

interface SenderOutbox {
  entries: Map<string, OutboxEntry>;
  maxEntries: number;          // Default: 1000
  maxAgeMs: number;            // Default: 24 hours
}
```

### 5.2 Courier Queue

Each courier maintains a bounded queue of envelopes it is carrying.

```typescript
interface CourierQueue {
  entries: Map<string, CourierEntry>;
  maxEntries: number;          // Default: 500
  maxSizeBytes: number;        // Default: 10 MB
  currentSizeBytes: number;
}

interface CourierEntry {
  envelopeId: string;
  recipientTag: Uint8Array;
  payload: Uint8Array;
  receivedAt: number;
  expiresAt: number;
  hopsCarried: number;
}
```

### 5.3 Queue Limits and Eviction

```
EVICATION POLICY
================

When courier queue is full:
  1. Evict expired entries first
  2. Evict entries with highest hop_count (oldest path)
  3. Evict entries with lowest remaining TTL
  4. If still full, reject new entries (QUEUE_FULL error)

Queue pressure thresholds:
  80% capacity → evict expired only
  90% capacity → evict expired + high-hop entries
  95% capacity → aggressive eviction
  100% capacity → reject new entries
```

```typescript
function evictCourierQueue(queue: CourierQueue): void {
  const now = Date.now();
  const entries = Array.from(queue.entries.values());

  // Phase 1: Remove expired
  for (const entry of entries) {
    if (entry.expiresAt <= now) {
      queue.entries.delete(entry.envelopeId);
      queue.currentSizeBytes -= entry.payload.length;
    }
  }

  // Phase 2: If still over 90%, remove highest-hop entries
  const utilization = queue.currentSizeBytes / queue.maxSizeBytes;
  if (utilization > 0.9) {
    const remaining = Array.from(queue.entries.values())
      .sort((a, b) => b.hopsCarried - a.hopsCarried);

    while (queue.currentSizeBytes / queue.maxSizeBytes > 0.8) {
      const oldest = remaining.pop();
      if (!oldest) break;
      queue.entries.delete(oldest.envelopeId);
      queue.currentSizeBytes -= oldest.payload.length;
    }
  }
}
```

### 5.4 Expiration

| Message Type | Default TTL | Max TTL |
|-------------|------------|---------|
| Chat message | 24 hours | 72 hours |
| Courier envelope | 1 hour | 24 hours |
| File chunk | 6 hours | 48 hours |
| Discovery broadcast | 60 seconds | 120 seconds |
| Gossip announcement | 300 seconds | 900 seconds |

---

## 6. Gossip Sync

### 6.1 Compact Filters

Peers use **Bloom filters** to compactly represent which messages they
hold. This allows efficient set reconciliation without transferring
full inventories.

```typescript
interface CompactFilter {
  filterType: 'bloom' | 'cuckoo';
  parameters: {
    size: number;          // Filter size in bits
    numHashes: number;     // Number of hash functions
    numInserts: number;    // Items inserted
  };
  data: Uint8Array;        // Serialized filter bits
  epoch: number;           // Monotonic epoch counter
  peerIdHash: string;      // Owner of this filter
}

interface GossipState {
  localFilter: CompactFilter;
  remoteFilters: Map<string, CompactFilter>;
  pendingRequests: Map<string, GossipRequest>;
}
```

### 6.2 Inventory Exchange Protocol

```
GOSSIP SYNC PROTOCOL
====================

    Peer A                          Peer B
      │                               │
      │──── GOSSIP_ANNOUNCE ─────────▶│
      │     (filter, epoch)           │
      │                               │
      │◀──── GOSSIP_ANNOUNCE ─────────│
      │      (filter, epoch)          │
      │                               │
      │  [Compute difference]         │
      │                               │
      │──── GOSSIP_REQUEST ──────────▶│
      │     (item_ids we need)        │
      │                               │
      │◀──── GOSSIP_DATA ─────────────│
      │      (requested items)        │
      │                               │
      │  [Update local filter]        │
      │                               │
```

### 6.3 Reconciliation Algorithm

```typescript
function reconcileGossip(
  localFilter: CompactFilter,
  remoteFilter: CompactFilter
): { toRequest: string[]; toSend: string[] } {
  const toRequest: string[] = [];
  const toSend: string[] = [];

  // Items we have that remote might not
  for (const itemId of localInventory) {
    if (!remoteFilter.mightContain(itemId)) {
      toSend.push(itemId);
    }
  }

  // Items remote has that we don't
  for (const itemId of remoteInventory) {
    if (!localFilter.mightContain(itemId)) {
      toRequest.push(itemId);
    }
  }

  // For false-positive-prone filters, verify with full item hashes
  return filterFalsePositives(toRequest, toSend);
}
```

### 6.4 Sync Cadence

| Trigger | Action |
|---------|--------|
| New peer discovered | Full exchange |
| Peer comes back online | Incremental sync |
| Periodic timer (30s) | Quick filter exchange |
| After message sent | Update local filter |
| After message received | Update local filter |

---

## 7. CRDT Offline Reconciliation

### 7.1 Vector Clocks

Every message carries a vector clock for causal ordering.

```typescript
interface VectorClock {
  [peerIdHash: string]: number;
}

function bumpClock(
  clock: VectorClock,
  peerIdHash: string
): VectorClock {
  return {
    ...clock,
    [peerIdHash]: (clock[peerIdHash] || 0) + 1,
  };
}

function happensBefore(
  a: VectorClock,
  b: VectorClock
): boolean {
  let dominated = false;
  for (const key of unionKeys(a, b)) {
    const aVal = a[key] || 0;
    const bVal = b[key] || 0;
    if (aVal > bVal) return false;
    if (aVal < bVal) dominated = true;
  }
  return dominated;
}
```

### 7.2 Message Structure

```typescript
interface ChatMessage {
  messageId: string;            // Unique ID
  authorHash: string;           // SHA-256 of author's public key
  conversationId: string;       // Channel/conversation ID
  content: Uint8Array;          // Encrypted content
  timestamp: number;            // Lamport timestamp
  vectorClock: VectorClock;     // Causal ordering
  replyTo?: string;             // ID of message being replied to
  operations: Operation[];      // CRDT operations
}

interface Operation {
  opType: 'insert' | 'delete' | 'update';
  position: string;             // CRDT position identifier
  value?: Uint8Array;
  authorHash: string;
  clock: VectorClock;
}
```

### 7.3 Conflict Resolution

For concurrent operations (neither happens-before the other), we use
**LWW (Last-Writer-Wins)** with deterministic tie-breaking:

```typescript
function resolveConflict(
  a: ChatMessage,
  b: ChatMessage
): ChatMessage {
  // First: compare vector clocks
  if (happensBefore(a.vectorClock, b.vectorClock)) return b;
  if (happensBefore(b.vectorClock, a.vectorClock)) return a;

  // Concurrent: use LWW with deterministic tie-break
  if (a.timestamp !== b.timestamp) {
    return a.timestamp > b.timestamp ? a : b;
  }

  // Same timestamp: lexicographic comparison of message IDs
  return a.messageId < b.messageId ? a : b;
}
```

### 7.4 Message DAG

Messages form a **directed acyclic graph (DAG)** where each message
references its causal parents:

```
        ┌─────┐
        │ M1  │  (genesis for conversation)
        └──┬──┘
           │
      ┌────┴────┐
      ▼         ▼
   ┌─────┐  ┌─────┐
   │ M2a │  │ M2b │   (concurrent — both valid)
   └──┬──┘  └──┬──┘
      │         │
      └────┬────┘
           ▼
        ┌─────┐
        │ M3  │   (references both M2a and M2b)
        └─────┘
```

### 7.5 Offline Merge Procedure

```
OFFLINE RECONCILLIATION
=======================

When Peer A reconnects after offline period with Peer B:

1. Exchange vector clocks
   A→B: my_clock = {A: 5, C: 3}
   B→A: my_clock = {A: 3, B: 7, C: 3}

2. Compute delta
   A has: messages with clock[A] > 3 (M4, M5)
   B has: messages with clock[B] > 0 (M1-M7 of B's channel)

3. Exchange delta messages
   A→B: [M4, M5]
   B→A: [B's messages A hasn't seen]

4. Merge into local DAG
   For each received message:
     - Verify signature
     - Check if message already exists (dedup)
     - Insert into DAG at correct causal position
     - Resolve any conflicts using LWW

5. Update local filter
   Rebuild Bloom filter with merged message set
```

---

## 8. Multi-Hop Relay

### 8.1 Relay Eligibility

A peer is eligible to relay messages if:

1. Its `capabilities` flag has RELAY bit set
2. It is not battery-critical
3. It has capacity (bandwidth + storage)
4. It is not currently rate-limited

```typescript
interface RelayPolicy {
  maxConcurrentRelays: number;    // Default: 10
  maxRelayBandwidth: number;      // Bytes/sec (default: 100KB)
  batteryThreshold: number;       // Minimum battery % (default: 20)
  rateLimitWindow: number;        // Milliseconds (default: 60000)
  rateLimitMax: number;           // Max relay requests per window (default: 100)
}

function isRelayEligible(
  peer: PeerState,
  policy: RelayPolicy
): boolean {
  return (
    (peer.capabilities & Capability.RELAY) !== 0 &&
    peer.batteryPercent >= policy.batteryThreshold &&
    peer.activeRelays < policy.maxConcurrentRelays &&
    !isRateLimited(peer, policy)
  );
}
```

### 8.2 Relay Policies

```
RELAY FORWARDING RULES
======================

1. NEVER relay packets we originated
2. NEVER relay packets with TTL <= 0
3. NEVER relay packets at max hop count
4. NEVER relay packets we already forwarded (dedup cache)
5. ALWAYS decrement TTL before forwarding
6. ALWAYS increment hop_count before forwarding
7. RATE LIMIT: max N packets per time window
8. PRIORITY: courier envelopes > gossip > data > discovery
```

### 8.3 Flood Control

```typescript
interface FloodControl {
  rateLimiter: TokenBucket;
  priorityQueue: PriorityQueue<MeshPacket>;
}

class TokenBucket {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;  // tokens per second
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}
```

---

## 9. Mesh Security

### 9.1 Packet Authentication

Every packet carries an HMAC-SHA256 signature over its header fields
using a session-derived key.

```typescript
function signPacket(
  packet: MeshPacket,
  sessionKey: Uint8Array
): Uint8Array {
  const headerBytes = serializeHeader(packet.header);
  const hmac = createHmac('sha256', sessionKey);
  hmac.update(headerBytes);
  return new Uint8Array(hmac.digest());  // 32 bytes
}

function verifyPacket(
  packet: MeshPacket,
  sessionKey: Uint8Array
): boolean {
  const expected = signPacket(packet, sessionKey);
  return constantTimeEqual(packet.signature, expected);
}
```

### 9.2 Replay Protection

```
REPLAY PROTECTION MECHANISM
===========================

1. Each packet has a unique 32-byte packet_id
2. Maintained dedup cache tracks seen packet_ids
3. Packets are checked against cache before processing
4. Cache entries expire after 5 minutes
5. Signature verification provides secondary check
```

### 9.3 Flood Protection

```typescript
interface FloodProtection {
  perPeerRateLimit: TokenBucket;
  globalRateLimit: TokenBucket;
  banList: Map<string, BanEntry>;
  anomalyDetector: AnomalyDetector;
}

interface BanEntry {
  peerIdHash: string;
  reason: string;
  bannedAt: number;
  expiresAt: number;
}

class AnomalyDetector {
  private stats: Map<string, PeerStats>;

  recordPacket(peerId: string, packetType: PacketType): void {
    const stats = this.getOrCreate(peerId);
    stats.packetCount++;
    stats.typeCounts[packetType] =
      (stats.typeCounts[packetType] || 0) + 1;
    stats.lastPacketAt = Date.now();
  }

  isAnomalous(peerId: string): boolean {
    const stats = this.getOrCreate(peerId);

    // Check: too many packets in short window
    if (stats.packetCount > 1000) {
      return true;
    }

    // Check: disproportionate packet type distribution
    const discoveryRatio =
      (stats.typeCounts[PacketType.DISCOVERY] || 0) /
      stats.packetCount;
    if (discoveryRatio > 0.5 && stats.packetCount > 100) {
      return true;  // Likely flood attack
    }

    return false;
  }
}
```

### 9.4 Encryption Layers

```
┌─────────────────────────────────────────────────────────┐
│                 Encryption Layers                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Session Encryption (Live Connections)          │
│  ├─ Protocol: Noise XX                                  │
│  ├─ Cipher: ChaCha20-Poly1305                           │
│  ├─ Handshake: XX pattern (mutual authentication)       │
│  └─ Key Derivation: HKDF-SHA256                         │
│                                                          │
│  Layer 2: Courier Envelope Encryption (Store-and-Forward)│
│  ├─ Protocol: XChaCha20-Poly1305                        │
│  ├─ Key: Derived from sender + recipient shared secret   │
│  ├─ Nonce: Random 24 bytes (XChaCha20)                  │
│  └─ Recipient can decrypt; couriers cannot               │
│                                                          │
│  Layer 3: Gossip Payload Encryption                      │
│  ├─ Per-item encryption using session key                │
│  └─ Filter data is unencrypted (contains no content)    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 10. File Sharing Over Mesh

### 10.1 Chunking

Files are split into fixed-size chunks for mesh transfer.

```typescript
interface FileChunk {
  fileId: string;            // SHA-256 of full file
  chunkIndex: number;        // 0-based index
  totalChunks: number;
  chunkHash: string;         // SHA-256 of this chunk
  data: Uint8Array;          // Max 64KB per chunk
}

const CHUNK_SIZE = 64 * 1024;  // 64 KB

function chunkFile(file: Uint8Array): FileChunk[] {
  const fileId = sha256Hex(file);
  const totalChunks = Math.ceil(file.length / CHUNK_SIZE);
  const chunks: FileChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.length);
    const data = file.slice(start, end);
    chunks.push({
      fileId,
      chunkIndex: i,
      totalChunks,
      chunkHash: sha256Hex(data),
      data,
    });
  }

  return chunks;
}
```

### 10.2 Resume Support

```typescript
interface FileTransfer {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  receivedChunks: Set<number>;
  totalChunks: number;
  startedAt: number;
  lastChunkAt: number;
}

function getMissingChunks(transfer: FileTransfer): number[] {
  const missing: number[] = [];
  for (let i = 0; i < transfer.totalChunks; i++) {
    if (!transfer.receivedChunks.has(i)) {
      missing.push(i);
    }
  }
  return missing;
}
```

### 10.3 Hash Verification

```
FILE INTEGRITY VERIFICATION
============================

1. Sender computes SHA-256 of full file → fileHash
2. Sender computes SHA-256 of each chunk → chunkHashes[]
3. Receiver verifies each chunk against chunkHash
4. Receiver verifies assembled file against fileHash
5. Mismatch → request retransmission of bad chunk
6. All chunks valid → file is complete and verified
```

```
┌──────────┐     FILE_INIT     ┌──────────┐
│  Sender  │──────────────────▶│ Receiver │
│          │◀──────────────────│          │
│          │   (missing list)  │          │
│          │                    │          │
│          │──── FILE_CHUNK ───▶│          │
│          │◀───── FILE_ACK ────│          │
│          │                    │          │
│          │──── FILE_CHUNK ───▶│          │
│          │◀───── FILE_ACK ────│          │
│          │         ...        │          │
│          │                    │          │
│          │◀── FILE_COMPLETE ──│          │
└──────────┘                    └──────────┘
```

---

## 11. Battery Awareness

### 11.1 Power Modes

```typescript
enum PowerMode {
  FULL = 'full',           // No restrictions
  BALANCED = 'balanced',   // Moderate duty cycling
  LOW_POWER = 'low_power', // Aggressive duty cycling
  CRITICAL = 'critical',   // Minimal activity
}

interface PowerConfig {
  mode: PowerMode;
  advertiseIntervalMs: number;    // Discovery broadcast interval
  relayEnabled: boolean;
  courierEnabled: boolean;
  syncIntervalMs: number;         // Gossip sync interval
  maxConcurrentTransfers: number;
}
```

### 11.2 Duty Cycling

```
POWER MODE SETTINGS
====================

┌────────────┬──────────┬────────┬────────┬──────────┐
│ Mode       │ Advertise│ Relay  │ Courier│ Sync     │
│            │ Interval │        │        │ Interval │
├────────────┼──────────┼────────┼────────┼──────────┤
│ FULL       │ 60s      │ Yes    │ Yes    │ 30s      │
│ BALANCED   │ 120s     │ Yes    │ Yes    │ 60s      │
│ LOW_POWER  │ 300s     │ No     │ Yes    │ 120s     │
│ CRITICAL   │ 600s     │ No     │ No     │ 300s     │
└────────────┴──────────┴────────┴────────┴──────────┘
```

### 11.3 Battery Monitoring

```typescript
interface BatteryState {
  level: number;           // 0-100 percent
  charging: boolean;
  timeRemaining: number;   // Seconds, -1 if unknown
}

function recommendPowerMode(
  battery: BatteryState
): PowerMode {
  if (battery.level <= 10 && !battery.charging) {
    return PowerMode.CRITICAL;
  }
  if (battery.level <= 25 && !battery.charging) {
    return PowerMode.LOW_POWER;
  }
  if (battery.level <= 50) {
    return PowerMode.BALANCED;
  }
  return PowerMode.FULL;
}
```

---

## 12. Mesh Manager Module Structure

### 12.1 Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    MeshManager (Entry Point)                  │
│                          │                                   │
│          ┌───────────────┼───────────────┐                   │
│          ▼               ▼               ▼                   │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐          │
│  │  Transport   │ │  Routing   │ │  Discovery   │          │
│  │  Manager     │ │  Manager   │ │  Manager     │          │
│  └──────┬───────┘ └─────┬──────┘ └──────┬───────┘          │
│         │               │               │                    │
│    ┌────┴────┐    ┌─────┴─────┐   ┌────┴────┐              │
│    ▼         ▼    ▼           ▼   ▼         ▼              │
│ ┌──────┐ ┌─────┐┌──────┐ ┌──────┐┌─────┐ ┌──────┐        │
│ │ TCP  │ │ BLE ││ Flood│ │S&F   │ │mDNS │ │ LAN  │        │
│ │Transport│ │(v2)││Ctrl  │ │Queue │ │     │ │Bcast │        │
│ └──────┘ └─────┘└──────┘ └──────┘ └─────┘ └──────┘        │
│                                                              │
│          ┌───────────────┼───────────────┐                   │
│          ▼               ▼               ▼                   │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐          │
│  │  Security    │ │  Gossip    │ │  File        │          │
│  │  Manager     │ │  Manager   │ │  Transfer    │          │
│  └──────────────┘ └────────────┘ └──────────────┘          │
│                                                              │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐          │
│  │  Power       │ │  Courier   │ │  CRDT        │          │
│  │  Manager     │ │  Manager   │ │  Engine      │          │
│  └──────────────┘ └────────────┘ └──────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Core Interfaces

```typescript
interface MeshManagerConfig {
  transport: TransportConfig;
  routing: RoutingConfig;
  security: SecurityConfig;
  gossip: GossipConfig;
  courier: CourierConfig;
  power: PowerConfig;
}

interface MeshManager {
  // Lifecycle
  start(config: MeshManagerConfig): Promise<void>;
  stop(): Promise<void>;

  // Messaging
  sendMessage(
    recipientHash: string,
    content: Uint8Array,
    options?: MessageOptions
  ): Promise<MessageResult>;

  // File sharing
  shareFile(
    file: Uint8Array,
    metadata: FileMetadata,
    recipientHash: string
  ): Promise<FileTransferResult>;

  // State
  getPeers(): PeerEntry[];
  getCourierQueue(): CourierEntry[];
  getPowerMode(): PowerMode;
  getStats(): MeshStats;
}

interface MeshStats {
  peersDiscovered: number;
  activeConnections: number;
  messagesSent: number;
  messagesReceived: number;
  messagesRelayed: number;
  messagesDelivered: number;
  messagesDropped: number;
  courierQueueSize: number;
  storageUsedBytes: number;
  bandwidthUpBytes: number;
  bandwidthDownBytes: number;
  uptime: number;
}
```

### 12.3 Event System

```typescript
type MeshEvent =
  | { type: 'peer:discovered'; peer: PeerEntry }
  | { type: 'peer:lost'; peerIdHash: string }
  | { type: 'message:sent'; messageId: string }
  | { type: 'message:received'; message: ChatMessage }
  | { type: 'message:delivered'; messageId: string }
  | { type: 'message:delivery_failed'; messageId: string; reason: string }
  | { type: 'courier:enqueued'; envelopeId: string }
  | { type: 'courier:delivered'; envelopeId: string }
  | { type: 'courier:expired'; envelopeId: string }
  | { type: 'file:transfer_started'; fileId: string }
  | { type: 'file:transfer_progress'; fileId: string; progress: number }
  | { type: 'file:transfer_complete'; fileId: string }
  | { type: 'file:transfer_failed'; fileId: string; reason: string }
  | { type: 'power:mode_changed'; mode: PowerMode }
  | { type: 'security:peer_banned'; peerIdHash: string; reason: string }
  | { type: 'security:anomaly_detected'; peerIdHash: string; details: string };

type MeshEventHandler = (event: MeshEvent) => void;
```

---

## 13. Testing Strategy

### 13.1 Mesh Simulator

A local simulator creates virtual mesh topologies for testing.

```typescript
interface SimulatedMesh {
  nodes: SimulatedNode[];
  connections: SimulatedConnection[];
  clock: SimulatedClock;
}

interface SimulatedNode {
  id: string;
  position: { x: number; y: number };
  batteryLevel: number;
  isOnline: boolean;
  meshManager: MeshManager;
}

interface SimulatedConnection {
  from: string;
  to: string;
  latencyMs: number;
  packetLossRate: number;
  bandwidthBytesPerSec: number;
}

class MeshSimulator {
  private mesh: SimulatedMesh;

  constructor(topology: MeshTopology) {
    this.mesh = this.buildMesh(topology);
  }

  async runScenario(
    scenario: TestScenario
  ): Promise<SimulationResult> {
    const results: SimulationResult = {
      messagesDelivered: 0,
      messagesDropped: 0,
      averageLatencyMs: 0,
      maxHopsUsed: 0,
      courierUtilization: 0,
    };

    for (const step of scenario.steps) {
      switch (step.action) {
        case 'send':
          await this.simulateSend(step.from, step.to, step.payload);
          break;
        case 'disconnect':
          this.simulateDisconnect(step.nodeId);
          break;
        case 'reconnect':
          this.simulateReconnect(step.nodeId);
          break;
        case 'advance_time':
          this.mesh.clock.advance(step.durationMs);
          break;
      }
    }

    return results;
  }
}
```

### 13.2 Unit Test Coverage Targets

| Module | Target Coverage |
|--------|----------------|
| Spray-and-wait | 95% |
| Recipient tags | 100% (critical security) |
| Deduplication | 95% |
| Vector clocks | 100% |
| CRDT merge | 95% |
| Envelope encryption | 100% |
| Queue management | 90% |
| Rate limiting | 90% |
| File chunking | 90% |
| Battery mode switching | 85% |

### 13.3 Integration Test Scenarios

```
SCENARIO 1: Basic Direct Delivery
  - 2 peers on same LAN
  - Send message, verify receipt
  - Verify encryption (packet capture shows only ciphertext)

SCENARIO 2: Multi-Courier Spray
  - 1 sender, 3 couriers, 1 recipient
  - Recipient goes offline
  - Sender sprays to couriers
  - Recipient comes online
  - Verify delivery from any courier

SCENARIO 3: Offline Merge
  - 2 peers communicate, then go offline
  - Both make concurrent edits
  - Reconnect and verify deterministic merge

SCENARIO 4: Network Partition
  - Split network into 2 partitions
  - Messages queue in each partition
  - Rejoin and verify delivery

SCENARIO 5: Battery Drain
  - Peer battery drops below threshold
  - Verify mode transition
  - Verify courier queue persists across mode changes

SCENARIO 6: Malicious Peer
  - Inject malformed packets
  - Verify rejection and rate limiting
  - Verify ban list propagation

SCENARIO 7: Large File Transfer
  - 10MB file over 3-hop path
  - Verify chunk integrity
  - Simulate chunk loss and verify resume

SCENARIO 8: Sybil Resistance
  - 50 fake peers join
  - Verify legitimate peers unaffected
  - Verify resource limits not exceeded
```

### 13.4 Test File Organization

```
tests/
├── unit/
│   ├── spray-and-wait.test.ts
│   ├── recipient-tags.test.ts
│   ├── deduplication.test.ts
│   ├── vector-clocks.test.ts
│   ├── crdt-merge.test.ts
│   ├── envelope-encryption.test.ts
│   ├── queue-management.test.ts
│   ├── rate-limiting.test.ts
│   ├── file-chunking.test.ts
│   └── battery-mode.test.ts
├── integration/
│   ├── direct-delivery.test.ts
│   ├── multi-courier.test.ts
│   ├── offline-merge.test.ts
│   ├── network-partition.test.ts
│   ├── battery-drain.test.ts
│   ├── malicious-peer.test.ts
│   ├── large-file.test.ts
│   └── sybil-resistance.test.ts
└── simulator/
    ├── topology-builder.test.ts
    ├── scenario-runner.test.ts
    └── scenarios/
        ├── basic-spray.json
        ├── partition-rejoin.json
        ├── battery-transition.json
        └── sybil-flood.json
```

---

## 14. Non-Negotiable Rules

These rules are inviolable. Any code that violates them is rejected.

### NR-1: No Plaintext Routing Information

```
RULE: Relay nodes must NEVER see recipient identity, message content,
      or any routing metadata beyond the opaque envelope.

VIOLATION: Sending a packet with recipient public key in plaintext.
REJECTION: Packet must be encrypted; only HMAC tag is visible.
```

### NR-2: Constant-Time Comparisons

```
RULE: All cryptographic comparisons (HMAC verification, key matching,
      tag matching) MUST use constant-time comparison.

VIOLATION: Using === or Buffer.equals() for security-critical comparisons.
REJECTION: Must use crypto.timingSafeEqual() or equivalent.
```

### NR-3: No Hardcoded Secrets

```
RULE: No private keys, shared secrets, or encryption keys may appear
      in source code, tests, or documentation.

VIOLATION: const PRIVATE_KEY = "abc123..."
REJECTION: Use environment variables or test-generated keys only.
```

### NR-4: Queue Limits Are Hard Caps

```
RULE: Courier queues, outbox queues, and dedup caches MUST enforce
      their maximum sizes. No unbounded growth.

VIOLATION: Adding to a full queue without eviction.
REJECTION: Must trigger eviction or reject before adding.
```

### NR-5: TTL Is Decremented on Every Hop

```
RULE: TTL MUST be decremented by 1 second (or more) at every relay
      hop. A packet with TTL=0 MUST be dropped.

VIOLATION: Forwarding a packet without decrementing TTL.
REJECTION: Drop the packet immediately.
```

### NR-6: Dedup Before Forward

```
RULE: Every incoming packet MUST be checked against the dedup cache
      BEFORE any processing or forwarding.

VIOLATION: Forwarding a packet without dedup check.
REJECTION: Add dedup check before forward logic.
```

### NR-7: Battery Mode Transitions Are Conservative

```
RULE: Power mode can only transition to a MORE restrictive mode
      without user consent. Auto-recovery requires charging.

VIOLATION: Auto-upgrading from CRITICAL to FULL without charging.
REJECTION: Only allow transitions toward more restrictive modes
           until battery is explicitly charging.
```

### NR-8: All Messages Are Encrypted End-to-End

```
RULE: No message content may be stored or transmitted in plaintext.
      Even ephemeral relay data must be encrypted.

VIOLATION: Sending a message without encryption layer.
REJECTION: Envelope must be encrypted before leaving application layer.
```

### NR-9: Deterministic Conflict Resolution

```
RULE: CRDT merge must produce identical results regardless of merge
      order. LWW tie-breaking must use deterministic comparison.

VIOLATION: Using Math.random() or non-deterministic tie-breaking.
REJECTION: Must use lexicographic comparison of message IDs.
```

### NR-10: Graceful Degradation

```
RULE: The system MUST continue to function (at reduced capacity) when
      any single component fails. No single point of failure.

VIOLATION: System crashing when mDNS is unavailable.
REJECTION: All external dependencies must have fallback paths.
```

---

## 15. Repository Structure

```
dipchats/
├── src/
│   ├── mesh/
│   │   ├── index.ts                    # MeshManager entry point
│   │   ├── transport/
│   │   │   ├── index.ts                # TransportManager
│   │   │   ├── tcp-transport.ts        # TCP transport (MVP)
│   │   │   ├── websocket-transport.ts  # WebSocket transport (MVP)
│   │   │   └── ble-transport.ts        # BLE transport (v2)
│   │   ├── routing/
│   │   │   ├── index.ts                # RoutingManager
│   │   │   ├── flood.ts                # Flooding with dedup
│   │   │   ├── source-route.ts         # Source routing (v2)
│   │   │   ├── dedup-cache.ts          # Deduplication cache
│   │   │   └── loop-prevention.ts      # Loop detection
│   │   ├── discovery/
│   │   │   ├── index.ts                # DiscoveryManager
│   │   │   ├── lan-broadcast.ts        # LAN UDP broadcast
│   │   │   ├── mdns.ts                 # mDNS service
│   │   │   └── peer-table.ts           # Peer state table
│   │   ├── courier/
│   │   │   ├── index.ts                # CourierManager
│   │   │   ├── spray.ts                # Spray-and-wait algorithm
│   │   │   ├── recipient-tags.ts       # HMAC recipient tags
│   │   │   ├── envelope.ts             # Envelope format/encryption
│   │   │   ├── queue.ts                # Courier queue management
│   │   │   └── delivery.ts             # Delivery on encounter
│   │   ├── gossip/
│   │   │   ├── index.ts                # GossipManager
│   │   │   ├── bloom-filter.ts         # Bloom filter implementation
│   │   │   ├── inventory.ts            # Inventory exchange
│   │   │   └── reconciliation.ts       # Set reconciliation
│   │   ├── crdt/
│   │   │   ├── index.ts                # CRDT engine
│   │   │   ├── vector-clock.ts         # Vector clock operations
│   │   │   ├── message-dag.ts          # Message DAG
│   │   │   ├── lww-register.ts         # Last-Writer-Wins register
│   │   │   └── merge.ts               # Merge strategy
│   │   ├── security/
│   │   │   ├── index.ts                # SecurityManager
│   │   │   ├── noise.ts               # Noise XX handshake
│   │   │   ├── envelope-crypto.ts      # XChaCha20-Poly1305
│   │   │   ├── hmac.ts                # HMAC verification
│   │   │   ├── replay-protection.ts    # Replay detection
│   │   │   └── flood-protection.ts     # Rate limiting + bans
│   │   ├── file-transfer/
│   │   │   ├── index.ts                # FileTransferManager
│   │   │   ├── chunking.ts            # File chunking
│   │   │   ├── resume.ts              # Resume support
│   │   │   └── verification.ts        # Hash verification
│   │   ├── power/
│   │   │   ├── index.ts                # PowerManager
│   │   │   ├── battery-monitor.ts      # Battery state tracking
│   │   │   ├── duty-cycling.ts         # Duty cycling logic
│   │   │   └── mode-transitions.ts     # Power mode state machine
│   │   └── types.ts                    # Shared mesh types
│   ├── messaging/
│   │   ├── index.ts                    # Messaging layer
│   │   ├── message-store.ts           # Local message storage
│   │   └── conversation.ts            # Conversation management
│   ├── crypto/
│   │   ├── index.ts                    # Crypto utilities
│   │   ├── x25519.ts                  # X25519 key exchange
│   │   ├── ed25519.ts                 # Ed25519 signatures
│   │   ├── xchacha20.ts               # XChaCha20-Poly1305
│   │   └── hmac-sha256.ts             # HMAC-SHA256
│   ├── storage/
│   │   ├── index.ts                    # Storage abstraction
│   │   ├── indexeddb.ts               # Browser storage
│   │   └── filesystem.ts             # Node.js storage
│   └── utils/
│       ├── constants.ts               # Protocol constants
│       ├── encoding.ts                # Binary encoding helpers
│       └── time.ts                    # Time utilities
├── tests/
│   ├── unit/                          # Unit tests (see 13.4)
│   ├── integration/                   # Integration tests
│   └── simulator/                     # Mesh simulator
├── simulator/
│   ├── src/
│   │   ├── simulator.ts              # Core simulator
│   │   ├── topology.ts               # Topology builder
│   │   ├── node.ts                   # Simulated node
│   │   └── connection.ts             # Simulated connection
│   └── scenarios/                    # Test scenarios
├── docs/
│   ├── MESH_NETWORK.md               # This document
│   ├── PROTOCOL.md                   # Wire protocol details
│   └── SECURITY.md                   # Security considerations
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Appendix A: Protocol Constants

```typescript
const PROTOCOL_VERSION = 1;
const MAGIC_HEADER = 0x44495043;    // "DIPC"
const MAGIC_MESH = 0x444D5348;      // "DMSH"

const DEFAULT_SPRAY_FACTOR = 5;
const DEFAULT_REDUNDANCY = 3;
const DEFAULT_TTL_SECONDS = 3600;
const MAX_HOPS = 10;
const CHUNK_SIZE_BYTES = 64 * 1024;

const DEDUP_CACHE_MAX_SIZE = 10000;
const DEDUP_CACHE_TTL_MS = 300_000;

const COURIER_QUEUE_MAX_ENTRIES = 500;
const COURIER_QUEUE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const OUTBOX_MAX_ENTRIES = 1000;
const OUTBOX_MAX_AGE_MS = 86400000;

const DISCOVERY_BROADCAST_INTERVAL_MS = 60_000;
const DISCOVERY_EXPIRY_MS = 180_000;

const GOSSIP_SYNC_INTERVAL_MS = 30_000;
const GOSSIP_ANNOUNCE_INTERVAL_MS = 60_000;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_RELAY = 100;
const RATE_LIMIT_MAX_PACKETS = 1000;

const BATTERY_CRITICAL_THRESHOLD = 10;
const BATTERY_LOW_THRESHOLD = 25;
const BATTERY_BALANCED_THRESHOLD = 50;
```

## Appendix B: Wire Format Serialization

All multi-byte integers are encoded in **little-endian** byte order.
Variable-length fields are prefixed with a 2-byte (u16) length.

```typescript
function serializeU16(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  return buf;
}

function serializeU32(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

function serializeBytes(data: Uint8Array): Uint8Array {
  const lenBuf = serializeU16(data.length);
  const result = new Uint8Array(2 + data.length);
  result.set(lenBuf, 0);
  result.set(data, 2);
  return result;
}
```

## Appendix C: State Diagrams

### Courier Lifecycle

```
                    ┌──────────┐
                    │  IDLE    │
                    └────┬─────┘
                         │ receive envelope
                         ▼
                    ┌──────────┐
                    │ CARRYING │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │DELIVER │ │ EXPIRE │ │ EVICT  │
         └────────┘ └────────┘ └────────┘
              │          │          │
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │DONE    │ │ IDLE   │ │ IDLE   │
         └────────┘ └────────┘ └────────┘
```

### Power Mode State Machine

```
     ┌─────────────────────────────────────────┐
     │                                          │
     ▼              ▲              ▲            │
┌─────────┐   ┌─────────┐   ┌─────────┐       │
│  FULL   │──▶│BALANCED │──▶│LOW_POWER│───┐    │
└─────────┘   └─────────┘   └─────────┘   │   │
     │              ▲              ▲        │   │
     │              │              │        │   │
     │         ┌─────────┐        │        │   │
     │         │  CHARGING│        │        │   │
     │         └─────────┘        │        │   │
     │                            ▼        │   │
     │                       ┌─────────┐   │   │
     └──────────────────────▶│CRITICAL │◀──┘   │
                             └─────────┘       │
                                   │           │
                                   └───────────┘
                                   (only with charging)
```

---

**End of Specification**
