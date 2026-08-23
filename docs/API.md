# DIPCHATS — REST API SPECIFICATION

## Pure Local Identity Communication Platform

**Version:** 1.0.0
**Base URL:** `https://api.dipchats.example.com`
**Protocol:** HTTPS (TLS 1.3 required)
**Format:** JSON
**Encoding:** UTF-8

---

# 1. Base URL and Versioning

## 1.1 Base URL

All API requests are made to:

```text
Production:  https://api.dipchats.example.com
Development: http://localhost:4000
```

## 1.2 Versioning

The API is versioned via URL path prefix:

```text
https://api.dipchats.example.com/v1/channels
```

- Current version: `v1`
- Deprecated versions are announced 90 days before removal
- Unsupported versions return `410 Gone`

## 1.3 Content Types

All requests and responses use:

```text
Content-Type: application/json; charset=utf-8
Accept: application/json
```

Binary payloads (file uploads) use the appropriate multipart type documented under the Files section.

## 1.4 Request ID

Every response includes a `X-Request-ID` header. Clients may send their own via `X-Request-ID` for tracing.

```text
X-Request-ID: req_01JXYZABCDEF00000000001
```

## 1.5 CORS

```text
Access-Control-Allow-Origin: https://app.dipchats.example.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-ID, X-Device-ID
Access-Control-Max-Age: 86400
```

---

# 2. Authentication

## 2.1 Identity Model

DipChats has **no accounts, no passwords, no registration**. Identity is a device-generated Ed25519 signing key pair. The server authenticates devices by verifying Ed25519 signatures on challenge-response flows.

## 2.2 Challenge-Response Flow

### Step 1: Request Challenge

```text
POST /v1/auth/challenge
```

**Request:**

```json
{
  "device_id": "a1b2c3d4e5f60718",
  "timestamp": 1724246400000
}
```

**Response `200 OK`:**

```json
{
  "challenge": "3af8c1b2e94d706f18a2b5c3d7e9f0123456789abcdef0123456789abcdef01",
  "expires_at": "2026-08-21T12:01:00.000Z"
}
```

The challenge is a random 32-byte nonce hex-encoded. It expires in 60 seconds.

### Step 2: Sign Challenge and Verify

The client signs `challenge || timestamp` with its Ed25519 signing private key, then submits:

```text
POST /v1/auth/verify
```

**Request:**

```json
{
  "device_id": "a1b2c3d4e5f60718",
  "challenge": "3af8c1b2e94d706f18a2b5c3d7e9f0123456789abcdef0123456789abcdef01",
  "timestamp": 1724246400000,
  "signature": "base64-encoded-ed25519-signature-of-challenge-plus-timestamp"
}
```

**Response `200 OK`:**

```json
{
  "session_token": "dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4",
  "expires_at": "2026-08-21T13:00:00.000Z",
  "device_id": "a1b2c3d4e5f60718"
}
```

### Step 3: Authenticate Subsequent Requests

Include the session token in the `Authorization` header:

```text
Authorization: Bearer dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
```

### Step 4: Token Refresh

When the token is near expiry, repeat the challenge-response flow to obtain a fresh token. The old token remains valid until its `expires_at`.

## 2.3 Token Lifecycle

```text
Generated (1 hour TTL)
    │
    ├── Valid → Refresh with new challenge-response
    │
    ├── Expired → Must re-authenticate from scratch
    │
    └── Revoked → Device wiped or status changed
```

## 2.4 Error Responses

| Scenario | HTTP Status | Code |
|----------|------------|------|
| Unknown device_id | `404` | `AUTH_DEVICE_NOT_FOUND` |
| Expired challenge | `401` | `AUTH_CHALLENGE_EXPIRED` |
| Invalid signature | `401` | `AUTH_INVALID_SIGNATURE` |
| Expired token | `401` | `AUTH_EXPIRED` |
| Revoked device | `401` | `AUTH_DEVICE_REVOKED` |

---

# 3. Device Endpoints

## 3.1 Register Device

```text
POST /v1/devices/register
```

**Request:**

```json
{
  "device_id": "a1b2c3d4e5f60718",
  "identity_public_key": "base64-encoded-x25519-32-byte-public-key",
  "signing_public_key": "base64-encoded-ed25519-32-byte-public-key",
  "fingerprint": "base64-encoded-sha256-32-byte-hash",
  "display_name": "Alice's Phone",
  "display_avatar": null,
  "protocol_version": 1,
  "platform": "ios",
  "app_version": "1.2.0"
}
```

**Response `201 Created`:**

```json
{
  "device_id": "a1b2c3d4e5f60718",
  "display_name": "Alice's Phone",
  "display_avatar": null,
  "fingerprint": "base64-encoded-sha256-32-byte-hash",
  "registered_at": "2026-08-21T12:00:00.000Z",
  "last_seen": "2026-08-21T12:00:00.000Z",
  "status": "active",
  "protocol_version": 1,
  "platform": "ios",
  "app_version": "1.2.0"
}
```

**Rules:**
- The `device_id` is derived client-side as the first 8 bytes of `SHA-256(identity_public_key)`.
- `identity_public_key` and `signing_public_key` are 32-byte Ed25519/X25519 public keys, base64-encoded.
- The server never receives or stores private keys.
- Duplicate `device_id` or `identity_public_key` returns `409 CONFLICT`.
- This endpoint requires no authentication (device is registering for the first time).

## 3.2 List Devices

```text
GET /v1/devices
Authorization: Bearer <token>
```

**Response `200 OK`:**

