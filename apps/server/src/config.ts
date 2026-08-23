import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().default('postgresql://dipchats:dipchats_dev@localhost:5432/dipchats'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('dipchats_minio'),
  MINIO_SECRET_KEY: z.string().default('dipchats_minio_secret'),
  MINIO_BUCKET: z.string().default('dipchats'),
  MINIO_USE_SSL: z.coerce.boolean().default(false)
});

export const config = envSchema.parse(process.env);
