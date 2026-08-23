import { FastifyInstance } from 'fastify';
import { JoinRequestSchema } from '@dipchats/shared';
import { sessionService } from '../services/session-service';

export async function authRoutes(fastify: FastifyInstance) {
  // OPEN -> NAME -> JOIN -> CREATE DEVICE IDENTITY
  fastify.post('/api/v1/auth/join', async (request, reply) => {
    const parseResult = JoinRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid join request payload',
          details: parseResult.error.format()
        }
      });
    }

    const { displayName, identityPublicKey, signingPublicKey, fingerprint } = parseResult.data;

    try {
      const result = await sessionService.join(displayName, identityPublicKey, signingPublicKey, fingerprint);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          code: 'JOIN_FAILED',
          message: err.message || 'Failed to join DipChats'
        }
      });
    }
  });

  // Get profile for token
  fastify.get('/api/v1/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
    }

    const token = authHeader.substring(7);
    const device = await sessionService.authenticateToken(token);

    if (!device) {
      return reply.status(401).send({ error: { code: 'AUTH_EXPIRED', message: 'Session token invalid or expired' } });
    }

    return reply.status(200).send({ device });
  });
}
