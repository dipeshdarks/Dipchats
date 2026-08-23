# DIPCHATS — SECURITY ARCHITECTURE

## Cryptographic Identity, End-to-End Encryption, Key Management & Threat Model

**Project:** DipChats
**Security Model:** Pure local identity, no server accounts, device-generated keys
**Cryptographic Libraries:** Libsodium (via libsodium.js / react-native-libsodium / swift-libsodium)
**Protocols:** X25519, Ed25519, ChaCha20-Poly1305, XChaCha20-Poly1305, HKDF-SHA256
**Architecture:** End-to-end encryption for all private content, relay-agnostic ciphertext

---

# 1. Security Principles

DipChats follows these non-negotiable security rules:

1. **No accounts, no passwords, no email, no phone number.** Identity is a key pair generated on the device.
2. **Private keys never leave the device.** Not during onboarding, not during sync, not during mesh relay.
3. **The server never sees plaintext private messages.** The server stores ciphertext it cannot decrypt.
4. **Relay nodes never see plaintext private messages.** Mesh relays forward opaque encrypted packets.
5. **Forward secrecy for live sessions.** Compromise of a long-term key does not expose past session content.
6. **No custom cryptography.** All cryptographic primitives come from audited libraries (Libsodium).
7. **Defense in depth.** Encryption, authentication, authorization, and validation at every layer.
8. **Minimal metadata exposure.** Broadcast only what is necessary for routing; nothing more.
9. **Panic wipe destroys all secrets.** One action clears all keys, messages, and cached data.
10. **Verifiable builds.** The application can be compiled from source and verified against release hashes.

---

# 2. Threat Model

## 2.1 Adversary Categories

```text
Adversary               Capability
─────────────────────────────────────────────────
Passive Network Observer    Can read all wire traffic
Active Network Attacker     Can modify, inject, drop packets
Malicious Relay Node        Can observe routing metadata, drop/corrupt packets
Malicious Mesh Peer         Can send crafted packets, attempt replay
Compromised Server          Has database access, can observe API traffic
Malicious Courier           Can observe encrypted envelopes, attempt to correlate
Physical Device Thief       Has temporary physical access to an unlocked device
Nation-State Actor          Full spectrum: network, legal, physical
```

## 2.2 What We Protect

```text
Asset                        Protection
─────────────────────────────────────────────────
Message content              E2E encryption, server never sees plaintext
Message metadata             Minimize exposure; some routing info is necessary
User identity                Local key pairs, no central registration
Contact list                 Never transmitted in plaintext
Device location              Not collected; geohash channels are opt-in
Message history              Local encrypted storage, panic wipe
Key material                 Secure enclave / Keychain where available
```

## 2.3 What We Accept

```text
Limitation                          Justification
─────────────────────────────────────────────────────────────────
Mesh peer ID is stable per session  Necessary for routing; Bitchat accepts this too
Presence metadata is visible        Required for real-time features
Geohash channel location is visible  Opt-in; user chooses precision
Server stores encrypted ciphertext   Required for multi-device and offline delivery
Courier can observe envelope size    Necessary for store-and-forward routing
```

---

# 3. Device Identity

## 3.1 Identity Generation

On first launch, the device generates a permanent identity:

```text
Onboarding
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
    ├── Derive short peer ID
    │       peer_id: fingerprint[0:8]   (8 bytes, for mesh packets)
    │
    ├── Generate display key (for server-assisted features)
    │       display_key: X25519 ephemeral per-session
    │
    └── Store all keys in secure storage
            iOS: Keychain (kSecAttrAccessibleWhenUnlockedThisDeviceOnly)
            Android: Android Keystore
            Desktop: OS keychain or encrypted file
            Web: IndexedDB + Web Crypto API (with user passphrase option)
```

## 3.2 Identity Structure

```typescript
interface DeviceIdentity {
  // Long-term identity (never changes unless panic wipe)
  identityKeyPair: {
    privateKey: Uint8Array;  // 32 bytes, X25519
    publicKey: Uint8Array;   // 32 bytes, X25519
  };

  // Signing key (never changes unless panic wipe)
  signingKeyPair: {
    privateKey: Uint8Array;  // 32 bytes, Ed25519
    publicKey: Uint8Array;   // 32 bytes, Ed25519
  };

  // Derived identifiers
  fingerprint: Uint8Array;   // 32 bytes, SHA-256(identityPublicKey)
  peerId: Uint8Array;        // 8 bytes, fingerprint[0:8]

  // Metadata
  displayName: string;       // User-chosen, cosmetic only
  createdAt: number;         // Unix timestamp
  protocolVersion: number;   // DipChats protocol version
}
```

