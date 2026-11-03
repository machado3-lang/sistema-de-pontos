/**
 * Faltas, atrasos e justificativas.
 */

export function calcularFaltas({
  previstoMin = 0,
  faltaBase = 0,
  justificativa = '',
  params = {},
  temBatidas = false,
} = {}) {
  const cfg = params?.faltas_atrasos || {};
  let falta = Math.max(0, Math.round(faltaBase || 0));
  if (previstoMin > 0) falta = Math.min(falta, previstoMin);

  if (cfg.calcular_falta_somente_dia_inteiro && temBatidas && falta < previstoMin) {
    falta = 0;
  }

  if (justificativa) {
    return { faltaMin: 0, faltaJustificadaMin: falta, atrasoMin: falta, justificada: true };
  }
  return { faltaMin: falta, faltaJustificadaMin: 0, atrasoMin: falta, justificada: false };
}
