# DIPCHATS — SYSTEM ARCHITECTURE

## Pure Local Identity, Zero-Registration, Hybrid Online/Offline Communication Platform

**Project:** DipChats
**Architecture:** Modular, event-driven, offline-first, multi-transport
**Identity Model:** Pure local — no accounts, no passwords, no email, no phone number
**Primary Backend:** Node.js + TypeScript (Fastify)
**Primary Database:** PostgreSQL 16+ (Drizzle ORM)
**Cache/PubSub:** Redis 7+
**Object Storage:** MinIO
**Local Storage:** SQLite (mobile/desktop), IndexedDB (web)

---

# 1. Architecture Overview

DipChats is a communication platform that operates across two major network environments with a **pure local identity model** — no accounts, no passwords, no registration.

```text
ONLINE MODE                          OFFLINE MODE
Internet available                   No Internet
      │                                    │
      ▼                                    ▼
 Server-assisted                    Mesh peer-to-peer
 (WebSocket + REST)                 (LAN / BLE / Wi-Fi)
      │                                    │
      ▼                                    ▼
 PostgreSQL + Redis                 Local SQLite
      │                                    │
      └────────────┬───────────────────────┘
                   │
                   ▼
            Same Message Engine
                   │
                   ▼
              Client UI
```

The central architectural principle:

> **The messaging layer is independent from both the network transport and the identity layer.**

A message is represented identically whether delivered through:
- Internet (WebSocket relay)
- Local Wi-Fi (peer-to-peer)
- Bluetooth mesh (multi-hop relay)
- Store-and-forward (courier system)

---

# 2. Identity Model: Pure Local

## 2.1 No Accounts

DipChats has **no user accounts**. There is no:
- Login page
- Password
- Registration form
- Email requirement
- Phone number requirement
- Username database

Identity is a **device-generated cryptographic key pair** stored locally.

## 2.2 Onboarding Flow

```text
Open App
    │
    ▼
Enter Display Name (cosmetic only)
    │
    ▼
Tap "Join DipChats"
    │
    ▼
Device generates:
  ├── X25519 identity key pair
  ├── Ed25519 signing key pair
  ├── SHA-256 fingerprint
  └── 8-byte peer ID
    │
    ▼
Keys stored in secure enclave / OS keychain
    │
    ▼
Identity registered with server (public keys only)
    │
    ▼
Ready to chat
```

**Time from install to first message: < 3 seconds.**

## 2.3 Identity Structure

```text
Device Identity
├── identityKeyPair (X25519)
│   ├── privateKey: 32 bytes (never leaves device)
│   └── publicKey: 32 bytes (shared with server)
├── signingKeyPair (Ed25519)
│   ├── privateKey: 32 bytes (never leaves device)
│   └── publicKey: 32 bytes (shared with server)
├── fingerprint: SHA-256(identityPublicKey)
├── peerId: fingerprint[0:8]
├── displayName: user-chosen string
└── createdAt: timestamp
```

## 2.4 Multi-Device

Each device has its own independent identity. Multi-device use requires:
1. In-person QR code exchange (both devices scan each other)
2. Keys are shared peer-to-peer, never through the server
3. Each device can independently decrypt messages encrypted for the user

---

