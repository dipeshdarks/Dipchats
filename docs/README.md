# DIPCHATS

### Real-Time Chat + Offline Mesh Messaging

**DipChats** is an open-source, real-time communication platform designed to work **with or without the Internet**.

It combines modern WebSocket-based messaging with an offline peer-to-peer mesh network, allowing nearby DipChats devices to exchange messages using available local transports such as Bluetooth and Wi-Fi-based peer-to-peer connections.

> **Chat online. Chat nearby. Keep communicating when the Internet is gone.**

---

## Features

### Real-Time Messaging

- Real-time WebSocket communication
- Direct messages
- Public channels
- Private channels
- Group conversations
- Message history
- Message editing
- Message deletion
- Message replies
- Emoji and reactions
- Mentions
- Typing indicators
- Read receipts
- Delivery receipts

### Pure Local Identity

DipChats uses a **pure local identity model**. There are no accounts, no passwords, no registration, no login, no email, and no phone number.

Every device generates its own cryptographic key pair at first launch. The public key is the device identity. The private key never leaves the device.

- Device-generated Ed25519 signing keys
- Device-generated X25519 identity keys
- No server-side credential storage
- No centralized account system
- Challenge-response authentication
- Key rotation and revocation
- Multi-device support via independent key pairs

Onboarding:

```text
Enter Display Name
       │
       ▼
  Join DipChats
       │
       ▼
 Generate Keys
       │
       ▼
    Ready
```

No forms. No passwords. No accounts. Just a display name and a locally generated key pair.

### Presence

Real-time user presence:

- Online
- Offline
- Idle
- Do Not Disturb
- Invisible
- Last seen
- Device presence

### File Sharing

Send files directly inside conversations.

Supported architecture includes:

- Images
- Videos
- Audio
- Documents
- PDFs
- ZIP files
- Other attachments

Large files are uploaded through object storage instead of being transmitted through WebSockets.

### Privacy & Security

DipChats is designed around privacy.

The architecture supports:

- TLS
- Secure WebSockets
- Device identity via Ed25519 key pairs
- Public/private keys
- End-to-end encrypted private messages (Double Ratchet)
- Secure local storage
- Device revocation
- Block/mute controls
- Replay protection
- Rate limiting
- Message validation
- Panic wipe

### Offline Mesh Messaging

The major DipChats feature.

Messages can travel between nearby DipChats devices without requiring:

- Internet
- Cellular data
- A central server

Example:

```text
Phone A
   |
   v
Phone B
   |
   v
Phone C
   |
   v
Phone D
```

If A cannot directly reach D, nearby devices can act as relays.

DipChats uses a transport abstraction so different platforms can use different peer-to-peer technologies.

Potential transports include:

- Bluetooth Low Energy
- Bluetooth Classic where supported
- Wi-Fi Direct
- Wi-Fi Aware
- Local Wi-Fi
- Platform-specific peer-to-peer APIs

The application must never assume that every transport is available on every operating system.

---

# Architecture

DipChats is divided into independent layers.

```text
                    DIPCHATS
                       │
        ┌──────────────┴──────────────┐
        │                             │
     ONLINE                         OFFLINE
        │                             │
        ▼                             ▼
   WebSocket                      Mesh Network
        │                             │
        ▼                             ▼
 Message Engine ◄──────────────► Transport Layer
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
                Local Message Store
                       │
                       ▼
                 Sync Engine
                       │
              ┌────────┴────────┐
              ▼                 ▼
          PostgreSQL           Redis
```

The most important architectural principle is:

> **The message engine must not care whether a message was delivered through the Internet or through a local mesh.**

Full architecture details are documented in:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture, module boundaries, and data flow

---

# Online Mode

When Internet connectivity is available:

```text
Client
  │
  │ HTTPS / WSS
  ▼
API + WebSocket Server
  │
  ├── Authentication (Ed25519 challenge-response)
  ├── Presence
  ├── Channels
  ├── Messaging
  ├── File API
  └── Synchronization
  │
  ├──────────────┐
  ▼              ▼
PostgreSQL      Redis
```

WebSocket connections provide real-time communication.

Example:

```text
wss://server.example.com/ws
```

---

# Offline Mode

When Internet connectivity disappears:

```text
                 INTERNET OFF
                       │
                       ▼
               DipChats detects loss
                       │
                       ▼
               Enable Mesh Mode
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        Peer Discovery      Local Queue
             │                   │
             ▼                   ▼
        Nearby Devices      Pending Messages
             │                   │
             └─────────┬─────────┘
                       ▼
                   Mesh Relay
```

Messages can be stored locally and forwarded when another suitable peer becomes available.

---

# Online → Offline → Online

