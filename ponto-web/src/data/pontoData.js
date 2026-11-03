/**
 * Camada de dados do frontend — Fase 5.
 *
 * Regra: o **PostgreSQL é a fonte de verdade**. O `localStorage` é apenas um
 * cache síncrono, usado para (a) pintar a tela antes da rede responder e
 * (b) alimentar o motor de cálculo, que hoje lê horários/parâmetros de forma
 * síncrona (`parametrosUtils.js`).
 *
 * Toda gravação passa pela API e atualiza o cache em seguida.
 */

import { api } from '../api';

// ── Cache ───────────────────────────────────────────────────────────────────

export const CACHE_KEY = {
  empresas: 'ponto_empresas',
  horarios: 'ponto_horarios',
  parametros: 'ponto_parametros_list',
  departamentos: 'ponto_departamentos',
  cargos: 'ponto_cargos',
  equipamentos: 'ponto_equipamentos',
  marcacoes: 'ponto_marcacoes',
  correcoes: 'ponto_correcoes',
  diasDescartados: 'ponto_dias_descartados',
  marcacoesDescartadas: 'ponto_marcacoes_descartadas',
  histHorarios: 'ponto_hist_horarios',
};

export function lerCache(nome, padrao) {
  try {
    const raw = localStorage.getItem(CACHE_KEY[nome] || nome);
    if (!raw) return padrao;
    const valor = JSON.parse(raw);
    return valor ?? padrao;
  } catch {
    return padrao;
  }
}

export function gravarCache(nome, valor) {
  try {
    localStorage.setItem(CACHE_KEY[nome] || nome, JSON.stringify(valor));
  } catch {
    // Cota cheia/modo privado: o cache é opcional, a fonte de verdade é o banco.
  }
}

function jaMigrado(nome) {
  try {
    return localStorage.getItem(`ponto_migrado_${nome}`) === '1';
  } catch {
    return true;
  }
}

function marcarMigrado(nome) {
  try {
    localStorage.setItem(`ponto_migrado_${nome}`, '1');
  } catch {
    // Sem localStorage: a migração roda a cada carga, mas o banco já evita duplicar.
  }
}

// ── Horários ────────────────────────────────────────────────────────────────

const CAMPOS_CONFIG_HORARIO = [
  'compensacao_semanal',
  'adicional_noturno',
  'hora_reduzida',
  'qtd_dias_escala',
  'data_inicio_escala',
  'dias_escala',
  'dias',
  'eventual',
];

export function horarioDoBanco(row) {
  const { config, ...resto } = row;
  return { ...resto, ...(config || {}) };
}

export function horarioParaBanco(horario) {
  const config = {};
  for (const chave of CAMPOS_CONFIG_HORARIO) {
    if (horario[chave] !== undefined) config[chave] = horario[chave];
  }
  return {
    nome: horario.nome,
    tipo: horario.tipo || 'Fixa',
    ativo: horario.ativo !== false,
    config,
  };
}

export async function carregarHorarios() {
  let rows = await api.horarios.list();

  if ((!rows || rows.length === 0) && !jaMigrado('horarios')) {
    const legado = lerCache('horarios', []);
    if (Array.isArray(legado) && legado.length > 0) {
      for (const item of legado) {
        try {
          await api.horarios.create(horarioParaBanco(item));
        } catch {
          // Duplicado ou item inválido: segue com os demais.
        }
      }
      rows = await api.horarios.list();
    }
  }
  marcarMigrado('horarios');

  const lista = (rows || []).map(horarioDoBanco);
  gravarCache('horarios', lista);
  return lista;
}

export async function criarHorario(horario) {
  const row = await api.horarios.create(horarioParaBanco(horario));
  return horarioDoBanco(row);
}

export async function atualizarHorario(id, horario) {
  const row = await api.horarios.update(id, horarioParaBanco(horario));
  return horarioDoBanco(row);
}

export function excluirHorario(id) {
  return api.horarios.remove(id);
}

// ── Parâmetros ──────────────────────────────────────────────────────────────

export function parametroDoBanco(row) {
  return {
    id: row.id,
    nome: row.nome,
    config: row.config || {},
    ativo: row.ativo !== false,
  };
}

export function parametroParaBanco(parametro) {
  return {
    nome: parametro.nome,
    config: parametro.config || {},
    ativo: parametro.ativo !== false,
  };
}

export async function carregarParametros() {
  let rows = await api.parametros.list();

  if ((!rows || rows.length === 0) && !jaMigrado('parametros')) {
    let legado = lerCache('parametros', []);
    // Formato ainda mais antigo: um único objeto de configuração.
    if (!Array.isArray(legado) || legado.length === 0) {
      const antigo = lerCache('ponto_parametros_config', null);
      if (antigo) legado = [{ nome: 'Padrão', config: antigo }];
    }
    if (Array.isArray(legado) && legado.length > 0) {
      for (const item of legado) {
        try {
          await api.parametros.create(parametroParaBanco(item));
        } catch {
          // Duplicado ou item inválido: segue com os demais.
        }
      }
      rows = await api.parametros.list();
    }
  }
  marcarMigrado('parametros');

  const lista = (rows || []).map(parametroDoBanco);
  gravarCache('parametros', lista);
  return lista;
}

