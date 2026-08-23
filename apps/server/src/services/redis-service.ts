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

let isRedisConnected = false;

export async function initRedisService(onPubSubMessage?: (channel: string, message: string) => void) {
  try {
    await redis.connect();
    await redisSub.connect();
    isRedisConnected = true;
    console.log('Redis connected successfully for Pub/Sub and Presence');

    if (onPubSubMessage) {
      await redisSub.subscribe('dipchats:events');
      redisSub.on('message', (channel, message) => {
        onPubSubMessage(channel, message);
      });
    }
  } catch (err) {
    isRedisConnected = false;
    console.warn('Redis connection warning (running in single-node memory pub/sub mode):', err);
  }
}

export async function publishEvent(eventData: any) {
  if (isRedisConnected) {
    try {
      await redis.publish('dipchats:events', JSON.stringify(eventData));
    } catch (err) {}
  }
}

export function isRedisAvailable(): boolean {
  return isRedisConnected;
}
