import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import https from 'https';
import http from 'http';
import { randomUUID, randomBytes, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dbReady, dbHealth, query } from './db.js';
import { bearer, iguaisSeguro } from './auth.js';
import { loginPermitido, limparTentativas } from './rate-limit.js';
import { createAuthRouter } from './routes/auth.js';
import { createCadastrosRouter } from './routes/crud.js';
import { createMobileRouter } from './routes/mobile.js';
import { createUsuariosRouter } from './routes/usuarios.js';
import { createPeriodosRouter } from './routes/periodos.js';
import * as pushStore from './push-store.js';
import { criptografar, precisaCriptografar } from './secret-box.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DB_FILE = join(DATA_DIR, 'database.json');

const PUSH_DEVICES = {};
const PUSH_EVENTS = [];
const PUSH_RESULTS = [];
const PUSH_CMDS = [];

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (!existsSync(DB_FILE)) return { reps: {}, users: {}, markings: {} };
  try { return JSON.parse(readFileSync(DB_FILE, 'utf-8')); }
  catch { return { reps: {}, users: {}, markings: {} }; }
}

function saveDB(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

const PORT = process.env.PORT || 3100;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Configuração de segurança ────────────────────────────────────────────────
// Nenhuma credencial fica fixa no código. Em produção as variáveis são
// obrigatórias; em desenvolvimento geramos valores temporários e avisamos.
let API_TOKEN = process.env.API_TOKEN || '';
if (!API_TOKEN) {
  if (IS_PRODUCTION) {
    console.error('[FATAL] API_TOKEN não definido. Configure a variável de ambiente API_TOKEN.');
    process.exit(1);
  }
  API_TOKEN = randomBytes(24).toString('hex');
  console.warn('[AVISO] API_TOKEN não definido. Token temporário de desenvolvimento:', API_TOKEN);
}

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) {
  if (IS_PRODUCTION) {
    console.warn('[AVISO] ADMIN_PASSWORD não definido — /api/auth/login ficará desabilitado.');
  } else {
    ADMIN_PASSWORD = randomBytes(12).toString('hex');
    console.warn('[AVISO] ADMIN_PASSWORD não definido. Senha temporária de desenvolvimento:', ADMIN_PASSWORD);
  }
}

const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (!CORS_ORIGINS.length) {
  console.warn(
    IS_PRODUCTION
      ? '[AVISO] CORS_ORIGINS não definido em produção — apenas same-origin será aceito.'
      : '[AVISO] CORS_ORIGINS não definido — CORS aberto em desenvolvimento.'
  );
}

const app = express();
app.disable('x-powered-by');
// CSP desligada para não bloquear os estilos inline do frontend.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(
  CORS_ORIGINS.length
    ? { origin: CORS_ORIGINS }
    : (IS_PRODUCTION ? { origin: false } : {})
));
app.use(express.json({ limit: '50mb' }));

// Rate limit global por IP. Health e push dos REPs ficam de fora.
const LIMITE_GLOBAL = Number(process.env.RATE_LIMIT_GLOBAL) || 2000;
const JANELA_GLOBAL_MS = 15 * 60 * 1000;
const REQUISICOES = new Map();

app.use((req, res, next) => {
  if (
    req.path === '/api/health' ||
    req.path === '/push' || req.path === '/api/push/poll' ||
    req.path === '/result' || req.path === '/api/push/result' ||
    req.path === '/event' || req.path === '/api/push/event'
  ) return next();

  const chave = req.ip || '?';
  const agora = Date.now();
  if (REQUISICOES.size > 5000) {
    for (const [k, v] of REQUISICOES) {
      if (agora > v.resetAt) REQUISICOES.delete(k);
    }
  }
  const atual = REQUISICOES.get(chave);
  if (!atual || agora > atual.resetAt) {
    REQUISICOES.set(chave, { count: 1, resetAt: agora + JANELA_GLOBAL_MS });
    return next();
  }
  atual.count++;
  if (atual.count > LIMITE_GLOBAL) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde alguns minutos.' });
  }
  next();
});

app.use('/api/auth', createAuthRouter());

function auth(req, res, next) {
  const recebido = Buffer.from(bearer(req));
  const esperado = Buffer.from(API_TOKEN);
  const ok = recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  if (!ok) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// ── Rotas de autenticação e mobile são montadas após o middleware JSON ───────

app.use('/api/mobile', createMobileRouter());

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'ponto-cloud',
    version: '1.0.0',
    db: await dbHealth(),
    // Diagnóstico de deploy (injetado pelo Railway; nulo fora dele).
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || null,
    branch: process.env.RAILWAY_GIT_BRANCH || null,
    repo: process.env.RAILWAY_GIT_REPO_NAME || null,
    deployment: process.env.RAILWAY_DEPLOYMENT_ID || null,
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Login administrativo desabilitado. Configure ADMIN_PASSWORD.' });
  }
  const chave = `admin@${req.ip || '?'}`;
  if (!loginPermitido(chave)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  }
  if (iguaisSeguro(username || '', ADMIN_USER) && iguaisSeguro(password || '', ADMIN_PASSWORD)) {
    limparTentativas(chave);
    return res.json({ token: API_TOKEN, session: randomUUID() });
  }
  res.status(401).json({ error: 'Credenciais inválidas' });
});

app.get('/api/reps', auth, (req, res) => {
  const db = loadDB();
  const lista = Object.values(db.reps).map(r => ({
    id: r.id, nome: r.nome, modelo: r.modelo, num_serie: r.num_serie,
    localizacao: r.localizacao, ativo: r.ativo, ultima_sync: r.ultima_sync,
    status: r.status || 'desconhecido'
  }));
  res.json(lista);
});

