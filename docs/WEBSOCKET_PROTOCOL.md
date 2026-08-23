# DIPCHATS — WEBSOCKET PROTOCOL

## WebSocket Events, Payloads, Authentication & Synchronization

**Protocol:** DipChats WebSocket Protocol
**Current Version:** `v1`
**Transport:** Secure WebSocket (`WSS`)
**Format:** JSON
**Encoding:** UTF-8

---

# 1. Overview

The DipChats WebSocket Protocol provides real-time communication between DipChats clients and the server.

It handles:

- Device key authentication (Ed25519 challenge-response)
- Real-time messages
- Channels
- Direct messages
- Presence
- Typing indicators
- Delivery receipts
- Read receipts
- Reactions
- Message edits
- Message deletion
- File attachment metadata
- Synchronization
- Mesh-compatible sync events
- Courier relay events
- Reconnection
- Error handling
- Device sessions

The WebSocket protocol is designed so the same message model can be used by the offline mesh transport and the courier relay network.

---

# 2. WebSocket Endpoint

Production:

```text
wss://server.example.com/ws
```

Development:

```text
ws://localhost:3000/ws
```

Clients should use:

```text
WSS
```

in production.

Plain `WS` should only be used for local development.

---

# 3. Protocol Version

Every WebSocket message contains:

```json
{
  "version": 1
}
```

This allows future protocol versions.

Example:

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "req_123",
  "payload": {}
}
```

Servers must reject unsupported protocol versions with a structured error.

---

# 4. Base Message Format

Every WebSocket frame uses this structure:

```json
{
  "version": 1,
  "type": "event.type",
  "request_id": "uuid",
  "timestamp": "2026-08-21T12:00:00.000Z",
  "payload": {}
}
```

Fields:

| Field        | Required      | Description               |
| ------------ | ------------- | ------------------------- |
| `version`    | Yes           | Protocol version          |
| `type`       | Yes           | Event type                |
| `request_id` | Usually       | Unique request identifier |
| `timestamp`  | Server events | Event timestamp           |
| `payload`    | Yes           | Event-specific data       |

---

# 5. Request IDs

Clients must generate a unique `request_id` for commands.

Example:

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "01JXYZ123",
  "payload": {}
}
```

The server should return the same `request_id` when responding.

This allows clients to associate responses with requests.

---

# 6. Connection Lifecycle

The connection lifecycle:

```text
CONNECT
   ↓
CONNECTED
   ↓
AUTHENTICATING
   ↓
AUTHENTICATED
   ↓
READY
   ↓
ACTIVE
   ↓
DISCONNECTING
   ↓
DISCONNECTED
```

---

# 7. Connection Establishment

Client connects:

```text
wss://server.example.com/ws
```

Server responds:

```json
{
  "version": 1,
  "type": "connection.ready",
  "request_id": null,
  "timestamp": "2026-08-21T12:00:00.000Z",
  "payload": {
    "connection_id": "conn_123",
    "server_time": "2026-08-21T12:00:00.000Z",
    "protocol_version": 1
  }
}
```

The client must authenticate after receiving `connection.ready`.

---

# 8. Authentication — Device Key Model

DipChats uses a **pure local identity model**. There are no accounts, no passwords, and no centralized credential stores. Every device generates its own Ed25519 key pair at installation time. The **public key** is the device's identity. The **private key** never leaves the device.

Authentication is performed via a **challenge-response** handshake using Ed25519 signatures.

## 8.1 Device Key Registration

When a device first connects, it registers its public key with the server.

Client:

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

The `public_key` is the Ed25519 public key encoded as base64. The `device_id` is a client-generated UUID.

Server stores the public key and responds:

```json
{
  "version": 1,
  "type": "auth.registered",
  "request_id": "req_reg_001",
  "timestamp": "2026-08-21T12:00:00.000Z",
  "payload": {
    "device_id": "device_a1b2c3",
    "registered_at": "2026-08-21T12:00:00.000Z",
    "key_fingerprint": "sha256_of_public_key"
  }
}
```

If the device is already registered, the server returns the existing registration without error (idempotent).

## 8.2 Challenge-Response Authentication

After connection, the client requests a challenge:

Client:

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

Server generates a random nonce and responds:

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

The challenge is a 16-byte random nonce, base64-encoded. It expires after 30 seconds.

## 8.3 Signing the Challenge

The client signs the challenge using its Ed25519 private key.

The signed payload is:

```text
SHA-512("DipChats Auth v1" || challenge || connection_id)
```

Client:

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

Fields:

| Field         | Required | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `device_id`   | Yes      | The device's identifier                         |
| `signature`   | Yes      | Ed25519 signature of the signed payload         |
| `connection_id` | Yes    | The connection ID from `connection.ready`       |

## 8.4 Server Verification

The server:

1. Retrieves the public key for `device_id`
2. Reconstructs the signed payload using the challenge and `connection_id`
3. Verifies the Ed25519 signature against the public key
4. Checks the challenge has not expired
5. Checks the challenge has not been replayed

## 8.5 Authentication Success

Server:

```json
{
  "version": 1,
  "type": "auth.authenticated",
  "request_id": "req_auth_001",
  "timestamp": "2026-08-21T12:00:02.000Z",
  "payload": {
    "device_id": "device_a1b2c3",
    "session_id": "session_789",
    "key_fingerprint": "sha256_of_public_key",
    "authenticated_at": "2026-08-21T12:00:02.000Z"
  }
}
```

Note: there is no `user_id` in the response. The device **is** the identity. All messages are attributed to `device_id`. Display names and avatars are managed locally or via profile events.

## 8.6 Authentication Failure

Server:

```json
{
  "version": 1,
  "type": "error",
  "request_id": "req_auth_001",
  "timestamp": "2026-08-21T12:00:02.000Z",
  "payload": {
    "code": "AUTH_SIGNATURE_INVALID",
    "message": "Signature verification failed"
  }
}
```

Possible failure codes:

```text
AUTH_SIGNATURE_INVALID     — signature does not match public key
AUTH_CHALLENGE_EXPIRED     — challenge nonce has expired
AUTH_CHALLENGE_REUSED      — challenge nonce was already used
AUTH_DEVICE_UNKNOWN        — device_id not registered
AUTH_DEVICE_REVOKED        — device key has been revoked
```

The server may close the connection after authentication failure.

## 8.7 Authentication Requirements

The server must never accept normal chat events from an unauthenticated connection.

Unauthenticated connections may only use limited events such as:

```text
connection.ready
auth.register
auth.challenge_request
auth.authenticate
```

All other events should return:

```text
AUTH_REQUIRED
```

## 8.8 Authentication State

Server-side connection state:

```text
Connection
├── connection_id
├── device_id
├── session_id
├── key_fingerprint
├── authenticated
├── connected_at
└── last_activity
```

---

# 9. Re-Authentication

If a session expires or is invalidated, the server sends:

```json
{
  "version": 1,
  "type": "auth.session_expired",
  "request_id": null,
  "timestamp": "2026-08-21T13:00:00.000Z",
  "payload": {
    "reason": "session_timeout"
  }
}
```

The client must re-authenticate using the challenge-response flow.

---

# 10. Device Revocation

If a device key is revoked (e.g., device compromised), the server sends:

```json
{
  "version": 1,
  "type": "auth.device_revoked",
  "request_id": null,
  "timestamp": "2026-08-21T14:00:00.000Z",
  "payload": {
    "device_id": "device_a1b2c3",
    "reason": "key_compromised"
  }
}
```

The server closes the connection immediately after this event.

---

# 11. Heartbeat

Clients and servers should maintain connection health.

Server:

```json
{
  "version": 1,
  "type": "connection.ping",
  "request_id": null,
  "timestamp": "2026-08-21T12:00:00.000Z",
  "payload": {}
}
```

Client:

```json
{
  "version": 1,
  "type": "connection.pong",
  "request_id": null,
  "timestamp": "2026-08-21T12:00:00.000Z",
  "payload": {}
}
```

If a connection stops responding, it should be considered unhealthy.

---

# 12. Reconnection

Clients must automatically reconnect after unexpected disconnection.

Use exponential backoff.

Example:

```text
1 second
2 seconds
4 seconds
8 seconds
16 seconds
30 seconds
```

The maximum retry delay should be configurable.

After reconnection:

```text
CONNECT
 ↓
AUTHENTICATE (challenge-response)
 ↓
SYNC
 ↓
RESUME
```

---

# 13. Message Sending

