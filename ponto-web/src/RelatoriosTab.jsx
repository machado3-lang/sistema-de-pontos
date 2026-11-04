import { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText, Download, Users, Printer, Eye, EyeOff, Shield } from 'lucide-react';
import { carregarParametrosMap, formatMinutos, calcMinutos } from './cadastros/parametrosUtils';
import { calcularPeriodo } from './engine/index.js';
import { api } from './api';
import AuditoriaSection from './components/AuditoriaSection';
import {
  carregarHorarios,
  carregarParametros,
  carregarDepartamentos,
  carregarCargos,
  carregarMarcacoes,
  carregarApuracaoExtras,
  carregarFeriados,
  feriadosParaFuncionario,
  lerCache,
} from './data/pontoData';

function carregarLocal(key, padrao) {
  try { return JSON.parse(localStorage.getItem(key)) || padrao; } catch { return padrao; }
}

function formatBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const COLUNAS = [
  { key: 'data', label: 'Data', padrão: true },
  { key: 'dia', label: 'Dia', padrão: true },
  { key: 'entrada', label: 'Entrada', padrão: true },
  { key: 'saida', label: 'Saída', padrão: true },
  { key: 'previsto', label: 'Prev.', padrão: true },
  { key: 'trabalhado', label: 'Trab.', padrão: true },
  { key: 'saldo', label: 'Saldo', padrão: true },
  { key: 'he', label: 'Hora Extra', padrão: true },
  { key: 'falta', label: 'Falta', padrão: false },
  { key: 'noturno', label: 'Noturno', padrão: true },
  { key: 'dsr', label: 'DSR', padrão: false },
  { key: 'banco', label: 'Banco Horas', padrão: false },
  { key: 'tolerancia', label: 'Tolerância', padrão: false },
  { key: 'obs', label: 'Obs', padrão: true },
];

