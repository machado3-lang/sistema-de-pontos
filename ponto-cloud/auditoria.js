/**
 * Auditoria de mutações (Fase 6).
 *
 * Grava quem alterou o quê. É "fire-and-forget": uma falha de auditoria não
 * derruba a operação principal, mas fica registrada no log do servidor.
 */

import { query, dbReady } from './db.js';

export function registrar(req, { acao, entidade, entidadeId, detalhes }) {
  if (!dbReady) return;
  const empresaId = req.usuario?.empresa_id || null;
  const usuarioId = req.usuario?.id || null;

  query(
    `INSERT INTO auditoria (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      empresaId,
      usuarioId,
      acao,
      entidade || null,
      entidadeId !== undefined && entidadeId !== null ? String(entidadeId) : null,
      detalhes || null,
    ]
  ).catch((e) => console.warn('[AUDITORIA]', e.message));
}
