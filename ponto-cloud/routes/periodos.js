/**
 * Fechamento de período (Fase 7).
 *
 * Um período fechado bloqueia alterações em marcações, correções e descartes.
 * Reabertura exige `admin` e fica auditada.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authWeb } from '../auth.js';
import { registrar } from '../auditoria.js';

function tratarErro(res, e, contexto) {
  if (e.code === 'DB_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado' });
  }
  console.error(`[PERIODOS] ${contexto}:`, e.message);
  return res.status(500).json({ error: 'Erro interno' });
}

function empresaId(req, res) {
  const id = req.usuario?.empresa_id;
  if (!id) {
    res.status(400).json({ error: 'Usuário sem empresa vinculada' });
    return null;
  }
  return id;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Retorna o período fechado que contém a data, ou null.
 * Usado pelas rotas de apuração para bloquear alterações.
 */
export async function periodoFechadoParaData(empresa, data) {
  if (!empresa || !data) return null;
  const { rows } = await query(
    `SELECT id, data_inicio, data_fim
       FROM periodos_fechados
      WHERE empresa_id = $1
        AND reaberto_em IS NULL
        AND $2::date BETWEEN data_inicio AND data_fim
      LIMIT 1`,
    [empresa, data]
  );
  return rows[0] || null;
}

/**
 * Retorna um período fechado que se sobrepõe ao intervalo, ou null.
 */
export async function periodoFechadoNoIntervalo(empresa, dataInicio, dataFim) {
  if (!empresa || !dataInicio || !dataFim) return null;
  const { rows } = await query(
    `SELECT id, data_inicio, data_fim
       FROM periodos_fechados
      WHERE empresa_id = $1
        AND reaberto_em IS NULL
        AND data_inicio <= $3::date
        AND data_fim >= $2::date
      LIMIT 1`,
    [empresa, dataInicio, dataFim]
  );
  return rows[0] || null;
}

export function createPeriodosRouter() {
  const router = Router();
  router.use(authWeb);

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await query(
        `SELECT p.id,
                to_char(p.data_inicio, 'YYYY-MM-DD') AS data_inicio,
                to_char(p.data_fim, 'YYYY-MM-DD') AS data_fim,
                p.fechado_em,
                p.reaberto_em,
                p.motivo_reabertura,
                p.resumo,
                uf.nome AS fechado_por_nome,
                ur.nome AS reaberto_por_nome
           FROM periodos_fechados p
           LEFT JOIN usuarios uf ON uf.id = p.fechado_por
           LEFT JOIN usuarios ur ON ur.id = p.reaberto_por
          WHERE p.empresa_id = $1
          ORDER BY p.data_inicio DESC`,
        [empresa]
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'list');
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { data } = req.query;
      if (!data || !DATA_RE.test(data)) {
        return res.status(400).json({ error: 'data inválida (use YYYY-MM-DD)' });
      }
      const periodo = await periodoFechadoParaData(empresa, data);
      res.json({ fechado: Boolean(periodo), periodo });
    } catch (e) {
      tratarErro(res, e, 'status');
    }
  });

  router.post('/fechar', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      if (req.usuario?.role === 'consulta') {
        return res.status(403).json({ error: 'Perfil de consulta não pode fechar período' });
      }

      const { data_inicio, data_fim } = req.body || {};
      if (!DATA_RE.test(String(data_inicio || '')) || !DATA_RE.test(String(data_fim || ''))) {
        return res.status(400).json({ error: 'data_inicio e data_fim são obrigatórias (YYYY-MM-DD)' });
      }
      if (data_fim < data_inicio) {
        return res.status(400).json({ error: 'data_fim deve ser maior ou igual a data_inicio' });
      }

      const sobreposto = await periodoFechadoNoIntervalo(empresa, data_inicio, data_fim);
      if (sobreposto) {
        return res.status(409).json({
          error: `Já existe período fechado de ${sobreposto.data_inicio} a ${sobreposto.data_fim}`,
        });
      }

      const { rows: resumoRows } = await query(
        `SELECT
           (SELECT count(*)::int FROM marcacoes
             WHERE empresa_id = $1 AND data BETWEEN $2::date AND $3::date) AS marcacoes,
           (SELECT count(*)::int FROM correcoes
             WHERE empresa_id = $1 AND data BETWEEN $2::date AND $3::date) AS correcoes,
           (SELECT count(*)::int FROM dias_descartados
             WHERE empresa_id = $1 AND data BETWEEN $2::date AND $3::date) AS dias_descartados,
           (SELECT count(*)::int FROM marcacoes_descartadas
             WHERE empresa_id = $1 AND data BETWEEN $2::date AND $3::date) AS marcacoes_descartadas,
           (SELECT count(*)::int FROM banco_horas_ajustes
             WHERE empresa_id = $1 AND data BETWEEN $2::date AND $3::date) AS banco_ajustes,
           (SELECT count(*)::int FROM funcionarios
             WHERE empresa_id = $1 AND ativo = true) AS funcionarios_ativos`,
        [empresa, data_inicio, data_fim]
      );

      const { rows } = await query(
        `INSERT INTO periodos_fechados
           (empresa_id, data_inicio, data_fim, fechado_por, resumo)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, to_char(data_inicio, 'YYYY-MM-DD') AS data_inicio,
                   to_char(data_fim, 'YYYY-MM-DD') AS data_fim, fechado_em, resumo`,
        [empresa, data_inicio, data_fim, req.usuario.id, resumoRows[0]]
      );

      registrar(req, {
        acao: 'fechar_periodo',
        entidade: 'periodos_fechados',
        entidadeId: rows[0].id,
        detalhes: { data_inicio, data_fim, resumo: resumoRows[0] },
      });

      res.status(201).json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'fechar');
    }
  });

  router.post('/:id/reabrir', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      if (req.usuario?.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem reabrir período' });
      }

      const motivo = String(req.body?.motivo || '').trim();
      if (motivo.length < 5) {
        return res.status(400).json({ error: 'Informe o motivo da reabertura (mínimo 5 caracteres)' });
      }

      const { rows } = await query(
        `UPDATE periodos_fechados
            SET reaberto_em = now(),
                reaberto_por = $1,
                motivo_reabertura = $2
          WHERE id = $3
            AND empresa_id = $4
            AND reaberto_em IS NULL
          RETURNING id, to_char(data_inicio, 'YYYY-MM-DD') AS data_inicio,
                    to_char(data_fim, 'YYYY-MM-DD') AS data_fim, reaberto_em`,
        [req.usuario.id, motivo, req.params.id, empresa]
      );
      if (!rows[0]) {
        return res.status(404).json({ error: 'Período não encontrado ou já reaberto' });
      }

      registrar(req, {
        acao: 'reabrir_periodo',
        entidade: 'periodos_fechados',
        entidadeId: req.params.id,
        detalhes: { motivo, data_inicio: rows[0].data_inicio, data_fim: rows[0].data_fim },
      });

      res.json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'reabrir');
    }
  });

  return router;
}
