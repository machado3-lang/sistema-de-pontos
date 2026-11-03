/**
 * CRUD autenticado (sessão web) para o PostgreSQL.
 * Todas as consultas são isoladas por empresa_id.
 */

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authWeb, hashSenha, somenteDigitos } from '../auth.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick(body, columns) {
  const out = {};
  for (const c of columns) {
    if (body && body[c] !== undefined) out[c] = body[c];
  }
  return out;
}

async function insertRow(table, data, returning = '*') {
  const keys = Object.keys(data);
  if (!keys.length) {
    const err = new Error('Nenhum campo informado');
    err.status = 400;
    throw err;
  }
  const sql = `INSERT INTO ${table} (${keys.join(', ')})
               VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
               RETURNING ${returning}`;
  return query(sql, keys.map((k) => data[k]));
}

async function updateRow(table, id, data, { scopeColumn, scopeValue, returning = '*' } = {}) {
  const keys = Object.keys(data);
  if (!keys.length) {
    const err = new Error('Nenhum campo informado');
    err.status = 400;
    throw err;
  }
  const params = keys.map((k) => data[k]);
  const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  params.push(id);
  let where = `id = $${params.length}`;
  if (scopeColumn && scopeValue !== undefined && scopeValue !== null) {
    params.push(scopeValue);
    where += ` AND ${scopeColumn} = $${params.length}`;
  }
  const sql = `UPDATE ${table} SET ${setSql} WHERE ${where} RETURNING ${returning}`;
  return query(sql, params);
}

async function deleteRow(table, id, { scopeColumn, scopeValue } = {}) {
  const params = [id];
  let where = 'id = $1';
  if (scopeColumn && scopeValue !== undefined && scopeValue !== null) {
    params.push(scopeValue);
    where += ` AND ${scopeColumn} = $${params.length}`;
  }
  return query(`DELETE FROM ${table} WHERE ${where} RETURNING id`, params);
}

function empresaId(req, res) {
  const id = req.usuario?.empresa_id;
  if (!id) {
    res.status(400).json({ error: 'Usuário sem empresa vinculada' });
    return null;
  }
  return id;
}

function tratarErro(res, e, contexto) {
  if (e.code === 'DB_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado' });
  }
  if (e.status) {
    return res.status(e.status).json({ error: e.message });
  }
  if (e.code === '23505') {
    return res.status(409).json({ error: 'Registro duplicado' });
  }
  if (e.code === '23503') {
    return res.status(400).json({ error: 'Referência inválida' });
  }
  if (e.code === '22P02') {
    return res.status(400).json({ error: 'Valor inválido' });
  }
  console.error(`[CRUD] ${contexto}:`, e.message);
  return res.status(500).json({ error: 'Erro interno' });
}

function paginacao(req, max = 2000) {
  const limit = Math.min(parseInt(req.query.limit) || 500, max);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  return { limit, offset };
}

// ── CRUD genérico ───────────────────────────────────────────────────────────

