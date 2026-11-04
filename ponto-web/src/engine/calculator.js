/**
 * Orquestrador do motor de cálculo.
 * Uma única implementação para Dashboard, Apuração, Relatórios e exportações.
 */

import {
  toMinutes, formatMinutes, eachDate, addDays, weekdayName, dayType,
} from './time.js';
import { normalizarParams } from './constants.js';
import { resolverJornadaDoDia } from './schedule.js';
import { normalizarMarcacoes, emparelharBatidas, somarPares } from './punch.js';
import { aplicarTolerancia } from './tolerance.js';
import { calcularNoturno } from './night.js';
import { calcularExtras } from './overtime.js';
import { calcularFaltas } from './absence.js';
import { aplicarJustificativas } from './justification.js';
import { calcularDSR } from './dsr.js';
import { calcularBanco } from './bank.js';

function calcularIntervalo({ pares = [], jornada, params = {} }) {
  if (!pares.length) return { realMin: 0, faltanteMin: 0 };
  let real = 0;
  for (let i = 1; i < pares.length; i++) {
    const anterior = pares[i - 1]?.saida;
    const atual = pares[i]?.entrada;
    if (anterior && atual) real += Math.max(0, atual.minutes - anterior.minutes);
  }
  const previsto = jornada?.intervaloPrevistoMin || 0;
  const tolerancia = params?.intervalo?.tolerancia_minutos || 0;
  const faltante = previsto > 0 ? Math.max(0, previsto - real - tolerancia) : 0;
  return { realMin: real, faltanteMin: faltante };
}

/**
 * Calcula um único dia.
 */