```json
{
  "devices": [
    {
      "device_id": "a1b2c3d4e5f60718",
      "display_name": "Alice's Phone",
      "display_avatar": "https://cdn.example.com/avatars/alice.jpg",
      "fingerprint": "base64-encoded-sha256-hash",
      "signing_public_key": "base64-encoded-ed25519-public-key",
      "identity_public_key": "base64-encoded-x25519-public-key",
      "platform": "ios",
      "app_version": "1.2.0",
      "protocol_version": 1,
      "registered_at": "2026-08-21T12:00:00.000Z",
      "last_seen": "2026-08-21T12:05:00.000Z",
      "status": "active"
    }
  ]
}
```

**Rules:**
- Only returns devices belonging to the authenticated session's owner.
- The response includes public keys so other clients can encrypt for these devices.

## 3.3 Delete Device

```text
DELETE /v1/devices/:device_id
Authorization: Bearer <token>
```

**Response `204 No Content`**

**Rules:**
- A device can only delete itself.
- Deleting a device revokes all its sessions and marks it as `deleted`.
- This operation is irreversible.
- The server retains ciphertext sent by this device but it becomes unreadable without the device's private key.

---

# 4. Channel Endpoints

## 4.1 List Channels

```text
GET /v1/channels?type=group&limit=20&cursor=<cursor>
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `string` | all | Filter by `dm`, `group`, or `broadcast` |
| `limit` | `integer` | 20 | Max results (1-100) |
| `cursor` | `string` | — | Pagination cursor from previous response |

**Response `200 OK`:**

```json
{
  "channels": [
    {
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "developers",
      "description": "Development discussion",
      "type": "group",
      "owner_id": "a1b2c3d4e5f60718",
      "is_encrypted": true,
      "max_members": 1000,
      "message_ttl": null,
      "created_at": "2026-08-20T10:00:00.000Z",
      "updated_at": "2026-08-21T11:30:00.000Z",
      "archived_at": null,
      "member_count": 42,
      "role": "member"
    }
  ],
  "next_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJjcmVhdGVkX2F0IjoiMjAyNi0wOC0yMFQxMDowMDowMFoifQ==",
  "has_more": true
}
```

## 4.2 Create Channel

```text
POST /v1/channels
Authorization: Bearer <token>
```

**Request:**

```json
{
  "name": "developers",
  "description": "Development discussion",
  "type": "group",
  "is_encrypted": true,
  "max_members": 1000,
  "message_ttl": null
}
```

**Response `201 Created`:**

```json
{
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "developers",
  "description": "Development discussion",
  "type": "group",
  "owner_id": "a1b2c3d4e5f60718",
  "is_encrypted": true,
  "max_members": 1000,
  "message_ttl": null,
  "created_at": "2026-08-21T12:00:00.000Z",
  "updated_at": "2026-08-21T12:00:00.000Z",
  "archived_at": null
}
```

**Rules:**
- The authenticated device becomes the `owner`.
- `type` must be one of `dm`, `group`, `broadcast`.
- `dm` channels require exactly 2 members; creation auto-adds the second device via `member_id` parameter.
- `broadcast` channels restrict message sending to the owner and admins.
- Channel names are case-insensitive within the same type.

## 4.3 Get Channel

```text
GET /v1/channels/:channel_id
Authorization: Bearer <token>
```

**Response `200 OK`:**

```json
{
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "developers",
  "description": "Development discussion",
  "type": "group",
  "owner_id": "a1b2c3d4e5f60718",
  "is_encrypted": true,
  "max_members": 1000,
  "message_ttl": null,
  "created_at": "2026-08-20T10:00:00.000Z",
  "updated_at": "2026-08-21T11:30:00.000Z",
  "archived_at": null,
  "member_count": 42,
  "role": "admin"
}
```

## 4.4 Update Channel

```text
PATCH /v1/channels/:channel_id
Authorization: Bearer <token>
```

**Request:**

```json
{
  "name": "dev-team",
  "description": "Updated description"
}
```

**Response `200 OK`:** Returns the full updated channel object.

**Rules:**
- Only the owner or admins can update channel properties.
- `type` cannot be changed after creation.
- `owner_id` cannot be changed (use transfer ownership flow).

## 4.5 Delete Channel

```text
DELETE /v1/channels/:channel_id
Authorization: Bearer <token>
```

**Response `204 No Content`**

**Rules:**
- Only the channel owner can delete.
- All messages and memberships are soft-deleted (messages marked with `deleted_at`).
- File attachments remain until their TTL expires.

## 4.6 Join Channel

```text
POST /v1/channels/:channel_id/join
Authorization: Bearer <token>
```

**Request (optional):**

```json
{
  "invite_code": "optional-invite-code"
}
```

**Response `200 OK`:**

```json
{
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "a1b2c3d4e5f60718",
  "role": "member",
  "joined_at": "2026-08-21T12:00:00.000Z",
  "status": "active"
}
```

**Rules:**
- `broadcast` channels may require an invite code.
- `dm` channels cannot be joined (members are added directly by the owner).
- Maximum member limit is enforced.
- Banned devices cannot rejoin.

## 4.7 Leave Channel

```text
POST /v1/channels/:channel_id/leave
Authorization: Bearer <token>
```

**Response `204 No Content`**

**Rules:**
- Channel owners cannot leave without transferring ownership first.
- Leaving sets `status` to `left` and records `left_at`.

## 4.8 List Members

```text
GET /v1/channels/:channel_id/members?limit=50&cursor=<cursor>&status=active
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `integer` | 50 | Max results (1-100) |
| `cursor` | `string` | — | Pagination cursor |
| `status` | `string` | `active` | Filter by `active`, `banned`, `muted`, `kicked`, `left` |
| `role` | `string` | all | Filter by `owner`, `admin`, `moderator`, `member` |

