import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';

async function runMigration() {
  const url = process.env.DATABASE_URL || 'postgresql://dipchats:dipchats_dev@localhost:5432/dipchats';
  console.log('Running migrations on:', url);

  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });
    console.log('Migrations complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigration();
