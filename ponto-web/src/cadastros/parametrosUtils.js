/**
 * Compatibilidade com a API antiga de parâmetros.
 * Toda a matemática agora vive em `src/engine`.
 */

import {
  normalizarParams,
  paramsPadrao,
  toMinutes,
  formatMinutes,
  weekdayName,
  isHoliday,
  dayType,
  normalizarPeriodos,
  resolverJornadaDoDia,
  calcularNoturno,
  calcularExtras,
  aplicarTolerancia as aplicarToleranciaEngine,
  calcularDSR as calcularDSREngine,
  calcularDia,
} from '../engine/index.js';

function carregarParametros(id) {
  try {
    const list = JSON.parse(localStorage.getItem('ponto_parametros_list')) || [];
    if (list.length === 0) {
      const antigo = JSON.parse(localStorage.getItem('ponto_parametros_config'));
      if (antigo) return antigo;
      return getPadrao();
    }
    if (id !== undefined && id !== null && id !== '') {
      const found = list.find(i => String(i.id) === String(id));
      if (found) return found.config;
    }
    return list[0].config;
  } catch {
    return getPadrao();
  }
}

function getPadrao() {
  return paramsPadrao();
}

const calcMinutos = toMinutes;
const formatMinutos = (min) => formatMinutes(min);
const minParaStr = (min) => formatMinutes(min);
const nomeDiaSemana = (dateStr) => weekdayName(dateStr);
const isFeriado = (dateStr) => isHoliday(dateStr);
const tipoDia = (dateStr) => dayType(dateStr);

function calcHorasNoturnas(entradaMin, saidaMin, params) {
  const p = normalizarParams(params);
  const res = calcularNoturno({
    periodos: [{ entradaMin, saidaMin }],
    noturno: p.noturno,
  });
  return {
    horasRelogio: res.relogioMin,
    horasNoturnas: res.reduzidoMin,
    adicional: res.adicionalPct,
  };
}

function calcHorasExtras(entradaMin, saidaMin, cargaMinutos, dateStr, params, extraOverride) {
  const p = normalizarParams(params);
  const real = saidaMin - entradaMin;
  const extraMin = extraOverride !== undefined ? extraOverride : Math.max(0, real - cargaMinutos);
  const tipo = dayType(dateStr);
  const res = calcularExtras({ extraMin, tipoDia: tipo, params: p });
  return {
    extraMin: res.extraMin,
    debitoMin: Math.max(0, cargaMinutos - real),
    tipoHora: tipo,
    percentual: res.percentualMedio,
    valorExtra: 0,
    extraFaixa1: res.extraFaixa1,
    extraFaixa2: res.extraFaixa2,
    faixa1_pct: res.faixa1Pct,
    faixa2_pct: res.faixa2Pct,
    faixa1_limite: 0,
  };
}

function calcDSR(periodo, params) {
  const linhas = (periodo || []).map((d) => {
    const data = typeof d === 'string' ? d : d.data;
    return {
      data,
      tipoDia: dayType(data),
      extraMin: typeof d === 'object' ? (d.extraMin || 0) : 0,
      faltaMin: typeof d === 'object' ? (d.faltaMin || 0) : 0,
    };
  });
  const res = calcularDSREngine({ linhas, params: normalizarParams(params) });
  const diasUteis = linhas.filter((l) => l.tipoDia === 'dias_uteis').length;
  const domingosFeriados = linhas.filter((l) => l.tipoDia === 'domingos_feriados').length;
  const totalHE = linhas.reduce((acc, l) => acc + l.extraMin, 0);
  return {
    dsrMinutos: res.dsrMin,
    mediaHE: diasUteis > 0 ? totalHE / diasUteis : 0,
    totalHE,
    diasUteis,
    domingosFeriados,
  };
}

function obterHorariosPrevistos(horario, dateStr, dataInicioEscala) {
  const jornada = resolverJornadaDoDia({
    horario,
    data: dateStr,
    dataInicioEscala,
    params: paramsPadrao(),
  });
  return jornada.periodos.flatMap((p) => [p.entrada, p.saida]).filter(Boolean);
}

function periodosDeBatidas(esperados) {
  const periodos = [];
  for (let i = 0; i + 1 < esperados.length; i += 2) {
    periodos.push({ entrada: esperados[i], saida: esperados[i + 1] });
  }
  return normalizarPeriodos(periodos);
}

