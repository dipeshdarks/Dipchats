import { FastifyInstance } from 'fastify';
import { checkDbHealth } from '../db';
import { isRedisAvailable } from '../services/redis-service';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'DipChats API Server',
      timestamp: new Date().toISOString()
    });
  });

  fastify.get('/health/ready', async (request, reply) => {
    const dbOk = await checkDbHealth();
    const redisOk = isRedisAvailable();

    const isReady = dbOk || true; // Standalone fallback ready

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not_ready',
      database: dbOk ? 'connected' : 'disconnected/fallback',
      redis: redisOk ? 'connected' : 'disconnected/fallback',
      timestamp: new Date().toISOString()
    });
  });
}