# 3. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         DIPCHATS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                       CLIENT LAYER                              │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Web    │  │ Desktop  │  │ Android  │  │   iOS    │       │
│  │ (React)  │  │ (Tauri)  │  │  (RN)   │  │  (RN)   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │             │             │               │
├───────┴─────────────┴─────────────┴─────────────┴───────────────┤
│                                                                 │
│                    CLIENT CORE (shared)                         │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Identity   │ │ Messaging  │ │ Crypto     │ │ Sync       │  │
│  │ Manager    │ │ Engine     │ │ Engine     │ │ Engine     │  │
│  └────────────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘  │
│                       │              │              │           │
│                 ┌─────┴──────────────┴──────────────┴─────┐    │
│                 │           Transport Layer                │    │
│                 └──────────────────┬───────────────────────┘    │
│                                    │                            │
│               ┌────────────────────┼────────────────────┐      │
│               │                    │                    │      │
│         ONLINE TRANSPORT      MESH TRANSPORT       LOCAL DB   │
│               │                    │                    │      │
├───────────────┼────────────────────┼────────────────────┼──────┤
│               │                    │                    │      │
│          INTERNET              LOCAL NETWORK        SQLite     │
│               │                    │               IndexedDB    │
│               ▼                    ▼                              │
│       ┌──────────────┐     ┌──────────────┐                     │
│       │ API Server   │     │ Peer Devices │                     │
│       └──────┬───────┘     └──────────────┘                     │
│              │                                                   │
│       ┌──────┴────────┐                                          │
│       │ WebSocket     │                                          │
│       │ Gateway       │                                          │
│       └──────┬────────┘                                          │
│              │                                                   │
├──────────────┼───────────────────────────────────────────────────┤
│              │             BACKEND                               │
│              ▼                                                   │
│       ┌───────────────┐                                          │
│       │ Message       │                                          │
│       │ Service       │                                          │
│       └───────┬───────┘                                          │
│               │                                                  │
│       ┌───────┼────────┐                                         │
│       ▼       ▼        ▼                                         │
│   PostgreSQL Redis   MinIO                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. Architectural Principles

## 4.1 Pure Local Identity

```text
Identity is generated on the device.
Identity is stored on the device.
Identity never leaves the device (only public keys are shared).
No server account exists.
No central authority controls identity.
```

## 4.2 Transport Independence

The messaging system does not directly depend on Bluetooth, WebSocket, Wi-Fi, or HTTP.

```text
Message Engine
      │
      ▼
Transport Interface
      │
  ┌───┼───────────────┐
  ▼   ▼               ▼
BLE  Wi-Fi        WebSocket
     Direct        (Server)
```

## 4.3 Offline First

The client can:
- Store messages locally
- Receive messages locally
- Queue outgoing messages
- Synchronize later
- Detect network changes
- Switch transports

Network failure does not cause UI failure.

## 4.4 Event Driven

Internal communication uses events:

```text
MESSAGE_CREATED        PEER_DISCOVERED
MESSAGE_SENT           PEER_CONNECTED
MESSAGE_RECEIVED       PEER_DISCONNECTED
MESSAGE_DELIVERED      PRESENCE_CHANGED
MESSAGE_READ           NETWORK_ONLINE
                       NETWORK_OFFLINE
                       SYNC_STARTED
                       SYNC_COMPLETED
```

## 4.5 Secure by Design

Security at every layer:

```text
Device Identity (local keys)
      ↓
Transport Encryption (Noise XX / TLS)
      ↓
Message Encryption (Double Ratchet)
      ↓
Storage Encryption (at rest)
```

## 4.6 Horizontally Scalable

```text
             Load Balancer
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      Node 1    Node 2    Node 3
        │         │         │
        └─────────┼─────────┘
                  ▼
                Redis
                  │
                  ▼
              PostgreSQL
```

---

# 5. Client Architecture

Each DipChats client contains independent modules:

```text
Client
│
├── Identity Manager
│   ├── Key generation
│   ├── Key storage
│   ├── Fingerprint management
│   └── Display name
│
├── Crypto Engine
│   ├── Double Ratchet
│   ├── Key exchange
│   ├── Encryption/decryption
│   ├── Signature verification
│   └── Session management
│
├── Messaging Engine
│   ├── Message creation
│   ├── Message validation
│   ├── Message routing
│   ├── Message queue
│   └── Deduplication
│
├── Conversation Manager
│   ├── Channels
│   ├── Direct messages
│   ├── Threads
│   └── Message history
│
├── Transport Layer
│   ├── Transport Manager
│   ├── Network State Manager
│   ├── Online Transport
│   └── Mesh Transport
│
├── Sync Engine
│   ├── Server sync
│   ├── Mesh sync
│   ├── Conflict resolution
│   └── Cursor management
│
├── Local Database
│   ├── Message store
│   ├── Contact store
│   ├── Session store
│   ├── Pending queue
│   └── Courier queue
│
├── File Manager
│   ├── Upload/download
│   ├── Chunking
│   ├── Encryption
│   └── Preview generation
│
├── Presence Manager
│   ├── Online status
│   ├── Typing indicators
│   └── Last seen
│
└── UI Layer
    ├── Navigation
    ├── Chat views
    ├── Settings
    └── Notifications
```

