import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// Devices Table (Identity)
// ==========================================
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: varchar('device_id', { length: 64 }).notNull().unique(),
    identityPublicKey: text('identity_public_key'),
    signingPublicKey: text('signing_public_key'),
    fingerprint: varchar('fingerprint', { length: 64 }),
    displayName: varchar('display_name', { length: 64 }).notNull().default('Anonymous'),
    username: varchar('username', { length: 32 }),
    displayAvatar: text('display_avatar'),
    bio: varchar('bio', { length: 200 }),
    discoverable: boolean('discoverable').notNull().default(true),
    platform: varchar('platform', { length: 32 }).default('web'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    lastSeenIdx: index('idx_devices_last_seen').on(table.lastSeen),
    statusIdx: index('idx_devices_status').on(table.status),
    usernameIdx: index('idx_devices_username').on(table.username),
    discoverableIdx: index('idx_devices_discoverable').on(table.discoverable)
  })
);

// ==========================================
// Sessions Table
// ==========================================
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastActive: timestamp('last_active', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    deviceIdx: index('idx_sessions_device').on(table.deviceId),
    tokenIdx: uniqueIndex('idx_sessions_token').on(table.token)
  })
);

// ==========================================
// Channels Table
// ==========================================
export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 16 }).notNull().default('group'),
    privacy: varchar('privacy', { length: 16 }).notNull().default('public'),
    ownerId: uuid('owner_id').notNull().references(() => devices.id),
    avatarUrl: text('avatar_url'),
    maxMembers: integer('max_members'),
    inviteCode: varchar('invite_code', { length: 16 }),
    isEncrypted: boolean('is_encrypted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    typeIdx: index('idx_channels_type').on(table.type),
    privacyIdx: index('idx_channels_privacy').on(table.privacy),
    createdIdx: index('idx_channels_created').on(table.createdAt),
    inviteCodeIdx: index('idx_channels_invite_code').on(table.inviteCode)
  })
);

// ==========================================
// Channel Members Table
// ==========================================
export const channelMembers = pgTable(
  'channel_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull().default('member'), // owner, admin, member
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueMember: uniqueIndex('uq_channel_member').on(table.channelId, table.deviceId),
    channelIdx: index('idx_channel_members_channel').on(table.channelId),
    deviceIdx: index('idx_channel_members_device').on(table.deviceId)
  })
);

// ==========================================
// Messages Table
// ==========================================
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => devices.id),
    clientMessageId: varchar('client_message_id', { length: 128 }).notNull(),
    content: text('content').notNull(),
    contentType: varchar('content_type', { length: 16 }).notNull().default('text'),
    replyToId: uuid('reply_to_id'),
    attachments: jsonb('attachments').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (table) => ({
    channelCreatedIdx: index('idx_messages_channel_created').on(table.channelId, table.createdAt),
    senderIdx: index('idx_messages_sender').on(table.senderId),
    clientMsgUnique: uniqueIndex('uq_messages_client_id').on(table.senderId, table.clientMessageId)
  })
);

// Self-reference for replyTo in messages
export const messagesRelations = relations(messages, ({ one }) => ({
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id]
  }),
  sender: one(devices, {
    fields: [messages.senderId],
    references: [devices.id]
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id]
  })
}));

// ==========================================
// Reactions Table
// ==========================================
export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
    emoji: varchar('emoji', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueReaction: uniqueIndex('uq_reaction').on(table.messageId, table.deviceId, table.emoji),
    messageIdx: index('idx_reactions_message').on(table.messageId)
  })
);

// ==========================================
// Attachments Table
// ==========================================
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    ownerId: uuid('owner_id').notNull().references(() => devices.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    ownerIdx: index('idx_attachments_owner').on(table.ownerId)
  })
);

// ==========================================
// Channel Invites Table
// ==========================================
export const channelInvites = pgTable(
  'channel_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').notNull().references(() => devices.id),
    code: varchar('code', { length: 16 }).notNull().unique(),
    maxUses: integer('max_uses'),
    uses: integer('uses').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    channelIdx: index('idx_invites_channel').on(table.channelId),
    codeIdx: uniqueIndex('idx_invites_code').on(table.code)
  })
);

// ==========================================
// Friendships Table
// ==========================================
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id').notNull().references(() => devices.id),
    addresseeId: uuid('addressee_id').notNull().references(() => devices.id),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueFriendship: uniqueIndex('uq_friendship').on(table.requesterId, table.addresseeId),
    requesterIdx: index('idx_friendships_requester').on(table.requesterId),
    addresseeIdx: index('idx_friendships_addressee').on(table.addresseeId)
  })
);

// ==========================================
// Blocks Table
// ==========================================
export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerId: uuid('blocker_id').notNull().references(() => devices.id),
    blockedId: uuid('blocked_id').notNull().references(() => devices.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueBlock: uniqueIndex('uq_block').on(table.blockerId, table.blockedId),
    blockerIdx: index('idx_blocks_blocker').on(table.blockerId),
    blockedIdx: index('idx_blocks_blocked').on(table.blockedId)
  })
);