function downloadTxt(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function gerarLinhasFunc(doc, func, marcacoes, horarios, dataInicio, dataFim, correcoes, diasDescartados, parametrosMap, marcacoesDescartadas, feriados = []) {
  const horario = horarios.find(h => String(h.id) === String(func.horario_id));
  const params = parametrosMap[String(func.parametro_id)] || parametrosMap['_default'] || {};
  const feriadosFunc = feriadosParaFuncionario(feriados, func, horario);
  const cpfFunc = String(func.cpf || '').replace(/\D/g, '');
  const pisFunc = String(func.pis || '').replace(/\D/g, '');
  const minhas = marcacoes.filter(m => {
    const cpf = String(m.cpf || '').replace(/\D/g, '');
    const pis = String(m.pis || '').replace(/\D/g, '');
    return (cpfFunc && cpf === cpfFunc)
      || (pisFunc && pis === pisFunc)
      || (cpf && cpf === doc)
      || (pis && pis === doc);
  });

  const resultado = calcularPeriodo({
    funcionario: func,
    doc,
    marcacoes: minhas,
    horario,
    params,
    dataInicio,
    dataFim,
    correcoes,
    diasDescartados,
    marcacoesDescartadas,
    feriados: feriadosFunc,
  });

  const linhas = resultado.linhas
    .filter(l => l.previstoMin > 0 || l.batidas.length > 0 || l.descartado)
    .map(l => ({
      dateStr: l.data,
      diaSemana: l.diaSemana,
      pares: (l.pares || []).map(p => ({
        entrada: p.entrada?.time || '',
        saida: p.saida?.time || null,
      })),
      carga: l.previstoMin,
      trabalhado: l.trabalhadoMin,
      descartado: l.descartado,
      descartado_motivo: l.descartado_motivo,
      extraMin: l.extraMin,
      debitoMin: l.debitoMin,
      tipoHora: l.tipoHora,
      percentualHE: l.percentualHE,
      extraFaixa1: l.extraFaixa1,
      extraFaixa2: l.extraFaixa2,
      faixa1Pct: l.faixa1Pct,
      faixa2Pct: l.faixa2Pct,
      horasNoturnas: l.horasNoturnas,
      adicionalNoturno: l.adicionalNoturno,
      toleranciaAplicada: l.toleranciaMin,
      dsrMin: l.dsrMin,
      bancoMin: l.bancoMin,
    }));

  return {
    linhas,
    totalTrab: resultado.totais.totalTrab,
    totalEsp: resultado.totais.totalEsp,
    totalHE: resultado.totais.totalHE,
    totalFalta: resultado.totais.totalFalta,
    totalNot: resultado.totais.totalNot,
    totalDSR: resultado.totais.totalDSR,
    saldo: resultado.totais.saldo,
  };
}

export default function RelatoriosTab({ usuario }) {
  const [subTab, setSubTab] = useState('espelho');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState(() => { const d = new Date(); d.setDate(1); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); });
  const [dataFim, setDataFim] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); });
  const [selectedFunc, setSelectedFunc] = useState(null);
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [visaoTodos, setVisaoTodos] = useState(false);
  const [colunasVisiveis, setColunasVisiveis] = useState(() => COLUNAS.filter(c => c.padrão).map(c => c.key));
  const [mostrarConfigCol, setMostrarConfigCol] = useState(false);
  const [funcionarios, setFuncionarios] = useState([]);
  const [empresas, setEmpresas] = useState(() => {
    const locais = carregarLocal('ponto_empresas', []);
    return locais;
  });
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');

  useEffect(() => {
    api.funcionarios.list().then((data) => {
      if (Array.isArray(data)) {
        setFuncionarios(data.map((f) => ({
          ...f,
          departamento: f.departamento_id || '',
          cargo: f.cargo_id || '',
          ativo: f.ativo !== false,
        })));
      }
    }).catch(() => {
      // Sem conexão com o servidor: mantém os dados locais.
    });
    api.empresas.list().then((data) => {
      if (Array.isArray(data)) setEmpresas(data);
    }).catch(() => {
      // Sem conexão com o servidor: mantém os dados locais.
    });
  }, []);

  useEffect(() => {
    if (!selectedEmpresaId && empresas.length > 0) {
      setSelectedEmpresaId(String(empresas[0].id));
    }
  }, [empresas, selectedEmpresaId]);

  useEffect(() => {
    setSelectedFunc(null);
    setVisaoTodos(false);
  }, [selectedEmpresaId]);

  const [marcacoes, setMarcacoes] = useState(() => carregarLocal('ponto_marcacoes', []));
  const syncMarcacoes = useCallback(() => {
    carregarMarcacoes()
      .then((data) => setMarcacoes(Array.isArray(data) ? data : []))
      .catch(() => {
        setMarcacoes(carregarLocal('ponto_marcacoes', []));
      });
  }, []);
  useEffect(() => { syncMarcacoes(); }, [syncMarcacoes]);
  useEffect(() => {
    const onFocus = () => syncMarcacoes();
    const onStorage = (e) => { if (e.key === 'ponto_marcacoes') syncMarcacoes(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [syncMarcacoes]);
  const [horarios, setHorarios] = useState(() => carregarLocal('ponto_horarios', []));
  const [correcoes, setCorrecoes] = useState(() => carregarLocal('ponto_correcoes', {}));
  const [diasDescartados, setDiasDescartados] = useState(() => carregarLocal('ponto_dias_descartados', {}));
  const [marcacoesDescartadas, setMarcacoesDescartadas] = useState(() => carregarLocal('ponto_marcacoes_descartadas', {}));
  const [parametrosMap, setParametrosMap] = useState(() => carregarParametrosMap());
  const [departamentos, setDepartamentos] = useState(() => carregarLocal('ponto_departamentos', []));
  const [cargos, setCargos] = useState(() => carregarLocal('ponto_cargos', []));
  const [feriados, setFeriados] = useState(() => lerCache('feriados', []));

  useEffect(() => {
    carregarHorarios().then((lista) => { if (Array.isArray(lista)) setHorarios(lista); }).catch(() => {});
    carregarParametros().then(() => setParametrosMap(carregarParametrosMap())).catch(() => {});
    carregarDepartamentos().then((lista) => { if (Array.isArray(lista)) setDepartamentos(lista); }).catch(() => {});
    carregarCargos().then((lista) => { if (Array.isArray(lista)) setCargos(lista); }).catch(() => {});
    carregarFeriados().then((lista) => { if (Array.isArray(lista)) setFeriados(lista); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (funcionarios.length === 0) return;
    let ativo = true;
    carregarApuracaoExtras(funcionarios)
      .then((extras) => {
        if (!ativo) return;
        setCorrecoes(extras.correcoes);
        setDiasDescartados(extras.diasDescartados);
        setMarcacoesDescartadas(extras.marcacoesDescartadas);
      })
      .catch(() => {
        // Sem conexão: mantém o cache local.
      });
    return () => { ativo = false; };
  }, [funcionarios]);

  const funcMap = useMemo(() => {
    const map = {};
    funcionarios.forEach(f => {
      const cpf = (f.cpf || '').replace(/\D/g, '');
      const pis = (f.pis || '').replace(/\D/g, '');
      if (cpf) map[cpf] = f;
      if (pis) map[pis] = f;
    });
    return map;
  }, [funcionarios]);

  const empFilter = (func) => {
    if (!selectedEmpresaId) return true;
    return String(func.empresa_id || '') === String(selectedEmpresaId);
  };

  const empresaFuncionarios = useMemo(() => {
    if (!selectedEmpresaId) return [];
    const vistos = new Set();
    return Object.entries(funcMap)
      .filter(([, func]) => {
        if (vistos.has(func.id)) return false;
        vistos.add(func.id);
        return true;
      })
      .filter(([, func]) => empFilter(func))
      .filter(([doc, func]) => {
        if (!searchTerm) return true;
        const nome = func.nome || '';
        return nome.toLowerCase().includes(searchTerm.toLowerCase()) || doc.includes(searchTerm);
      })
      .filter(([, func]) => !filtroDepartamento || String(func.departamento) === String(filtroDepartamento))
      .filter(([, func]) => !filtroCargo || String(func.cargo) === String(filtroCargo))
      .map(([doc, func]) => ({ doc, func, nome: func.nome || `Func. ${doc.slice(0, 4)}...` }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcMap, selectedEmpresaId, searchTerm, filtroDepartamento, filtroCargo]);

  const funcComMarcacoes = useMemo(() => {
    const docs = new Set();
    marcacoes.forEach(m => {
      const pis = String(m.pis || '').replace(/\D/g, '');
      const cpf = String(m.cpf || '').replace(/\D/g, '');
      const doc = cpf || pis;
      if (doc) docs.add(doc);
    });
    const lista = [];
    const vistos = new Set();
    for (const doc of docs) {
      const func = funcMap[doc];
      if (!func || vistos.has(func.id)) continue;
      if (!empFilter(func)) continue;
      vistos.add(func.id);
      const nome = func.nome || `Func. ${doc.slice(0, 4)}...`;
      const docCanonico = String(func.cpf || '').replace(/\D/g, '') || doc;
      lista.push({ doc: docCanonico, func, nome });
    }
    lista.sort((a, b) => a.nome.localeCompare(b.nome));
    return lista;
  }, [marcacoes, funcMap, selectedEmpresaId]);

  const dadosFunc = useMemo(() => {
    if (!visaoTodos && selectedFunc) {
      const { doc, func } = selectedFunc;
      return gerarLinhasFunc(doc, func, marcacoes, horarios, dataInicio, dataFim, correcoes, diasDescartados, parametrosMap, marcacoesDescartadas, feriados);
    }
    if (visaoTodos) {
      const todos = funcComMarcacoes.map(f => {
        const dados = gerarLinhasFunc(f.doc, f.func, marcacoes, horarios, dataInicio, dataFim, correcoes, diasDescartados, parametrosMap, marcacoesDescartadas, feriados);
        return { ...f, ...dados };
      });
      const agg = todos.reduce((acc, t) => {
        acc.totalTrab += t.totalTrab; acc.totalEsp += t.totalEsp;
        acc.totalHE += t.totalHE; acc.totalFalta += t.totalFalta;
        acc.totalNot += t.totalNot;
        return acc;
      }, { totalTrab: 0, totalEsp: 0, totalHE: 0, totalFalta: 0, totalNot: 0 });
      return { todos, ...agg, saldo: agg.totalTrab - agg.totalEsp };
    }
    return null;
  }, [selectedFunc, visaoTodos, funcComMarcacoes, marcacoes, horarios, dataInicio, dataFim, correcoes, diasDescartados, parametrosMap, marcacoesDescartadas, feriados]);

  const toggleColuna = (key) => {
    setColunasVisiveis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const exportPDF = (conteudoHtml) => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Espelho de Ponto</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 3px 5px; text-align: center; }
        th { background: #eee; font-weight: bold; }
        h2 { text-align: center; }
        .total { font-weight: bold; background: #f5f5f5; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>${conteudoHtml}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleExportAFD = () => {
    const lines = [];
    let nsr = 1;
    const now = new Date();
    const dataStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const horaStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    lines.push(`0000000011000000000${dataStr}${horaStr}${' '.repeat(245)}`);
    nsr++;
    const filtradas = marcacoes.filter(m => {
      const dateStr = m.date || m.data || '';
      return dateStr >= dataInicio && dateStr <= dataFim;
    });
    for (const m of filtradas) {
      const pis = String(m.pis || '').replace(/\D/g, '').padStart(11, '0');
      const cpf = String(m.cpf || '').replace(/\D/g, '').padStart(11, '0');
      const dateStr = m.date || m.data || '';
      const timeStr = m.time || m.hora || '00:00';
      const pisOuCpf = cpf !== '00000000000' ? cpf : pis;
      const d = dateStr.replace(/-/g, '');
      const t = timeStr.replace(/:/g, '');
      lines.push(`${String(nsr).padStart(9, '0')}3${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}${' '.repeat(5)}${pisOuCpf}${'0'.repeat(228)}`);
      nsr++;
    }
    const total = String(filtradas.length).padStart(9, '0');
    lines.push(`${total}9${' '.repeat(250)}`);
    downloadTxt(`AFD_${dataInicio}_${dataFim}.txt`, lines.join('\r\n'));
  };

  const toDMA = (iso) => { if (!iso) return '00000000'; const [y, m, d] = iso.split('-'); return `${d}${m}${y}`; };
  const min2hhmm = (m) => { const a = Math.abs(m || 0); return String(Math.floor(a / 60)).padStart(2, '0') + String(a % 60).padStart(2, '0'); };
  const pct2acjef = (pct) => { const v = Math.round(Math.abs(pct || 0) * 100); return String(Math.min(v, 9999)).padStart(4, '0'); };

  const handleExportADFT = () => {
    const company = empresas.find(e => String(e.id) === String(selectedEmpresaId)) || {};
    const lines = [];
    let seq = 0;
    const now = new Date();
    const cnpj = (company.cpf_cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const tpIdt = cnpj.length <= 11 ? '2' : '1';
    const idtEmp = cnpj.length <= 11 ? cnpj.padStart(11, '0') : cnpj.padStart(14, '0');
    const r = (val, len) => (val ?? '').padEnd(len, ' ');
    seq++;
    lines.push(r(String(seq).padStart(9, '0'), 9) + '1' + tpIdt + r(idtEmp, 14) + r('', 12) + r((company.razao_social || company.nome || 'EMPRESA').substring(0, 150), 150) + r(toDMA(dataInicio), 8) + r(toDMA(dataFim), 8) + r(toDMA(now.toISOString().slice(0, 10)), 8) + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0'));
    const numRep = '0'.repeat(17);
    funcComMarcacoes.forEach(f => {
      const dados = gerarLinhasFunc(f.doc, f.func, marcacoes, horarios, dataInicio, dataFim, correcoes, diasDescartados, parametrosMap, marcacoesDescartadas, feriados);
      dados.linhas.forEach(l => {
        if (l.descartado) return;
        let parIdx = 0;
        for (const par of l.pares) {
          parIdx++;
          if (par.entrada) {
            seq++;
            lines.push(r(String(seq).padStart(9, '0'), 9) + '2' + r(toDMA(l.dateStr), 8) + r(par.entrada.replace(':', ''), 4) + r(String(f.func.pis || '').padStart(12, '0'), 12) + r(numRep, 17) + 'E' + String(parIdx).padStart(2, '0') + 'O' + r('', 100));
          }
          if (par.saida) {
            seq++;
            lines.push(r(String(seq).padStart(9, '0'), 9) + '2' + r(toDMA(l.dateStr), 8) + r(par.saida.replace(':', ''), 4) + r(String(f.func.pis || '').padStart(12, '0'), 12) + r(numRep, 17) + 'S' + String(parIdx).padStart(2, '0') + 'O' + r('', 100));
          }
        }
      });
    });
    seq++;
    lines.push(r(String(seq).padStart(9, '0'), 9) + '9');
    const latin1 = new Uint8Array(lines.join('\r\n').split('').map(ch => ch.charCodeAt(0) & 0xFF));
    const blob = new Blob([latin1], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `AFDT_${dataInicio}_${dataFim}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportACJEF = () => {
    const company = empresas.find(e => String(e.id) === String(selectedEmpresaId)) || {};
    const lines = [];
    let seq = 0;
    const now = new Date();
    const cnpj = (company.cpf_cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const tpIdt = cnpj.length <= 11 ? '2' : '1';
    const idtEmp = cnpj.length <= 11 ? cnpj.padStart(11, '0') : cnpj.padStart(14, '0');
    const r = (val, len) => (val ?? '').padEnd(len, ' ');
    seq++;
    lines.push(r(String(seq).padStart(9, '0'), 9) + '1' + tpIdt + r(idtEmp, 14) + r('', 12) + r((company.razao_social || company.nome || 'EMPRESA').substring(0, 150), 150) + r(toDMA(dataInicio), 8) + r(toDMA(dataFim), 8) + r(toDMA(now.toISOString().slice(0, 10)), 8) + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0'));
    const horariosReg = new Set();
    let codHorNum = 0;
    funcComMarcacoes.forEach(f => {
      const horario = horarios.find(h => String(h.id) === String(f.func.horario_id));
      if (horario && horario.id && !horariosReg.has(horario.id)) {
        horariosReg.add(horario.id);
        codHorNum++;
        const firstDay = horario.dias ? Object.values(horario.dias).find(d => d?.ativo && d.periodos?.length > 0) : null;
        if (firstDay) {
          const p = firstDay.periodos[0];
          if (p?.entrada && p?.saida) {
            seq++;
            lines.push(String(seq).padStart(9, '0') + '2' + String(codHorNum).padStart(4, '0') + p.entrada.replace(':', '') + '0'.repeat(4) + '0'.repeat(4) + p.saida.replace(':', ''));
          }
        }
      }
    });
    funcComMarcacoes.forEach(f => {
      const dados = gerarLinhasFunc(f.doc, f.func, marcacoes, horarios, dataInicio, dataFim, correcoes, diasDescartados, parametrosMap, marcacoesDescartadas, feriados);
      const pis = String(f.func.pis || '').padStart(12, '0');
      const params = parametrosMap[String(f.func.parametro_id)] || parametrosMap['_default'] || {};
      const horario = horarios.find(h => String(h.id) === String(f.func.horario_id));
      dados.linhas.forEach(l => {
        if (l.descartado) return;
        seq++;
        const primeiraEntrada = l.pares.length > 0 ? (l.pares[0].entrada || '0000').replace(':', '') : '0000';
        const diurnas = Math.max(0, l.carga - l.horasNoturnas);
        const noturnas = l.horasNoturnas;
        const he1 = l.extraFaixa1 || l.extraMin;
        const he2 = l.extraFaixa2 || 0;
        const pct1 = l.faixa1Pct || l.percentualHE || 50;
        const pct2 = l.faixa2Pct || 0;
        const modalidade = (params?.noturno?.ativo && l.horasNoturnas > 0 && l.extraMin > 0) ? 'N' : 'D';
        const debito = l.debitoMin;
        const saldo = l.trabalhado - l.carga;
        const sinal = saldo > 0 ? '1' : (saldo < 0 ? '2' : '1');
        const saldoAbs = Math.abs(saldo);
        const ch = horario && horariosReg.has(horario.id) ? String(Array.from(horariosReg).indexOf(horario.id) + 1).padStart(4, '0') : '0000';
        lines.push(
          String(seq).padStart(9, '0') +
          '3' +
          r(pis, 12) +
          r(toDMA(l.dateStr), 8) +
          r(primeiraEntrada, 4) +
          r(ch, 4) +
          r(min2hhmm(diurnas), 4) +
          r(min2hhmm(noturnas), 4) +
          r(min2hhmm(he1), 4) +
          r(pct2acjef(pct1), 4) +
          modalidade +
          r(min2hhmm(he2), 4) +
          r(pct2acjef(pct2), 4) +
          'D' +
          r('0000', 4) +
          r('0000', 4) +
          'D' +
          r('0000', 4) +
          r('0000', 4) +
          'D' +
          r(min2hhmm(debito), 4) +
          sinal +
          r(min2hhmm(saldoAbs), 4)
        );
      });
    });
    seq++;
    lines.push(String(seq).padStart(9, '0') + '9');
    const latin1 = new Uint8Array(lines.join('\r\n').split('').map(ch => ch.charCodeAt(0) & 0xFF));
    const blob = new Blob([latin1], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ACJEF_${dataInicio}_${dataFim}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAEJ = () => {
    const company = empresas.find(e => String(e.id) === String(selectedEmpresaId)) || {};
    const lines = [];
    const p = (parts) => parts.join('|');
    const now = new Date();
    const pad = (n, len) => String(n).padStart(len, '0');
    const tz = '-0300';
    const dh = (d) => {
      const Y = d.getFullYear();
      const M = pad(d.getMonth() + 1, 2);
      const D = pad(d.getDate(), 2);
      const h = pad(d.getHours(), 2);
      const m = pad(d.getMinutes(), 2);
      return `${Y}-${M}-${D}T${h}:${m}:00${tz}`;
    };
    const hm = (t) => (t || '').replace(/[^0-9]/g, '').padStart(4, '0').slice(0, 4);
    const counts = { '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0, '07': 0, '08': 0 };
    const cnpj = (company.cpf_cnpj || '').replace(/\D/g, '');
    const tpIdt = cnpj.length <= 11 ? '2' : '1';
    const idtEmp = cnpj.length <= 11 ? cnpj.padStart(11, '0') : cnpj.padStart(14, '0');
    lines.push(p([
      '01',
      tpIdt,
      idtEmp,
      '',
      '',
      (company.razao_social || company.nome || 'EMPRESA').substring(0, 150),
      dataInicio,
      dataFim,
      dh(now),
      '001'
    ]));
    counts['01']++;
    lines.push(p([
      '02',
      '1',
      '3',
      '00000000000000000'
    ]));
    counts['02']++;
    let vinculoId = 0;
    const hReg = new Set();
    for (const f of funcComMarcacoes) {
      vinculoId++;
      const cpf = (f.func.cpf || '').replace(/\D/g, '').padStart(11, '0');
      lines.push(p(['03', String(vinculoId), cpf, (f.func.nome || f.nome || '').substring(0, 150)]));
      counts['03']++;
      const horario = horarios.find(h => String(h.id) === String(f.func.horario_id));
      let codHor = '';
      if (horario && horario.id) {
        codHor = `HOR${horario.id}`.substring(0, 30);
        if (!hReg.has(codHor)) {
          hReg.add(codHor);
          const firstDay = horario.dias ? Object.values(horario.dias).find(d => d?.ativo && d.periodos?.length > 0) : null;
          let dur = 0;
          const es = [];
          if (firstDay) {
            const ps = firstDay.periodos;
            dur = firstDay.carga_diaria ? calcMinutos(firstDay.carga_diaria) : ps.reduce((a, p) => a + (p.entrada && p.saida ? calcMinutos(p.saida) - calcMinutos(p.entrada) : 0), 0);
            for (const per of ps) {
              if (per.entrada && per.saida) {
                es.push(hm(per.entrada));
                es.push(hm(per.saida));
              }
            }
          }
          lines.push(p(['04', codHor, String(dur), ...es]));
          counts['04']++;
        }
      }
      const filtered = marcacoes.filter(m => {
        const pis = String(m.pis || '').replace(/\D/g, '');
        const mcpf = String(m.cpf || '').replace(/\D/g, '');
        return (pis || mcpf) === f.doc;
      });
      const days = {};
      for (const m of filtered) {
        const ds = m.date || m.data || (m.data_hora ? m.data_hora.slice(0, 10) : '');
        if (!ds || ds < dataInicio || ds > dataFim) continue;
        if (!days[ds]) days[ds] = [];
        const tm = m.time || m.hora || (m.data_hora ? m.data_hora.slice(11, 19) : '00:00');
        days[ds].push({ time: tm, src: 'O' });
      }
      const sortedDates = Object.keys(days).sort();
      for (const dateStr of sortedDates) {
        const corr = correcoes[`${f.doc}_${dateStr}`];
        if (corr?.batidas_manuais) {
          for (const tm of corr.batidas_manuais) {
            days[dateStr].push({ time: tm, src: 'I' });
          }
        }
        const batidas = days[dateStr].sort((a, b) => a.time.localeCompare(b.time));
        let parIdx = 0;
        for (let i = 0; i < batidas.length; i += 2) {
          parIdx++;
          if (batidas[i]) {
            lines.push(p([
              '05',
              String(vinculoId),
              `${dateStr}T${hm(batidas[i].time).slice(0, 2)}:${hm(batidas[i].time).slice(2, 4)}:00${tz}`,
              '1',
              'E',
              pad(parIdx, 3),
              batidas[i].src,
              parIdx === 1 ? codHor : '',
              ''
            ]));
            counts['05']++;
          }
          if (batidas[i + 1]) {
            lines.push(p([
              '05',
              String(vinculoId),
              `${dateStr}T${hm(batidas[i + 1].time).slice(0, 2)}:${hm(batidas[i + 1].time).slice(2, 4)}:00${tz}`,
              '1',
              'S',
              pad(parIdx, 3),
              batidas[i + 1].src,
              '',
              ''
            ]));
            counts['05']++;
          } else if (batidas[i]) {
            lines.push(p([
              '05',
              String(vinculoId),
              `${dateStr}T${hm(batidas[i].time).slice(0, 2)}:${hm(batidas[i].time).slice(2, 4)}:00${tz}`,
              '1',
              'D',
              pad(parIdx, 3),
              batidas[i].src,
              '',
              'Batida sem par correspondente'
            ]));
            counts['05']++;
          }
        }
      }
      if (f.func.matricula) {
        lines.push(p(['06', String(vinculoId), (f.func.matricula || '').substring(0, 30)]));
        counts['06']++;
      }
      for (const dateStr of Object.keys(days)) {
        const desc = diasDescartados[`${f.doc}_${dateStr}`];
        if (desc) {
          lines.push(p(['07', String(vinculoId), '2', dateStr, '', '']));
          counts['07']++;
        }
      }
    }
    lines.push(p([
      '08',
      'MultiPonto',
      '1.0.0',
      '1',
      idtEmp,
      (company.razao_social || company.nome || 'EMPRESA').substring(0, 150),
      'contato@multiponto.com'
    ]));
    counts['08']++;
    lines.push(p([
      '99',
      String(counts['01']),
      String(counts['02']),
      String(counts['03']),
      String(counts['04']),
      String(counts['05']),
      String(counts['06']),
      String(counts['07']),
      String(counts['08'])
    ]));
    lines.push('');
    const latin1 = new Uint8Array(lines.join('\r\n').split('').map(ch => ch.charCodeAt(0) & 0xFF));
    const blob = new Blob([latin1], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `AEJ_${dataInicio}_${dataFim}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderCell = (key, l) => {
    switch (key) {
      case 'data': return formatBR(l.dateStr);
      case 'dia': return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.diaSemana}</span>;
      case 'entrada': return l.pares.map((p, i) => <div key={i}>{p.entrada || '—'}</div>);
      case 'saida': return l.pares.map((p, i) => <div key={i}>{p.saida || '—'}</div>);
      case 'previsto': return formatMinutos(l.carga);
      case 'trabalhado': return l.descartado ? <span style={{ color: 'var(--danger)' }}>F</span> : formatMinutos(l.trabalhado);
      case 'saldo': {
        const s = l.trabalhado - l.carga;
        if (l.descartado) return '—';
        return <span style={{ color: s > 0 ? 'var(--warning)' : s < -30 ? 'var(--danger)' : 'var(--success)' }}>{(s >= 0 ? '+' : '') + formatMinutos(Math.abs(s))}</span>;
      }
      case 'he': return l.extraMin > 0
        ? (l.extraFaixa2 > 0
          ? `${formatMinutos(l.extraFaixa1)} (${l.faixa1Pct}%) + ${formatMinutos(l.extraFaixa2)} (${l.faixa2Pct}%)`
          : `${formatMinutos(l.extraMin)} (${l.percentualHE}%)`)
        : '—';
      case 'falta': return l.debitoMin > 0 ? formatMinutos(l.debitoMin) : (l.descartado ? 'FALTA' : '—');
      case 'noturno': return l.horasNoturnas > 0 ? `${formatMinutos(l.horasNoturnas)} (${l.adicionalNoturno}%)` : '—';
      case 'dsr': return l.dsrMin > 0 ? formatMinutos(l.dsrMin) : '—';
      case 'banco': return l.bancoMin !== 0 ? formatMinutos(l.bancoMin) : '—';
      case 'tolerancia': return l.toleranciaAplicada > 0 ? formatMinutos(l.toleranciaAplicada) : '—';
      case 'obs': return l.descartado ? `Falta: ${l.descartado_motivo}` : l.toleranciaAplicada > 0 ? `Tol: ${formatMinutos(l.toleranciaAplicada)}` : l.tipoHora ? `${l.percentualHE}%` : '';
      default: return '';
    }
  };

  const renderTable = (linhas) => {
    const visiveis = COLUNAS.filter(c => colunasVisiveis.includes(c.key));
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
            {visiveis.map(c => (
              <th key={c.key} style={{ textAlign: c.key === 'data' || c.key === 'dia' || c.key === 'obs' ? 'left' : 'center', padding: '0.5rem 0.25rem' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.dateStr + '_' + i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
              {visiveis.map(c => (
                <td key={c.key} style={{ padding: '0.4rem 0.25rem', textAlign: c.key === 'data' || c.key === 'dia' || c.key === 'obs' ? 'left' : 'center', fontSize: c.key === 'he' || c.key === 'noturno' ? '0.7rem' : 'inherit' }}>{renderCell(c.key, l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderEspelho = () => {
    if (!dadosFunc) {
      return (
        <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
          <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>Espelho de Ponto</h3>
          <p style={{ marginTop: '1rem', textAlign: 'center', maxWidth: '400px' }}>
            {visaoTodos ? 'Nenhum funcionário encontrado com os filtros atuais.' : 'Selecione um funcionário à esquerda ou ative "Todos" para gerar o espelho.'}
          </p>
        </div>
      );
    }
    if (dadosFunc.linhas.length === 0) {
      return (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h4>Espelho de Ponto</h4>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Nenhuma data encontrada para o período selecionado.
          </p>
        </div>
      );
    }

    const gerarHtml = () => {
      let html = `<h2>ESPELHO DE PONTO</h2><p>Período: ${formatBR(dataInicio)} a ${formatBR(dataFim)}</p>`;
      if (!visaoTodos && selectedFunc) {
        html += `<h3>${selectedFunc.nome}</h3>`;
        html += `<p>CPF: ${selectedFunc.func.cpf || '—'} | PIS: ${selectedFunc.func.pis || '—'} | Matrícula: ${selectedFunc.func.matricula || '—'}</p>`;
        html += gerarHtmlTabela(dadosFunc.linhas);
        html += gerarHtmlTotais(dadosFunc);
      } else if (visaoTodos && dadosFunc.todos) {
        dadosFunc.todos.forEach(t => {
          html += `<h3>${t.nome}</h3>`;
          html += `<p>CPF: ${t.func.cpf || '—'}</p>`;
          html += gerarHtmlTabela(t.linhas);
          html += gerarHtmlTotais(t);
          html += '<hr/>';
        });
        html += `<h3>TOTAIS GERAIS</h3>`;
        html += gerarHtmlTotais(dadosFunc);
      }
      return html;
    };

    const gerarHtmlTabela = (linhas) => {
      const visiveis = COLUNAS.filter(c => colunasVisiveis.includes(c.key));
      let h = '<table><thead><tr>';
      visiveis.forEach(c => { h += `<th>${c.label}</th>`; });
      h += '</tr></thead><tbody>';
      linhas.forEach(l => {
        h += '<tr>';
        visiveis.forEach(c => { h += `<td>${renderCellText(c.key, l)}</td>`; });
        h += '</tr>';
      });
      h += '</tbody></table>';
      return h;
    };

    const renderCellText = (key, l) => {
      const v = renderCell(key, l);
      return typeof v === 'string' ? v : '';
    };

    const gerarHtmlTotais = (d) => {
      return `<table><tfoot><tr class="total"><td colspan="4" style="text-align:right">Totais:</td><td>${formatMinutos(d.totalEsp)}</td><td>${formatMinutos(d.totalTrab)}</td><td>${formatMinutos(Math.abs(d.saldo))} (${d.saldo >= 0 ? 'Crédito' : 'Débito'})</td><td>${formatMinutos(d.totalHE)}</td><td>${formatMinutos(d.totalFalta)}</td><td>${formatMinutos(d.totalNot)}</td></tr></tfoot></table>`;
    };

    if (visaoTodos && dadosFunc.todos) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Resumo Geral ({dadosFunc.todos.length} funcionários)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Previsto</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{formatMinutos(dadosFunc.totalEsp)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Trabalhado</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{formatMinutos(dadosFunc.totalTrab)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HE</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{formatMinutos(dadosFunc.totalHE)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Faltas</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger)' }}>{formatMinutos(dadosFunc.totalFalta)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Noturno</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{formatMinutos(dadosFunc.totalNot)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Saldo</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: dadosFunc.saldo > 0 ? 'var(--warning)' : dadosFunc.saldo < -30 ? 'var(--danger)' : 'var(--success)' }}>
                  {formatMinutos(Math.abs(dadosFunc.saldo))} ({dadosFunc.saldo >= 0 ? 'C' : 'D'})
                </div>
              </div>
            </div>
          </div>
          {dadosFunc.todos.map(t => (
            <div key={t.doc} className="glass-card" style={{ padding: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>{t.nome}</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                CPF: {t.func.cpf || '—'} | Total Prev: {formatMinutos(t.totalEsp)} | Trab: {formatMinutos(t.totalTrab)} | HE: {formatMinutos(t.totalHE)} | Saldo: {formatMinutos(Math.abs(t.saldo))} ({t.saldo >= 0 ? 'C' : 'D'})
              </div>
              <div className="data-table-container">
                {renderTable(t.linhas)}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => exportPDF(gerarHtml())}>
              <Printer size={16} /> Exportar PDF
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{selectedFunc?.nome}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              CPF: {selectedFunc?.func.cpf || '—'} | PIS: {selectedFunc?.func.pis || '—'} | Matrícula: {selectedFunc?.func.matricula || '—'}
            </span>
          </div>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none' }} onClick={() => exportPDF(gerarHtml())}>
            <Printer size={16} /> Exportar PDF
          </button>
        </div>
        <div className="data-table-container">
          {renderTable(dadosFunc.linhas)}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontWeight: 'bold', fontSize: '0.85rem', padding: '0.5rem', borderTop: '2px solid var(--glass-border)' }}>
          <span>Prev: {formatMinutos(dadosFunc.totalEsp)}</span>
          <span>Trab: {formatMinutos(dadosFunc.totalTrab)}</span>
          <span style={{ color: 'var(--warning)' }}>HE: {formatMinutos(dadosFunc.totalHE)}</span>
          <span style={{ color: 'var(--danger)' }}>Faltas: {formatMinutos(dadosFunc.totalFalta)}</span>
          <span style={{ color: 'var(--accent-primary)' }}>Noturno: {formatMinutos(dadosFunc.totalNot)}</span>
          <span style={{ color: dadosFunc.saldo > 0 ? 'var(--warning)' : dadosFunc.saldo < -30 ? 'var(--danger)' : 'var(--success)' }}>
            Saldo: {formatMinutos(Math.abs(dadosFunc.saldo))} ({dadosFunc.saldo >= 0 ? 'C' : 'D'})
          </span>
        </div>
      </div>
    );
  };

  const renderFiscais = () => (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Exportação de Arquivos Fiscais</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Arquivos destinados à fiscalização do Ministério do Trabalho (Portarias 671/1510),
        emitidos sob solicitação. O fechamento operacional do período fica em <strong>Apuração</strong>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>AFD</h5>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Arquivo Fonte de Dados — batidas brutas do REP.</p>
          <button className="btn-primary" onClick={handleExportAFD} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Exportar AFD
          </button>
        </div>
        <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>ADFT</h5>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Arquivo Digital de Folha de Trabalho — resumo por funcionário.</p>
          <button className="btn-primary" onClick={handleExportADFT} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Exportar ADFT
          </button>
        </div>
        <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>ACJEF</h5>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Arquivo de Controle de Jornada Eletrônico (Portaria 671).</p>
          <button className="btn-primary" onClick={handleExportACJEF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Exportar ACJEF
          </button>
        </div>
        <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>AEJ</h5>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Arquivo Eletrônico de Jornada (Portaria 671) — pipe-delimited ISO-8859-1.</p>
          <button className="btn-primary" onClick={handleExportAEJ} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Exportar AEJ
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
        {[
          { key: 'espelho', icon: <FileText size={16} />, label: 'Espelho de Ponto' },
          { key: 'fiscais', icon: <Download size={16} />, label: 'Relatórios Fiscais' },
          ...(['admin', 'gestor'].includes(usuario?.role)
            ? [{ key: 'auditoria', icon: <Shield size={16} />, label: 'Auditoria' }]
            : []),
        ].map(b => (
          <button key={b.key} className="btn-primary" style={{
            background: subTab === b.key ? 'var(--accent-gradient)' : 'transparent',
            color: subTab === b.key ? 'white' : 'var(--text-secondary)',
            boxShadow: 'none', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem',
          }} onClick={() => setSubTab(b.key)}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {subTab !== 'auditoria' && (
      <div className="glass-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Período</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="date" className="form-input" style={{ padding: '0.5rem' }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              <span style={{ color: 'var(--text-muted)' }}>até</span>
              <input type="date" className="form-input" style={{ padding: '0.5rem' }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Empresa</label>
            <select className="form-input" style={{ padding: '0.5rem' }} value={selectedEmpresaId} onChange={e => setSelectedEmpresaId(e.target.value)}>
              <option value="">Selecione...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social || e.nome || `Empresa ${e.id}`}</option>)}
            </select>
          </div>
          {subTab === 'espelho' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Departamento</label>
                <select className="form-input" style={{ padding: '0.5rem' }} value={filtroDepartamento} onChange={e => setFiltroDepartamento(e.target.value)}>
                  <option value="">Todos</option>
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargo</label>
                <select className="form-input" style={{ padding: '0.5rem' }} value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)}>
                  <option value="">Todos</option>
                  {cargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, maxWidth: '200px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Colaborador</label>
                <input type="text" className="form-input" placeholder="Buscar..." style={{ padding: '0.5rem' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>&nbsp;</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={visaoTodos} onChange={e => { setVisaoTodos(e.target.checked); if (e.target.checked) setSelectedFunc(null); }}
                    style={{ accentColor: 'var(--accent-primary)' }} />
                  <Users size={14} /> Todos
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>&nbsp;</label>
                <button className="btn-primary" onClick={() => setMostrarConfigCol(!mostrarConfigCol)}
                  style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem' }}>
                  {mostrarConfigCol ? <EyeOff size={14} /> : <Eye size={14} />} Colunas
                </button>
              </div>
            </>
          )}
        </div>
        {mostrarConfigCol && subTab === 'espelho' && (
          <div className="fade-in" style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {COLUNAS.map(c => (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={colunasVisiveis.includes(c.key)} onChange={() => toggleColuna(c.key)}
                  style={{ accentColor: 'var(--accent-primary)' }} />
                {c.label}
              </label>
            ))}
          </div>
        )}
      </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>
        {subTab === 'espelho' && !visaoTodos && (
          <div style={{ width: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
            <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Users size={14} /> {selectedEmpresaId ? `Funcionários (${empresaFuncionarios.length})` : 'Selecione uma empresa'}
            </h5>
            {!selectedEmpresaId ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Escolha uma empresa no filtro ao lado.</p>
            ) : empresaFuncionarios.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhum funcionário encontrado.</p>
            ) : (
              empresaFuncionarios.map(f => (
                <div key={f.doc} className="glass-card" style={{
                  padding: '0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                  borderLeft: `3px solid ${selectedFunc?.doc === f.doc ? 'var(--accent-primary)' : 'transparent'}`,
                  background: selectedFunc?.doc === f.doc ? 'rgba(99,102,241,0.08)' : 'var(--glass-bg)'
                }} onClick={() => { setSelectedFunc(f); setVisaoTodos(false); }}>
                  <div style={{ fontWeight: 500 }}>{f.nome}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.doc}</div>
                </div>
              ))
            )}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {subTab === 'espelho'
            ? renderEspelho()
            : subTab === 'fiscais'
              ? renderFiscais()
              : <AuditoriaSection />}
        </div>
      </div>
    </div>
  );
}
