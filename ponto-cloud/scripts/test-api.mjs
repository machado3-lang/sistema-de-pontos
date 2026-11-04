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

const PORT = process.env.PORT || 3100;
const BASE = (process.env.BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const API_TOKEN = process.env.API_TOKEN;

if (!EMAIL || !PASSWORD) {
  console.error('[test-api] Defina ADMIN_EMAIL e ADMIN_PASSWORD.');
  process.exit(1);
}

console.log(`[test-api] BASE_URL=${BASE}`);

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
let parametro = null;
let equipamento = null;
let empresaTeste = null;

try {
  const login = await req('POST', '/api/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  token = login.token;
  ok('login web');

  const me = await req('GET', '/api/auth/me', { token });
  if (!me.usuario?.id) throw new Error('me sem usuário');
  ok('auth/me');

  const emailConsulta = `consulta-${sufixo}@teste.local`;
  const usuarioConsulta = await req('POST', '/api/usuarios', {
    token,
    body: {
      nome: 'Consulta Teste',
      email: emailConsulta,
      senha: 'consulta12345',
      role: 'consulta',
    },
  });
  ok('criar usuário consulta');

  const usuariosList = await req('GET', '/api/usuarios', { token });
  if (!usuariosList.some((u) => u.id === usuarioConsulta.id)) {
    throw new Error('usuário não listado');
  }
  ok('listar usuários');

  const loginConsulta = await req('POST', '/api/auth/login', {
    body: { email: emailConsulta, senha: 'consulta12345' },
  });
  ok('login consulta');

  const depListConsulta = await req('GET', '/api/departamentos', { token: loginConsulta.token });
  if (!Array.isArray(depListConsulta)) throw new Error('consulta não conseguiu ler');
  ok('consulta: leitura permitida');

  let escritaBloqueada = false;
  try {
    await req('POST', '/api/departamentos', {
      token: loginConsulta.token,
      body: { nome: `Bloqueado ${sufixo}` },
    });
  } catch (e) {
    escritaBloqueada = e.message.includes('403');
  }
  if (!escritaBloqueada) throw new Error('consulta conseguiu escrever');
  ok('consulta: escrita bloqueada');

  await req('POST', `/api/usuarios/${usuarioConsulta.id}/reset-password`, {
    token,
    body: { senha: 'novaSenha12345' },
  });
  ok('reset senha');

  await req('POST', `/api/usuarios/${usuarioConsulta.id}/revoke-sessions`, { token });
  ok('revogar sessões');

  await req('DELETE', `/api/usuarios/${usuarioConsulta.id}`, { token });
  ok('desativar usuário');

  const docEmpresa = String(Date.now()).padStart(14, '0').slice(-14);
  empresaTeste = await req('POST', '/api/empresas', {
    token,
    body: {
      razao_social: `Teste Empresa ${sufixo}`,
      tipo_doc: 'CNPJ',
      cpf_cnpj: docEmpresa,
      cidade: 'Teste',
      estado: 'SP',
    },
  });
  ok('criar empresa');

  const empresasList = await req('GET', '/api/empresas', { token });
  if (!empresasList.some((e) => e.id === empresaTeste.id)) {
    throw new Error('empresa criada não aparece na listagem');
  }
  ok('listar empresas');

  await req('PUT', `/api/empresas/${empresaTeste.id}`, {
    token,
    body: { cidade: 'Teste atualizada' },
  });
  ok('atualizar empresa');

  await req('DELETE', `/api/empresas/${empresaTeste.id}`, { token });
  ok('excluir empresa');
  empresaTeste = null;

  departamento = await req('POST', '/api/departamentos', {
    token,
    body: { nome: `Teste Dep ${sufixo}` },
  });
  ok('criar departamento');

  const departamentosList = await req('GET', '/api/departamentos', { token });
  if (!departamentosList.some((d) => d.id === departamento.id)) {
    throw new Error('departamento sem id na listagem');
  }
  ok('listar departamentos');

  cargo = await req('POST', '/api/cargos', {
    token,
    body: { nome: `Teste Cargo ${sufixo}` },
  });
  ok('criar cargo');

  const cargosList = await req('GET', '/api/cargos', { token });
  if (!cargosList.some((c) => c.id === cargo.id)) {
    throw new Error('cargo sem id na listagem');
  }
  ok('listar cargos');

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

  const horariosList = await req('GET', '/api/horarios', { token });
  if (!horariosList.some((h) => h.id === horario.id)) {
    throw new Error('horário sem id na listagem');
  }
  ok('listar horários');

  parametro = await req('POST', '/api/parametros', {
    token,
    body: {
      nome: `Teste Param ${sufixo}`,
      config: { noturno: { percentual_adicional: 20 }, dsr: { percentual_sobre_he: 100 } },
    },
  });
  ok('criar parâmetro');

  const parametrosList = await req('GET', '/api/parametros', { token });
  if (!Array.isArray(parametrosList) || !parametrosList.some((p) => p.id === parametro.id)) {
    throw new Error('parâmetro não listado');
  }
  ok('listar parâmetros');

  equipamento = await req('POST', '/api/equipamentos', {
    token,
    body: {
      nome: `Teste REP ${sufixo}`,
      modelo: 'iDClass',
      tipo_conexao: 'ip_direto',
      ip: '192.168.0.10',
      porta: '443',
      usuario: 'admin',
      senha: 'admin123',
      api_key: 'chave-teste',
      portaria: '671',
    },
  });
  ok('criar equipamento');

  await req('PUT', `/api/equipamentos/${equipamento.id}`, {
    token,
    body: { observacoes: 'Teste', portaria: '1510' },
  });
  ok('atualizar equipamento');

  const equipamentosList = await req('GET', '/api/equipamentos', { token });
  const equipAtualizado = equipamentosList.find((e) => e.id === equipamento.id);
  if (!equipAtualizado || equipAtualizado.portaria !== '1510') {
    throw new Error('equipamento não atualizado');
  }
  if (equipAtualizado.senha !== 'admin123' || equipAtualizado.api_key !== 'chave-teste') {
    throw new Error('credencial do REP não descriptografou');
  }
  ok('listar equipamentos');

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

  await req('PUT', `/api/funcionarios/${funcionario.id}/hist-horarios`, {
    token,
    body: { historico: [{ horario_id: horario.id, data_inicio: '2026-01-01' }] },
  });
  const histHorarios = await req('GET', `/api/funcionarios/${funcionario.id}/hist-horarios`, { token });
  if (!Array.isArray(histHorarios) || histHorarios.length !== 1) {
    throw new Error('histórico de horários não retornado');
  }
  ok('histórico de horários');

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

  const correcoesList = await req('GET', `/api/correcoes?funcionario_id=${funcionario.id}`, { token });
  if (!Array.isArray(correcoesList) || correcoesList.length !== 1) {
    throw new Error('correção não listada');
  }
  ok('listar correções');

  await req('POST', '/api/dias-descartados', {
    token,
    body: { funcionario_id: funcionario.id, data: '2026-10-31', motivo: 'Teste' },
  });
  ok('upsert dia descartado');

  const diasList = await req('GET', `/api/dias-descartados?funcionario_id=${funcionario.id}`, { token });
  if (!Array.isArray(diasList) || diasList.length !== 1) {
    throw new Error('dia descartado não listado');
  }
  ok('listar dias descartados');

  await req('POST', '/api/marcacoes-descartadas', {
    token,
    body: { funcionario_id: funcionario.id, data: '2026-10-30', hora: '12:00' },
  });
  ok('criar marcação descartada');

  const descartadasList = await req('GET', `/api/marcacoes-descartadas?funcionario_id=${funcionario.id}`, { token });
  if (!Array.isArray(descartadasList) || descartadasList.length < 1) {
    throw new Error('marcação descartada não listada');
  }
  ok('listar marcações descartadas');

  await req('DELETE', `/api/correcoes?funcionario_id=${funcionario.id}&data=2026-10-30`, { token });
  ok('remover correção por chave');

  await req('DELETE', `/api/dias-descartados?funcionario_id=${funcionario.id}&data=2026-10-31`, { token });
  ok('remover dia descartado por chave');

  await req(
    'DELETE',
    `/api/marcacoes-descartadas?funcionario_id=${funcionario.id}&data=2026-10-30&hora=${encodeURIComponent('12:00')}`,
    { token }
  );
  ok('remover marcação descartada por chave');

  const diaFechamento = `2099-02-${String((Number(sufixo) % 28) + 1).padStart(2, '0')}`;
  const periodoFechado = await req('POST', '/api/periodos/fechar', {
    token,
    body: { data_inicio: diaFechamento, data_fim: diaFechamento },
  });
  ok('fechar período');

  const statusPeriodo = await req('GET', `/api/periodos/status?data=${diaFechamento}`, { token });
  if (!statusPeriodo.fechado) throw new Error('período não consta como fechado');
  ok('status do período');

  let bloqueioPeriodo = false;
  try {
    await req('POST', '/api/correcoes', {
      token,
      body: {
        funcionario_id: funcionario.id,
        data: diaFechamento,
        batidas_manuais: ['08:00'],
        justificativa: 'Teste período fechado',
      },
    });
  } catch (e) {
    bloqueioPeriodo = e.message.includes('409');
  }
  if (!bloqueioPeriodo) throw new Error('correção em período fechado foi aceita');
  ok('escrita bloqueada em período fechado');

  await req('POST', `/api/periodos/${periodoFechado.id}/reabrir`, {
    token,
    body: { motivo: 'Teste automatizado' },
  });
  ok('reabrir período');

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

  if (API_TOKEN) {
    await req('POST', '/api/push/event', {
      token: API_TOKEN,
      body: { user_id: `teste-${sufixo}`, data_hora: '2026-10-30 08:00:00', pis: '12345678901' },
    });
    ok('push: enviar evento');

    const eventosPush = await req('GET', '/api/push/events?limit=5', { token: API_TOKEN });
    if (!Array.isArray(eventosPush.events)) throw new Error('push: events inválido');
    ok('push: listar eventos');

    const marcacoesPush = await req('GET', '/api/push/marcacoes?limit=5', { token: API_TOKEN });
    if (!Array.isArray(marcacoesPush.marcacoes)) throw new Error('push: marcações inválido');
    ok('push: listar marcações');

    const comando = await req('POST', '/api/push/cmd', {
      token: API_TOKEN,
      body: { method: 'POST', url: '/teste', body: {} },
    });
    if (!comando.cmd_id) throw new Error('push: comando sem id');
    ok('push: enfileirar comando');

    await req('POST', '/api/push/clear', { token: API_TOKEN });
    await req('POST', '/api/push/clear_events', { token: API_TOKEN });
    await req('DELETE', '/api/push/marcacoes', { token: API_TOKEN });
    ok('push: limpar dados');
  }

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
    if (parametro && token) await req('DELETE', `/api/parametros/${parametro.id}`, { token });
    if (equipamento && token) await req('DELETE', `/api/equipamentos/${equipamento.id}`, { token });
    if (empresaTeste && token) await req('DELETE', `/api/empresas/${empresaTeste.id}`, { token });
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