export function calcularDia({
  data,
  funcionario = {},
  horario = null,
  params: paramsRaw = {},
  marcacoes = [],
  correcao = {},
  descartadas = [],
  diaDesconsiderado = null,
  feriados = [],
  jornadaOverride = null,
  preAssinaladas = [],
  justificativas = [],
} = {}) {
  const params = normalizarParams(paramsRaw);
  const jornada = resolverJornadaDoDia({
    horario,
    data,
    dataInicioEscala: funcionario?.data_inicio || horario?.data_inicio_escala || '',
    jornadaOverride,
    feriados,
    params,
  });

  const batidas = normalizarMarcacoes({ marcacoes, descartadas, correcao, preAssinaladas });
  const batidasOriginais = (marcacoes || [])
    .map((m) => m.hora || m.time || (m.data_hora ? String(m.data_hora).slice(11, 16) : ''))
    .filter(Boolean)
    .map((t) => String(t).slice(0, 5))
    .sort();
  const pares = emparelharBatidas(batidas);
  const valido = batidas.length % 2 === 0;
  const descartado = !!diaDesconsiderado;
  const justificativa = correcao?.justificativa || diaDesconsiderado?.motivo || '';
  const tipoDia = dayType(data, feriados);
  const previstoMin = descartado ? 0 : jornada.cargaPrevistaMin;
  const temBatidas = batidas.length > 0;
  const tipoParaExtras = (!jornada.trabalha && temBatidas && jornada.motivo === 'folga')
    ? 'domingos_feriados'
    : tipoDia;

  let tol = {
    trabalhadoBruto: 0,
    trabalhadoMin: 0,
    toleranciaMin: 0,
    extraMin: 0,
    faltaMin: 0,
    detalhes: [],
    pares,
  };

  if (!descartado && jornada.trabalha) {
    tol = aplicarTolerancia({
      batidas,
      previstoMin,
      periodos: jornada.periodos,
      params,
      tipoDia,
      data,
    });
    // Falta de dia inteiro: sem nenhuma batida em dia previsto.
    if (!temBatidas && previstoMin > 0) tol.faltaMin = previstoMin;
    // Nunca deixa a falta ultrapassar a carga prevista.
    tol.faltaMin = Math.min(tol.faltaMin, previstoMin);
  } else if (!descartado && temBatidas) {
    const bruto = somarPares(pares);
    tol = {
      trabalhadoBruto: bruto,
      trabalhadoMin: bruto,
      toleranciaMin: 0,
      extraMin: bruto,
      faltaMin: 0,
      detalhes: [],
      pares,
    };
  }

  const noturno = calcularNoturno({
    pares: tol.pares,
    periodos: [],
    noturno: jornada.noturno,
  });

  const extras = calcularExtras({
    extraMin: tol.extraMin,
    tipoDia: tipoParaExtras,
    params,
    noturnoMin: noturno.reduzidoMin,
  });

  const faltas = calcularFaltas({
    previstoMin,
    faltaBase: tol.faltaMin,
    justificativa,
    params,
    temBatidas,
  });

  if (descartado) {
    faltas.faltaMin = 0;
    faltas.faltaJustificadaMin = previstoMin;
    faltas.atrasoMin = 0;
  }

  const just = aplicarJustificativas({
    justificativas,
    faltaMin: faltas.faltaMin,
    extraMin: extras.extraMin,
    previstoMin,
  });

  const faltaFinalMin = descartado ? 0 : just.faltaMin;
  const faltaJustificadaFinalMin = descartado
    ? faltas.faltaJustificadaMin
    : faltas.faltaJustificadaMin + just.abonoFaltaMin;
  const extraFinalMin = just.extraMin;
  const extraRelocado = extraFinalMin < extras.extraMin;
  const atrasoFinalMin = descartado
    ? 0
    : Math.max(0, faltas.atrasoMin - just.abonoFaltaMin);
  const saldoDiaMin = descartado
    ? 0
    : (tol.trabalhadoMin - previstoMin) + just.abonoFaltaMin + just.ajusteMin;

  const normaisMin = params.faltas_atrasos.nao_descontar_faltas_de_normais
    ? tol.trabalhadoMin
    : Math.min(tol.trabalhadoMin + just.abonoFaltaMin, previstoMin);

  const intervalo = calcularIntervalo({ pares: tol.pares, jornada, params });

  const ocorrencias = [];
  if (!valido) ocorrencias.push({ tipo: 'batida_impar', mensagem: 'Número ímpar de batidas no dia' });
  if (!jornada.trabalha && temBatidas) ocorrencias.push({ tipo: 'trabalho_em_folga', mensagem: 'Trabalho em dia não previsto' });
  if (jornada.trabalha && !temBatidas && !descartado && !justificativa && faltaFinalMin > 0) {
    ocorrencias.push({ tipo: 'falta', mensagem: 'Sem marcações em dia previsto' });
  }
  if (intervalo.faltanteMin > 0) {
    ocorrencias.push({ tipo: 'intervalo_curto', mensagem: `Intervalo ${formatMinutes(intervalo.faltanteMin)} menor que o previsto` });
  }
  if (extras.extraMin > 120) {
    ocorrencias.push({ tipo: 'hora_extra_elevada', mensagem: `Hora extra elevada: ${formatMinutes(extras.extraMin)}` });
  }

  const memoria = [
    { passo: 'jornada', detalhe: `${jornada.motivo}: previsto ${formatMinutes(previstoMin)}` },
    { passo: 'batidas', detalhe: `${batidas.length} batida(s), ${pares.filter((p) => p.completo).length} par(es), trabalhado ${formatMinutes(tol.trabalhadoMin)}` },
    { passo: 'tolerancia', detalhe: `${params.clt_art58.metodo}: ${formatMinutes(tol.toleranciaMin)} tolerados` },
    { passo: 'extras', detalhe: `${formatMinutes(extras.extraMin)} (${extras.percentualMedio}%)` },
    { passo: 'faltas', detalhe: `${formatMinutes(faltaFinalMin)} não justificadas, ${formatMinutes(faltaJustificadaFinalMin)} justificadas` },
    { passo: 'justificativas', detalhe: just.temJustificativa
      ? `${just.itens.length} lançamento(s), ${formatMinutes(just.abonoFaltaMin)} abonados, ${formatMinutes(just.ajusteMin)} de ajuste`
      : 'nenhuma' },
    { passo: 'noturno', detalhe: `${formatMinutes(noturno.reduzidoMin)} reduzidas (${formatMinutes(noturno.relogioMin)} relógio)` },
  ];

  const totalFormatado = descartado
    ? 'FALTA'
    : (just.abonaDiaInteiro && !temBatidas)
      ? 'JUSTIFICADA'
      : (!temBatidas && previstoMin > 0 && jornada.trabalha)
        ? 'FALTA'
        : (valido ? formatMinutes(tol.trabalhadoMin) : 'Erro: Ímpar');

  return {
    data,
    diaSemana: weekdayName(data),
    tipoDia,
    trabalha: jornada.trabalha,
    motivo: jornada.motivo,
    batidas: batidas.map((b) => b.time),
    batidasDetalhadas: batidas,
    batidas_originais: batidasOriginais,
    batidas_manuais: correcao?.batidas_manuais || [],
    batidas_descartadas: descartadas || [],
    equip: batidas[0]?.equip || 'REP',
    funcionario_id: funcionario?.id || null,
    pares: tol.pares,
    valido,
    descartado,
    descartado_motivo: diaDesconsiderado?.motivo || '',
    justificativa,
    correcao_aplicada: !!(correcao?.justificativa || correcao?.batidas_manuais?.length),

    previstoMin,
    carga_esperada: previstoMin,
    trabalhadoMin: tol.trabalhadoMin,
    trabalhadoBrutoMin: tol.trabalhadoBruto,
    normaisMin,
    extraMin: extraFinalMin,
    debitoMin: faltaFinalMin,
    faltaMin: faltaFinalMin,
    faltaJustificadaMin: faltaJustificadaFinalMin,
    atrasoMin: atrasoFinalMin,
    saldoDiaMin,
    abonoMin: just.abonoFaltaMin,
    abonoJustificativaMin: just.abonoFaltaMin,
    ajusteMin: just.ajusteMin,
    bancoAjusteMin: just.bancoMin + just.ajusteMin,
    protegeDSR: just.protegeDSR,
    justificativas: just.itens,
    toleranciaMin: tol.toleranciaMin,
    toleranciaAplicada: tol.toleranciaMin,

    noturnoMin: noturno.reduzidoMin,
    noturnoRelogioMin: noturno.relogioMin,
    adicionalNoturno: noturno.adicionalPct,
    horasNoturnas: Math.round(noturno.reduzidoMin),

    extraFaixa1: extraRelocado ? 0 : extras.extraFaixa1,
    extraFaixa2: extraRelocado ? 0 : extras.extraFaixa2,
    faixa1Pct: extras.faixa1Pct,
    faixa2Pct: extras.faixa2Pct,
    percentualHE: extras.percentualMedio,
    extraDiurnoMin: extraRelocado ? 0 : extras.extraDiurnoMin,
    extraNoturnoMin: extraRelocado ? 0 : extras.extraNoturnoMin,
    tipoHora: extraFinalMin > 0 ? tipoParaExtras : '',

    intervaloPrevistoMin: jornada.intervaloPrevistoMin,
    intervaloRealMin: intervalo.realMin,
    intervaloFaltanteMin: intervalo.faltanteMin,

    ocorrencias,
    memoria,

    total_minutos: tol.trabalhadoMin,
    total_formatado: totalFormatado,
    dsrMin: 0,
    bancoMin: 0,
  };
}

