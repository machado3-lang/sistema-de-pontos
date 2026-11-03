/**
 * Resolução da jornada prevista para um dia.
 * Suporta: Fixa, Escala Flexível (cíclica), Escala Mensal, Turno Noturno,
 * Eventual, jornada por exceção (override) e feriados.
 */

import { toMinutes, weekdayKey, isHoliday, diffDays, parseDate } from './time.js';

export function normalizarPeriodos(periodos = []) {
  return (periodos || [])
    .filter((p) => p && p.entrada && p.saida)
    .map((p) => {
      const entradaMin = toMinutes(p.entrada);
      let saidaMin = toMinutes(p.saida);
      let cruzaMeiaNoite = false;
      if (saidaMin <= entradaMin) {
        saidaMin += 1440;
        cruzaMeiaNoite = true;
      }
      return {
        ...p,
        entrada: String(p.entrada).slice(0, 5),
        saida: String(p.saida).slice(0, 5),
        entradaMin,
        saidaMin,
        cruzaMeiaNoite,
        duracaoMin: saidaMin - entradaMin,
        comp: !!p.comp,
      };
    });
}

export function somarPeriodos(periodos = []) {
  return (periodos || []).reduce((acc, p) => acc + (p.duracaoMin || 0), 0);
}

export function intervaloEntrePeriodos(periodos = []) {
  let total = 0;
  for (let i = 1; i < periodos.length; i++) {
    total += Math.max(0, periodos[i].entradaMin - periodos[i - 1].saidaMin);
  }
  return total;
}

export function normalizarNoturno(paramsNoturno = {}, horario = {}) {
  const pctHorario = Number(horario?.adicional_noturno);
  return {
    ativo: horario?.tipo === 'Turno Noturno'
      || pctHorario > 0
      || horario?.hora_reduzida === true
      || paramsNoturno?.ativo !== false,
    inicio: horario?.noturno_inicio || paramsNoturno?.inicio || '22:00',
    fim: horario?.noturno_fim || paramsNoturno?.fim || '05:00',
    percentual: pctHorario > 0 ? pctHorario : (paramsNoturno?.percentual_adicional ?? 20),
    horaReduzidaMin: paramsNoturno?.hora_reduzida_min ?? 52,
    horaReduzidaSeg: paramsNoturno?.hora_reduzida_seg ?? 30,
  };
}

function resultado({ trabalha, motivo, periodos = [], cargaPrevistaMin, tipo = '', noturno }) {
  const normalizados = normalizarPeriodos(periodos);
  const carga = cargaPrevistaMin !== undefined
    ? Math.max(0, cargaPrevistaMin)
    : somarPeriodos(normalizados);
  return {
    trabalha,
    motivo,
    tipo,
    periodos: normalizados,
    cargaPrevistaMin: carga,
    intervaloPrevistoMin: intervaloEntrePeriodos(normalizados),
    noturno,
  };
}

function cargaDoDia(dia, periodos) {
  const cargaInformada = toMinutes(dia?.carga_diaria);
  if (cargaInformada > 0) return cargaInformada;
  return somarPeriodos(periodos);
}

/**
 * @param {object} input
 * @param {object|null} input.horario Horário cadastrado
 * @param {string} input.data YYYY-MM-DD
 * @param {string} [input.dataInicioEscala] Início da escala (funcionário/horário)
 * @param {object|null} [input.jornadaOverride] Jornada específica do dia
 * @param {string[]} [input.feriados] Feriados (YYYY-MM-DD)
 * @param {object} [input.params] Parâmetros normalizados
 */
