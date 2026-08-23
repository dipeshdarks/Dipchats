import { Channel, Message, Attachment, UserProfile, ChannelInvite, Friendship, SearchResults } from '@dipchats/shared';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function extractError(data: any): string {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  if (data?.message) return data.message;
  return 'Request failed';
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ==========================================
// Auth
// ==========================================

export async function joinDipChats(displayName: string) {
  const res = await fetch(`${API_BASE}/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName })
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function getMe(token: string) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

// ==========================================
// Profile
// ==========================================

export async function getMyProfile(token: string) {
  const res = await fetch(`${API_BASE}/profile/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.profile as UserProfile;
}

export async function updateProfile(token: string, updates: {
  displayName?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  discoverable?: boolean;
}) {
  const res = await fetch(`${API_BASE}/profile/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates)
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.profile as UserProfile;
}

// ==========================================
// Channels
// ==========================================

export async function fetchChannels(token?: string) {
  const res = await fetch(`${API_BASE}/channels`, {
    headers: authHeaders(token)
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.channels || []) as Channel[];
}

export async function fetchMyChannels(token: string) {
  const res = await fetch(`${API_BASE}/channels/my`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.channels || []) as Channel[];
}

export async function fetchDiscoverChannels() {
  const res = await fetch(`${API_BASE}/channels/discover`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.channels || []) as Channel[];
}

export async function searchChannels(query: string) {
  const res = await fetch(`${API_BASE}/channels/search?q=${encodeURIComponent(query)}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.channels || []) as Channel[];
}

export async function createChannel(data: {
  name: string;
  description?: string;
  type?: string;
  privacy?: string;
  avatarUrl?: string;
  maxMembers?: number;
}, token: string) {
  const res = await fetch(`${API_BASE}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  const result = await safeJson(res);
  if (!res.ok) throw new Error(extractError(result));
  return result.channel as Channel;
}

export async function joinChannel(channelId: string, token: string) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function joinChannelByCode(code: string, token: string) {
  const res = await fetch(`${API_BASE}/channels/join/${code}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function leaveChannel(channelId: string, token: string) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function getChannelByInviteCode(code: string) {
  const res = await fetch(`${API_BASE}/channels/invite/${code}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.channel as Channel;
}

export async function generateInviteCode(channelId: string, token: string) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data as { code: string; url: string };
}

export async function getChannelMembers(channelId: string) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.members || [];
}

// ==========================================
// Messages
// ==========================================

export async function fetchMessages(channelId: string) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/messages`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  const msgs = data.messages ?? data ?? [];
  return (Array.isArray(msgs) ? msgs : []) as Message[];
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.attachment as Attachment;
}

// ==========================================
// People
// ==========================================

export async function fetchDiscoverPeople(token: string) {
  const res = await fetch(`${API_BASE}/people/discover`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.people || []) as UserProfile[];
}

export async function searchPeople(query: string) {
  const res = await fetch(`${API_BASE}/people/search?q=${encodeURIComponent(query)}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.people || []) as UserProfile[];
}

export async function getUserProfile(userId: string) {
  const res = await fetch(`${API_BASE}/people/${userId}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.profile as UserProfile;
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return (data.users || []) as { id: string; deviceId: string; displayName: string; lastSeen: string }[];
}

// ==========================================
// Search
// ==========================================

export async function globalSearch(query: string, token?: string) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(token)
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data as SearchResults;
}

// ==========================================
// Blocks
// ==========================================

export async function blockUser(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId })
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function unblockUser(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/blocks/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function fetchBlocks(token: string) {
  const res = await fetch(`${API_BASE}/blocks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data.blocks || [];
}

// ==========================================
// Friends
// ==========================================

export async function sendFriendRequest(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/friends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId })
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function acceptFriendRequest(friendshipId: string, token: string) {
  const res = await fetch(`${API_BASE}/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function declineFriendRequest(friendshipId: string, token: string) {
  const res = await fetch(`${API_BASE}/friends/${friendshipId}/decline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function removeFriend(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/friends/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data;
}

export async function fetchFriends(token: string) {
  const res = await fetch(`${API_BASE}/friends`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data));
  return data as { friends: any[]; pending: any[] };
}
