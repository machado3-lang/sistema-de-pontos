/**
 * Rotas de autenticação web (e-mail + senha).
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authWeb, criarSessao, hashSenha, verificarSenha } from '../auth.js';
import { loginPermitido, limparTentativas } from '../rate-limit.js';

function erro(res, e, contexto) {
  if (e.code === 'DB_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado' });
  }
  console.error(`[AUTH] ${contexto}:`, e.message);
  return res.status(500).json({ error: 'Erro interno' });
}

export function createAuthRouter() {
  const router = Router();

  router.post('/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha ?? req.body?.password ?? '');
    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const chave = `login:${email}@${req.ip || '?'}`;
    if (!loginPermitido(chave)) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }

    try {
      const { rows } = await query(
        `SELECT id, nome, email, senha_hash, role, empresa_id, ativo
           FROM usuarios
          WHERE lower(email) = lower($1)
          LIMIT 1`,
        [email]
      );
      const u = rows[0];
      if (!u || !u.ativo || !verificarSenha(senha, u.senha_hash)) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const { token, expiresAt } = await criarSessao(u.id);
      await query('UPDATE usuarios SET ultimo_login = now() WHERE id = $1', [u.id]);
      limparTentativas(chave);

      res.json({
        token,
        expires_at: expiresAt,
        usuario: {
          id: u.id,
          nome: u.nome,
          email: u.email,
          role: u.role,
          empresa_id: u.empresa_id,
        },
      });
    } catch (e) {
      erro(res, e, 'login');
    }
  });

  router.get('/me', authWeb, async (req, res) => {
    try {
      let empresa = null;
      if (req.usuario.empresa_id) {
        const { rows } = await query(
          'SELECT id, razao_social, cpf_cnpj FROM empresas WHERE id = $1',
          [req.usuario.empresa_id]
        );
        empresa = rows[0] || null;
      }
      res.json({ usuario: { ...req.usuario, empresa } });
    } catch (e) {
      erro(res, e, 'me');
    }
  });

  router.post('/logout', authWeb, async (req, res) => {
    try {
      await query('UPDATE sessoes SET revoked_at = now() WHERE id = $1', [req.sessaoId]);
      res.json({ ok: true });
    } catch (e) {
      erro(res, e, 'logout');
    }
  });

  router.post('/change-password', authWeb, async (req, res) => {
    const atual = String(req.body?.senha_atual ?? req.body?.current_password ?? '');
    const nova = String(req.body?.senha_nova ?? req.body?.new_password ?? '');
    if (nova.length < 8) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres' });
    }

    try {
      const { rows } = await query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
      if (!rows[0] || !verificarSenha(atual, rows[0].senha_hash)) {
        return res.status(401).json({ error: 'Senha atual inválida' });
      }

      const senha_hash = await hashSenha(nova);
      await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [senha_hash, req.usuario.id]);
      await query(
        'UPDATE sessoes SET revoked_at = now() WHERE usuario_id = $1 AND id <> $2',
        [req.usuario.id, req.sessaoId]
      );
      res.json({ ok: true });
    } catch (e) {
      erro(res, e, 'change-password');
    }
  });

  return router;
}
