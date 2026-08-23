import { redis } from './redis';

const memPresence = new Map<string, { status: string; lastSeen: string }>();
const memTyping = new Map<string, Set<string>>(); // channelId -> Set(deviceIds)

export class PresenceService {
  async setPresence(deviceId: string, status: string): Promise<{ deviceId: string; status: string; lastSeen: string }> {
    const lastSeen = new Date().toISOString();
    try {
      if (redis.status === 'ready') {
        await redis.set(`presence:${deviceId}`, status, 'EX', 60);
      }
    } catch (e) {}

    memPresence.set(deviceId, { status, lastSeen });
    return { deviceId, status, lastSeen };
  }

  async getPresence(deviceId: string): Promise<string> {
    try {
      if (redis.status === 'ready') {
        const val = await redis.get(`presence:${deviceId}`);
        if (val) return val;
      }
    } catch (e) {}

    const mem = memPresence.get(deviceId);
    return mem ? mem.status : 'offline';
  }

  async setTyping(channelId: string, deviceId: string, isTyping: boolean) {
    try {
      if (redis.status === 'ready') {
        if (isTyping) {
          await redis.set(`typing:${channelId}:${deviceId}`, '1', 'EX', 5);
        } else {
          await redis.del(`typing:${channelId}:${deviceId}`);
        }
      }
    } catch (e) {}

    if (!memTyping.has(channelId)) {
      memTyping.set(channelId, new Set());
    }
    const set = memTyping.get(channelId)!;
    if (isTyping) {
      set.add(deviceId);
    } else {
      set.delete(deviceId);
    }
  }

  getTypingUsers(channelId: string): string[] {
    const set = memTyping.get(channelId);
    return set ? Array.from(set) : [];
  }
}

export const presenceService = new PresenceService();
