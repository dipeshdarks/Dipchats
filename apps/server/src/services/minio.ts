import { Client as MinioClient } from 'minio';
import { config } from '../config';

export const minioClient = new MinioClient({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY
});

export async function initMinio() {
  try {
    const bucketExists = await minioClient.bucketExists(config.MINIO_BUCKET);
    if (!bucketExists) {
      await minioClient.makeBucket(config.MINIO_BUCKET, 'us-east-1');
      console.log(`MinIO bucket '${config.MINIO_BUCKET}' created.`);
    } else {
      console.log(`MinIO bucket '${config.MINIO_BUCKET}' exists.`);
    }
  } catch (err) {
    console.warn('MinIO initialization warning (object storage may be unavailable):', err);
  }
}
