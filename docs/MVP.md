# DipChats -- MVP (v1.0) Scope Definition

**Version:** 1.0.0
**Status:** APPROVED
**Date:** 2026-08-23
**Target:** Internal alpha / LAN testing

---

## Table of Contents

1. [MVP Vision Statement](#1-mvp-vision-statement)
2. [What IS Included in v1.0](#2-what-is-included-in-v10)
3. [What is NOT Included in v1.0 (Deferred to v2)](#3-what-is-not-included-in-v10-deferred-to-v2)
4. [Success Criteria](#4-success-criteria)
5. [Technical Constraints](#5-technical-constraints)
6. [MVP Testing Requirements](#6-mvp-testing-requirements)
7. [MVP Risk List](#7-mvp-risk-list)
8. [MVP Launch Checklist](#8-mvp-launch-checklist)

---

## 1. MVP Vision Statement

DipChats v1.0 proves the core value proposition: **pure local identity, zero-registration, real-time messaging that works on a LAN without Internet, with a server-backed online mode.**

The MVP delivers a working chat platform where devices on the same local network can discover each other, authenticate via Ed25519 keys, and exchange messages through both server relay (online) and direct peer connections (LAN offline). No accounts. No passwords. No cloud dependency for LAN use.

**In one sentence:** Install, open, chat -- instantly, with anyone on your network.

---

## 2. What IS Included in v1.0

### 2.1 Device Identity Generation

- [ ] Generate X25519 identity key pair on first launch
- [ ] Generate Ed25519 signing key pair on first launch
- [ ] Derive SHA-256 fingerprint from identity public key
- [ ] Derive 8-byte peer ID from fingerprint
- [ ] Store keys in OS keychain (desktop) or secure enclave (Tauri)
- [ ] Store display name locally (user-chosen, cosmetic only)
- [ ] Onboarding flow: open app, enter display name, tap "Join", ready in < 3 seconds

### 2.2 Ed25519 Authentication

- [ ] Challenge-response handshake over WebSocket (see WEBSOCKET_PROTOCOL.md Section 8)
- [ ] Server generates 16-byte random nonce, 30-second expiry
- [ ] Client signs SHA-512("DipChats Auth v1" || challenge || connection_id) with Ed25519 private key
- [ ] Server verifies signature against registered public key
- [ ] Idempotent device registration (POST /auth/register)
- [ ] Session token issued after successful authentication
- [ ] Session expiry with automatic re-authentication flow
- [ ] Device revocation support (server sends auth.device_revoked)

### 2.3 WebSocket Real-Time Messaging

- [ ] WSS connection to server (wss://server.example.com/ws)
- [ ] JSON protocol format, versioned (version: 1)
- [ ] Connection lifecycle: CONNECT > AUTHENTICATING > AUTHENTICATED > READY > ACTIVE
- [ ] Heartbeat ping/pong every 30 seconds
- [ ] Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s, 30s max)
- [ ] Reconnect flow: connect > authenticate > sync > resume
- [ ] Request/response correlation via request_id
- [ ] Structured error responses with machine-readable codes

### 2.4 Channels (Public/Private)

- [ ] Create channel (name, type: PUBLIC or PRIVATE, description)
- [ ] Join public channel (no approval required)
- [ ] Join private channel (invite-based)
- [ ] Leave channel
- [ ] Channel membership with roles: owner, admin, moderator, member
- [ ] Channel metadata: name, description, type, owner, created_at
- [ ] Channel list with unread counts
- [ ] Channel search/filter

### 2.5 Direct Messages

- [ ] DM conversations implemented as internal channels (type: "dm")
- [ ] Same message protocol as channels (consistency)
- [ ] DM initiation by selecting a peer
- [ ] DM list with last message preview
- [ ] DM unread counts

### 2.6 Reactions, Replies, Threading

- [ ] Add/remove emoji reactions on any message (message.react)
- [ ] Reaction counts displayed per message
- [ ] Reply to a message (reply_to field in message.send)
- [ ] Reply thread view (messages referencing the same parent)
- [ ] Visual indicator for replies in main chat view

### 2.7 File Sharing (Online)

- [ ] Upload files via HTTP (POST /files/upload) -- NOT over WebSocket
- [ ] Signed upload URL generation (MinIO presigned URLs)
- [ ] Max file size: 100 MB (configurable)
- [ ] Supported types: images, videos, documents, archives
- [ ] SHA-256 hash verification on upload and download
- [ ] Preview generation for images (thumbnail)
- [ ] Attachment metadata in messages (id, name, mime, size, hash)
- [ ] Download via signed URL (GET /files/:id)
- [ ] File list per channel

### 2.8 Presence, Typing Indicators

- [ ] Presence statuses: ONLINE, IDLE, DND, INVISIBLE, OFFLINE
- [ ] Redis-backed presence with 60-second TTL heartbeat
- [ ] Typing indicators (typing.start / typing.stop)
- [ ] Typing TTL: 5 seconds (auto-expire)
- [ ] Typing indicators NOT persisted to PostgreSQL
- [ ] Presence broadcast to channel members
- [ ] Last seen timestamp per device

### 2.9 LAN Peer Discovery

- [ ] UDP broadcast on local network on startup
- [ ] Discovery packet format: magic 0x44495043, version, peer_id_hash, display_name, listen_port, capabilities, signature
- [ ] mDNS service advertisement: _dipchats._tcp.local.
- [ ] Broadcast interval: every 60 seconds
- [ ] Peer expiry: 180 seconds without refresh
- [ ] Peer state table: peerIdHash, displayname, ephemeralPubkey, transport, capabilities, lastSeen, score
- [ ] Capabilities flags: can_relay, has_storage, is_battery_powered, supports_ble, supports_wifi_direct

### 2.10 Direct Peer Messaging (LAN)

- [ ] TCP/WebSocket peer-to-peer connections on LAN
- [ ] Peer connection establishment after discovery
- [ ] Noise XX handshake for session encryption (mutual authentication)
- [ ] ChaCha20-Poly1305 for session payload encryption
- [ ] Direct message delivery with ACK
- [ ] Delivery receipt propagation back to sender
- [ ] Fallback to relay if direct connection fails

### 2.11 Multi-Hop Relay (LAN)

- [ ] Controlled flooding routing (flood forward to all neighbors except sender)
- [ ] Deduplication cache (5-minute window, max 10,000 entries)
- [ ] TTL decrement and hop count increment before forwarding
- [ ] Max hop count enforcement (configurable, default: 10)
- [ ] Loop prevention via dedup cache
- [ ] Relay eligibility checks: capability flag, battery level, capacity, rate limit
- [ ] Token bucket rate limiting per peer and global
- [ ] Priority queue for relay: courier envelopes > gossip > data > discovery

### 2.12 Store-and-Forward (Simplified Courier)

- [ ] Courier envelope format (version, recipient_tag, envelope_id, ttl, hop_count, sender_pubkey, encrypted payload)
- [ ] Daily-rotating HMAC recipient tags (SHA-256 based)
- [ ] Spray to 1-3 connected peers as couriers
- [ ] Courier queue: max 500 entries, max 10 MB
- [ ] Expiration: courier envelopes expire after 1 hour
- [ ] Eviction policy: expired > high-hop > lowest TTL > reject new
- [ ] Delivery on encounter: direct send to recipient
- [ ] ACK propagation back to sender
- [ ] Sender outbox: max 1000 entries, 24-hour expiry

### 2.13 Offline Message Queue

- [ ] Messages created offline retain client_message_id and device signature
- [ ] Local queue in SQLite/IndexedDB (pending messages table)
- [ ] State machine: queued > encrypting > sending > sent/failed
- [ ] Retry with exponential backoff, max 5 retries
- [ ] Sync on reconnect: upload pending messages, server deduplicates, broadcast
- [ ] Idempotency via client_message_id (server returns existing if duplicate)

### 2.14 Server Sync

- [ ] Cursor-based synchronization (last_sync_cursor)
- [ ] Sync request with cursor + limit
- [ ] Server returns missing events since cursor
- [ ] Server sequence numbers for gap detection
- [ ] Client applies events locally, updates cursor
- [ ] Reconnect sync flow: connect > authenticate > sync request > apply > ready
- [ ] Mesh-compatible sync events for offline-to-online transitions

### 2.15 Web Client

- [ ] React + Vite + TypeScript
- [ ] Responsive design (desktop-first, mobile-viewport aware)
- [ ] Chat view with channel list, message list, composer
- [ ] DM view
- [ ] Channel creation/join UI
- [ ] File upload/download UI
- [ ] Presence indicators (online dots)
- [ ] Typing indicators in chat
- [ ] Settings: display name, device info
- [ ] IndexedDB for local storage
- [ ] WebSocket connection with auto-reconnect
- [ ] Toast notifications for new messages (when tab unfocused)

### 2.16 Desktop Client (Tauri)

- [ ] Tauri (Rust backend + web frontend)
- [ ] Shared UI codebase with web client
- [ ] OS keychain integration for key storage
- [ ] System tray integration
- [ ] Native notifications
- [ ] Auto-start on login (optional)
- [ ] LAN peer discovery via system network APIs
- [ ] TCP/WebSocket peer connections
- [ ] File system access for file sharing
- [ ] SQLite for local storage

---

## 3. What is NOT Included in v1.0 (Deferred to v2)

| Feature | Rationale for Deferral |
|---------|----------------------|
| **BLE mesh transport** | Requires platform-specific APIs (iOS CoreBluetooth, Android BLE), complex scanning/connection management. LAN TCP/WebSocket is sufficient for MVP. |
| **Wi-Fi Direct** | Platform-specific, complex pairing flows. LAN covers same-network use case. |
| **WebRTC transport** | STUN/TURN infrastructure needed, NAT traversal complexity. Server WebSocket handles online mode. |
| **Mobile clients (iOS/Android)** | React Native adds build/deploy complexity. Web + Desktop covers core experience. |
| **Advanced spray-and-wait** | Full spray factor K=5, redundancy R=3, multi-courier paths. MVP uses simplified courier (spray to 1-3 peers). |
| **Gossip sync with compact filters** | Bloom filter exchange, set reconciliation. MVP uses simple inventory exchange. |
| **CRDT offline reconciliation** | Vector clocks, message DAG, causal ordering. MVP uses last-writer-wins with timestamp + device_id tiebreak. |
| **Push notifications** | APNs/FCM integration, server-side push triggers. Web notifications cover desktop. |
| **Voice messages** | Audio recording, encoding, streaming. Text-only for MVP. |
| **Video calls** | WebRTC video, SFU/MCU infrastructure. Out of scope for MVP. |
| **Screen sharing** | WebRTC screen capture. Out of scope for MVP. |
| **Multi-device key sync** | QR code exchange for linking devices. MVP assumes single device per identity. |
| **E2E encryption for channels** | Double Ratchet per-channel encryption. MVP uses server-relayed ciphertext. DMs use device-level encryption. |
| **Message editing with CRDT** | Concurrent edit merging. MVP supports sequential edit only (last-writer-wins). |
| **Advanced file transfer over mesh** | Chunked mesh file transfer with resume. MVP file sharing is server-only (MinIO). |
| **Battery-aware duty cycling** | Power mode management for mobile. Desktop/web are mains-powered. |
| **Source routing** | Known-path routing to reduce flooding. MVP uses controlled flooding only. |
| **Anomaly detection** | Statistical peer behavior analysis. MVP uses basic rate limiting. |

---

## 4. Success Criteria

### 4.1 Functional Criteria

| ID | Criterion | Measurable Target |
|----|-----------|-------------------|
| F-01 | Device onboarding | Install to first message in < 3 seconds |
| F-02 | Identity key generation | Keys generated and stored in OS keychain on first launch |
| F-03 | Server authentication | Challenge-response handshake completes in < 500ms |
| F-04 | Message delivery (online) | 99% of messages delivered within 2 seconds (same server) |
| F-05 | Channel creation | Create public/private channel in < 1 second |
| F-06 | File upload | Upload 10 MB file in < 5 seconds on LAN |
| F-07 | LAN peer discovery | Peers discovered within 60 seconds of joining network |
| F-08 | Direct peer messaging | Message delivered peer-to-peer in < 500ms on LAN |
| F-09 | Multi-hop relay | Message delivered within 3 hops in < 2 seconds |
| F-10 | Store-and-forward | Courier delivers message within 5 minutes of encounter |
| F-11 | Offline queue | Offline messages synced within 10 seconds of reconnection |
| F-12 | Reconnection | Client reconnects and resumes within 5 seconds |
| F-13 | Reactions | Add/remove reaction in < 500ms |
| F-14 | Typing indicators | Typing indicator appears within 1 second |
| F-15 | Presence | Presence updates propagate within 5 seconds |

### 4.2 Non-Functional Criteria

| ID | Criterion | Measurable Target |
|----|-----------|-------------------|
| NF-01 | Concurrent users (server) | Support 100 concurrent WebSocket connections per server instance |
| NF-02 | Message throughput | Handle 50 messages/second per channel without degradation |
| NF-03 | Memory usage (client) | Web client < 200 MB RAM, Desktop client < 300 MB RAM |
| NF-04 | Storage (client) | Local database < 500 MB for 30-day message history |
| NF-05 | Battery impact (desktop) | < 2% CPU usage when idle (system tray) |
| NF-06 | Uptime | Server 99.5% uptime during alpha testing period |
| NF-07 | Recovery | Zero data loss on client crash (messages persist locally) |
| NF-08 | Latency (LAN) | Direct peer messages < 100ms round-trip |
| NF-09 | Latency (online) | Server-relayed messages < 300ms round-trip |
| NF-10 | Security | Zero private keys transmitted over any network |

### 4.3 Quality Criteria

| ID | Criterion | Measurable Target |
|----|-----------|-------------------|
| Q-01 | Test coverage | > 80% unit test coverage for core modules (crypto, messaging, sync) |
| Q-02 | Integration tests | All WebSocket protocol events tested end-to-end |
| Q-03 | LAN mesh tests | Multi-node mesh simulation passing with 5+ virtual peers |
| Q-04 | No P0 bugs | Zero critical bugs at launch |
| Q-05 | Documentation | API docs, protocol docs, and setup guide complete |
| Q-06 | Docker deployment | Full stack (server + PostgreSQL + Redis + MinIO) deployable via docker-compose |

---

## 5. Technical Constraints

### 5.1 Server

- **Runtime:** Node.js + TypeScript (Fastify)
- **Database:** PostgreSQL 16+ (Drizzle ORM)
- **Cache/PubSub:** Redis 7+
- **Object Storage:** MinIO (S3-compatible)
- **Transport:** WebSocket (ws library) + HTTP REST
- **Message Format:** JSON over WebSocket, UTF-8
- **Protocol Version:** v1 (all messages include `"version": 1`)

### 5.2 Client (Web)

- **Framework:** React 18+ with Vite
- **Language:** TypeScript (strict mode)
- **State Management:** Zustand or similar lightweight store
- **Local Storage:** IndexedDB (via Dexie or similar)
- **Build Target:** Modern browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
- **No server-side rendering required**

### 5.3 Client (Desktop)

- **Framework:** Tauri 2.x (Rust backend + webview frontend)
- **Frontend:** Shared codebase with web client
- **Key Storage:** OS keychain via Tauri plugin-store or security crate
- **Local Storage:** SQLite via Tauri plugin-sql
- **Platforms:** Windows 10+, macOS 12+, Ubuntu 20.04+

### 5.4 Cryptography

- **Identity Keys:** X25519 (key agreement), Ed25519 (signing)
- **Libraries:** noble-curves or tweetnacl (JavaScript), ring or ed25519-dalek (Rust)
- **Session Encryption:** Noise XX protocol with ChaCha20-Poly1305
- **Courier Envelopes:** XChaCha20-Poly1305
- **Hashing:** SHA-256 (fingerprint, dedup), SHA-512 (auth signature)
- **HMAC:** HMAC-SHA256 (recipient tags, packet signatures)
- **Never implement custom cryptography**

### 5.5 Protocol

- **WebSocket:** JSON text frames, max payload 1 MB
- **REST:** JSON request/response, standard HTTP status codes
- **Mesh:** Binary packets with fixed header, max hop count 10
- **Discovery:** UDP broadcast (port configurable), mDNS
- **File Upload:** HTTP multipart with presigned URLs

### 5.6 Infrastructure

- **Docker Compose** for local development and alpha deployment
- **Single-server deployment** for MVP (no clustering required)
- **TLS termination** at reverse proxy (nginx/caddy) in production
- **No CI/CD pipeline required** for alpha (manual deployment acceptable)

### 5.7 Performance Budgets

- **WebSocket message:** < 50ms server processing time
- **HTTP API:** < 200ms response time (p95)
- **Message encryption:** < 10ms per message (client-side)
- **File upload:** < 5 seconds for 10 MB on LAN
- **LAN discovery:** < 60 seconds to discover all peers on subnet

---

## 6. MVP Testing Requirements

### 6.1 Unit Tests

| Module | Coverage Target | Key Test Cases |
|--------|----------------|----------------|
| Crypto Engine | > 90% | Key generation, signing, verification, encryption, decryption, Noise handshake |
| Identity Manager | > 85% | Key storage, fingerprint derivation, peer ID generation, display name |
| Message Engine | > 85% | Message creation, validation, deduplication, queue management, routing |
| Transport Layer | > 80% | WebSocket connect/disconnect, reconnection, peer connection, relay forwarding |
| Sync Engine | > 80% | Cursor management, missing event detection, conflict resolution |
| Courier System | > 80% | Envelope creation, recipient tag generation, spray algorithm, delivery |
| Channel Service | > 80% | CRUD operations, membership, roles, authorization |
| Message Service | > 80% | Persistence, fan-out, reactions, replies, edits, deletion |
| Presence Service | > 80% | TTL management, status updates, typing indicators |

### 6.2 Integration Tests

- [ ] Full WebSocket connection lifecycle (connect > auth > messaging > disconnect)
- [ ] Multi-device messaging through server relay
- [ ] Channel create > join > send message > receive message flow
- [ ] DM initiation and bidirectional messaging
- [ ] File upload > attach to message > download flow
- [ ] Reconnection with sync recovery
- [ ] Presence propagation across multiple clients
- [ ] Typing indicator display and expiry

### 6.3 LAN Mesh Tests (Simulated)

- [ ] 2-node direct messaging (same subnet)
- [ ] 3-node relay messaging (A > B > C)
- [ ] 5-node controlled flooding with deduplication
- [ ] Store-and-forward: courier carries message to offline peer
- [ ] Peer discovery via UDP broadcast
- [ ] mDNS service registration and resolution
- [ ] Deduplication under packet replay
- [ ] TTL expiry and hop count enforcement
- [ ] Relay rate limiting under flood conditions

### 6.4 Security Tests

- [ ] Private key never transmitted (network capture verification)
- [ ] Challenge-response replay attack prevention
- [ ] Session token expiry and re-authentication
- [ ] Channel authorization (non-members cannot read messages)
- [ ] Device revocation (revoked device cannot authenticate)
- [ ] Courier envelope opacity (courier cannot decrypt payload)
- [ ] SQL injection prevention on all API endpoints
- [ ] XSS prevention in display names and messages

### 6.5 Performance Tests

- [ ] 100 concurrent WebSocket connections to server
- [ ] 50 messages/second sustained throughput per channel
- [ ] Memory usage under load (1000 messages in history)
- [ ] File upload/download throughput (10 MB, 50 MB, 100 MB)
- [ ] LAN mesh latency under 5-node topology
- [ ] Reconnection time under simulated network interruption

### 6.6 User Acceptance Tests

- [ ] Onboarding: new user installs and sends first message without documentation
- [ ] Channel workflow: create channel, invite peer, exchange messages
- [ ] DM workflow: find peer, start DM, exchange messages
- [ ] File sharing: upload image, share in channel, recipient downloads
- [ ] Offline scenario: disconnect network, queue messages, reconnect, verify delivery
- [ ] LAN scenario: two devices on same WiFi, discover and message without server
- [ ] Multi-hop: device A messages device C through device B relay

---

## 7. MVP Risk List

| Risk ID | Risk | Probability | Impact | Mitigation |
|---------|------|-------------|--------|------------|
| R-01 | LAN peer discovery fails across different subnets/routers | Medium | High | Document limitation; test on common home/office networks; consider mDNS fallback |
| R-02 | WebSocket reconnection loses messages during sync | Medium | High | Implement cursor-based sync with server sequence numbers; test extensively |
| R-03 | Ed25519 signature verification performance bottleneck | Low | Medium | Use optimized libraries (noble-curves); benchmark during development |
| R-04 | Tauri OS keychain integration issues on Linux | Medium | Medium | Fallback to encrypted file storage; test on Ubuntu early |
| R-05 | Courier envelope delivery unreliable with high peer churn | Medium | Medium | Simplified courier for MVP (1-3 peers); document reliability limits |
| R-06 | IndexedDB storage limits in browser (web client) | Low | Medium | Implement storage monitoring; warn users at 80% capacity |
| R-07 | MinIO setup complexity for alpha testers | Low | Low | Provide docker-compose with working MinIO config; document setup |
| R-08 | Protocol version incompatibility between clients | Low | High | Version negotiation in handshake; reject incompatible versions |
| R-09 | Memory leaks in long-running WebSocket connections | Medium | Medium | Implement connection cleanup; monitor in alpha testing |
| R-10 | UDP broadcast blocked by corporate firewalls | High | Medium | Document as known limitation; mDNS as fallback on same subnet |
| R-11 | Noise XX handshake latency on first connection | Low | Low | Benchmark; optimize if > 100ms |
| R-12 | Rate limiting too aggressive for legitimate use | Low | Medium | Configurable limits; monitor false positives during alpha |

---

## 8. MVP Launch Checklist

### 8.1 Pre-Launch (Development Complete)

- [ ] All Section 2 features implemented and passing tests
- [ ] Unit test coverage > 80% for core modules
- [ ] Integration tests passing for all WebSocket protocol events
- [ ] LAN mesh simulation tests passing with 5+ virtual peers
- [ ] Security tests passing (no private key leaks, auth replay prevention)
- [ ] Docker Compose brings up full stack (server + PostgreSQL + Redis + MinIO)
- [ ] Web client builds and runs without errors
- [ ] Desktop client builds and runs on Windows, macOS, Ubuntu
- [ ] No P0 bugs open
- [ ] Protocol documentation up to date (WEBSOCKET_PROTOCOL.md)
- [ ] Database schema matches DATABASE.md
- [ ] API endpoints match API.md

### 8.2 Alpha Deployment

- [ ] Server deployed to alpha environment (single server)
- [ ] TLS configured (Let's Encrypt or self-signed for testing)
- [ ] PostgreSQL backups configured (daily)
- [ ] Redis persistence configured (RDB snapshots)
- [ ] MinIO storage initialized
- [ ] DNS/hosts configured for WebSocket endpoint
- [ ] Firewall rules allow WebSocket (443/8443), HTTP (4000), UDP discovery

### 8.3 Alpha Testing

- [ ] 5+ internal testers onboarded
- [ ] Each tester completes onboarding flow successfully
- [ ] Each tester sends/receives messages in public channel
- [ ] Each tester sends/receives DMs
- [ ] Each tester uploads/downloads files
- [ ] LAN peer discovery tested on at least 2 different networks
- [ ] Multi-hop relay tested with 3+ devices
- [ ] Offline queue tested (disconnect > send > reconnect > verify)
- [ ] Reconnection tested after server restart
- [ ] Bug reports triaged and P0/P1 bugs fixed

### 8.4 Go/No-Go Criteria

| Criterion | Status Required |
|-----------|----------------|
| All F-01 through F-15 functional criteria met | PASS |
| All NF-01 through NF-10 non-functional criteria met | PASS |
| Zero P0 bugs open | PASS |
| Zero P1 bugs open | PASS |
| All security tests passing | PASS |
| Docker deployment working on clean machine | PASS |
| 5+ alpha testers complete full test suite | PASS |
| No private key transmitted in any network capture | PASS |

### 8.5 Post-Launch (v1.0 Stabilization)

- [ ] Monitor server metrics (connections, message rate, error rate)
- [ ] Collect alpha tester feedback
- [ ] Prioritize bug fixes (P0 same day, P1 within 48 hours, P2 next sprint)
- [ ] Document known limitations for v1.0
- [ ] Begin v2 planning based on alpha feedback
- [ ] Archive MVP artifacts for reference

---

*This document defines the complete MVP scope for DipChats v1.0. All implementation must conform to this scope. Features not listed here are explicitly deferred to v2. The development team should use this as the single source of truth for what must be built, tested, and verified before launch.*