## 3.3 Identity Storage

```text
Platform        Storage Location                          Protection
──────────────────────────────────────────────────────────────────────
iOS             Keychain (kSecAttrAccessible               Hardware security
                WhenUnlockedThisDeviceOnly)
Android         Android Keystore (StrongBox               Hardware security
                if available)
macOS           Keychain (kSecAttrAccessible               Hardware security
                WhenUnlocked)
Windows         DPAPI-encrypted file in app data           OS protection
Linux           Encrypted file with user-derived key       File permissions + encryption
Web             IndexedDB + optional passphrase             User-derived key
```

## 3.4 Identity Lifecycle

```text
GENERATED → ACTIVE → (panic wipe) → DESTROYED
                                  → NEW IDENTITY GENERATED
```

The identity is never modified after generation. Key rotation creates a new identity; the old one is not derived from the new one.

---

# 4. Key Hierarchy

```text
                    Device Identity
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    Identity Key    Signing Key     Display Key
    (X25519)        (Ed25519)       (ephemeral)
         │               │
         │               │
    ┌────┴────┐          │
    │         │          │
  Private   Public    Private + Public
    │         │
    │    ┌────┴──────────────────────┐
    │    │                           │
    │  Fingerprint              Short Peer ID
    │  (SHA-256)                (8 bytes)
    │
    ├── Session Keys (per-peer, derived via Double Ratchet)
    │       │
    │       ├── Chain Key
    │       ├── Message Key
    │       └── Root Key
    │
    ├── Courier Envelope Keys (derived from recipient's static key)
    │       │
    │       └── XChaCha20-Poly1305 key
    │
    └── Server Auth Token (derived, time-limited)
            │
            └── HMAC-SHA256(identity_key, server_nonce)
```

---

# 5. Cryptographic Primitives

All primitives are from Libsodium. No custom implementations.

## 5.1 Key Exchange

```text
Algorithm:          X25519 (Curve25519 ECDH)
Library:            crypto_scalarmult, crypto_scalarmult_base
Purpose:            Establish shared secrets between peers
Security Level:     128-bit
```

Used for:
- Session key establishment (Double Ratchet initial shared secret)
- Courier envelope encryption key derivation
- Server authentication token derivation

## 5.2 Digital Signatures

```text
Algorithm:          Ed25519
Library:            crypto_sign, crypto_sign_open
Purpose:            Authenticate device identity, sign announcements
Security Level:     128-bit (equivalent to 3072-bit RSA)
```

Used for:
- Device announcement signatures (mesh)
- Message authenticity (mesh packets)
- API request authentication

## 5.3 Symmetric Encryption

```text
Algorithm:          ChaCha20-Poly1305 (IETF)
Library:            crypto_aead_chacha20poly1305
Purpose:            Encrypt message payloads
Nonce:              8 bytes (random, unique per message)
Security Level:     128-bit
```

## 5.4 Extended Nonce Encryption

```text
Algorithm:          XChaCha20-Poly1305
Library:            crypto_aead_xchacha20poly1305
Purpose:            Encrypt courier envelopes, server-stored ciphertext
Nonce:              24 bytes (random, unique per envelope)
Security Level:     128-bit
```

## 5.5 Hashing

```text
Algorithm:          SHA-256
Library:            crypto_hash_sha256
Purpose:            Fingerprints, content hashing, deduplication
```

## 5.6 Key Derivation

```text
Algorithm:          HKDF-SHA256
Library:            crypto_kdf (Libsodium's key derivation)
Purpose:            Derive subkeys from shared secrets
```

## 5.5 Authenticated Key Exchange

```text
Protocol:           Noise XX pattern
Components:         X25519 + ChaCha20-Poly1305 + SHA-256
Purpose:            Establish encrypted sessions with mutual authentication
Properties:         Mutual authentication, forward secrecy, identity hiding
```

---

# 6. Double Ratchet Protocol

## 6.1 Overview

DipChats uses the Double Ratchet Protocol (Signal Protocol) for all private messaging sessions.

```text
Properties:
  - Forward secrecy (past messages safe if long-term key compromised)
  - Break-in recovery (future messages safe after session key compromised)
  - Out-of-order message delivery
  - Asynchronous messaging (can encrypt without being online)
```

