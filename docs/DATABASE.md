# DIPCHATS — DATABASE ARCHITECTURE

## PostgreSQL Schema, Indexes, Constraints & Relationships

**Project:** DipChats
**Database:** PostgreSQL 16+
**ORM:** Drizzle ORM
**Cache:** Redis 7+
**Local Storage:** SQLite (mobile/desktop), IndexedDB (web)

---

# 1. Database Strategy

DipChats uses a two-tier storage strategy:

```text
Tier 1: Server (PostgreSQL)
  - Channels and membership
  - Message ciphertext (encrypted client-side)
  - Device public keys
  - File attachment metadata
  - Channel metadata
  - No plaintext private messages

Tier 2: Client (SQLite / IndexedDB)
  - Full message history (decrypted locally)
  - Contact list
  - Session state
  - Offline message queue
  - Mesh peer information
  - Sync cursors
  - File cache
```

The server is a **semi-trusted relay and store**. It stores ciphertext it cannot decrypt. All decryption happens on the client.

---

# 2. Entity Relationship Diagram

```text
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   devices    │       │   channels   │       │  attachments │
│              │       │              │       │              │
│ device_id PK │       │ channel_id PK│       │ file_id PK   │
│ public_key   │       │ name         │       │ filename     │
│ display_key  │       │ type         │       │ mime_type    │
│ display_name │       │ owner_id     │       │ size         │
│ fingerprint  │       │ created_at   │       │ sha256       │
│ registered_at│       │ updated_at   │       │ storage_key  │
│ last_seen    │       │ encrypted    │       │ owner_id     │
│ status       │       │ description  │       │ created_at   │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  sessions    │       │  channel_    │       │   messages   │
│              │       │  members     │       │              │
│ session_id PK│       │ id PK        │       │ message_id PK│
│ device_id FK │       │ channel_id FK│       │ channel_id FK│
│ token        │       │ device_id FK │       │ sender_id FK │
│ created_at   │       │ role         │       │ device_id FK │
│ expires_at   │       │ joined_at    │       │ content      │
│ last_active  │       │ status       │       │ reply_to FK  │
└──────────────┘       └──────────────┘       │ attachments  │
                                              │ created_at   │
                                              │ edited_at    │
                                              │ deleted_at   │
                                              │ client_msg_id│
                                              └──────┬───────┘
                                                     │
                               ┌───────────────────────┼──────────────────┐
                               ▼                       ▼                  ▼
                        ┌──────────────┐       ┌──────────────┐  ┌──────────────┐
                        │  reactions   │       │ read_receipts│  │  delivery    │
                        │              │       │              │  │  receipts    │
                        │ id PK        │       │ id PK        │  │              │
                        │ message_id FK│       │ message_id FK│  │ id PK        │
                        │ device_id FK │       │ device_id FK │  │ message_id FK│
                        │ emoji        │       │ read_at      │  │ device_id FK │
                        │ created_at   │       └──────────────┘  │ delivered_at │
                        └──────────────┘                         └──────────────┘
```

---

# 3. Server Schema (PostgreSQL)

## 3.1 devices

The `devices` table is the primary identity table. There is no `users` table — identity is purely device-based.

```sql
CREATE TABLE devices (
    -- Primary key is the 8-byte peer ID (first 8 bytes of SHA-256 of identity public key)
    device_id       BYTEA       PRIMARY KEY,          -- 8 bytes

    -- Cryptographic identity (public keys only)
    identity_public_key  BYTEA  NOT NULL,              -- 32 bytes, X25519
    signing_public_key   BYTEA  NOT NULL,              -- 32 bytes, Ed25519

    -- Display information (cosmetic, not secret)
    display_name    TEXT        NOT NULL DEFAULT 'Anonymous',
    display_avatar  TEXT,                               -- Optional avatar URL

    -- Protocol metadata
    protocol_version INTEGER   NOT NULL DEFAULT 1,
    platform        TEXT,                               -- ios, android, web, desktop
    app_version     TEXT,

    -- Server metadata
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked', 'deleted')),

    -- Constraints
    CONSTRAINT uq_devices_identity_key UNIQUE (identity_public_key)
);

-- Indexes
CREATE INDEX idx_devices_last_seen ON devices (last_seen DESC);
CREATE INDEX idx_devices_status ON devices (status) WHERE status = 'active';
CREATE INDEX idx_devices_platform ON devices (platform);
```

## 3.2 sessions

Server-side session tokens for authenticated API/WebSocket access.

