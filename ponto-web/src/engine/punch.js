/**
 * Normalização e emparelhamento de batidas.
 * Origens: original (REP/AFD), manual, pré-assinalada.
 */

import { toMinutes } from './time.js';

function horaDaMarcacao(m) {
  if (m.hora) return String(m.hora).slice(0, 5);
  if (m.time) return String(m.time).slice(0, 5);
  if (m.data_hora) return String(m.data_hora).slice(11, 16);
  return '';
}

/**
 * @param {object} input
 * @param {Array} input.marcacoes Marcações originais
 * @param {string[]} [input.descartadas] Horários desconsiderados (HH:MM)
 * @param {object} [input.correcao] { batidas_manuais: string[] }
 * @param {string[]} [input.preAssinaladas] Horários pré-assinalados
 */
export function normalizarMarcacoes({
  marcacoes = [],
  descartadas = [],
  correcao = {},
  preAssinaladas = [],
} = {}) {
  const descartadasSet = new Set((descartadas || []).map((t) => String(t).slice(0, 5)));
  const vistos = new Set();
  const lista = [];

  const adicionar = (time, origem, extra = {}) => {
    const t = String(time || '').slice(0, 5);
    if (!t) return;
    if (descartadasSet.has(t)) return;
    const minutes = extra.__minutosAbs !== undefined ? extra.__minutosAbs : toMinutes(t);
    const chave = `${minutes}:${origem === 'original' ? 'o' : origem}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    lista.push({
      time: t,
      minutes,
      origem,
      nsr: extra.nsr ?? null,
      equip: extra.equip || (origem === 'manual' ? 'Manual' : origem === 'pre-assinalada' ? 'Pré-assinalada' : 'REP'),
      ...extra,
    });
  };

  for (const m of marcacoes || []) {
    const time = horaDaMarcacao(m);
    if (!time) continue;
    adicionar(time, 'original', {
      nsr: m.nsr ?? m.id ?? null,
      equip: m.equip_nome || m.equip || 'REP',
      __minutosAbs: m.__minutosAbs,
    });
  }

  for (const t of correcao?.batidas_manuais || []) {
    adicionar(t, 'manual');
  }

  for (const t of preAssinaladas || []) {
    adicionar(t, 'pre-assinalada');
  }

  lista.sort((a, b) => a.minutes - b.minutes);
  return lista;
}

export function emparelharBatidas(batidas = []) {
  const pares = [];
  for (let i = 0; i < batidas.length; i += 2) {
    const entrada = batidas[i];
    const saida = batidas[i + 1] || null;
    pares.push({ entrada, saida, completo: !!saida });
  }
  return pares;
}

export function somarPares(pares = []) {
  return (pares || []).reduce((acc, p) => {
    if (!p.saida) return acc;
    return acc + (p.saida.minutes - p.entrada.minutes);
  }, 0);
}

export function contarParesCompletos(pares = []) {
  return (pares || []).filter((p) => p.completo).length;
}
