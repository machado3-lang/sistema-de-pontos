import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

const TIPOS = [
  { value: 'dia_inteiro', label: 'Dia inteiro' },
  { value: 'periodo', label: 'Período específico' },
  { value: 'horas', label: 'Abonar horas' },
  { value: 'ajuste', label: 'Ajustar horas' },
  { value: 'banco', label: 'Relocar para banco' },
  { value: 'dsr', label: 'Abonar só DSR' },
];

const FLAGS = [
  { key: 'abona_falta', label: 'Abona falta' },
  { key: 'abona_horas', label: 'Abona horas' },
  { key: 'protege_dsr', label: 'Protege DSR' },
  { key: 'gera_banco', label: 'Gera banco' },
  { key: 'exige_cid', label: 'Exige CID' },
  { key: 'exige_anexo', label: 'Exige anexo' },
];

const vazio = {
  nome: '',
  abreviacao: '',
  tipo: 'dia_inteiro',
  abona_falta: true,
  abona_horas: true,
  protege_dsr: false,
  gera_banco: false,
  exige_cid: false,
  exige_anexo: false,
  tolerancia_min: 0,
  ativo: true,
};

const rotuloTipo = (t) => TIPOS.find((x) => x.value === t)?.label || t;

export default function JustificativaTiposSection({ podeEditar = true }) {
  const toast = useToast();
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ ...vazio });
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const dados = await api.justificativaTipos.list();
      setTipos(Array.isArray(dados) ? dados : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os tipos de justificativa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const resetForm = () => {
    setForm({ ...vazio });
    setEditandoId(null);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast('Informe o nome da justificativa.', 'error');
      return;
    }
    setSalvando(true);
    try {
      const payload = { ...form, tolerancia_min: Number(form.tolerancia_min) || 0 };
      if (editandoId) {
        await api.justificativaTipos.update(editandoId, payload);
        toast('Tipo atualizado.', 'success');
      } else {
        await api.justificativaTipos.create(payload);
        toast('Tipo criado.', 'success');
      }
      resetForm();
      await carregar();
    } catch (e) {
      toast('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (t) => {
    setForm({
      nome: t.nome || '',
      abreviacao: t.abreviacao || '',
      tipo: t.tipo || 'dia_inteiro',
      abona_falta: Boolean(t.abona_falta),
      abona_horas: Boolean(t.abona_horas),
      protege_dsr: Boolean(t.protege_dsr),
      gera_banco: Boolean(t.gera_banco),
      exige_cid: Boolean(t.exige_cid),
      exige_anexo: Boolean(t.exige_anexo),
      tolerancia_min: t.tolerancia_min || 0,
      ativo: t.ativo !== false,
    });
    setEditandoId(t.id);
  };

  const handleExcluir = async (t) => {
    if (!window.confirm(`Excluir o tipo "${t.nome}"?`)) return;
    try {
      await api.justificativaTipos.remove(t.id);
      toast('Tipo excluído.', 'success');
      await carregar();
    } catch (e) {
      toast('Erro ao excluir: ' + e.message, 'error');
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={20} /> Tipos de justificativa
        </h3>
      </div>

      {erro && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>{erro}</div>}

      {podeEditar && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            {editandoId ? 'Editar tipo' : 'Novo tipo'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome</label>
              <input className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Atestado médico" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Abreviação</label>
              <input className="form-input" value={form.abreviacao} onChange={(e) => setForm({ ...form, abreviacao: e.target.value })} placeholder="ATE" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tipo</label>
              <select className="form-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tolerância (min)</label>
              <input type="number" className="form-input" value={form.tolerancia_min} onChange={(e) => setForm({ ...form, tolerancia_min: e.target.value })} min="0" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {FLAGS.map((f) => (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
                {f.label}
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativo
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
            <button className="btn-primary" onClick={handleSalvar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {editandoId ? <Save size={16} /> : <Plus size={16} />} {editandoId ? 'Salvar' : 'Adicionar'}
            </button>
            {editandoId && (
              <button className="btn-primary" onClick={resetForm} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', padding: '0.5rem 0.7rem' }} title="Cancelar">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Abrev.</th>
                <th>Tipo</th>
                <th>Comportamento</th>
                <th>Tolerância</th>
                <th>Status</th>
                {podeEditar && <th style={{ width: '100px' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={podeEditar ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : tipos.length === 0 ? (
                <tr><td colSpan={podeEditar ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum tipo cadastrado</td></tr>
              ) : tipos.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.nome}</strong></td>
                  <td>{t.abreviacao || '-'}</td>
                  <td>{rotuloTipo(t.tipo)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {FLAGS.filter((f) => t[f.key]).map((f) => f.label).join(' · ') || '-'}
                  </td>
                  <td>{t.tolerancia_min || 0} min</td>
                  <td style={{ color: t.ativo === false ? 'var(--danger)' : 'var(--success)' }}>{t.ativo === false ? 'Inativo' : 'Ativo'}</td>
                  {podeEditar && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-primary" onClick={() => handleEditar(t)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-primary" onClick={() => handleExcluir(t)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