```sql
CREATE TABLE sessions (
    session_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,

    -- Token (HMAC-SHA256, stored as hash)
    token_hash      BYTEA       NOT NULL,              -- SHA-256 of token
    token_prefix    TEXT        NOT NULL,               -- First 8 chars for identification

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    ip_address      INET,
    user_agent      TEXT,

    -- Constraints
    CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash)
);

-- Indexes
CREATE INDEX idx_sessions_device ON sessions (device_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at) WHERE expires_at > NOW();
CREATE INDEX idx_sessions_active ON sessions (last_active DESC);
```

## 3.3 channels

Communication channels (groups, DMs, broadcasts).

```sql
CREATE TABLE channels (
    channel_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Channel info
    name            TEXT        NOT NULL,
    description     TEXT,
    type            TEXT        NOT NULL DEFAULT 'group'
                        CHECK (type IN ('dm', 'group', 'broadcast')),

    -- Ownership
    owner_id        BYTEA       NOT NULL REFERENCES devices(device_id),

    -- Settings
    is_encrypted    BOOLEAN     NOT NULL DEFAULT true,
    max_members     INTEGER     NOT NULL DEFAULT 1000,
    message_ttl     INTEGER,                             -- NULL = no expiry

    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at     TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT chk_dm_owner CHECK (
        type != 'dm' OR owner_id IS NOT NULL
    )
);

-- Indexes
CREATE INDEX idx_channels_type ON channels (type);
CREATE INDEX idx_channels_owner ON channels (owner_id);
CREATE INDEX idx_channels_created ON channels (created_at DESC);
```

## 3.4 channel_members

Membership and roles within channels.

```sql
CREATE TABLE channel_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID        NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,

    -- Role and status
    role            TEXT        NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
    status          TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'banned', 'muted', 'kicked')),

    -- Membership lifecycle
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at         TIMESTAMPTZ,
    banned_at       TIMESTAMPTZ,
    banned_by       BYTEA       REFERENCES devices(device_id),

    -- Notification preferences
    notifications   TEXT        NOT NULL DEFAULT 'all'
                        CHECK (notifications IN ('all', 'mentions', 'none')),

    -- Constraints
    CONSTRAINT uq_channel_member UNIQUE (channel_id, device_id)
);

-- Indexes
CREATE INDEX idx_channel_members_channel ON channel_members (channel_id);
CREATE INDEX idx_channel_members_device ON channel_members (device_id);
CREATE INDEX idx_channel_members_active ON channel_members (channel_id, status)
    WHERE status = 'active';
```

## 3.5 messages

All messages stored as ciphertext (encrypted client-side for private channels).

```sql
CREATE TABLE messages (
    message_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID        NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,

    -- Sender
    sender_id       BYTEA       NOT NULL REFERENCES devices(device_id),
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id),

    -- Client-assigned identity (for idempotency)
    client_message_id TEXT      NOT NULL,

    -- Content (ciphertext for encrypted channels)
    content         TEXT        NOT NULL,
    content_type    TEXT        NOT NULL DEFAULT 'text'
                        CHECK (content_type IN ('text', 'attachment', 'system')),

    -- Threading
    reply_to        UUID        REFERENCES messages(message_id),

    -- Attachments (JSON array of file references)
    attachments     JSONB       DEFAULT '[]'::jsonb,

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at       TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,

    -- Deduplication
    hash            BYTEA,                              -- SHA-256 of content for dedup

    -- Constraints
    CONSTRAINT uq_message_client_id UNIQUE (device_id, client_message_id),
    CONSTRAINT chk_message_content CHECK (
        content_type != 'system' OR content IS NOT NULL
    )
);

-- Indexes (critical for performance)
CREATE INDEX idx_messages_channel ON messages (channel_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages (sender_id, created_at DESC);
CREATE INDEX idx_messages_created ON messages (created_at DESC);
CREATE INDEX idx_messages_reply_to ON messages (reply_to) WHERE reply_to IS NOT NULL;
CREATE INDEX idx_messages_client_id ON messages (device_id, client_message_id);
CREATE INDEX idx_messages_not_deleted ON messages (channel_id, created_at DESC)
    WHERE deleted_at IS NULL;
```

## 3.6 reactions

Emoji reactions on messages.

```sql
CREATE TABLE reactions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID        NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,

    -- Reaction
    emoji           TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_reaction UNIQUE (message_id, device_id, emoji)
);

-- Indexes
CREATE INDEX idx_reactions_message ON reactions (message_id);
CREATE INDEX idx_reactions_device ON reactions (device_id);
```

