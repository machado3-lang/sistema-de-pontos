/**
 * Runner de migrations PostgreSQL.
 * Uso: DATABASE_URL=postgres://... npm run migrate
 */

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL não definida.');
  process.exit(1);
}

const useSSL = process.env.PGSSL === 'true' || /sslmode=require/.test(DATABASE_URL);
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

const LOCK_ID = 728374;

try {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.version));
    const arquivos = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const arquivo of arquivos) {
      const version = arquivo.replace(/\.sql$/, '');
      if (aplicadas.has(version)) {
        console.log(`[migrate] ${version} já aplicada`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, arquivo), 'utf8');
      console.log(`[migrate] aplicando ${version}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
          [version]
        );
        await client.query('COMMIT');
        console.log(`[migrate] ${version} OK`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    } catch {}
    client.release();
  }
} catch (e) {
  console.error('[migrate] erro:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