**Response `200 OK`:**

```json
{
  "members": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "device_id": "a1b2c3d4e5f60718",
      "role": "owner",
      "status": "active",
      "joined_at": "2026-08-20T10:00:00.000Z",
      "left_at": null,
      "banned_at": null,
      "banned_by": null,
      "notifications": "all"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "device_id": "b2c3d4e5f6071829",
      "role": "admin",
      "status": "active",
      "joined_at": "2026-08-20T11:00:00.000Z",
      "left_at": null,
      "banned_at": null,
      "banned_by": null,
      "notifications": "all"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

---

# 5. Message Endpoints

## 5.1 List Messages

```text
GET /v1/channels/:channel_id/messages?limit=50&before=<message_id>&after=<message_id>
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `integer` | 50 | Max results (1-100) |
| `before` | `string` | — | Message ID cursor (messages before this) |
| `after` | `string` | — | Message ID cursor (messages after this) |

**Response `200 OK`:**

```json
{
  "messages": [
    {
      "message_id": "770e8400-e29b-41d4-a716-446655440010",
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "sender_id": "a1b2c3d4e5f60718",
      "device_id": "a1b2c3d4e5f60718",
      "client_message_id": "01JXYZABCDEF00000000002",
      "content": "aGVsbG8gd29ybGQ=...encrypted-ciphertext...",
      "content_type": "text",
      "reply_to": null,
      "attachments": [],
      "created_at": "2026-08-21T12:05:00.000Z",
      "edited_at": null,
      "deleted_at": null
    },
    {
      "message_id": "770e8400-e29b-41d4-a716-446655440011",
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "sender_id": "b2c3d4e5f6071829",
      "device_id": "b2c3d4e5f6071829",
      "client_message_id": "01JXYZABCDEF00000000003",
      "content": "dGVzdC1tZXNzYWdl...encrypted-ciphertext...",
      "content_type": "text",
      "reply_to": "770e8400-e29b-41d4-a716-446655440010",
      "attachments": [],
      "created_at": "2026-08-21T12:06:00.000Z",
      "edited_at": null,
      "deleted_at": null
    }
  ],
  "next_cursor": "eyJtZXNzYWdlX2lkIjoiNzcwZTg0MDAiLCJjcmVhdGVkX2F0IjoiMjAyNi0wOC0yMTAxMjowNTowMFoifQ==",
  "has_more": true
}
```

**Rules:**
- The authenticated device must be a member of the channel.
- Messages are returned in reverse chronological order (newest first).
- `content` is ciphertext; the server cannot read it.
- Deleted messages return `deleted_at` with `content` replaced by `"[deleted]"`.

## 5.2 Create Message

```text
POST /v1/channels/:channel_id/messages
Authorization: Bearer <token>
```

**Request:**

```json
{
  "client_message_id": "01JXYZABCDEF00000000004",
  "content": "aGVsbG8gd29ybGQ=...encrypted-ciphertext...",
  "content_type": "text",
  "reply_to": null,
  "attachments": []
}
```

**Response `201 Created`:**

```json
{
  "message_id": "770e8400-e29b-41d4-a716-446655440012",
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "a1b2c3d4e5f60718",
  "device_id": "a1b2c3d4e5f60718",
  "client_message_id": "01JXYZABCDEF00000000004",
  "content": "aGVsbG8gd29ybGQ=...encrypted-ciphertext...",
  "content_type": "text",
  "reply_to": null,
  "attachments": [],
  "created_at": "2026-08-21T12:10:00.000Z",
  "edited_at": null,
  "deleted_at": null
}
```

**Rules:**
- `client_message_id` is required and must be unique per device (ULID recommended).
- If the same `client_message_id` is sent twice, the server returns the existing message (idempotent).
- `content` is ciphertext encrypted client-side. The server stores it but cannot decrypt it.
- `content_type` must be `text`, `attachment`, or `system`.
- `reply_to` references another message_id for threading.
- Maximum `content` size: 64 KiB.
- Maximum `attachments`: 10.

## 5.3 Edit Message

```text
PATCH /v1/messages/:message_id
Authorization: Bearer <token>
```

**Request:**

```json
{
  "content": "dXBkYXRlZC1tZXNzYWdl...new-encrypted-ciphertext..."
}
```

**Response `200 OK`:**

```json
{
  "message_id": "770e8400-e29b-41d4-a716-446655440012",
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "a1b2c3d4e5f60718",
  "device_id": "a1b2c3d4e5f60718",
  "client_message_id": "01JXYZABCDEF00000000004",
  "content": "dXBkYXRlZC1tZXNzYWdl...new-encrypted-ciphertext...",
  "content_type": "text",
  "reply_to": null,
  "attachments": [],
  "created_at": "2026-08-21T12:10:00.000Z",
  "edited_at": "2026-08-21T12:15:00.000Z",
  "deleted_at": null
}
```

**Rules:**
- Only the original sender can edit their own messages.
- `edited_at` is set automatically to the current timestamp.
- Channel admins can edit any message.
- Edit history is not stored server-side (only the latest ciphertext).

## 5.4 Delete Message

```text
DELETE /v1/messages/:message_id
Authorization: Bearer <token>
```

**Response `200 OK`:**

```json
{
  "message_id": "770e8400-e29b-41d4-a716-446655440012",
  "deleted_at": "2026-08-21T12:20:00.000Z"
}
```