app.post('/api/reps', auth, (req, res) => {
  const db = loadDB();
  const { nome, modelo, num_serie, localizacao } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const id = randomUUID();
  db.reps[id] = {
    id, nome, modelo: modelo || 'iDClass', num_serie: num_serie || '',
    localizacao: localizacao || '', ativo: true, criado_em: new Date().toISOString(),
    ultima_sync: null, status: 'pendente'
  };
  db.users[id] = [];
  db.markings[id] = [];
  saveDB(db);
  res.status(201).json(db.reps[id]);
});

app.get('/api/reps/:id', auth, (req, res) => {
  const db = loadDB();
  const rep = db.reps[req.params.id];
  if (!rep) return res.status(404).json({ error: 'REP não encontrado' });
  res.json(rep);
});

app.put('/api/reps/:id', auth, (req, res) => {
  const db = loadDB();
  const rep = db.reps[req.params.id];
  if (!rep) return res.status(404).json({ error: 'REP não encontrado' });

  const { nome, modelo, num_serie, localizacao, ativo } = req.body;
  if (nome !== undefined) rep.nome = nome;
  if (modelo !== undefined) rep.modelo = modelo;
  if (num_serie !== undefined) rep.num_serie = num_serie;
  if (localizacao !== undefined) rep.localizacao = localizacao;
  if (ativo !== undefined) rep.ativo = ativo;

  saveDB(db);
  res.json(rep);
});

app.delete('/api/reps/:id', auth, (req, res) => {
  const db = loadDB();
  if (!db.reps[req.params.id]) return res.status(404).json({ error: 'REP não encontrado' });
  delete db.reps[req.params.id];
  delete db.users[req.params.id];
  delete db.markings[req.params.id];
  saveDB(db);
  res.json({ ok: true });
});

app.post('/api/reps/:id/markings/sync', auth, (req, res) => {
  const db = loadDB();
  const rep = db.reps[req.params.id];
  if (!rep) return res.status(404).json({ error: 'REP não encontrado' });

  const { markings: novas } = req.body;
  if (!Array.isArray(novas)) return res.status(400).json({ error: 'Lista de marcações inválida' });

  const existentes = db.markings[req.params.id] || [];
  const existentesSet = new Set(existentes.map(m => `${m.nsr}:${m.pis || m.cpf}:${m.data}:${m.hora}`));
  const adicionadas = novas.filter(m => !existentesSet.has(`${m.nsr}:${m.pis || m.cpf}:${m.data}:${m.hora}`));

  db.markings[req.params.id] = [...existentes, ...adicionadas];
  rep.ultima_sync = new Date().toISOString();
  rep.status = 'online';
  saveDB(db);

  res.json({ imported: adicionadas.length, total: db.markings[req.params.id].length });
});

app.get('/api/reps/:id/markings', auth, (req, res) => {
  const db = loadDB();
  if (!db.reps[req.params.id]) return res.status(404).json({ error: 'REP não encontrado' });

  let markings = db.markings[req.params.id] || [];
  const { data_inicio, data_fim, offset, limit } = req.query;

  if (data_inicio) markings = markings.filter(m => m.data >= data_inicio);
  if (data_fim) markings = markings.filter(m => m.data <= data_fim);

  const total = markings.length;
  const off = parseInt(offset) || 0;
  const lim = parseInt(limit) || 100;
  markings = markings.slice(off, off + lim);

  res.json({ total, offset: off, limit: lim, markings });
});

app.post('/api/reps/:id/users/sync', auth, (req, res) => {
  const db = loadDB();
  const rep = db.reps[req.params.id];
  if (!rep) return res.status(404).json({ error: 'REP não encontrado' });

  const { users: novos } = req.body;
  if (!Array.isArray(novos)) return res.status(400).json({ error: 'Lista de usuários inválida' });

  const existentes = db.users[req.params.id] || [];
  const existentesPorCPF = new Map(existentes.map(u => [u.cpf, u]));

  for (const u of novos) {
    if (u.cpf) {
      if (existentesPorCPF.has(u.cpf)) {
        Object.assign(existentesPorCPF.get(u.cpf), u);
      } else {
        existentesPorCPF.set(u.cpf, { ...u, sincronizado_em: new Date().toISOString() });
      }
    }
  }

  db.users[req.params.id] = Array.from(existentesPorCPF.values());
  saveDB(db);
  res.json({ total: db.users[req.params.id].length });
});

app.get('/api/reps/:id/users', auth, (req, res) => {
  const db = loadDB();
  if (!db.reps[req.params.id]) return res.status(404).json({ error: 'REP não encontrado' });
  res.json(db.users[req.params.id] || []);
});

app.get('/api/reps/:id/status', auth, (req, res) => {
  const db = loadDB();
  const rep = db.reps[req.params.id];
  if (!rep) return res.status(404).json({ error: 'REP não encontrado' });

  const markings = db.markings[req.params.id] || [];
  const users = db.users[req.params.id] || [];

  res.json({
    id: rep.id,
    nome: rep.nome,
    status: rep.status || 'desconhecido',
    ultima_sync: rep.ultima_sync,
    total_marcacoes: markings.length,
    total_usuarios: users.length,
    online: rep.status === 'online'
  });
});