DipChats should seamlessly transition between network states.

### Online

```text
Client → WebSocket Server → Recipient
```

### Internet disappears

```text
Client → Local Queue → Nearby Peer
```

### Mesh available

```text
Client → Peer → Peer → Recipient
```

### Internet returns

```text
Local Messages
      ↓
Sync Engine
      ↓
Server
      ↓
Deduplication
      ↓
PostgreSQL
      ↓
Other Devices
```

The application must prevent duplicate messages during synchronization.

---

# Project Structure

Recommended monorepo:

```text
dipchats/
│
├── apps/
│   ├── server/
│   ├── web/
│   ├── desktop/
│   └── mobile/
│
├── packages/
│   ├── protocol/
│   ├── crypto/
│   ├── database/
│   ├── messaging/
│   ├── mesh/
│   ├── transport/
│   └── shared/
│
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── WEBSOCKET_PROTOCOL.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── SECURITY.md
│   ├── NETWORKING.md
│   ├── MESH_NETWORK.md
│   ├── PRODUCTION.md
│   ├── MVP.md
│   ├── RISKS.md
│   ├── UI_UX_DESIGN.md
│   └── ROADMAP.md
│
├── tests/
│
├── docker-compose.yml
├── .env.example
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

# Technology Stack

The initial implementation should use:

### Backend

- Node.js
- TypeScript
- Fastify
- WebSocket (`ws`)
- PostgreSQL 16+
- Redis 7+
- MinIO (object storage)
- Docker

### Frontend

The client architecture should support:

- Web (React + Vite + Tailwind)
- Desktop (Tauri)
- Mobile (React Native)

The shared packages should contain the common:

- Message models
- Protocol
- Validation
- Encryption interfaces
- Synchronization logic

Platform-specific networking should remain inside the transport layer.

---

# Getting Started

## Requirements

Install:

- Node.js
- npm
- Docker
- Docker Compose
- Git

Recommended Node.js version:

```text
Node.js 22+
```

---

## Clone the Repository

```bash
git clone https://github.com/dipeshdarks/dipchats.git
cd dipchats
```

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment

Copy:

```bash
cp .env.example .env
```

Configure:

```env
DATABASE_URL=
REDIS_URL=

MINIO_ENDPOINT=
MINIO_BUCKET=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
```

Never commit the real `.env` file.

---

# Start Infrastructure

Start PostgreSQL, Redis and other development services:

```bash
docker compose up -d
```

Check running containers:

```bash
docker compose ps
```

---

# Start Development Server

```bash
npm run dev
```

The development environment should start:

```text
API Server
WebSocket Server
Database
Redis
```

---

# Run Tests

Run unit tests:

```bash
npm test
```

Run integration tests:

```bash
npm run test:integration
```

Run linting:

```bash
npm run lint
```

Run type checking:

```bash
npm run typecheck
```

---

# WebSocket Example

Connect to the WebSocket server:

```text
wss://server.example.com/ws
```

## Step 1 — Register Device Public Key

On first connection, the device registers its Ed25519 public key:

```json
{
  "version": 1,
  "type": "auth.register",
  "request_id": "req_reg_001",
  "payload": {
    "device_id": "device_a1b2c3",
    "public_key": "Ed25519PublicKeyBase64...",
    "display_name": "Alice Phone",
    "device_type": "mobile"
  }
}
```

## Step 2 — Request Authentication Challenge

```json
{
  "version": 1,
  "type": "auth.challenge_request",
  "request_id": "req_ch_001",
  "payload": {
    "device_id": "device_a1b2c3"
  }
}
```

## Step 3 — Server Responds with Challenge

```json
{
  "version": 1,
  "type": "auth.challenge",
  "request_id": "req_ch_001",
  "timestamp": "2026-08-21T12:00:01.000Z",
  "payload": {
    "challenge": "random_nonce_base64_128bit",
    "expires_at": "2026-08-21T12:00:31.000Z"
  }
}
```

## Step 4 — Sign Challenge and Authenticate

The client signs the challenge with its Ed25519 private key:

```text
SHA-512("DipChats Auth v1" || challenge || connection_id)
```

```json
{
  "version": 1,
  "type": "auth.authenticate",
  "request_id": "req_auth_001",
  "payload": {
    "device_id": "device_a1b2c3",
    "signature": "Ed25519SignatureBase64...",
    "connection_id": "conn_123"
  }
}
```

## Step 5 — Authenticated

```json
{
  "version": 1,
  "type": "auth.authenticated",
  "request_id": "req_auth_001",
  "timestamp": "2026-08-21T12:00:02.000Z",
  "payload": {
    "device_id": "device_a1b2c3",
    "session_token": "session_jwt_token",
    "expires_at": "2026-08-21T12:10:02.000Z"
  }
}
```

## Step 6 — Send a Message

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "uuid",
  "payload": {
    "channel_id": "channel_123",
    "content": "Hello from DipChats!"
  }
}
```

