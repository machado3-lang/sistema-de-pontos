/**
 * Conexão PostgreSQL (Railway) e helpers.
 * Se DATABASE_URL não estiver definida, as rotas de banco respondem 503.
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
const useSSL = process.env.PGSSL === 'true' || /sslmode=require/.test(DATABASE_URL);

export const dbReady = Boolean(DATABASE_URL);

export const pool = dbReady
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => console.error('[DB] erro no pool:', err.message));
} else {
  console.warn('[AVISO] DATABASE_URL não definida — rotas de auth/CRUD desabilitadas.');
}

export async function query(text, params) {
  if (!pool) {
    const err = new Error('Banco de dados não configurado (DATABASE_URL)');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  if (!pool) {
    const err = new Error('Banco de dados não configurado (DATABASE_URL)');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function dbHealth() {
  if (!pool) return 'not_configured';
  try {
    await pool.query('SELECT 1');
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function closeDb() {
  if (pool) await pool.end();
}