Client sends:

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "req_msg_001",
  "payload": {
    "client_message_id": "msg_client_123",
    "channel_id": "channel_general",
    "content": "Hello DipChats!"
  }
}
```

---

# 14. Client Message ID

Every message created by a client must have a:

```text
client_message_id
```

This is important for offline synchronization and retry deduplication.

Example:

```text
client_message_id = "01JXYZ..."
```

If the same message is submitted twice because of a reconnect, the server must recognize the duplicate.

---

# 15. Server Message Created

Server responds:

```json
{
  "version": 1,
  "type": "message.created",
  "request_id": "req_msg_001",
  "timestamp": "2026-08-21T12:00:01.000Z",
  "payload": {
    "message": {
      "id": "msg_987",
      "client_message_id": "msg_client_123",
      "channel_id": "channel_general",
      "sender_device": "device_a1b2c3",
      "content": "Hello DipChats!",
      "signature": "Ed25519SignatureBase64...",
      "created_at": "2026-08-21T12:00:01.000Z"
    }
  }
}
```

Note: messages include a `signature` field so that recipients can verify the message originated from the claimed device key.

---

# 16. Message Broadcast

Other connected members receive:

```json
{
  "version": 1,
  "type": "message.created",
  "request_id": null,
  "timestamp": "2026-08-21T12:00:01.000Z",
  "payload": {
    "message": {
      "id": "msg_987",
      "channel_id": "channel_general",
      "sender_device": "device_a1b2c3",
      "content": "Hello DipChats!",
      "signature": "Ed25519SignatureBase64...",
      "created_at": "2026-08-21T12:00:01.000Z"
    }
  }
}
```

---

# 17. Message Editing

Client:

```json
{
  "version": 1,
  "type": "message.edit",
  "request_id": "req_edit_001",
  "payload": {
    "message_id": "msg_987",
    "content": "Hello everyone!",
    "edit_signature": "Ed25519SignatureBase64..."
  }
}
```

The `edit_signature` covers the original `message_id` and the new `content`.

Server broadcasts:

```json
{
  "version": 1,
  "type": "message.updated",
  "request_id": null,
  "timestamp": "2026-08-21T12:01:00.000Z",
  "payload": {
    "message_id": "msg_987",
    "content": "Hello everyone!",
    "edited_at": "2026-08-21T12:01:00.000Z",
    "edit_signature": "Ed25519SignatureBase64..."
  }
}
```

Only the original sender device can edit messages. The server verifies the `edit_signature` against the original sender's public key.

---

# 18. Message Deletion

Client:

```json
{
  "version": 1,
  "type": "message.delete",
  "request_id": "req_delete_001",
  "payload": {
    "message_id": "msg_987",
    "delete_signature": "Ed25519SignatureBase64..."
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "message.deleted",
  "request_id": null,
  "timestamp": "2026-08-21T12:02:00.000Z",
  "payload": {
    "message_id": "msg_987",
    "deleted_at": "2026-08-21T12:02:00.000Z"
  }
}
```

Deletion behavior must be defined by the application's retention policy.

---

# 19. Message Replies

Client:

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "req_reply_001",
  "payload": {
    "client_message_id": "msg_client_124",
    "channel_id": "channel_general",
    "content": "Exactly!",
    "reply_to": "msg_987"
  }
}
```

The resulting message contains:

```json
{
  "reply_to": "msg_987"
}
```

---

# 20. Message Reactions

Add reaction:

```json
{
  "version": 1,
  "type": "message.react",
  "request_id": "req_reaction_001",
  "payload": {
    "message_id": "msg_987",
    "emoji": "👍"
  }
}
```

Server broadcasts:

```json
{
  "version": 1,
  "type": "message.reaction_added",
  "request_id": null,
  "timestamp": "2026-08-21T12:03:00.000Z",
  "payload": {
    "message_id": "msg_987",
    "device_id": "device_d4e5f6",
    "emoji": "👍"
  }
}
```

---

# 21. Channel Creation

Client:

```json
{
  "version": 1,
  "type": "channel.create",
  "request_id": "req_channel_001",
  "payload": {
    "name": "developers",
    "type": "PUBLIC",
    "description": "Development discussion"
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "channel.created",
  "request_id": "req_channel_001",
  "timestamp": "2026-08-21T12:05:00.000Z",
  "payload": {
    "channel": {
      "id": "channel_dev",
      "name": "developers",
      "type": "PUBLIC",
      "owner_device": "device_a1b2c3"
    }
  }
}
```

---

# 22. Join Channel

Client:

```json
{
  "version": 1,
  "type": "channel.join",
  "request_id": "req_join_001",
  "payload": {
    "channel_id": "channel_dev"
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "channel.joined",
  "request_id": "req_join_001",
  "timestamp": "2026-08-21T12:05:30.000Z",
  "payload": {
    "channel_id": "channel_dev",
    "device_id": "device_a1b2c3"
  }
}
```

---

# 23. Leave Channel

Client:

```json
{
  "version": 1,
  "type": "channel.leave",
  "request_id": "req_leave_001",
  "payload": {
    "channel_id": "channel_dev"
  }
}
```

---

# 24. Channel Events

Supported channel events:

```text
channel.create
channel.update
channel.delete

channel.join
channel.leave

channel.invite
channel.kick
channel.ban
channel.unban

channel.member_added
channel.member_removed
channel.member_updated
```

---

# 25. Direct Messages

Direct messages use the same message protocol.

Conceptually:

```text
Direct Conversation
        ↓
Internal Channel
        ↓
message.send
```

This keeps the message engine consistent.

---

# 26. Typing Indicators

Start typing:

```json
{
  "version": 1,
  "type": "typing.start",
  "request_id": "req_typing_001",
  "payload": {
    "channel_id": "channel_general"
  }
}
```

Stop typing:

```json
{
  "version": 1,
  "type": "typing.stop",
  "request_id": "req_typing_002",
  "payload": {
    "channel_id": "channel_general"
  }
}
```

Typing events should not be persisted to PostgreSQL.

---

# 27. Presence

Update presence:

```json
{
  "version": 1,
  "type": "presence.update",
  "request_id": "req_presence_001",
  "payload": {
    "status": "ONLINE"
  }
}
```

Supported statuses:

```text
ONLINE
IDLE
DND
INVISIBLE
OFFLINE
```

Server broadcasts:

```json
{
  "version": 1,
  "type": "presence.changed",
  "request_id": null,
  "timestamp": "2026-08-21T12:10:00.000Z",
  "payload": {
    "device_id": "device_d4e5f6",
    "status": "ONLINE"
  }
}
```

---

# 28. Delivery Receipts

Client confirms delivery:

```json
{
  "version": 1,
  "type": "message.delivered",
  "request_id": "req_delivery_001",
  "payload": {
    "message_id": "msg_987"
  }
}
```

Server can notify the sender:

```json
{
  "version": 1,
  "type": "message.delivery_updated",
  "request_id": null,
  "timestamp": "2026-08-21T12:11:00.000Z",
  "payload": {
    "message_id": "msg_987",
    "device_id": "device_d4e5f6",
    "status": "DELIVERED"
  }
}
```

---

# 29. Read Receipts

Client:

```json
{
  "version": 1,
  "type": "message.read",
  "request_id": "req_read_001",
  "payload": {
    "channel_id": "channel_general",
    "message_id": "msg_987"
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "message.read_updated",
  "request_id": null,
  "timestamp": "2026-08-21T12:12:00.000Z",
  "payload": {
    "channel_id": "channel_general",
    "message_id": "msg_987",
    "device_id": "device_d4e5f6"
  }
}
```

---

# 30. Message History

History should primarily be fetched through HTTP APIs.

Example:

```text
GET /channels/:channel_id/messages
```

WebSocket synchronization is used for real-time changes and missing events.

Clients can request synchronization:

```json
{
  "version": 1,
  "type": "sync.request",
  "request_id": "req_sync_001",
  "payload": {
    "cursor": "cursor_123",
    "limit": 100
  }
}
```

---

# 31. Synchronization Response

Server:

```json
{
  "version": 1,
  "type": "sync.response",
  "request_id": "req_sync_001",
  "timestamp": "2026-08-21T12:15:00.000Z",
  "payload": {
    "messages": [],
    "events": [],
    "next_cursor": "cursor_456",
    "has_more": false
  }
}
```

---

# 32. Synchronization Model

Each device maintains:

```text
last_sync_cursor
```

Example:

```text
Device
│
├── last_sync_cursor
├── last_message_id
└── last_server_sequence
```

On reconnect:

```text
CONNECT
   ↓
AUTHENTICATE (challenge-response)
   ↓
SYNC REQUEST
   ↓
MISSING EVENTS
   ↓
APPLY EVENTS
   ↓
READY
```

---

# 33. Server Sequence Numbers

The server may assign monotonically increasing sequence numbers to events.

Example:

```json
{
  "sequence": 10045,
  "type": "message.created"
}
```

This helps clients detect gaps.

Example:

```text
Received:
100
101
103
```

The client knows:

```text
102 is missing
```

and can request synchronization.

---

# 34. Offline Messages

Messages created offline should retain their client-generated identity and be signed by the device key.

Example:

```json
{
  "client_message_id": "offline_msg_123",
  "created_at": "2026-08-21T12:20:00.000Z",
  "channel_id": "channel_general",
  "content": "Created while offline",
  "signature": "Ed25519SignatureBase64..."
}
```

When connectivity returns:

```text
Local Queue
     ↓
Sync Engine
     ↓
Server
     ↓
Deduplicate
     ↓
Persist
     ↓
Broadcast
```

---

# 35. Idempotency

`client_message_id` provides idempotency.

If:

```text
client_message_id = abc123
```

has already been processed, the server must not create another logical message.

Instead return the existing message identity.

---

# 36. File Attachments

Files should not normally be transmitted over WebSockets.

Client first uploads:

```text
POST /files/upload
```

The resulting metadata can then be included in:

```text
message.send
```

Example:

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "req_file_msg_001",
  "payload": {
    "client_message_id": "msg_456",
    "channel_id": "channel_general",
    "content": "Check this file.",
    "attachments": [
      {
        "id": "file_123",
        "name": "photo.jpg",
        "mime": "image/jpeg",
        "size": 1827364,
        "sha256": "HASH"
      }
    ]
  }
}
```

---

# 37. Error Format

All errors use:

```json
{
  "version": 1,
  "type": "error",
  "request_id": "req_123",
  "timestamp": "2026-08-21T12:30:00.000Z",
  "payload": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

---

# 38. Error Codes

Authentication:

```text
AUTH_REQUIRED
AUTH_SIGNATURE_INVALID
AUTH_CHALLENGE_EXPIRED
AUTH_CHALLENGE_REUSED
AUTH_DEVICE_UNKNOWN
AUTH_DEVICE_REVOKED
AUTH_SESSION_EXPIRED
```

Authorization:

```text
PERMISSION_DENIED
CHANNEL_ACCESS_DENIED
MESSAGE_ACCESS_DENIED
```

Messages:

```text
MESSAGE_INVALID
MESSAGE_NOT_FOUND
MESSAGE_ALREADY_EXISTS
MESSAGE_TOO_LARGE
MESSAGE_RATE_LIMITED
```

Channels:

```text
CHANNEL_NOT_FOUND
CHANNEL_ALREADY_EXISTS
CHANNEL_BANNED
CHANNEL_MEMBER_REQUIRED
```

Mesh:

```text
MESH_ROUTE_UNAVAILABLE
MESH_TTL_EXPIRED
MESH_DUPLICATE_PACKET
MESH_SIGNATURE_INVALID
```

Courier:

```text
COURIER_RELAY_UNAVAILABLE
COURIER_PAYLOAD_TOO_LARGE
COURIER_SIGNATURE_INVALID
COURIER_RELAY_FAILED
```

Network:

```text
RATE_LIMITED
PAYLOAD_TOO_LARGE
UNSUPPORTED_VERSION
INVALID_EVENT
```

---

# 39. Payload Validation

Every incoming event must be validated.

Example:

```text
message.send
```

must validate:

```text
version
request_id
channel_id
client_message_id
content
attachments
signature
```

Reject unknown or malformed values according to the protocol policy.

---

# 40. Payload Size Limits

WebSocket payloads must have a maximum size.

Large data such as:

```text
videos
large images
documents
archives
```

must use file upload infrastructure.

The exact limit should be configurable.

Example development limit:

```text
1 MB WebSocket payload
```

---

# 41. Rate Limiting

Rate-limit:

```text
message.send
typing.start
presence.update
channel.create
channel.join
file operations
sync.request
```

Typing and presence events should have aggressive coalescing/debouncing.

---

# 42. Mesh-Compatible Sync Events

The WebSocket protocol defines events that are also valid in the mesh transport. These events allow devices to synchronize state when they reconnect after an offline period.

## 42.1 Mesh Sync Request

Client requests mesh state from the server:

```json
{
  "version": 1,
  "type": "mesh.sync_request",
  "request_id": "req_mesh_001",
  "payload": {
    "last_known_sequence": 10045,
    "channel_ids": ["channel_general", "channel_dev"],
    "limit": 200
  }
}
```

## 42.2 Mesh Sync Response

Server:

```json
{
  "version": 1,
  "type": "mesh.sync_response",
  "request_id": "req_mesh_001",
  "timestamp": "2026-08-21T12:15:00.000Z",
  "payload": {
    "events": [],
    "next_sequence": 10099,
    "has_more": false,
    "server_time": "2026-08-21T12:15:00.000Z"
  }
}
```

## 42.3 Mesh Packet Relay

When a device sends a message to a device that is offline, the server may relay the packet through the mesh:

```json
{
  "version": 1,
  "type": "mesh.packet_relay",
  "request_id": null,
  "timestamp": "2026-08-21T12:20:00.000Z",
  "payload": {
    "packet_id": "pkt_abc123",
    "origin_device": "device_a1b2c3",
    "destination_device": "device_x9y8z7",
    "ttl": 10,
    "hop_count": 0,
    "relay_device": "device_d4e5f6",
    "payload_hash": "sha256_of_inner_payload"
  }
}
```

## 42.4 Mesh Packet Acknowledgment

When a device receives a mesh-relayed packet, it acknowledges:

```json
{
  "version": 1,
  "type": "mesh.packet_ack",
  "request_id": "req_ack_001",
  "payload": {
    "packet_id": "pkt_abc123",
    "signature": "Ed25519SignatureBase64..."
  }
}
```

The signature covers the `packet_id` so the origin device can verify the ack is genuine.

## 42.5 Mesh State Broadcast

Server notifies devices of state changes relevant to mesh routing:

```json
{
  "version": 1,
  "type": "mesh.state_broadcast",
  "request_id": null,
  "timestamp": "2026-08-21T12:25:00.000Z",
  "payload": {
    "online_devices": ["device_a1b2c3", "device_d4e5f6"],
    "offline_devices": ["device_x9y8z7"],
    "relay_capacity": {
      "device_d4e5f6": 0.85
    }
  }
}
```

---

# 43. Courier Relay Events

The courier system allows devices to relay messages for offline peers. Couriers are devices that have agreed to store and forward messages.

## 43.1 Courier Registration

A device registers as a courier:

```json
{
  "version": 1,
  "type": "courier.register",
  "request_id": "req_courier_001",
  "payload": {
    "device_id": "device_a1b2c3",
    "max_payload_bytes": 1048576,
    "max_relay_count": 50,
    "ttl_seconds": 86400,
    "supported_channels": ["channel_general"]
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "courier.registered",
  "request_id": "req_courier_001",
  "timestamp": "2026-08-21T12:30:00.000Z",
  "payload": {
    "device_id": "device_a1b2c3",
    "courier_id": "courier_001",
    "registered_at": "2026-08-21T12:30:00.000Z"
  }
}
```

## 43.2 Courier Store

Server tells a courier to store a message for an offline device:

```json
{
  "version": 1,
  "type": "courier.store",
  "request_id": null,
  "timestamp": "2026-08-21T12:35:00.000Z",
  "payload": {
    "courier_id": "courier_001",
    "message_id": "msg_987",
    "target_device": "device_x9y8z7",
    "payload": {},
    "signature": "Ed25519SignatureBase64...",
    "expires_at": "2026-08-22T12:35:00.000Z"
  }
}
```

## 43.3 Courier Delivered

Courier confirms storage:

```json
{
  "version": 1,
  "type": "courier.stored",
  "request_id": "req_store_001",
  "timestamp": "2026-08-21T12:35:01.000Z",
  "payload": {
    "message_id": "msg_987",
    "courier_id": "courier_001",
    "stored_at": "2026-08-21T12:35:01.000Z"
  }
}
```

## 43.4 Courier Forward

When the target device comes online, the courier forwards the message:

```json
{
  "version": 1,
  "type": "courier.forward",
  "request_id": null,
  "timestamp": "2026-08-21T14:00:00.000Z",
  "payload": {
    "message_id": "msg_987",
    "courier_id": "courier_001",
    "target_device": "device_x9y8z7",
    "payload": {},
    "signature": "Ed25519SignatureBase64...",
    "forward_signature": "Ed25519SignatureBase64..."
  }
}
```

The `forward_signature` is signed by the courier device, proving the relay path.

## 43.5 Courier Acknowledgment

Target device acknowledges receipt:

```json
{
  "version": 1,
  "type": "courier.ack",
  "request_id": "req_courier_ack_001",
  "payload": {
    "message_id": "msg_987",
    "courier_id": "courier_001",
    "ack_signature": "Ed25519SignatureBase64..."
  }
}
```

## 43.6 Courier Prune

Server tells a courier to discard expired messages:

```json
{
  "version": 1,
  "type": "courier.prune",
  "request_id": null,
  "timestamp": "2026-08-22T12:35:00.000Z",
  "payload": {
    "message_ids": ["msg_987", "msg_988"],
    "reason": "expired"
  }
}
```

---

# 44. Event Categories

## Connection

```text
connection.ready
connection.ping
connection.pong
connection.error
```

## Authentication

```text
auth.register
auth.registered
auth.challenge_request
auth.challenge
auth.authenticate
auth.authenticated
auth.session_expired
auth.device_revoked
auth.logout
```

## Channels

```text
channel.create
channel.update
channel.delete
channel.join
channel.leave
channel.invite
channel.kick
channel.ban
```

## Messages

```text
message.send
message.created
message.edit
message.updated
message.delete
message.deleted
message.react
message.reaction_added
message.reaction_removed
message.reply
```

## Delivery

```text
message.delivered
message.delivery_updated
message.read
message.read_updated
```

## Presence

```text
presence.update
presence.changed
```

## Typing

```text
typing.start
typing.stop
```

## Synchronization

```text
sync.request
sync.response
sync.required
```

## Mesh

```text
mesh.sync_request
mesh.sync_response
mesh.packet_relay
mesh.packet_ack
mesh.state_broadcast
```

## Courier

```text
courier.register
courier.registered
courier.store
courier.stored
courier.forward
courier.ack
courier.prune
```

## Devices

```text
device.register
device.revoked
device.updated
```

---

# 45. Server Event vs Client Command

The protocol distinguishes commands from server events.

### Client command

```text
message.send
```

### Server event

```text
message.created
```

This distinction makes the protocol easier to debug and synchronize.

---

# 46. Request/Response Pattern

Example:

```text
CLIENT
  │
  │ channel.create
  │ request_id=123
  ▼
SERVER
  │
  │ channel.created
  │ request_id=123
  ▼
CLIENT
```

Events that are broadcast to multiple clients do not need a request ID.

---

# 47. Broadcast Rules

A message event should only be delivered to authorized members of the relevant conversation.

Example:

```text
Channel A
├── Device 1
├── Device 2
└── Device 3
```

A message in Channel A must not be broadcast to:

```text
Device 4
Device 5
```

unless they are authorized members.

---

# 48. Multiple Device Delivery

If a user has multiple devices:

```text
PC
Phone
Tablet
```

the server may deliver the message to all active authorized devices.

Each device has:

```text
device_id
```

Delivery tracking should distinguish between devices where required.

---

# 49. Device Synchronization

Example:

```text
             Owner
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
      PC     Phone   Tablet
       │       │       │
       └───────┼───────┘
               ▼
          Sync Engine
```

A message read on one device may update read state for other devices according to application policy.

---

# 50. Disconnect Handling

When a WebSocket disconnects:

```text
Connection
    ↓
Disconnected
    ↓
Presence update
    ↓
Pending state preserved
```

The server should not immediately delete durable session/device information.

---

# 51. Reconnection State

The client should preserve:

```text
last_sync_cursor
pending_messages
client_message_ids
last_known_server_sequence
device_private_key
```

This allows reliable recovery.

---

# 52. Synchronization After Reconnect

Recommended sequence:

```text
1. Connect
2. Authenticate (challenge-response)
3. Send last sync cursor
4. Receive missing events
5. Apply events
6. Upload pending offline messages
7. Receive acknowledgements
8. Update cursor
9. Enter READY state
```

---

# 53. Offline Mesh Compatibility

The WebSocket protocol shares the same core message envelope with the mesh protocol.

For example:

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "req_123",
  "payload": {
    "signature": "Ed25519SignatureBase64..."
  }
}
```

The transport changes:

```text
WebSocket
```

or:

```text
Mesh
```

but the message model remains consistent. Every message carries a device signature so authenticity can be verified regardless of transport.

---

# 54. Mesh-Specific Metadata

Mesh packets add a transport envelope around the normal message.

Example:

```json
{
  "protocol_version": 1,
  "transport": "mesh",
  "message_id": "msg_123",
  "origin_device": "device_A",
  "destination_device": "device_D",
  "ttl": 10,
  "hop_count": 2,
  "signature": "Ed25519SignatureBase64...",
  "payload": {}
}
```

Mesh metadata must not expose private message content unnecessarily. The `signature` field allows verification without decryption.

---

# 55. Security

Production connections must use:

```text
TLS
WSS
```

Device private keys must never be logged, transmitted, or stored on the server.

All sensitive message contents should be encrypted according to the DipChats security architecture.

WebSocket clients must validate server certificates normally.

Ed25519 signatures provide:

- Message authenticity (proof of sender device)
- Message integrity (tamper detection)
- Non-repudiation (device cannot deny sending)

---

# 56. Replay Protection

Messages and commands should not be accepted indefinitely.

Use:

```text
request_id
client_message_id
timestamps
server sequence numbers
cryptographic signatures
challenge nonces
```

where appropriate.

Duplicate commands should not cause duplicate side effects.

Challenge nonces are single-use and time-limited to prevent replay attacks on authentication.

---

# 57. Connection Limits

Servers should enforce:

```text
maximum connections per device
maximum devices per key fingerprint
maximum connections per IP
maximum message rate
maximum payload size
```

Limits should be configurable.

---

# 58. Protocol Compatibility

Future versions should preserve backward compatibility where possible.

Example:

```text
v1
v2
v3
```

Clients should advertise:

```json
{
  "supported_versions": [1]
}
```

The server selects a compatible version.

---

# 59. Protocol State Machine

```text
                    CONNECT
                       │
                       ▼
                  CONNECTION_READY
                       │
                       ▼
                  AUTHENTICATE (challenge-response)
                    /       \
                  FAIL      SUCCESS
                   │           │
                   ▼           ▼
                 CLOSE        READY
                               │
                               ▼
                             SYNC
                               │
                               ▼
                             ACTIVE
                               │
                    ┌──────────┴──────────┐
                    │                     │
                 MESSAGE               NETWORK
                    │                   FAILURE
                    │                     │
                    ▼                     ▼
                 DELIVERY              OFFLINE
                                          │
                                          ▼
                                       RECONNECT
                                          │
                                          ▼
                                         SYNC
