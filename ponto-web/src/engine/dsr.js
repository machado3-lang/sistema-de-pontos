/**
 * DSR — Descanso Semanal Remunerado.
 * Média de horas extras da semana/mês aplicada aos domingos e feriados,
 * com desconto opcional por faltas (estilo Secullum/RHiD).
 */

import { weekStart, monthStart, isSunday } from './time.js';

export function calcularDSR({ linhas = [], params = {} } = {}) {
  const cfg = params?.dsr || {};
  const grupos = {};

  for (const linha of linhas) {
    const chave = cfg.modulo_calc_dsr === 'mensal' ? monthStart(linha.data) : weekStart(linha.data);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(linha);
  }

  let dsrTotal = 0;
  const porData = {};
  const detalhes = [];

  for (const [chave, dias] of Object.entries(grupos)) {
    const diasUteis = dias.filter((l) => l.tipoDia === 'dias_uteis').length;
    const descansos = dias.filter((l) => {
      if (l.tipoDia !== 'domingos_feriados') return false;
      if (cfg.inclui_feriados === false) return isSunday(l.data);
      return true;
    });

    const totalHE = dias.reduce((acc, l) => acc + (l.extraMin || 0), 0);
    const diasComFalta = dias.filter((l) => (l.faltaMin || 0) > 0).length;
    const mediaHE = diasUteis > 0 ? totalHE / diasUteis : 0;
    let valor = mediaHE * descansos.length * ((cfg.percentual_sobre_he ?? 100) / 100);

    if (cfg.descontar_faltas !== false && diasComFalta > 0) {
      const limite = cfg.faltas_para_perder_dsr
        ?? params?.faltas_atrasos?.faltas_para_perder_dsr
        ?? 5;
      if (diasComFalta >= limite) valor = 0;
      else valor *= Math.max(0, 1 - diasComFalta / Math.max(1, limite));
    }

    dsrTotal += valor;
    detalhes.push({ grupo: chave, diasUteis, descansos: descansos.length, totalHE, mediaHE, diasComFalta, valor });

    if (descansos.length > 0) {
      const porDia = valor / descansos.length;
      for (const l of descansos) porData[l.data] = (porData[l.data] || 0) + porDia;
    } else {
      const ultimo = dias[dias.length - 1];
      if (ultimo) porData[ultimo.data] = (porData[ultimo.data] || 0) + valor;
    }
  }

  return { dsrMin: dsrTotal, porData, detalhes };
}
