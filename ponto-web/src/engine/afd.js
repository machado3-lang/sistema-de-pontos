/**
 * Parser e validador de AFD — Portarias 1510 e 671.
 *
 * Layout 671 (AFD versão 004):
 *  - tipo 3: REP-C / REP-A  (DH 24 + CPF 12 + CRC 4)
 *  - tipo 7: REP-P          (DH 24 + CPF 12 + DH gravação + coletor + on/off + hash)
 *  - tipo 1: cabeçalho, tipo 5: empregados, tipo 6: eventos, tipo 9: trailer
 *
 * Layout 1510:
 *  - tipo 3: DDMMYYYY + HHMM + PIS 12 + CRC 4
 */

import { toMinutes, formatMinutes } from './time.js';

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

function documento(valor) {
  const d = soDigitos(valor);
  return d ? d.slice(-11) : '';
}

function normalizarData(valor) {
  const texto = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  if (/^\d{8}$/.test(texto)) {
    return `${texto.slice(4, 8)}-${texto.slice(2, 4)}-${texto.slice(0, 2)}`;
  }
  return '';
}

function parseDH(valor) {
  // AAAA-MM-ddThh:mm:00ZZZZZ
  const texto = String(valor || '').trim();
  const data = texto.slice(0, 10);
  const hora = texto.slice(11, 19);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(hora)) return null;
  return { data, hora };
}

export function parseAFDLinhas(conteudo) {
  const texto = String(conteudo || '');
  const linhasArquivo = texto.split(/\r?\n/);
  const linhas = [];
  const funcionarios = [];
  const eventos = [];
  let cabecalho = null;
  let trailer = null;
  let ordemNsrQuebrada = false;
  let ultimoNsr = 0;

  for (let bruta of linhasArquivo) {
    const linha = String(bruta || '').replace(/\s+$/, '');
    if (linha.length < 10) continue;

    // Trailer do AFD (1510 e 671): "999999999" + contadores + "9".
    // O tipo "9" fica na última posição do registro, não na 10ª.
    const pareceTrailer = linha.startsWith('999999999')
      && (linha.length === 46 || linha.length === 64)
      && linha[linha.length - 1] === '9';
    if (pareceTrailer) {
      const is671Trailer = linha.length === 64;
      trailer = {
        nsr: '999999999',
        registros: {
          2: Number(linha.substring(9, 18)) || 0,
          3: Number(linha.substring(18, 27)) || 0,
          4: Number(linha.substring(27, 36)) || 0,
          5: Number(linha.substring(36, 45)) || 0,
          6: is671Trailer ? Number(linha.substring(45, 54)) || 0 : 0,
          7: is671Trailer ? Number(linha.substring(54, 63)) || 0 : 0,
        },
      };
      continue;
    }

    const nsrTexto = linha.substring(0, 9).trim();
    const nsr = Number(nsrTexto);
    const tipo = linha[9];

    if (Number.isFinite(nsr) && nsr > 0) {
      if (ultimoNsr && nsr <= ultimoNsr) ordemNsrQuebrada = true;
      ultimoNsr = nsr;
    }

    if (tipo === '1') {
      const is671Header = linha.length >= 250
        && /^\d{4}-\d{2}-\d{2}$/.test(linha.substring(206, 216));
      cabecalho = is671Header
        ? {
          nsr: nsrTexto,
          tpIdtEmpregador: linha[10] || '',
          idtEmpregador: soDigitos(linha.substring(11, 25)),
          razaoSocial: linha.substring(39, 189).trim(),
          dataInicio: normalizarData(linha.substring(206, 216)),
          dataFim: normalizarData(linha.substring(216, 226)),
          versao: linha.substring(250, 253).trim(),
          portaria: '671',
        }
        : {
          nsr: nsrTexto,
          tpIdtEmpregador: linha[10] || '',
          idtEmpregador: soDigitos(linha.substring(11, 25)),
          razaoSocial: linha.substring(37, 187).trim(),
          dataInicio: normalizarData(linha.substring(187, 195)),
          dataFim: normalizarData(linha.substring(195, 203)),
          versao: '',
          portaria: '1510',
        };
      continue;
    }

    if (tipo === '3') {
      const is671 = linha[14] === '-';
      let doc;
      let data;
      let hora;

      if (is671) {
        const dh = parseDH(linha.substring(10, 34));
        if (!dh) continue;
        data = dh.data;
        hora = dh.hora;
        doc = documento(linha.substring(34, 46));
      } else {
        const d = linha.substring(10, 12);
        const m = linha.substring(12, 14);
        const y = linha.substring(14, 18);
        const hh = linha.substring(18, 20);
        const mm = linha.substring(20, 22);
        if (!/^\d{2}$/.test(d) || !/^\d{2}$/.test(m) || !/^\d{4}$/.test(y)) continue;
        if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) continue;
        data = `${y}-${m}-${d}`;
        hora = `${hh}:${mm}:00`;
        doc = documento(linha.substring(22, 34));
      }

      if (!doc || !data) continue;
      linhas.push({
        nsr: nsrTexto,
        tipo,
        documento: doc,
        data,
        hora: hora.slice(0, 5),
        dataHora: `${data}T${hora}`,
        portaria: is671 ? '671' : '1510',
        coletor: '',
        online: true,
      });
      continue;
    }

    if (tipo === '7') {
      const dh = parseDH(linha.substring(10, 34));
      if (!dh) continue;
      const doc = documento(linha.substring(34, 46));
      if (!doc) continue;
      linhas.push({
        nsr: nsrTexto,
        tipo,
        documento: doc,
        data: dh.data,
        hora: dh.hora.slice(0, 5),
        dataHora: `${dh.data}T${dh.hora}`,
        portaria: '671',
        coletor: linha.substring(70, 72).trim(),
        online: linha[72] !== '1',
      });
      continue;
    }

    if (tipo === '5') {
      const is671Emp = linha.length >= 99 && ['I', 'A', 'E'].includes(linha[34]);
      const operacao = is671Emp ? (linha[34] || '') : (linha[22] || '');
      const cpf = is671Emp
        ? documento(linha.substring(35, 47))
        : documento(linha.substring(23, 35));
      const nome = is671Emp
        ? linha.substring(47, 99).trim()
        : linha.substring(35, 87).trim();
      if (!cpf) continue;
      funcionarios.push({
        nsr: nsrTexto,
        operacao,
        cpf,
        nome,
        portaria: is671Emp ? '671' : '1510',
      });
      continue;
    }

    if (tipo === '6') {
      const dh = parseDH(linha.substring(10, 34));
      if (!dh) continue;
      eventos.push({
        nsr: nsrTexto,
        dataHora: `${dh.data}T${dh.hora}`,
        codigo: linha.substring(34, 36).trim(),
      });
      continue;
    }

    if (tipo === '9') {
      trailer = {
        nsr: nsrTexto,
        registros: {
          2: Number(linha.substring(9, 18)) || 0,
          3: Number(linha.substring(18, 27)) || 0,
          4: Number(linha.substring(27, 36)) || 0,
          5: Number(linha.substring(36, 45)) || 0,
          6: Number(linha.substring(45, 54)) || 0,
          7: Number(linha.substring(54, 63)) || 0,
        },
      };
      continue;
    }
  }

  return {
    linhas,
    total: linhas.length,
    funcionarios,
    eventos,
    cabecalho,
    trailer,
    ordemNsrQuebrada,
  };
}

