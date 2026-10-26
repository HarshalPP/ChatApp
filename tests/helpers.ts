import 'dotenv/config';
import type { Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { createPool } from '../src/db/pool';
import { createMemoryMessageStore } from '../src/stores/memory-message.store';

export interface TestContext {
  app: Express;
  db: Pool;
}

/**
 * Uses a real PostgreSQL database (TEST_DATABASE_URL) and the in-memory message store.
 * The database is wiped, so never point this at real data.
 */
export async function setupTestApp(): Promise<TestContext> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Set TEST_DATABASE_URL to run the tests');

  const db = createPool(url);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(db);

  return { db, app: createApp({ db, messageStore: createMemoryMessageStore() }) };
}

export async function createUser(app: Express, name: string): Promise<string> {
  const res = await request(app).post('/user').send({ name }).expect(201);
  return res.body.id as string;
}
