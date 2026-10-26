import { createApp } from './app';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';
import { checkFirestoreConnection, createFirestore } from './firebase/admin';
import { createFirestoreMessageStore } from './stores/firestore-message.store';

async function main() {
  const db = createPool(env.databaseUrl);
  await runMigrations(db);

  const firestore = createFirestore(env.firebaseProjectId, env.firestoreDatabaseId, env.firestoreEmulatorHost);
  await checkFirestoreConnection(firestore, env.firebaseProjectId, env.firestoreDatabaseId);
  const app = createApp({ db, messageStore: createFirestoreMessageStore(firestore) });

  const server = app.listen(env.port, () => {
    console.log(`Chat backend listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      db.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
