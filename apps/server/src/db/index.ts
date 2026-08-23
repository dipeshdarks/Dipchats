import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@dipchats/database';
import { config } from '../config';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;
let isDbConnected = false;

export function getDb() {
  if (!dbInstance) {
    clientInstance = postgres(config.DATABASE_URL, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 5,
      onnotice: () => {}
    });
    dbInstance = drizzle(clientInstance, { schema });
  }
  return dbInstance;
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    const db = getDb();
    if (clientInstance) {
      await clientInstance`SELECT 1`;
      isDbConnected = true;
      return true;
    }
    return false;
  } catch (err) {
    isDbConnected = false;
    return false;
  }
}

export function isDatabaseConnected(): boolean {
  return isDbConnected;
}

export async function closeDbConnection() {
  if (clientInstance) {
    await clientInstance.end();
    clientInstance = null;
    dbInstance = null;
    isDbConnected = false;
  }
}

export { schema };