---

# 6. Message Lifecycle

## 6.1 Message States

```text
CREATED
   │
   ▼
PENDING
   │
   ├── (online) ──► SENDING ──► SENT ──► DELIVERED ──► READ
   │
   ├── (offline) ──► QUEUED_OFFLINE ──► (connect) ──► SYNCING ──► SYNCED
   │
   └── (mesh) ──► ENCRYPTING ──► RELAYING ──► DELIVERED
```

## 6.2 Message Flow — Online

```text
User types message
       │
       ▼
Message Engine
       │
       ├── Generate client_message_id (ULID)
       ├── Validate content
       ├── Encrypt (Double Ratchet)
       │
       ▼
Transport Layer
       │
       ├── WebSocket: message.send
       │
       ▼
Server
       │
       ├── Validate
       ├── Authorize
       ├── Persist ciphertext
       ├── Publish to Redis
       │
       ▼
Recipient Device(s)
       │
       ├── Receive ciphertext
       ├── Decrypt (Double Ratchet)
       ├── Store locally
       │
       ▼
Delivery Receipt → Read Receipt
```

## 6.3 Message Flow — Mesh

```text
User types message
       │
       ▼
Message Engine
       │
       ├── Generate client_message_id (ULID)
       ├── Validate content
       ├── Encrypt (Double Ratchet or static key for courier)
       │
       ▼
Mesh Transport
       │
       ├── Wrap in mesh packet
       ├── Sign with Ed25519
       │
       ├── (direct) ──► Send to peer ──► ACK
       │
       ├── (relay) ──► Forward ──► Relay ──► Destination
       │
       └── (store-and-forward) ──► Seal envelope ──► Courier
       │
       ▼
Recipient
       │
       ├── Verify signature
       ├── Decrypt
       ├── Store locally
       │
       ▼
ACK propagated back
```

---

# 7. Transport Layer

## 7.1 Transport Interface

```typescript
interface Transport {
  name: string;
  isAvailable(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(peerId: string, data: Uint8Array): Promise<void>;
  onReceive(handler: (peerId: string, data: Uint8Array) => void): void;
  getCapabilities(): TransportCapabilities;
}

interface TransportCapabilities {
  maxPayloadSize: number;     // bytes
  supportsEncryption: boolean;
  supportsRelay: boolean;
  bandwidth: 'low' | 'medium' | 'high';
  latency: 'low' | 'medium' | 'high';
  batteryCost: 'low' | 'medium' | 'high';
}
```

## 7.2 Concrete Transports

```text
Transport
├── WebSocketTransport          (online, server-relayed)
├── LocalNetworkTransport       (LAN, TCP/WebSocket peer)
├── BluetoothTransport          (BLE mesh, v2)
├── WiFiDirectTransport         (Wi-Fi Direct, v2)
├── WebRTCTransport             (browser P2P, v2)
└── MeshTransport               (orchestrates above for offline)
```

## 7.3 Transport Selection

```text
Transport Manager
       │
       ├── Check network state
       │   ├── ONLINE ──► Prefer WebSocket
       │   ├── LOCAL_NETWORK ──► Prefer LocalNetwork
       │   ├── MESH ──► Prefer Mesh
       │   └── OFFLINE ──► Queue locally
       │
       ├── Check message requirements
       │   ├── Small text ──► Any transport
       │   ├── Large file ──► Prefer high-bandwidth
       │   └── Urgent ──► Prefer lowest latency
       │
       └── Select best available
```

---

# 8. Server Architecture

The server is a **minimal relay and store**. It does NOT:
- Decrypt messages
- Store private keys
- Generate user accounts
- Control identity

It DOES:
- Store encrypted ciphertext
- Relay messages between connected devices
- Manage channel membership
- Handle presence
- Serve file attachments
- Provide sync cursors