**Rules:**
- Soft delete: `deleted_at` is set, `content` is replaced with `"[deleted]"`.
- Only the original sender or channel admins can delete.
- Reactions and delivery receipts are preserved.

## 5.5 Add Reaction

```text
POST /v1/messages/:message_id/reactions
Authorization: Bearer <token>
```

**Request:**

```json
{
  "emoji": "👍"
}
```

**Response `201 Created`:**

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440020",
  "message_id": "770e8400-e29b-41d4-a716-446655440012",
  "device_id": "a1b2c3d4e5f60718",
  "emoji": "👍",
  "created_at": "2026-08-21T12:25:00.000Z"
}
```

**Rules:**
- One reaction per device per emoji per message. Duplicate returns `409 CONFLICT`.
- Maximum emoji length: 32 bytes (handles multi-codepoint emoji).
- Must be a member of the channel.

## 5.6 Remove Reaction

```text
DELETE /v1/messages/:message_id/reactions/:emoji
Authorization: Bearer <token>
```

**Response `204 No Content`**

**Rules:**
- A device can only remove its own reactions.
- URL-encode the emoji parameter.

## 5.7 List Reactions

```text
GET /v1/messages/:message_id/reactions
Authorization: Bearer <token>
```

**Response `200 OK`:**

```json
{
  "reactions": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440020",
      "message_id": "770e8400-e29b-41d4-a716-446655440012",
      "device_id": "a1b2c3d4e5f60718",
      "emoji": "👍",
      "created_at": "2026-08-21T12:25:00.000Z"
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440021",
      "message_id": "770e8400-e29b-41d4-a716-446655440012",
      "device_id": "b2c3d4e5f6071829",
      "emoji": "👍",
      "created_at": "2026-08-21T12:26:00.000Z"
    }
  ]
}
```

## 5.8 Mark Read

```text
POST /v1/channels/:channel_id/read
Authorization: Bearer <token>
```

**Request:**

```json
{
  "message_id": "770e8400-e29b-41d4-a716-446655440012"
}
```

**Response `200 OK`:**

```json
{
  "device_id": "a1b2c3d4e5f60718",
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "last_read_message_id": "770e8400-e29b-41d4-a716-446655440012",
  "last_read_at": "2026-08-21T12:30:00.000Z"
}
```

**Rules:**
- Updates the read receipt for this device in this channel.
- Only the latest `message_id` is stored per device per channel.

---

# 6. File Endpoints

## 6.1 Request Upload

```text
POST /v1/files/upload
Authorization: Bearer <token>
```

**Request:**

```json
{
  "filename": "photo.jpg",
  "mime_type": "image/jpeg",
  "size": 1827364,
  "sha256": "base64-encoded-sha256-hash-of-file-content",
  "is_encrypted": true
}
```

**Response `201 Created`:**

```json
{
  "file_id": "990e8400-e29b-41d4-a716-446655440030",
  "filename": "photo.jpg",
  "mime_type": "image/jpeg",
  "size": 1827364,
  "sha256": "base64-encoded-sha256-hash",
  "storage_key": "uploads/a1b2c3d4/2026/08/21/990e8400-e29b-41d4-a716-446655440030.jpg",
  "upload_url": "https://minio.example.com/dipchats/uploads/a1b2c3d4/2026/08/21/990e8400-e29b-41d4-a716-446655440030.jpg?X-Amz-Algorithm=...",
  "upload_method": "PUT",
  "upload_headers": {
    "Content-Type": "image/jpeg",
    "x-amz-meta-sha256": "base64-encoded-sha256-hash"
  },
  "expires_at": "2026-08-21T12:30:00.000Z",
  "is_encrypted": true,
  "created_at": "2026-08-21T12:00:00.000Z"
}
```

**Rules:**
- Maximum file size: 100 MiB.
- `sha256` is required for integrity verification.
- The signed upload URL expires in 15 minutes.
- `is_encrypted` indicates whether the file content is encrypted client-side before upload.
- The server stores the encrypted file and its metadata. It cannot read unencrypted content if `is_encrypted` is `true`.

## 6.2 Upload Flow

```text
Client                                Server                              MinIO
  │                                      │                                  │
  │ 1. POST /v1/files/upload             │                                  │
  │    (file metadata)                   │                                  │
  │─────────────────────────────────────►│                                  │
  │                                      │ 2. Create attachment record      │
  │                                      │ 3. Generate signed upload URL    │
  │ 4. Receive signed URL                │                                  │
  │◄─────────────────────────────────────│                                  │
  │                                      │                                  │
  │ 5. PUT signed_url (file content)     │                                  │
  │─────────────────────────────────────────────────────────────────────────►│
  │                                      │                                  │
  │ 6. MinIO returns 200 OK              │                                  │
  │◄─────────────────────────────────────────────────────────────────────────│
  │                                      │                                  │
  │ 7. Reference file_id in message      │                                  │
