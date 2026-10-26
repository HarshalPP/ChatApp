import { Pool } from 'pg';

export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 10 });

  pool.on('error', (err) => {
    // An idle client failed (e.g. DB restarted). The pool will create a new one on next use.
    console.error('Unexpected PostgreSQL pool error', err);
  });

  return pool;
}