## 3.7 read_receipts

Track which devices have read which messages.

```sql
CREATE TABLE read_receipts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    channel_id      UUID        NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,

    -- Last read position
    last_read_message_id UUID   REFERENCES messages(message_id),
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_read_receipt UNIQUE (device_id, channel_id)
);

-- Indexes
CREATE INDEX idx_read_receipts_channel ON read_receipts (channel_id);
CREATE INDEX idx_read_receipts_device ON read_receipts (device_id);
```

## 3.8 delivery_receipts

Track message delivery to devices.

```sql
CREATE TABLE delivery_receipts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID        NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,

    -- Delivery status
    status          TEXT        NOT NULL DEFAULT 'delivered'
                        CHECK (status IN ('sent', 'delivered', 'failed')),
    delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_delivery UNIQUE (message_id, device_id)
);

-- Indexes
CREATE INDEX idx_delivery_message ON delivery_receipts (message_id);
CREATE INDEX idx_delivery_device ON delivery_receipts (device_id);
```

## 3.9 attachments

File attachment metadata. Actual files stored in object storage (MinIO).

```sql
CREATE TABLE attachments (
    file_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- File metadata
    filename        TEXT        NOT NULL,
    mime_type       TEXT        NOT NULL,
    size            BIGINT      NOT NULL,
    sha256          BYTEA       NOT NULL,

    -- Storage
    storage_key     TEXT        NOT NULL,               -- Object storage key
    storage_bucket  TEXT        NOT NULL DEFAULT 'dipchats',

    -- Owner
    owner_id        BYTEA       NOT NULL REFERENCES devices(device_id),

    -- Encryption (for encrypted files)
    encryption_key  BYTEA,                              -- Encrypted file key (if E2E)
    is_encrypted    BOOLEAN     NOT NULL DEFAULT false,

    -- Preview
    has_preview     BOOLEAN     NOT NULL DEFAULT false,
    preview_key     TEXT,                               -- Preview storage key
    width           INTEGER,                            -- Image/video width
    height          INTEGER,                            -- Image/video height
    duration        INTEGER,                            -- Audio/video duration (ms)

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,                        -- Optional TTL

    -- Constraints
    CONSTRAINT chk_file_size CHECK (size > 0 AND size <= 104857600),  -- Max 100MB
    CONSTRAINT chk_mime_type CHECK (mime_type ~ '^[a-z]+/[a-z\+\.\-]+$')
);

-- Indexes
CREATE INDEX idx_attachments_owner ON attachments (owner_id);
CREATE INDEX idx_attachments_created ON attachments (created_at DESC);
CREATE INDEX idx_attachments_expires ON attachments (expires_at)
    WHERE expires_at IS NOT NULL;
```

## 3.10 device_keys

Public keys shared between devices for end-to-end encryption.

```sql
CREATE TABLE device_keys (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       BYTEA       NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,

    -- Key metadata
    key_type        TEXT        NOT NULL
                        CHECK (key_type IN ('identity', 'signing', 'prekey', 'session')),
    public_key      BYTEA       NOT NULL,

    -- For prekeys
    key_id          INTEGER,
    one_time        BOOLEAN     NOT NULL DEFAULT false,

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    used_at         TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT uq_device_key UNIQUE (device_id, key_type, key_id)
);

-- Indexes
CREATE INDEX idx_device_keys_device ON device_keys (device_id);
CREATE INDEX idx_device_keys_type ON device_keys (key_type);
CREATE INDEX idx_device_keys_prekey ON device_keys (device_id, key_type, key_id)
    WHERE key_type = 'prekey' AND revoked_at IS NULL;
```

## 3.11 presence (ephemeral, Redis-backed)

Presence is NOT stored in PostgreSQL. It lives in Redis for low-latency access.

```text
Redis key pattern:
  presence:{device_id}

Redis value:
  {
    "status": "online" | "idle" | "dnd" | "offline" | "invisible",
    "last_seen": "2026-08-21T12:00:00Z",
    "device_ids": ["device_1", "device_2"]
  }

TTL: 60 seconds (requires heartbeat to renew)
```

## 3.12 typing_indicators (ephemeral, Redis-backed)

```text
Redis key pattern:
  typing:{channel_id}:{device_id}

Redis value:
  { "typing": true }

TTL: 5 seconds (requires typing.start to renew)
```

---

# 4. Client Schema (SQLite / IndexedDB)

## 4.1 local_messages

Full message history with decrypted content.