function proxyREPWithProtocol(protocol, ip, porta, comando, dados) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(dados || {});
    const port = porta || 443;
    const qsIdx = comando.indexOf('?');
    const path = qsIdx >= 0 ? `/${comando.slice(0, qsIdx)}.fcgi${comando.slice(qsIdx)}` : `/${comando}.fcgi`;
    const mod = protocol === 'http' ? http : https;
    const opts = {
      hostname: ip, port, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000, rejectUnauthorized: false
    };
    if (protocol === 'https') opts.insecureHTTPParser = true;
    const req = mod.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ raw: body }); }
      });
    });
    req.on('error', (e) => reject(e.message));
    req.on('timeout', () => { req.destroy(); reject('Timeout'); });
    req.write(data);
    req.end();
  });
}

function proxyREP(ip, porta, comando, dados) {
  return proxyREPWithProtocol('https', ip, porta, comando, dados).catch((err) => {
    if (err.includes('ECONNRESET') || err.includes('SSL') || err.includes('tls') || err.includes('protocol') || err.includes('Parse Error') || err.includes('socket'))
      return proxyREPWithProtocol('http', ip, porta, comando, dados);
    throw err;
  });
}

function proxyREPBinary(ip, porta, comando, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const port = porta || 80;
    const qsIdx = comando.indexOf('?');
    const path = qsIdx >= 0 ? `/${comando.slice(0, qsIdx)}.fcgi${comando.slice(qsIdx)}` : `/${comando}.fcgi`;
    const mod = port == 443 ? https : http;
    const opts = {
      hostname: ip, port, path, method: 'POST',
      headers: { 'Content-Type': contentType || 'application/octet-stream', 'Content-Length': buffer.length },
      timeout: 15000, rejectUnauthorized: false
    };
    const req = mod.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ raw: body }); }
      });
    });
    req.on('error', (e) => reject(e.message));
    req.on('timeout', () => { req.destroy(); reject('Timeout'); });
    req.write(buffer);
    req.end();
  });
}

