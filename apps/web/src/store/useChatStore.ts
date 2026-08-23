import { create } from 'zustand';
import { Channel, Message, UserPresence, UserProfile } from '@dipchats/shared';
import * as api from '../services/api';
import { wsClient } from '../services/ws';

export type NavTab = 'chats' | 'channels' | 'discover' | 'people' | 'mesh' | 'files' | 'settings' | 'profile' | 'dm';

interface DeviceUser {
  id: string;
  deviceId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  fingerprint: string;
}

export interface ExtendedMessage extends Message {
  status?: 'sending' | 'sent' | 'failed';
}

interface ChatState {
  token: string | null;
  currentUser: DeviceUser | null;
  isJoined: boolean;
  isLoading: boolean;
  error: string | null;

  activeTab: NavTab;
  activeChannel: Channel | null;
  activeProfile: UserProfile | null;
  activeDmChannel: Channel | null;

  channels: Channel[];
  myChannels: Channel[];
  messages: ExtendedMessage[];
  users: UserPresence[];
  discoverPeople: UserProfile[];
  typingUsers: Record<string, string[]>;
  isConnected: boolean;
  lastSyncedTimestamp: string | null;

  searchQuery: string;
  searchResults: { people: UserProfile[]; channels: Channel[] };
  isSearchOpen: boolean;

  join: (displayName: string) => Promise<void>;
  logout: () => void;
  setActiveTab: (tab: NavTab) => void;
  setActiveChannel: (channel: Channel) => void;
  setActiveProfile: (profile: UserProfile | null) => void;
  setActiveDmChannel: (channel: Channel | null) => void;
  loadChannels: () => Promise<void>;
  loadMyChannels: () => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  loadUsers: () => Promise<void>;
  loadDiscoverPeople: () => Promise<void>;
  sendMessage: (content: string, replyToId?: string, attachments?: unknown[]) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  syncMissedMessages: () => void;
  initSession: () => Promise<void>;
  search: (query: string) => Promise<void>;
  setSearchOpen: (open: boolean) => void;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
  createChannel: (data: { name: string; description?: string; privacy?: string }) => Promise<Channel>;
  openDm: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  token: localStorage.getItem('dipchats_token'),
  currentUser: null,
  isJoined: false,
  isLoading: false,
  error: null,

  activeTab: 'chats',
  activeChannel: null,
  activeProfile: null,
  activeDmChannel: null,

  channels: [],
  myChannels: [],
  messages: [],
  users: [],
  discoverPeople: [],
  typingUsers: {},
  isConnected: false,
  lastSyncedTimestamp: null,

  searchQuery: '',
  searchResults: { people: [], channels: [] },
  isSearchOpen: false,