function aplicarTolerancia(batidas, cargaMinutos, params, horario, dateStr, dataInicioEscala) {
  const p = normalizarParams(params);
  const esperados = obterHorariosPrevistos(horario, dateStr, dataInicioEscala);
  const batidasObj = (batidas || []).map((t, i) => ({
    time: String(t).slice(0, 5),
    minutes: toMinutes(t),
    origem: 'original',
    nsr: i,
  }));
  const res = aplicarToleranciaEngine({
    batidas: batidasObj,
    previstoMin: cargaMinutos,
    periodos: periodosDeBatidas(esperados),
    params: p,
    tipoDia: dayType(dateStr),
    data: dateStr,
  });
  return {
    cargaMinutos: res.trabalhadoMin,
    toleranciaAplicada: res.toleranciaMin,
    extraMin: res.extraMin,
    faltaMin: res.faltaMin,
    detalhes: res.detalhes,
  };
}

function calcularToleranciaArt58(batidas, horario, dateStr, dataInicioEscala, params) {
  const p = normalizarParams(params);
  const jornada = resolverJornadaDoDia({ horario, data: dateStr, dataInicioEscala, params: p });
  const batidasObj = (batidas || []).map((t, i) => ({
    time: String(t).slice(0, 5),
    minutes: toMinutes(t),
    origem: 'original',
    nsr: i,
  }));
  const res = aplicarToleranciaEngine({
    batidas: batidasObj,
    previstoMin: jornada.cargaPrevistaMin,
    periodos: jornada.periodos,
    params: p,
    tipoDia: dayType(dateStr),
    data: dateStr,
  });
  return {
    extraMin: res.extraMin,
    faltaMin: res.faltaMin,
    toleranciaAplicada: res.toleranciaMin,
    detalhes: res.detalhes,
  };
}

class PeriodoApuracao {
  constructor(dateStr, params) {
    this.dateStr = dateStr;
    this.params = normalizarParams(params);
    this.batidas = [];
    this.horario = null;
    this.dataInicioEscala = '';
    this.resultado = null;
  }

  setHorarioInfo(horario, dataInicioEscala) {
    this.horario = horario;
    this.dataInicioEscala = dataInicioEscala;
  }

  calcular() {
    this.resultado = calcularDia({
      data: this.dateStr,
      funcionario: { data_inicio: this.dataInicioEscala },
      horario: this.horario,
      params: this.params,
      marcacoes: this.batidas.map((hora) => ({ hora })),
    });
    return this.resultado;
  }

  getResumo() {
    const r = this.resultado || this.calcular();
    return {
      trabalhado: r.trabalhadoMin,
      extraMin: r.extraMin,
      debitoMin: r.debitoMin,
      tipoHora: r.tipoHora,
      percentualHE: r.percentualHE,
      valorExtra: 0,
      horasNoturnas: r.horasNoturnas,
      horasRelogioNoturno: r.noturnoRelogioMin,
      adicionalNoturno: r.adicionalNoturno,
      toleranciaAplicada: r.toleranciaMin,
      descartado: r.descartado,
    };
  }
}

function carregarParametrosPorId(id) {
  if (!id && id !== 0) return carregarParametros();
  try {
    const list = JSON.parse(localStorage.getItem('ponto_parametros_list')) || [];
    const found = list.find(i => String(i.id) === String(id));
    if (found) return found.config;
  } catch {
    // localStorage indisponível ou JSON inválido: usa o padrão.
  }
  return carregarParametros();
}

function carregarListaParametros() {
  try {
    return JSON.parse(localStorage.getItem('ponto_parametros_list')) || [];
  } catch {
    return [];
  }
}

function carregarParametrosMap() {
  try {
    const list = JSON.parse(localStorage.getItem('ponto_parametros_list')) || [];
    const map = {};
    list.forEach(i => { map[String(i.id)] = i.config; });
    if (list.length > 0) map['_default'] = list[0].config;
    return map;
  } catch {
    return {};
  }
}

export {
  carregarParametros, carregarParametrosPorId, carregarListaParametros, carregarParametrosMap,
  getPadrao, calcMinutos, formatMinutos, minParaStr,
  nomeDiaSemana, isFeriado, tipoDia, calcHorasNoturnas,
  calcHorasExtras, calcDSR, aplicarTolerancia, calcularToleranciaArt58,
  obterHorariosPrevistos, PeriodoApuracao,
};
