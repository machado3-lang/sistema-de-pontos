import { useState, useEffect } from 'react';
import { Lock, Unlock, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

const formatBR = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export default function FechamentoPeriodo({ dataInicio, dataFim, role, onMudou }) {
  const toast = useToast();
  const [periodos, setPeriodos] = useState([]);
  const [inicio, setInicio] = useState(dataInicio || '');
  const [fim, setFim] = useState(dataFim || '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const podeFechar = role !== 'consulta';
  const podeReabrir = role === 'admin';

  const carregar = async () => {
    try {
      const dados = await api.periodos.list();
      setPeriodos(Array.isArray(dados) ? dados : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os fechamentos.');
    }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (dataInicio) setInicio(dataInicio);
    if (dataFim) setFim(dataFim);
  }, [dataInicio, dataFim]);

  const handleFechar = async () => {
    if (!inicio || !fim) {
      toast('Informe o início e o fim do período.', 'error');
      return;
    }
    if (fim < inicio) {
      toast('O fim deve ser maior ou igual ao início.', 'error');
      return;
    }
    if (!window.confirm(`Fechar o período de ${formatBR(inicio)} a ${formatBR(fim)}?\n\nAlterações em marcações, correções e descartes ficarão bloqueadas até a reabertura.`)) {
      return;
    }
    setCarregando(true);
    try {
      const res = await api.periodos.fechar(inicio, fim);
      toast(`Período fechado. ${res.resumo?.marcacoes ?? 0} marcação(ões) no intervalo.`, 'success');
      await carregar();
      if (onMudou) onMudou();
    } catch (e) {
      toast('Erro ao fechar período: ' + e.message, 'error');
    } finally {
      setCarregando(false);
    }
  };

  const handleReabrir = async (periodo) => {
    const motivo = window.prompt(
      `Motivo para reabrir ${formatBR(periodo.data_inicio)} a ${formatBR(periodo.data_fim)}:`
    );
    if (motivo === null) return;
    if (motivo.trim().length < 5) {
      toast('Informe um motivo com pelo menos 5 caracteres.', 'error');
      return;
    }
    try {
      await api.periodos.reabrir(periodo.id, motivo.trim());
      toast('Período reaberto.', 'success');
      await carregar();
      if (onMudou) onMudou();
    } catch (e) {
      toast('Erro ao reabrir período: ' + e.message, 'error');
    }
  };

  const ativos = periodos.filter((p) => !p.reaberto_em);
  const historico = periodos.filter((p) => p.reaberto_em);

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h5 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} /> Fechamento de período
        </h5>
        <button
          className="btn-primary"
          onClick={carregar}
          style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', padding: '0.35rem 0.6rem' }}
          title="Atualizar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {erro && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{erro}</p>}

      {podeFechar && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Início</label>
            <input type="date" className="form-input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fim</label>
            <input type="date" className="form-input" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={handleFechar} disabled={carregando} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={16} /> Fechar período
          </button>
        </div>
      )}

      {ativos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum período fechado.</p>
      ) : (
        <div className="data-table-container" style={{ marginBottom: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Fechado em</th>
                <th>Por</th>
                <th>Resumo</th>
                <th style={{ width: '110px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{formatBR(p.data_inicio)} — {formatBR(p.data_fim)}</strong></td>
                  <td>{p.fechado_em ? new Date(p.fechado_em).toLocaleString('pt-BR') : '-'}</td>
                  <td>{p.fechado_por_nome || '-'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {p.resumo?.marcacoes ?? 0} marcações · {p.resumo?.correcoes ?? 0} correções · {p.resumo?.dias_descartados ?? 0} dias descartados
                  </td>
                  <td>
                    {podeReabrir ? (
                      <button
                        className="btn-primary"
                        onClick={() => handleReabrir(p)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--warning, #f59e0b)', color: 'var(--warning, #f59e0b)', boxShadow: 'none' }}
                        title="Reabrir"
                      >
                        <Unlock size={14} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>somente admin</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historico.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Histórico de reaberturas ({historico.length})
          </summary>
          <ul style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.2rem' }}>
            {historico.map((p) => (
              <li key={p.id}>
                {formatBR(p.data_inicio)} — {formatBR(p.data_fim)} · reaberto em{' '}
                {p.reaberto_em ? new Date(p.reaberto_em).toLocaleString('pt-BR') : '-'} por {p.reaberto_por_nome || '-'} · motivo: {p.motivo_reabertura || '-'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
