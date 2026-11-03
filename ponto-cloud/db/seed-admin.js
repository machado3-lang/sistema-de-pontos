/**
 * Cria/atualiza o usuário admin inicial.
 * Uso:
 *   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
 */

import { randomBytes, scryptSync } from 'crypto';
import pg from 'pg';

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('[seed] Defina DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD.');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('[seed] ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');
  process.exit(1);
}

function hashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(senha), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const useSSL = process.env.PGSSL === 'true' || /sslmode=require/.test(DATABASE_URL);
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

try {
  const empresaDoc = (process.env.EMPRESA_DOC || '00000000000000').replace(/\D/g, '');
  const tipoDoc = empresaDoc.length > 11 ? 'CNPJ' : 'CPF';

  const empresa = await pool.query(
    `INSERT INTO empresas (razao_social, tipo_doc, cpf_cnpj)
     VALUES ($1, $2, $3)
     ON CONFLICT (cpf_cnpj) DO UPDATE SET razao_social = EXCLUDED.razao_social
     RETURNING id`,
    [process.env.EMPRESA_RAZAO || 'Empresa Padrão', tipoDoc, empresaDoc]
  );

  const empresaId = empresa.rows[0].id;
  const senha_hash = hashSenha(ADMIN_PASSWORD);

  await pool.query(
    `INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role)
     VALUES ($1, $2, lower($3), $4, 'admin')
     ON CONFLICT (lower(email)) DO UPDATE
       SET senha_hash = EXCLUDED.senha_hash,
           nome = EXCLUDED.nome,
           empresa_id = EXCLUDED.empresa_id,
           ativo = true`,
    [empresaId, process.env.ADMIN_NAME || 'Administrador', ADMIN_EMAIL, senha_hash]
  );

  console.log('[seed] Admin criado/atualizado:', ADMIN_EMAIL);
  console.log('[seed] Empresa:', process.env.EMPRESA_RAZAO || 'Empresa Padrão', empresaId);
} catch (e) {
  console.error('[seed] erro:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