```

---

# 60. Recommended Client Architecture

```text
WebSocketClient
│
├── ConnectionManager
├── DeviceKeyManager (Ed25519 key pair)
├── ChallengeResponseAuth
├── EventRouter
├── RequestManager
├── MessageManager
├── PresenceManager
├── SyncManager
├── MeshSyncManager
├── CourierManager
└── ErrorManager
```

---

# 61. Recommended Server Architecture

```text
WebSocket Gateway
│
├── ConnectionManager
├── ChallengeResponseAuthMiddleware
├── EventValidator
├── EventRouter
├── RateLimiter
├── ChannelAuthorizer
├── MessageService
├── PresenceService
├── SyncService
├── MeshRelayService
└── CourierService
```

---

# 62. Event Router

The server should route events based on type.

Conceptually:

```text
Incoming Event
      │
      ▼
Validate Envelope
      │
      ▼
Authenticate (Ed25519)
      │
      ▼
Authorize
      │
      ▼
Event Router
      │
 ┌────┼──────────┐
 ▼    ▼          ▼
Msg  Channel   Presence
 │              │
 ▼              ▼
Mesh           Courier
```

---

# 63. Database Persistence Rule

For persistent events:

```text
Validate
   ↓
Authorize
   ↓
Persist
   ↓
Publish
   ↓
