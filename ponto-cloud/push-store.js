/**
 * Persistência do push server (iDClass/iDFace).
 *
 * O `server.js` mantém o estado em memória para responder rápido aos REPs e
 * grava no PostgreSQL em paralelo (write-through). No boot, o estado é
 * recarregado do banco.
 */

import { query, dbReady } from './db.js';

const ativo = () => dbReady;

function semBanco(promise) {
  if (!ativo()) return Promise.resolve(null);
  return promise().catch((e) => {
    console.warn('[PUSH-DB]', e.message);
    return null;
  });
}

export function carregarEstado() {
  return semBanco(async () => {
    // Retenção: evita crescimento indefinido das tabelas de telemetria.
    await query(`DELETE FROM push_events WHERE received_at < now() - interval '30 days'`).catch(() => {});
    await query(`DELETE FROM push_results WHERE received_at < now() - interval '30 days'`).catch(() => {});
    await query(`DELETE FROM push_commands WHERE delivered_at < now() - interval '7 days'`).catch(() => {});

    const [devices, events, results, commands, marcacoes] = await Promise.all([
      query(`SELECT device_key, serial, ip, last_seen, poll_count, extra
               FROM push_devices`),
      query(`SELECT device_key, serial, ip, received_at, data
               FROM push_events
              ORDER BY received_at DESC
              LIMIT 2000`),
      query(`SELECT device_key, serial, ip, received_at, data
               FROM push_results
              ORDER BY received_at DESC
              LIMIT 500`),
      query(`SELECT cmd_id, payload
               FROM push_commands
              WHERE delivered_at IS NULL
              ORDER BY created_at ASC
              LIMIT 200`),
      query(`SELECT nsr, user_id, cpf, pis,
                    to_char(data, 'YYYY-MM-DD') AS data,
                    to_char(hora, 'HH24:MI:SS') AS hora,
                    serial, ip, origem, importado, received_at
               FROM push_marcacoes
              ORDER BY received_at DESC
              LIMIT 5000`),
    ]);
    return {
      devices: devices.rows,
      events: events.rows,
      results: results.rows,
      commands: commands.rows,
      marcacoes: marcacoes.rows,
    };
  });
}

export function salvarDevice({ device_key, serial, ip, poll_count, extra }) {
  return semBanco(() => query(
    `INSERT INTO push_devices (device_key, serial, ip, last_seen, poll_count, extra)
     VALUES ($1, $2, $3, now(), $4, $5)
     ON CONFLICT (device_key) DO UPDATE SET
       serial = COALESCE(EXCLUDED.serial, push_devices.serial),
       ip = EXCLUDED.ip,
       last_seen = now(),
       poll_count = EXCLUDED.poll_count,
       extra = EXCLUDED.extra`,
    [device_key, serial || null, ip || null, poll_count || 0, extra || {}]
  ));
}

export function salvarEventos(eventos = []) {
  return semBanco(async () => {
    for (const e of eventos) {
      await query(
        `INSERT INTO push_events (device_key, serial, ip, data)
         VALUES ($1, $2, $3, $4)`,
        [e.device_id, e.serial, e.ip, e.data]
      );
    }
  });
}

export function salvarResultado(resultado) {
  return semBanco(() => query(
    `INSERT INTO push_results (device_key, serial, ip, data)
     VALUES ($1, $2, $3, $4)`,
    [resultado.device_id, resultado.serial, resultado.ip, resultado.data]
  ));
}

export function salvarComando({ cmd_id, device_key, payload }) {
  return semBanco(() => query(
    `INSERT INTO push_commands (cmd_id, device_key, payload)
     VALUES ($1, $2, $3)`,
    [cmd_id, device_key || null, payload]
  ));
}

export function marcarComandoEntregue(cmdId) {
  return semBanco(() => query(
    `UPDATE push_commands
        SET delivered_at = now()
      WHERE cmd_id = $1 AND delivered_at IS NULL`,
    [cmdId]
  ));
}

export function limparResultados() {
  return semBanco(() => query('DELETE FROM push_results'));
}

export function limparEventos() {
  return semBanco(() => query('DELETE FROM push_events'));
}

export function limparComandos() {
  return semBanco(() => query('DELETE FROM push_commands WHERE delivered_at IS NULL'));
}

export function salvarMarcacao(marcacao) {
  return semBanco(() => query(
    `INSERT INTO push_marcacoes
       (nsr, user_id, cpf, pis, data, hora, serial, ip, origem, importado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (nsr, user_id, data, hora) DO NOTHING`,
    [
      marcacao.nsr || null,
      marcacao.user_id || null,
      marcacao.cpf || null,
      marcacao.pis || null,
      marcacao.data || null,
      marcacao.hora || null,
      marcacao.serial || null,
      marcacao.ip || null,
      marcacao.origem || 'push',
      Boolean(marcacao.importado),
    ]
  ));
}

export function marcarMarcacoesImportadas(ids = []) {
  if (!ids.length) return Promise.resolve(null);
  return semBanco(() => query(
    `UPDATE push_marcacoes
        SET importado = true
      WHERE nsr = ANY($1::bigint[])`,
    [ids]
  ));
}

export function marcarTodasImportadas() {
  return semBanco(() => query(
    `UPDATE push_marcacoes SET importado = true WHERE importado = false`
  ));
}

export function limparMarcacoes() {
  return semBanco(() => query('DELETE FROM push_marcacoes'));
}
