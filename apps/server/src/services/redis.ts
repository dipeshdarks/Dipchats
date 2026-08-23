import { Redis } from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

export const redisSub = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

export async function initRedis() {
  try {
    await redis.connect();
    await redisSub.connect();
    console.log('Redis connected successfully');
  } catch (err) {
    console.warn('Redis connection warning (falling back to in-memory if needed):', err);
  }
}

// Presence Helpers
export async function setUserPresence(deviceId: string, status: string) {
  const key = `presence:${deviceId}`;
  await redis.set(key, status, 'EX', 60);
}

export async function getUserPresence(deviceId: string): Promise<string> {
  const key = `presence:${deviceId}`;
  const status = await redis.get(key);
  return status || 'offline';
}

// Typing Helpers
export async function setTypingStatus(channelId: string, deviceId: string) {
  const key = `typing:${channelId}:${deviceId}`;
  await redis.set(key, '1', 'EX', 5);
}

export async function removeTypingStatus(channelId: string, deviceId: string) {
  const key = `typing:${channelId}:${deviceId}`;
  await redis.del(key);
}