Acknowledge
```

Do not acknowledge durable operations before persistence succeeds.

---

# 64. Real-Time Delivery Rule

Real-time delivery should be treated as a separate concern from persistence.

```text
Persistence
     │
     ▼
Event
     │
     ├── WebSocket Client A
     ├── WebSocket Client B
     ├── Mesh Relay
     └── Courier Queue
```

If a client is offline, synchronization later recovers the event.

---

# 65. Observability

Track:

```text
websocket_connections
websocket_disconnects
authentication_failures
challenge_generations
challenge_verifications
messages_sent
messages_received
messages_failed
delivery_latency
sync_requests
sync_failures
mesh_relay_count
courier_store_count
courier_forward_count
rate_limit_events
```

Each request should have a `request_id` for tracing.

---

# 66. Protocol Testing

Tests must cover:

### Authentication

```text
valid Ed25519 signature
invalid signature
expired challenge
replayed challenge
unknown device
revoked device
```

### Messages

```text
send
edit
delete
reply
reaction
duplicate
invalid payload
unauthorized channel
invalid signature
```

### Connection

```text
connect
disconnect
reconnect
heartbeat
timeout
```

### Synchronization

```text
missing events
cursor recovery
duplicate events
offline messages
out-of-order messages
```

### Mesh

```text
sync request/response
packet relay
packet acknowledgment
TTL expiration
duplicate packet detection
```

### Courier

```text
store
forward
ack
prune
expired payload
relay failure
```

---

# 67. Example Complete Conversation

### Client A — Challenge-Response

```json
{
  "version": 1,
  "type": "auth.challenge_request",
  "request_id": "req_ch_100",
  "payload": {
    "device_id": "device_a1b2c3"
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "auth.challenge",
  "request_id": "req_ch_100",
  "timestamp": "2026-08-21T12:40:00.000Z",
  "payload": {
    "challenge": "random_nonce_base64_128bit",
    "expires_at": "2026-08-21T12:40:30.000Z"
  }
}
```

Client A signs and authenticates:

```json
{
  "version": 1,
  "type": "auth.authenticate",
  "request_id": "req_auth_100",
  "payload": {
    "device_id": "device_a1b2c3",
    "signature": "Ed25519SignatureBase64...",
    "connection_id": "conn_123"
  }
}
```

Server:

```json
{
  "version": 1,
  "type": "auth.authenticated",
  "request_id": "req_auth_100",
  "timestamp": "2026-08-21T12:40:01.000Z",
  "payload": {
    "device_id": "device_a1b2c3",
    "session_id": "session_100",
    "key_fingerprint": "sha256_of_public_key",
    "authenticated_at": "2026-08-21T12:40:01.000Z"
  }
}
```

### Client A sends a message

```json
{
  "version": 1,
  "type": "message.send",
  "request_id": "req_100",
  "payload": {
    "client_message_id": "client_msg_100",
    "channel_id": "general",
    "content": "Hello!",
    "signature": "Ed25519SignatureBase64..."
  }
}
```

### Server

```json
{
  "version": 1,
  "type": "message.created",
  "request_id": "req_100",
  "timestamp": "2026-08-21T12:40:02.000Z",
  "payload": {
    "message": {
      "id": "msg_100",
      "client_message_id": "client_msg_100",
      "channel_id": "general",
      "sender_device": "device_a1b2c3",
      "content": "Hello!",
      "signature": "Ed25519SignatureBase64...",
      "created_at": "2026-08-21T12:40:02.000Z"
    }
  }
}
```

### Client B receives the same

```json
{
  "version": 1,
  "type": "message.created",
  "request_id": null,
  "timestamp": "2026-08-21T12:40:02.000Z",
  "payload": {
    "message": {
      "id": "msg_100",
      "channel_id": "general",
      "sender_device": "device_a1b2c3",
      "content": "Hello!",
      "signature": "Ed25519SignatureBase64..."
    }
  }
}
```

### Client B sends delivery receipt

```json
{
  "version": 1,
  "type": "message.delivered",
  "request_id": "req_101",
  "payload": {
    "message_id": "msg_100"
  }
}
```

### Client B reads it

```json
{
  "version": 1,
  "type": "message.read",
  "request_id": "req_102",
  "payload": {
    "channel_id": "general",
    "message_id": "msg_100"
  }
}
```

---

# 68. Implementation Requirements

The implementation must:

- Use real WebSocket connections.
- Validate every incoming event.
- Authenticate connections via Ed25519 challenge-response before normal operations.
- Verify message signatures on all persistent events.
- Authorize every protected resource.
- Use unique request IDs.
- Use client-generated message IDs.
- Support idempotent message creation.
- Support reconnection.
- Support synchronization.
- Support mesh-compatible sync events.
- Support courier relay events.
- Persist durable messages.
- Separate persistence from delivery.
- Support multiple devices.
- Support structured errors.
- Support protocol versioning.
- Protect against oversized payloads.
- Rate-limit abusive clients.
- Avoid exposing sensitive data.
- Never store or log private keys.
- Keep the protocol compatible with the mesh transport.

---

# 69. Non-Negotiable Rules

1. **Never trust WebSocket input.**
2. **Never accept unauthenticated chat operations.**
3. **Never store device private keys on the server.**
4. **Never log device private keys or challenge nonces.**
5. **Never use timestamps as the only message identity.**
6. **Never create duplicate messages after retries.**
7. **Never send large files through WebSockets unnecessarily.**
8. **Never acknowledge persistence before durable storage succeeds.**
9. **Never broadcast messages to unauthorized devices.**
10. **Never allow unlimited payload sizes.**
11. **Never allow unlimited message rates.**
12. **Never assume clients remain connected.**
13. **Never assume Internet connectivity.**
14. **Never make WebSocket logic dependent on the mesh implementation.**
15. **Keep the core message protocol transport-independent.**
16. **Never accept a message without a valid device signature for persistent events.**

---

# 70. Final Protocol Architecture

```text
                         DIPCHATS PROTOCOL
                                │
                       ┌────────┴────────┐
                       │                 │
                    ONLINE            OFFLINE
                       │                 │
                    WebSocket           Mesh
                       │                 │
                       └────────┬────────┘
                                │
                         Common Message
                            Envelope
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         Authentication     Messaging           Sync
              │                 │                 │
              ▼                 ▼                 ▼
          Challenge-        Channels          Cursors
          Response          Messages          Recovery
          Ed25519           Presence          Offline Queue
          Device Keys       Receipts
                                │
                                ▼
                         Client Message Store
                                │
                                ▼
                              UI
```

**DipChats WebSocket Protocol is the real-time backbone of the platform, using device-key authentication with Ed25519 signatures and remaining deliberately transport-independent so the same messaging architecture can operate through the offline mesh network and the courier relay system.**