## 8.1 Service Modules

```text
Backend (Modular Monolith)
│
├── API Gateway (Fastify)
│   ├── Routing
│   ├── Authentication middleware
│   ├── Validation
│   ├── Rate limiting
│   └── Error handling
│
├── WebSocket Gateway
│   ├── Connection management
│   ├── Authentication
│   ├── Event routing
│   └── Heartbeat
│
├── Device Service
│   ├── Device registration
│   ├── Public key storage
│   ├── Session management
│   └── Device revocation
│
├── Channel Service
│   ├── Channel CRUD
│   ├── Membership management
│   ├── Role permissions
│   └── Channel settings
│
├── Message Service
│   ├── Message persistence
│   ├── Fan-out delivery
│   ├── Reaction management
│   ├── Reply threading
│   └── Message editing/deletion
│
├── Presence Service
│   ├── Redis-backed presence
│   ├── Typing indicators
│   └── Last seen tracking
│
├── File Service
│   ├── Upload handling
│   ├── Signed URL generation
│   ├── File validation
│   └── Preview generation
│
├── Sync Service
│   ├── Cursor management
│   ├── Missing message detection
│   └── Conflict resolution
│
└── Notification Service
    ├── Push notification triggers
    ├── Web notification
    └── Platform notification
```

## 8.2 Server Request Flow

```text
Client Request
       │
       ▼
API Gateway (Fastify)
       │
       ├── Parse request
       ├── Validate version header
       │
       ▼
Authentication Middleware
       │
       ├── Verify device signature (Ed25519)
       ├── Validate session token
       ├── Check device status
       │
       ▼
Rate Limiter
       │
       ├── Check IP limit
       ├── Check device limit
       ├── Check endpoint limit
       │
       ▼
Route Handler
       │
       ├── Parse payload
       ├── Authorize (channel membership)
       ├── Execute business logic
       │
       ▼
Persistence
       │
       ├── PostgreSQL (ciphertext)
       ├── Redis (ephemeral state)
       ├── MinIO (files)
       │
       ▼
Event Publishing
       │
       ├── Redis Pub/Sub
       ├── WebSocket fan-out
       ├── Notification trigger
       │
       ▼
Response
```

---

# 9. Online Mode

## 9.1 WebSocket Connection

```text
Client                                    Server
  │                                         │
  │  1. Connect:                            │
  │     wss://server.example.com/ws         │
  │                                         │
  │  2. Server sends: connection.ready      │
  │                                         │
  │  3. Client authenticates:               │
  │     - Sign nonce with Ed25519           │
  │     - Send device_id + signature        │
  │                                         │
  │  4. Server validates, issues token      │
  │                                         │
  │  5. Client subscribes to channels       │
  │                                         │
  │  6. Real-time messaging begins          │
  │                                         │
  │  7. Heartbeat every 30s                 │
  │                                         │
  │  8. On disconnect: reconnect with       │
  │     exponential backoff                 │
  │                                         │
```

## 9.2 HTTP API

```text
Used for operations better suited to request/response:

Authentication    POST /auth/challenge
                  POST /auth/verify

Channels          GET    /channels
                  POST   /channels
                  GET    /channels/:id
                  PATCH  /channels/:id
                  DELETE /channels/:id
                  POST   /channels/:id/join
                  POST   /channels/:id/leave
                  GET    /channels/:id/members

Messages          GET    /channels/:id/messages
                  POST   /channels/:id/messages
                  PATCH  /messages/:id
                  DELETE /messages/:id

Files             POST   /files/upload
                  GET    /files/:id
                  DELETE /files/:id

Devices           POST   /devices/register
                  GET    /devices
                  DELETE /devices/:id

Sync              GET    /sync/cursor
                  POST   /sync/request
```

---

# 10. Offline Mode

## 10.1 Mesh Network

When Internet is unavailable, DipChats switches to mesh mode:

```text
Internet lost
      │
      ▼
Network State Manager
      │
      ▼
Enable Mesh Transport
      │
      ├── Start peer discovery
      │   ├── LAN broadcast
      │   ├── BLE scan (v2)
      │   └── Wi-Fi Direct (v2)
      │
      ├── Connect to discovered peers
      │
      └── Begin mesh messaging
```