```sql
CREATE TABLE local_messages (
    message_id      TEXT        PRIMARY KEY,            -- UUID
    channel_id      TEXT        NOT NULL,
    sender_id       TEXT        NOT NULL,
    device_id       TEXT        NOT NULL,

    -- Decrypted content
    content         TEXT        NOT NULL,
    content_type    TEXT        NOT NULL DEFAULT 'text',

    -- Threading
    reply_to        TEXT,

    -- Attachments
    attachments     TEXT        DEFAULT '[]',           -- JSON

    -- Lifecycle
    created_at      TEXT        NOT NULL,               -- ISO 8601
    edited_at       TEXT,
    deleted_at      TEXT,

    -- Local state
    local_state     TEXT        NOT NULL DEFAULT 'synced'
                        CHECK (local_state IN ('pending', 'sending', 'sent', 'synced', 'failed')),
    sync_cursor     TEXT,                               -- Server sync cursor

    -- Deduplication
    client_message_id TEXT      NOT NULL,
    is_local        BOOLEAN     NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_local_messages_channel ON local_messages (channel_id, created_at DESC);
CREATE INDEX idx_local_messages_state ON local_messages (local_state);
CREATE INDEX idx_local_messages_client ON local_messages (client_message_id);
```

## 4.2 local_channels

Channel list with local metadata.

```sql
CREATE TABLE local_channels (
    channel_id      TEXT        PRIMARY KEY,
    name            TEXT        NOT NULL,
    type            TEXT        NOT NULL,
    description     TEXT,
    owner_id        TEXT,

    -- Local state
    last_message    TEXT,                               -- Last message preview
    last_message_at TEXT,
    unread_count    INTEGER     NOT NULL DEFAULT 0,
    is_muted        BOOLEAN     NOT NULL DEFAULT false,
    is_pinned       BOOLEAN     NOT NULL DEFAULT false,

    -- Sync
    sync_cursor     TEXT,
    updated_at      TEXT        NOT NULL
);

-- Indexes
CREATE INDEX idx_local_channels_updated ON local_channels (updated_at DESC);
CREATE INDEX idx_local_channels_unread ON local_channels (unread_count DESC)
    WHERE unread_count > 0;
```

## 4.3 local_contacts

Known device contacts.

```sql
CREATE TABLE local_contacts (
    device_id       TEXT        PRIMARY KEY,
    display_name    TEXT        NOT NULL,
    fingerprint     TEXT        NOT NULL,

    -- Trust
    trust_level     TEXT        NOT NULL DEFAULT 'tofu'
                        CHECK (trust_level IN ('unverified', 'tofu', 'qr_verified', 'fingerprint_verified')),

    -- Keys
    identity_public_key TEXT   NOT NULL,
    signing_public_key  TEXT   NOT NULL,

    -- Local
    is_favorite     BOOLEAN     NOT NULL DEFAULT false,
    notes           TEXT,
    added_at        TEXT        NOT NULL,
    verified_at     TEXT
);

-- Indexes
CREATE INDEX idx_local_contacts_name ON local_contacts (display_name);
CREATE INDEX idx_local_contacts_trust ON local_contacts (trust_level);
```

## 4.4 local_sessions

Double Ratchet session state for each peer.

```sql
CREATE TABLE local_sessions (
    peer_id         TEXT        PRIMARY KEY,

    -- Session state (serialized)
    root_key        TEXT        NOT NULL,
    sending_chain_key TEXT,
    sending_ratchet_private TEXT,
    sending_ratchet_public TEXT,
    receiving_chain_key TEXT,
    receiving_ratchet_public TEXT,

    -- Counters
    send_count      INTEGER     NOT NULL DEFAULT 0,
    receive_count   INTEGER     NOT NULL DEFAULT 0,
    previous_receive_count INTEGER NOT NULL DEFAULT 0,

    -- Skipped message keys (JSON array)
    skipped_keys    TEXT        DEFAULT '[]',

    -- Lifecycle
    created_at      TEXT        NOT NULL,
    last_active     TEXT        NOT NULL,
    expires_at      TEXT
);
```

## 4.5 local_pending_messages

Messages created offline, waiting for connectivity.

