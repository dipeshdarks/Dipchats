import { FastifyInstance } from 'fastify';
import { messageService } from '../services/message-service';
import { sessionService } from '../services/session-service';
import { connectionManager } from '../websocket/connection-manager';
import { createWSFrame } from '../websocket/protocol';
import { publishEvent } from '../services/redis-service';
import { z } from 'zod';
import crypto from 'crypto';

const SendMessageRestSchema = z.object({
  content: z.string().min(1).max(10000),
  clientMessageId: z.string().optional(),
  replyToId: z.string().optional(),
  attachments: z.array(z.any()).optional()
});

export async function messageRoutes(fastify: FastifyInstance) {
  // GET /api/v1/channels/:channelId/messages
  fastify.get('/api/v1/channels/:channelId/messages', async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { limit = '50', before } = request.query as { limit?: string; before?: string };
    const take = Math.min(parseInt(limit, 10), 100);

    const history = await messageService.getHistory(channelId, take, before);
    return reply.status(200).send(history);
  });

  // POST /api/v1/channels/:channelId/messages (REST Send)
  fastify.post('/api/v1/channels/:channelId/messages', async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }

    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session token invalid or expired' } });
    }

    const parseResult = SendMessageRestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid message payload' } });
    }

    const { content, clientMessageId, replyToId, attachments } = parseResult.data;
    const cid = clientMessageId || `rest_msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 1. Save to Database (MUST SUCCEED BEFORE PERSISTED RESPONSE)
    const { message, isDuplicate } = await messageService.saveMessage({
      channelId,
      senderId: device.id,
      senderName: device.displayName,
      clientMessageId: cid,
      content,
      replyToId,
      attachments
    });

    // 2. Broadcast via WebSockets & Redis
    const newMsgFrame = createWSFrame('message.new' as any, message);
    connectionManager.broadcastToChannel(channelId, newMsgFrame);
    await publishEvent({ channelId, frame: newMsgFrame });

    return reply.status(isDuplicate ? 200 : 201).send({ message });
  });
}