/**
 * Calcula um período completo de um funcionário.
 */
export function calcularPeriodo({
  funcionario = {},
  doc = '',
  marcacoes = [],
  horario = null,
  params = {},
  dataInicio,
  dataFim,
  correcoes = {},
  diasDescartados = {},
  marcacoesDescartadas = {},
  feriados = [],
  jornadas = {},
  preAssinaladas = {},
  justificativas = [],
  bancoSaldoInicial = 0,
} = {}) {
  const paramsNorm = normalizarParams(params);
  const docFunc = doc
    || String(funcionario.cpf || '').replace(/\D/g, '')
    || String(funcionario.pis || '').replace(/\D/g, '');

  const porData = {};
  for (const m of marcacoes || []) {
    const dateStr = m.data || m.date || (m.data_hora ? String(m.data_hora).slice(0, 10) : '');
    if (!dateStr) continue;
    if (!porData[dateStr]) porData[dateStr] = [];
    porData[dateStr].push({
      ...m,
      __id: m.__id || `${m.nsr ?? m.id ?? ''}:${dateStr}:${m.hora || m.time || ''}`,
    });
  }

  const datas = eachDate(dataInicio, dataFim);
  const consumidas = new Set();
  const linhas = [];

  const justificativasPorDia = {};
  for (const j of justificativas || []) {
    const dataJ = String(j.data || '').slice(0, 10);
    if (!dataJ || String(j.funcionario_id) !== String(funcionario?.id)) continue;
    const chaveJ = `${docFunc}_${dataJ}`;
    if (!justificativasPorDia[chaveJ]) justificativasPorDia[chaveJ] = [];
    justificativasPorDia[chaveJ].push(j);
  }

  for (const data of datas) {
    const chave = `${docFunc}_${data}`;
    const correcao = correcoes[chave] || {};
    const descartadas = marcacoesDescartadas[chave] || [];
    const diaDesconsiderado = diasDescartados[chave] || null;
    const jornadaOverride = jornadas[data] || null;
    const justificativasDia = justificativasPorDia[chave] || [];

    let marcacoesDia = (porData[data] || []).filter((m) => !consumidas.has(m.__id));

    // Turnos que cruzam a meia-noite: puxa batidas madrugada do dia seguinte.
    const jornada = resolverJornadaDoDia({
      horario,
      data,
      dataInicioEscala: funcionario?.data_inicio || horario?.data_inicio_escala || '',
      jornadaOverride,
      feriados,
      params: paramsNorm,
    });
    if (jornada.trabalha && jornada.periodos.some((p) => p.cruzaMeiaNoite)) {
      const proximo = addDays(data, 1);
      const finsCruzando = jornada.periodos
        .filter((p) => p.cruzaMeiaNoite)
        .map((p) => p.saidaMin % 1440);
      const limite = Math.max(
        ...finsCruzando,
        (paramsNorm.geral.fechamento_horas || 5) * 60
      );
      for (const m of porData[proximo] || []) {
        if (consumidas.has(m.__id)) continue;
        const min = toMinutes(m.hora || m.time || (m.data_hora ? String(m.data_hora).slice(11, 16) : ''));
        if (min <= limite) {
          consumidas.add(m.__id);
          marcacoesDia.push({ ...m, __minutosAbs: min + 1440 });
        }
      }
    }

    const linha = calcularDia({
      data,
      funcionario,
      horario,
      params: paramsNorm,
      marcacoes: marcacoesDia,
      correcao,
      descartadas,
      diaDesconsiderado,
      feriados,
      jornadaOverride,
      preAssinaladas: preAssinaladas[data] || [],
      justificativas: justificativasDia,
    });
    linhas.push(linha);
  }

  // DSR
  const dsr = calcularDSR({ linhas, params: paramsNorm, feriados });
  for (const l of linhas) l.dsrMin = dsr.porData[l.data] || 0;

  // Banco de horas
  const banco = calcularBanco({ linhas, params: paramsNorm, saldoInicial: bancoSaldoInicial });

  // Interjornada (mínimo de 11h entre a saída de um dia e a entrada do próximo)
  const minimoInterjornada = paramsNorm?.intervalo?.interjornada_minutos || 660;
  for (let i = 1; i < linhas.length; i++) {
    const anterior = linhas[i - 1];
    const atual = linhas[i];
    const ultimaSaida = [...(anterior.pares || [])].reverse().find((p) => p.saida)?.saida;
    const primeiraEntrada = atual.pares?.[0]?.entrada;
    if (ultimaSaida && primeiraEntrada) {
      const diff = (primeiraEntrada.minutes + 1440) - ultimaSaida.minutes;
      if (diff > 0 && diff < minimoInterjornada) {
        atual.ocorrencias.push({
          tipo: 'interjornada',
          mensagem: `Interjornada de ${formatMinutes(diff)} (mínimo ${formatMinutes(minimoInterjornada)})`,
        });
      }
    }
  }

  const totais = resumirLinhas(linhas, banco);
  return { funcionario, doc: docFunc, linhas, totais, dsr, banco };
}

