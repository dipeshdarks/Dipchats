import { FastifyInstance } from 'fastify';
import { userRepository } from '../repositories/user-repository';
import { channelRepository } from '../repositories/channel-repository';
import { messageRepository } from '../repositories/message-repository';

export async function searchRoutes(fastify: FastifyInstance) {
  // Global search
  fastify.get('/api/v1/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: { code: 'MISSING_QUERY', message: 'Search query required' } });
    }

    const query = q.trim();
    const [people, channels] = await Promise.all([
      userRepository.searchDevices(query),
      channelRepository.searchChannels(query)
    ]);

    return reply.status(200).send({
      people: people.map((p) => ({
        id: p.id,
        deviceId: p.deviceId,
        displayName: p.displayName,
        username: p.username,
        avatarUrl: p.displayAvatar,
        bio: p.bio
      })),
      channels: channels.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        privacy: c.privacy,
        memberCount: c.memberCount
      })),
      messages: []
    });
  });
}