export async function criarParametro(parametro) {
  const row = await api.parametros.create(parametroParaBanco(parametro));
  return parametroDoBanco(row);
}

export async function atualizarParametro(id, parametro) {
  const row = await api.parametros.update(id, parametroParaBanco(parametro));
  return parametroDoBanco(row);
}

export function excluirParametro(id) {
  return api.parametros.remove(id);
}

// ── Departamentos e cargos ──────────────────────────────────────────────────

async function carregarAuxiliar(nome, recurso) {
  let rows = await recurso.list();

  if ((!rows || rows.length === 0) && !jaMigrado(nome)) {
    const legado = lerCache(nome, []);
    if (Array.isArray(legado) && legado.length > 0) {
      for (const item of legado) {
        if (!item?.nome) continue;
        try {
          await recurso.create({ nome: item.nome });
        } catch {
          // Nome duplicado: o UNIQUE(empresa_id, nome) já garante a integridade.
        }
      }
      rows = await recurso.list();
    }
  }
  marcarMigrado(nome);

  const lista = (rows || []).map((r) => ({ id: r.id, nome: r.nome }));
  gravarCache(nome, lista);
  return lista;
}

export function carregarDepartamentos() {
  return carregarAuxiliar('departamentos', api.departamentos);
}

export function carregarCargos() {
  return carregarAuxiliar('cargos', api.cargos);
}

export function criarDepartamento(nome) {
  return api.departamentos.create({ nome });
}

export function atualizarDepartamento(id, nome) {
  return api.departamentos.update(id, { nome });
}

export function excluirDepartamento(id) {
  return api.departamentos.remove(id);
}

export function criarCargo(nome) {
  return api.cargos.create({ nome });
}

export function atualizarCargo(id, nome) {
  return api.cargos.update(id, { nome });
}

export function excluirCargo(id) {
  return api.cargos.remove(id);
}

// ── Histórico de horários ───────────────────────────────────────────────────

export async function carregarHistHorarios(funcionarioId) {
  const rows = await api.funcionarios.histHorarios.list(funcionarioId);
  const lista = (rows || []).map((r) => ({
    horario_id: r.horario_id,
    data_inicio: r.data_inicio,
  }));

  if (lista.length === 0) {
    // Migração única do formato antigo: { [funcionarioId]: [...] }.
    const legado = lerCache('histHorarios', {});
    const hist = legado?.[funcionarioId];
    if (Array.isArray(hist) && hist.length > 0) {
      try {
        await api.funcionarios.histHorarios.replace(funcionarioId, hist);
        delete legado[funcionarioId];
        gravarCache('histHorarios', legado);
        return hist.map((h) => ({
          horario_id: h.horario_id,
          data_inicio: h.data_inicio,
        }));
      } catch {
        // Sem rede: mantém o legado em memória até a próxima tentativa.
        return hist;
      }
    }
  }

  return lista;
}

export function salvarHistHorarios(funcionarioId, historico) {
  return api.funcionarios.histHorarios.replace(funcionarioId, historico || []);
}

// ── Equipamentos (REPs) ─────────────────────────────────────────────────────

const CAMPOS_EQUIPAMENTO = [
  'nome', 'modelo', 'num_serie', 'localizacao', 'tipo_conexao', 'ip', 'porta',
  'usuario', 'senha', 'cloud_url', 'api_key', 'cloud_rep_id', 'observacoes',
  'portaria', 'ativo', 'empresa_id',
];

export function equipamentoParaBanco(equipamento) {
  const dados = {};
  for (const campo of CAMPOS_EQUIPAMENTO) {
    if (equipamento[campo] !== undefined) dados[campo] = equipamento[campo];
  }
  if (dados.ativo === undefined) dados.ativo = true;
  return dados;
}

export async function carregarEquipamentos() {
  let rows = await api.equipamentos.list();

  if ((!rows || rows.length === 0) && !jaMigrado('equipamentos')) {
    const legado = lerCache('equipamentos', []);
    if (Array.isArray(legado) && legado.length > 0) {
      for (const item of legado) {
        if (!item?.nome) continue;
        try {
          await api.equipamentos.create(equipamentoParaBanco(item));
        } catch {
          // Item inválido/duplicado: segue com os demais.
        }
      }
      rows = await api.equipamentos.list();
    }
  }
  marcarMigrado('equipamentos');

  const lista = (rows || []).map((r) => ({ ...r, ativo: r.ativo !== false }));
  gravarCache('equipamentos', lista);
  return lista;
}

export async function criarEquipamento(equipamento) {
  return api.equipamentos.create(equipamentoParaBanco(equipamento));
}

export async function atualizarEquipamento(id, equipamento) {
  return api.equipamentos.update(id, equipamentoParaBanco(equipamento));
}

