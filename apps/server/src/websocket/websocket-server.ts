import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { connectionManager } from './connection-manager';
import { handleIncomingWSFrame } from './message-handler';
import { createWSFrame } from './protocol';
import { initRedisService } from '../services/redis-service';
import { presenceService } from '../services/presence-service';
import crypto from 'crypto';

export function setupWebSocketServer(fastify: FastifyInstance) {
  // Initialize Redis Pub/Sub listener for multi-node broadcasting
  initRedisService((channel, messageStr) => {
    try {
      const data = JSON.parse(messageStr);
      if (data.channelId && data.frame) {
        connectionManager.broadcastToChannel(data.channelId, data.frame);
      } else if (data.type) {
        connectionManager.broadcastGlobal(data);
      }
    } catch (e) {}
  });

  // Heartbeat Timer — ping sockets every 25s and clean dead sockets
  const heartbeatInterval = setInterval(() => {
    for (const socket of connectionManager.getAllSockets()) {
      if (!socket.ws || !socket.ws.readyState) {
        handleSocketDisconnect(socket.id);
        continue;
      }
      if (!socket.isAlive) {
        socket.ws.terminate();
        handleSocketDisconnect(socket.id);
        continue;
      }
      socket.isAlive = false;
      try {
        if (socket.ws.readyState === WebSocket.OPEN) {
          socket.ws.ping();
        }
      } catch {}
    }
  }, 25000);

  fastify.addHook('onClose', (instance, done) => {
    clearInterval(heartbeatInterval);
    done();
  });

  // Fastify WebSocket endpoint `/ws`
  // @fastify/websocket@10 passes (socket, request) directly — socket IS the WebSocket
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const ws = socket;
    if (!ws) return;

    const socketId = `sock_${crypto.randomBytes(8).toString('hex')}`;
    const conn = connectionManager.register(socketId, ws);

    ws.on('pong', () => {
      conn.isAlive = true;
    });

    // Send connection.ready
    connectionManager.sendToSocket(
      conn,
      createWSFrame('connection.ready' as any, {
        connectionId: socketId,
        serverTime: new Date().toISOString(),
        protocolVersion: 1
      })
    );

    ws.on('message', async (data: Buffer | string) => {
      conn.isAlive = true;
      try {
        const frame = JSON.parse(data.toString());
        await handleIncomingWSFrame(conn, frame);
      } catch (err) {
        connectionManager.sendToSocket(conn, {
          version: 1,
          type: 'error' as any,
          payload: { message: 'Invalid JSON payload' }
        });
      }
    });

    ws.on('close', () => {
      handleSocketDisconnect(socketId);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error on socket ${socketId}:`, err);
      handleSocketDisconnect(socketId);
    });
  });
}

async function handleSocketDisconnect(socketId: string) {
  const conn = connectionManager.unregister(socketId);
  if (conn && conn.userId) {
    const pres = await presenceService.setPresence(conn.userId, 'offline');
    connectionManager.broadcastGlobal(createWSFrame('presence.changed' as any, pres));
  }
}