app.post('/api/reps/proxy/command', auth, async (req, res) => {
  const { ip, porta, comando, dados, usuario, senha } = req.body;
  if (!ip || !comando) return res.status(400).json({ error: 'IP e comando são obrigatórios' });

  try {
    if (comando === 'login') {
      const result = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      return res.json(result);
    }
    if (!req.body.session && req.body.session !== '') {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login do REP', detalhe: login });
      req.body.session = login.session;
    }
    const result = await proxyREP(ip, porta, comando, dados);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha na comunicação com o REP', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/users/load', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, ids, mode } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    let body = { session: sess, limit: 100, offset: 0 };
    if (ids && ids.length > 0) {
      const idField = mode === '671' ? 'users_cpf' : 'users_pis';
      body = { session: sess, [idField]: ids };
    }
    const result = await proxyREP(ip, porta, 'load_users', body);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar usuários', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/users/update', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, users, mode } = req.body;
  if (!ip || !users) return res.status(400).json({ error: 'IP e users são obrigatórios' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    const sessEnc = encodeURIComponent(sess);
    const qs = mode === '671' ? `?session=${sessEnc}&mode=671` : `?session=${sessEnc}`;
    const idField = mode === '1510' ? 'pis' : 'cpf';
    const usersPayload = users.map(u => {
      const obj = {
        [idField]: parseInt(String(u[idField] || '0').replace(/\D/g, '') || '0'),
        name: u.name || ''
      };
      if (u.registration) obj.registration = parseInt(String(u.registration).replace(/\D/g, '') || '0');
      if (u.password) obj.password = String(u.password);
      if (u.code) obj.code = parseInt(String(u.code).replace(/\D/g, '') || '0');
      return obj;
    }).filter(u => u[idField] > 0);
    if (usersPayload.length === 0) {
      return res.status(400).json({ error: 'Nenhum funcionário com PIS/CPF válido' });
    }
    const result = await proxyREP(ip, porta, `update_users${qs}`, { users: usersPayload });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao atualizar usuários', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/users/add', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, users, mode } = req.body;
  if (!ip || !users) return res.status(400).json({ error: 'IP e users são obrigatórios' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    const sessEnc = encodeURIComponent(sess);
    const qs = mode === '671' ? `?session=${sessEnc}&mode=671` : `?session=${sessEnc}`;
    const idField = mode === '1510' ? 'pis' : 'cpf';
    const usersPayload = users.map(u => {
      const obj = {
        [idField]: parseInt(String(u[idField] || u.registration || '0').replace(/\D/g, '') || '0'),
        name: u.name || '',
        registration: parseInt(String(u.registration || '0').replace(/\D/g, '') || '0'),
        code: parseInt(String(u.code || u.registration || '0').replace(/\D/g, '') || '0'),
        password: String(u.password || '1234')
      };
      return obj;
    }).filter(u => u[idField] > 0);
    if (usersPayload.length === 0) {
      return res.status(400).json({ error: 'Nenhum funcionário com PIS/CPF válido' });
    }
    console.log(`[users/add] enviando ${usersPayload.length} usuários via add_users.fcgi, mode=${mode}`);
    const result = await proxyREP(ip, porta, `add_users${qs}`, { users: usersPayload });
    console.log(`[users/add] resultado:`, JSON.stringify(result).slice(0, 500));
    res.json(result);
  } catch (e) {
    console.error(`[users/add] erro:`, e);
    res.status(502).json({ error: 'Falha ao adicionar usuários', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/markings/load', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, data_inicio, data_fim } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    const params = { session: sess, limit: 5000, offset: 0 };
    if (data_inicio) params.date_start = data_inicio;
    if (data_fim) params.date_end = data_fim;
    const result = await proxyREP(ip, porta, 'get_markings', params);
    res.json({ ...result, _batch: extrairArray(result) });
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar marcações', detalhe: e.toString() });
  }
});

function extrairArray(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  const campo = obj.markings || obj.cuts || obj.marcacoes || obj.data || obj.records || obj.result || obj.rows || obj.items || obj.list;
  if (Array.isArray(campo)) return campo;
  return [];
}

app.post('/api/reps/proxy/markings/load_all', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    const allMarkings = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;
    while (hasMore) {
      const result = await proxyREP(ip, porta, 'get_markings', { session: sess, limit, offset });
      const batch = extrairArray(result);
      allMarkings.push(...batch);
      if (batch.length < limit) hasMore = false;
      offset += limit;
    }
    res.json({ markings: allMarkings, total: allMarkings.length, raw_sample: allMarkings.length > 0 ? allMarkings[0] : null });
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar todas as marcações', detalhe: e.toString() });
  }
});

app.get('/api/reps/proxy/afd/download', auth, async (req, res) => {
  const { ip, porta, usuario, senha, data_inicio, data_fim } = req.query;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
    if (!login.session) return res.status(401).json({ error: 'Falha no login' });

    const params = { session: login.session };
    if (data_inicio) params.data_inicio = data_inicio;
    if (data_fim) params.data_fim = data_fim;

    const result = await proxyREP(ip, porta, 'get_afd', params);
    if (result.afd || result.raw) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(result.afd || result.raw);
    } else {
      res.json(result);
    }
  } catch (e) {
    res.status(502).json({ error: 'Falha ao baixar AFD do REP', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/users/remove', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, users, mode } = req.body;
  if (!ip || !users) return res.status(400).json({ error: 'IP e users são obrigatórios' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    const sessEnc = encodeURIComponent(sess);
    const qs = mode === '671' ? `?session=${sessEnc}&mode=671` : `?session=${sessEnc}`;
    const result = await proxyREP(ip, porta, `remove_users${qs}`, { users });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao remover usuários', detalhe: e.toString() });
  }
});

// ── Proxy iDFace (REP P) ─────────────────────────────────────────────────────

async function ensureIFaceSession(ip, porta, usuario, senha, session) {
  if (session) return session;
  const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
  if (!login.session) throw new Error('Falha no login do equipamento iDFace');
  return login.session;
}

app.post('/api/reps/proxy/iface/login', auth, async (req, res) => {
  const { ip, porta, usuario, senha } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, null);
    res.json({ session: sess, base_url: `http://${ip}:${porta || 80}` });
  } catch (e) {
    res.status(502).json({ error: 'Falha na comunicação com o iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/info', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const [systemInfo, config] = await Promise.all([
      proxyREP(ip, porta, `get_system_info?session=${encodeURIComponent(sess)}`, {}).catch(() => ({})),
      proxyREP(ip, porta, `get_configuration?session=${encodeURIComponent(sess)}`, {}).catch(() => ({})),
    ]);

    // Detectar modo do equipamento (documentação Control iD)
    const attendanceMode = config?.general?.attendance_mode;
    const modoPonto = attendanceMode === '1' || attendanceMode === 1 || attendanceMode === true;
    const modoAcesso = attendanceMode === '0' || attendanceMode === 0 || attendanceMode === false;

    let modo = 'desconhecido';
    if (modoPonto) modo = 'ponto';
    else if (modoAcesso) modo = 'acesso';

    res.json({
      session: sess,
      serial: systemInfo.serial || systemInfo.system?.serial || '',
      system: systemInfo,
      config,
      modo,
      modo_ponto: modo === 'ponto',
      modo_acesso: modo === 'acesso',
    });
  } catch (e) {
    res.status(502).json({ error: 'Falha ao obter informações do iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/afd/download', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, data_inicio, data_fim } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);

    // Carrega configuração para detectar portaria
    const config = await proxyREP(ip, porta, `get_configuration?session=${encodeURIComponent(sess)}`, {}).catch(() => ({}));

    // Verifica modo (documentação Control iD: general.attendance_mode)
    const attendanceMode = config?.general?.attendance_mode;
    const modoPonto = attendanceMode === '1' || attendanceMode === 1 || attendanceMode === true;
    if (!modoPonto) {
      return res.status(400).json({
        error: 'Equipamento não está em modo ponto',
        modo: attendanceMode === '0' || attendanceMode === 0 ? 'acesso' : 'desconhecido',
        mensagem: 'Configure o equipamento para modo ponto (REP) antes de exportar AFD. No equipamento: MENU > CONFIGURAÇÕES > CONFIG. GERAIS > ATIVAR MODO PONTO'
      });
    }

    // Detecta portaria pela config do equipamento
    const portaria = config?.rep?.portaria || config?.time_attendance?.portaria || '671';

    // Carrega access_logs (marcações)
    const allMarkings = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;
    while (hasMore) {
      const result = await proxyREP(ip, porta, `load_objects?session=${encodeURIComponent(sess)}`, {
        object: 'access_logs', limit, offset,
        ...(data_inicio ? { date_start: data_inicio } : {}),
        ...(data_fim ? { date_end: data_fim } : {}),
      });
      const batch = extrairArray(result);
      allMarkings.push(...batch);
      if (batch.length < limit) hasMore = false;
      offset += limit;
    }

    // Carrega usuários para mapear ID -> CPF/PIS
    const usersResult = await proxyREP(ip, porta, `load_objects?session=${encodeURIComponent(sess)}`, { object: 'users' }).catch(() => ({}));
    const usersArray = extrairArray(usersResult);
    const userMap = {};
    for (const u of usersArray) {
      userMap[u.id] = u;
    }

    // Gera AFD
    let nsr = 1;
    const lines = [];

    // Header (tipo 1)
    const now = new Date();
    const dataStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const horaStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const numSerie = (config?.serial || '').padEnd(17, ' ').slice(0, 17);
    if (portaria === '671') {
      lines.push(`0000000011000000000${dataStr}${horaStr}${numSerie}${' '.repeat(228)}`);
    } else {
      lines.push(`0000000011${dataStr.slice(0, 2)}${dataStr.slice(2, 4)}${dataStr.slice(4, 8)}${horaStr.slice(0, 4)}${numSerie}${' '.repeat(182)}`);
    }
    nsr++;

    // Marcações (tipo 3)
    for (const m of allMarkings) {
      const userId = m.user_id || m.userId || m.id_user || '';
      const user = userMap[userId] || {};
      const pis = String(user.pis || '').replace(/\D/g, '').padStart(11, '0');
      const cpf = String(user.cpf || '').replace(/\D/g, '').padStart(11, '0');
      const dataHora = m.data_hora || m.datetime || m.date_time || m.time || '';
      const [dStr, tStr] = dataHora.replace('T', ' ').split(' ');
      const d = dStr ? dStr.replace(/-/g, '') : dataStr;
      const t = tStr ? tStr.replace(/:/g, '') : horaStr;
      const pisNum = pis || '00000000000';
      const cpfNum = cpf || '00000000000';

      if (portaria === '671') {
        const pisOuCpf = cpfNum !== '00000000000' ? cpfNum : pisNum.padStart(11, '0');
        lines.push(`${String(nsr).padStart(9, '0')}3${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}${' '.repeat(5)}${pisOuCpf}${'0'.repeat(228)}`);
      } else {
        lines.push(`${String(nsr).padStart(9, '0')}3${d.slice(6, 8)}${d.slice(4, 6)}${d.slice(0, 4)}${t.slice(0, 4)}${pisNum.padStart(12, '0')}${' '.repeat(48)}`);
      }
      nsr++;
    }

    // Trailer (tipo 9)
    const totalMarc = String(allMarkings.length).padStart(9, '0');
    if (portaria === '671') {
      lines.push(`${totalMarc}9${' '.repeat(250)}`);
    } else {
      lines.push(`${totalMarc}9${' '.repeat(42)}`);
    }

    const afdText = lines.join('\r\n');
    res.json({ afd: afdText, portaria, total: allMarkings.length, linhas: lines.length });
  } catch (e) {
    res.status(502).json({ error: 'Falha ao gerar AFD do iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/logs', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, limit, data_inicio, data_fim } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);

    const tables = ['access_logs', 'logs', 'access', 'identifications', 'accesses', 'records', 'events_log', 'markings'];
    let result = null;

    for (const table of tables) {
      try {
        const params = {
          object: table,
          ...(limit ? { limit: parseInt(limit) } : { limit: 100 }),
        };
        if (data_inicio) params.date_start = data_inicio;
        if (data_fim) params.date_end = data_fim;
        const r = await proxyREP(ip, porta, `load_objects?session=${encodeURIComponent(sess)}`, params);
        const values = Object.values(r).find(v => Array.isArray(v));
        if (values) {
          result = r;
          break;
        }
      } catch {}
    }

    res.json(result || { error: 'Nenhuma tabela de marcações encontrada no iDFace' });
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar marcações do iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/markings/load', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, limit, offset, date_start, date_end } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const params = {
      object: 'access_logs',
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    };
    if (date_start) params.date_start = date_start;
    if (date_end) params.date_end = date_end;
    const result = await proxyREP(ip, porta, `load_objects?session=${encodeURIComponent(sess)}`, params);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar marcações', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/markings/load_all', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    let sess = session;
    if (!sess) {
      const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
      if (!login.session) return res.status(401).json({ error: 'Falha no login' });
      sess = login.session;
    }
    const allMarkings = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;
    while (hasMore) {
      const result = await proxyREP(ip, porta, `load_objects?session=${encodeURIComponent(sess)}`, {
        object: 'access_logs', limit, offset,
      });
      const batch = extrairArray(result);
      allMarkings.push(...batch);
      if (batch.length < limit) hasMore = false;
      offset += limit;
    }
    res.json({ markings: allMarkings, total: allMarkings.length, raw_sample: allMarkings.length > 0 ? allMarkings[0] : null });
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar todas as marcações', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/users/load', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const result = await proxyREP(ip, porta, `load_objects?session=${encodeURIComponent(sess)}`, { object: 'users' });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao carregar usuários do iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/users/create', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, values } = req.body;
  if (!ip || !values) return res.status(400).json({ error: 'IP e values são obrigatórios' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const result = await proxyREP(ip, porta, `create_objects?session=${encodeURIComponent(sess)}`, { object: 'users', values });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao criar usuário no iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/users/modify', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, id, name } = req.body;
  if (!ip || !id) return res.status(400).json({ error: 'IP e id são obrigatórios' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const result = await proxyREP(ip, porta, `modify_objects?session=${encodeURIComponent(sess)}`, {
      object: 'users',
      values: { name, registration: String(id) },
      where: { users: { id: { '=': parseInt(id) } } },
    });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao modificar usuário no iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/users/destroy', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, id } = req.body;
  if (!ip || !id) return res.status(400).json({ error: 'IP e id são obrigatórios' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const result = await proxyREP(ip, porta, `destroy_objects?session=${encodeURIComponent(sess)}`, {
      object: 'users',
      where: { users: { id: parseInt(id) } },
    });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao excluir usuário do iDFace', detalhe: e.toString() });
  }
});

app.post('/api/reps/proxy/iface/face/upload', auth, async (req, res) => {
  const { ip, porta, usuario, senha, session, user_id, foto } = req.body;
  if (!ip || !user_id) return res.status(400).json({ error: 'IP e user_id são obrigatórios' });
  if (!foto) return res.status(400).json({ error: 'foto é obrigatória' });
  try {
    const sess = await ensureIFaceSession(ip, porta, usuario, senha, session);
    const matches = foto.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Formato de foto inválido. Esperado data URL base64.' });
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const result = await proxyREPBinary(ip, porta || '80',
      `user_set_image?session=${encodeURIComponent(sess)}&user_id=${parseInt(user_id)}&timestamp=${Math.floor(Date.now() / 1000)}`,
      buffer, contentType
    );
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Falha ao enviar foto para o iDFace', detalhe: e.toString() });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH PROTOCOL (coleta de marcações em tempo real via iDFace)
// ═══════════════════════════════════════════════════════════════════════════════════

const PUSH_MARCACOES_FILE = join(DATA_DIR, 'push_marcacoes.json');
let PUSH_MARCACOES = [];
try {
  if (existsSync(PUSH_MARCACOES_FILE)) {
    PUSH_MARCACOES = JSON.parse(readFileSync(PUSH_MARCACOES_FILE, 'utf8'));
  }
} catch {}

function salvarPushMarcacoes() {
  // Com PostgreSQL configurado, o banco é a fonte de verdade.
  if (dbReady) return;
  try {
    writeFileSync(PUSH_MARCACOES_FILE, JSON.stringify(PUSH_MARCACOES.slice(-5000), null, 2));
  } catch {}
}

function extrairMarcacaoDeEvento(data, serial, ip) {
  const dataHora = data.data_hora || data.datetime || data.date_time || data.time || data.created_at || '';
  if (!dataHora) return null;
  const [dStr, tStr] = dataHora.replace('T', ' ').split(' ');
  if (!dStr) return null;
  const userId = data.user_id ?? data.userId ?? data.id_user ?? '';
  const pis = String(data.pis || '').replace(/\D/g, '');
  const cpf = String(data.cpf || '').replace(/\D/g, '');
  return {
    nsr: data.id ?? data.nsr ?? PUSH_MARCACOES.length + 1,
    user_id: String(userId),
    pis,
    cpf,
    data: dStr,
    hora: (tStr || '00:00').slice(0, 8),
    event: data.event ?? data.type ?? '',
    log_type: data.log_type ?? '',
    serial: serial || '',
    ip: ip || '',
    received_at: nowStr(),
    importado: false,
  };
}

function nowISO() {
  return new Date().toISOString();
}

function nowStr() {
  return new Date().toLocaleString('pt-BR');
}

function resolveDeviceId(req) {
  const serial = req.headers['x-device-serial'] || req.query.serial || '';
  const ip = req.ip || req.connection?.remoteAddress || '0.0.0.0';
  if (serial) return { key: `${serial}@${ip}`, serial, ip };
  const devId = req.headers['x-device-id'] || req.query.device_id || ip;
  return { key: devId, serial: null, ip };
}

function updatePushDevice(key, serial, ip, extra) {
  const existing = PUSH_DEVICES[key] || {};
  PUSH_DEVICES[key] = {
    last_seen: nowStr(),
    ip,
    serial: serial || existing.serial || 'desconhecido',
    poll_count: (existing.poll_count || 0) + 1,
    ...(extra || {}),
  };
  pushStore.salvarDevice({
    device_key: key,
    serial: PUSH_DEVICES[key].serial,
    ip,
    poll_count: PUSH_DEVICES[key].poll_count,
    extra,
  });
}

function isPushOnline(info) {
  if (!info?.last_seen) return false;
  try {
    const [d, t] = info.last_seen.split(' ');
    const [dd, mm, yyyy] = d.split('/');
    const [hh, mi, ss] = t.split(':');
    const last = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(mi), parseInt(ss));
    return (Date.now() - last.getTime()) < 90000;
  } catch { return false; }
}

function extractPushEvents(body, deviceKey, serial, ip) {
  let count = 0;
  const novosEventos = [];
  const novasMarcacoes = [];
  const sources = [
    ...(body.transactions || []),
    ...(body.events || []),
    ...(body.logs || []),
    ...(body.access_logs || []),
    ...(body.markings || []),
  ];
  for (const item of sources) {
    if (item.user_id || item.userId || item.id_user || item.event || item.type || item.pis || item.cpf) {
      const evento = {
        received_at: nowStr(),
        device_id: deviceKey,
        serial: serial || 'desconhecido',
        ip,
        data: item,
      };
      PUSH_EVENTS.unshift(evento);
      novosEventos.push(evento);
      count++;
    }
    const marc = extrairMarcacaoDeEvento(item, serial, ip);
    if (marc && marc.data && marc.user_id) {
      const existe = PUSH_MARCACOES.some(m => m.nsr == marc.nsr && m.user_id == marc.user_id && m.data == marc.data && m.hora == marc.hora);
      if (!existe) {
        PUSH_MARCACOES.push(marc);
        novasMarcacoes.push(marc);
        salvarPushMarcacoes();
      }
    }
  }
  if (PUSH_EVENTS.length > 2000) PUSH_EVENTS.length = 2000;
  if (novosEventos.length) pushStore.salvarEventos(novosEventos);
  for (const marc of novasMarcacoes) pushStore.salvarMarcacao(marc);
  return count;
}

app.all(['/push', '/api/push/poll'], (req, res) => {
  const { key, serial, ip } = resolveDeviceId(req);
  updatePushDevice(key, serial, ip);

  if (req.method === 'POST') {
    const body = req.body || {};
    const count = extractPushEvents(body, key, serial, ip);
    if (count > 0) {
      console.log(`[PUSH] ${count} marcações recebidas de ${serial || ip}`);
    }
  }

  if (PUSH_CMDS.length > 0) {
    const cmd = PUSH_CMDS.shift();
    const cmdId = cmd?.transactions?.[0]?.id;
    if (cmdId) pushStore.marcarComandoEntregue(cmdId);
    return res.json(cmd);
  }

  res.json({ transactions: [] });
});

app.post(['/result', '/api/push/result'], (req, res) => {
  const data = req.body || {};
  const { key, serial, ip } = resolveDeviceId(req);

  const resultado = {
    received_at: nowStr(),
    device_id: key,
    serial: serial || PUSH_DEVICES[key]?.serial || 'desconhecido',
    ip,
    data,
  };
  PUSH_RESULTS.unshift(resultado);
  if (PUSH_RESULTS.length > 500) PUSH_RESULTS.length = 500;
  if (PUSH_DEVICES[key]) PUSH_DEVICES[key].last_seen = nowStr();
  pushStore.salvarResultado(resultado);
  res.json({ success: true });
});

app.post(['/event', '/api/push/event'], (req, res) => {
  const data = req.body || {};
  const { key, serial, ip } = resolveDeviceId(req);

  const evento = {
    received_at: nowStr(),
    device_id: key,
    serial: serial || PUSH_DEVICES[key]?.serial || 'desconhecido',
    ip,
    data,
  };
  PUSH_EVENTS.unshift(evento);
  if (PUSH_EVENTS.length > 2000) PUSH_EVENTS.length = 2000;
  pushStore.salvarEventos([evento]);
  if (PUSH_DEVICES[key]) {
    PUSH_DEVICES[key].last_seen = nowStr();
  } else {
    updatePushDevice(key, serial, ip);
  }

  const marc = extrairMarcacaoDeEvento(data, serial, ip);
  if (marc && marc.data && marc.user_id) {
    const existe = PUSH_MARCACOES.some(m => m.nsr == marc.nsr && m.user_id == marc.user_id && m.data == marc.data && m.hora == marc.hora);
    if (!existe) {
      PUSH_MARCACOES.push(marc);
      salvarPushMarcacoes();
      pushStore.salvarMarcacao(marc);
    }
  }

  res.json({ success: true });
});

app.get('/api/push/devices', auth, (req, res) => {
  const maxAgeH = parseInt(req.query.max_age_hours) || 24;
  const cutoff = Date.now() - maxAgeH * 3600 * 1000;

  const sorted = Object.entries(PUSH_DEVICES)
    .sort((a, b) => (b[1].last_seen || '').localeCompare(a[1].last_seen || ''));

  const seenSerials = new Set();
  const seenIPs = new Set();
  const result = {};

  for (const [key, info] of sorted) {
    try {
      const [d, t] = info.last_seen.split(' ');
      const [dd, mm, yyyy] = d.split('/');
      const [hh, mi, ss] = t.split(':');
      const last = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(mi), parseInt(ss));
      if (last.getTime() < cutoff) continue;
    } catch { continue; }

    const serial = info.serial || '';
    const ip = info.ip || '';

    if (serial && serial !== 'desconhecido') {
      if (seenSerials.has(serial)) continue;
      seenSerials.add(serial);
    } else if (ip) {
      if (seenIPs.has(ip)) continue;
      seenIPs.add(ip);
    }

    result[key] = { ...info, online: isPushOnline(info) };
  }

  res.json({ devices: result });
});

app.get('/api/push/events', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ events: PUSH_EVENTS.slice(0, limit) });
});

app.get('/api/push/results', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ results: PUSH_RESULTS.slice(0, limit) });
});

app.post('/api/push/cmd', auth, (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'Body inválido' });

  const cmdId = randomUUID().slice(0, 8);
  const cmd = {
    transactions: [{
      id: cmdId,
      method: data.method || 'POST',
      url: data.url || '/',
      body: data.body || {},
    }],
  };
  PUSH_CMDS.push(cmd);
  pushStore.salvarComando({ cmd_id: cmdId, device_key: null, payload: cmd });
  res.json({ success: true, cmd_id: cmdId, queued: PUSH_CMDS.length });
});

app.post('/api/push/clear', auth, (req, res) => {
  PUSH_RESULTS.length = 0;
  PUSH_CMDS.length = 0;
  pushStore.limparResultados();
  pushStore.limparComandos();
  res.json({ success: true });
});

app.post('/api/push/clear_events', auth, (req, res) => {
  PUSH_EVENTS.length = 0;
  pushStore.limparEventos();
  res.json({ success: true });
});

app.get('/api/push/marcacoes', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  const apenasNaoImportados = req.query.nao_importados !== 'false';
  let lista = PUSH_MARCACOES;
  if (apenasNaoImportados) lista = lista.filter(m => !m.importado);
  res.json({ marcacoes: lista.slice(-limit).reverse() });
});

