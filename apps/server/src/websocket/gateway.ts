import { WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { createWSFrame, WSFrame, WSEventType } from '@dipchats/shared';
import { getDb, devices, sessions, messages, reactions, eq, and } from '@dipchats/database';
import { setUserPresence, setTypingStatus, removeTypingStatus, redis, redisSub } from '../services/redis';
import { memoryDevices, memorySessions } from '../routes/auth';
import { memoryMessages } from '../routes/channels';
import crypto from 'crypto';

interface ClientSocket {
  ws: WebSocket;
  deviceId?: string;
  deviceName?: string;
  connectionId: string;
}

const activeSockets = new Map<string, ClientSocket>();

export function initWebSocketGateway(fastify: FastifyInstance) {
  try {
    redisSub.subscribe('dipchats:ws_events', (err) => {
      if (err) console.warn('Redis pub/sub subscribe notice:', err);
    });

    redisSub.on('message', (channel, messageStr) => {
      if (channel === 'dipchats:ws_events') {
        try {
          const { senderConnId, frame } = JSON.parse(messageStr);
          broadcastFrame(frame, senderConnId);
        } catch (err) {
          // Parse error ignore
        }
      }
    });
  } catch (err) {
    // Optional Redis fallback
  }

  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const ws = connection.socket;
    const connectionId = `conn_${crypto.randomBytes(8).toString('hex')}`;
    const client: ClientSocket = { ws, connectionId };
    activeSockets.set(connectionId, client);

    // Send connection.ready
    sendFrame(client, 'connection.ready', {
      connectionId,
      serverTime: new Date().toISOString(),
      protocolVersion: 1
    });

    ws.on('message', async (data: Buffer | string) => {
      try {
        const raw = data.toString();
        const frame: WSFrame = JSON.parse(raw);
        await handleClientFrame(client, frame);
      } catch (err) {
        console.error('Error handling WS message:', err);
        sendFrame(client, 'error', { message: 'Invalid JSON payload' });
      }
    });

    ws.on('close', async () => {
      activeSockets.delete(connectionId);
      if (client.deviceId) {
        try {
          await setUserPresence(client.deviceId, 'offline');
        } catch (e) {}
        publishAndBroadcast('presence.changed', {
          deviceId: client.deviceId,
          status: 'offline',
          lastSeen: new Date().toISOString()
        });
      }
    });
  });
}

function sendFrame(client: ClientSocket, type: WSEventType, payload: unknown, requestId?: string | null) {
  if (client.ws.readyState === WebSocket.OPEN) {
    const frame = createWSFrame(type, payload, requestId);
    client.ws.send(JSON.stringify(frame));
  }
}

