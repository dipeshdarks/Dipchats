import { FastifyInstance } from 'fastify';
import { sessionService } from '../services/session-service';
import { getDb, isDatabaseConnected, schema } from '../db';
import { eq, and, or } from 'drizzle-orm';

export async function friendshipRoutes(fastify: FastifyInstance) {
  // Send friend request
  fastify.post('/api/v1/friends', async (request, reply) => {
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
          .from(schema.friendships)
          .where(
            or(
              and(
                eq(schema.friendships.requesterId, device.id),
                eq(schema.friendships.addresseeId, userId)
              ),
              and(
                eq(schema.friendships.requesterId, userId),
                eq(schema.friendships.addresseeId, device.id)
              )
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return reply.status(409).send({ error: { code: 'ALREADY_EXISTS', message: 'Friend request already exists' } });
        }

        await db.insert(schema.friendships).values({
          requesterId: device.id,
          addresseeId: userId
        });
        return reply.status(201).send({ sent: true });
      } catch (err) {}
    }

    return reply.status(201).send({ sent: true });
  });

  // Accept friend request
  fastify.post('/api/v1/friends/:friendshipId/accept', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { friendshipId } = request.params as { friendshipId: string };
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        await db
          .update(schema.friendships)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(
            and(
              eq(schema.friendships.id, friendshipId),
              eq(schema.friendships.addresseeId, device.id)
            )
          );
        return reply.status(200).send({ accepted: true });
      } catch (err) {}
    }

    return reply.status(200).send({ accepted: true });
  });

  // Decline friend request
  fastify.post('/api/v1/friends/:friendshipId/decline', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { friendshipId } = request.params as { friendshipId: string };
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        await db
          .update(schema.friendships)
          .set({ status: 'declined', updatedAt: new Date() })
          .where(eq(schema.friendships.id, friendshipId));
        return reply.status(200).send({ declined: true });
      } catch (err) {}
    }

    return reply.status(200).send({ declined: true });
  });

  // Remove friend
  fastify.delete('/api/v1/friends/:userId', async (request, reply) => {
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
          .delete(schema.friendships)
          .where(
            or(
              and(
                eq(schema.friendships.requesterId, device.id),
                eq(schema.friendships.addresseeId, userId)
              ),
              and(
                eq(schema.friendships.requesterId, userId),
                eq(schema.friendships.addresseeId, device.id)
              )
            )
          );
        return reply.status(200).send({ removed: true });
      } catch (err) {}
    }

    return reply.status(200).send({ removed: true });
  });

  // List friends
  fastify.get('/api/v1/friends', async (request, reply) => {
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
        const friendships = await db
          .select()
          .from(schema.friendships)
          .where(
            or(
              eq(schema.friendships.requesterId, device.id),
              eq(schema.friendships.addresseeId, device.id)
            )
          );

        const friends = friendships
          .filter((f) => f.status === 'accepted')
          .map((f) => ({
            userId: f.requesterId === device.id ? f.addresseeId : f.requesterId,
            since: f.updatedAt
          }));

        const pending = friendships
          .filter((f) => f.status === 'pending' && f.addresseeId === device.id)
          .map((f) => ({
            friendshipId: f.id,
            from: f.requesterId,
            since: f.createdAt
          }));

        return reply.status(200).send({ friends, pending });
      } catch (err) {}
    }

    return reply.status(200).send({ friends: [], pending: [] });
  });
}