app.post('/api/push/marcacoes/importar', auth, (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids é obrigatório' });
  let importados = 0;
  for (const m of PUSH_MARCACOES) {
    if (ids.includes(m.nsr) && !m.importado) {
      m.importado = true;
      importados++;
    }
  }
  salvarPushMarcacoes();
  pushStore.marcarMarcacoesImportadas(ids);
  res.json({ success: true, importados });
});

app.post('/api/push/marcacoes/importar/todos', auth, (req, res) => {
  let importados = 0;
  for (const m of PUSH_MARCACOES) {
    if (!m.importado) {
      m.importado = true;
      importados++;
    }
  }
  salvarPushMarcacoes();
  pushStore.marcarTodasImportadas();
  res.json({ success: true, importados });
});

app.delete('/api/push/marcacoes', auth, (req, res) => {
  PUSH_MARCACOES = [];
  salvarPushMarcacoes();
  pushStore.limparMarcacoes();
  res.json({ success: true });
});

app.get('/api/reps/proxy/info', auth, async (req, res) => {
  const { ip, porta, usuario, senha } = req.query;
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });

  try {
    const login = await proxyREP(ip, porta, 'login', { login: usuario || 'admin', password: senha || 'admin' });
    if (!login.session) return res.status(401).json({ error: 'Falha no login', detalhe: login });

    const [about, info, sysInfo] = await Promise.all([
      proxyREP(ip, porta, 'get_about', { session: login.session }),
      proxyREP(ip, porta, 'get_info', { session: login.session }),
      proxyREP(ip, porta, 'get_system_information', { session: login.session }).catch(() => ({}))
    ]);

    res.json({
      conectado: true,
      sessao: login.session,
      about: {
        mac: about.mac,
        nSerie: about.nSerie,
        versaoFW: about.versionFW,
        versaoMRP: about.versionMRP,
        isFacial: about.isFacial
      },
      info: {
        usuarios: info.user_count,
        administradores: info.administrator_count,
        templates: info.template_count,
        tickets: info.cuts,
        uptime: info.uptime
      },
      sistema: {
        memoria: sysInfo.memory,
        ultimaNSR: sysInfo.last_nsr
      }
    });
  } catch (e) {
    res.status(502).json({ error: 'Falha na comunicação com o REP', detalhe: e.toString() });
  }
});

