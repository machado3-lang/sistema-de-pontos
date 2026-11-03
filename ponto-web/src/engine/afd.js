/**
 * Parser de arquivos AFD (Portarias 1510/PIS e 671/CPF).
 */

import { toMinutes, formatMinutes } from './time.js';

export function parseAFDLinhas(conteudo) {
  const texto = String(conteudo || '');
  const linhasArquivo = texto.split(/\r?\n/);
  const linhas = [];
  let total = 0;

  for (let linha of linhasArquivo) {
    linha = linha.trim();
    if (linha.length <= 9) continue;
    if (linha[9] !== '3') continue; // tipo 3 = batida

    const nsr = linha.substring(0, 9);
    const is671 = linha.length > 14 && linha[14] === '-';
    let documento;
    let data;
    let hora;

    try {
      if (is671) {
        // Portaria 671: YYYY-MM-DDTHH:MM:SS
        const dataHora = linha.substring(10, 29);
        data = dataHora.slice(0, 10);
        hora = dataHora.slice(11, 19);
        documento = linha.substring(34, 45).replace(/\D/g, '');
      } else {
        // Portaria 1510: DDMMYYYYHHMM + PIS(12)
        const d = linha.substring(10, 12);
        const m = linha.substring(12, 14);
        const y = linha.substring(14, 18);
        const hh = linha.substring(18, 20);
        const mm = linha.substring(20, 22);
        data = `${y}-${m}-${d}`;
        hora = `${hh}:${mm}:00`;
        documento = linha.substring(22, 34).replace(/\D/g, '');
        if (documento.length === 12 && documento.startsWith('0')) documento = documento.slice(1);
      }
    } catch {
      continue;
    }

    if (!documento || !data) continue;
    linhas.push({
      nsr,
      documento,
      data,
      hora: hora.slice(0, 5),
      dataHora: `${data}T${hora}`,
      portaria: is671 ? '671' : '1510',
    });
    total++;
  }

  return { linhas, total };
}

export function parseAFD(conteudo) {
  const { linhas, total } = parseAFDLinhas(conteudo);
  const porFuncionario = {};

  for (const l of linhas) {
    if (!porFuncionario[l.documento]) porFuncionario[l.documento] = {};
    if (!porFuncionario[l.documento][l.data]) porFuncionario[l.documento][l.data] = [];
    porFuncionario[l.documento][l.data].push(l.hora);
  }

  const dados = {};
  for (const [documento, dias] of Object.entries(porFuncionario)) {
    dados[documento] = {};
    for (const [dia, horas] of Object.entries(dias)) {
      horas.sort();
      let minutos = 0;
      for (let i = 0; i + 1 < horas.length; i += 2) {
        minutos += toMinutes(horas[i + 1]) - toMinutes(horas[i]);
      }
      const valido = horas.length % 2 === 0;
      dados[documento][dia] = {
        batidas: horas,
        total_minutos: minutos,
        total_formatado: valido ? formatMinutes(minutos) : 'Erro: Ímpar',
        valido,
      };
    }
  }

  return {
    dados,
    linhas,
    totalBatidas: total,
    totalFuncionarios: Object.keys(dados).length,
  };
}
