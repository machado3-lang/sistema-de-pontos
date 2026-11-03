/**
 * Cálculo de horas extras por tipo de dia e faixas.
 */

export function calcularExtras({ extraMin = 0, tipoDia = 'dias_uteis', params = {}, noturnoMin = 0 } = {}) {
  const cfg = params?.horas_extras || {};
  const diaCfg = cfg[tipoDia] || cfg.dias_uteis || {};

  let faixas;
  if (Array.isArray(diaCfg.faixas) && diaCfg.faixas.length) {
    faixas = diaCfg.faixas;
  } else if (Array.isArray(cfg.faixas) && cfg.faixas.length) {
    faixas = cfg.faixas;
  } else {
    const limite1 = diaCfg.faixa1_limite ?? 120;
    const pct1 = diaCfg.faixa1_pct ?? 50;
    const pct2 = diaCfg.faixa2_pct ?? 100;
    faixas = limite1 > 0
      ? [{ limite: limite1, pct: pct1 }, { limite: Infinity, pct: pct2 }]
      : [{ limite: Infinity, pct: pct1 }];
  }

  const totalExtra = Math.max(0, Math.round(extraMin || 0));
  const resultado = [];
  let restante = totalExtra;
  let acumulado = 0;

  for (const faixa of faixas) {
    if (restante <= 0) break;
    const limite = faixa.limite === Infinity || faixa.limite === null
      ? restante
      : Math.max(0, Number(faixa.limite) - acumulado);
    const minutos = Math.min(restante, limite);
    if (minutos > 0) {
      resultado.push({
        limite: faixa.limite,
        pct: Number(faixa.pct) || 0,
        minutos,
      });
    }
    restante -= minutos;
    acumulado += minutos;
  }

  const totalClassificado = resultado.reduce((acc, f) => acc + f.minutos, 0);
  const percentualMedio = totalClassificado > 0
    ? Math.round(resultado.reduce((acc, f) => acc + f.minutos * f.pct, 0) / totalClassificado)
    : 0;

  const extraNoturnoMin = cfg.separar_noturno === false
    ? 0
    : Math.min(totalClassificado, Math.max(0, Math.round(noturnoMin || 0)));
  const extraDiurnoMin = Math.max(0, totalClassificado - extraNoturnoMin);

  return {
    extraMin: totalClassificado,
    faixas: resultado,
    percentualMedio,
    extraFaixa1: resultado[0]?.minutos || 0,
    extraFaixa2: resultado.slice(1).reduce((acc, f) => acc + f.minutos, 0),
    faixa1Pct: resultado[0]?.pct || 0,
    faixa2Pct: resultado[1]?.pct || 0,
    extraDiurnoMin,
    extraNoturnoMin,
  };
}

/**
 * Acumula extras de um período e aplica as faixas sobre o total (modo mensal).
 * Retorna um mapa data -> minutos classificados, distribuindo o total.
 */
export function distribuirExtrasAcumuladas(linhas, params = {}) {
  const cfg = params?.horas_extras || {};
  if (cfg.acumulo !== 'mensal') return null;
  const total = linhas.reduce((acc, l) => acc + (l.extraMin || 0), 0);
  if (total <= 0) return null;
  const classificadas = calcularExtras({ extraMin: total, tipoDia: 'dias_uteis', params });
  // Distribui proporcionalmente ao extra de cada dia.
  const mapa = {};
  for (const l of linhas) {
    mapa[l.data] = total > 0 ? (l.extraMin || 0) / total * classificadas.extraMin : 0;
  }
  return { total, classificadas, mapa };
}
