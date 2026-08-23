import { z } from 'zod';

// ==========================================
// User / Device Identity Types
// ==========================================

export interface DeviceIdentity {
  deviceId: string;
  identityPublicKey: string;
  signingPublicKey: string;
  fingerprint: string;
  displayName: string;
}

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  token: string;
  expiresAt: string;
}

export const JoinRequestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(32, 'Name cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Invalid characters in name'),
  identityPublicKey: z.string().optional(),
  signingPublicKey: z.string().optional(),
  fingerprint: z.string().optional()
});

export type JoinRequest = z.infer<typeof JoinRequestSchema>;

// ==========================================
// User Profile Types
// ==========================================

export type ChannelPrivacy = 'public' | 'discoverable' | 'invite_only' | 'private';

export interface UserProfile {
  id: string;
  deviceId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  discoverable: boolean;
  status: PresenceStatus;
  lastSeen: string;
}

// ==========================================
// Channel & Messaging Types
// ==========================================

export type ChannelType = 'public' | 'private' | 'group' | 'dm';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  privacy?: ChannelPrivacy;
  description?: string | null;
  ownerId: string;
  avatarUrl?: string | null;
  maxMembers?: number | null;
  inviteCode?: string | null;
  memberCount?: number;
  onlineCount?: number;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  lastMessage?: Message | null;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  previewUrl?: string | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  deviceIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: 'text' | 'attachment' | 'system';
  clientMessageId: string;
  replyToId?: string | null;
  replyToMessage?: Partial<Message> | null;
  attachments?: Attachment[];
  reactions?: Record<string, MessageReaction>;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export const SendMessageSchema = z.object({
  channelId: z.string(),
  content: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  clientMessageId: z.string(),
  replyToId: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string()
  })).optional()
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// ==========================================
// Invite Types
// ==========================================

export interface ChannelInvite {
  id: string;
  channelId: string;
  createdBy: string;
  code: string;
  maxUses?: number | null;
  uses: number;
  expiresAt?: string | null;
  createdAt: string;
}

// ==========================================
// Friendship Types
// ==========================================

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
}

// ==========================================
// Block Types
// ==========================================

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

// ==========================================
// Presence Types
// ==========================================

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserPresence {
  deviceId: string;
  displayName: string;
  status: PresenceStatus;
  lastSeen: string;
}

// ==========================================
// Search Types
// ==========================================

export interface SearchResults {
  people: UserProfile[];
  channels: Channel[];
  messages: Message[];
}

// ==========================================
// WebSocket Protocol Types
// ==========================================

export type WSEventType =
  | 'connection.ready'
  | 'auth.join'
  | 'auth.success'
  | 'auth.error'
  | 'message.send'
  | 'message.new'
  | 'message.edit'
  | 'message.updated'
  | 'message.delete'
  | 'message.deleted'
  | 'message.reaction'
  | 'reaction.updated'
  | 'typing.start'
  | 'typing.stop'
  | 'typing.update'
  | 'presence.update'
  | 'presence.changed'
  | 'channel.join'
  | 'channel.leave'
  | 'channel.joined'
  | 'channel.member_joined'
  | 'channel.member_left'
  | 'dm.created'
  | 'invite.created'
  | 'invite.joined'
  | 'block.created'
  | 'block.removed'
  | 'people.discover'
  | 'people.presence'
  | 'sync.request'
  | 'sync.response'
  | 'error';

export interface WSFrame<T = unknown> {
  version: 1;
  type: WSEventType;
  requestId?: string | null;
  timestamp?: string;
  payload: T;
}

export function createWSFrame<T>(type: WSEventType, payload: T, requestId?: string | null): WSFrame<T> {
  return {
    version: 1,
    type,
    requestId: requestId ?? null,
    timestamp: new Date().toISOString(),
    payload
  };
}
