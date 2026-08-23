import { FastifyInstance } from 'fastify';
import { sessionService } from '../services/session-service';
import { getDb, isDatabaseConnected, schema } from '../db';
import { eq, and } from 'drizzle-orm';

export async function blockRoutes(fastify: FastifyInstance) {
  // Block a user
  fastify.post('/api/v1/blocks', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { userId } = request.body as { userId: string };
    if (!userId) {
      return reply.status(400).send({ error: { code: 'MISSING_USER', message: 'userId required' } });
    }

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const existing = await db
          .select()
          .from(schema.blocks)
          .where(
            and(
              eq(schema.blocks.blockerId, device.id),
              eq(schema.blocks.blockedId, userId)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(schema.blocks).values({
            blockerId: device.id,
            blockedId: userId
          });
        }
        return reply.status(200).send({ blocked: true });
      } catch (err) {}
    }

    return reply.status(200).send({ blocked: true });
  });

  // Unblock a user
  fastify.delete('/api/v1/blocks/:userId', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { userId } = request.params as { userId: string };
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        await db
          .delete(schema.blocks)
          .where(
            and(
              eq(schema.blocks.blockerId, device.id),
              eq(schema.blocks.blockedId, userId)
            )
          );
        return reply.status(200).send({ unblocked: true });
      } catch (err) {}
    }

    return reply.status(200).send({ unblocked: true });
  });

  // List my blocks
  fastify.get('/api/v1/blocks', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const blocked = await db
          .select()
          .from(schema.blocks)
          .where(eq(schema.blocks.blockerId, device.id));
        return reply.status(200).send({ blocks: blocked.map((b) => ({ blockedId: b.blockedId })) });
      } catch (err) {}
    }

    return reply.status(200).send({ blocks: [] });
  });
}