## 6.2 Session Establishment

```text
Alice                                           Bob
  │                                               │
  │  1. Alice generates ephemeral X25519 key      │
  │                                               │
  │  2. Alice computes:                           │
  │     shared_secret = X25519(                   │
  │       alice_ephemeral_private,                │
  │       bob_identity_public                     │
  │     )                                         │
  │                                               │
  │  3. Alice derives root_key via HKDF           │
  │                                               │
  │  4. Alice sends:                              │
  │     ┌──────────────────────────────┐          │
  │     │ X25519(alice_ephemeral)      │          │
  │     │ + encrypted header           │──────────│
  │     │   (ratchet public key,       │          │
  │     │    chain key)                │          │
  │     └──────────────────────────────┘          │
  │                                               │
  │     5. Bob computes:                          │
  │        shared_secret = X25519(                │
  │          bob_identity_private,                │
  │          alice_ephemeral_public               │
  │        )                                      │
  │                                               │
  │     6. Bob derives root_key via HKDF          │
  │        (same root_key as Alice)               │
  │                                               │
  │     7. Bob sends:                             │
  │     ┌──────────────────────────────┐          │
  │     │ encrypted response           │          │
  │     │   (ratchet public key,       │          │
  │     │    chain key)                │──────────│
  │     └──────────────────────────────┘          │
  │                                               │
  │  8. Both derive matching message keys          │
  │                                               │
  │  9. Encrypted messaging begins                │
  │  ─────────────────────────────────────────── │
```

## 6.3 Ratchet Steps

```text
Sending:
  chain_key = KDF(chain_key, "chain")
  message_key = KDF(chain_key, "message")
  ratchet_public = X25519(ratchet_private, base_point)

Receiving:
  chain_key = KDF(chain_key, "chain")
  message_key = KDF(chain_key, "message")

  If new ratchet key received:
    root_key = KDF(root_key, X25519(ratchet_private, new_ratchet_public))
    reset chain_key from root_key
```

## 6.4 Session State

```typescript
interface SessionState {
  // Root key (updated on each ratchet step)
  rootKey: Uint8Array;        // 32 bytes

  // Sending chain
  sendingChainKey: Uint8Array; // 32 bytes
  sendingRatchetKey: {
    privateKey: Uint8Array;   // 32 bytes
    publicKey: Uint8Array;    // 32 bytes
  };

  // Receiving chain
  receivingChainKey: Uint8Array | null; // 32 bytes
  receivingRatchetKey: Uint8Array | null; // 32 bytes

  // Message counters
  sendMessageCount: number;
  receiveMessageCount: number;
  previousReceiveCount: number;

  // Skipped message keys (for out-of-order delivery)
  skippedMessageKeys: Map<string, Uint8Array>; // max 1000 entries
}
```

## 6.5 Out-of-Order Messages

The Double Ratchet supports out-of-order delivery through skipped message keys:

```text
Messages received out of order:
  msg_10 → msg_12 → msg_11 → msg_15

When msg_12 arrives before msg_11:
  - Store msg_12's message key in skipped keys
  - When msg_11 arrives, derive its key normally
  - When msg_15 arrives, derive any intermediate keys

Maximum skipped keys: 1000
Oldest skipped keys evicted first (LRU)
```

---

# 7. Session Management

## 7.1 Session Types

```text
Type                Description                         Forward Secrecy
──────────────────────────────────────────────────────────────────────────
Live Session        Active Double Ratchet session        Yes
Store-and-Forward   Sealed envelope for offline peer     No (static key)
Server Session      Authenticated WebSocket connection   Transport-only (TLS)
```

## 7.2 Session Lifecycle

```text
INITIATED
    │
    ▼
KEY_EXCHANGE
    │
    ▼
ESTABLISHED
    │
    ▼
ACTIVE
    │
    ├── (ratchet steps with each message)
    │
    ▼
INACTIVE (no messages for timeout)
    │
    ▼
CLOSED
    │
    ▼
DESTROYED (session keys zeroed)
```

## 7.3 Session Storage

```text
Platform        Storage                          Encryption
──────────────────────────────────────────────────────────────
Server          PostgreSQL (sessions table)       Encrypted at rest (AES-256)
Client          Local database                   Encrypted at rest
Mesh            In-memory only                   Zeroed on disconnect
```

## 7.4 Session Timeout