export function parseAFD(conteudo) {
  const { linhas, total, cabecalho, funcionarios } = parseAFDLinhas(conteudo);
  const porFuncionario = {};

  for (const l of linhas) {
    if (!porFuncionario[l.documento]) porFuncionario[l.documento] = {};
    if (!porFuncionario[l.documento][l.data]) porFuncionario[l.documento][l.data] = [];
    porFuncionario[l.documento][l.data].push(l.hora);
  }

  const dados = {};
  for (const [doc, dias] of Object.entries(porFuncionario)) {
    dados[doc] = {};
    for (const [dia, horas] of Object.entries(dias)) {
      horas.sort();
      let minutos = 0;
      for (let i = 0; i + 1 < horas.length; i += 2) {
        minutos += toMinutes(horas[i + 1]) - toMinutes(horas[i]);
      }
      const valido = horas.length % 2 === 0;
      dados[doc][dia] = {
        batidas: horas,
        total_minutos: minutos,
        total_formatado: valido ? formatMinutes(minutos) : 'Erro: Ímpar',
        valido,
      };
    }
  }

  const documentos = Object.keys(dados);
  const nomes = new Map((funcionarios || []).map((f) => [f.cpf, f.nome]));

  return {
    dados,
    linhas,
    totalBatidas: total,
    totalFuncionarios: documentos.length,
    cabecalho,
    funcionarios,
    nomes: Object.fromEntries(nomes),
  };
}

/**
 * Validação estrutural do AFD (não substitui a conferência do MTE).
 * Devolve erros/avisos e um resumo do arquivo.
 */
export function validarAFD(conteudo) {
  const info = parseAFDLinhas(conteudo);
  const erros = [];
  const avisos = [];

  if (!info.cabecalho) {
    erros.push('Cabeçalho (registro tipo 1) não encontrado.');
  }
  if (!info.trailer) {
    avisos.push('Trailer (registro tipo 9) não encontrado.');
  }
  if (info.ordemNsrQuebrada) {
    avisos.push('NSR fora de ordem crescente.');
  }

  const tipo3 = info.linhas.filter((l) => l.tipo === '3').length;
  const tipo7 = info.linhas.filter((l) => l.tipo === '7').length;

  if (info.trailer) {
    const esperado = info.trailer.registros[3] + info.trailer.registros[7];
    if (esperado !== tipo3 + tipo7) {
      avisos.push(
        `Trailer informa ${esperado} marcação(ões), mas o arquivo tem ${tipo3 + tipo7} (tipo 3: ${tipo3}, tipo 7: ${tipo7}).`
      );
    }
  }

  if (tipo3 + tipo7 === 0) {
    erros.push('Nenhuma marcação (tipo 3 ou 7) encontrada no arquivo.');
  }

  const documentos = new Set(info.linhas.map((l) => l.documento));
  if (documentos.size === 0) {
    erros.push('Nenhum documento (CPF/PIS) encontrado nas marcações.');
  }

  const datas = info.linhas.map((l) => l.data).sort();
  const periodo = datas.length ? { inicio: datas[0], fim: datas[datas.length - 1] } : null;

  return {
    ok: erros.length === 0,
    erros,
    avisos,
    resumo: {
      portaria: info.linhas[0]?.portaria || info.cabecalho?.portaria
        || (info.cabecalho?.versao === '004' ? '671' : '1510'),
      versao: info.cabecalho?.versao || '',
      empregador: info.cabecalho?.razaoSocial || '',
      documentoEmpregador: info.cabecalho?.idtEmpregador || '',
      periodo,
      marcacoes: tipo3 + tipo7,
      tipo3,
      tipo7,
      funcionarios: documentos.size,
      funcionariosCadastradosNoRep: info.funcionarios.length,
      eventos: info.eventos.length,
    },
  };
}