  initSession: async () => {
    const token = get().token;
    if (!token) return;

    set({ isLoading: true });
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (res.ok && data.device) {
        set({
          currentUser: {
            id: data.device.id,
            deviceId: data.device.deviceId,
            displayName: data.device.displayName,
            username: data.device.username,
            avatarUrl: data.device.avatarUrl,
            bio: data.device.bio,
            fingerprint: data.device.fingerprint
          },
          isJoined: true,
          isLoading: false
        });

        wsClient.connect(token, (connected) => {
          set({ isConnected: connected });
          if (connected) {
            get().syncMissedMessages();
            get().loadMyChannels();
            get().loadDiscoverPeople();
          }
        });

        wsClient.subscribe((frame) => {
          const { type, payload } = frame;

          if (type === ('message.ack' as any)) {
            const { clientMessageId } = payload as { clientMessageId: string; status: string };
            set((state) => ({
              messages: state.messages.map((m) =>
                m.clientMessageId === clientMessageId ? { ...m, status: 'sent' as const } : m
              )
            }));
          } else if (type === 'message.new') {
            const newMsg = payload as ExtendedMessage;
            const currentChannel = get().activeChannel;
            if (currentChannel && newMsg.channelId === currentChannel.id) {
              set((state) => {
                const exists = state.messages.some(
                  (m) => m.id === newMsg.id || (m.clientMessageId && m.clientMessageId === newMsg.clientMessageId)
                );
                if (exists) {
                  return {
                    messages: state.messages.map((m) =>
                      m.clientMessageId === newMsg.clientMessageId ? { ...newMsg, status: 'sent' as const } : m
                    )
                  };
                }
                return {
                  messages: [...state.messages, { ...newMsg, status: 'sent' as const }],
                  lastSyncedTimestamp: newMsg.createdAt
                };
              });
            }
          } else if (type === 'message.updated') {
            const updated = payload as { id: string; content: string; editedAt: string };
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === updated.id ? { ...m, content: updated.content, editedAt: updated.editedAt } : m
              )
            }));
          } else if (type === 'message.deleted') {
            const deleted = payload as { id: string };
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === deleted.id ? { ...m, content: '[Message deleted]', deletedAt: new Date().toISOString() } : m
              )
            }));
          } else if (type === 'typing.update') {
            const { channelId, displayName, isTyping } = payload as { channelId: string; displayName: string; isTyping: boolean };
            set((state) => {
              const current = state.typingUsers[channelId] || [];
              const updated = isTyping
                ? Array.from(new Set([...current, displayName]))
                : current.filter((name) => name !== displayName);
              return { typingUsers: { ...state.typingUsers, [channelId]: updated } };
            });
          } else if (type === 'presence.changed') {
            const { deviceId, status } = payload as { deviceId: string; status: string };
            set((state) => ({
              users: state.users.map((u) =>
                u.deviceId === deviceId ? { ...u, status: status as any } : u
              ),
              discoverPeople: state.discoverPeople.map((p) =>
                p.id === deviceId ? { ...p, status: status as any } : p
              )
            }));
          } else if (type === 'channel.member_joined') {
            const { channelId, displayName } = payload as { channelId: string; displayName: string };
            set((state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId ? { ...c, memberCount: (c.memberCount || 0) + 1 } : c
              )
            }));
          } else if (type === 'channel.member_left') {
            const { channelId } = payload as { channelId: string };
            set((state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId ? { ...c, memberCount: Math.max(0, (c.memberCount || 0) - 1) } : c
              )
            }));
          } else if (type === 'channel.joined') {
            const { channelId, channel } = payload as { channelId: string; channel: Channel };
            set((state) => {
              const exists = state.myChannels.some((c) => c.id === channelId);
              if (!exists && channel) {
                return { myChannels: [...state.myChannels, channel] };
              }
              return {};
            });
          } else if (type === ('sync.response' as any)) {
            const { channelId, messages: missed } = payload as { channelId: string; messages: Message[] };
            const currentChannel = get().activeChannel;
            if (currentChannel && currentChannel.id === channelId && missed.length > 0) {
              set((state) => {
                const existingIds = new Set(state.messages.map((m) => m.id));
                const newToAppend = missed.filter((m) => !existingIds.has(m.id));
                return {
                  messages: [...state.messages, ...newToAppend.map((m) => ({ ...m, status: 'sent' as const }))]
                };
              });
            }
          }
        });

        await get().loadChannels();
        await get().loadUsers();
      } else {
        localStorage.removeItem('dipchats_token');
        set({ token: null, isJoined: false, isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false });
    }
  },

  join: async (displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.joinDipChats(displayName);
      localStorage.setItem('dipchats_token', data.token);

      set({
        token: data.token,
        currentUser: {
          id: data.device.id,
          deviceId: data.device.deviceId,
          displayName: data.device.displayName,
          username: data.device.username,
          avatarUrl: data.device.avatarUrl,
          bio: data.device.bio,
          fingerprint: data.device.fingerprint
        },
        isJoined: true,
        isLoading: false
      });

      wsClient.connect(data.token, (connected) => {
        set({ isConnected: connected });
      });

      await get().loadChannels();
      await get().loadUsers();
      await get().loadMyChannels();
      await get().loadDiscoverPeople();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to join DipChats';
      set({ isLoading: false, error: errorMsg });
    }
  },

  logout: () => {
    wsClient.disconnect();
    localStorage.removeItem('dipchats_token');
    set({
      token: null,
      currentUser: null,
      isJoined: false,
      activeChannel: null,
      activeProfile: null,
      activeDmChannel: null,
      messages: [],
      channels: [],
      myChannels: [],
      users: [],
      discoverPeople: []
    });
  },

  setActiveTab: (tab: NavTab) => set({ activeTab: tab }),

  setActiveChannel: (channel: Channel) => {
    set({ activeChannel: channel, activeDmChannel: null });
    wsClient.send('channel.join', { channelId: channel.id });
    get().loadMessages(channel.id);
  },

  setActiveProfile: (profile: UserProfile | null) => set({ activeProfile: profile }),

  setActiveDmChannel: (channel: Channel | null) => {
    set({ activeDmChannel: channel, activeChannel: null, activeTab: 'dm' });
    if (channel) {
      wsClient.send('channel.join', { channelId: channel.id });
      get().loadMessages(channel.id);
    }
  },

  loadChannels: async () => {
    try {
      const channelsList = await api.fetchChannels(get().token || undefined);
      set({ channels: channelsList });
      if (channelsList.length > 0 && !get().activeChannel) {
        const general = channelsList.find((c) => c.name === 'general') || channelsList[0];
        if (general) {
          get().setActiveChannel(general);
        }
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  },

  loadMyChannels: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const myChans = await api.fetchMyChannels(token);
      set({ myChannels: myChans });
    } catch (err) {
      console.error('Failed to load my channels:', err);
    }
  },

  loadMessages: async (channelId: string) => {
    try {
      const msgs = await api.fetchMessages(channelId);
      const extended: ExtendedMessage[] = msgs.map((m) => ({ ...m, status: 'sent' }));
      const last = msgs[msgs.length - 1];
      set({
        messages: extended,
        lastSyncedTimestamp: last ? last.createdAt : new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  },

  loadUsers: async () => {
    try {
      const rawUsers = await api.fetchUsers();
      const formatted: UserPresence[] = rawUsers.map((u) => ({
        deviceId: u.id,
        displayName: u.displayName,
        status: 'online',
        lastSeen: u.lastSeen
      }));
      set({ users: formatted });
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  },

  loadDiscoverPeople: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const people = await api.fetchDiscoverPeople(token);
      set({ discoverPeople: people });
    } catch (err) {
      console.error('Failed to load discover people:', err);
    }
  },

  sendMessage: async (content: string, replyToId?: string, attachments?: unknown[]) => {
    const channel = get().activeChannel || get().activeDmChannel;
    const user = get().currentUser;
    if (!channel || !user) return;

    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const optimisticMsg: ExtendedMessage = {
      id: clientMessageId,
      channelId: channel.id,
      senderId: user.id,
      senderName: user.displayName,
      content,
      contentType: 'text',
      clientMessageId,
      replyToId,
      attachments: attachments as any[],
      createdAt: new Date().toISOString(),
      status: 'sending'
    };

    set((state) => ({ messages: [...state.messages, optimisticMsg] }));

    wsClient.send('message.send', {
      channelId: channel.id,
      content,
      clientMessageId,
      replyToId,
      attachments
    });
  },

  toggleReaction: (messageId: string, emoji: string) => {
    wsClient.send('message.reaction', { messageId, emoji });
  },

  deleteMessage: (messageId: string) => {
    wsClient.send('message.delete', { messageId });
  },

  startTyping: (channelId: string) => {
    wsClient.send('typing.start', { channelId });
  },

  stopTyping: (channelId: string) => {
    wsClient.send('typing.stop', { channelId });
  },

  syncMissedMessages: () => {
    const channel = get().activeChannel || get().activeDmChannel;
    const lastTimestamp = get().lastSyncedTimestamp;
    if (channel && lastTimestamp) {
      wsClient.send('sync.request', {
        channelId: channel.id,
        afterTimestamp: lastTimestamp
      });
    }
  },

  search: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: { people: [], channels: [] }, searchQuery: '' });
      return;
    }
    set({ searchQuery: query });
    try {
      const results = await api.globalSearch(query, get().token || undefined);
      set({ searchResults: results });
    } catch (err) {
      console.error('Search failed:', err);
    }
  },

  setSearchOpen: (open: boolean) => set({ isSearchOpen: open }),

  joinChannel: async (channelId: string) => {
    const token = get().token;
    if (!token) return;
    try {
      await api.joinChannel(channelId, token);
      wsClient.send('channel.join', { channelId });
      await get().loadMyChannels();
      const channel = get().channels.find((c) => c.id === channelId);
      if (channel) {
        get().setActiveChannel(channel);
      }
    } catch (err) {
      console.error('Failed to join channel:', err);
    }
  },

  leaveChannel: async (channelId: string) => {
    const token = get().token;
    if (!token) return;
    try {
      await api.leaveChannel(channelId, token);
      wsClient.send('channel.leave', { channelId });
      set((state) => ({
        myChannels: state.myChannels.filter((c) => c.id !== channelId),
        activeChannel: state.activeChannel?.id === channelId ? null : state.activeChannel
      }));
    } catch (err) {
      console.error('Failed to leave channel:', err);
    }
  },

  createChannel: async (data) => {
    const token = get().token;
    if (!token) throw new Error('Not authenticated');
    const channel = await api.createChannel(data, token);
    wsClient.send('channel.join', { channelId: channel.id });
    set((state) => ({
      channels: [channel, ...state.channels],
      myChannels: [channel, ...state.myChannels]
    }));
    get().setActiveChannel(channel);
    return channel;
  },

  openDm: async (userId: string) => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetch('/api/v1/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: `dm_${get().currentUser?.id}_${userId}`,
          type: 'dm',
          privacy: 'private'
        })
      });
      const data = await res.json();
      if (data.channel) {
        get().setActiveDmChannel(data.channel);
      }
    } catch (err) {
      console.error('Failed to open DM:', err);
    }
  }
}));
