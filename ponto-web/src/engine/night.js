/**
 * Cálculo de horas noturnas (janela 22:00–05:00, hora reduzida 52:30).
 */

import { toMinutes, nightClockMinutes } from './time.js';

/**
 * @param {object} input
 * @param {Array} [input.pares] Pares de batidas reais
 * @param {Array} [input.periodos] Períodos previstos
 * @param {object} [input.noturno] Configuração normalizada
 */
export function calcularNoturno({ pares = [], periodos = [], noturno = {} } = {}) {
  if (noturno?.ativo === false) {
    return { relogioMin: 0, reduzidoMin: 0, fator: 1, adicionalPct: 0, ativo: false };
  }

  const janelaInicio = noturno?.inicio || '22:00';
  const janelaFim = noturno?.fim || '05:00';
  const jIni = toMinutes(janelaInicio);
  const jFim = toMinutes(janelaFim);

  const janelas = [];
  if (pares.length) {
    for (const p of pares) {
      if (p.saida) janelas.push([p.entrada.minutes, p.saida.minutes]);
    }
  } else {
    for (const p of periodos || []) {
      janelas.push([p.entradaMin, p.saidaMin]);
    }
  }

  let relogioMin = 0;
  for (const [ini, fim] of janelas) {
    relogioMin += nightClockMinutes(ini, fim, jIni, jFim);
  }

  const horaReduzida = (noturno?.horaReduzidaMin ?? 52) + (noturno?.horaReduzidaSeg ?? 30) / 60;
  const fator = horaReduzida > 0 ? 60 / horaReduzida : 1;

  return {
    relogioMin,
    reduzidoMin: relogioMin * fator,
    fator,
    adicionalPct: noturno?.percentual ?? 20,
    ativo: true,
    janela: { inicio: janelaInicio, fim: janelaFim },
  };
}