The complete protocol is documented in:

- [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) — WebSocket events, payloads, authentication, and synchronization

---

# Device Identity

Every installation generates a unique device identity:

```text
On First Launch
    │
    ├── Generate X25519 key pair (identity key)
    │       private_key: 32 bytes random
    │       public_key:  curve25519_scalarmult_base(private_key)
    │
    ├── Generate Ed25519 key pair (signing key)
    │       private_key: 32 bytes random
    │       public_key:  ed25519_sk2pk(private_key)
    │
    ├── Derive device fingerprint
    │       fingerprint: SHA-256(identity_public_key)
    │
    └── Derive short peer ID
            peer_id: fingerprint[0:8]
```

This allows DipChats to support multiple devices per user, each with its own independent key pair.

Example:

```text
User
├── Windows PC
│   └── device_id + Ed25519 key pair
│
├── Android Phone
│   └── device_id + Ed25519 key pair
│
└── Laptop
    └── device_id + Ed25519 key pair
```

---

# Mesh Network

The mesh system is built around a transport abstraction.

```text
Mesh Engine
     │
     ├── Bluetooth
     ├── Wi-Fi Direct
     ├── Wi-Fi Aware
     ├── Local Network
     └── Future Transports
```

The mesh system supports:

- Peer discovery
- Direct peer communication
- Message relaying
- Store-and-forward
- TTL
- Hop limits
- Duplicate detection
- Delivery acknowledgements
- Offline queues

Full mesh specification:

- [MESH_NETWORK.md](./MESH_NETWORK.md) — Mesh networking protocol, relay model, and transport abstraction
- [NETWORKING.md](./NETWORKING.md) — Transport abstraction, mode selection, and network state management

---

# Security Model

Security is a core part of DipChats.

Private communication should be designed so that relay devices cannot read message contents.

Example:

```text
Sender
   │
   │ encrypted message
   ▼
Relay A
   │
   │ encrypted message
   ▼
Relay B
   │
   │ encrypted message
   ▼
Recipient
   │
   ▼
Decrypt
```

Relay devices should only handle routing metadata necessary for delivery.

Full security architecture:

- [SECURITY.md](./SECURITY.md) — Cryptographic identity, end-to-end encryption, key management, and threat model

---

# Core Database

The primary database is PostgreSQL.

Important tables:

```text
users
devices
sessions

channels
channel_members

messages
message_reactions
message_replies
read_receipts

attachments

blocks
user_settings

encryption_keys
device_keys

mesh_messages
mesh_peers
```

Redis is intended for temporary/high-speed state such as:

```text
presence
typing indicators
WebSocket sessions
rate limits
pub/sub
temporary synchronization state
```

Full database specification:

- [DATABASE.md](./DATABASE.md) — PostgreSQL schema, indexes, constraints, and relationships

---

# File Sharing

Large files should not be transmitted through WebSockets.

Instead:

```text
Client
  │
  │ Upload request
  ▼
API
  │
  │ Signed URL
  ▼
Object Storage (MinIO)
```

The resulting attachment metadata is then sent through the messaging system.

Each file should have:

```text
file_id
filename
mime_type
size
sha256
storage_reference
created_at
```

---

# Presence

Presence states:

```text
ONLINE
IDLE
DND
OFFLINE
INVISIBLE
```

Presence is ephemeral and should not unnecessarily generate large database workloads.

---

# Security Requirements

The production implementation must include:

- TLS 1.3
- Secure WebSockets
- Ed25519 challenge-response authentication
- Authorization
- Rate limiting
- Input validation
- File validation
- Replay protection
- Device revocation
- Secure key storage (Keychain / Secure Enclave)
- Message deduplication
- Secure local storage
- Privacy controls
- Panic wipe

Never implement custom cryptography when a well-established cryptographic library or protocol can be used.

All cryptographic primitives come from Libsodium:

- X25519 — key agreement
- Ed25519 — digital signatures
- ChaCha20-Poly1305 — symmetric encryption
- XChaCha20-Poly1305 — extended nonce encryption
- HKDF-SHA256 — key derivation

---

# Testing Strategy

DipChats requires testing at multiple levels.

## Unit Tests

Test:

- Challenge-response authentication
- Message validation
- Encryption interfaces
- Message ordering
- Deduplication
- TTL
- Routing
- File validation

## Integration Tests

Test:

```text
Client A
   ↓
WebSocket Server
   ↓
Client B
```

and:

```text
Client A
   ↓
Mesh Peer B
   ↓
Mesh Peer C
   ↓
Client D
```

## Failure Tests

Simulate:

- Internet disconnect
- WebSocket disconnect
- Server restart
- Peer disappearance
- Duplicate packets
- Expired packets
- Invalid packets
- Slow networks
- Large files
- Multiple simultaneous users

---

# Scalability

The WebSocket architecture should support horizontal scaling:

```text
                 Load Balancer
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     WS Server     WS Server     WS Server
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                    Redis
                      │
                      ▼
                  PostgreSQL
```

The implementation should be load-tested before making specific scalability claims.

Full production deployment details:

- [PRODUCTION.md](./PRODUCTION.md) — Multi-node, load-balanced, cloud-native production architecture

---

# Roadmap

The development roadmap is maintained separately with detailed phase descriptions, dependency graphs, and timeline.

- [ROADMAP.md](./ROADMAP.md) — Full development roadmap with phases, timeline, and dependency graph

## Phase Summary

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Foundation | Monorepo, TypeScript, server, database, Docker |
| 2 | Identity & Auth | Pure local identity, Ed25519 keys, challenge-response |
| 3 | Core Messaging | WebSocket gateway, channels, DMs, presence |
| 4 | Encryption | Double Ratchet, E2E encryption, key rotation |
| 5 | File Sharing | Upload API, MinIO, signed URLs, validation |
| 6 | Offline-First | Local database, sync, conflict handling |
| 7 | LAN Mesh (MVP) | Transport abstraction, peer discovery, relay |
| 8 | Clients | Web (React), Desktop (Tauri), Mobile (React Native) |
| 9 | Production | Security audit, load testing, monitoring, deployment |

---

# Project Goal

DipChats is not intended to be just another WebSocket chat demo.

The goal is to create a complete communication platform where:

```text
              DIPCHATS
                  │
        ┌─────────┴─────────┐
        │                   │
     INTERNET            NO INTERNET
        │                   │
        ▼                   ▼
   WebSocket              Mesh
        │                   │
        └─────────┬─────────┘
                  ▼
            Message Engine
                  │
                  ▼
             User Devices
```

The defining feature is **network-independent communication**.

When the Internet is available, DipChats uses the server infrastructure.

When the Internet disappears, DipChats should automatically fall back to local peer-to-peer communication where the operating system and hardware provide the required capabilities.

---

# Documentation

All specification documents are located in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | Project overview, features, getting started, and quick reference |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, module boundaries, data flow, and pure local identity model |
| [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) | WebSocket events, payloads, Ed25519 challenge-response authentication, and synchronization |
| [API.md](./API.md) | REST API specification, endpoints, request/response formats, and error codes |
| [DATABASE.md](./DATABASE.md) | PostgreSQL schema, indexes, constraints, relationships, and migration strategy |
| [SECURITY.md](./SECURITY.md) | Cryptographic identity, end-to-end encryption, key management, and threat model |
| [NETWORKING.md](./NETWORKING.md) | Transport abstraction, mode selection, protocol negotiation, and network state management |
| [MESH_NETWORK.md](./MESH_NETWORK.md) | Mesh networking protocol, relay model, store-and-forward, and transport layers |
| [PRODUCTION.md](./PRODUCTION.md) | Multi-node deployment, load balancing, Kubernetes, CI/CD, and scaling |
| [MVP.md](./MVP.md) | MVP scope definition, included features, deferred features, and success criteria |
| [RISKS.md](./RISKS.md) | Risk assessment, mitigation strategies, and technical risk analysis |
| [UI_UX_DESIGN.md](./UI_UX_DESIGN.md) | UI/UX design specification, design tokens, component architecture, and wireframes |
| [ROADMAP.md](./ROADMAP.md) | Development roadmap, phases, timeline, dependency graph, and success metrics |

---

# Contributing

Contributions are welcome.

Before submitting a pull request:

```bash
npm run lint
npm run typecheck
npm test
```

For major architecture changes, document:

- The problem
- Proposed solution
- Alternatives considered
- Security implications
- Performance implications
- Cross-platform implications

---

# License

DipChats should use an open-source license defined by the project maintainers.

---

# Development Principle

> **Build real infrastructure, not simulated features.**

Do not use fake:

- WebSocket connections
- Presence
- Encryption
- File transfers
- Delivery receipts
- Mesh networking
- Peer discovery

If a platform cannot provide a particular offline networking capability, expose that limitation clearly and implement the appropriate transport abstraction rather than pretending the feature works.

---

## DipChats

**Real-time chat. Offline mesh. One messaging system.**