export function resolverJornadaDoDia({
  horario = null,
  data,
  dataInicioEscala = '',
  jornadaOverride = null,
  feriados = [],
  params = {},
}) {
  const noturno = normalizarNoturno(params?.noturno || {}, horario || {});
  const feriado = isHoliday(data, feriados);
  const trabalhaFeriado = horario?.trabalha_feriado === true || params?.geral?.trabalha_feriado === true;

  // 1) Jornada específica do dia (override)
  if (jornadaOverride && (jornadaOverride.periodos?.length || jornadaOverride.carga_diaria)) {
    if (jornadaOverride.folga || jornadaOverride.tipo === 'Folga') {
      return resultado({ trabalha: false, motivo: 'jornada_folga', tipo: 'Jornada', noturno });
    }
    return resultado({
      trabalha: true,
      motivo: 'jornada',
      tipo: 'Jornada',
      periodos: jornadaOverride.periodos || [],
      cargaPrevistaMin: jornadaOverride.carga_diaria ? toMinutes(jornadaOverride.carga_diaria) : undefined,
      noturno,
    });
  }

  if (!horario) {
    return resultado({ trabalha: false, motivo: 'sem_horario', noturno });
  }
  if (horario.ativo === false) {
    return resultado({ trabalha: false, motivo: 'inativo', tipo: horario.tipo, noturno });
  }

  // 2) Eventual (jornada avulsa)
  if (horario.tipo === 'Eventual') {
    const ev = horario.eventual || {};
    const periodos = ev.periodos || [];
    const carga = ev.carga_diaria ? toMinutes(ev.carga_diaria) : undefined;
    return resultado({
      trabalha: true,
      motivo: 'eventual',
      tipo: 'Eventual',
      periodos,
      cargaPrevistaMin: carga,
      noturno,
    });
  }

  // 3) Escala Flexível / cíclica
  if (horario.tipo === 'Escala Flexível' || horario.tipo === 'Escala Flexivel') {
    const dias = horario.dias_escala || [];
    if (!dias.length) {
      return resultado({ trabalha: false, motivo: 'escala_sem_dias', tipo: horario.tipo, noturno });
    }
    const inicio = dataInicioEscala || horario.data_inicio_escala || '';
    if (!inicio) {
      return resultado({ trabalha: false, motivo: 'escala_sem_inicio', tipo: horario.tipo, noturno });
    }
    const diferenca = diffDays(inicio, data);
    if (diferenca < 0) {
      return resultado({ trabalha: false, motivo: 'escala_antes_inicio', tipo: horario.tipo, noturno });
    }
    const diaEscala = dias[diferenca % dias.length];
    if (!diaEscala || diaEscala.tipo !== 'Trabalho') {
      return resultado({ trabalha: false, motivo: 'escala_folga', tipo: horario.tipo, noturno });
    }
    const periodos = diaEscala.periodos || [];
    return resultado({
      trabalha: true,
      motivo: 'escala',
      tipo: horario.tipo,
      periodos,
      cargaPrevistaMin: cargaDoDia(diaEscala, normalizarPeriodos(periodos)),
      noturno,
    });
  }

  // 4) Escala Mensal
  if (horario.tipo === 'Escala Mensal' && horario.dias_mes) {
    const diaMes = parseDate(data).getDate();
    const item = Array.isArray(horario.dias_mes)
      ? horario.dias_mes.find((d) => Number(d.dia) === diaMes)
      : horario.dias_mes[String(diaMes).padStart(2, '0')] || horario.dias_mes[diaMes];
    if (!item || item.tipo === 'Folga') {
      return resultado({ trabalha: false, motivo: 'escala_mensal_folga', tipo: horario.tipo, noturno });
    }
    const periodos = item.periodos || [];
    return resultado({
      trabalha: true,
      motivo: 'escala_mensal',
      tipo: horario.tipo,
      periodos,
      cargaPrevistaMin: cargaDoDia(item, normalizarPeriodos(periodos)),
      noturno,
    });
  }

  // 5) Fixa / Turno Noturno (mapa por dia da semana)
  const dia = horario.dias?.[weekdayKey(data)];
  if (!dia || !dia.ativo) {
    return resultado({ trabalha: false, motivo: 'folga', tipo: horario.tipo, noturno });
  }
  if (feriado && !trabalhaFeriado) {
    return resultado({ trabalha: false, motivo: 'feriado', tipo: horario.tipo, noturno });
  }
  const periodos = dia.periodos || [];
  return resultado({
    trabalha: true,
    motivo: 'fixa',
    tipo: horario.tipo,
    periodos,
    cargaPrevistaMin: cargaDoDia(dia, normalizarPeriodos(periodos)),
    noturno,
  });
}
