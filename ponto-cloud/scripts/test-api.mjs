/**
 * Smoke test da API PostgreSQL.
 *
 * Pré-requisitos:
 *   - banco migrado (npm run migrate)
 *   - admin criado (npm run seed:admin)
 *   - servidor rodando (npm start)
 *
 * Uso:
 *   BASE_URL=http://localhost:3100 ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:api
 */

const BASE = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('[test-api] Defina ADMIN_EMAIL e ADMIN_PASSWORD.');
  process.exit(1);
}

async function req(method, path, { body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return data;
}

function ok(nome) {
  console.log(`OK: ${nome}`);
}

const sufixo = Date.now().toString().slice(-6);
const cpf = String(Date.now()).slice(-11).padStart(11, '0');

let token = '';
let funcionario = null;
let horario = null;
let cargo = null;
let departamento = null;
let feriado = null;

try {
  const login = await req('POST', '/api/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  token = login.token;
  ok('login web');

  const me = await req('GET', '/api/auth/me', { token });
  if (!me.usuario?.id) throw new Error('me sem usuário');
  ok('auth/me');

  departamento = await req('POST', '/api/departamentos', {
    token,
    body: { nome: `Teste Dep ${sufixo}` },
  });
  ok('criar departamento');

  cargo = await req('POST', '/api/cargos', {
    token,
    body: { nome: `Teste Cargo ${sufixo}` },
  });
  ok('criar cargo');

  horario = await req('POST', '/api/horarios', {
    token,
    body: {
      nome: `Teste Horário ${sufixo}`,
      tipo: 'Fixa',
      config: {
        dias: {
          seg: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
          ter: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
          qua: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
          qui: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
          sex: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
        },
      },
    },
  });
  ok('criar horário');

  funcionario = await req('POST', '/api/funcionarios', {
    token,
    body: {
      nome: `Teste Func ${sufixo}`,
      cpf,
      senha: 'teste12345',
      departamento_id: departamento.id,
      cargo_id: cargo.id,
      horario_id: horario.id,
      data_inicio: '2026-01-01',
    },
  });
  ok('criar funcionário');

  await req('POST', '/api/marcacoes', {
    token,
    body: {
      funcionario_id: funcionario.id,
      cpf,
      data: '2026-10-30',
      hora: '08:00',
      origem: 'teste',
    },
  });
  ok('criar marcação');

  const marcacoes = await req('GET', `/api/marcacoes?funcionario_id=${funcionario.id}`, { token });
  if (!Array.isArray(marcacoes) || marcacoes.length < 1) throw new Error('marcações não retornadas');
  ok('listar marcações');

  await req('POST', '/api/correcoes', {
    token,
    body: {
      funcionario_id: funcionario.id,
      data: '2026-10-30',
      batidas_manuais: ['12:00'],
      justificativa: 'Teste',
    },
  });
  ok('upsert correção');

  await req('POST', '/api/dias-descartados', {
    token,
    body: { funcionario_id: funcionario.id, data: '2026-10-31', motivo: 'Teste' },
  });
  ok('upsert dia descartado');

  await req('POST', '/api/banco-horas/ajustes', {
    token,
    body: { funcionario_id: funcionario.id, data: '2026-10-30', minutos: 60, motivo: 'Teste' },
  });
  ok('criar ajuste de banco');

  feriado = await req('POST', '/api/feriados', {
    token,
    body: { data: `2099-12-${String((Number(sufixo) % 28) + 1).padStart(2, '0')}`, nome: `Teste ${sufixo}`, tipo: 'municipal' },
  });
  ok('criar feriado');

  const mobile = await req('POST', '/api/mobile/login', {
    body: { cpf, senha: 'teste12345' },
  });
  ok('login mobile');

  await req('POST', '/api/mobile/marcar', { token: mobile.token });
  ok('marcar mobile');

  const mobileMarcacoes = await req('GET', '/api/mobile/marcacoes', { token: mobile.token });
  if (!Array.isArray(mobileMarcacoes.marcacoes)) throw new Error('mobile sem marcações');
  ok('listar marcações mobile');
} catch (e) {
  console.error('\n[test-api] FALHOU:', e.message);
  process.exitCode = 1;
} finally {
  // Limpeza (best effort)
  try {
    if (funcionario && token) await req('DELETE', `/api/funcionarios/${funcionario.id}`, { token });
    if (horario && token) await req('DELETE', `/api/horarios/${horario.id}`, { token });
    if (cargo && token) await req('DELETE', `/api/cargos/${cargo.id}`, { token });
    if (departamento && token) await req('DELETE', `/api/departamentos/${departamento.id}`, { token });
    if (feriado && token) await req('DELETE', `/api/feriados/${feriado.id}`, { token });
  } catch (e) {
    console.warn('[test-api] limpeza parcial:', e.message);
  }

  try {
    if (token) {
      await req('POST', '/api/auth/logout', { token });
      ok('logout');
    }
  } catch {}
}