export function excluirEquipamento(id) {
  return api.equipamentos.remove(id);
}

// ── Marcações ───────────────────────────────────────────────────────────────

export async function carregarMarcacoes() {
  let rows = await api.marcacoes.list({ limit: 50000 });

  if (!jaMigrado('marcacoes')) {
    const legado = lerCache('marcacoes', []);
    if (Array.isArray(legado) && legado.length > 0) {
      const chave = (m) => [
        String(m.cpf || '').replace(/\D/g, ''),
        String(m.pis || '').replace(/\D/g, ''),
        m.data,
        String(m.hora || '').slice(0, 5),
      ].join(':');
      const existentes = new Set((rows || []).map(chave));
      const novas = legado.filter((m) => m.data && m.hora && !existentes.has(chave(m)));

      if (novas.length > 0) {
        try {
          await api.marcacoes.import(novas.map((m) => ({
            funcionario_id: m.funcionario_id || null,
            nsr: m.nsr || null,
            cpf: m.cpf || null,
            pis: m.pis || null,
            data: m.data,
            hora: m.hora,
            equip_id: m.equip_id || null,
            equip_nome: m.equip_nome || null,
            origem: m.origem || 'import',
          })));
          rows = await api.marcacoes.list({ limit: 50000 });
        } catch {
          // Sem rede: mantém o cache legado até a próxima carga.
          return legado;
        }
      }
    }
  }
  marcarMigrado('marcacoes');

  const lista = rows || [];
  gravarCache('marcacoes', lista);
  return lista;
}

// ── Apuração: correções, dias e marcações descartadas ───────────────────────

function docsDoFuncionario(funcionario) {
  const docs = [];
  const cpf = String(funcionario?.cpf || '').replace(/\D/g, '');
  const pis = String(funcionario?.pis || '').replace(/\D/g, '');
  if (cpf) docs.push(cpf);
  if (pis) docs.push(pis);
  return docs;
}

/**
 * Carrega correções/descartes do banco e devolve os mapas no formato que o
 * motor espera: `{ [`${doc}_${data}`]: valor }`.
 */
export async function carregarApuracaoExtras(funcionarios = []) {
  const [correcoesRows, diasRows, descartadasRows] = await Promise.all([
    api.correcoes.list({ limit: 50000 }),
    api.diasDescartados.list(),
    api.marcacoesDescartadas.list(),
  ]);

  const porId = new Map(funcionarios.map((f) => [String(f.id), f]));

  const correcoes = {};
  for (const c of correcoesRows || []) {
    const funcionario = porId.get(String(c.funcionario_id));
    if (!funcionario) continue;
    const registro = {
      batidas_manuais: (c.batidas_manuais || []).map((t) => String(t).slice(0, 5)),
      justificativa: c.justificativa || '',
      aplicada_em: c.aplicada_em || null,
    };
    for (const doc of docsDoFuncionario(funcionario)) {
      correcoes[`${doc}_${c.data}`] = registro;
    }
  }

  const diasDescartados = {};
  for (const d of diasRows || []) {
    const funcionario = porId.get(String(d.funcionario_id));
    if (!funcionario) continue;
    const registro = { motivo: d.motivo || '', data: d.created_at || null };
    for (const doc of docsDoFuncionario(funcionario)) {
      diasDescartados[`${doc}_${d.data}`] = registro;
    }
  }

  const marcacoesDescartadas = {};
  for (const m of descartadasRows || []) {
    const funcionario = porId.get(String(m.funcionario_id));
    if (!funcionario) continue;
    for (const doc of docsDoFuncionario(funcionario)) {
      const chave = `${doc}_${m.data}`;
      if (!marcacoesDescartadas[chave]) marcacoesDescartadas[chave] = [];
      marcacoesDescartadas[chave].push(String(m.hora).slice(0, 5));
    }
  }

  gravarCache('correcoes', correcoes);
  gravarCache('diasDescartados', diasDescartados);
  gravarCache('marcacoesDescartadas', marcacoesDescartadas);

  return { correcoes, diasDescartados, marcacoesDescartadas };
}

export function salvarCorrecao(funcionarioId, data, { batidas_manuais, justificativa }) {
  return api.correcoes.upsert({
    funcionario_id: funcionarioId,
    data,
    batidas_manuais: batidas_manuais || [],
    justificativa: justificativa || null,
  });
}

export function desconsiderarDia(funcionarioId, data, motivo) {
  return api.diasDescartados.upsert({ funcionario_id: funcionarioId, data, motivo });
}

export function restaurarDia(funcionarioId, data) {
  return api.diasDescartados.removeByKey(funcionarioId, data);
}

export function descartarMarcacao(funcionarioId, data, hora) {
  return api.marcacoesDescartadas.create({ funcionario_id: funcionarioId, data, hora });
}

export function restaurarMarcacao(funcionarioId, data, hora) {
  return api.marcacoesDescartadas.removeByKey(funcionarioId, data, hora);
}
