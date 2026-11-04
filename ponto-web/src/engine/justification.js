/**
 * Aplicação das justificativas ao resultado do dia (modelo RHiD/Secullum).
 *
 * Os seis comportamentos suportados:
 *  - dia_inteiro: abona a falta do dia (quando `abona_falta`);
 *  - periodo:    abona os minutos do intervalo informado;
 *  - horas:      abona uma quantidade de horas/minutos do débito;
 *  - ajuste:     soma/subtrai minutos do saldo (pode ser negativo);
 *  - banco:      reloca o extra/falta do dia para o banco de horas;
 *  - dsr:        protege o dia no cálculo do DSR.
 *
 * O módulo não conhece a UI nem o banco: recebe o lançamento já com os flags
 * do tipo (a API devolve `tipo_comportamento`, `abona_falta`, etc.).
 */

import { toMinutes } from './time.js';

function minutosDoIntervalo(inicio, fim) {
  if (!inicio || !fim) return 0;
  const i = toMinutes(inicio);
  const f = toMinutes(fim);
  return f > i ? f - i : 0;
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * @param {object} opts
 * @param {Array}  opts.justificativas  lançamentos do dia (com flags do tipo)
 * @param {number} opts.faltaMin        débito do dia antes das justificativas
 * @param {number} opts.extraMin        extra do dia antes das justificativas
 * @param {number} opts.previstoMin     carga prevista do dia
 */
export function aplicarJustificativas({
  justificativas = [],
  faltaMin = 0,
  extraMin = 0,
  previstoMin = 0,
} = {}) {
  let falta = Math.max(0, numero(faltaMin));
  let extra = Math.max(0, numero(extraMin));

  let abonoFaltaMin = 0;
  let ajusteMin = 0;
  let bancoMin = 0;
  let protegeDSR = false;
  let abonaDiaInteiro = false;

  const itens = [];

  for (const j of justificativas || []) {
    const tipo = String(j.tipo_comportamento || j.tipo || '').toLowerCase();
    const abonaFalta = j.abona_falta === true;
    const abonaHoras = j.abona_horas === true;
    const protege = j.protege_dsr === true;
    const geraBanco = j.gera_banco === true;

    let efeito = 'registro';
    let abonoMin = 0;
    let ajusteItemMin = 0;
    let bancoItemMin = 0;

    if (tipo === 'dia_inteiro' && abonaFalta) {
      abonoMin = falta;
      falta = 0;
      abonoFaltaMin += abonoMin;
      abonaDiaInteiro = true;
      efeito = 'abona_dia';
    } else if (tipo === 'periodo') {
      const minutos = minutosDoIntervalo(j.inicio, j.fim);
      abonoMin = Math.min(minutos, falta);
      falta -= abonoMin;
      abonoFaltaMin += abonoMin;
      efeito = abonoMin > 0 ? 'abona_periodo' : 'periodo_sem_debito';
    } else if (tipo === 'horas' && (abonaHoras || abonaFalta)) {
      const minutos = Math.max(0, numero(j.minutos));
      abonoMin = Math.min(minutos, falta);
      falta -= abonoMin;
      abonoFaltaMin += abonoMin;
      efeito = abonoMin > 0 ? 'abona_horas' : 'horas_sem_debito';
    } else if (tipo === 'ajuste') {
      ajusteItemMin = numero(j.minutos);
      ajusteMin += ajusteItemMin;
      efeito = 'ajusta_saldo';
    } else if (tipo === 'banco' && geraBanco) {
      if (extra > 0) {
        bancoItemMin = extra;
        extra = 0;
        efeito = 'credita_banco';
      } else if (falta > 0) {
        bancoItemMin = -falta;
        falta = 0;
        efeito = 'debita_banco';
      } else {
        efeito = 'banco_sem_saldo';
      }
      bancoMin += bancoItemMin;
    }

    if (protege) protegeDSR = true;

    itens.push({
      id: j.id,
      tipo,
      tipo_nome: j.tipo_nome || j.nome || '',
      texto: j.texto || '',
      inicio: j.inicio || '',
      fim: j.fim || '',
      minutos: j.minutos ?? null,
      efeito,
      abonoMin,
      ajusteMin: ajusteItemMin,
      bancoMin: bancoItemMin,
    });
  }

  return {
    faltaMin: falta,
    extraMin: extra,
    abonoFaltaMin,
    ajusteMin,
    bancoMin,
    protegeDSR,
    abonaDiaInteiro,
    previstoMin: numero(previstoMin),
    itens,
    temJustificativa: (justificativas || []).length > 0,
  };
}