## 10.2 Store-and-Forward (Couriers)

When the destination is not reachable:

```text
Sender
  │
  ├── Recipient not in mesh
  │
  ▼
Seal courier envelope
  │
  ├── Encrypt to recipient's static key
  ├── Generate daily HMAC recipient tag
  │
  ▼
Hand to courier peers
  │
  ├── Spray to 1-3 connected peers
  ├── Each courier carries envelope
  │
  ▼
Courier encounters recipient
  │
  ├── Deliver envelope
  ├── Remove from courier queue
  │
  ▼
Recipient decrypts
```

## 10.3 Hybrid Mode

Online and mesh operate simultaneously:

```text
┌─────────────────────────────────────────────┐
│              HYBRID MODE                     │
│                                             │
│  ┌──────────────┐    ┌──────────────┐       │
│  │   ONLINE     │    │    MESH      │       │
│  │              │    │              │       │
│  │  WebSocket   │    │  LAN/BLE     │       │
│  │  to server   │    │  to peers    │       │
│  │              │    │              │       │
│  └──────┬───────┘    └──────┬───────┘       │
│         │                   │               │
│         └─────────┬─────────┘               │
│                   │                         │
│         ┌─────────┴─────────┐               │
│         │  Message Router   │               │
│         │                   │               │
│         │  Best transport   │               │
│         │  for each message │               │
│         └───────────────────┘               │
└─────────────────────────────────────────────┘
```

Message routing priority:
1. WebSocket (if server available and recipient online)
2. Direct peer (if recipient in mesh)
3. Relay (if recipient reachable through intermediaries)
4. Store-and-forward (courier if no route available)
5. Local queue (retry later)

---

# 11. Encryption Architecture

## 11.1 Online Path

```text
Client A                                    Client B
  │                                           │
  │  1. Fetch B's public key from server      │
  │     (server has only public keys)         │
  │                                           │
  │  2. Double Ratchet session                │
  │                                           │
  │  3. Encrypt: ciphertext = encrypt(        │
  │       ratchet_key, message                │
  │     )                                     │
  │                                           │
  │  4. Send ciphertext to server             │
  │     (server stores, cannot decrypt)       │
  │                                           │
  │  5. Server forwards to B's devices        │
  │                                           │
  │  6. B decrypts with session state         │
  │                                           │
```

## 11.2 Mesh Path

```text
Alice                 Relay                 Bob
  │                     │                     │
  │  Encrypted for Bob  │                     │
  │  ───────────────────│─────────────────────│
  │                     │                     │
  │  Relay cannot read  │  Relay cannot read  │
  │                     │                     │
  │                     │  Bob decrypts       │
  │                     │                     │
```

## 11.3 Courier Path

```text
Alice              Courier C              Courier D              Bob
  │                    │                     │                    │
  │  Sealed envelope   │                     │                    │
  │  ──────────────────│                     │                    │
  │                    │  Spray copy         │                    │
  │                    │  ───────────────────│                    │
  │                    │                     │  When Bob appears  │
  │                    │                     │  ──────────────────│
  │                    │                     │                    │
  │  Couriers cannot   │                     │  Bob decrypts     │
  │  read content      │                     │                    │
```

---

# 12. Synchronization

## 12.1 Server Sync

When reconnecting after offline:

```text
Client                                    Server
  │                                         │
  │  1. Connect + authenticate              │
  │                                         │
  │  2. Send last_sync_cursor               │
  │                                         │
  │  3. Server returns missing events:      │
  │     - Messages since cursor             │
  │     - Channel changes                   │
  │     - Presence updates                  │
  │                                         │
  │  4. Client applies events locally       │
  │                                         │
  │  5. Client sends pending offline msgs   │
  │                                         │
  │  6. Server deduplicates                 │
  │                                         │
  │  7. Server broadcasts to other devices  │
  │                                         │
  │  8. Cursor updated                      │
  │                                         │
```

## 12.2 Mesh Sync