```

## 6.3 Get File

```text
GET /v1/files/:file_id
Authorization: Bearer <token>
```

**Response `200 OK`:**

```json
{
  "file_id": "990e8400-e29b-41d4-a716-446655440030",
  "filename": "photo.jpg",
  "mime_type": "image/jpeg",
  "size": 1827364,
  "sha256": "base64-encoded-sha256-hash",
  "owner_id": "a1b2c3d4e5f60718",
  "is_encrypted": true,
  "has_preview": false,
  "preview_key": null,
  "width": 1920,
  "height": 1080,
  "duration": null,
  "created_at": "2026-08-21T12:00:00.000Z",
  "expires_at": null,
  "download_url": "https://minio.example.com/dipchats/uploads/...?X-Amz-Algorithm=...",
  "download_method": "GET",
  "download_headers": {}
}
```

**Rules:**
- The signed download URL expires in 15 minutes.
- The authenticated device must have access to a channel where this file is referenced.
- If `is_encrypted` is `true`, the client must decrypt the content using the appropriate key.

## 6.4 Delete File

```text
DELETE /v1/files/:file_id
Authorization: Bearer <token>
```

**Response `204 No Content`**

**Rules:**
- Only the file owner or channel admins can delete.
- Deleting a file removes the object from MinIO and the metadata record.
- Messages referencing this file will show the attachment as unavailable.

---

# 7. Sync Endpoints

## 7.1 Get Cursor

```text
GET /v1/sync/cursor
Authorization: Bearer <token>
```

**Response `200 OK`:**

```json
{
  "cursors": [
    {
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "last_sync_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0NX0=",
      "last_server_sequence": 1045,
      "last_sync_at": "2026-08-21T12:30:00.000Z"
    },
    {
      "channel_id": "550e8400-e29b-41d4-a716-446655440001",
      "last_sync_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDEiLCJzZXF1ZW5jZSI6MjA3fQ==",
      "last_server_sequence": 207,
      "last_sync_at": "2026-08-21T12:25:00.000Z"
    }
  ]
}
```

## 7.2 Request Sync

```text
POST /v1/sync/request
Authorization: Bearer <token>
```

**Request:**

```json
{
  "cursors": [
    {
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "last_sync_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0NX0=",
      "last_server_sequence": 1045
    }
  ],
  "limit": 100
}
```

**Response `200 OK`:**

```json
{
  "events": [
    {
      "event_type": "message.created",
      "sequence": 1046,
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "payload": {
        "message_id": "770e8400-e29b-41d4-a716-446655440030",
        "sender_id": "b2c3d4e5f6071829",
        "device_id": "b2c3d4e5f6071829",
        "client_message_id": "01JXYZABCDEF00000000010",
        "content": "b2ZmbGluZS1tZXNzYWdl...encrypted-ciphertext...",
        "content_type": "text",
        "reply_to": null,
        "attachments": [],
        "created_at": "2026-08-21T12:31:00.000Z"
      },
      "timestamp": "2026-08-21T12:31:00.000Z"
    },
    {
      "event_type": "message.reaction_added",
      "sequence": 1047,
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "payload": {
        "message_id": "770e8400-e29b-41d4-a716-446655440030",
        "device_id": "c3d4e5f607182930",
        "emoji": "🎉"
      },
      "timestamp": "2026-08-21T12:32:00.000Z"
    }
  ],
  "next_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0N30=",
  "has_more": false
}
```

**Rules:**
- Returns all events (messages, reactions, edits, deletes, membership changes) since the provided cursor.
- Events are ordered by sequence number (monotonically increasing per server node).
- Maximum 100 events per response. If `has_more` is `true`, paginate using `next_cursor`.
- Cursors are opaque strings. Do not parse or construct them client-side.
- If the client's cursor is too old (events purged), the server returns `410 Gone` with a fresh cursor.

---

# 8. Error Format

## 8.1 Standard Error Response

All errors follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of the error",
    "request_id": "req_01JXYZABCDEF00000000001",
    "details": {}
  }
}
```

## 8.2 Error Codes

### Authentication

| Code | HTTP Status | Description |
|------|------------|-------------|
| `AUTH_REQUIRED` | `401` | No authentication token provided |
| `AUTH_EXPIRED` | `401` | Session token has expired |
| `AUTH_INVALID_TOKEN` | `401` | Session token is invalid |
| `AUTH_DEVICE_REVOKED` | `401` | Device has been revoked |
| `AUTH_DEVICE_NOT_FOUND` | `404` | Device ID not registered |
| `AUTH_CHALLENGE_EXPIRED` | `401` | Challenge nonce has expired |
| `AUTH_INVALID_SIGNATURE` | `401` | Ed25519 signature verification failed |

### Authorization

| Code | HTTP Status | Description |
|------|------------|-------------|
| `PERMISSION_DENIED` | `403` | Insufficient permissions |
| `CHANNEL_ACCESS_DENIED` | `403` | Not a member of the channel |
| `MESSAGE_ACCESS_DENIED` | `403` | Cannot edit/delete this message |

### Messages

| Code | HTTP Status | Description |
|------|------------|-------------|
| `MESSAGE_INVALID` | `400` | Invalid message payload |
| `MESSAGE_NOT_FOUND` | `404` | Message does not exist |
| `MESSAGE_ALREADY_EXISTS` | `409` | Duplicate `client_message_id` |
| `MESSAGE_TOO_LARGE` | `413` | Message exceeds 64 KiB limit |
| `MESSAGE_RATE_LIMITED` | `429` | Message rate limit exceeded |

### Channels

| Code | HTTP Status | Description |
|------|------------|-------------|
| `CHANNEL_NOT_FOUND` | `404` | Channel does not exist |
| `CHANNEL_ALREADY_EXISTS` | `409` | Channel with same name and type exists |
| `CHANNEL_BANNED` | `403` | Device is banned from this channel |
| `CHANNEL_FULL` | `409` | Channel has reached max member limit |
| `CHANNEL_OWNER_REQUIRED` | `403` | Must transfer ownership before leaving |
| `CHANNEL_DM_INVALID` | `400` | DM requires exactly 2 members |

### Files