function simpleCrud({
  table,
  columns,
  orderBy = 'created_at DESC',
  scopeColumn = 'empresa_id',
  scopeValue = (req) => req.usuario?.empresa_id ?? null,
  beforeCreate,
  beforeUpdate,
  allowCreate = true,
  allowUpdate = true,
  allowDelete = true,
}) {
  const router = Router();
  // `columns` é a whitelist de escrita, mas a leitura precisa sempre incluir o
  // `id` (o frontend usa o id para editar/excluir e para vincular registros).
  const select = ['id', ...columns, 'created_at'].join(', ');
  const scope = (req) => scopeValue(req);

  router.get('/', async (req, res) => {
    try {
      const params = [];
      const where = [];
      const sv = scope(req);
      if (sv !== null && sv !== undefined) {
        params.push(sv);
        where.push(`${scopeColumn} = $${params.length}`);
      }
      for (const c of columns) {
        if (req.query[c] !== undefined && req.query[c] !== '') {
          params.push(req.query[c]);
          where.push(`${c} = $${params.length}`);
        }
      }
      const { limit, offset } = paginacao(req);
      const sql = `SELECT ${select} FROM ${table}
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY ${orderBy}
                   LIMIT ${limit} OFFSET ${offset}`;
      const { rows } = await query(sql, params);
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, `${table}.list`);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const params = [req.params.id];
      let where = 'id = $1';
      const sv = scope(req);
      if (sv !== null && sv !== undefined) {
        params.push(sv);
        where += ` AND ${scopeColumn} = $${params.length}`;
      }
      const { rows } = await query(`SELECT ${select} FROM ${table} WHERE ${where} LIMIT 1`, params);
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json(rows[0]);
    } catch (e) {
      tratarErro(res, e, `${table}.get`);
    }
  });

  if (allowCreate) {
    router.post('/', async (req, res) => {
      try {
        let data = pick(req.body, columns);
        if (beforeCreate) data = await beforeCreate(data, req);
        if (scopeColumn === 'empresa_id' && !data.empresa_id) {
          const sv = scope(req);
          if (!sv) return res.status(400).json({ error: 'Usuário sem empresa vinculada' });
          data.empresa_id = sv;
        }
        const { rows } = await insertRow(table, data);
        res.status(201).json(rows[0]);
      } catch (e) {
        tratarErro(res, e, `${table}.create`);
      }
    });
  }

  if (allowUpdate) {
    router.put('/:id', async (req, res) => {
      try {
        let data = pick(req.body, columns);
        if (beforeUpdate) data = await beforeUpdate(data, req);
        const sv = scope(req);
        const { rows } = await updateRow(table, req.params.id, data, {
          scopeColumn,
          scopeValue: sv,
        });
        if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
        res.json(rows[0]);
      } catch (e) {
        tratarErro(res, e, `${table}.update`);
      }
    });
  }

  if (allowDelete) {
    router.delete('/:id', async (req, res) => {
      try {
        const sv = scope(req);
        const { rows } = await deleteRow(table, req.params.id, {
          scopeColumn,
          scopeValue: sv,
        });
        if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
        res.json({ ok: true });
      } catch (e) {
        tratarErro(res, e, `${table}.delete`);
      }
    });
  }

  return router;
}

// ── Funcionários ────────────────────────────────────────────────────────────