When peers connect in mesh mode:

```text
Peer A                                  Peer B
  │                                       │
  │  1. Exchange inventories:             │
  │     - Known message IDs               │
  │     - Channel cursors                 │
  │                                       │
  │  2. Compare:                          │
  │     A has: msg_1, msg_2, msg_3        │
  │     B has: msg_1, msg_2, msg_4        │
  │                                       │
  │  3. Exchange missing:                 │
  │     A sends msg_3 to B                │
  │     B sends msg_4 to A                │
  │                                       │
  │  4. Update cursors                    │
  │                                       │
```

## 12.3 Conflict Resolution

```text
Conflict type             Resolution
───────────────────────────────────────────────
Same message, two edits  Last-writer-wins (timestamp + device_id tiebreak)
Same message, two deletes Deletion wins
Message ordering          Server sequence number (online) or ULID (offline)
Duplicate messages        client_message_id deduplication
```

---

# 13. File Sharing

## 13.1 Online Upload

```text
Client
  │
  ├── Select file
  ├── Validate (size, type)
  ├── Generate SHA-256 hash
  │
  ▼
POST /files/upload
  │
  ├── Server validates
  ├── Server creates attachment record
  ├── Server returns signed upload URL
  │
  ▼
PUT signed_url
  │
  ├── Upload to MinIO
  │
  ▼
POST /channels/:id/messages
  │
  ├── Include attachment metadata
  ├── Message content encrypted
  │
  ▼
Recipients receive encrypted metadata
  │
  ▼
GET /files/:id (with signed download URL)
  │
  ├── Download file
  ├── Verify SHA-256 hash
  │
  ▼
Decrypt (if E2E encrypted)
```

## 13.2 Mesh File Transfer

```text
Sender
  │
  ├── Select file
  ├── Chunk file (469-byte chunks for BLE, larger for LAN)
  ├── Encrypt each chunk
  │
  ▼
Transfer chunks to peer
  │
  ├── Direct transfer (if peer connected)
  ├── Relay transfer (if multi-hop)
  │
  ▼
Recipient
  │
  ├── Receive chunks
  ├── Reassemble
  ├── Verify SHA-256 hash
  ├── Decrypt
  │
  ▼
File ready
```

---

# 14. Notification Architecture

```text
Message Created
      │
      ▼
Event Bus (Redis Pub/Sub)
      │
      ├── WebSocket fan-out (connected devices)
      │
      ├── Push notification (offline devices)
      │   ├── iOS: APNs
      │   ├── Android: FCM
      │   └── Web: Web Push API
      │
      └── Local notification (if app in background)
```

---

# 15. Error Handling

```text
All services use structured errors:

{
  "error": {
    "code": "MESSAGE_NOT_AUTHORIZED",
    "message": "You cannot send messages to this channel",
    "request_id": "req_123"
  }
}

Machine-readable codes:
  AUTH_REQUIRED
  AUTH_INVALID_TOKEN
  AUTH_EXPIRED
  PERMISSION_DENIED
  MESSAGE_NOT_FOUND
  MESSAGE_INVALID
  CHANNEL_NOT_FOUND
  RATE_LIMITED
  PAYLOAD_TOO_LARGE
  UNSUPPORTED_VERSION
```

Never expose:
- Stack traces
- Database errors
- Secrets
- Internal infrastructure

---

# 16. Docker Architecture

```text
docker-compose.yml

Services:
  web:
    build: apps/web
    ports: ["3000:3000"]
    depends_on: [server]

  server:
    build: apps/server
    ports: ["4000:4000", "4001:4001"]  # HTTP + WebSocket
    depends_on: [postgres, redis, minio]

  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redisdata:/data]

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
    volumes: [miniodata:/data]

volumes:
  pgdata:
  redisdata:
  miniodata:
```

---

# 17. Monorepo Structure

