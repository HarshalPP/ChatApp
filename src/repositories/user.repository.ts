import type { Pool } from 'pg';

export interface User {
  id: string;
  name: string;
  createdAt: Date;
}

export function createUserRepository(db: Pool) {
  async function create(name: string): Promise<User> {
    const { rows } = await db.query<User>(
      `INSERT INTO users (name) VALUES ($1)
       RETURNING id, name, created_at AS "createdAt"`,
      [name],
    );
    return rows[0]!;
  }

  async function findById(id: string): Promise<User | null> {
    const { rows } = await db.query<User>(
      `SELECT id, name, created_at AS "createdAt" FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async function findMissing(ids: string[]): Promise<string[]> {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const found = new Set(rows.map((r) => r.id));
    return ids.filter((id) => !found.has(id));
  }

  return { create, findById, findMissing };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