```text
Live sessions expire after:     24 hours of inactivity
Skipped keys purged after:      1000 keys or 7 days
Session state zeroed after:     timeout + 1 hour
```

---

# 8. Server Authentication

## 8.1 Device-to-Server Authentication

Since there are no passwords, authentication uses device keys:

```text
Client                                    Server
  │                                         │
  │  1. Client generates nonce              │
  │     nonce = random(32)                  │
  │                                         │
  │  2. Client signs nonce:                 │
  │     signature = Ed25519_sign(           │
  │       signing_private_key,              │
  │       nonce || timestamp               │
  │     )                                   │
  │                                         │
  │  3. Client sends:                       │
  │     ┌─────────────────────────────┐     │
  │     │ device_id: fingerprint[0:8] │     │
  │     │ public_key: signing_pk      │─────│
  │     │ nonce: 32 bytes             │     │
  │     │ signature: 64 bytes         │     │
  │     │ timestamp: unix_ms          │     │
  │     └─────────────────────────────┘     │
  │                                         │
  │  4. Server verifies:                    │
  │     a. Timestamp within ±5 minutes      │
  │     b. Nonce not in replay cache        │
  │     c. Ed25519_verify(signature,        │
  │        nonce || timestamp, public_key)  │
  │                                         │
  │  5. Server issues session token:        │
  │     token = HMAC-SHA256(                │
  │       server_secret,                    │
  │       device_id || session_id           │
  │     )                                   │
  │     expiry = now + 1 hour               │
  │                                         │
  │  6. Client stores token                 │
  │     (in memory only, not persisted)     │
  │                                         │
  │  7. All subsequent requests:            │
  │     Authorization: Bearer <token>       │
  │                                         │
```

## 8.2 Token Lifecycle

```text
Generated → Active → Expires → Refreshed
                     │
                     └── If refresh fails → Re-authenticate
```

## 8.3 Multi-Device Registration

Each device independently authenticates with its own key pair. The server tracks:

```text
device_id → public_key → registered_at → last_seen → status
```

No device can read another device's private messages unless the sender explicitly encrypts for multiple recipients.

---

# 9. Message Encryption

## 9.1 Online Messages (Server-Routed)

For messages routed through the server:

```text
Sender                                              Recipient
  │                                                    │
  │  1. Fetch recipient's public identity key          │
  │     (from server, which only has public keys)      │
  │                                                    │
  │  2. Establish Double Ratchet session               │
  │     (or use existing session)                      │
  │                                                    │
  │  3. Encrypt message:                               │
  │     message_key = ratchet_derive()                 │
  │     ciphertext = ChaCha20-Poly1305(                │
  │       message_key, nonce, plaintext                │
  │     )                                              │
  │                                                    │
  │  4. Send to server:                                │
  │  ┌─────────────────────────────────────────┐       │
  │  │ sender_id: device fingerprint           │       │
  │  │ recipient_id: recipient fingerprint     │       │
  │  │ ciphertext: encrypted payload           │───────│
  │  │ ratchet_header: ratchet public key      │       │
  │  │ message_number: counter                 │       │
  │  │ previous_chain_length: counter          │       │
  │  └─────────────────────────────────────────┘       │
  │                                                    │
  │  5. Server stores ciphertext                       │
  │     (cannot decrypt)                               │
  │                                                    │
  │  6. Server forwards to recipient's devices         │
  │                                                    │
  │  7. Recipient decrypts with their session state    │
  │                                                    │
```

## 9.2 Mesh Messages (Direct Peer)

For messages sent directly over mesh:

```text
Alice                                           Bob
  │                                               │
  │  1. Check if live session exists with Bob      │
  │                                               │
  │  2. If no session, initiate Noise XX           │
  │     handshake over mesh transport              │
  │                                               │
  │  3. Encrypt with session key:                  │
  │     ciphertext = ChaCha20-Poly1305(            │
  │       message_key, nonce, plaintext            │
  │     )                                          │
  │                                               │
  │  4. Wrap in mesh packet:                       │
  │  ┌─────────────────────────────────────┐       │
  │  │ type: message                       │       │
  │  │ sender: alice_peer_id               │       │
  │  │ recipient: bob_peer_id              │       │
  │  │ ttl: 7                              │       │
  │  │ payload: encrypted_data             │───────│
  │  │ signature: ed25519_sign(...)        │       │
  │  └─────────────────────────────────────┘       │
  │                                               │
  │  5. Bob decrypts                               │
  │                                               │
```