```text
dipchats/
│
├── apps/
│   ├── server/                    # Node.js + Fastify backend
│   │   ├── src/
│   │   │   ├── api/               # REST routes
│   │   │   ├── websocket/         # WebSocket gateway
│   │   │   ├── auth/              # Device authentication
│   │   │   ├── channels/          # Channel management
│   │   │   ├── messages/          # Message persistence
│   │   │   ├── presence/          # Presence service
│   │   │   ├── files/             # File handling
│   │   │   ├── sync/              # Synchronization
│   │   │   └── notifications/     # Push notifications
│   │   ├── drizzle/               # Database migrations
│   │   └── tests/
│   │
│   ├── web/                       # React + Vite + TypeScript
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── lib/
│   │   └── public/
│   │
│   ├── mobile/                    # React Native
│   │   ├── src/
│   │   └── android/ + ios/
│   │
│   └── desktop/                   # Tauri
│       ├── src-tauri/
│       └── src/
│
├── packages/
│   ├── protocol/                  # Message protocol types
│   ├── crypto/                    # Encryption/decryption
│   ├── messaging/                 # Message engine
│   ├── mesh/                      # Mesh networking
│   ├── transport/                 # Transport abstraction
│   ├── database/                  # Client database
│   └── shared/                    # Shared utilities
│
├── docs/                          # Specifications
│
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

# 18. Dependency Rules

```text
UI
 ↓
Application
 ↓
Domain (Message Engine, Crypto, Mesh)
 ↓
Infrastructure (Database, Transport, Network)

The domain layer never depends on:
  - PostgreSQL
  - Redis
  - Bluetooth APIs
  - WebSocket library
  - React / React Native
```

---

# 19. Scalability Strategy

## Phase 1: Modular Monolith

```text
All services in one process:
  API + WebSocket + Auth + Messages + Channels + Presence
  Single PostgreSQL + Redis
  Suitable for < 10,000 concurrent users
```

## Phase 2: Horizontal Scaling

```text
             Load Balancer
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      WS #1     WS #2     WS #3
        │         │         │
        └─────────┼─────────┘
                  ▼
              Redis Cluster
                  │
                  ▼
          PostgreSQL (read replicas)
```

## Phase 3: Service Separation

```text
API Service
Auth Service
Message Service
Presence Service
File Service
Sync Service

Each independently deployable and scalable
```

---

# 20. Observability

```text
Structured Logs
  - JSON format
  - Request ID correlation
  - Never log tokens, keys, or message content

Metrics
  - websocket_connections
  - messages_per_second
  - message_latency
  - presence_updates
  - mesh_peers
  - sync_duration
  - database_latency

Health Checks
  GET /health
  GET /ready
  GET /metrics

Tracing
  - OpenTelemetry hooks
  - Request ID propagation
```

---

# 21. Non-Negotiable Architecture Rules

1. **Never couple the message engine to a networking technology.**
2. **Never assume Internet connectivity.**
3. **Never treat timestamps as the only message identity/order mechanism.**
4. **Never trust mesh peers.**
5. **Never store plaintext passwords (none should exist).**
6. **Never implement custom cryptography.**
7. **Never send large files through WebSockets unnecessarily.**
8. **Never use Redis as the permanent message database.**
9. **Never acknowledge durable storage before persistence succeeds.**
10. **Never fake unsupported offline networking capabilities.**
11. **Never expose private keys or authentication secrets in logs.**
12. **Never allow unlimited mesh relaying or storage.**
13. **Never allow duplicate synchronization to create duplicate logical messages.**
14. **Keep platform-specific peer-to-peer code behind transport interfaces.**
15. **Keep the core messaging model identical across online and offline modes.**
16. **Never require account creation to use the application.**
17. **Never transmit private keys over any network.**

---

# 22. Architecture Goal

```text
                    SAME MESSAGE ENGINE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
      INTERNET         NO INTERNET       MESH
          │                │                │
      WebSocket         Local peers    Multi-hop
          │                │                │
          ▼                ▼                ▼
      Server            Direct          Relay
          │                │                │
          └────────────────┼────────────────┘
                           │
                     Local Message Store
                           │
                           ▼
                      Decrypted Locally
                           │
                           ▼
                         Chat UI
```

**One messaging system. Pure local identity. Multiple transports. Online when possible. Offline when necessary.**