function funcionariosRouter() {
  const router = Router();
  const select = `f.*, d.nome AS departamento_nome, c.nome AS cargo_nome, h.nome AS horario_nome`;
  const joins = `FROM funcionarios f
                 LEFT JOIN departamentos d ON d.id = f.departamento_id
                 LEFT JOIN cargos c ON c.id = f.cargo_id
                 LEFT JOIN horarios h ON h.id = f.horario_id`;

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const params = [empresa];
      const where = ['f.empresa_id = $1'];

      if (req.query.ativo !== undefined && req.query.ativo !== '') {
        params.push(req.query.ativo === 'true' || req.query.ativo === '1');
        where.push(`f.ativo = $${params.length}`);
      }
      if (req.query.search) {
        params.push(`%${req.query.search}%`);
        where.push(`(f.nome ILIKE $${params.length} OR f.cpf LIKE $${params.length} OR f.pis LIKE $${params.length})`);
      }
      if (req.query.horario_id) {
        params.push(req.query.horario_id);
        where.push(`f.horario_id = $${params.length}`);
      }
      if (req.query.departamento_id) {
        params.push(req.query.departamento_id);
        where.push(`f.departamento_id = $${params.length}`);
      }

      const { limit, offset } = paginacao(req);
      const { rows } = await query(
        `SELECT ${select} ${joins}
          WHERE ${where.join(' AND ')}
          ORDER BY f.nome
          LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'funcionarios.list');
    }
  });

  // Histórico de horários (antes em localStorage).
  router.get('/:id/hist-horarios', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await query(
        `SELECT id, funcionario_id, horario_id,
                to_char(data_inicio, 'YYYY-MM-DD') AS data_inicio, created_at
           FROM funcionario_hist_horarios
          WHERE empresa_id = $1 AND funcionario_id = $2
          ORDER BY data_inicio ASC`,
        [empresa, req.params.id]
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'funcionarios.hist_horarios.list');
    }
  });

  router.put('/:id/hist-horarios', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const lista = Array.isArray(req.body?.historico) ? req.body.historico : [];
      const ehUUID = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
      const normalizada = lista
        .filter((h) => h && ehUUID(h.horario_id) && h.data_inicio)
        .slice(0, 500);

      const rows = await withTransaction(async (client) => {
        await client.query(
          'DELETE FROM funcionario_hist_horarios WHERE empresa_id = $1 AND funcionario_id = $2',
          [empresa, req.params.id]
        );
        const inseridos = [];
        for (const h of normalizada) {
          const r = await client.query(
            `INSERT INTO funcionario_hist_horarios
               (empresa_id, funcionario_id, horario_id, data_inicio)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (empresa_id, funcionario_id, horario_id, data_inicio) DO NOTHING
             RETURNING id, funcionario_id, horario_id,
                       to_char(data_inicio, 'YYYY-MM-DD') AS data_inicio`,
            [empresa, req.params.id, h.horario_id, h.data_inicio]
          );
          if (r.rows[0]) inseridos.push(r.rows[0]);
        }
        return inseridos;
      });

      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'funcionarios.hist_horarios.replace');
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await query(
        `SELECT ${select} ${joins} WHERE f.id = $1 AND f.empresa_id = $2 LIMIT 1`,
        [req.params.id, empresa]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });
      res.json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'funcionarios.get');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const body = req.body || {};
      const nome = String(body.nome || '').trim();
      const cpf = somenteDigitos(body.cpf);
      if (!nome || cpf.length !== 11) {
        return res.status(400).json({ error: 'Nome e CPF válido são obrigatórios' });
      }

      const data = {
        empresa_id: empresa,
        nome,
        cpf,
        pis: somenteDigitos(body.pis) || null,
        matricula: body.matricula || null,
        folha: body.folha || null,
        foto: body.foto || null,
        data_admissao: body.data_admissao || null,
        data_demissao: body.data_demissao || null,
        motivo_demissao: body.motivo_demissao || null,
        departamento_id: body.departamento_id || null,
        cargo_id: body.cargo_id || null,
        horario_id: body.horario_id || null,
        parametro_id: body.parametro_id || null,
        data_inicio: body.data_inicio || null,
        ativo: body.ativo !== false,
      };
      if (body.senha) data.senha_hash = await hashSenha(body.senha);

      const { rows } = await insertRow('funcionarios', data, 'id');
      const { rows: full } = await query(
        `SELECT ${select} ${joins} WHERE f.id = $1 AND f.empresa_id = $2`,
        [rows[0].id, empresa]
      );
      res.status(201).json(full[0]);
    } catch (e) {
      tratarErro(res, e, 'funcionarios.create');
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const body = req.body || {};
      const data = {};

      const simples = [
        'nome', 'matricula', 'folha', 'foto', 'data_admissao', 'data_demissao',
        'motivo_demissao', 'departamento_id', 'cargo_id', 'horario_id',
        'parametro_id', 'data_inicio', 'ativo',
      ];
      for (const c of simples) if (body[c] !== undefined) data[c] = body[c];

      if (body.cpf !== undefined) {
        const cpf = somenteDigitos(body.cpf);
        if (cpf.length !== 11) return res.status(400).json({ error: 'CPF inválido' });
        data.cpf = cpf;
      }
      if (body.pis !== undefined) data.pis = somenteDigitos(body.pis) || null;
      if (body.senha !== undefined) data.senha_hash = body.senha ? await hashSenha(body.senha) : null;

      const { rows } = await updateRow('funcionarios', req.params.id, data, {
        scopeColumn: 'empresa_id',
        scopeValue: empresa,
        returning: 'id',
      });
      if (!rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });

      const { rows: full } = await query(
        `SELECT ${select} ${joins} WHERE f.id = $1 AND f.empresa_id = $2`,
        [rows[0].id, empresa]
      );
      res.json(full[0]);
    } catch (e) {
      tratarErro(res, e, 'funcionarios.update');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await deleteRow('funcionarios', req.params.id, {
        scopeColumn: 'empresa_id',
        scopeValue: empresa,
      });
      if (!rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'funcionarios.delete');
    }
  });

  return router;
}

// ── Marcações ───────────────────────────────────────────────────────────────

function marcacoesRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const params = [empresa];
      const where = ['m.empresa_id = $1'];

      if (req.query.funcionario_id) {
        params.push(req.query.funcionario_id);
        where.push(`m.funcionario_id = $${params.length}`);
      }
      if (req.query.data_inicio) {
        params.push(req.query.data_inicio);
        where.push(`m.data >= $${params.length}`);
      }
      if (req.query.data_fim) {
        params.push(req.query.data_fim);
        where.push(`m.data <= $${params.length}`);
      }
      if (req.query.origem) {
        params.push(req.query.origem);
        where.push(`m.origem = $${params.length}`);
      }

      const { limit, offset } = paginacao(req, 50000);
      const { rows } = await query(
        `SELECT m.id, m.nsr, m.cpf, m.pis,
                to_char(m.data, 'YYYY-MM-DD') AS data,
                to_char(m.hora, 'HH24:MI:SS') AS hora,
                m.equip_id, m.equip_nome, m.origem, m.funcionario_id,
                f.nome AS funcionario_nome, m.created_at
           FROM marcacoes m
           LEFT JOIN funcionarios f ON f.id = m.funcionario_id
          WHERE ${where.join(' AND ')}
          ORDER BY m.data DESC, m.hora DESC
          LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'marcacoes.list');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const b = req.body || {};
      if (!b.data || !b.hora) {
        return res.status(400).json({ error: 'data e hora são obrigatórios' });
      }
      const { rows } = await query(
        `INSERT INTO marcacoes
           (empresa_id, funcionario_id, nsr, cpf, pis, data, hora, equip_id, equip_nome, origem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING
         RETURNING id, nsr, to_char(data, 'YYYY-MM-DD') AS data,
                   to_char(hora, 'HH24:MI:SS') AS hora, equip_id, equip_nome, origem`,
        [
          empresa,
          b.funcionario_id || null,
          b.nsr || null,
          somenteDigitos(b.cpf) || null,
          somenteDigitos(b.pis) || null,
          b.data,
          b.hora,
          b.equip_id || null,
          b.equip_nome || null,
          b.origem || 'manual',
        ]
      );
      res.status(201).json(rows[0] || { ok: true, duplicate: true });
    } catch (e) {
      tratarErro(res, e, 'marcacoes.create');
    }
  });

  router.post('/import', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const lista = Array.isArray(req.body?.marcacoes) ? req.body.marcacoes : [];
      if (!lista.length) return res.status(400).json({ error: 'Lista de marcações vazia' });

      const importadas = await withTransaction(async (client) => {
        let count = 0;
        for (const m of lista.slice(0, 50000)) {
          if (!m.data || !m.hora) continue;
          const r = await client.query(
            `INSERT INTO marcacoes
               (empresa_id, funcionario_id, nsr, cpf, pis, data, hora, equip_id, equip_nome, origem)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [
              empresa,
              m.funcionario_id || null,
              m.nsr || null,
              somenteDigitos(m.cpf) || null,
              somenteDigitos(m.pis) || null,
              m.data,
              m.hora,
              m.equip_id || null,
              m.equip_nome || null,
              m.origem || 'import',
            ]
          );
          if (r.rowCount) count++;
        }
        return count;
      });

      res.json({ importadas, total: lista.length });
    } catch (e) {
      tratarErro(res, e, 'marcacoes.import');
    }
  });

  return router;
}

// ── Correções ───────────────────────────────────────────────────────────────

function correcoesRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const params = [empresa];
      const where = ['empresa_id = $1'];
      if (req.query.funcionario_id) {
        params.push(req.query.funcionario_id);
        where.push(`funcionario_id = $${params.length}`);
      }
      if (req.query.data_inicio) {
        params.push(req.query.data_inicio);
        where.push(`data >= $${params.length}`);
      }
      if (req.query.data_fim) {
        params.push(req.query.data_fim);
        where.push(`data <= $${params.length}`);
      }
      const { limit, offset } = paginacao(req, 50000);
      const { rows } = await query(
        `SELECT id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data,
                batidas_manuais, justificativa, aplicada_em, created_at
           FROM correcoes
          WHERE ${where.join(' AND ')}
          ORDER BY data DESC
          LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'correcoes.list');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const b = req.body || {};
      if (!b.funcionario_id || !b.data) {
        return res.status(400).json({ error: 'funcionario_id e data são obrigatórios' });
      }
      const batidas = Array.isArray(b.batidas_manuais) ? b.batidas_manuais : [];
      const { rows } = await query(
        `INSERT INTO correcoes (empresa_id, funcionario_id, data, batidas_manuais, justificativa, aplicada_em)
         VALUES ($1, $2, $3, $4::time[], $5, now())
         ON CONFLICT (empresa_id, funcionario_id, data)
         DO UPDATE SET batidas_manuais = EXCLUDED.batidas_manuais,
                       justificativa = EXCLUDED.justificativa,
                       aplicada_em = now()
         RETURNING id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data,
                   batidas_manuais, justificativa, aplicada_em`,
        [empresa, b.funcionario_id, b.data, batidas, b.justificativa || null]
      );
      res.json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'correcoes.upsert');
    }
  });

  // Remove pela chave natural (usada pelo frontend ao restaurar um dia).
  router.delete('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { funcionario_id, data } = req.query;
      if (!funcionario_id || !data) {
        return res.status(400).json({ error: 'funcionario_id e data são obrigatórios' });
      }
      const { rows } = await query(
        `DELETE FROM correcoes
          WHERE empresa_id = $1 AND funcionario_id = $2 AND data = $3
          RETURNING id`,
        [empresa, funcionario_id, data]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Correção não encontrada' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'correcoes.deleteByKey');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await deleteRow('correcoes', req.params.id, {
        scopeColumn: 'empresa_id',
        scopeValue: empresa,
      });
      if (!rows[0]) return res.status(404).json({ error: 'Correção não encontrada' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'correcoes.delete');
    }
  });

  return router;
}

