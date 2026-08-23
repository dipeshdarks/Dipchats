import { getDb, isDatabaseConnected, schema } from '../db';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface ChannelRecord {
  id: string;
  name: string;
  description?: string | null;
  type: 'public' | 'private' | 'group' | 'dm';
  privacy: 'public' | 'discoverable' | 'invite_only' | 'private';
  ownerId: string;
  avatarUrl?: string | null;
  maxMembers?: number | null;
  inviteCode?: string | null;
  memberCount?: number;
  onlineCount?: number;
  createdAt: Date | string;
}

const defaultMemoryChannels: ChannelRecord[] = [
  {
    id: 'chan_general',
    name: 'general',
    description: 'General discussion for all DipChats users',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_gaming',
    name: 'gaming',
    description: 'Gaming discussions, streams & raid nights',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_memes',
    name: 'memes',
    description: 'Share your best memes',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_anime',
    name: 'anime',
    description: 'Anime, manga & otaku culture',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_music',
    name: 'music',
    description: 'Share and discover music',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_coding',
    name: 'coding',
    description: 'Programming, hacking & dev talk',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_movies',
    name: 'movies',
    description: 'Movies, TV shows & cinema',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'chan_football',
    name: 'football',
    description: 'Football/soccer discussions',
    type: 'public',
    privacy: 'public',
    ownerId: 'system',
    memberCount: 0,
    onlineCount: 0,
    createdAt: new Date().toISOString()
  }
];

const memChannels = new Map<string, ChannelRecord>(
  defaultMemoryChannels.map((c) => [c.id, c])
);
const memMembers = new Map<string, Set<string>>();

