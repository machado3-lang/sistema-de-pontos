/**
 * Tolerâncias de cálculo (CLT Art. 58, modo simples e sem tolerância).
 */

import { formatMinutes } from './time.js';
import { emparelharBatidas, somarPares } from './punch.js';

function arredondar(batidas, passo) {
  if (!passo || passo <= 0) return batidas;
  return batidas.map((b) => ({ ...b, minutes: Math.round(b.minutes / passo) * passo }));
}

function diffSimples(trabalhadoBruto, previstoMin, cfg, modo) {
  const diff = trabalhadoBruto - previstoMin;
  const tolEntrada = cfg.tolerancia_entrada_minutos || 0;
  const tolSaida = cfg.tolerancia_saida_minutos || 0;
  let toleranciaMin = 0;
  let extraMin = 0;
  let faltaMin = 0;
  if (diff > 0) {
    toleranciaMin = Math.min(tolSaida, diff);
    extraMin = diff - toleranciaMin;
  } else if (diff < 0) {
    toleranciaMin = Math.min(tolEntrada, -diff);
    faltaMin = -diff - toleranciaMin;
  }
  return {
    extraMin,
    faltaMin,
    toleranciaMin,
    detalhes: [{ tipo: modo, diff, tolEntrada, tolSaida, toleranciaMin, extraMin, faltaMin }],
  };
}

/**
 * @param {object} input
 * @param {Array} input.batidas Batidas normalizadas
 * @param {number} input.previstoMin Carga prevista do dia
 * @param {Array} [input.periodos] Períodos previstos normalizados
 * @param {object} [input.params] Parâmetros normalizados
 * @param {string} [input.tipoDia]
 * @param {string} [input.data]
 */
export function aplicarTolerancia({
  batidas = [],
  previstoMin = 0,
  periodos = [],
  params = {},
}) {
  const cfg = params?.clt_art58 || {};
  const modo = cfg.metodo || 'clt_completo';
  const passo = params?.geral?.arredondamento_minutos || 0;
  const lista = arredondar(batidas, passo);
  const pares = emparelharBatidas(lista);
  const trabalhadoBruto = somarPares(pares);

  if (modo === 'nenhuma' || modo === 'none') {
    const r = diffSimples(trabalhadoBruto, previstoMin, { tolerancia_entrada_minutos: 0, tolerancia_saida_minutos: 0 }, 'nenhuma');
    return { trabalhadoBruto, trabalhadoMin: trabalhadoBruto, ...r, pares };
  }

  if (modo === 'simples' || !periodos.length) {
    const r = diffSimples(trabalhadoBruto, previstoMin, cfg, 'simples');
    return { trabalhadoBruto, trabalhadoMin: trabalhadoBruto, ...r, pares };
  }

  // CLT Art. 58: 5 min por batida e 10 min diários.
  const limiteBatida = cfg.limite_por_batida_minutos ?? 5;
  const limiteDiario = cfg.limite_diario_minutos ?? 10;
  const janela = cfg.janela_minutos ?? 240;
  const esperados = (periodos || [])
    .flatMap((p) => [p.entradaMin, p.saidaMin])
    .sort((a, b) => a - b);

  // Se houver batida ímpar, a última não entra no cálculo de tolerância.
  const atuaisBase = lista.length % 2 === 0 ? lista : lista.slice(0, -1);
  const atuais = atuaisBase.map((b) => b.minutes).sort((a, b) => a - b);

  const usados = new Set();
  const detalhes = [];
  let extraPendente = 0;
  let faltaPendente = 0;
  let toleranciaMin = 0;

  for (let i = 0; i < esperados.length; i++) {
    const esperado = esperados[i];
    const tipoBatida = i % 2 === 0 ? 'entrada' : 'saida';
    let achado = -1;
    let menorDiff = Infinity;
    for (let j = 0; j < atuais.length; j++) {
      if (usados.has(j)) continue;
      const diff = Math.abs(atuais[j] - esperado);
      if (diff < menorDiff) {
        menorDiff = diff;
        achado = j;
      }
    }

    if (achado >= 0 && menorDiff <= janela) {
      usados.add(achado);
      const atual = atuais[achado];
      const diff = atual - esperado;
      const abs = Math.abs(diff);
      let tipo;
      if (tipoBatida === 'entrada') tipo = diff < 0 ? 'extra' : 'falta';
      else tipo = diff > 0 ? 'extra' : 'falta';

      detalhes.push({ esperado, atual, tipo, minutos: abs, auto: abs > limiteBatida });
      if (abs <= limiteBatida) {
        toleranciaMin += abs;
      } else if (tipo === 'extra') {
        extraPendente += abs;
      } else {
        faltaPendente += abs;
      }
    } else {
      const periodoMin = tipoBatida === 'entrada' && i + 1 < esperados.length
        ? esperados[i + 1] - esperado
        : (tipoBatida === 'saida' && i - 1 >= 0 ? esperado - esperados[i - 1] : limiteDiario * 6);
      detalhes.push({ esperado, atual: null, tipo: 'falta', minutos: periodoMin, auto: true, ausente: true });
      faltaPendente += periodoMin;
    }
  }

  for (let j = 0; j < atuais.length; j++) {
    if (!usados.has(j)) {
      detalhes.push({ esperado: null, atual: atuais[j], tipo: 'extra', minutos: limiteDiario * 6, auto: true, extra: true });
      extraPendente += limiteDiario * 6;
    }
  }

  let extraMin = 0;
  let faltaMin = 0;
  if (extraPendente > limiteDiario) extraMin = extraPendente;
  else toleranciaMin += extraPendente;
  if (faltaPendente > limiteDiario) faltaMin = faltaPendente;
  else toleranciaMin += faltaPendente;

  return {
    trabalhadoBruto,
    trabalhadoMin: trabalhadoBruto,
    extraMin,
    faltaMin,
    toleranciaMin,
    detalhes,
    pares,
    resumo: {
      modo: 'clt_completo',
      limiteBatida,
      limiteDiario,
      extraPendente,
      faltaPendente,
      toleranciaMin: formatMinutes(toleranciaMin),
    },
  };
}
