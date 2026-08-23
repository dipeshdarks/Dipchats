# DIPCHATS — RISK ASSESSMENT

## Comprehensive Risk Analysis & Mitigation Strategy

**Project:** DipChats
**Date:** 2026-08-23
**Classification:** Internal
**Review Cycle:** Quarterly

---

# Table of Contents

1. [Risk Matrix](#1-risk-matrix)
2. [Technical Risks](#2-technical-risks)
3. [Security Risks](#3-security-risks)
4. [Operational Risks](#4-operational-risks)
5. [Product Risks](#5-product-risks)
6. [Legal & Compliance Risks](#6-legal--compliance-risks)
7. [Prioritized Action Items](#7-prioritized-action-items)

---

# 1. Risk Matrix

## 1.1 Severity & Likelihood Definitions

```text
SEVERITY
─────────────────────────────────────────────────────
Critical    System unusable, data loss, or security breach
High        Major feature broken, significant user impact
Medium      Feature degraded, workaround available
Low         Minor issue, cosmetic, or edge case

LIKELIHOOD
─────────────────────────────────────────────────────
High        > 70% chance of occurring in next 12 months
Medium      30-70% chance
Low         < 30% chance
```

## 1.2 Risk Heat Map

```text
                    LIKELIHOOD
                Low     Medium    High
           ┌─────────┬─────────┬─────────┐
  Critical │  T4     │  S1     │  S7     │
           ├─────────┼─────────┼─────────┤
  High     │  T5,O4  │  S3,T1  │  O1,T2  │
           ├─────────┼─────────┼─────────┤
  Medium   │  P2,O5  │  T3,S5  │  P1,P3  │
           ├─────────┼─────────┼─────────┤
  Low      │  L1     │  P4     │  O6     │
           └─────────┴─────────┴─────────┘
```

## 1.3 Complete Risk Register

```text
ID    Category      Risk                          Severity   Likelihood  Score
─────────────────────────────────────────────────────────────────────────────────
T1    Technical     CRDT complexity                High       Medium      12
T2    Technical     Cross-platform BLE/WiFi compat High       High        16
T3    Technical     Mesh scalability               Medium     Medium       9
T4    Technical     WebSocket scale                Critical   Low          9
T5    Technical     Database migration safety      High       Low          6
T6    Technical     Message ordering guarantees    High       Medium      12
T7    Technical     File transfer reliability      Medium     Medium       9
─────────────────────────────────────────────────────────────────────────────────
S1    Security      Key management / loss          Critical   Medium      15
S2    Security      Forward secrecy gaps           High       Medium      12
S3    Security      Metadata leakage on mesh       High       Medium      12
S4    Security      Server compromise              High       Medium      12
S5    Security      Device theft                   Medium     Medium       9
S6    Security      Replay attacks                 Medium     Medium       9
S7    Security      Side-channel attacks           Critical   High        16
─────────────────────────────────────────────────────────────────────────────────
O1    Operational   Single points of failure       High       High        16
O2    Operational   Database corruption            High       Medium      12
O3    Operational   Redis data loss                Medium     Medium       9
O4    Operational   Object storage availability    High       Low          6
O5    Operational   Certificate expiry             Medium     Low          4
O6    Operational   Dependency vulnerabilities     Low        High         8
─────────────────────────────────────────────────────────────────────────────────
P1    Product       UX complexity                  Medium     High        12
P2    Product       Cross-platform consistency     Medium     Low          4
P3    Product       Low-end device performance     Medium     High        12
P4    Product       Battery consumption            Low        Medium       6
P5    Product       Storage requirements           Medium     Medium       9
P6    Product       Network bandwidth usage        Medium     Medium       9
─────────────────────────────────────────────────────────────────────────────────
L1    Legal         Encryption export controls     Low        Low          2
L2    Legal         GDPR implications              Medium     Medium       9
L3    Legal         Law enforcement requests       Medium     Medium       9
L4    Legal         Platform store policies        Medium     Medium       9
─────────────────────────────────────────────────────────────────────────────────
```

**Score = Severity (1-4) × Likelihood (1-4). Higher = more urgent.**

---

# 2. Technical Risks

## T1 — CRDT Complexity and Offline Conflict Resolution

**Severity:** High | **Likelihood:** Medium | **Score:** 12

### Description

DipChats uses CRDTs (Conflict-free Replicated Data Types) for offline reconciliation. The message DAG with vector clocks, LWW conflict resolution, and causal ordering introduces significant implementation complexity. Incorrect CRDT implementations can cause:
- Message loss during merge
- Duplicate messages appearing to users
- Ordering anomalies that confuse conversation flow
- Infinite loops in DAG traversal
- Memory exhaustion from unbounded vector clock growth

### Affected Components

- `packages/messaging/` — Message DAG, vector clock operations
- `packages/mesh/` — Offline merge procedure
- Client local database — DAG persistence and query

### Specific Risks

1. **Vector clock drift** — Clocks grow unboundedly as more peers participate. In large meshes with 50+ peers, vector clocks consume significant memory per message.
2. **Merge algorithm correctness** — LWW with deterministic tie-breaking is correct in theory but edge cases arise when peers have different views of "the same" timestamp.
3. **State explosion** — Each peer maintains its own DAG. After extended offline periods, merge operations can require transferring thousands of messages.
4. **Testing difficulty** — CRDT bugs are non-deterministic and depend on specific interleaving of concurrent operations.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Bounded vector clocks (cap at N peers, evict oldest) | Low | Medium |
| Fuzz testing with randomized message orderings | Medium | High |
| Formal verification of merge algorithm (TLA+) | High | High |
| Integration tests with simulated multi-peer offline scenarios | Medium | High |
| Cap courier queue at 20 envelopes, sender outbox at 1000 | Low | Medium |
| Periodic compaction of DAG (merge old epochs) | Medium | Medium |

### Residual Risk

Even with mitigation, CRDT edge cases may surface in production with unusual network topologies. A robust testing harness with property-based testing is essential.

---

## T2 — Cross-Platform BLE/Wi-Fi Direct Compatibility

**Severity:** High | **Likelihood:** High | **Score:** 16

### Description

DipChats targets Web, Desktop (Tauri), Android (React Native), and iOS (React Native). BLE and Wi-Fi Direct APIs differ drastically across platforms:

```text
Platform    BLE API                    Wi-Fi Direct API
──────────────────────────────────────────────────────────────
iOS         CoreBluetooth              Multipeer Connectivity
Android     Android BLE API            Wi-Fi Direct (API 29+)
macOS       CoreBluetooth              NWConnection
Windows     Windows BLE API            Wi-Fi Direct (limited)
Linux       BlueZ (varies)             Not standardized
Web         Web Bluetooth API          Not available
```

Key compatibility issues:
- MTU negotiation varies (iOS defaults 185 bytes, Android 23 bytes before negotiation)
- Background BLE scanning is restricted on iOS (limited to 10s intervals)
- Wi-Fi Direct Group Owner behavior differs across Android versions
- Web Bluetooth requires user gesture and HTTPS
- Linux BlueZ versions vary across distributions

### Affected Components

- `packages/mesh/transport/` — All platform-specific transport implementations
- `packages/transport/` — Transport abstraction layer

### Specific Risks

1. **iOS background limitations** — iOS restricts BLE scanning to ~10 seconds when backgrounded, then requires a 10-second pause. This breaks continuous peer discovery.
2. **Android BLE reliability** — Android BLE connections are notoriously unreliable across device manufacturers. Samsung, Xiaomi, and Huawei have known BLE stack issues.
3. **Wi-Fi Direct availability** — Wi-Fi Direct is not available on all devices. Some budget Android devices lack hardware support. No iOS support.
4. **Web Bluetooth restrictions** — Web Bluetooth only works in Chrome/Edge on HTTPS, requires user gesture per connection, and cannot run in background tabs.
5. **MTU mismatches** — Different devices negotiate different MTU sizes, requiring chunking logic that works across all ranges (23-512 bytes).

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Abstract transport interface with platform adapters | Medium | High |
| Comprehensive device testing matrix (20+ devices) | High | High |
| Graceful degradation when transport unavailable | Low | High |
| BLE connection retry with exponential backoff | Low | Medium |
| iOS-specific background task scheduling (BgTask) | Medium | High |
| Fallback to LAN transport when BLE unreliable | Low | Medium |
| Documented device compatibility list | Low | Medium |

### Residual Risk

Cross-platform BLE will always have device-specific quirks. A growing list of known issues and workarounds will be needed.

---

## T3 — Mesh Network Scalability Limitations

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

The mesh network uses controlled flooding with TTL-based hop limiting. As the network grows, several scalability concerns emerge:

- Flooding generates O(N) messages per broadcast in dense networks
- Deduplication cache grows with network size
- Relay bandwidth consumption increases non-linearly
- Courier queues fill up in large meshes

### Affected Components

- `packages/mesh/routing/` — Flooding, deduplication, relay logic
- `packages/mesh/courier/` — Store-and-forward queue management

### Specific Risks

1. **Broadcast storm** — In a dense mesh (e.g., conference hall with 200+ devices), uncontrolled flooding causes packet collisions and bandwidth exhaustion.
2. **Deduplication memory** — The LRU seen-set with 10,000 entries at 32 bytes per packet ID consumes ~320KB. In very dense meshes, this may be insufficient.
3. **Relay battery drain** — Devices acting as relays consume additional battery. In meshes with many relay-dependent peers, a few devices may bear disproportionate cost.
4. **Courier queue overflow** — With 500 envelopes at up to 16KB each, a courier needs up to 8MB of storage. Budget devices may not have this available.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| TTL clamping (dense graphs cap at TTL 5) | Low | High |
| Fanout subsetting — relay to log2(degree) peers | Medium | High |
| Gossip-based sync instead of flooding for large meshes | High | High |
| Per-peer relay quotas (max 30 packets/sec) | Low | High |
| Adaptive dedup cache sizing based on peer count | Low | Medium |
| Battery-aware relay participation | Low | Medium |

### Residual Risk

Scalability beyond ~100 peers in a single mesh will require gossip-based protocols rather than flooding. This is a known architectural evolution point.

---

## T4 — WebSocket Connection Management at Scale

**Severity:** Critical | **Likelihood:** Low | **Score:** 9

### Description

The modular monolith handles WebSocket connections in a single Node.js process. Node.js has practical limits on concurrent WebSocket connections:

- Each WebSocket consumes ~2-4KB of memory
- Event loop saturation at ~10,000 concurrent connections per process
- Redis Pub/Sub fan-out becomes a bottleneck at scale

### Affected Components

- `apps/server/src/websocket/` — WebSocket gateway
- `apps/server/src/presence/` — Redis-backed presence

### Specific Risks

1. **Event loop blocking** — High message throughput can block the Node.js event loop, causing heartbeat timeouts and disconnections.
2. **Memory pressure** — 10,000 connections × 4KB = 40MB just for WebSocket state. With message buffers, this grows quickly.
3. **Redis Pub/Sub fan-out** — Each message published to a channel triggers delivery to all subscribers. With 10,000 subscribers on one channel, this saturates Redis.
4. **Reconnection storms** — After a server restart, all clients attempt to reconnect simultaneously, overwhelming the server.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Horizontal scaling with sticky sessions | High | High |
| Redis Cluster for Pub/Sub distribution | High | High |
| Connection limiting per server node | Low | High |
| Graceful shutdown with client-directed reconnect | Medium | High |
| Message batching for high-throughput channels | Medium | Medium |
| Load testing before production deployment | Medium | High |
| Implement connection backpressure | Medium | Medium |

### Residual Risk

At 10,000+ concurrent users, horizontal scaling is required. The modular monolith must be designed for easy decomposition.

---

## T5 — Database Migration Safety

**Severity:** High | **Likelihood:** Low | **Score:** 6

### Description

Drizzle ORM manages PostgreSQL migrations. Schema changes on a running production database carrying encrypted message data can cause:
- Data loss from destructive column drops
- Downtime from long-running migrations on large tables
- Incompatibility between client versions during rolling deploys

### Affected Components

- `apps/server/drizzle/` — Migration files
- Database schema definitions

### Specific Risks

1. **Large table migrations** — The `messages` table will grow unbounded. Adding an index to millions of rows causes table locks.
2. **Backward compatibility** — During rolling deploys, old and new server versions may run simultaneously. Schema must be compatible with both.
3. **Failed migration rollback** — If a migration fails midway, partial state may be difficult to reverse.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Only additive migrations (no column drops in single step) | Low | High |
| Online index creation (CREATE INDEX CONCURRENTLY) | Low | High |
| Test migrations against production data snapshot | Medium | High |
| Maintain 2-version backward compatibility | Medium | High |
| Transactional DDL for atomic migrations | Low | High |
| Automated backup before each migration | Low | Medium |

### Residual Risk

Migration errors on large tables can cause extended downtime. Careful testing and rollback plans are essential.

---

## T6 — Message Ordering Guarantees

**Severity:** High | **Likelihood:** Medium | **Score:** 12

### Description

DipChats uses different ordering mechanisms across transports:
- Server: PostgreSQL sequence numbers
- Mesh: Vector clocks + ULID
- Hybrid: Both systems must agree on ordering

Messages arriving out of order, or via different transports, may display in incorrect order to users.

### Affected Components

- Message engine — Ordering logic
- Sync engine — Cursor management
- Client UI — Message display ordering

### Specific Risks

1. **Clock skew** — Devices with different system clocks produce inconsistent timestamps, causing LWW to favor the wrong message.
2. **Transport-dependent ordering** — A message sent via WebSocket may arrive before a mesh message sent earlier, but with a later sequence number.
3. **Edit ordering** — Two concurrent edits to the same message must resolve deterministically, but users may see a flash of one edit before the other.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Use ULID (time + random) for client-side ordering | Low | High |
| NTP synchronization requirement for mesh peers | Low | Medium |
| Server-side sequence numbers as authoritative order | Low | High |
| Client-side display ordering by server sequence when available | Low | High |
| Optimistic UI with reconciliation on sync | Medium | Medium |

### Residual Risk

Perfect ordering across heterogeneous transports is fundamentally difficult. Users may occasionally see minor ordering glitches during transport switching.

---

## T7 — File Transfer Reliability

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

Files are chunked (64KB for mesh, variable for online) and transferred across unreliable transports. Chunk loss, connection drops, and hash mismatches can cause incomplete transfers.

### Affected Components

- `packages/messaging/file-manager/` — Chunking, upload, download
- Mesh file transfer protocol

### Specific Risks

1. **Chunk loss on BLE** — BLE's low bandwidth (1Mbps theoretical, ~100KB/s practical) and packet loss rate (5-10%) make large file transfers slow and error-prone.
2. **Resume failure** — Transfer resume requires tracking received chunks. If the peer forgets the transfer state (app restart, memory pressure), resume fails.
3. **Storage exhaustion** — Incoming file chunks consume local storage before reassembly. A malicious peer could send many incomplete large files.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| SHA-256 verification per chunk and full file | Low | High |
| Transfer resume with persistent chunk tracking | Medium | High |
| Storage budget for incoming transfers (max 100MB) | Low | High |
| Timeout incomplete transfers after 24 hours | Low | Medium |
| Progress reporting for user feedback | Low | Medium |
| Retry failed chunks with backoff | Low | Medium |

### Residual Risk

Large file transfers over BLE will always be slow. Users must be informed of expected transfer times.

---

# 3. Security Risks

## S1 — Key Management and Loss

**Severity:** Critical | **Likelihood:** Medium | **Score:** 15

### Description

DipChats has **no account recovery mechanism by design**. If a device's identity keys are lost or destroyed:
- All encrypted messages on that device become permanently unreadable
- The device's identity is gone — contacts must re-verify
- Server-stored ciphertext cannot be decrypted
- No "forgot password" flow exists

This is a fundamental design choice, but it creates significant user risk.

### Affected Components

- Identity Manager — Key generation, storage
- Secure enclave / OS keychain integration
- Panic wipe functionality

### Specific Risks

1. **Accidental wipe** — User accidentally triggers panic wipe or factory resets device
2. **Keychain corruption** — OS keychain corruption (rare but documented on Android)
3. **Backup failure** — User does not back up keys; loses device
4. **Multi-device key sync** — Keys must be exchanged in-person via QR; no remote backup
5. **Firmware update failure** — OS update corrupts secure storage

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Multi-device setup (at least 2 devices with keys) | Low | High |
| In-app warnings about key backup importance | Low | Medium |
| Optional encrypted key backup to user's own cloud | High | High |
| Emergency contact key recovery (social recovery) | High | Medium |
| Clear onboarding about irreversibility | Low | Medium |
| Key export for advanced users (encrypted QR) | Medium | High |

### Residual Risk

Key loss is permanent by design. This is a deliberate trade-off for zero-knowledge architecture. User education is the primary mitigation.

---

## S2 — Forward Secrecy Gaps in Courier System

**Severity:** High | **Likelihood:** Medium | **Score:** 12

### Description

Courier envelopes use the recipient's static X25519 public key for encryption. This means:
- No forward secrecy for store-and-forward messages
- Compromise of the recipient's static key exposes all sealed-but-undelivered mail
- Couriers carry envelopes that, if the key is compromised, become decryptable

The security documentation explicitly acknowledges this: "Offline seals use the recipient's static key and therefore do NOT provide forward secrecy."

### Affected Components

- Courier envelope encryption/decryption
- Key hierarchy — Static key usage

### Specific Risks

1. **Key compromise cascade** — If a device's static key is compromised (e.g., through device theft), all pending courier envelopes for that user become readable.
2. **Delayed delivery window** — Messages sitting in courier queues for hours are vulnerable during the entire carry period.
3. **No prekey system** — Unlike Signal's X3DH, DipChats does not use one-time prekeys for asynchronous encryption.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Implement X3DH with one-time prekeys (planned) | High | High |
| Minimize courier TTL (default 1 hour) | Low | Medium |
| Encrypt courier payloads with ephemeral keys when possible | Medium | Medium |
| Warn users that store-and-forward lacks forward secrecy | Low | Low |
| Rotate static keys periodically | Medium | Medium |

### Residual Risk

Until X3DH prekeys are implemented, courier envelopes remain the weakest point in the forward secrecy model.

---

## S3 — Metadata Leakage on Mesh

**Severity:** High | **Likelihood:** Medium | **Score:** 12

### Description

Even with end-to-end encryption, mesh networking leaks metadata:
- Peer IDs (8-byte fingerprints) are stable per session
- Packet sizes reveal message types (text vs. file)
- Timing patterns reveal who is communicating with whom
- Relay paths reveal social connections
- Recipient tags (HMAC) can be correlated across couriers

### Affected Components

- Mesh packet headers
- Courier envelope format
- Peer discovery broadcasts

### Specific Risks

1. **Traffic analysis** — A passive observer can map the social graph by observing who communicates with whom, even without reading content.
2. **Peer ID tracking** — Stable peer IDs allow long-term tracking of device movement.
3. **Courier correlation** — Multiple couriers carrying envelopes for the same recipient can be correlated by recipient tag.
4. **Timing correlation** — Messages sent immediately before/after an event (e.g., a protest) can be correlated with participants.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Rotate peer IDs per session (planned for v2) | Medium | High |
| Pad non-encrypted packet types to uniform size | Low | Medium |
| Randomize relay timing with jitter (10-220ms) | Low | Medium |
| Limit recipient tag lifetime (daily rotation) | Low | Medium |
| Mix packets from multiple senders in transit | High | Medium |
| Document metadata limitations for users | Low | Low |

### Residual Risk

Some metadata leakage is inherent to mesh networking. The goal is to minimize what can be inferred, not eliminate it entirely.

---

## S4 — Server Compromise (Ciphertext Exposure)

**Severity:** High | **Likelihood:** Medium | **Score:** 12

### Description

If an attacker gains access to the PostgreSQL database, they obtain:
- Encrypted message ciphertext
- Device public keys
- Channel membership metadata
- File attachment ciphertext
- Connection timestamps

The server cannot decrypt messages (zero-knowledge), but ciphertext and metadata are exposed.

### Affected Components

- PostgreSQL database
- MinIO object storage
- Server infrastructure

### Specific Risks

1. **Ciphertext persistence** — Even if the server is compromised briefly, the attacker can copy the entire database. Future cryptanalytic advances may eventually break the encryption.
2. **Metadata analysis** — Public keys, channel membership, and timing data reveal social connections without needing to decrypt content.
3. **File attachment metadata** — Filenames, MIME types, and sizes are stored unencrypted in the attachments table.
4. **Server-side encryption bypass** — If TLS termination is misconfigured, internal traffic may be unencrypted.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Encrypt file metadata (filenames, MIME types) client-side | Medium | High |
| Rotate server encryption keys regularly | Medium | Medium |
| Database encryption at rest (AES-256) | Low | High |
| Minimize metadata retention (auto-purge old data) | Low | Medium |
| Network segmentation between services | Medium | High |
| Intrusion detection system | High | Medium |
| Regular security audits | High | High |

### Residual Risk

Server compromise is a realistic threat. The zero-knowledge architecture ensures message content remains protected, but metadata exposure is significant.

---

## S5 — Physical Device Theft

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

An attacker with physical access to an unlocked or recently locked device can potentially:
- Extract keys from secure storage (with varying difficulty per OS)
- Read cached messages from local database
- Impersonate the device to the server
- Read carried courier envelopes

### Affected Components

- Identity Manager — Key storage
- Local database — Message storage
- Panic wipe — Emergency destruction

### Specific Risks

1. **Secure enclave bypass** — Physical access to a powered-on device with biometric unlock may allow key extraction through cold boot attacks or debug interfaces.
2. **Local database access** — SQLite/IndexedDB files may be readable if device encryption is bypassed.
3. **Panic wipe delay** — The time between theft and triggering panic wipe allows data extraction.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Auto-lock with aggressive timeout (30 seconds) | Low | High |
| Require biometric for app access | Low | High |
| Encrypt local database with device-derived key | Medium | High |
| Implement remote wipe via second device | High | Medium |
| Secure enclave key non-exportable flag | Low | High |
| User education on device lock settings | Low | Medium |

### Residual Risk

Physical device theft is a persistent threat. Hardware security features vary across devices.

---

## S6 — Replay Attacks

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

An attacker captures and retransmits valid mesh packets or API requests. Replay protection mechanisms exist but have limitations:

- Live Double Ratchet sessions prevent replay via sequence numbers
- Mesh broadcast packets have 6-hour acceptance windows
- Server API has 5-minute nonce cache

### Affected Components

- Mesh packet processing
- Server API authentication
- Double Ratchet session state

### Specific Risks

1. **Mesh broadcast replay** — Captured broadcast packets can be replayed within the 6-hour window, causing duplicate message display.
2. **Session state desync** — Replay of old ratchet messages can cause receiving chain desynchronization, requiring session re-establishment.
3. **API nonce expiry** — If the nonce cache is cleared (e.g., Redis restart), old authentication requests become valid again.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Double Ratchet sequence numbers (inherent) | N/A | High |
| Persistent nonce cache in PostgreSQL (not just Redis) | Low | High |
| Shorten mesh broadcast acceptance window | Low | Medium |
| Per-message nonces in addition to ratchet | Medium | Medium |
| Signed timestamps with server time validation | Low | Medium |

### Residual Risk

Replay attacks are well-understood and mitigable. The main risk is implementation errors in deduplication logic.

---

## S7 — Side-Channel Attacks

**Severity:** Critical | **Likelihood:** High | **Score:** 16

### Description

Side-channel attacks extract information from implementation artifacts rather than cryptographic weaknesses:

- **Timing attacks** — Variable-time comparison of signatures or keys leaks information
- **Power analysis** — On mobile devices, power consumption patterns during encryption can reveal keys
- **Memory access patterns** — Branch prediction and cache behavior during crypto operations
- **Electromagnetic emanation** — Radio emissions during processing

### Affected Components

- Crypto Engine — All cryptographic operations
- Key comparison functions
- Signature verification

### Specific Risks

1. **Non-constant-time comparisons** — Using JavaScript's `===` for byte array comparison is not constant-time.
2. **Libsodium JS wrapper overhead** — The WASM/JS wrapper may not provide constant-time guarantees.
3. **React Native crypto bridge** — The JS-to-native bridge for crypto operations may leak timing information.
4. **Server-side HMAC verification** — If the server uses non-constant-time HMAC comparison, timing attacks are possible.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Use Libsodium's `sodium_memcmp` for all comparisons | Low | High |
| Audit all comparison functions for constant-time behavior | Medium | High |
| Use Libsodium's `crypto_auth_verify` for HMAC | Low | High |
| Apply blinding techniques for key operations | High | Medium |
| Side-channel awareness in code review guidelines | Low | Medium |

### Residual Risk

Side-channel resistance in JavaScript/WASM is inherently weaker than native code. Libsodium's WASM implementation provides some protection but not complete.

---

# 4. Operational Risks

## O1 — Single Points of Failure

**Severity:** High | **Likelihood:** High | **Score:** 16

### Description

The modular monolith architecture concentrates all services in a single process. A single crash affects:
- All API endpoints
- All WebSocket connections
- All message routing
- Presence tracking
- File uploads

PostgreSQL and Redis are also single points of failure in the current architecture.

### Affected Components

- Server process (all services)
- PostgreSQL database
- Redis instance
- MinIO object storage

### Specific Risks

1. **Server crash** — A bug in any service crashes the entire server, disconnecting all WebSocket clients.
2. **Database failure** — PostgreSQL crash or corruption stops all message persistence.
3. **Redis failure** — Loss of presence data, typing indicators, rate limit state, and session tokens.
4. **MinIO failure** — File uploads and downloads fail.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| Process isolation (separate services) | High | High |
| PostgreSQL with streaming replication | High | High |
| Redis Sentinel for automatic failover | Medium | High |
| MinIO with erasure coding | Medium | High |
| Health checks and auto-restart (systemd, Docker) | Low | High |
| Circuit breakers between services | Medium | Medium |
| Client-side graceful degradation | Medium | Medium |

### Residual Risk

The modular monolith is an intentional Phase 1 choice. Migration to microservices is planned for Phase 3.

---

## O2 — Database Corruption

**Severity:** High | **Likelihood:** Medium | **Score:** 12

### Description

PostgreSQL corruption can occur from:
- Hardware failure (disk, memory)
- Unexpected power loss during write
- Software bugs in migration scripts
- Concurrent schema changes

### Affected Components

- PostgreSQL database
- Drizzle ORM migrations
- Backup systems

### Specific Risks

1. **WAL corruption** — Write-ahead log corruption can prevent recovery to a consistent state.
2. **Index corruption** — Corrupted indexes cause query failures and slow performance.
3. **Data page corruption** — Silent corruption may go undetected until data is read.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| WAL archiving with continuous backup | Medium | High |
| Daily base backups with 30-day retention | Low | High |
| `pg_verifyheap` and `amcheck` for integrity checks | Low | Medium |
| UPS for database servers | Medium | High |
| PostgreSQL checksums enabled | Low | High |
| Point-in-time recovery capability | Medium | High |

### Residual Risk

Database corruption is rare but catastrophic. Automated backups and integrity checks are essential.

---

## O3 — Redis Data Loss

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

Redis stores ephemeral but important data: presence, typing indicators, session tokens, rate limits, WebSocket connections. Data loss causes:
- All users appearing offline
- Loss of rate limiting (vulnerability to abuse)
- Session token validation failure
- WebSocket connection state loss

### Affected Components

- Redis instance
- All services depending on Redis state

### Specific Risks

1. **RDB snapshot gap** — With RDB snapshots every 5 minutes, up to 5 minutes of presence/session data is lost on crash.
2. **AOF fsync delay** — If `appendfsync` is set to `everysec`, up to 1 second of data is lost.
3. **Memory pressure** — Redis evicts keys when memory is full, potentially removing active sessions.

### Mitigation

| Strategy | Cost | Effectiveness |
|----------|------|---------------|
| AOF with `appendfsync everysec` | Low | High |
| Redis Sentinel for failover | Medium | High |
| In-memory state regeneration on reconnect | Low | High |
| Re-authenticate all clients after Redis restart | Low | High |
| Monitor Redis memory usage | Low | Medium |

### Residual Risk

Redis data loss is recoverable since all critical data is stored in PostgreSQL. Ephemeral data (presence, typing) is regenerated naturally.

---

## O4 — Object Storage Availability

**Severity:** High | **Likelihood:** Low | **Score:** 6

### Description

MinIO stores file attachments. Unavailability means:
- File uploads fail
- File downloads fail
- Previously uploaded files are inaccessible

### Affected Components

- MinIO object storage
- File upload/download API

### Mitigations

- MinIO with erasure coding for durability
- Versioning enabled for accidental overwrite protection
- Lifecycle policies for old objects
- Client-side retry for transient failures

---

## O5 — Certificate Expiry

**Severity:** Medium | **Likelihood:** Low | **Score:** 4

### Description

TLS certificates for the WebSocket endpoint and API, if expired, cause:
- WebSocket connections fail
- API requests fail
- All online communication stops

### Mitigations

- Automated certificate renewal (Let's Encrypt + certbot)
- Certificate expiry monitoring with alerts
- 30-day renewal window
- Fallback to backup certificates

---

## O6 — Dependency Vulnerabilities

**Severity:** Low | **Likelihood:** High | **Score:** 8

### Description

DipChats depends on numerous npm packages, Libsodium, PostgreSQL, Redis, and MinIO. New CVEs are published regularly.

### Affected Components

- `package.json` dependencies
- Docker base images
- System libraries

### Mitigations

- `npm audit` in CI pipeline
- Dependabot or Renovate for automated updates
- Docker image scanning (Trivy, Snyk)
- Pin dependency versions
- Regular dependency updates (monthly)

---

# 5. Product Risks

## P1 — User Experience Complexity

**Severity:** Medium | **Likelihood:** High | **Score:** 12

### Description

DipChats has inherent UX complexity:
- No accounts means no "forgot password" flow
- Key management is opaque to most users
- Mesh networking concepts (couriers, relays) are unfamiliar
- Transport switching may confuse users
- Verification requires in-person QR scanning

### Mitigations

- Simple onboarding (3 seconds to first message)
- Visual indicators for mesh vs. online mode
- Progressive disclosure of advanced features
- Clear error messages explaining what went wrong
- In-app tutorials for key backup and device verification

---

## P2 — Cross-Platform Consistency

**Severity:** Medium | **Likelihood:** Low | **Score:** 4

### Description

Web (React), Desktop (Tauri), and Mobile (React Native) have different capabilities:
- Web cannot use BLE or Wi-Fi Direct
- Desktop has different notification APIs
- Mobile has background limitations

### Mitigations

- Feature detection, not platform detection
- Graceful degradation with clear messaging
- Shared component library where possible
- Platform-specific testing matrices

---

## P3 — Performance on Low-End Devices

**Severity:** Medium | **Likelihood:** High | **Score:** 12

### Description

DipChats runs on:
- Budget Android devices (2GB RAM, slow CPU)
- Older iOS devices
- Low-end desktops

Cryptographic operations (Double Ratchet, X25519) are CPU-intensive.

### Mitigations

- Profile crypto operations on target devices
- Use WASM-compiled Libsodium (faster than pure JS)
- Lazy-load non-essential features
- Limit concurrent connections and transfers
- Test on lowest-spec target devices

---

## P4 — Battery Consumption

**Severity:** Low | **Likelihood:** Medium | **Score:** 6

### Description

Mesh networking (BLE scanning, Wi-Fi Direct, relaying) consumes battery. Users may drain battery quickly if:
- BLE scanning is always active
- Device acts as relay for many peers
- Courier carries many envelopes

### Mitigations

- Battery-aware power modes (FULL, BALANCED, LOW_POWER, CRITICAL)
- Duty cycling for BLE advertising (60-600s intervals based on power mode)
- Disable relay at critical battery (<10%)
- User-configurable power settings

---

## P5 — Storage Requirements

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

Local message storage grows unbounded. Users with many conversations and file attachments may exhaust device storage.

### Mitigations

- Configurable message retention per channel
- Auto-delete messages older than configurable threshold
- Compress old messages
- Move old attachments to server-only storage
- Storage usage dashboard in settings

---

## P6 — Network Bandwidth Usage

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

Mesh networking generates background traffic:
- Discovery broadcasts every 60 seconds
- Gossip sync every 30 seconds
- Courier envelope forwarding
- Relay of other peers' messages

On metered connections (cellular), this can be expensive.

### Mitigations

- Wi-Fi-only mode for mesh operations
- User-configurable bandwidth limits
- Adaptive sync intervals based on network type
- Compress discovery packets
- Disable relay on metered connections

---

# 6. Legal & Compliance Risks

## L1 — Encryption Export Controls

**Severity:** Low | **Likelihood:** Low | **Score:** 2

### Description

End-to-end encryption may be subject to export controls in some jurisdictions. As open-source software, DipChats is publicly available, which provides some exemption.

### Mitigations

- Use publicly available cryptographic libraries (Libsodium)
- Consult legal counsel for deployment in restricted regions
- Document compliance with Wassenaar Arrangement
- Maintain open-source license for public availability exemption

---

## L2 — GDPR Implications

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

DipChats collects minimal personal data, but:
- Display names are stored on the server
- Device public keys are stored
- Connection timestamps are logged
- Channel membership is recorded

### Mitigations

- Minimize data collection (already a core principle)
- Implement data deletion on device wipe
- Privacy policy explaining data handling
- No email, phone, or real-name requirement
- Server data deletion API for right-to-erasure
- Data processing records

---

## L3 — Law Enforcement Requests

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

Law enforcement may request user data. DipChats can provide:
- Encrypted ciphertext (unreadable)
- Device public keys (public by design)
- Channel membership metadata
- Connection timestamps

Cannot provide:
- Plaintext messages
- Private keys
- Decryption capability

### Mitigations

- Clear law enforcement response policy
- Transparent reporting of requests (if legally permitted)
- Zero-knowledge architecture limits what can be disclosed
- Legal counsel on retainer for LE requests

---

## L4 — Platform Store Policies

**Severity:** Medium | **Likelihood:** Medium | **Score:** 9

### Description

App Store and Play Store policies may conflict with DipChats features:
- Apple requires explanations for BLE background usage
- Google Play restricts certain P2P functionality
- Content moderation requirements
- Encryption disclosure requirements

### Mitigations

- Document BLE usage justification for Apple review
- Follow platform guidelines for P2P features
- Content moderation for public channels
- Encryption disclosure in store listings
- Regular policy review

---

# 7. Prioritized Action Items

## Priority 1 — Immediate (Next 30 Days)

```text
Action                                          Risk   Owner       Status
──────────────────────────────────────────────────────────────────────────
Audit all comparison functions for              S7     Security    TODO
  constant-time behavior
Implement device testing matrix for             T2     Mobile      TODO
  BLE/Wi-Fi Direct (20+ devices)
Set up automated dependency scanning            O6     DevOps      TODO
Enable PostgreSQL checksums                     O2     DevOps      TODO
Create key backup education materials           S1     Product     TODO
Load test WebSocket gateway at 10K connections  T4     Backend     TODO
```

## Priority 2 — Short-Term (30-90 Days)

```text
Action                                          Risk   Owner       Status
──────────────────────────────────────────────────────────────────────────
Implement X3DH with one-time prekeys            S2     Crypto      TODO
Add persistent nonce cache in PostgreSQL        S6     Backend     TODO
Set up Redis Sentinel for failover              O1     DevOps      TODO
Build mesh simulator for CRDT testing           T1     Mesh        TODO
Implement battery-aware power modes             P4     Mobile      TODO
Create device compatibility documentation       T2     Mobile      TODO
Implement file metadata encryption              S4     Backend     TODO
```

## Priority 3 — Medium-Term (90-180 Days)

```text
Action                                          Risk   Owner       Status
──────────────────────────────────────────────────────────────────────────
Implement horizontal WebSocket scaling          T4     Backend     TODO
Add gossip-based sync for large meshes          T3     Mesh        TODO
Formal verification of merge algorithm          T1     Crypto      TODO
Implement remote wipe via second device         S5     Mobile      TODO
Implement Wi-Fi-only mode for mesh              P6     Mobile      TODO
Set up intrusion detection system               S4     DevOps      TODO
Implement message retention policies            P5     Backend     TODO
```

## Priority 4 — Long-Term (180+ Days)

```text
Action                                          Risk   Owner       Status
──────────────────────────────────────────────────────────────────────────
Migrate from modular monolith to microservices  O1     Architecture TODO
Implement rotating peer IDs for privacy         S3     Mesh        TODO
Third-party security audit                      S*     Security    TODO
Implement social key recovery                   S1     Crypto      TODO
Implement encrypted key backup to user cloud    S1     Crypto      TODO
Full side-channel audit of crypto operations    S7     Security    TODO
```

---

# 8. Risk Review Schedule

```text
Review Type             Frequency       Participants
────────────────────────────────────────────────────────
Security Risk Review    Monthly         Security lead, Tech lead
Technical Risk Review   Bi-weekly       Engineering team
Operational Risk Review Weekly          DevOps, SRE
Legal/Compliance Review Quarterly       Legal, Product
Full Risk Assessment    Annually        All stakeholders
```

---

# 9. Risk Escalation Criteria

```text
Trigger                                     Action
────────────────────────────────────────────────────────
Severity increases to Critical              Immediate team alert
New CVE in critical dependency              Within 24 hours
Security breach detected                    War room within 1 hour
Data loss event                             Immediate escalation
Service outage > 5 minutes                 Post-incident review
```

---

# 10. Assumptions and Constraints

```text
1. This risk assessment is based on architecture documents, not production data.
2. Risk scores are estimates based on technical analysis.
3. Actual risk materialization will differ from estimates.
4. Mitigation costs are relative (Low/Medium/High), not absolute.
5. Some risks are accepted by design (e.g., no account recovery).
6. This document should be updated as implementation progresses.
```

---

# 11. Risk Acceptance Log

```text
Risk    Decision    Rationale                                   Date
──────────────────────────────────────────────────────────────────────
S1      Accepted    Zero-knowledge architecture requires no     2026-08-23
                    recovery mechanism. User education is the
                    primary mitigation.
T4      Accepted    Modular monolith is Phase 1 architecture.  2026-08-23
                    Horizontal scaling planned for Phase 2.
L1      Accepted    Open-source software is publicly available  2026-08-23
                    under Wassenaar Arrangement exemption.
```

---

*This document is a living artifact. Update it as new risks are identified, mitigations are implemented, or the threat landscape changes.*

*Last updated: 2026-08-23*
