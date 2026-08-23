import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export * from 'drizzle-orm';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

export function getDb(connectionString?: string) {
  if (!dbInstance) {
    const url =
      connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://dipchats:dipchats_dev@localhost:5432/dipchats';

    clientInstance = postgres(url, { max: 20 });
    dbInstance = drizzle(clientInstance, { schema });
  }
  return dbInstance;
}

export async function closeDb() {
  if (clientInstance) {
    await clientInstance.end();
    clientInstance = null;
    dbInstance = null;
  }
}
