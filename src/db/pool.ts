import { Pool } from 'pg';

export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 10 });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
  });

  return pool;
}