```sql
CREATE TABLE local_pending_messages (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    client_message_id TEXT      NOT NULL,
    channel_id      TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    content_type    TEXT        NOT NULL DEFAULT 'text',
    reply_to        TEXT,
    attachments     TEXT        DEFAULT '[]',

    -- Routing
    preferred_transport TEXT,
    target_peer     TEXT,

    -- Lifecycle
    created_at      TEXT        NOT NULL,
    retry_count     INTEGER     NOT NULL DEFAULT 0,
    max_retries     INTEGER     NOT NULL DEFAULT 5,
    next_retry_at   TEXT,

    -- State
    state           TEXT        NOT NULL DEFAULT 'queued'
                        CHECK (state IN ('queued', 'encrypting', 'sending', 'sent', 'failed', 'expired'))
);

-- Indexes
CREATE INDEX idx_pending_state ON local_pending_messages (state);
CREATE INDEX idx_pending_retry ON local_pending_messages (next_retry_at)
    WHERE state = 'queued';
```

## 4.6 local_mesh_peers

Discovered mesh peers.

```sql
CREATE TABLE local_mesh_peers (
    peer_id         TEXT        PRIMARY KEY,
    device_id       TEXT,
    display_name    TEXT,

    -- Keys
    identity_public_key TEXT,
    signing_public_key  TEXT,

    -- Transport
    transport_type  TEXT,
    address         TEXT,                               -- BLE UUID, IP:port, etc.
    signal_strength INTEGER,

    -- Trust
    trust_level     TEXT        NOT NULL DEFAULT 'unknown',

    -- State
    last_seen       TEXT        NOT NULL,
    connection_state TEXT       NOT NULL DEFAULT 'disconnected',
    relay_capable   BOOLEAN     NOT NULL DEFAULT true,

    -- Capabilities
    capabilities    TEXT        DEFAULT '[]'            -- JSON array
);

-- Indexes
CREATE INDEX idx_mesh_peers_last_seen ON local_mesh_peers (last_seen DESC);
CREATE INDEX idx_mesh_peers_state ON local_mesh_peers (connection_state);
```

## 4.7 local_sync_state

Synchronization cursors for each channel.

```sql
CREATE TABLE local_sync_state (
    channel_id      TEXT        PRIMARY KEY,
    last_sync_cursor TEXT,
    last_server_sequence INTEGER NOT NULL DEFAULT 0,
    last_sync_at    TEXT,
    sync_status     TEXT        NOT NULL DEFAULT 'idle'
                        CHECK (sync_status IN ('idle', 'syncing', 'error'))
);
```

## 4.8 local_seen_messages

Deduplication cache for mesh and sync.

```sql
CREATE TABLE local_seen_messages (
    message_id      TEXT        PRIMARY KEY,
    seen_at         TEXT        NOT NULL,
    source          TEXT                                -- 'mesh', 'sync', 'server'
);

-- Auto-cleanup: entries older than 24 hours are purged
CREATE INDEX idx_seen_messages_expires ON local_seen_messages (seen_at);
```

## 4.9 local_courier_queue

Carried courier envelopes (for mesh store-and-forward).

```sql
CREATE TABLE local_courier_queue (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    envelope_id     TEXT        NOT NULL,
    recipient_tag   TEXT        NOT NULL,               -- HMAC tag
    ciphertext      TEXT        NOT NULL,               -- Base64 encoded
    size_bytes      INTEGER     NOT NULL,

    -- Spray budget
    copy_budget     INTEGER     NOT NULL DEFAULT 4,
    max_copies      INTEGER     NOT NULL DEFAULT 8,
    sprayed_to      TEXT        DEFAULT '[]',           -- JSON array of peer IDs

    -- Lifecycle
    created_at      TEXT        NOT NULL,
    expires_at      TEXT        NOT NULL,
    delivered       BOOLEAN     NOT NULL DEFAULT false,

    -- Constraints
    CONSTRAINT uq_courier_envelope UNIQUE (envelope_id)
);

-- Indexes
CREATE INDEX idx_courier_expires ON local_courier_queue (expires_at);
CREATE INDEX idx_courier_recipient ON local_courier_queue (recipient_tag);
```

---

# 5. Redis Schema

## 5.1 Presence

```text
Key:    presence:{device_id}
Type:   Hash
Fields: status, last_seen, device_ids
TTL:    60s
```

## 5.2 Typing Indicators

```text
Key:    typing:{channel_id}:{device_id}
Type:   String
Value:  "1"
TTL:    5s
```

## 5.3 WebSocket Connections

```text
Key:    ws:connection:{connection_id}
Type:   Hash
Fields: device_id, user_id, connected_at, last_activity
TTL:    None (deleted on disconnect)
```

## 5.4 Rate Limiting

