/**
 * Banco de horas — créditos, débitos, ajustes, piso/teto e controle
 * diário ou mensal (estilo Secullum/RHiD).
 */

export function calcularBanco({ linhas = [], params = {}, saldoInicial = 0 } = {}) {
  const cfg = params?.banco_horas || {};
  if (!cfg.ativo) {
    return {
      ativo: false,
      saldoInicial,
      creditoMin: 0,
      debitoMin: 0,
      ajusteMin: 0,
      saldoFinal: Number(saldoInicial) || 0,
      porData: {},
    };
  }

  const limitePos = (Number(cfg.limite_positivo) || 0) * 60;
  const limiteNeg = (Number(cfg.limite_negativo) || 0) * 60;
  let saldo = Number(saldoInicial) || 0;
  let creditoMin = 0;
  let debitoMin = 0;
  let ajusteMin = 0;
  const porData = {};

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const extra = linha.extraMin || 0;
    const falta = linha.faltaMin || 0;
    const ajuste = linha.bancoAjusteMin || 0;

    let credito = cfg.incluir_extras === false ? 0 : extra;
    let debito = cfg.incluir_faltas === false ? 0 : falta;

    const multiplicador = Number(cfg.multiplicador) || 1;
    if (multiplicador > 0 && multiplicador !== 1) credito *= multiplicador;

    if (cfg.extras_para_banco === 'primeira_faixa') {
      credito = Math.min(credito, linha.extraFaixa1 || 0);
    } else if (cfg.extras_para_banco === 'ultima_faixa') {
      credito = Math.max(0, linha.extraFaixa2 || 0);
    }

    let novo = saldo + credito - debito + ajuste;

    const proximo = linhas[i + 1];
    const fechaAgora = cfg.controle_saldo === 'mensal'
      ? (!proximo || String(linha.data).slice(0, 7) !== String(proximo.data).slice(0, 7))
      : true;

    if (fechaAgora) {
      if (novo > limitePos) {
        credito -= (novo - limitePos);
        novo = limitePos;
      }
      if (novo < -limiteNeg) {
        debito += (-limiteNeg - novo);
        novo = -limiteNeg;
      }
    }

    saldo = novo;
    creditoMin += credito;
    debitoMin += debito;
    ajusteMin += ajuste;

    porData[linha.data] = { credito, debito, ajuste, saldo };
    linha.bancoCreditoMin = credito;
    linha.bancoDebitoMin = debito;
    linha.bancoAjusteMin = ajuste;
    linha.bancoSaldoMin = saldo;
    linha.bancoMin = credito - debito + ajuste;
  }

  return {
    ativo: true,
    saldoInicial,
    creditoMin,
    debitoMin,
    ajusteMin,
    saldoFinal: saldo,
    porData,
  };
}