export function resumirLinhas(linhas = [], banco = null) {
  const t = {
    totalPrevisto: 0,
    totalTrabalhado: 0,
    totalNormais: 0,
    totalExtra: 0,
    totalFalta: 0,
    totalFaltaJustificada: 0,
    totalNoturno: 0,
    totalNoturnoRelogio: 0,
    totalDSR: 0,
    totalAtraso: 0,
    totalTolerancia: 0,
    totalExtraDiurno: 0,
    totalExtraNoturno: 0,
    totalIntervaloFaltante: 0,
    totalAbono: 0,
    totalAjuste: 0,
  };

  for (const l of linhas) {
    t.totalPrevisto += l.previstoMin || 0;
    t.totalTrabalhado += l.trabalhadoMin || 0;
    t.totalNormais += l.normaisMin || 0;
    t.totalExtra += l.extraMin || 0;
    t.totalFalta += l.faltaMin || 0;
    t.totalFaltaJustificada += l.faltaJustificadaMin || 0;
    t.totalNoturno += l.noturnoMin || 0;
    t.totalNoturnoRelogio += l.noturnoRelogioMin || 0;
    t.totalDSR += l.dsrMin || 0;
    t.totalAtraso += l.atrasoMin || 0;
    t.totalTolerancia += l.toleranciaMin || 0;
    t.totalExtraDiurno += l.extraDiurnoMin || 0;
    t.totalExtraNoturno += l.extraNoturnoMin || 0;
    t.totalIntervaloFaltante += l.intervaloFaltanteMin || 0;
    t.totalAbono += l.abonoJustificativaMin || 0;
    t.totalAjuste += l.ajusteMin || 0;
  }

  return {
    ...t,
    saldo: t.totalTrabalhado - t.totalPrevisto,
    saldoAjustado: t.totalTrabalhado - t.totalPrevisto + t.totalAbono + t.totalAjuste,
    bancoSaldoFinal: banco?.saldoFinal ?? 0,
    // Compatibilidade com a UI atual
    totalEsp: t.totalPrevisto,
    totalTrab: t.totalTrabalhado,
    totalHE: t.totalExtra,
    totalNot: t.totalNoturno,
    totalDSR: t.totalDSR,
  };
}

/**
 * Calcula o período para uma lista de funcionários conhecidos.
 */
export function calcularTodos({
  funcionarios = [],
  marcacoes = [],
  horarios = [],
  parametrosMap = {},
  correcoes = {},
  diasDescartados = {},
  marcacoesDescartadas = {},
  feriados = [],
  justificativas = [],
  dataInicio,
  dataFim,
} = {}) {
  return (funcionarios || []).map((f) => {
    const doc = String(f.cpf || '').replace(/\D/g, '') || String(f.pis || '').replace(/\D/g, '');
    const horario = (horarios || []).find((h) => String(h.id) === String(f.horario_id));
    const params = parametrosMap[String(f.parametro_id)] || parametrosMap['_default'] || {};
    const minhas = (marcacoes || []).filter((m) => {
      const cpf = String(m.cpf || '').replace(/\D/g, '');
      const pis = String(m.pis || '').replace(/\D/g, '');
      return cpf === doc || (pis && pis === doc);
    });
    return calcularPeriodo({
      funcionario: f,
      doc,
      marcacoes: minhas,
      horario,
      params,
      dataInicio,
      dataFim,
      correcoes,
      diasDescartados,
      marcacoesDescartadas,
      feriados,
      justificativas,
    });
  });
}
