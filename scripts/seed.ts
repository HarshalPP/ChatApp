import 'dotenv/config';
import { runMigrations } from '../src/db/migrate';
import { createPool } from '../src/db/pool';
import { createUserRepository } from '../src/repositories/user.repository';

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const db = createPool(url);
  try {
    await runMigrations(db);
    const users = createUserRepository(db);

    for (const name of ['Aman', 'Priya', 'Rahul']) {
      const user = await users.create(name);
      console.log(`${user.name.padEnd(6)} ${user.id}`);
    }
  } finally {
    await db.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