export class ChannelRepository {
  async listChannels(): Promise<ChannelRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.channels)
          .orderBy(desc(schema.channels.createdAt));
        if (list.length > 0) {
          const channels = await Promise.all(
            list.map(async (ch) => {
              const memberCount = await this.getMemberCount(ch.id);
              return { ...ch, memberCount } as ChannelRecord;
            })
          );
          return channels;
        }
      } catch (err) {}
    }

    return Array.from(memChannels.values());
  }

  async listPublicChannels(): Promise<ChannelRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.channels)
          .where(eq(schema.channels.privacy, 'public'))
          .orderBy(desc(schema.channels.createdAt));
        return list.map((ch) => ({ ...ch, privacy: ch.privacy as ChannelRecord['privacy'] })) as ChannelRecord[];
      } catch (err) {}
    }

    return Array.from(memChannels.values()).filter((c) => c.privacy === 'public');
  }

  async listDiscoverableChannels(): Promise<ChannelRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.channels)
          .where(
            sql`${schema.channels.privacy} IN ('public', 'discoverable')`
          )
          .orderBy(desc(schema.channels.createdAt));
        return list.map((ch) => ({ ...ch, privacy: ch.privacy as ChannelRecord['privacy'] })) as ChannelRecord[];
      } catch (err) {}
    }

    return Array.from(memChannels.values()).filter(
      (c) => c.privacy === 'public' || c.privacy === 'discoverable'
    );
  }

  async searchChannels(query: string): Promise<ChannelRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.channels)
          .where(
            sql`${schema.channels.name} ILIKE ${'%' + query + '%'} AND ${schema.channels.privacy} IN ('public', 'discoverable')`
          )
          .orderBy(desc(schema.channels.createdAt))
          .limit(20);
        return list.map((ch) => ({ ...ch, privacy: ch.privacy as ChannelRecord['privacy'] })) as ChannelRecord[];
      } catch (err) {}
    }

    return Array.from(memChannels.values()).filter(
      (c) =>
        (c.privacy === 'public' || c.privacy === 'discoverable') &&
        c.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  async findChannelById(id: string): Promise<ChannelRecord | null> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [chan] = await db
          .select()
          .from(schema.channels)
          .where(eq(schema.channels.id, id))
          .limit(1);
        if (chan) {
          const memberCount = await this.getMemberCount(chan.id);
          return { ...chan, memberCount } as ChannelRecord;
        }
      } catch (err) {}
    }

    return memChannels.get(id) || null;
  }

  async findChannelByInviteCode(code: string): Promise<ChannelRecord | null> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [chan] = await db
          .select()
          .from(schema.channels)
          .where(eq(schema.channels.inviteCode, code))
          .limit(1);
        if (chan) return chan as ChannelRecord;
      } catch (err) {}
    }

    return Array.from(memChannels.values()).find((c) => c.inviteCode === code) || null;
  }

  async createChannel(data: {
    name: string;
    description?: string;
    type?: 'public' | 'private' | 'group' | 'dm';
    privacy?: 'public' | 'discoverable' | 'invite_only' | 'private';
    ownerId: string;
    avatarUrl?: string;
    maxMembers?: number;
  }): Promise<ChannelRecord> {
    const type = data.type || 'public';
    const privacy = data.privacy || 'public';
    const inviteCode = `DIP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [inserted] = await db
          .insert(schema.channels)
          .values({
            name: data.name,
            description: data.description || null,
            type,
            privacy,
            ownerId: data.ownerId,
            avatarUrl: data.avatarUrl || null,
            maxMembers: data.maxMembers || null,
            inviteCode
          })
          .returning();
        if (inserted) {
          await this.addMember(inserted.id, data.ownerId, 'owner');
          return { ...inserted, memberCount: 1 } as ChannelRecord;
        }
      } catch (err) {}
    }

    const chan: ChannelRecord = {
      id: `chan_${crypto.randomBytes(6).toString('hex')}`,
      name: data.name,
      description: data.description || null,
      type,
      privacy,
      ownerId: data.ownerId,
      avatarUrl: data.avatarUrl || null,
      maxMembers: data.maxMembers || null,
      inviteCode,
      memberCount: 1,
      onlineCount: 0,
      createdAt: new Date().toISOString()
    };
    memChannels.set(chan.id, chan);
    return chan;
  }

  async addMember(channelId: string, deviceId: string, role: 'owner' | 'admin' | 'member' = 'member'): Promise<boolean> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const existing = await db
          .select()
          .from(schema.channelMembers)
          .where(
            and(
              eq(schema.channelMembers.channelId, channelId),
              eq(schema.channelMembers.deviceId, deviceId)
            )
          )
          .limit(1);
        if (existing.length > 0) return false;

        await db.insert(schema.channelMembers).values({
          channelId,
          deviceId,
          role
        });
        return true;
      } catch (err) {}
    }

    if (!memMembers.has(channelId)) memMembers.set(channelId, new Set());
    const members = memMembers.get(channelId)!;
    if (members.has(deviceId)) return false;
    members.add(deviceId);
    return true;
  }

  async removeMember(channelId: string, deviceId: string): Promise<boolean> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const result = await db
          .delete(schema.channelMembers)
          .where(
            and(
              eq(schema.channelMembers.channelId, channelId),
              eq(schema.channelMembers.deviceId, deviceId)
            )
          );
        return true;
      } catch (err) {}
    }

    const members = memMembers.get(channelId);
    if (members) {
      members.delete(deviceId);
    }
    return true;
  }

  async isMember(channelId: string, deviceId: string): Promise<boolean> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const existing = await db
          .select()
          .from(schema.channelMembers)
          .where(
            and(
              eq(schema.channelMembers.channelId, channelId),
              eq(schema.channelMembers.deviceId, deviceId)
            )
          )
          .limit(1);
        return existing.length > 0;
      } catch (err) {}
    }

    const members = memMembers.get(channelId);
    return members ? members.has(deviceId) : false;
  }

  async getMemberCount(channelId: string): Promise<number> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const result = await db
          .select({ count: count() })
          .from(schema.channelMembers)
          .where(eq(schema.channelMembers.channelId, channelId));
        return result[0]?.count || 0;
      } catch (err) {}
    }

    const members = memMembers.get(channelId);
    return members ? members.size : 0;
  }

  async getMembers(channelId: string): Promise<{ deviceId: string; role: string; joinedAt: string }[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const members = await db
          .select()
          .from(schema.channelMembers)
          .where(eq(schema.channelMembers.channelId, channelId));
        return members.map((m) => ({
          deviceId: m.deviceId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString()
        }));
      } catch (err) {}
    }

    const memberSet = memMembers.get(channelId);
    if (!memberSet) return [];
    return Array.from(memberSet).map((deviceId) => ({
      deviceId,
      role: 'member',
      joinedAt: new Date().toISOString()
    }));
  }

  async getDeviceChannels(deviceId: string): Promise<ChannelRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const members = await db
          .select({ channelId: schema.channelMembers.channelId })
          .from(schema.channelMembers)
          .where(eq(schema.channelMembers.deviceId, deviceId));

        if (members.length === 0) return [];

        const channelIds = members.map((m) => m.channelId);
        const channels = await db
          .select()
          .from(schema.channels)
          .where(sql`${schema.channels.id} IN ${channelIds}`);

        return channels.map((ch) => ({
          ...ch,
          privacy: ch.privacy as ChannelRecord['privacy']
        })) as ChannelRecord[];
      } catch (err) {}
    }

    const result: ChannelRecord[] = [];
    for (const [channelId, members] of memMembers) {
      if (members.has(deviceId)) {
        const ch = memChannels.get(channelId);
        if (ch) result.push(ch);
      }
    }
    return result;
  }

  async generateInviteCode(channelId: string): Promise<string> {
    const code = `DIP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        await db
          .update(schema.channels)
          .set({ inviteCode: code })
          .where(eq(schema.channels.id, channelId));
        return code;
      } catch (err) {}
    }

    const ch = memChannels.get(channelId);
    if (ch) ch.inviteCode = code;
    return code;
  }

  async seedDefaultChannels(systemDeviceId: string) {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const existing = await db.select().from(schema.channels).limit(1);
        if (existing.length === 0) {
          const channelDefs = [
            { name: 'general', description: 'General discussion for all DipChats users', type: 'public', privacy: 'public' },
            { name: 'gaming', description: 'Gaming discussions, streams & raid nights', type: 'public', privacy: 'public' },
            { name: 'memes', description: 'Share your best memes', type: 'public', privacy: 'public' },
            { name: 'anime', description: 'Anime, manga & otaku culture', type: 'public', privacy: 'public' },
            { name: 'music', description: 'Share and discover music', type: 'public', privacy: 'public' },
            { name: 'coding', description: 'Programming, hacking & dev talk', type: 'public', privacy: 'public' },
            { name: 'movies', description: 'Movies, TV shows & cinema', type: 'public', privacy: 'public' },
            { name: 'football', description: 'Football/soccer discussions', type: 'public', privacy: 'public' }
          ];
          for (const ch of channelDefs) {
            const [inserted] = await db
              .insert(schema.channels)
              .values({
                name: ch.name,
                description: ch.description,
                type: ch.type,
                privacy: ch.privacy,
                ownerId: systemDeviceId,
                inviteCode: `DIP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
              })
              .returning();
            if (inserted) {
              await db.insert(schema.channelMembers).values({
                channelId: inserted.id,
                deviceId: systemDeviceId,
                role: 'owner'
              });
            }
          }
        }
      } catch (err) {}
    }
  }
}

export const channelRepository = new ChannelRepository();
