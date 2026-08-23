# DipChats Development Roadmap

**Version:** 1.0
**Last Updated:** August 2026
**Total Duration:** 36 Weeks
**Architecture:** Decentralized, privacy-first messaging platform

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Timeline (Gantt)](#timeline-gantt)
4. [Phase 1: Foundation](#phase-1-foundation)
5. [Phase 2: Identity & Auth](#phase-2-identity--auth)
6. [Phase 3: Core Messaging](#phase-3-core-messaging)
7. [Phase 4: Encryption](#phase-4-encryption)
8. [Phase 5: File Sharing](#phase-5-file-sharing)
9. [Phase 6: Offline-First](#phase-6-offline-first)
10. [Phase 7: LAN Mesh (MVP)](#phase-7-lan-mesh-mvp)
11. [Phase 8: Clients](#phase-8-clients)
12. [Phase 9: Production](#phase-9-production)
13. [Dependency Graph](#dependency-graph)
14. [Risk Register](#risk-register)
15. [Success Metrics](#success-metrics)

---

## Overview

DipChats is a decentralized, privacy-first messaging platform built around pure local identity — no accounts, no passwords, no centralized auth. Messages travel through a bitchat-style spray-and-wait courier model over LAN mesh networking. The platform targets Web (React + Vite + Tailwind), Desktop (Tauri), and Mobile (React Native) with a Node.js + Fastify + PostgreSQL + Redis + MinIO backend.

### Design Philosophy

| Principle | Description |
|-----------|-------------|
| Zero-Knowledge Identity | Device-generated cryptographic keys, no server-side PII |
| End-to-End by Default | All private messages encrypted with Double Ratchet |
| Offline-First | Full functionality without network connectivity |
| Spray-and-Wait | Bitchat-style courier relay for decentralized delivery |
| Progressive Decentralization | Start with server-assisted, evolve to full mesh |

---

## Architecture Principles

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENTS                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │   Web    │  │ Desktop  │  │  Mobile  │             │
│  │ (React)  │  │ (Tauri)  │  │ (React   │             │
│  │ +Vite    │  │          │  │  Native) │             │
│  │ +Tailwind│  │          │  │          │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │              │              │                   │
│  ┌────┴──────────────┴──────────────┴────┐             │
│  │         Transport Abstraction          │             │
│  │    (WebSocket / TCP / UDP / mDNS)      │             │
│  └────────────────┬──────────────────────┘             │
└───────────────────┼─────────────────────────────────────┘
                    │
┌───────────────────┼─────────────────────────────────────┐
│              SERVER (Optional / Relay)                    │
│  ┌────────────────┴──────────────────────┐             │
│  │         Fastify HTTP Gateway           │             │
│  └────────────────┬──────────────────────┘             │
│                   │                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ │
│  │PostgreSQL│ │  Redis  │ │  MinIO  │ │ Message Bus │ │
│  │(State)  │ │(Cache)  │ │(Files)  │ │  (Redis)    │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                    │
┌───────────────────┼─────────────────────────────────────┐
│              LAN MESH (P2P)                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │  Peer A │◄─►│  Peer B │◄─►│  Peer C │               │
│  │(Device) │ │(Device) │ │(Device) │                   │
│  └─────────┘ └─────────┘ └─────────┘                   │
│      UDP Broadcast + mDNS Discovery                      │
│      TCP/WebSocket Direct Messaging                      │
│      TTL + Deduplication + Multi-Hop Relay               │
└─────────────────────────────────────────────────────────┘
```

---

## Timeline (Gantt)

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36
      ├──────────────┤
Phase 1 ████████████████████████████████
      Foundation

            ├───────┤
Phase 2     ████████████████████
            Identity & Auth

                        ├───────────────────┤
Phase 3                 ████████████████████████████████████████████
                        Core Messaging

                                    ├───────────┤
Phase 4                             ████████████████████████████
                                    Encryption

                                                ├───────┤
Phase 5                                         ████████████████████
                                                File Sharing

                                                    ├───────────────┤
Phase 6                                             ████████████████████████████████████████████
                                                    Offline-First

                                                                ├───────────────────────┤
Phase 7                                                         ████████████████████████████████████████████
                                                                LAN Mesh (MVP)

                                                                            ├───────────────────────┤
Phase 8                                                                     ████████████████████████████████████████████
                                                                            Clients

                                                                                        ├───────────┤
Phase 9                                                                                 ████████████████████████████
                                                                                        Production
```

### Phase Dependencies (Critical Path)

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 7 ──► Phase 8 ──► Phase 9
                    │                    │                    │
                    └──► Phase 5 ────────┘                    │
                    └──► Phase 6 ────────────────────────────┘
```

---

## Phase 1: Foundation

**Duration:** Weeks 1–4 (4 weeks)
**Dependencies:** None (initial phase)
**Owner:** Backend Lead

### Objectives

Establish the complete development infrastructure, toolchain, and base architecture that all subsequent phases build upon.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Monorepo Structure | Turborepo/Nx monorepo with `packages/`, `apps/`, `libs/` | All packages build, lint, test independently |
| TypeScript Config | Shared `tsconfig.base.json` with strict mode, path aliases | Zero `any` types in strict mode |
| Docker Compose | PostgreSQL, Redis, MinIO containers with health checks | `docker compose up` starts all services in <30s |
| PostgreSQL Schema | Initial migration with `users`, `devices`, `channels`, `messages` tables | All tables created, indexed, constraints enforced |
| Redis Config | Session store, pub/sub channels, rate limiting config | Redis passes connection test suite |
| MinIO Config | Bucket policies, CORS, signed URL generation | Upload/download cycle works end-to-end |
| CI Pipeline | GitHub Actions: lint, typecheck, test, build | Pipeline runs on every PR, blocks merge on failure |
| Environment Config | `.env.example`, `dotenv` validation, platform-specific configs | All services configurable via environment |

### Database Schema (Initial)

```sql
-- Core identity tables
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_key_ed25519 TEXT NOT NULL UNIQUE,
    device_key_x25519 TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'online',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messaging tables
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('group', 'dm')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    content TEXT,
    type TEXT DEFAULT 'text',
    encrypted BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

### Testing Requirements

- Unit tests: Database migration rollback/forward
- Integration tests: Docker compose health checks, connection pooling
- Linting: ESLint + Prettier with pre-commit hooks

### Success Criteria

- [ ] `docker compose up` starts PostgreSQL, Redis, MinIO
- [ ] All TypeScript packages compile with zero errors
- [ ] CI pipeline passes on fresh clone
- [ ] Database migrations run forward and backward cleanly
- [ ] Environment configuration validated on startup

---

## Phase 2: Identity & Auth

**Duration:** Weeks 5–6 (2 weeks)
**Dependencies:** Phase 1 (Foundation)
**Owner:** Security Lead

### Objectives

Implement the zero-knowledge identity system. No accounts, no passwords — every device generates its own cryptographic identity and authenticates via Ed25519 challenge-response.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Key Generation | X25519 (encryption) + Ed25519 (signing) keypair per device | Keys generated deterministically from device entropy |
| Secure Storage | Platform-specific key storage (Keychain/Keystore/OS keyring) | Keys never written to plaintext files |
| Challenge-Response Auth | Server issues nonce, device signs with Ed25519, server verifies | Auth completes in <100ms on commodity hardware |
| Session Management | JWT-free session tokens tied to device public key | Session invalidated on key rotation |
| Device Trust | Device fingerprinting, revocation support | Compromised device can be revoked by user |
| Identity Protocol | Noise Protocol handshake for initial key exchange | MITM resistance verified in test suite |

### Cryptographic Protocol

```
Device Registration:
  1. Device generates Ed25519 keypair (signing)
  2. Device generates X25519 keypair (encryption)
  3. Device stores private keys in secure enclave
  4. Device sends public keys to server (signed registration claim)
  5. Server stores public keys, returns device_id

Authentication Flow:
  1. Client requests auth challenge: GET /auth/challenge
  2. Server returns: { nonce: "random-32-bytes", timestamp }
  3. Client signs: signature = Ed25519_Sign(nonce + timestamp, private_key)
  4. Client sends: POST /auth/verify { device_id, signature }
  5. Server verifies signature against stored public key
  6. Server returns: session_token (HMAC-signed, device-bound)
```

### Testing Requirements

- Unit tests: Key generation, signing, verification
- Integration tests: Full auth flow, session lifecycle
- Security tests: Replay attack resistance, timing attack resistance
- Fuzz tests: Malformed signatures, expired nonces

### Success Criteria

- [ ] Device identity generated and stored securely on all platforms
- [ ] Challenge-response auth completes without exposing private keys
- [ ] Session tokens are device-bound and revocable
- [ ] Auth flow resistant to replay and MITM attacks
- [ ] Key rotation mechanism functional

---

## Phase 3: Core Messaging

**Duration:** Weeks 7–10 (4 weeks)
**Dependencies:** Phase 2 (Identity & Auth)
**Owner:** Backend Lead

### Objectives

Build the complete messaging infrastructure: channels, direct messages, real-time delivery, and all social features (reactions, threads, typing indicators).

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| WebSocket Gateway | Fastify WebSocket plugin with auth middleware | 1000 concurrent connections per instance |
| Channel CRUD | Create, list, join, leave, archive channels | All operations authenticated, channels indexed |
| Direct Messages | 1:1 encrypted messaging with key exchange | DMs created on-demand, no pre-registration |
| Message Operations | Send, receive, edit, delete with soft-delete | Optimistic UI updates, server confirmation |
| Reactions | Emoji reactions with toggle semantics | Per-user deduplication, reaction counts |
| Threading | Reply-to messages, thread view | Thread depth unlimited, collapse/expand |
| Typing Indicators | Real-time typing status via Redis pub/sub | 3s debounce, auto-expire after 10s |
| Presence | Online/offline/away status | Heartbeat-based, 30s timeout |
| Delivery Receipts | Sent/delivered/read status per message | Read receipts optional per-user setting |
| Pagination | Cursor-based message history loading | Load 50 messages per page, infinite scroll |

### WebSocket Protocol

```
Connection:
  WS /ws?token={session_token}

Client → Server:
  { type: "message.send", channelId, content, clientMsgId }
  { type: "message.edit", messageId, content }
  { type: "message.delete", messageId }
  { type: "reaction.toggle", messageId, emoji }
  { type: "typing.start", channelId }
  { type: "typing.stop", channelId }
  { type: "presence.update", status }

Server → Client:
  { type: "message.new", message }
  { type: "message.updated", message }
  { type: "message.removed", messageId }
  { type: "reaction.updated", messageId, reactions }
  { type: "typing.users", channelId, users[] }
  { type: "presence.changed", userId, status }
  { type: "delivery.receipt", messageId, status }
```

### Testing Requirements

- Unit tests: Message CRUD, reaction toggle, threading logic
- Integration tests: WebSocket connection lifecycle, pub/sub delivery
- Load tests: 1000 concurrent WebSocket connections
- E2E tests: Full message flow from send to receipt

### Success Criteria

- [ ] Messages delivered in <50ms on local network
- [ ] 1000 concurrent WebSocket connections stable
- [ ] Message history paginates correctly with cursor-based loading
- [ ] Typing indicators debounced and auto-expired
- [ ] Delivery receipts accurate to 99.9%

---

## Phase 4: Encryption

**Duration:** Weeks 11–13 (3 weeks)
**Dependencies:** Phase 3 (Core Messaging)
**Owner:** Security Lead

### Objectives

Implement Double Ratchet protocol for end-to-end encrypted private messages. Messages are encrypted on-device and can only be decrypted by the intended recipient.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Double Ratchet | Full Double Ratchet implementation per X3DH spec | Forward secrecy verified, ratchet step tests pass |
| Key Exchange | X3DH initial key exchange for DM sessions | Session establishment in <200ms |
| E2E Private Messages | Messages encrypted before send, decrypted on receive | Server sees ciphertext only |
| Session Management | Ratchet state persistence, session resumption | Sessions survive reconnection |
| Panic Wipe | One-tap key destruction and message purge | All local keys wiped, messages unrecoverable |
| Key Verification | Safety number comparison for out-of-band verification | QR code and numeric comparison supported |

### Double Ratchet State Machine

```
Sending Chain:
  SK  ──► DH Ratchet ──► Chain Key ──► Message Key
                │                          │
                │                          ▼
                │                    Encrypt(msg, mk)
                │
                └──► KDF Chain ──► Next Chain Key

Receiving Chain:
  Received Message ──► Skip Messages ──► Derive Message Key
                          │                    │
                          │                    ▼
                          │              Decrypt(ct, mk)
                          │
                          └──► KDF Chain ──► Next Chain Key
```

### Security Properties

| Property | Guarantee |
|----------|-----------|
| Forward Secrecy | Compromise of long-term keys doesn't expose past messages |
| Break-in Recovery | Compromise of session keys doesn't expose future messages |
| Deniability | Messages can be repudiated (no server-side signatures) |
| Out-of-Order | Handles message reordering up to 1000 messages |

### Testing Requirements

- Unit tests: Ratchet step, KDF chain, key derivation
- Property-based tests: Forward secrecy invariants
- Fuzz tests: Malformed ciphertext, wrong session keys
- Cross-platform tests: Key exchange between Web/Desktop/Mobile

### Success Criteria

- [ ] Double Ratchet implements X3DH spec correctly
- [ ] Forward secrecy verified by key compromise tests
- [ ] Panic wipe destroys all local cryptographic material
- [ ] Cross-platform E2E encryption interoperable
- [ ] No plaintext visible to server for private messages

---

## Phase 5: File Sharing

**Duration:** Weeks 14–15 (2 weeks)
**Dependencies:** Phase 3 (Core Messaging), Phase 4 (Encryption optional)
**Owner:** Backend Lead

### Objectives

Enable file sharing through MinIO with signed URLs, chunked uploads, and preview generation. Files are optionally encrypted client-side before upload.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Upload API | Presigned URL generation, chunk upload support | Files up to 1GB uploadable |
| MinIO Integration | Bucket management, retention policies, lifecycle | 99.9% upload success rate |
| Media Support | Image, video, audio, document handling | MIME type detection, format validation |
| Chunking & Resume | Resumable uploads with chunk tracking | Resume from last successful chunk on disconnect |
| Hash Verification | SHA-256 integrity check on upload completion | Hash mismatch rejects file |
| Preview Generation | Image thumbnails, video frames, audio waveforms | Previews generated in <5s |
| E2E File Encryption | Client-side encryption before upload | Encrypted files decryptable by recipient only |

### Upload Protocol

```
1. Client requests presigned URL:
   POST /files/upload/init
   { filename, mimeType, size, encrypted: boolean }

2. Server returns:
   { uploadId, presignedUrls: [chunk1, chunk2, ...], bucket }

3. Client uploads chunks in parallel (max 4 concurrent):
   PUT {presignedUrl[i]}
   Body: chunk_data

4. Client completes upload:
   POST /files/upload/complete
   { uploadId, parts: [{ etag, partNumber }], sha256 }

5. Server verifies hash, generates previews, returns:
   { fileId, url, thumbnailUrl, metadata }
```

### Testing Requirements

- Unit tests: Chunk assembly, hash verification, preview generation
- Integration tests: Upload/download cycle, presigned URL validity
- Load tests: Concurrent uploads, large file handling
- Error tests: Network interruption, resume from chunk failure

### Success Criteria

- [ ] Files up to 1GB upload successfully
- [ ] Resumable uploads recover from network interruption
- [ ] SHA-256 verification catches corruption
- [ ] Previews generated for images, videos, audio
- [ ] Client-side encrypted files only decryptable by intended recipient

---

## Phase 6: Offline-First

**Duration:** Weeks 16–19 (4 weeks)
**Dependencies:** Phase 3 (Core Messaging)
**Owner:** Backend Lead + Client Leads

### Objectives

Make DipChats fully functional without network connectivity. All messaging, file access, and UI interactions work offline with automatic sync when reconnected.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Local Database | SQLite (mobile/desktop) / IndexedDB (web) | All message types stored locally |
| Offline Message Creation | Create and queue messages without connection | Messages created instantly, synced later |
| Sync Engine | Cursor-based sync with conflict detection | Sync completes in <5s for 1000 messages |
| Conflict Resolution | CRDT-inspired last-writer-wins with vector clocks | No data loss on concurrent edits |
| Reconnection Handler | Automatic sync on reconnection, exponential backoff | Sync resumes within 5s of reconnection |
| Offline Indicators | Visual feedback for connection state | Clear UX for offline/degraded modes |
| Message Queue | Persistent queue for pending operations | Queue survives app restart |

### Sync Protocol

```
Sync Flow:
  1. Client sends: GET /sync?cursor={last_sync_cursor}&limit=1000
  2. Server returns: { messages[], cursor, hasMore }
  3. Client merges into local DB using CRDT merge rules
  4. Client sends: POST /sync/outbox { pendingMessages[] }
  5. Server processes and returns: { processed[], conflicts[] }
  6. Client resolves conflicts using vector clock comparison

Conflict Resolution Rules:
  - Same message edited concurrently: Latest timestamp wins
  - Same message deleted concurrently: Delete wins over edit
  - Reaction conflicts: Merge (additive)
  - Channel membership: Server is source of truth
```

### Offline Capabilities Matrix

| Feature | Offline Behavior | Sync Behavior |
|---------|-----------------|---------------|
| Read messages | Full access to local cache | Delta sync on reconnect |
| Send message | Queue locally, show as "sending" | Deliver on reconnect |
| Edit message | Queue locally, show optimistic | Server confirms on reconnect |
| Delete message | Queue locally, soft-delete locally | Server confirms on reconnect |
| Add reaction | Queue locally, show immediately | Server confirms on reconnect |
| Upload file | Queue locally, upload on reconnect | Resume from last chunk |
| Create channel | Queue locally, show as "pending" | Server creates on reconnect |
| Typing indicator | Not available offline | Resume on reconnect |

### Testing Requirements

- Unit tests: CRDT merge logic, cursor management, queue persistence
- Integration tests: Offline→online transition, sync recovery
- Chaos tests: Network flapping, partial sync failure
- Performance tests: Sync 10k messages in <10s

### Success Criteria

- [ ] All messaging features work offline
- [ ] Messages created offline sync within 5s of reconnection
- [ ] No data loss during conflict resolution
- [ ] Offline queue survives app restart
- [ ] UX clearly indicates connection state

---

## Phase 7: LAN Mesh (MVP)

**Duration:** Weeks 20–24 (5 weeks)
**Dependencies:** Phase 4 (Encryption), Phase 6 (Offline-First)
**Owner:** Networking Lead

### Objectives

Implement bitchat-style spray-and-wait courier networking over LAN. Devices discover each other via UDP broadcast and mDNS, exchange messages directly or through multi-hop relay, and store-and-forward messages for offline peers.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Transport Abstraction | Pluggable transport layer (LAN, future: BLE, Wi-Fi Direct) | Transport swap requires zero protocol changes |
| LAN Discovery | UDP broadcast + mDNS for peer discovery | Discovers all peers on LAN in <5s |
| Direct Messaging | TCP/WebSocket connections between peers | Messages delivered in <50ms on LAN |
| TTL & Hop Limits | Message TTL, max hop count, deduplication | Messages expire correctly, no infinite loops |
| Multi-Hop Relay | Messages relayed through intermediate peers | 3-hop delivery works reliably |
| Store-and-Forward | Offline peer message storage on couriers | Messages delivered when target comes online |
| Mesh Health | Connection quality monitoring, peer scoring | Poor connections routed around |

### Mesh Protocol

```
Discovery:
  1. Device broadcasts UDP packet: { deviceId, publicKey, capabilities }
  2. Peers respond with: { deviceId, publicKey, address, port }
  3. Devices establish TCP connection for message exchange
  4. mDNS service registration: _dipchats._tcp.local

Message Envelope:
  {
    envelopeId: UUID,
    senderId: device_id,
    recipientId: device_id | "broadcast",
    payload: encrypted_message,
    ttl: 300,           // seconds
    hopCount: 0,
    maxHops: 3,
    timestamp: ISO8601,
    signature: Ed25519(payload + metadata)
  }

Relay Logic:
  1. Receive envelope
  2. Verify signature
  3. Check deduplication cache (envelopeId)
  4. If recipient == self: process message
  5. If ttl > 0 AND hopCount < maxHops:
     a. Increment hopCount
     b. Decrement ttl
     c. Forward to all connected peers (except sender)
  6. Else: drop and log

Store-and-Forward:
  1. If target peer offline:
     a. Store envelope in local courier queue
     b. Set delivery deadline = timestamp + ttl
  2. On peer come online:
     a. Send stored envelopes
     b. Wait for ACK
     c. Delete from courier queue on ACK
```

### Network Topology

```
   ┌──────────┐
   │  Peer A  │
   │(Laptop)  │
   └────┬─────┘
        │ TCP
   ┌────┴─────┐        ┌──────────┐
   │  Peer B  │◄──────►│  Peer D  │
   │(Phone)   │  TCP   │(Tablet)  │
   └────┬─────┘        └──────────┘
        │ TCP
   ┌────┴─────┐
   │  Peer C  │
   │(Desktop) │
   └──────────┘

   Discovery: UDP broadcast on 255.255.255.255:41234
   mDNS: _dipchats._tcp.local
   Direct: TCP on dynamically assigned ports
```

### Testing Requirements

- Unit tests: Envelope creation, TTL logic, deduplication
- Integration tests: 2-peer direct messaging, 3-peer relay
- Network tests: High latency, packet loss, peer churn
- Stress tests: 50 peers, 100 messages/second
- Security tests: Replay attacks, tampered envelopes

### Success Criteria

- [ ] Peers discovered on LAN in <5s
- [ ] Direct messaging works between any two peers
- [ ] 3-hop relay delivers messages correctly
- [ ] Store-and-forward delivers to offline peers within TTL
- [ ] Deduplication prevents message duplication
- [ ] 50-peer mesh operates without degradation

---

## Phase 8: Clients

**Duration:** Weeks 25–32 (8 weeks)
**Dependencies:** Phase 5 (File Sharing), Phase 7 (LAN Mesh)
**Owner:** Frontend Lead

### Objectives

Build production-quality clients for Web, Desktop, and Mobile. All clients share business logic through a common core library and implement the full feature set.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Web Client | React + Vite + Tailwind CSS | Lighthouse score >90, bundle <200KB gzipped |
| Desktop Client | Tauri (Rust backend + WebView) | Native feel, <50MB install size |
| Mobile Client | React Native (iOS + Android) | App Store ready, <30MB install size |
| Shared Core | Platform-agnostic business logic library | 90%+ code sharing between platforms |
| UI Components | Shared component library (Shadcn-inspired) | Consistent design across platforms |
| Responsive Design | Mobile-first, adaptive layouts | Works on 320px to 4K displays |
| Push Notifications | Platform-native notification support | Notifications work in background |
| Accessibility | WCAG 2.1 AA compliance | Screen reader compatible, keyboard navigable |

### Client Architecture

```
┌─────────────────────────────────────────────┐
│              SHARED CORE (90%)                │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Crypto   │ │  Sync    │ │   Mesh     │ │
│  │  Engine   │ │  Engine  │ │   Client   │ │
│  └───────────┘ └──────────┘ └────────────┘ │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Message  │ │  Channel │ │   Identity │ │
│  │  Store    │ │  Manager │ │   Manager  │ │
│  └───────────┘ └──────────┘ └────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────┴───────┐   ┌────────┴──────┐   ┌────────┴──────┐
│   Web (10%)   │   │ Desktop (10%) │   │  Mobile (10%) │
│   React       │   │   Tauri       │   │  React Native │
│   Vite        │   │   Rust        │   │   Native      │
│   Tailwind    │   │   WebView     │   │   Modules     │
└───────────────┘   └───────────────┘   └───────────────┘
```

### UI/UX Screens

| Screen | Web | Desktop | Mobile |
|--------|-----|---------|--------|
| Onboarding/Identity | ✅ | ✅ | ✅ |
| Channel List | ✅ | ✅ | ✅ |
| Chat View | ✅ | ✅ | ✅ |
| Thread View | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ |
| File Browser | ✅ | ✅ | ✅ |
| Peer Discovery | ✅ | ✅ | ✅ |
| Encryption Info | ✅ | ✅ | ✅ |

### Testing Requirements

- Unit tests: Shared core library (>90% coverage)
- Component tests: All UI components per platform
- E2E tests: Playwright (web), Appium (mobile/desktop)
- Visual regression: Chromatic for component library
- Accessibility tests: axe-core integration
- Performance tests: Bundle size, render time, memory usage

### Success Criteria

- [ ] Web client: Lighthouse >90, First Contentful Paint <1s
- [ ] Desktop client: <50MB install, <2s cold start
- [ ] Mobile client: 60fps scrolling, <3s cold start
- [ ] 90%+ code sharing across platforms
- [ ] WCAG 2.1 AA compliance verified
- [ ] All screens responsive from 320px to 4K

---

## Phase 9: Production

**Duration:** Weeks 33–36 (4 weeks)
**Dependencies:** Phase 8 (Clients)
**Owner:** DevOps Lead

### Objectives

Prepare DipChats for production deployment and open-source release. Security hardening, performance optimization, monitoring, documentation, and community preparation.

### Key Deliverables

| Deliverable | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| Security Audit | Third-party security review preparation | All critical/high issues resolved |
| Load Testing | Simulated production traffic | Handles 10k concurrent users |
| Monitoring | Prometheus + Grafana dashboards | All critical metrics visible |
| Alerting | PagerDuty/Opsgenie integration | Alerts fire within 60s of incident |
| Deployment | Kubernetes manifests, Helm charts | `helm install` deploys full stack |
| Documentation | API docs, architecture docs, contributor guide | All docs reviewed and published |
| Open Source | GitHub repo, LICENSE, CONTRIBUTING.md | Repo public with CI passing |
| Performance | Load testing, profiling, optimization | P99 latency <200ms for API calls |

### Monitoring Stack

```
┌─────────────────────────────────────────────┐
│              OBSERVABILITY                    │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │Prometheus │ │ Grafana  │ │  Jaeger    │ │
│  │(Metrics)  │ │(Dashboards)│ │(Tracing) │ │
│  └───────────┘ └──────────┘ └────────────┘ │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Loki     │ │ Alert    │ │  PagerDuty │ │
│  │  (Logs)   │ │ Manager  │ │  (Alerts)  │ │
│  └───────────┘ └──────────┘ └────────────┘ │
└─────────────────────────────────────────────┘

Key Metrics:
  - Request latency (P50, P95, P99)
  - Error rate (4xx, 5xx)
  - Active WebSocket connections
  - Message delivery rate
  - Sync queue depth
  - Mesh peer count
  - Storage utilization
```

### Deployment Architecture

```
┌─────────────────────────────────────────────┐
│              KUBERNETES CLUSTER               │
│  ┌─────────────────────────────────────────┐│
│  │           Ingress (nginx)                ││
│  └─────────────────┬───────────────────────┘│
│                    │                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Fastify │ │ Fastify │ │ Fastify │       │
│  │ (Pod 1) │ │ (Pod 2) │ │ (Pod 3) │       │
│  └────┬────┘ └────┬────┘ └────┬────┘       │
│       │            │            │             │
│  ┌────┴────────────┴────────────┴────┐       │
│  │         Service Mesh (Istio)       │       │
│  └────────────────┬───────────────────┘       │
│                   │                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │PostgreSQL│ │  Redis  │ │  MinIO  │       │
│  │(Managed) │ │(Managed)│ │(Managed)│       │
│  └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────┘
```

### Testing Requirements

- Load tests: k6 scripts for 10k concurrent users
- Security tests: OWASP Top 10, dependency scanning
- Chaos tests: Pod failure, network partition
- Regression tests: Full E2E suite on staging

### Success Criteria

- [ ] Security audit completed with no critical findings
- [ ] 10k concurrent users supported at P99 <200ms
- [ ] Monitoring dashboards show all critical metrics
- [ ] Deployment automated via Helm charts
- [ ] Documentation complete and published
- [ ] Open-source repo public with CLA and contributing guide
- [ ] All automated tests passing on CI

---

## Dependency Graph

```
                          ┌─────────────────┐
                          │   Phase 1:      │
                          │   Foundation    │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │   Phase 2:      │
                          │   Identity      │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
           ┌────────▼────────┐    │    ┌────────▼────────┐
           │   Phase 3:      │    │    │   Phase 5:      │
           │   Core Messaging│    │    │   File Sharing  │
           └────────┬────────┘    │    └────────┬────────┘
                    │              │              │
           ┌────────▼────────┐    │              │
           │   Phase 4:      │    │              │
           │   Encryption    │    │              │
           └────────┬────────┘    │              │
                    │              │              │
           ┌────────▼────────┐    │              │
           │   Phase 6:      │    │              │
           │   Offline-First │    │              │
           └────────┬────────┘    │              │
                    │              │              │
           ┌────────▼────────────────────────────▼────┐
           │           Phase 7: LAN Mesh (MVP)         │
           └────────────────────────┬────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Phase 8:        │
                          │   Clients         │
                          └─────────┬─────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Phase 9:        │
                          │   Production      │
                          └───────────────────┘
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Double Ratchet implementation bugs | Medium | High | Use established libraries (libsignal-protocol), extensive test suite |
| LAN mesh scalability limits | Medium | Medium | Start with 50-peer limit, optimize with gossip protocol |
| Cross-platform sync conflicts | High | Medium | CRDT-inspired merge, comprehensive conflict test suite |
| Key management complexity | Medium | High | Platform-native secure storage, extensive key lifecycle testing |
| Performance on low-end devices | Medium | Medium | Profiling from Phase 8 start, lazy loading, code splitting |
| Security vulnerabilities in crypto | Low | Critical | Use audited libraries, formal verification where possible |
| Scope creep in client phase | High | Medium | Strict MVP scope, defer advanced features to post-launch |

---

## Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| API P99 Latency | <200ms | Prometheus monitoring |
| Message Delivery | <50ms (LAN) | End-to-end timing |
| Sync Completion | <5s (1000 messages) | Sync engine benchmarks |
| Concurrent Connections | 1000 per instance | Load testing |
| Test Coverage | >90% | CI pipeline |
| Bundle Size (Web) | <200KB gzipped | Build output |

### Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Message | <30 seconds | Onboarding analytics |
| Offline Functionality | 100% features | Feature matrix |
| Cross-Platform Parity | 90%+ code sharing | Code analysis |
| Security Audit Pass | No critical findings | Third-party audit |
| Documentation Coverage | 100% API endpoints | Doc generation |

---

## Appendix: Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo Tool | Turborepo | Fast builds, incremental computation |
| Language | TypeScript (strict) | Type safety, shared between frontend/backend |
| Backend | Fastify | Performance, schema validation, plugin system |
| Database | PostgreSQL | ACID, JSON support, full-text search |
| Cache | Redis | Pub/sub, session store, rate limiting |
| Object Storage | MinIO | S3-compatible, self-hostable, encryption support |
| Web Framework | React + Vite | Fast HMR, modern build, ecosystem |
| Desktop | Tauri | Small binary, Rust security, WebView |
| Mobile | React Native | Code sharing with web, native performance |
| Encryption | Double Ratchet (X3DH) | Industry standard, forward secrecy |
| Mesh | UDP + TCP | UDP for discovery, TCP for reliable messaging |
| Local DB | SQLite / IndexedDB | Cross-platform, well-tested |

---

*This roadmap is a living document. Update as phases complete and new requirements emerge.*
