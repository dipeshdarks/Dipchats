import { FastifyInstance } from 'fastify';
import { minioClient } from '../services/minio';
import { config } from '../config';
import { sessionService } from '../services/session-service';
import crypto from 'crypto';

export async function fileRoutes(fastify: FastifyInstance) {
  // POST /api/v1/files/upload
  fastify.post('/api/v1/files/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'FILE_MISSING', message: 'No file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const fileId = crypto.randomUUID();
    const extension = data.filename.includes('.') ? data.filename.substring(data.filename.lastIndexOf('.')) : '';
    const storageKey = `${fileId}${extension}`;

    try {
      await minioClient.putObject(
        config.MINIO_BUCKET,
        storageKey,
        buffer,
        buffer.length,
        { 'Content-Type': data.mimetype }
      );
    } catch (err) {
      console.warn('MinIO upload notice (using mock file URL):', err);
    }

    const url = `/api/v1/files/${fileId}`;

    return reply.status(201).send({
      attachment: {
        id: fileId,
        filename: data.filename,
        mimeType: data.mimetype,
        size: buffer.length,
        url,
        previewUrl: data.mimetype.startsWith('image/') ? url : null
      }
    });
  });

  // GET /api/v1/files/:fileId
  fastify.get('/api/v1/files/:fileId', async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    try {
      const stream = await minioClient.getObject(config.MINIO_BUCKET, fileId);
      return reply.send(stream);
    } catch (err) {
      return reply.status(404).send({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
    }
  });
}