## 9.3 Mesh Messages (Relayed)

For messages relayed through intermediate peers:

```text
Alice        Relay A       Relay B        Bob
  │              │              │             │
  │  encrypted   │              │             │
  │  for Bob ────│──────────────│─────────────│
  │              │              │             │
  │  Relay A     │  Relay B     │             │
  │  cannot read │  cannot read │             │
  │  the content │  the content │  decrypts   │
  │              │              │             │
```

The ciphertext is encrypted end-to-end. Relay nodes only see opaque encrypted data.

## 9.4 Offline Seals (Store-and-Forward)

When the recipient is not available:

```text
Alice                                    Courier C
  │                                        │
  │  1. Seal message to Bob's static key:  │
  │     shared_secret = X25519(            │
  │       alice_ephemeral_private,         │
  │       bob_identity_public              │
  │     )                                  │
  │                                        │
  │  envelope_key = HKDF(shared_secret,    │
  │    "courier-envelope")                  │
  │                                        │
  │  ciphertext = XChaCha20-Poly1305(      │
  │    envelope_key, nonce, message         │
  │  )                                     │
  │                                        │
  │  2. Compute recipient tag:             │
  │     tag = HMAC-SHA256(                 │
  │       bob_identity_public,             │
  │       today UTC date                   │
  │     )                                  │
  │                                        │
  │  3. Send to courier:                   │
  │  ┌─────────────────────────────────┐   │
  │  │ recipient_tag: 16 bytes         │   │
  │  │ ciphertext: encrypted envelope  │───│
  │  │ expiry: 24 hours                │   │
  │  │ size: ≤ 16 KiB                  │   │
  │  └─────────────────────────────────┘   │
  │                                        │
  │  Courier C does NOT know:              │
  │    - Who sent it                       │
  │    - Who it's for (beyond the tag)     │
  │    - What's inside                     │
  │                                        │
```

**Note:** Offline seals use the recipient's static key and therefore do NOT provide forward secrecy. Compromise of the recipient's static key exposes sealed-but-undelivered mail. This is documented as a known limitation. A prekey-based scheme is planned for a future version.

---

# 10. Mesh Security

## 10.1 Packet Authentication

Every mesh packet includes an Ed25519 signature:

```text
Signature covers:
  - Packet type
  - Sender peer ID
  - Recipient peer ID (if directed)
  - Timestamp
  - Payload hash

Signature does NOT cover:
  - TTL (relays decrement it)
  - Hop count (incremented by relays)
```

## 10.2 Relay Trust Model

```text
Trust Level        Behavior
───────────────────────────────────────────────────────────
Untrusted          Can relay encrypted packets
                   Cannot read content
                   Rate-limited
                   Quota-bounded

Verified           Has exchanged keys with us
                   Higher relay quota
                   Can carry courier envelopes

Favorite           Mutual key exchange completed
                   Highest relay quota
                   Trusted for courier duty
                   Can establish live sessions
```

## 10.3 Replay Protection

```text
Mechanism                    Window
─────────────────────────────────────
Live session                 Double Ratchet counters (always)
Mesh broadcast               6-hour acceptance window
Mesh directed                Session sequence numbers
Courier envelope             Daily HMAC tag rotation
Server API                   Timestamp + nonce cache (5 minutes)
```

## 10.4 Flood Protection

```text
Protection              Implementation
──────────────────────────────────────────────────────────────
TTL clamp               Dense graphs cap at TTL 5; thin chains at TTL 7
Deduplication           LRU seen-set (1000 entries, 5-minute expiry)
Jitter                  Random 10-220ms delay before relay
Fanout subsetting       Log2(degree) subset for broadcasts
Per-peer rate limit     Max packets per peer per second
Queue size limit        Max 1000 messages / 100 MB per peer
```

## 10.5 Privacy on Mesh

```text
Observable by passive listener:
  - Device peer ID (8 bytes, stable per session)
  - Packet type (message, announce, etc.)
  - Packet size (for non-encrypted types)
  - Timing patterns

NOT observable (encrypted):
  - Message content
  - Sender/recipient identity (in directed messages)
  - Message metadata (in encrypted payload)

Future improvement:
  - Rotating peer IDs per session (not in v1)
  - Padding for non-Noise packet types
```

---

# 11. Server Security

## 11.1 Database Encryption

