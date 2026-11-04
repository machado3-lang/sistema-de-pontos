/**
 * Consulta da trilha de auditoria (Fase 6/7).
 * Visível para `admin` e `gestor`.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authWeb } from '../auth.js';

export function createAuditoriaRouter() {
  const router = Router();
  router.use(authWeb);

  router.use((req, res, next) => {
    if (!['admin', 'gestor'].includes(req.usuario?.role)) {
      return res.status(403).json({ error: 'Sem permissão para ver a auditoria' });
    }
    next();
  });

  router.get('/', async (req, res) => {
    try {
      const empresa = req.usuario?.empresa_id;
      if (!empresa) return res.status(400).json({ error: 'Usuário sem empresa vinculada' });

      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const params = [empresa];
      const where = ['a.empresa_id = $1'];

      if (req.query.entidade) {
        params.push(req.query.entidade);
        where.push(`a.entidade = $${params.length}`);
      }
      if (req.query.acao) {
        params.push(req.query.acao);
        where.push(`a.acao = $${params.length}`);
      }
      if (req.query.usuario_id) {
        params.push(req.query.usuario_id);
        where.push(`a.usuario_id = $${params.length}`);
      }
      if (req.query.data_inicio) {
        params.push(req.query.data_inicio);
        where.push(`a.created_at >= $${params.length}::date`);
      }
      if (req.query.data_fim) {
        params.push(req.query.data_fim);
        where.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
      }

      const { rows } = await query(
        `SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.created_at,
                u.nome AS usuario_nome, u.email AS usuario_email
           FROM auditoria a
           LEFT JOIN usuarios u ON u.id = a.usuario_id
          WHERE ${where.join(' AND ')}
          ORDER BY a.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`,
        params
      );

      res.json(rows);
    } catch (e) {
      if (e.code === 'DB_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'Banco de dados não configurado' });
      }
      console.error('[AUDITORIA] list:', e.message);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  return router;
}
