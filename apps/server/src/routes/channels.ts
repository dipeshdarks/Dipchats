import { FastifyInstance } from 'fastify';
import { channelRepository } from '../repositories/channel-repository';
import { sessionService } from '../services/session-service';
import { z } from 'zod';

const CreateChannelSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  type: z.enum(['public', 'private', 'group', 'dm']).default('public'),
  privacy: z.enum(['public', 'discoverable', 'invite_only', 'private']).default('public'),
  avatarUrl: z.string().url().optional(),
  maxMembers: z.number().int().min(2).max(100000).optional()
});

export async function channelRoutes(fastify: FastifyInstance) {
  // List all channels (with membership info)
  fastify.get('/api/v1/channels', async (request, reply) => {
    const list = await channelRepository.listChannels();
    return reply.status(200).send({ channels: list });
  });

  // List public/discoverable channels for browsing
  fastify.get('/api/v1/channels/discover', async (request, reply) => {
    const list = await channelRepository.listDiscoverableChannels();
    return reply.status(200).send({ channels: list });
  });

  // Search channels
  fastify.get('/api/v1/channels/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: { code: 'MISSING_QUERY', message: 'Search query required' } });
    }
    const results = await channelRepository.searchChannels(q.trim());
    return reply.status(200).send({ channels: results });
  });

  // Get channels the current user has joined
  fastify.get('/api/v1/channels/my', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }
    const channels = await channelRepository.getDeviceChannels(device.id);
    return reply.status(200).send({ channels });
  });

  // Create channel
  fastify.post('/api/v1/channels', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const parseResult = CreateChannelSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid channel payload' } });
    }

    const { name, description, type, privacy, avatarUrl, maxMembers } = parseResult.data;
    const channel = await channelRepository.createChannel({
      name,
      description,
      type,
      privacy,
      ownerId: device.id,
      avatarUrl,
      maxMembers
    });

    return reply.status(201).send({ channel });
  });

  // Get channel by invite code
  fastify.get('/api/v1/channels/invite/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const channel = await channelRepository.findChannelByInviteCode(code);
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Invalid invite code' } });
    }
    return reply.status(200).send({ channel });
  });

  // Join channel
  fastify.post('/api/v1/channels/:channelId/join', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { channelId } = request.params as { channelId: string };
    const channel = await channelRepository.findChannelById(channelId);
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });
    }

    if (channel.privacy === 'invite_only' || channel.privacy === 'private') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'This channel requires an invite' } });
    }

    const added = await channelRepository.addMember(channelId, device.id);
    return reply.status(200).send({ joined: added, channel });
  });

  // Leave channel
  fastify.post('/api/v1/channels/:channelId/leave', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { channelId } = request.params as { channelId: string };
    await channelRepository.removeMember(channelId, device.id);
    return reply.status(200).send({ left: true });
  });

  // Join by invite code
  fastify.post('/api/v1/channels/join/:code', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { code } = request.params as { code: string };
    const channel = await channelRepository.findChannelByInviteCode(code);
    if (!channel) {
      return reply.status(404).send({ error: { code: 'INVALID_CODE', message: 'Invalid invite code' } });
    }

    const added = await channelRepository.addMember(channel.id, device.id);
    return reply.status(200).send({ joined: added, channel });
  });

  // Get channel members
  fastify.get('/api/v1/channels/:channelId/members', async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const members = await channelRepository.getMembers(channelId);
    return reply.status(200).send({ members });
  });

  // Generate invite code
  fastify.post('/api/v1/channels/:channelId/invite', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }
    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);
    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session invalid' } });
    }

    const { channelId } = request.params as { channelId: string };
    const code = await channelRepository.generateInviteCode(channelId);
    return reply.status(200).send({ code, url: `dipchats://join/${code}` });
  });

  // Get online users
  fastify.get('/api/v1/users', async (request, reply) => {
    const users = await sessionService.listActiveUsers();
    return reply.status(200).send({ users });
  });
}
