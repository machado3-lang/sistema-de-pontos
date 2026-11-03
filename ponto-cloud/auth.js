/**
 * Autenticação: senhas, sessões web e token mobile.
 */

import {
  randomBytes, scrypt, scryptSync, pbkdf2Sync, timingSafeEqual, createHmac, createHash,
} from 'crypto';
import { promisify } from 'util';
import { query } from './db.js';

const scryptAsync = promisify(scrypt);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let MOBILE_TOKEN_SECRET = process.env.MOBILE_TOKEN_SECRET || '';
if (!MOBILE_TOKEN_SECRET) {
  if (IS_PRODUCTION) {
    console.warn('[AVISO] MOBILE_TOKEN_SECRET não definido — sessões mobile serão invalidadas a cada reinício.');
  }
  MOBILE_TOKEN_SECRET = randomBytes(32).toString('hex');
}
const MOBILE_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

export function bearer(req) {
  const header = req.headers['authorization'] || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export const somenteDigitos = (v) => String(v || '').replace(/\D/g, '');

export function iguaisSeguro(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function hashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(String(senha), salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export function verificarSenha(senha, armazenado) {
  if (!armazenado) return false;
  const valor = String(armazenado);

  if (valor.startsWith('scrypt$')) {
    const [, salt, hash] = valor.split('$');
    if (!salt || !hash) return false;
    const calculado = scryptSync(String(senha), salt, 64).toString('hex');
    const a = Buffer.from(calculado);
    const b = Buffer.from(hash);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  if (valor.startsWith('pbkdf2$')) {
    const [, iterStr, saltB64, hashB64] = valor.split('$');
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, 'base64');
    const esperado = Buffer.from(hashB64, 'base64');
    const calculado = pbkdf2Sync(String(senha), salt, iterations, esperado.length, 'sha256');
    return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
  }

  // Legado: texto puro (migrado no primeiro login).
  const a = Buffer.from(valor);
  const b = Buffer.from(String(senha));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function novoToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export async function criarSessao(usuarioId) {
  const token = novoToken();
  const tokenHash = hashToken(token);
  const ttlHoras = Number(process.env.SESSION_TTL_HOURS) || 8;
  const expiresAt = new Date(Date.now() + ttlHoras * 3600 * 1000);
  await query(
    'INSERT INTO sessoes (usuario_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [usuarioId, tokenHash, expiresAt]
  );
  return { token, expiresAt };
}

export async function authWeb(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    const tokenHash = hashToken(token);
    const { rows } = await query(
      `SELECT s.id AS sessao_id, u.id, u.nome, u.email, u.role, u.empresa_id, u.ativo
         FROM sessoes s
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
        LIMIT 1`,
      [tokenHash]
    );
    const row = rows[0];
    if (!row || !row.ativo) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }
    req.usuario = {
      id: row.id,
      nome: row.nome,
      email: row.email,
      role: row.role,
      empresa_id: row.empresa_id,
    };
    req.sessaoId = row.sessao_id;
    next();
  } catch (e) {
    if (e.code === 'DB_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Banco de dados não configurado' });
    }
    console.error('[AUTH] erro ao validar sessão:', e.message);
    res.status(500).json({ error: 'Erro ao validar sessão' });
  }
}

export function assinarTokenMobile(payload) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const assinatura = createHmac('sha256', MOBILE_TOKEN_SECRET).update(corpo).digest('base64url');
  return `${corpo}.${assinatura}`;
}

export function verificarTokenMobile(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  const esperada = createHmac('sha256', MOBILE_TOKEN_SECRET).update(corpo).digest('base64url');
  const a = Buffer.from(assinatura || '');
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function agoraSaoPaulo() {
  const data = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date());
  return { data, hora };
}