function broadcastFrame(frame: WSFrame, excludeConnId?: string) {
  const data = JSON.stringify(frame);
  for (const [connId, client] of activeSockets.entries()) {
    if (connId !== excludeConnId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

async function publishAndBroadcast(type: WSEventType, payload: unknown, requestId?: string | null, senderConnId?: string) {
  const frame = createWSFrame(type, payload, requestId);
  broadcastFrame(frame, senderConnId);

  try {
    await redis.publish('dipchats:ws_events', JSON.stringify({ senderConnId, frame }));
  } catch (err) {
    // Redis optional fallback
  }
}

async function handleClientFrame(client: ClientSocket, frame: WSFrame) {
  const { type, payload, requestId } = frame;

  switch (type) {
    case 'auth.join': {
      const { token } = payload as { token: string };
      let device: any = null;

      try {
        const db = getDb();
        const [session] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
        if (session && new Date(session.expiresAt) > new Date()) {
          const [dbDev] = await db.select().from(devices).where(eq(devices.id, session.deviceId)).limit(1);
          device = dbDev;
        }
      } catch (err) {
        // Fallback
        const memSession = memorySessions.get(token);
        if (memSession) {
          device = memoryDevices.get(memSession.deviceId);
        }
      }

      if (!device) {
        return sendFrame(client, 'auth.error', { message: 'Invalid or expired session token' }, requestId);
      }

      client.deviceId = device.id;
      client.deviceName = device.displayName;

      try {
        await setUserPresence(device.id, 'online');
      } catch (e) {}

      sendFrame(client, 'auth.success', {
        device: {
          id: device.id,
          deviceId: device.deviceId,
          displayName: device.displayName
        }
      }, requestId);

      publishAndBroadcast('presence.changed', {
        deviceId: device.id,
        status: 'online',
        lastSeen: new Date().toISOString()
      });
      break;
    }

    case 'message.send': {
      if (!client.deviceId || !client.deviceName) {
        return sendFrame(client, 'error', { message: 'Unauthenticated WebSocket connection' }, requestId);
      }

      const { channelId, content, clientMessageId, replyToId, attachments: msgAttachments } = payload as {
        channelId: string;
        content: string;
        clientMessageId: string;
        replyToId?: string;
        attachments?: unknown[];
      };

      const fullMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        channelId,
        senderId: client.deviceId,
        senderName: client.deviceName,
        content,
        contentType: 'text',
        clientMessageId,
        replyToId: replyToId || null,
        attachments: msgAttachments || [],
        createdAt: new Date().toISOString()
      };

      try {
        const db = getDb();
        const [dbMsg] = await db.insert(messages).values({
          channelId,
          senderId: client.deviceId,
          clientMessageId,
          content,
          contentType: 'text',
          replyToId: replyToId || null,
          attachments: msgAttachments || []
        }).returning();
        if (dbMsg) fullMessage.id = dbMsg.id;
      } catch (err) {
        // In-memory message store fallback
        memoryMessages.push(fullMessage);
      }

      await publishAndBroadcast('message.new', fullMessage, requestId, client.connectionId);
      break;
    }

    case 'message.edit': {
      if (!client.deviceId) return;
      const { messageId, content } = payload as { messageId: string; content: string };
      const editedAt = new Date().toISOString();

      try {
        const db = getDb();
        await db.update(messages).set({ content, editedAt: new Date() }).where(and(eq(messages.id, messageId), eq(messages.senderId, client.deviceId)));
      } catch (err) {
        const memMsg = memoryMessages.find((m) => m.id === messageId);
        if (memMsg) {
          memMsg.content = content;
          memMsg.editedAt = editedAt;
        }
      }

      await publishAndBroadcast('message.updated', { id: messageId, content, editedAt }, requestId);
      break;
    }

    case 'message.delete': {
      if (!client.deviceId) return;
      const { messageId } = payload as { messageId: string };
      const deletedAt = new Date().toISOString();

      try {
        const db = getDb();
        await db.update(messages).set({ deletedAt: new Date(), content: '[Message deleted]' }).where(and(eq(messages.id, messageId), eq(messages.senderId, client.deviceId)));
      } catch (err) {
        const memMsg = memoryMessages.find((m) => m.id === messageId);
        if (memMsg) {
          memMsg.content = '[Message deleted]';
          memMsg.deletedAt = deletedAt;
        }
      }

      await publishAndBroadcast('message.deleted', { id: messageId, deletedAt }, requestId);
      break;
    }

    case 'typing.start': {
      if (!client.deviceId || !client.deviceName) return;
      const { channelId } = payload as { channelId: string };
      try {
        await setTypingStatus(channelId, client.deviceId);
      } catch (e) {}

      await publishAndBroadcast('typing.update', {
        channelId,
        deviceId: client.deviceId,
        displayName: client.deviceName,
        isTyping: true
      }, requestId, client.connectionId);
      break;
    }

    case 'typing.stop': {
      if (!client.deviceId || !client.deviceName) return;
      const { channelId } = payload as { channelId: string };
      try {
        await removeTypingStatus(channelId, client.deviceId);
      } catch (e) {}

      await publishAndBroadcast('typing.update', {
        channelId,
        deviceId: client.deviceId,
        displayName: client.deviceName,
        isTyping: false
      }, requestId, client.connectionId);
      break;
    }

    case 'presence.update': {
      if (!client.deviceId) return;
      const { status } = payload as { status: string };
      try {
        await setUserPresence(client.deviceId, status);
      } catch (e) {}

      await publishAndBroadcast('presence.changed', {
        deviceId: client.deviceId,
        status,
        lastSeen: new Date().toISOString()
      }, requestId);
      break;
    }
  }
}
