import { FastifyInstance } from 'fastify';
import { userRepository } from '../repositories/user-repository';
import { sessionService } from '../services/session-service';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_\-\s]+$/).optional(),
  username: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
  discoverable: z.boolean().optional()
});

export async function profileRoutes(fastify: FastifyInstance) {
  // Get my profile
  fastify.get('/api/v1/profile/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    return reply.status(200).send({
      profile: {
        id: device.id,
        deviceId: device.deviceId,
        displayName: device.displayName,
        username: device.username,
        avatarUrl: device.displayAvatar,
        bio: device.bio,
        discoverable: device.discoverable,
        lastSeen: device.lastSeen
      }
    });
  });

  // Update my profile
  fastify.patch('/api/v1/profile/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const parseResult = UpdateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid profile data' } });
    }

    const updated = await userRepository.updateProfile(device.id, parseResult.data);
    if (!updated) {
      return reply.status(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to update profile' } });
    }

    return reply.status(200).send({
      profile: {
        id: updated.id,
        deviceId: updated.deviceId,
        displayName: updated.displayName,
        username: updated.username,
        avatarUrl: updated.displayAvatar,
        bio: updated.bio,
        discoverable: updated.discoverable,
        lastSeen: updated.lastSeen
      }
    });
  });
}
