import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { config } from './config';
import { checkDbHealth } from './db';
import { setupWebSocketServer } from './websocket/websocket-server';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { channelRoutes } from './routes/channels';
import { messageRoutes } from './routes/messages';
import { fileRoutes } from './routes/files';
import { peopleRoutes } from './routes/people';
import { profileRoutes } from './routes/profile';
import { searchRoutes } from './routes/search';
import { blockRoutes } from './routes/blocks';
import { friendshipRoutes } from './routes/friendships';
import { channelRepository } from './repositories/channel-repository';

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL
    }
  });

  // Register Core Middleware Plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB max payload
    }
  });

  await fastify.register(websocket);

  // Register REST API Routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(channelRoutes);
  await fastify.register(messageRoutes);
  await fastify.register(fileRoutes);
  await fastify.register(peopleRoutes);
  await fastify.register(profileRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(blockRoutes);
  await fastify.register(friendshipRoutes);

  // Register WebSocket Gateway
  setupWebSocketServer(fastify);

  return fastify;
}

async function startServer() {
  const app = await createServer();

  // Test DB Connection
  const isDbHealthy = await checkDbHealth();
  if (isDbHealthy) {
    console.log('PostgreSQL connection verified via SELECT 1');
    await channelRepository.seedDefaultChannels('system');
  } else {
    console.warn('PostgreSQL not active — running with in-memory fallback repository');
  }

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`DipChats API & Realtime Server running on http://${config.HOST}:${config.PORT}`);
    console.log(`WebSocket Endpoint: ws://${config.HOST}:${config.PORT}/ws`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