| Code | HTTP Status | Description |
|------|------------|-------------|
| `FILE_NOT_FOUND` | `404` | File does not exist |
| `FILE_TOO_LARGE` | `413` | File exceeds 100 MiB limit |
| `FILE_INVALID_HASH` | `400` | SHA-256 hash mismatch |
| `FILE_UPLOAD_EXPIRED` | `410` | Signed upload URL has expired |
| `FILE_UPLOAD_FAILED` | `500` | Upload to object storage failed |

### Sync

| Code | HTTP Status | Description |
|------|------------|-------------|
| `SYNC_CURSOR_EXPIRED` | `410` | Cursor too old, events purged |
| `SYNC_INVALID_CURSOR` | `400` | Malformed cursor |

### Rate Limiting

| Code | HTTP Status | Description |
|------|------------|-------------|
| `RATE_LIMITED` | `429` | Too many requests |

### Validation

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | `400` | Request body failed validation |
| `UNSUPPORTED_VERSION` | `410` | API version not supported |
| `PAYLOAD_TOO_LARGE` | `413` | Request body exceeds size limit |

## 8.3 Rate Limit Headers

All responses include rate limit information:

```text
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1724246460
X-RateLimit-Policy: "100;w=60"
```

When rate limited:

```text
Retry-After: 12
```

---

# 9. Rate Limiting Rules

## 9.1 Per-Endpoint Limits

| Endpoint Category | Limit | Window | Scope |
|-------------------|-------|--------|-------|
| Authentication (challenge/verify) | 10 requests | 1 minute | Per IP |
| Device registration | 5 requests | 10 minutes | Per IP |
| Message creation | 60 messages | 1 minute | Per device |
| Message read/list | 200 requests | 1 minute | Per device |
| Reaction add/remove | 30 requests | 1 minute | Per device |
| Channel create | 5 channels | 1 hour | Per device |
| Channel join/leave | 20 requests | 1 minute | Per device |
| File upload | 10 requests | 1 minute | Per device |
| File download | 100 requests | 1 minute | Per device |
| Sync requests | 30 requests | 1 minute | Per device |
| Device list/delete | 20 requests | 1 minute | Per device |
| General API | 200 requests | 1 minute | Per device |

## 9.2 Global Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Per IP (all endpoints) | 500 requests | 1 minute |
| Per IP (auth endpoints) | 20 requests | 1 minute |
| Per IP (file upload) | 20 requests | 1 minute |

## 9.3 Burst Limits

| Scope | Burst | Sustain |
|-------|-------|---------|
| Message creation | 10 messages/second | 60 messages/minute |
| Reaction add | 5 reactions/second | 30 reactions/minute |
| Sync request | 5 requests/second | 30 requests/minute |

## 9.4 Rate Limit Response

When exceeded, the server responds with:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 12 seconds.",
    "request_id": "req_01JXYZABCDEF00000000002",
    "details": {
      "retry_after": 12,
      "limit": 60,
      "window": 60,
      "scope": "device:a1b2c3d4e5f60718:messages"
    }
  }
}
```

## 9.5 Rate Limit Headers

```text
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1724246460
Retry-After: 12
```

---

# 10. Middleware Pipeline

## 10.1 Request Processing Order

```text
Client Request
       │
       ▼
1. CORS
       │
       ├── Preflight check
       │   └── Return immediately if OPTIONS
       │
       ▼
2. Helmet (Security Headers)
       │
       ├── X-Content-Type-Options: nosniff
       ├── X-Frame-Options: DENY
       ├── Strict-Transport-Security: max-age=31536000
       └── X-Request-ID (generate if not provided)
       │
       ▼
3. Request Parsing
       │
       ├── JSON body parsing (max 1 MiB)
       ├── Query string parsing
       ├── URL parameter parsing
       └── Content-Type validation
       │
       ▼
4. Rate Limiting
       │
       ├── Global IP limit check
       ├── Per-endpoint limit check
       ├── Per-device limit check
       │   (if authenticated)
       └── Return 429 if exceeded
       │
       ▼
5. Authentication
       │
       ├── Extract Bearer token from Authorization header
       ├── Skip for public endpoints (register, challenge, verify)
       ├── Validate token format and expiry
       ├── Load device from database
       ├── Check device status
       └── Attach device to request context
       │
       ▼
6. Validation (Zod schemas)
       │
       ├── Validate request body
       ├── Validate query parameters
       ├── Validate URL parameters
       └── Return 400 if validation fails
       │
       ▼
7. Authorization
       │
       ├── Check channel membership (for channel endpoints)
       ├── Check ownership (for edit/delete operations)
       ├── Check role permissions
       └── Return 403 if unauthorized
       │
       ▼
8. Route Handler
       │
       ├── Execute business logic
       ├── Persist to database
       ├── Publish events to Redis
       │   └── WebSocket fan-out to connected devices
       └── Return response
       │
       ▼
9. Response Serialization
       │
       ├── Set Content-Type header
       ├── Set X-Request-ID header
       ├── Set rate limit headers
       └── Serialize JSON response
       │
       ▼
10. Error Handler
        │
        ├── Catch unhandled errors
        ├── Log error with request_id
        ├── Return structured error response
        └── Never expose stack traces
```

## 10.2 Middleware Implementation

```typescript
// Fastify plugin registration order
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';

