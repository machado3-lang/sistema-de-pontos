import { useState, useMemo, useEffect } from 'react';
import { Search, AlertCircle, Clock, CheckCircle2, ChevronRight, Edit2, Calendar, Cpu } from 'lucide-react';
import { carregarParametrosMap } from './cadastros/parametrosUtils';
import { calcularPeriodo, formatMinutes as formatMinutos } from './engine/index.js';
import { api } from './api';
import FechamentoPeriodo from './components/FechamentoPeriodo';
import {
  carregarApuracaoExtras,
  carregarHorarios,
  carregarParametros,
  carregarMarcacoes,
  carregarFeriados,
  feriadosParaFuncionario,
  salvarCorrecao,
  desconsiderarDia as desconsiderarDiaApi,
  restaurarDia as restaurarDiaApi,
  descartarMarcacao,
  restaurarMarcacao,
  gravarCache,
} from './data/pontoData';

function carregarLocal(key, padrao) {
  try { return JSON.parse(localStorage.getItem(key)) || padrao; } catch { return padrao; }
}

export default function ApuracaoTab({ usuario }) {
  const [selectedFunc, setSelectedFunc] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [funcionarios, setFuncionarios] = useState([]);
  const [batidaManual, setBatidaManual] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [correcoes, setCorrecoes] = useState(() => carregarLocal('ponto_correcoes', {}));
  const [diasDesconsiderados, setDiasDesconsiderados] = useState(() => carregarLocal('ponto_dias_descartados', {}));
  const [marcacoesDescartadas, setMarcacoesDescartadas] = useState(() => carregarLocal('ponto_marcacoes_descartadas', {}));
  const [justificativaTipos, setJustificativaTipos] = useState([]);
  const [motivosCorrecao, setMotivosCorrecao] = useState([]);
  const [justificativas, setJustificativas] = useState([]);
  const [jornadaExcecoes, setJornadaExcecoes] = useState([]);
  const [tipoJustificativaId, setTipoJustificativaId] = useState('');
  const [textoJustificativa, setTextoJustificativa] = useState('');
  const [inicioJustificativa, setInicioJustificativa] = useState('');
  const [fimJustificativa, setFimJustificativa] = useState('');
  const [minutosJustificativa, setMinutosJustificativa] = useState('');
  const [cidJustificativa, setCidJustificativa] = useState('');
  const [anexoJustificativa, setAnexoJustificativa] = useState('');

  useEffect(() => {
    api.justificativaTipos.list()
      .then((d) => setJustificativaTipos(Array.isArray(d) ? d : []))
      .catch(() => {});
    api.motivosCorrecao.list()
      .then((d) => setMotivosCorrecao(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!dataInicio || !dataFim) return undefined;
    let ativo = true;
    Promise.all([
      api.justificativas.list({ data_inicio: dataInicio, data_fim: dataFim }).catch(() => []),
      api.jornadaExcecoes.list({ data_inicio: dataInicio, data_fim: dataFim }).catch(() => []),
    ]).then(([js, jx]) => {
      if (!ativo) return;
      setJustificativas(Array.isArray(js) ? js : []);
      setJornadaExcecoes(Array.isArray(jx) ? jx : []);
    });
    return () => { ativo = false; };
  }, [dataInicio, dataFim]);

  useEffect(() => {
    api.funcionarios.list().then((data) => {
      if (Array.isArray(data)) setFuncionarios(data);
    }).catch(() => {
      // Sem conexão com o servidor: segue com o cache local.
    });
  }, []);

  // Correções e descartes vêm do PostgreSQL (Fase 5).
  useEffect(() => {
    if (funcionarios.length === 0) return;
    let ativo = true;
    carregarApuracaoExtras(funcionarios)
      .then((extras) => {
        if (!ativo) return;
        setCorrecoes(extras.correcoes);
        setDiasDesconsiderados(extras.diasDescartados);
        setMarcacoesDescartadas(extras.marcacoesDescartadas);
      })
      .catch(() => {
        // Sem conexão: mantém o cache local até a próxima carga.
      });
    return () => { ativo = false; };
  }, [funcionarios]);

  const [marcacoes, setMarcacoes] = useState(() => carregarLocal('ponto_marcacoes', []));
  useEffect(() => {
    carregarMarcacoes()
      .then((data) => { if (Array.isArray(data)) setMarcacoes(data); })
      .catch(() => {
        // Sem conexão com o servidor: segue com o cache local.
      });
  }, []);
  const [horarios, setHorarios] = useState(() => carregarLocal('ponto_horarios', []));
  const [parametrosMap, setParametrosMap] = useState(() => carregarParametrosMap());
  const [feriados, setFeriados] = useState(() => carregarLocal('ponto_feriados', []));

  useEffect(() => {
    carregarHorarios()
      .then((lista) => { if (Array.isArray(lista)) setHorarios(lista); })
      .catch(() => {
        // Sem conexão: mantém o cache local.
      });
    carregarParametros()
      .then(() => setParametrosMap(carregarParametrosMap()))
      .catch(() => {
        // Sem conexão: mantém o cache local.
      });
    carregarFeriados()
      .then((lista) => { if (Array.isArray(lista)) setFeriados(lista); })
      .catch(() => {
        // Sem conexão: mantém o cache local.
      });
  }, []);

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

  const processedData = useMemo(() => {
    const datasMarcacoes = marcacoes
      .map(m => m.date || m.data || (m.data_hora ? String(m.data_hora).slice(0, 10) : ''))
      .filter(Boolean)
      .sort();
    const inicio = dataInicio || datasMarcacoes[0] || '';
    const fim = dataFim || datasMarcacoes[datasMarcacoes.length - 1] || '';
    if (!inicio || !fim) return {};

    const docs = new Set();
    funcionarios.forEach(f => {
      const cpf = String(f.cpf || '').replace(/\D/g, '');
      const pis = String(f.pis || '').replace(/\D/g, '');
      if (cpf) docs.add(cpf);
      else if (pis) docs.add(pis);
    });
    marcacoes.forEach(m => {
      const doc = String(m.cpf || '').replace(/\D/g, '') || String(m.pis || '').replace(/\D/g, '');
      if (doc && !funcMap[doc]) docs.add(doc);
    });

    const grouped = {};
    for (const doc of docs) {
      const func = funcMap[doc] || { nome: `Func. ${doc.slice(0, 4)}...`, cpf: doc };
      const horario = horarios.find(h => String(h.id) === String(func?.horario_id));
      const params = parametrosMap[String(func?.parametro_id)] || parametrosMap['_default'] || {};

      const jornadas = {};
      for (const ex of jornadaExcecoes) {
        if (String(ex.funcionario_id) !== String(func?.id)) continue;
        const h = horarios.find((x) => String(x.id) === String(ex.horario_id));
        if (h) jornadas[ex.data] = h;
      }
      const cpfFunc = String(func?.cpf || '').replace(/\D/g, '');
      const pisFunc = String(func?.pis || '').replace(/\D/g, '');
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
        dataInicio: inicio,
        dataFim: fim,
        correcoes,
        diasDescartados: diasDesconsiderados,
        marcacoesDescartadas,
        feriados: feriadosParaFuncionario(feriados, func, horario),
        jornadas,
        justificativas,
      });

      grouped[doc] = {};
      for (const l of resultado.linhas) {
        const temBatidas = l.batidas.length > 0;
        const temPrevisao = l.previstoMin > 0;
        if (!temBatidas && !temPrevisao && !l.descartado) continue;
        grouped[doc][l.data] = {
          batidas: l.batidas,
          batidas_originais: l.batidas_originais,
          batidas_manuais: l.batidas_manuais,
          batidas_descartadas: l.batidas_descartadas,
          equip: l.equip,
          funcionario_id: l.funcionario_id,
          valido: l.valido,
          descartado: l.descartado,
          descartado_motivo: l.descartado_motivo,
          total_minutos: l.trabalhadoMin,
          total_formatado: l.total_formatado,
          justificativa: l.justificativa,
          correcao_aplicada: l.correcao_aplicada,
          carga_esperada: l.previstoMin,
          extraMin: l.extraMin,
          debitoMin: l.debitoMin,
          faltaJustificadaMin: l.faltaJustificadaMin,
          normaisMin: l.normaisMin,
          saldoDiaMin: l.saldoDiaMin,
          abonoMin: l.abonoMin,
          ajusteMin: l.ajusteMin,
          protegeDSR: l.protegeDSR,
          justificativas: l.justificativas || [],
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
        };
      }
    }
    return grouped;
  }, [marcacoes, correcoes, diasDesconsiderados, marcacoesDescartadas, funcMap, funcionarios, horarios, parametrosMap, feriados, jornadaExcecoes, justificativas, dataInicio, dataFim]);

  const pendencias = useMemo(() => {
    const list = [];
    const funcById = {};
    funcionarios.forEach(f => { funcById[f.id] = f; });
    for (const [doc, dates] of Object.entries(processedData)) {
      for (const [dateStr, info] of Object.entries(dates)) {
        const func = funcMap[doc] || funcById[info.funcionario_id];
        const nome = func?.nome || `Func. ${doc.slice(0, 4)}...`;
        if (searchTerm && !nome.toLowerCase().includes(searchTerm.toLowerCase()) && !doc.includes(searchTerm)) continue;
        const cargaEsperada = info.carga_esperada || 0;
        const diff = info.descartado ? 0 : (info.saldoDiaMin ?? (info.total_minutos - cargaEsperada));
        let tipo = 'success';
        let status = 'Ok';
        let problema = 'Dentro do esperado';
        if (info.descartado) {
          tipo = 'danger';
          status = 'Dia desconsiderado';
          problema = 'Dia desconsiderado: ' + (info.descartado_motivo || 'Sem motivo');
        } else if (!info.valido) {
          tipo = 'danger';
          status = 'Erro: Batida Ímpar';
          problema = 'Número ímpar de batidas no dia';
        } else if (diff > 120) {
          tipo = 'warning';
          status = 'Hora Extra Elevada';
          problema = diff > 240 ? 'Extrapolou limite legal (4h)' : 'Mais de 2 horas extras';
        } else if (diff < -120) {
          tipo = 'danger';
          status = 'Débito Alto';
          problema = 'Mais de 2 horas de débito';
        }
        list.push({
          id: `${doc}_${dateStr}`, doc, nome, data: dateStr,
          funcionario_id: info.funcionario_id,
          batidas: info.batidas, valido: info.valido,
          total_minutos: info.total_minutos,
          carga_esperada: cargaEsperada,
          total_formatado: info.total_formatado,
          equip: info.equip,
          tipo, status, problema,
          descartado: info.descartado,
          justificativa: info.justificativa,
          correcao_aplicada: info.correcao_aplicada,
          batidas_manuais: info.batidas_manuais,
          batidas_descartadas: info.batidas_descartadas || [],
          extraMin: info.extraMin, debitoMin: info.debitoMin,
          faltaJustificadaMin: info.faltaJustificadaMin || 0,
          normaisMin: info.normaisMin || 0,
          saldoDiaMin: info.saldoDiaMin || 0,
          abonoMin: info.abonoMin || 0,
          ajusteMin: info.ajusteMin || 0,
          protegeDSR: !!info.protegeDSR,
          justificativas: info.justificativas || [],
          tipoHora: info.tipoHora, percentualHE: info.percentualHE || 0,
          extraFaixa1: info.extraFaixa1 || 0, extraFaixa2: info.extraFaixa2 || 0,
          faixa1Pct: info.faixa1Pct || 0, faixa2Pct: info.faixa2Pct || 0,
          horasNoturnas: info.horasNoturnas, adicionalNoturno: info.adicionalNoturno,
          toleranciaAplicada: info.toleranciaAplicada,
        });
      }
    }
    list.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
    return list.filter(p => {
      if (dataInicio && p.data < dataInicio) return false;
      if (dataFim && p.data > dataFim) return false;
      return true;
    });
  }, [processedData, funcMap, funcionarios, searchTerm, dataInicio, dataFim]);

  const [somenteInconsistencias, setSomenteInconsistencias] = useState(false);
  const linhasGrade = pendencias.filter((p) => {
    if (!somenteInconsistencias) return true;
    const saldo = p.saldoDiaMin ?? (p.total_minutos - p.carga_esperada);
    return !p.valido || p.descartado || Math.abs(saldo) > 120;
  });

  const selectedPendencia = pendencias.find(p => p.id === selectedFunc);

  const tipoJustificativaSelecionado = justificativaTipos.find(
    (t) => String(t.id) === String(tipoJustificativaId)
  ) || null;
  const comportamentoJustificativa = tipoJustificativaSelecionado?.tipo || '';

  const jornadaExcecaoDoDia = selectedPendencia
    ? jornadaExcecoes.find((e) => (
      String(e.funcionario_id) === String(selectedPendencia.funcionario_id)
      && e.data === selectedPendencia.data
    ))
    : null;

  const hasMarkings = marcacoes.length > 0;

  const handleDefinirJornada = async (horarioId) => {
    if (!selectedPendencia) return;
    try {
      if (!horarioId) {
        await api.jornadaExcecoes.removeByKey(selectedPendencia.funcionario_id, selectedPendencia.data);
      } else {
        await api.jornadaExcecoes.upsert({
          funcionario_id: selectedPendencia.funcionario_id,
          data: selectedPendencia.data,
          horario_id: horarioId,
        });
      }
      const jx = await api.jornadaExcecoes.list({ data_inicio: dataInicio, data_fim: dataFim });
      setJornadaExcecoes(Array.isArray(jx) ? jx : []);
    } catch (e) {
      alert('Erro ao definir jornada do dia: ' + e.message);
    }
  };

  const justificativasDoDia = (funcionarioId, data) => justificativas.filter(
    (j) => String(j.funcionario_id) === String(funcionarioId) && j.data === data
  );

  const recarregarJustificativas = async () => {
    if (!dataInicio || !dataFim) return;
    try {
      const d = await api.justificativas.list({ data_inicio: dataInicio, data_fim: dataFim });
      setJustificativas(Array.isArray(d) ? d : []);
    } catch {
      // Sem conexão: mantém a lista atual.
    }
  };

  const handleAplicarJustificativa = async () => {
    if (!selectedPendencia || !tipoJustificativaId) return;
    const tipo = justificativaTipos.find((t) => String(t.id) === String(tipoJustificativaId));
    const comportamento = tipo?.tipo || '';
    const minutosNum = Number(minutosJustificativa);

    if (comportamento === 'periodo') {
      if (!inicioJustificativa || !fimJustificativa) {
        alert('Informe o início e o fim do período a abonar.');
        return;
      }
      if (fimJustificativa <= inicioJustificativa) {
        alert('O fim do período precisa ser maior que o início.');
        return;
      }
    }
    if ((comportamento === 'horas' || comportamento === 'ajuste')
      && (!Number.isFinite(minutosNum) || minutosNum === 0)) {
      alert(comportamento === 'ajuste'
        ? 'Informe os minutos do ajuste (use negativo para subtrair).'
        : 'Informe quantos minutos devem ser abonados.');
      return;
    }
    if (tipo?.exige_cid && !cidJustificativa.trim()) {
      alert('Este tipo de justificativa exige o CID.');
      return;
    }
    if (tipo?.exige_anexo && !anexoJustificativa.trim()) {
      alert('Este tipo de justificativa exige um anexo (URL ou referência).');
      return;
    }

    try {
      await api.justificativas.create({
        funcionario_id: selectedPendencia.funcionario_id,
        tipo_id: tipoJustificativaId,
        data: selectedPendencia.data,
        inicio: comportamento === 'periodo' ? inicioJustificativa : null,
        fim: comportamento === 'periodo' ? fimJustificativa : null,
        minutos: (comportamento === 'horas' || comportamento === 'ajuste')
          ? Math.trunc(minutosNum)
          : null,
        texto: textoJustificativa || null,
        cid: cidJustificativa || null,
        anexo_url: anexoJustificativa || null,
      });
      setTextoJustificativa('');
      setTipoJustificativaId('');
      setInicioJustificativa('');
      setFimJustificativa('');
      setMinutosJustificativa('');
      setCidJustificativa('');
      setAnexoJustificativa('');
      await recarregarJustificativas();
    } catch (e) {
      alert('Erro ao aplicar justificativa: ' + e.message);
    }
  };

  const handleRemoverJustificativa = async (id) => {
    if (!window.confirm('Remover esta justificativa?')) return;
    try {
      await api.justificativas.remove(id);
      await recarregarJustificativas();
    } catch (e) {
      alert('Erro ao remover justificativa: ' + e.message);
    }
  };

  const handleAplicarCorrecao = async () => {
    if (!selectedPendencia) return;
    const key = selectedPendencia.id;
    const atual = correcoes[key] || {};
    const batidas = batidaManual
      ? [...(atual.batidas_manuais || []), batidaManual]
      : (atual.batidas_manuais || []);
    const motivo = justificativa || atual.justificativa || '';

    try {
      await salvarCorrecao(selectedPendencia.funcionario_id, selectedPendencia.data, {
        batidas_manuais: batidas,
        justificativa: motivo,
      });
      const novas = {
        ...correcoes,
        [key]: {
          ...atual,
          batidas_manuais: batidas,
          justificativa: motivo,
          aplicada_em: new Date().toISOString(),
        },
      };
      setCorrecoes(novas);
      gravarCache('correcoes', novas);
      setBatidaManual('');
      setJustificativa('');
    } catch (e) {
      alert('Erro ao salvar correção: ' + e.message);
    }
  };

  const handleDesconsiderarDia = async () => {
    if (!selectedPendencia) return;
    const key = selectedPendencia.id;
    const motivo = prompt('Motivo para desconsiderar este dia:', 'Falta justificada');
    if (motivo === null) return;
    try {
      await desconsiderarDiaApi(selectedPendencia.funcionario_id, selectedPendencia.data, motivo);
      const novos = { ...diasDesconsiderados, [key]: { motivo, data: new Date().toISOString() } };
      setDiasDesconsiderados(novos);
      gravarCache('diasDescartados', novos);
    } catch (e) {
      alert('Erro ao desconsiderar dia: ' + e.message);
    }
  };

  const handleRestaurarDia = async () => {
    if (!selectedPendencia) return;
    const key = selectedPendencia.id;
    try {
      await restaurarDiaApi(selectedPendencia.funcionario_id, selectedPendencia.data);
      const novos = { ...diasDesconsiderados };
      delete novos[key];
      setDiasDesconsiderados(novos);
      gravarCache('diasDescartados', novos);
    } catch (e) {
      alert('Erro ao restaurar dia: ' + e.message);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            <Search size={16} /> Filtros de Apuração
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Período Inicial</label>
                <input type="date" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Período Final</label>
                <input type="date" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Buscar Colaborador</label>
              <input type="text" className="form-input" placeholder="Nome, CPF ou PIS..." style={{ width: '100%', padding: '0.5rem' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        <FechamentoPeriodo
          dataInicio={dataInicio}
          dataFim={dataFim}
          role={usuario?.role}
        />

        {!hasMarkings ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Cpu size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Nenhuma marcação importada</h3>
            <p>Vá em Cadastros &gt; Equipamentos, conecte ao REP e use "Importar Marcações do REP".</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <AlertCircle size={20} color="var(--accent-primary)" /> Apuração ({linhasGrade.length} dias)
              </h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={somenteInconsistencias} onChange={(e) => setSomenteInconsistencias(e.target.checked)} />
                Somente inconsistências
              </label>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Funcionário</th>
                    <th>Batidas</th>
                    <th>Prev.</th>
                    <th>Trab.</th>
                    <th>Norm.</th>
                    <th>Not.</th>
                    <th>Atraso</th>
                    <th>Extra</th>
                    <th>DSR</th>
                    <th>Banco</th>
                    <th>Status</th>
                    <th>Justif.</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasGrade.length === 0 ? (
                    <tr><td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum dia no período.</td></tr>
                  ) : linhasGrade.map((p) => {
                    const trabalhado = p.total_minutos || 0;
                    const previsto = p.carga_esperada || 0;
                    const normais = p.normaisMin ?? Math.min(trabalhado, previsto);
                    const atraso = p.debitoMin ?? Math.max(0, previsto - trabalhado);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => { setSelectedFunc(p.id); setBatidaManual(''); setJustificativa(''); }}
                        style={{
                          cursor: 'pointer',
                          background: selectedFunc === p.id ? 'rgba(99,102,241,0.12)' : undefined,
                        }}
                      >
                        <td style={{ fontWeight: 600 }}>{p.data}</td>
                        <td>{p.nome}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {(p.batidas || []).join(' · ') || '—'}
                        </td>
                        <td>{formatMinutos(previsto)}</td>
                        <td style={{ color: p.valido ? 'var(--success)' : 'var(--danger)' }}>{formatMinutos(trabalhado)}</td>
                        <td>{formatMinutos(normais)}</td>
                        <td>{formatMinutos(p.horasNoturnas || 0)}</td>
                        <td style={{ color: atraso > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{formatMinutos(atraso)}</td>
                        <td style={{ color: (p.extraMin || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{formatMinutos(p.extraMin || 0)}</td>
                        <td>{formatMinutos(p.dsrMin || 0)}</td>
                        <td>{formatMinutos(p.bancoMin || 0)}</td>
                        <td><span className={`badge ${p.tipo}`}>{p.status}</span></td>
                        <td>
                          {(() => {
                            const js = justificativasDoDia(p.funcionario_id, p.data);
                            if (js.length > 0) {
                              return (
                                <span title={js.map((j) => j.tipo_nome).join(', ')}>
                                  {js.map((j) => j.tipo_nome || 'Justificada').join(', ')}
                                  {p.abonoMin > 0 ? ` (+${formatMinutos(p.abonoMin)})` : ''}
                                </span>
                              );
                            }
                            return p.justificativa ? 'Correção' : '—';
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: '1.5' }}>
        {selectedPendencia ? (
          <div className="glass-card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{selectedPendencia.nome}</h2>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} /> Tratamento do dia: {selectedPendencia.data}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <Cpu size={12} /> {selectedPendencia.equip}
                </span>
              </div>
              <span className={`badge ${selectedPendencia.tipo}`}>{selectedPendencia.problema}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Previstas</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatMinutos(selectedPendencia.carga_esperada)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trabalhadas</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: selectedPendencia.valido ? 'var(--success)' : 'var(--danger)' }}>{selectedPendencia.total_formatado}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saldo</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: (selectedPendencia.saldoDiaMin ?? (selectedPendencia.total_minutos - selectedPendencia.carga_esperada)) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {selectedPendencia.valido ? formatMinutos(Math.abs(selectedPendencia.saldoDiaMin ?? (selectedPendencia.total_minutos - selectedPendencia.carga_esperada))) : '—'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REP</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{selectedPendencia.equip}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Linha do Tempo ({selectedPendencia.batidas.length} marcações)
                {selectedPendencia.batidas_descartadas?.length > 0 && (
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--danger)' }}>
                    ({selectedPendencia.batidas_descartadas.length} descartadas)
                  </span>
                )}
              </h4>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {(() => {
                  const descKey = selectedPendencia.id;
                  const todasAsBatidas = [
                    ...(selectedPendencia.batidas_originais || selectedPendencia.batidas).map(t => ({ time: t, original: true })),
                    ...selectedPendencia.batidas_manuais.map(t => ({ time: t, original: false })),
                  ].sort((a, b) => a.time.localeCompare(b.time));
                  const descSet = new Set(marcacoesDescartadas[descKey] || []);
                  return todasAsBatidas.map(({ time }, idx) => {
                    const isManual = selectedPendencia.batidas_manuais.includes(time);
                    const isDescartada = descSet.has(time);
                    return (
                      <div key={time + '_' + idx} onDoubleClick={async () => {
                        const key = selectedPendencia.id;
                        const funcionarioId = selectedPendencia.funcionario_id;
                        const data = selectedPendencia.data;
                        const novas = { ...marcacoesDescartadas };
                        if (!novas[key]) novas[key] = [];
                        try {
                          if (novas[key].includes(time)) {
                            await restaurarMarcacao(funcionarioId, data, time);
                            novas[key] = novas[key].filter(t => t !== time);
                            if (novas[key].length === 0) delete novas[key];
                          } else {
                            const sugestoes = motivosCorrecao.map(m => m.descricao).filter(Boolean);
                            const motivo = window.prompt(
                              `Motivo para desconsiderar a marcação "${time}":\n\nSugestões: ${sugestoes.join(' | ') || '(cadastre em Cadastros > Motivos)'}`,
                              ''
                            );
                            if (motivo === null) return;
                            if (!motivo.trim()) { alert('Informe o motivo da desconsideração.'); return; }
                            await descartarMarcacao(funcionarioId, data, time, motivo.trim());
                            novas[key] = [...novas[key], time];
                          }
                          setMarcacoesDescartadas(novas);
                          gravarCache('marcacoesDescartadas', novas);
                        } catch (e) {
                          alert('Erro ao atualizar marcação: ' + e.message);
                        }
                      }} style={{
                        padding: '0.75rem 1.5rem',
                        background: isDescartada ? 'rgba(230,46,46,0.1)' : (isManual ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)'),
                        borderRadius: '8px',
                        border: isDescartada ? '1px solid var(--danger)' : (isManual ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)'),
                        fontSize: '1.2rem', fontWeight: 'bold',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                        cursor: 'pointer', opacity: isDescartada ? 0.5 : 1,
                        textDecoration: isDescartada ? 'line-through' : 'none',
                        transition: 'all 0.2s'
                      }}
                        title={isDescartada ? 'Clique 2x para restaurar' : 'Clique 2x para desconsiderar'}>
                        {time}
                        <span style={{ fontSize: '0.65rem', color: isDescartada ? 'var(--danger)' : (isManual ? 'var(--accent-primary)' : 'var(--text-muted)') }}>
                          {isDescartada ? 'Descartada' : (isManual ? 'Manual' : (idx % 2 === 0 ? 'Entrada' : 'Saída'))}
                        </span>
                      </div>
                    );
                  });
                })()}
                {selectedPendencia.batidas.length % 2 !== 0 && !selectedPendencia.descartado && (
                  <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(230, 46, 46, 0.1)', border: '1px dashed var(--danger)', borderRadius: '8px', color: 'var(--danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <Clock size={18} /> <span style={{ fontSize: '0.7rem' }}>Faltando...</span>
                  </div>
                )}
              </div>
            </div>

            {(selectedPendencia.extraMin > 0 || selectedPendencia.horasNoturnas > 0 || selectedPendencia.toleranciaAplicada > 0 || selectedPendencia.debitoMin > 0 || selectedPendencia.abonoMin > 0 || selectedPendencia.ajusteMin !== 0 || selectedPendencia.faltaJustificadaMin > 0) && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Detalhamento</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                  {selectedPendencia.extraMin > 0 && (
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hora Extra</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--warning)' }}>{formatMinutos(selectedPendencia.extraMin)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {selectedPendencia.tipoHora}
                        {selectedPendencia.extraFaixa2 > 0
                          ? `: ${formatMinutos(selectedPendencia.extraFaixa1)} à ${selectedPendencia.faixa1Pct}% + ${formatMinutos(selectedPendencia.extraFaixa2)} à ${selectedPendencia.faixa2Pct}%`
                          : ` (${selectedPendencia.percentualHE}%)`
                        }
                      </div>
                    </div>
                  )}
                  {selectedPendencia.debitoMin > 0 && (
                    <div style={{ background: 'rgba(230,46,46,0.1)', border: '1px solid rgba(230,46,46,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Débito</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger)' }}>{formatMinutos(selectedPendencia.debitoMin)}</div>
                    </div>
                  )}
                  {selectedPendencia.abonoMin > 0 && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Abonado</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>{formatMinutos(selectedPendencia.abonoMin)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>por justificativa</div>
                    </div>
                  )}
                  {selectedPendencia.ajusteMin !== 0 && (
                    <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ajuste de saldo</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{selectedPendencia.ajusteMin > 0 ? '+' : '-'}{formatMinutos(Math.abs(selectedPendencia.ajusteMin))}</div>
                    </div>
                  )}
                  {selectedPendencia.protegeDSR && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DSR</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>Protegido</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>falta não desconta DSR</div>
                    </div>
                  )}
                  {selectedPendencia.horasNoturnas > 0 && (
                    <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adicional Noturno</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{formatMinutos(selectedPendencia.horasNoturnas)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selectedPendencia.adicionalNoturno}% s/ {formatMinutos(selectedPendencia.horasNoturnas)}</div>
                    </div>
                  )}
                  {selectedPendencia.toleranciaAplicada > 0 && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tolerância Art. 58</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>{formatMinutos(selectedPendencia.toleranciaAplicada)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Não contabilizado</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedPendencia.justificativa && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--accent-primary)' }}>Justificativa: {selectedPendencia.justificativa}</span>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '10px' }}>
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Jornada do dia</h4>
              <select
                className="form-input"
                style={{ width: '100%' }}
                value={jornadaExcecaoDoDia?.horario_id || ''}
                onChange={(e) => handleDefinirJornada(e.target.value)}
              >
                <option value="">Usar horário padrão do funcionário</option>
                {horarios.filter((h) => h.tipo === 'Eventual').map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome} (eventual)
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Troca a jornada apenas neste dia (ex.: horário eventual), sem alterar o padrão.
              </p>
            </div>

            <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Ações de Apuração</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Incluir Batida Manual</label>
                <input type="time" className="form-input" style={{ width: '100%' }} value={batidaManual} onChange={e => setBatidaManual(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Motivo da correção</label>
                <input
                  className="form-input"
                  list="motivos-correcao"
                  style={{ width: '100%' }}
                  value={justificativa}
                  onChange={e => setJustificativa(e.target.value)}
                  placeholder="Selecione ou digite o motivo"
                />
                <datalist id="motivos-correcao">
                  {motivosCorrecao.map(m => <option key={m.id} value={m.descricao} />)}
                </datalist>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
              <button className="btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={handleAplicarCorrecao}>
                <CheckCircle2 size={18} /> Aplicar Correção
              </button>
              {selectedPendencia.descartado ? (
                <button className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)', boxShadow: 'none' }} onClick={handleRestaurarDia}>
                  Restaurar Dia
                </button>
              ) : (
                <button className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', boxShadow: 'none' }} onClick={handleDesconsiderarDia}>
                  Desconsiderar dia
                </button>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Justificativas</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tipo</label>
                  <select
                    className="form-input"
                    value={tipoJustificativaId}
                    onChange={e => setTipoJustificativaId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {justificativaTipos.filter(t => t.ativo !== false).map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>

                {comportamentoJustificativa === 'periodo' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Início</label>
                      <input type="time" className="form-input" value={inicioJustificativa} onChange={e => setInicioJustificativa(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fim</label>
                      <input type="time" className="form-input" value={fimJustificativa} onChange={e => setFimJustificativa(e.target.value)} />
                    </div>
                  </>
                )}

                {(comportamentoJustificativa === 'horas' || comportamentoJustificativa === 'ajuste') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {comportamentoJustificativa === 'ajuste' ? 'Minutos (negativo subtrai)' : 'Minutos a abonar'}
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '150px' }}
                      value={minutosJustificativa}
                      onChange={e => setMinutosJustificativa(e.target.value)}
                      placeholder={comportamentoJustificativa === 'ajuste' ? 'Ex.: -60' : 'Ex.: 60'}
                    />
                  </div>
                )}

                {tipoJustificativaSelecionado?.exige_cid && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CID</label>
                    <input className="form-input" style={{ width: '120px' }} value={cidJustificativa} onChange={e => setCidJustificativa(e.target.value)} placeholder="Ex.: J11" />
                  </div>
                )}

                {tipoJustificativaSelecionado?.exige_anexo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Anexo (URL/ref.)</label>
                    <input className="form-input" style={{ minWidth: '160px' }} value={anexoJustificativa} onChange={e => setAnexoJustificativa(e.target.value)} placeholder="Ex.: atestado.pdf" />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Observação</label>
                  <input
                    className="form-input"
                    placeholder="Opcional"
                    value={textoJustificativa}
                    onChange={e => setTextoJustificativa(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={handleAplicarJustificativa}
                  disabled={!tipoJustificativaId}
                  style={{ whiteSpace: 'nowrap', height: '38px' }}
                >
                  Aplicar
                </button>
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                O efeito no dia segue o tipo: abono de falta, abono por período/horas, ajuste de saldo,
                relocação para o banco ou proteção do DSR.
              </p>

              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {justificativasDoDia(selectedPendencia.funcionario_id, selectedPendencia.data).length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhuma justificativa lançada neste dia.</span>
                ) : justificativasDoDia(selectedPendencia.funcionario_id, selectedPendencia.data).map(j => (
                  <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', background: 'var(--bg-primary)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                    <span>
                      <strong style={{ color: 'var(--accent-primary)' }}>{j.tipo_nome}</strong>
                      {j.tipo_comportamento === 'periodo' && j.inicio && j.fim ? ` — ${j.inicio} às ${j.fim}` : ''}
                      {(j.tipo_comportamento === 'horas' || j.tipo_comportamento === 'ajuste') && j.minutos ? ` — ${j.minutos} min` : ''}
                      {j.cid ? ` — CID ${j.cid}` : ''}
                      {j.texto ? ` — ${j.texto}` : ''}
                    </span>
                    <button
                      className="btn-primary"
                      onClick={() => handleRemoverJustificativa(j.id)}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }}
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Edit2 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ marginBottom: '0.5rem' }}>{hasMarkings ? 'Selecione uma pendência' : 'Nenhum dado para apuração'}</h3>
            <p>{hasMarkings ? 'Clique em uma exceção ao lado para ajustar o dia.' : 'Importe marcações de um REP para começar.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