```text
At rest:     AES-256 encryption (PostgreSQL TDE or disk-level)
In transit:  TLS 1.3 (all connections)
Application: Server-side encryption for sensitive columns
```

## 11.2 What the Server Stores

```text
Store                              Cannot decrypt?
──────────────────────────────────────────────────
User display name                  N/A (not secret)
Device public keys                  N/A (public)
Session tokens                      N/A (opaque tokens)
Message ciphertext                  YES (only sender/recipient can decrypt)
File attachments (encrypted)        YES
Channel metadata                    N/A (not secret)
Presence status                     N/A (not secret)
```

## 11.3 What the Server Does NOT Store

```text
- Private keys (never transmitted)
- Plaintext messages (encrypted client-side)
- User passwords (none exist)
- Contact lists (never transmitted)
- Message content in readable form
```

## 11.4 API Security

```text
Mechanism                    Implementation
──────────────────────────────────────────────────
Authentication               Device key signature (Ed25519)
Session management           Short-lived tokens (1 hour)
Rate limiting                Per-IP, per-device, per-endpoint
Input validation             Zod schemas on all endpoints
CORS                         Strict origin policy
Helmet                       Security headers
Request size limits          Max 1 MB WebSocket, configurable HTTP
SQL injection                Parameterized queries (Drizzle ORM)
File validation              MIME type, size, hash verification
```

## 11.5 Infrastructure Security

```text
TLS termination              Reverse proxy (nginx/Cloudflare)
Certificate management       Let's Encrypt or managed certificates
Secrets management           Environment variables, never in code
Container security           Non-root user, minimal base image
Network segmentation         Isolated containers, internal networks
Log redaction                Never log tokens, keys, or message content
```

---

# 12. Panic Wipe

## 12.1 Trigger

```text
Triple-tap on app icon (mobile)
  OR
Keyboard shortcut (desktop)
  OR
Settings → Security → Wipe All Data
```

## 12.2 What Is Destroyed

```text
Data                          Method
────────────────────────────────────────────────────
Identity key pair             Overwritten with zeros, then deleted
Signing key pair              Overwritten with zeros, then deleted
All session keys              Zeroed in memory
Local message database        Deleted
Local file attachments        Deleted
Mesh relay queue              Deleted
Courier carried envelopes     Deleted
Sync cursors                  Deleted
Cached peer information       Deleted
Server session token          Invalidated (server-side)
App state                     Reset to initial
```

## 12.3 What Survives

```text
- The app itself (can be reinstalled)
- Server-stored ciphertext (cannot be decrypted without keys)
- Other devices' copies (each device must wipe independently)
```

---

# 13. Key Rotation

## 13.1 Identity Key Rotation

When a user wants to change identity (e.g., after device compromise):

```text
1. Generate new identity key pair
2. Generate new signing key pair
3. Derive new fingerprint and peer ID
4. Broadcast identity change to known contacts (signed with OLD key)
5. Contacts verify transition signature, update stored keys
6. Old key pair is zeroed
```

**Important:** Key rotation is a new identity. Old peer IDs are invalidated. Mesh peers must re-discover.

## 13.2 Session Key Ratchet

The Double Ratchet automatically rotates session keys:

```text
Every message:
  - New message key derived
  - Chain key advanced

Every ratchet step:
  - New ratchet key pair generated
  - Old ratchet private key deleted
  - Root key updated via ECDH
```

This means:
- Compromising one message key exposes only that message
- Compromising the chain key exposes future messages in that chain only
- Compromising the root key + one ratchet key exposes that ratchet step only

---

# 14. Device Verification

## 14.1 In-Person Verification

When two users meet in person:

```text
1. Both devices display QR code containing:
   - Device fingerprint (32 bytes, SHA-256)
   - Display name
   - Protocol version

2. Each scans the other's QR code

3. Each device verifies:
   - QR code is well-formed
   - Fingerprint matches expected device
   - Protocol version is compatible

4. Mutual key exchange occurs:
   - Each device stores the other's identity public key
   - Contact is marked as "verified"
   - Verification level recorded

5. Verification levels:
   - UNVERIFIED (default for mesh-discovered peers)
   - QR_VERIFIED (exchanged QR in person)
   - FINGERPRINT_VERIFIED (compared fingerprints manually)
```

## 14.2 Trust On First Use (TOFU)

For server-discovered peers (e.g., in channels):