// ── Dias descartados ────────────────────────────────────────────────────────

function diasDescartadosRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const params = [empresa];
      const where = ['empresa_id = $1'];
      if (req.query.funcionario_id) {
        params.push(req.query.funcionario_id);
        where.push(`funcionario_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data, motivo, created_at
           FROM dias_descartados
          WHERE ${where.join(' AND ')}
          ORDER BY data DESC`,
        params
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'dias_descartados.list');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const b = req.body || {};
      if (!b.funcionario_id || !b.data) {
        return res.status(400).json({ error: 'funcionario_id e data são obrigatórios' });
      }
      const { rows } = await query(
        `INSERT INTO dias_descartados (empresa_id, funcionario_id, data, motivo)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (empresa_id, funcionario_id, data)
         DO UPDATE SET motivo = EXCLUDED.motivo
         RETURNING id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data, motivo`,
        [empresa, b.funcionario_id, b.data, b.motivo || null]
      );
      res.json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'dias_descartados.upsert');
    }
  });

  router.delete('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { funcionario_id, data } = req.query;
      if (!funcionario_id || !data) {
        return res.status(400).json({ error: 'funcionario_id e data são obrigatórios' });
      }
      const { rows } = await query(
        `DELETE FROM dias_descartados
          WHERE empresa_id = $1 AND funcionario_id = $2 AND data = $3
          RETURNING id`,
        [empresa, funcionario_id, data]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'dias_descartados.deleteByKey');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await deleteRow('dias_descartados', req.params.id, {
        scopeColumn: 'empresa_id',
        scopeValue: empresa,
      });
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'dias_descartados.delete');
    }
  });

  return router;
}