export async function registerMiddleware(app: FastifyInstance) {
  // 1. CORS
  app.register(fastifyCors, { /* ... */ });

  // 2. Security headers
  app.register(fastifyHelmet);

  // 3. Global rate limit
  app.register(fastifyRateLimit, {
    max: 500,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  // 4. Request ID generation
  app.addHook('onRequest', async (req) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
  });

  // 5. Body size limit
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body.length > 1_048_576) {
      done(new Error('Payload too large'), undefined);
    }
    done(null, JSON.parse(body as string));
  });
}
```

## 10.3 Authentication Middleware

```typescript
async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Bearer token required',
        request_id: request.id,
      },
    });
  }

  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);

  if (!session) {
    return reply.status(401).send({
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired session token',
        request_id: request.id,
      },
    });
  }

  if (session.device.status === 'revoked') {
    return reply.status(401).send({
      error: {
        code: 'AUTH_DEVICE_REVOKED',
        message: 'Device has been revoked',
        request_id: request.id,
      },
    });
  }

  // Attach device to request context
  request.device = session.device;
  request.session = session;
}
```

---

# 11. Request/Response Examples

## 11.1 Complete Authentication Flow

### Get Challenge

```bash
curl -X POST https://api.dipchats.example.com/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "a1b2c3d4e5f60718",
    "timestamp": 1724246400000
  }'
```

**Response `200 OK`:**

```json
{
  "challenge": "3af8c1b2e94d706f18a2b5c3d7e9f0123456789abcdef0123456789abcdef01",
  "expires_at": "2026-08-21T12:01:00.000Z"
}
```

### Verify Signature

```bash
curl -X POST https://api.dipchats.example.com/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "a1b2c3d4e5f60718",
    "challenge": "3af8c1b2e94d706f18a2b5c3d7e9f0123456789abcdef0123456789abcdef01",
    "timestamp": 1724246400000,
    "signature": "Ed25519SignatureBase64..."
  }'
```

**Response `200 OK`:**

```json
{
  "session_token": "dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4",
  "expires_at": "2026-08-21T13:00:00.000Z",
  "device_id": "a1b2c3d4e5f60718"
}
```

## 11.2 Register and Create Channel

### Register Device

```bash
curl -X POST https://api.dipchats.example.com/v1/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "a1b2c3d4e5f60718",
    "identity_public_key": "base64EncodedX25519PublicKey==",
    "signing_public_key": "base64EncodedEd25519PublicKey==",
    "fingerprint": "base64EncodedSHA256Hash==",
    "display_name": "Alice'\''s Phone",
    "display_avatar": null,
    "protocol_version": 1,
    "platform": "ios",
    "app_version": "1.2.0"
  }'
```

**Response `201 Created`:**

```json
{
  "device_id": "a1b2c3d4e5f60718",
  "display_name": "Alice's Phone",
  "display_avatar": null,
  "fingerprint": "base64EncodedSHA256Hash==",
  "registered_at": "2026-08-21T12:00:00.000Z",
  "last_seen": "2026-08-21T12:00:00.000Z",
  "status": "active",
  "protocol_version": 1,
  "platform": "ios",
  "app_version": "1.2.0"
}
```

### Create Channel

```bash
curl -X POST https://api.dipchats.example.com/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4" \
  -d '{
    "name": "developers",
    "description": "Development discussion",
    "type": "group",
    "is_encrypted": true,
    "max_members": 1000,
    "message_ttl": null
  }'
```

**Response `201 Created`:**

```json
{
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "developers",
  "description": "Development discussion",
  "type": "group",
  "owner_id": "a1b2c3d4e5f60718",
  "is_encrypted": true,
  "max_members": 1000,
  "message_ttl": null,
  "created_at": "2026-08-21T12:00:00.000Z",
  "updated_at": "2026-08-21T12:00:00.000Z",
  "archived_at": null
}
```

## 11.3 Send Message with Attachment

### Upload File

```bash
curl -X POST https://api.dipchats.example.com/v1/files/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4" \
  -d '{
    "filename": "document.pdf",
    "mime_type": "application/pdf",
    "size": 245760,
    "sha256": "base64EncodedSHA256Hash==",
    "is_encrypted": true
  }'
```

**Response `201 Created`:**

```json
{
  "file_id": "990e8400-e29b-41d4-a716-446655440030",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size": 245760,
  "sha256": "base64EncodedSHA256Hash==",
  "storage_key": "uploads/a1b2c3d4/2026/08/21/990e8400-e29b-41d4-a716-446655440030.pdf",
  "upload_url": "https://minio.example.com/dipchats/uploads/...?X-Amz-Algorithm=...",
  "upload_method": "PUT",
  "upload_headers": {
    "Content-Type": "application/pdf",
    "x-amz-meta-sha256": "base64EncodedSHA256Hash=="
  },
  "expires_at": "2026-08-21T12:30:00.000Z",
  "is_encrypted": true,
  "created_at": "2026-08-21T12:00:00.000Z"
}
```

### Upload File Content to MinIO

```bash
curl -X PUT "https://minio.example.com/dipchats/uploads/...?X-Amz-Algorithm=..." \
  -H "Content-Type: application/pdf" \
  -H "x-amz-meta-sha256: base64EncodedSHA256Hash==" \
  --data-binary @document.pdf
```

### Send Message with Attachment

```bash
curl -X POST https://api.dipchats.example.com/v1/channels/550e8400-e29b-41d4-a716-446655440000/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4" \
  -d '{
    "client_message_id": "01JXYZABCDEF00000000005",
    "content": "encrypted-ciphertext-for-attachment-reference",
    "content_type": "attachment",
    "reply_to": null,
    "attachments": [
      {
        "id": "990e8400-e29b-41d4-a716-446655440030",
        "filename": "document.pdf",
        "mime_type": "application/pdf",
        "size": 245760,
        "sha256": "base64EncodedSHA256Hash=="
      }
    ]
  }'
