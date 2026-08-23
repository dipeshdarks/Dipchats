import { FastifyInstance } from 'fastify';
import { userRepository } from '../repositories/user-repository';
import { sessionService } from '../services/session-service';
import { presenceService } from '../services/presence-service';

export async function peopleRoutes(fastify: FastifyInstance) {
  // List discoverable people
  fastify.get('/api/v1/people/discover', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const people = await userRepository.listDiscoverableDevices();
    const enriched = await Promise.all(
      people
        .filter((p) => p.id !== device.id)
        .map(async (p) => {
          const status = await presenceService.getPresence(p.id);
          return {
            id: p.id,
            deviceId: p.deviceId,
            displayName: p.displayName,
            username: p.username,
            avatarUrl: p.displayAvatar,
            bio: p.bio,
            status,
            lastSeen: p.lastSeen
          };
        })
    );
    return reply.status(200).send({ people: enriched });
  });

  // Search people
  fastify.get('/api/v1/people/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: { code: 'MISSING_QUERY', message: 'Search query required' } });
    }

    const results = await userRepository.searchDevices(q.trim());
    const enriched = await Promise.all(
      results.map(async (p) => {
        const status = await presenceService.getPresence(p.id);
        return {
          id: p.id,
          deviceId: p.deviceId,
          displayName: p.displayName,
          username: p.username,
          avatarUrl: p.displayAvatar,
          bio: p.bio,
          status,
          lastSeen: p.lastSeen
        };
      })
    );
    return reply.status(200).send({ people: enriched });
  });

  // Get user profile
  fastify.get('/api/v1/people/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await userRepository.findDeviceById(userId);
    if (!user) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const status = await presenceService.getPresence(user.id);
    return reply.status(200).send({
      profile: {
        id: user.id,
        deviceId: user.deviceId,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.displayAvatar,
        bio: user.bio,
        discoverable: user.discoverable,
        status,
        lastSeen: user.lastSeen
      }
    });
  });
}
