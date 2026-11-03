/**
 * Rotas do app mobile (CPF + senha, token HMAC e hora do servidor).
 */

import { Router } from 'express';
import { query } from '../db.js';
import {
  bearer, somenteDigitos, verificarSenha, assinarTokenMobile, verificarTokenMobile, agoraSaoPaulo,
} from '../auth.js';
import { loginPermitido, limparTentativas } from '../rate-limit.js';

function erro(res, e, contexto) {
  if (e.code === 'DB_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado' });
  }
  console.error(`[MOBILE] ${contexto}:`, e.message);
  return res.status(500).json({ error: 'Erro interno' });
}

export function createMobileRouter() {
  const router = Router();

  router.post('/login', async (req, res) => {
    const cpf = somenteDigitos(req.body?.cpf);
    const senha = String(req.body?.senha || '');
    const empresaId = req.body?.empresa_id ? String(req.body.empresa_id) : null;

    if (cpf.length !== 11 || !senha) {
      return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
    }

    const chave = `mobile:${cpf}@${req.ip || '?'}`;
    if (!loginPermitido(chave)) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }

    try {
      const { rows } = await query(
        `SELECT f.id, f.nome, f.cpf, f.pis, f.empresa_id, f.senha_hash, e.razao_social
           FROM funcionarios f
           JOIN empresas e ON e.id = f.empresa_id
          WHERE f.cpf = $1
            AND f.ativo = true
            AND ($2::uuid IS NULL OR f.empresa_id = $2::uuid)
          ORDER BY f.nome
          LIMIT 2`,
        [cpf, empresaId]
      );

      if (!rows.length) {
        return res.status(401).json({ error: 'CPF ou senha inválidos' });
      }
      if (rows.length > 1) {
        return res.status(409).json({
          error: 'CPF encontrado em mais de uma empresa. Informe a empresa.',
          empresas: rows.map((r) => ({ id: r.empresa_id, nome: r.razao_social })),
        });
      }

      const f = rows[0];
      if (!f.senha_hash || !verificarSenha(senha, f.senha_hash)) {
        return res.status(401).json({ error: 'CPF ou senha inválidos' });
      }

      limparTentativas(chave);
      const token = assinarTokenMobile({
        sub: f.id,
        empresa_id: f.empresa_id,
        cpf,
        pis: somenteDigitos(f.pis),
        exp: Date.now() + 8 * 60 * 60 * 1000,
      });

      res.json({
        token,
        funcionario: {
          id: f.id,
          nome: f.nome,
          cpf: f.cpf,
          pis: f.pis || '',
          empresa_id: f.empresa_id,
        },
      });
    } catch (e) {
      erro(res, e, 'login');
    }
  });

  router.post('/marcar', async (req, res) => {
    const payload = verificarTokenMobile(bearer(req));
    if (!payload) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const { data, hora } = agoraSaoPaulo();
    const nsr = Date.now();

    try {
      const { rows } = await query(
        `INSERT INTO marcacoes
           (empresa_id, funcionario_id, nsr, cpf, pis, data, hora, equip_id, equip_nome, origem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'mobile', 'App Mobile', 'mobile')
         ON CONFLICT DO NOTHING
         RETURNING id, nsr, to_char(data, 'YYYY-MM-DD') AS data,
                   to_char(hora, 'HH24:MI:SS') AS hora, equip_nome, origem`,
        [payload.empresa_id, payload.sub, nsr, payload.cpf, payload.pis || '', data, hora]
      );

      const marcacao = rows[0] || {
        nsr,
        data,
        hora,
        equip_nome: 'App Mobile',
        origem: 'mobile',
      };
      res.json({ success: true, marcacao });
    } catch (e) {
      erro(res, e, 'marcar');
    }
  });

  router.get('/marcacoes', async (req, res) => {
    const payload = verificarTokenMobile(bearer(req));
    if (!payload) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const { data: hoje } = agoraSaoPaulo();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    try {
      const { rows } = await query(
        `SELECT id, nsr, cpf, pis,
                to_char(data, 'YYYY-MM-DD') AS data,
                to_char(hora, 'HH24:MI:SS') AS hora,
                equip_id, equip_nome, origem, created_at
           FROM marcacoes
          WHERE empresa_id = $1
            AND funcionario_id = $2
            AND data = $3
          ORDER BY hora ASC
          LIMIT $4`,
        [payload.empresa_id, payload.sub, hoje, limit]
      );
      res.json({ marcacoes: rows });
    } catch (e) {
      erro(res, e, 'listar marcações');
    }
  });

  return router;
}