```

**Response `201 Created`:**

```json
{
  "message_id": "770e8400-e29b-41d4-a716-446655440040",
  "channel_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "a1b2c3d4e5f60718",
  "device_id": "a1b2c3d4e5f60718",
  "client_message_id": "01JXYZABCDEF00000000005",
  "content": "encrypted-ciphertext-for-attachment-reference",
  "content_type": "attachment",
  "reply_to": null,
  "attachments": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440030",
      "filename": "document.pdf",
      "mime_type": "application/pdf",
      "size": 245760,
      "sha256": "base64EncodedSHA256Hash=="
    }
  ],
  "created_at": "2026-08-21T12:10:00.000Z",
  "edited_at": null,
  "deleted_at": null
}
```

## 11.4 Sync After Reconnection

### Get Current Cursors

```bash
curl -X GET https://api.dipchats.example.com/v1/sync/cursor \
  -H "Authorization: Bearer dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4"
```

**Response `200 OK`:**

```json
{
  "cursors": [
    {
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "last_sync_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0NX0=",
      "last_server_sequence": 1045,
      "last_sync_at": "2026-08-21T12:30:00.000Z"
    }
  ]
}
```

### Request Missing Events

```bash
curl -X POST https://api.dipchats.example.com/v1/sync/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dpch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4" \
  -d '{
    "cursors": [
      {
        "channel_id": "550e8400-e29b-41d4-a716-446655440000",
        "last_sync_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0NX0=",
        "last_server_sequence": 1045
      }
    ],
    "limit": 100
  }'
```

**Response `200 OK`:**

```json
{
  "events": [
    {
      "event_type": "message.created",
      "sequence": 1046,
      "channel_id": "550e8400-e29b-41d4-a716-446655440000",
      "payload": {
        "message_id": "770e8400-e29b-41d4-a716-446655440050",
        "sender_id": "b2c3d4e5f6071829",
        "device_id": "b2c3d4e5f6071829",
        "client_message_id": "01JXYZABCDEF00000000020",
        "content": "offline-message-ciphertext",
        "content_type": "text",
        "reply_to": null,
        "attachments": [],
        "created_at": "2026-08-21T12:35:00.000Z"
      },
      "timestamp": "2026-08-21T12:35:00.000Z"
    }
  ],
  "next_cursor": "eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0Nn0=",
  "has_more": false
}
```

---

# 12. Non-Negotiable API Rules

1. **Never transmit private keys over any network.** Only public keys are registered with the server.

2. **Never decrypt message content on the server.** The server stores ciphertext it cannot read.

3. **Never create user accounts or require registration.** Identity is a device-generated key pair.

4. **Never store plaintext passwords.** None should exist in the system.

5. **Never return stack traces or internal errors to clients.** All errors use structured responses with machine-readable codes.

6. **Never log session tokens, private keys, or message content.** Use request_id for correlation.

7. **Never allow unbounded pagination.** All list endpoints enforce a maximum limit.

8. **Never skip idempotency for message creation.** `client_message_id` deduplication is mandatory.

9. **Never acknowledge durable operations before persistence succeeds.** Persist → Publish → Respond.

10. **Never trust client-provided timestamps for ordering.** Use server-assigned sequence numbers.

11. **Never allow cross-channel message access.** Channel membership is verified on every request.

12. **Never send files through the JSON message body.** Use the signed URL upload flow.

13. **Never rate-limit below the documented minimums.** Rate limits must be published and stable.

14. **Never change response schemas without versioning.** Additive changes only within a version.

15. **Never cache authenticated responses without validation headers.** Use `Cache-Control: private, no-cache`.

16. **Never allow a device to edit or delete another device's messages** without admin role.

17. **Never return full member lists without pagination.** All list endpoints support cursor-based pagination.

18. **Never accept requests without Content-Type: application/json** for POST/PATCH endpoints.

19. **Never expose file storage keys in client responses** without signed URLs.

20. **Never allow sync cursors to be constructed client-side.** Cursors are opaque server-generated strings.

---

# Appendix A: Data Types Reference

## A.1 UUID

Standard UUID v4 format:

```text
550e8400-e29b-41d4-a716-446655440000
```

## A.2 Device ID

8-byte hex string (first 8 bytes of SHA-256 of identity public key):

```text
a1b2c3d4e5f60718
```

## A.3 Base64

Standard Base64 encoding for binary data:

```text
SGVsbG8gV29ybGQ=
```

## A.4 ISO 8601 Timestamp

UTC timestamp with milliseconds:

```text
2026-08-21T12:00:00.000Z
```

## A.5 ULID

Recommended for `client_message_id`:

```text
01JXYZABCDEF00000000001
```

## A.6 Cursor

Opaque base64-encoded string. Do not parse or construct:

```text
eyJjaGFubmVsX2lkIjoiNTUwZTg0MDAiLCJzZXF1ZW5jZSI6MTA0NX0=
```

---

# Appendix B: Environment Variables

```text
# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dipchats

# Redis
REDIS_URL=redis://localhost:6379

# Object Storage (MinIO)
S3_ENDPOINT=https://minio.example.com
S3_BUCKET=dipchats
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Auth
SESSION_TOKEN_EXPIRY=3600
CHALLENGE_EXPIRY=60

# Rate Limiting
RATE_LIMIT_IP=500
RATE_LIMIT_DEVICE=200
RATE_LIMIT_MESSAGES=60

# File Upload
MAX_FILE_SIZE=104857600
SIGNED_URL_EXPIRY=900
```

---

# Appendix C: OpenAPI Schema

A machine-readable OpenAPI 3.1 specification is maintained at:

```text
https://api.dipchats.example.com/openapi.json
```

This document is the source of truth for the REST API. The OpenAPI schema is auto-generated from the implementation.