```text
Key:    ratelimit:{scope}:{identifier}
Type:   String (counter)
TTL:    Varies by endpoint

Examples:
  ratelimit:ip:192.168.1.1          (HTTP requests)
  ratelimit:device:device_123       (message sends)
  ratelimit:channel:channel_456     (channel operations)
```

## 5.5 Session Tokens

```text
Key:    session:{token_hash}
Type:   Hash
Fields: device_id, session_id, expires_at
TTL:    3600s (1 hour)
```

## 5.6 Pub/Sub Channels

```text
Channel: messages:{channel_id}
  - New messages for a channel

Channel: presence:{user_id}
  - Presence changes for a user

Channel: sync:{device_id}
  - Sync events for a device

Channel: notifications:{device_id}
  - Push notification triggers
```

---

# 6. Data Lifecycle

## 6.1 Message Retention

```text
Server-side retention:
  - Messages: indefinite (encrypted, low storage cost)
  - Attachments: configurable per channel (default 90 days)
  - Sessions: 1 hour token expiry, 24 hour session expiry
  - Presence: ephemeral (Redis TTL)
  - Typing indicators: ephemeral (Redis TTL)

Client-side retention:
  - Messages: user-configurable (default: keep all)
  - Pending messages: 7 days or 5 retries
  - Seen cache: 24 hours
  - Courier queue: 24 hours
```

## 6.2 Soft Delete vs Hard Delete

```text
Messages:
  - User delete: soft delete (deleted_at set, content replaced with "[deleted]")
  - Admin delete: soft delete
  - Channel purge: hard delete (message + reactions + receipts)
  - Retention expiry: hard delete

Channels:
  - Owner delete: soft delete (archived_at set)
  - Purge: hard delete (all members, messages, reactions)

Devices:
  - Revocation: soft delete (status = 'revoked')
  - Wipe: hard delete (device + all keys + all sessions)
```

---

# 7. Migration Strategy

## 7.1 Schema Versioning

```text
Drizzle ORM manages migrations:
  - migrations/ directory
  - Version-controlled SQL files
  - Rollback support
  - Zero-downtime migrations for additive changes
```

## 7.2 Migration Rules

1. Never drop columns in a single migration (add new, migrate, then drop old)
2. Always use nullable columns or defaults for new fields
3. Test migrations against a copy of production data
4. Maintain backward compatibility for at least 2 versions
5. Use transactional DDL where supported

---

# 8. Performance Considerations

## 8.1 Critical Indexes

The most frequently queried patterns:

```text
Messages by channel (most common query):
  idx_messages_channel ON messages (channel_id, created_at DESC)

Unread count per channel:
  idx_local_channels_unread ON local_channels (unread_count DESC)

Pending messages for retry:
  idx_pending_retry ON local_pending_messages (next_retry_at)

Active sessions:
  idx_sessions_active ON sessions (last_active DESC)

Mesh peer lookup:
  idx_mesh_peers_last_seen ON local_mesh_peers (last_seen DESC)
```

## 8.2 Partitioning (Future)

For high-volume deployments:

```text
messages table:
  - Partition by channel_id (hash partitioning)
  - Or partition by created_at (range partitioning for time-series)

attachments table:
  - Partition by created_at (monthly partitions)
  - Old partitions archived or dropped
```

## 8.3 Connection Pooling

```text
Server connections:
  - PgBouncer or built-in Drizzle pooling
  - Min: 5 connections
  - Max: 20 connections (configurable)
  - Idle timeout: 30 seconds
```

---

# 9. Backup Strategy

```text
PostgreSQL:
  - WAL archiving (continuous)
  - Base backup: daily
  - Retention: 30 days
  - Point-in-time recovery: yes

Redis:
  - RDB snapshots: every 5 minutes
  - AOF: every second
  - Retention: 24 hours

Object Storage (MinIO):
  - Versioning enabled
  - Cross-region replication (production)
  - Lifecycle policies for old objects
```

---

# 10. Non-Negotiable Database Rules

1. **Never store private keys in PostgreSQL.**
2. **Never store plaintext messages on the server.**
3. **Never use the database for ephemeral state (use Redis).**
4. **Never skip indexes on frequently queried columns.**
5. **Never allow unbounded table growth (use retention policies).**
6. **Never store user passwords (none should exist).**
7. **Never log sensitive database operations.**
8. **Never use dynamic SQL without parameterization.**
9. **Never skip transaction isolation for multi-step operations.**
10. **Never assume database uptime (implement retry and circuit breaker).**

---

*This document defines the complete database architecture for DipChats. Both server and client schemas are specified. All implementation must conform to these schemas.*
