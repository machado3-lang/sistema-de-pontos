import { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, Download } from 'lucide-react';
import { api } from '../api';

const fmtDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '-');

const ACOES = [
  'criar', 'atualizar', 'excluir', 'salvar', 'importar',
  'fechar_periodo', 'reabrir_periodo', 'reset_senha', 'revogar_sessoes',
  'desativar', 'atualizar_hist_horarios',
];

export default function AuditoriaSection() {
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    data_inicio: '',
    data_fim: '',
    entidade: '',
    acao: '',
  });
  const [offset, setOffset] = useState(0);
  const LIMIT = 100;

  const carregar = useCallback(async (novoOffset = 0) => {
    setLoading(true);
    try {
      const dados = await api.auditoria.list({
        limit: LIMIT,
        offset: novoOffset,
        ...filtros,
      });
      const lista = Array.isArray(dados) ? dados : [];
      setLinhas((prev) => (novoOffset === 0 ? lista : [...prev, ...lista]));
      setOffset(novoOffset);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => { carregar(0); }, [carregar]);

  const exportarCsv = () => {
    const cabecalho = ['data_hora', 'usuario', 'email', 'acao', 'entidade', 'entidade_id', 'detalhes'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const corpo = linhas.map((l) => [
      fmtDataHora(l.created_at),
      l.usuario_nome || '',
      l.usuario_email || '',
      l.acao,
      l.entidade || '',
      l.entidade_id || '',
      l.detalhes ? JSON.stringify(l.detalhes) : '',
    ].map(esc).join(';'));
    const csv = [cabecalho.join(';'), ...corpo].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} /> Auditoria
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-primary" onClick={() => carregar(0)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', padding: '0.45rem 0.7rem' }} title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <button className="btn-primary" onClick={exportarCsv} disabled={!linhas.length} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {erro && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>{erro}</div>
      )}

      <div className="glass-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>De</label>
            <input type="date" className="form-input" value={filtros.data_inicio} onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Até</label>
            <input type="date" className="form-input" value={filtros.data_fim} onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Entidade</label>
            <input className="form-input" placeholder="ex.: funcionarios" value={filtros.entidade} onChange={(e) => setFiltros({ ...filtros, entidade: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ação</label>
            <select className="form-input" value={filtros.acao} onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}>
              <option value="">Todas</option>
              {ACOES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Data/hora</th>
                <th>Usuário</th>
                <th style={{ width: '130px' }}>Ação</th>
                <th style={{ width: '150px' }}>Entidade</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading && linhas.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : linhas.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum registro</td></tr>
              ) : linhas.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtDataHora(l.created_at)}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {l.usuario_nome || '-'}
                    {l.usuario_email ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.usuario_email}</div> : null}
                  </td>
                  <td><span className="badge" style={{ fontSize: '0.72rem' }}>{l.acao}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {l.entidade || '-'}
                    {l.entidade_id ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{String(l.entidade_id).slice(0, 12)}</div> : null}
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>
                    {l.detalhes ? (
                      <details>
                        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>ver</summary>
                        <pre style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
                          {JSON.stringify(l.detalhes, null, 2)}
                        </pre>
                      </details>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem' }}>
          <button className="btn-primary" onClick={() => carregar(offset + LIMIT)} disabled={loading || linhas.length < LIMIT} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }}>
            Carregar mais
          </button>
        </div>
      </div>
    </div>
  );
}