// Usuários da conta (Fase 6) — somente admin.
app.use('/api/usuarios', createUsuariosRouter());

// Fechamento de período (Fase 7).
app.use('/api/periodos', createPeriodosRouter());

// CRUD autenticado (montado depois das rotas específicas de /api/reps e /api/push)
app.use('/api', createCadastrosRouter());

// Frontend buildado (Railway/Docker em serviço único)
const PUBLIC_DIR = join(__dirname, 'public');
if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(PUBLIC_DIR, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Recarrega o estado do push do PostgreSQL antes de aceitar requisições.
async function carregarPushState() {
  const estado = await pushStore.carregarEstado();
  if (!estado) return;

  const dataBR = (valor) => {
    if (!valor) return nowStr();
    const d = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(d.getTime()) ? nowStr() : d.toLocaleString('pt-BR');
  };

  for (const d of estado.devices) {
    PUSH_DEVICES[d.device_key] = {
      last_seen: dataBR(d.last_seen),
      ip: d.ip,
      serial: d.serial,
      poll_count: d.poll_count,
      ...(d.extra || {}),
    };
  }

  PUSH_EVENTS.push(...estado.events.map((e) => ({
    received_at: dataBR(e.received_at),
    device_id: e.device_key,
    serial: e.serial,
    ip: e.ip,
    data: e.data,
  })));

  PUSH_RESULTS.push(...estado.results.map((r) => ({
    received_at: dataBR(r.received_at),
    device_id: r.device_key,
    serial: r.serial,
    ip: r.ip,
    data: r.data,
  })));

  PUSH_CMDS.push(...estado.commands.map((c) => c.payload));

  PUSH_MARCACOES = estado.marcacoes.map((m) => ({
    nsr: m.nsr === null || m.nsr === undefined ? null : Number(m.nsr),
    user_id: m.user_id,
    cpf: m.cpf,
    pis: m.pis,
    data: m.data,
    hora: m.hora,
    serial: m.serial,
    ip: m.ip,
    origem: m.origem,
    event: '',
    log_type: '',
    received_at: dataBR(m.received_at),
    importado: m.importado,
  }));

  console.log(
    `[PUSH] estado carregado: ${Object.keys(PUSH_DEVICES).length} devices, ` +
    `${PUSH_EVENTS.length} events, ${PUSH_MARCACOES.length} marcações, ${PUSH_CMDS.length} comandos`
  );
}

// Criptografa credenciais de REP que ainda estejam em texto puro.
async function migrarCredenciaisReps() {
  if (!dbReady) return;
  try {
    const { rows } = await query('SELECT id, senha, api_key FROM equipamentos');
    let atualizados = 0;
    for (const r of rows) {
      const precisa = precisaCriptografar(r.senha) || precisaCriptografar(r.api_key);
      if (!precisa) continue;
      await query(
        'UPDATE equipamentos SET senha = $1, api_key = $2 WHERE id = $3',
        [criptografar(r.senha), criptografar(r.api_key), r.id]
      );
      atualizados++;
    }
    if (atualizados > 0) {
      console.log(`[REP] ${atualizados} credencial(is) criptografada(s).`);
    }
  } catch (e) {
    console.warn('[REP] falha ao migrar credenciais:', e.message);
  }
}

await carregarPushState();
await migrarCredenciaisReps();

app.listen(PORT, async () => {
  console.log(`PontoCloud rodando em http://localhost:${PORT}`);
  console.log(`API pronta em http://localhost:${PORT}/api`);
  console.log(`[DB] ${dbReady ? 'configurado' : 'não configurado'} — health: ${await dbHealth()}`);
});
