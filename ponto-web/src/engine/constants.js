/**
 * Constantes e parâmetros padrão do motor de cálculo de ponto.
 * Inspirado nas melhores práticas de RHiD (Control iD), Secullum Ponto Web
 * e EzPoint Web (RW Tech).
 */

export const WEEKDAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export const WEEKDAY_NAMES = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const DAY_TYPES = {
  UTIL: 'dias_uteis',
  SABADO: 'sabados',
  DOMINGO_FERIADO: 'domingos_feriados',
};

export const PUNCH_ORIGINS = {
  ORIGINAL: 'original',
  MANUAL: 'manual',
  PRE_ASSINALADA: 'pre-assinalada',
  DESCONSIDERADA: 'desconsiderada',
};

// Feriados nacionais fixos (mês-dia).
export const FIXED_HOLIDAYS = [
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25',
];

export const DEFAULT_PARAMS = {
  geral: {
    // Até quantas horas após a saída uma batida ainda pertence ao dia anterior.
    fechamento_horas: 5,
    // Arredondamento das batidas em minutos (0 = desligado).
    arredondamento_minutos: 0,
    // Se true, dias sem batida não geram falta (ponto por exceção).
    ponto_por_excecao: false,
    // Considera trabalho em feriado como dia útil para fins de extra.
    trabalha_feriado: false,
  },
  noturno: {
    ativo: true,
    percentual_adicional: 20,
    hora_reduzida_min: 52,
    hora_reduzida_seg: 30,
    inicio: '22:00',
    fim: '05:00',
  },
  horas_extras: {
    // 'simples' (uma política por tipo de dia) ou 'avancado' (faixas ordenadas).
    modo: 'simples',
    dias_uteis: { faixa1_limite: 120, faixa1_pct: 50, faixa2_pct: 100 },
    sabados: { faixa1_limite: 120, faixa1_pct: 50, faixa2_pct: 100 },
    domingos_feriados: { faixa1_limite: 0, faixa1_pct: 100, faixa2_pct: 100 },
    // 'diario' ou 'mensal' (acúmulo antes de aplicar as faixas).
    acumulo: 'diario',
    separar_noturno: true,
    // Faixas avançadas: [{ limite: 120, pct: 50 }, { limite: 240, pct: 75 }, ...]
    faixas: [],
  },
  banco_horas: {
    ativo: false,
    limite_positivo: 40, // horas
    limite_negativo: 10, // horas
    prazo_compensacao_dias: 90,
    controle_saldo: 'diario', // 'diario' | 'mensal'
    incluir_extras: true,
    incluir_faltas: true,
    incluir_atrasos: true,
    multiplicador: 1,
    periodo_inicio: '',
    periodo_fim: '',
    // 'todas' | 'primeira_faixa' | 'ultima_faixa'
    extras_para_banco: 'todas',
  },
  faltas_atrasos: {
    tolerancia_atraso_minutos: 10,
    desconto_dsr_faltas: true,
    faltas_para_perder_dsr: 5,
    falta_justificada_medico: true,
    carencia_dias_atestado: 15,
    calcular_falta_somente_dia_inteiro: false,
    nao_descontar_faltas_de_normais: false,
  },
  clt_art58: {
    metodo: 'clt_completo', // 'nenhuma' | 'simples' | 'clt_completo'
    tolerancia_entrada_minutos: 10,
    tolerancia_saida_minutos: 10,
    tolerancia_intervalo_minutos: 0,
    limite_por_batida_minutos: 5,
    limite_diario_minutos: 10,
    // Janela para casar batida prevista com batida real (cobre horas extras longas).
    janela_minutos: 240,
  },
  intervalo: {
    intrajornada_minutos: 60,
    tolerancia_minutos: 5,
    descontar_faltante: false,
    interjornada_minutos: 660,
  },
  dsr: {
    percentual_sobre_he: 100,
    inclui_feriados: true,
    modulo_calc_dsr: 'media_he', // 'media_he' | 'mensal'
    descontar_faltas: true,
    faltas_para_perder_dsr: 5,
  },
};

function mergeDeep(base, extra) {
  if (extra === undefined) return base;
  if (extra === null || typeof extra !== 'object' || Array.isArray(extra)) return extra;
  const out = { ...base };
  for (const key of Object.keys(extra)) {
    const b = base?.[key];
    const e = extra[key];
    if (b && typeof b === 'object' && !Array.isArray(b) && e && typeof e === 'object' && !Array.isArray(e)) {
      out[key] = mergeDeep(b, e);
    } else {
      out[key] = e;
    }
  }
  return out;
}

/** Mescla os parâmetros informados com os padrões, sem mutar o original. */
export function normalizarParams(params) {
  return mergeDeep(DEFAULT_PARAMS, params || {});
}

/** Cópia profunda segura para os parâmetros padrão. */
export function paramsPadrao() {
  return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
}
