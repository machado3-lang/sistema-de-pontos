/**
 * Transporte das requisições aos REPs.
 *
 * - `IZCLOUD_URL` configurado: envia para o IZCLOUD, que alcança o REP na rede
 *   local (relay HTTP). É o modo usado no Railway.
 * - Sem `IZCLOUD_URL`: conecta direto no IP do REP (útil em desenvolvimento /
 *   backend on-premises).
 *
 * Contrato do IZCLOUD: ver `IZCLOUD_INTEGRACAO.md`.
 */

import http from 'http';
import https from 'https';

const IZCLOUD_URL = (process.env.IZCLOUD_URL || '').replace(/\/+$/, '');
const IZCLOUD_TOKEN = process.env.IZCLOUD_TOKEN || '';
const TIMEOUT_MS = Number(process.env.REP_TIMEOUT_MS) || 15000;

export function relayConfigurado() {
  return Boolean(IZCLOUD_URL);
}

export function provedorAtual() {
  return IZCLOUD_URL ? 'izcloud' : 'direct';
}

function direto(payload) {
  return new Promise((resolve, reject) => {
    const port = Number(payload.port) || (payload.protocol === 'http' ? 80 : 443);
    const mod = payload.protocol === 'http' ? http : https;
    const corpo = payload.body_base64
      ? Buffer.from(payload.body_base64, 'base64')
      : Buffer.from(payload.body || '', 'utf8');

    const opts = {
      hostname: payload.host,
      port,
      path: payload.path,
      method: payload.method || 'POST',
      headers: {
        ...(payload.headers || {}),
        'Content-Length': corpo.length,
      },
      timeout: payload.timeout || TIMEOUT_MS,
      rejectUnauthorized: false,
    };
    if (payload.protocol !== 'http') opts.insecureHTTPParser = true;

    const req = mod.request(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', (e) => reject(e.message));
    req.on('timeout', () => { req.destroy(); reject('Timeout'); });
    req.write(corpo);
    req.end();
  });
}

async function viaIZCloud(payload) {
  const res = await fetch(`${IZCLOUD_URL}/relay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(IZCLOUD_TOKEN ? { Authorization: `Bearer ${IZCLOUD_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      host: payload.host,
      port: Number(payload.port) || (payload.protocol === 'http' ? 80 : 443),
      protocol: payload.protocol || 'https',
      path: payload.path,
      method: payload.method || 'POST',
      headers: payload.headers || {},
      body: payload.body,
      body_base64: payload.body_base64,
      timeout_ms: payload.timeout || TIMEOUT_MS,
    }),
    signal: AbortSignal.timeout((payload.timeout || TIMEOUT_MS) + 5000),
  });

  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`IZCLOUD ${res.status}: ${texto.slice(0, 300)}`);
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    return { status: 200, headers: {}, body: texto };
  }

  return {
    status: dados.status || 200,
    headers: dados.headers || {},
    body: dados.body_base64
      ? Buffer.from(dados.body_base64, 'base64').toString('utf8')
      : (dados.body || ''),
  };
}

/**
 * Executa uma requisição ao REP pelo transporte configurado.
 * Devolve `{ status, headers, body }`.
 */
export async function relayRequest(payload) {
  if (relayConfigurado()) return viaIZCloud(payload);
  return direto(payload);
}
