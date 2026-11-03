/**
 * Gestão de usuários da conta (Fase 6).
 * Somente `admin` acessa. `gestor` e `consulta` não veem esta rota.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authWeb, hashSenha } from '../auth.js';
import { registrar } from '../auditoria.js';

const ROLES = ['admin', 'gestor', 'consulta'];

function apenasAdmin(req, res, next) {
  if (req.usuario?.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem gerenciar usuários' });
  }
  next();
}

function tratarErro(res, e, contexto) {
  if (e.code === 'DB_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado' });
  }
  if (e.code === '23505') {
    return res.status(409).json({ error: 'E-mail já cadastrado' });
  }
  console.error(`[USUARIOS] ${contexto}:`, e.message);
  return res.status(500).json({ error: 'Erro interno' });
}

export function createUsuariosRouter() {
  const router = Router();
  router.use(authWeb);
  router.use(apenasAdmin);

  router.get('/', async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT id, nome, email, role, ativo, ultimo_login, created_at
           FROM usuarios
          WHERE empresa_id = $1
          ORDER BY nome ASC`,
        [req.usuario.empresa_id]
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'list');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { nome, email, senha, role } = req.body || {};
      if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
      }
      if (!senha || String(senha).length < 8) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
      }
      if (role && !ROLES.includes(role)) {
        return res.status(400).json({ error: 'Perfil inválido' });
      }

      const senha_hash = await hashSenha(senha);
      const { rows } = await query(
        `INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role)
         VALUES ($1, $2, lower($3), $4, $5)
         RETURNING id, nome, email, role, ativo`,
        [req.usuario.empresa_id, String(nome).trim(), String(email).trim(), senha_hash, role || 'consulta']
      );

      registrar(req, {
        acao: 'criar',
        entidade: 'usuarios',
        entidadeId: rows[0].id,
        detalhes: { nome: rows[0].nome, email: rows[0].email, role: rows[0].role },
      });
      res.status(201).json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'create');
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const { nome, role, ativo } = req.body || {};
      const data = {};
      if (nome !== undefined) data.nome = String(nome).trim();
      if (role !== undefined) {
        if (!ROLES.includes(role)) return res.status(400).json({ error: 'Perfil inválido' });
        data.role = role;
      }
      if (ativo !== undefined) data.ativo = Boolean(ativo);
      if (!Object.keys(data).length) {
        return res.status(400).json({ error: 'Nenhum campo informado' });
      }

      const alvoEhProprio = String(req.params.id) === String(req.usuario.id);
      if (alvoEhProprio && data.ativo === false) {
        return res.status(400).json({ error: 'Não é possível desativar o próprio usuário' });
      }
      if (alvoEhProprio && data.role && data.role !== 'admin') {
        return res.status(400).json({ error: 'Não é possível remover o próprio perfil de administrador' });
      }

      const chaves = Object.keys(data);
      const params = chaves.map((k) => data[k]);
      params.push(req.params.id, req.usuario.empresa_id);
      const { rows } = await query(
        `UPDATE usuarios
            SET ${chaves.map((k, i) => `${k} = $${i + 1}`).join(', ')}
          WHERE id = $${params.length - 1} AND empresa_id = $${params.length}
          RETURNING id, nome, email, role, ativo`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

      if (data.ativo === false) {
        await query(
          'UPDATE sessoes SET revoked_at = now() WHERE usuario_id = $1 AND revoked_at IS NULL',
          [req.params.id]
        );
      }

      registrar(req, { acao: 'atualizar', entidade: 'usuarios', entidadeId: req.params.id, detalhes: data });
      res.json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'update');
    }
  });

  router.post('/:id/reset-password', async (req, res) => {
    try {
      const { senha } = req.body || {};
      if (!senha || String(senha).length < 8) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
      }
      const senha_hash = await hashSenha(senha);
      const { rows } = await query(
        `UPDATE usuarios SET senha_hash = $1
          WHERE id = $2 AND empresa_id = $3
          RETURNING id`,
        [senha_hash, req.params.id, req.usuario.empresa_id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

      await query(
        'UPDATE sessoes SET revoked_at = now() WHERE usuario_id = $1 AND revoked_at IS NULL',
        [req.params.id]
      );
      registrar(req, { acao: 'reset_senha', entidade: 'usuarios', entidadeId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'reset-password');
    }
  });

  router.post('/:id/revoke-sessions', async (req, res) => {
    try {
      const { rows } = await query(
        `UPDATE sessoes s
            SET revoked_at = now()
           FROM usuarios u
          WHERE s.usuario_id = u.id
            AND u.id = $1
            AND u.empresa_id = $2
            AND s.revoked_at IS NULL
          RETURNING s.id`,
        [req.params.id, req.usuario.empresa_id]
      );
      registrar(req, {
        acao: 'revogar_sessoes',
        entidade: 'usuarios',
        entidadeId: req.params.id,
        detalhes: { sessoes: rows.length },
      });
      res.json({ ok: true, revogadas: rows.length });
    } catch (e) {
      tratarErro(res, e, 'revoke-sessions');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (String(req.params.id) === String(req.usuario.id)) {
        return res.status(400).json({ error: 'Não é possível excluir o próprio usuário' });
      }
      const { rows } = await query(
        `UPDATE usuarios SET ativo = false
          WHERE id = $1 AND empresa_id = $2
          RETURNING id`,
        [req.params.id, req.usuario.empresa_id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

      await query(
        'UPDATE sessoes SET revoked_at = now() WHERE usuario_id = $1 AND revoked_at IS NULL',
        [req.params.id]
      );
      registrar(req, { acao: 'desativar', entidade: 'usuarios', entidadeId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'delete');
    }
  });

  return router;
}