```text
First contact:
  - Server provides public key
  - Client stores key with "TOFU" trust level
  - User sees "Unverified" indicator

Subsequent contacts:
  - Server provides same public key → trusted
  - Server provides different public key → WARNING displayed
  - User can verify via QR to upgrade trust
```

---

# 15. Forward Secrecy Analysis

## 15.1 Live Sessions (Double Ratchet)

```text
Scenario                              Protected?
──────────────────────────────────────────────────
Long-term key compromised later       YES (past messages)
Session key compromised later         NO (that session)
Chain key compromised                 PARTIAL (future chain messages)
Single message key compromised        YES (only that message)
```

## 15.2 Offline Seals

```text
Scenario                              Protected?
──────────────────────────────────────────────────
Long-term key compromised later       NO (sealed messages exposed)
Seal intercepted                      YES (cannot decrypt without recipient key)
Courier compromised                   YES (envelope is opaque)
```

**Known limitation:** Offline seals use the recipient's static key, which means forward secrecy is not provided for store-and-forward mail. This is a deliberate trade-off: the recipient must be addressable without prior contact. A prekey-based improvement is planned for a future version (see Roadmap).

## 15.3 Server-Stored Ciphertext

```text
Scenario                              Protected?
──────────────────────────────────────────────────
Server database breached              YES (ciphertext without keys)
Server admin reads data               YES (ciphertext only)
Server complicit with adversary       YES (ciphertext only)
```

---

# 16. Compliance Considerations

## 16.1 Data Protection

```text
GDPR:     No personal data collected (no email, no phone, no name tied to identity)
CCPA:     No personal data collected
HIPAA:    E2E encryption suitable for PHI (but compliance depends on deployment)
```

## 16.2 Law Enforcement

```text
What can be provided (with valid legal process):
  - Server-stored ciphertext (unreadable without client keys)
  - Device public keys (public by design)
  - Channel membership metadata
  - Connection timestamps

What CANNOT be provided:
  - Plaintext messages (server cannot decrypt)
  - Private keys (never transmitted)
  - Decryption capability (zero-knowledge architecture)
```

## 16.3 Export Controls

```text
E2E encryption may be subject to export controls in some jurisdictions.
The open-source nature of DipChats means it is publicly available.
Consult legal counsel for deployment in restricted regions.
```

---

# 17. Security Audit Requirements

Before production release:

```text
1. Third-party cryptographic audit
   - Key generation
   - Key storage
   - Encryption/decryption flows
   - Double Ratchet implementation
   - Noise Protocol implementation

2. Penetration testing
   - Server API
   - WebSocket gateway
   - Authentication bypass attempts
   - Injection attacks
   - File upload abuse

3. Mesh security testing
   - Relay node compromise
   - Replay attacks
   - Packet injection
   - Flood attacks
   - Eavesdropping verification

4. Client security audit
   - Key storage on each platform
   - Panic wipe completeness
   - Session management
   - Memory safety
```

---

# 18. Non-Negotiable Security Rules

1. **Never store private keys on the server.**
2. **Never transmit private keys over any network.**
3. **Never implement custom cryptographic primitives.**
4. **Never use ECB mode or other weak cipher modes.**
5. **Never use MD5 or SHA-1 for security-critical hashing.**
6. **Never hardcode cryptographic keys in source code.**
7. **Never log private keys, session keys, or message content.**
8. **Never accept unsigned mesh packets as authentic.**
9. **Never trust timestamps from untrusted peers without validation.**
10. **Never allow unlimited authentication attempts.**
11. **Never skip forward secrecy for live sessions.**
12. **Never allow panic wipe to be reversible.**
13. **Never store plaintext passwords (none should exist).**
14. **Never expose stack traces or internal errors to clients.**
15. **Never rely on security through obscurity.**

---

# 19. Security Architecture Goal

```text
                    SAME SECURITY MODEL
                           │
          ┌────────────────┼────────────────┐
          │                │                │
      ONLINE           OFFLINE           MESH
          │                │                │
      Server TLS        Local keys       Noise XX
          │                │                │
      Device keys       E2E encrypted    E2E encrypted
          │                │                │
          └────────────────┼────────────────┘
                           │
                     All private data
                     encrypted end-to-end
                           │
                     Server sees only
                     ciphertext it cannot
                     decrypt
```

**One security model. All transports. Zero trust in intermediaries.**

---

*This document defines the security architecture for DipChats. All implementation must conform to these specifications. Any deviation requires explicit security review and documentation.*