// ── Marcações descartadas ───────────────────────────────────────────────────

function marcacoesDescartadasRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const params = [empresa];
      const where = ['empresa_id = $1'];
      if (req.query.funcionario_id) {
        params.push(req.query.funcionario_id);
        where.push(`funcionario_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data,
                to_char(hora, 'HH24:MI:SS') AS hora, created_at
           FROM marcacoes_descartadas
          WHERE ${where.join(' AND ')}
          ORDER BY data DESC, hora ASC`,
        params
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'marcacoes_descartadas.list');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const b = req.body || {};
      if (!b.funcionario_id || !b.data || !b.hora) {
        return res.status(400).json({ error: 'funcionario_id, data e hora são obrigatórios' });
      }
      const { rows } = await query(
        `INSERT INTO marcacoes_descartadas (empresa_id, funcionario_id, data, hora)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (empresa_id, funcionario_id, data, hora) DO NOTHING
         RETURNING id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data,
                   to_char(hora, 'HH24:MI:SS') AS hora`,
        [empresa, b.funcionario_id, b.data, b.hora]
      );
      res.status(201).json(rows[0] || { ok: true, duplicate: true });
    } catch (e) {
      tratarErro(res, e, 'marcacoes_descartadas.create');
    }
  });

  router.delete('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { funcionario_id, data, hora } = req.query;
      if (!funcionario_id || !data || !hora) {
        return res.status(400).json({ error: 'funcionario_id, data e hora são obrigatórios' });
      }
      const { rows } = await query(
        `DELETE FROM marcacoes_descartadas
          WHERE empresa_id = $1 AND funcionario_id = $2 AND data = $3 AND hora = $4
          RETURNING id`,
        [empresa, funcionario_id, data, hora]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'marcacoes_descartadas.deleteByKey');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await deleteRow('marcacoes_descartadas', req.params.id, {
        scopeColumn: 'empresa_id',
        scopeValue: empresa,
      });
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'marcacoes_descartadas.delete');
    }
  });

  return router;
}

// ── Ajustes de banco de horas ───────────────────────────────────────────────

function bancoAjustesRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const params = [empresa];
      const where = ['empresa_id = $1'];
      if (req.query.funcionario_id) {
        params.push(req.query.funcionario_id);
        where.push(`funcionario_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data,
                minutos, motivo, created_at
           FROM banco_horas_ajustes
          WHERE ${where.join(' AND ')}
          ORDER BY data DESC`,
        params
      );
      res.json(rows);
    } catch (e) {
      tratarErro(res, e, 'banco_ajustes.list');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const b = req.body || {};
      if (!b.funcionario_id || !b.data || b.minutos === undefined) {
        return res.status(400).json({ error: 'funcionario_id, data e minutos são obrigatórios' });
      }
      const minutos = parseInt(b.minutos, 10);
      if (!Number.isFinite(minutos)) {
        return res.status(400).json({ error: 'minutos inválido' });
      }
      const { rows } = await query(
        `INSERT INTO banco_horas_ajustes (empresa_id, funcionario_id, data, minutos, motivo)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, funcionario_id, to_char(data, 'YYYY-MM-DD') AS data, minutos, motivo`,
        [empresa, b.funcionario_id, b.data, minutos, b.motivo || null]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      tratarErro(res, e, 'banco_ajustes.create');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const empresa = empresaId(req, res);
      if (!empresa) return;
      const { rows } = await deleteRow('banco_horas_ajustes', req.params.id, {
        scopeColumn: 'empresa_id',
        scopeValue: empresa,
      });
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json({ ok: true });
    } catch (e) {
      tratarErro(res, e, 'banco_ajustes.delete');
    }
  });

  return router;
}

// ── Router principal ────────────────────────────────────────────────────────

export function createCadastrosRouter() {
  const router = Router();
  router.use(authWeb);

  router.use('/funcionarios', funcionariosRouter());
  router.use('/empresas', simpleCrud({
    table: 'empresas',
    columns: [
      'razao_social', 'tipo_doc', 'cpf_cnpj', 'endereco', 'bairro', 'cep',
      'cidade', 'estado', 'telefone', 'numero_folha', 'responsavel_nome',
      'responsavel_cpf', 'responsavel_telefone', 'responsavel_email', 'ativo',
    ],
    scopeColumn: 'id',
    scopeValue: (req) => req.usuario?.empresa_id ?? null,
    orderBy: 'razao_social ASC',
    // `empresas` é o próprio tenant: excluir quebraria o usuário. Multiempresa
    // de verdade fica para a Fase 10.
    allowDelete: false,
    beforeCreate: (data) => ({
      ...data,
      cpf_cnpj: somenteDigitos(data.cpf_cnpj),
    }),
    beforeUpdate: (data) => (
      data.cpf_cnpj !== undefined
        ? { ...data, cpf_cnpj: somenteDigitos(data.cpf_cnpj) }
        : data
    ),
  }));

  router.use('/departamentos', simpleCrud({
    table: 'departamentos',
    columns: ['nome'],
    orderBy: 'nome ASC',
  }));
  router.use('/cargos', simpleCrud({
    table: 'cargos',
    columns: ['nome'],
    orderBy: 'nome ASC',
  }));
  router.use('/horarios', simpleCrud({
    table: 'horarios',
    columns: ['nome', 'tipo', 'config', 'ativo'],
    orderBy: 'nome ASC',
  }));
  router.use('/parametros', simpleCrud({
    table: 'parametros',
    columns: ['nome', 'config', 'ativo'],
    orderBy: 'nome ASC',
  }));
  router.use('/feriados', simpleCrud({
    table: 'feriados',
    columns: ['data', 'nome', 'tipo'],
    orderBy: 'data ASC',
  }));
  router.use('/equipamentos', simpleCrud({
    table: 'equipamentos',
    columns: [
      'nome', 'modelo', 'num_serie', 'localizacao', 'tipo_conexao', 'ip',
      'porta', 'usuario', 'senha', 'cloud_url', 'api_key', 'cloud_rep_id',
      'observacoes', 'portaria', 'ativo',
    ],
    orderBy: 'nome ASC',
  }));

  // Rotas mais específicas primeiro para evitar conflito de prefixo.
  router.use('/marcacoes-descartadas', marcacoesDescartadasRouter());
  router.use('/marcacoes', marcacoesRouter());
  router.use('/correcoes', correcoesRouter());
  router.use('/dias-descartados', diasDescartadosRouter());
  router.use('/banco-horas/ajustes', bancoAjustesRouter());

  return router;
}
