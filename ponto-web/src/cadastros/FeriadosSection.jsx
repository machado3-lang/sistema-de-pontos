import { useState, useEffect } from 'react';
import { Calendar, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ESTADOS_BR } from './CadastrosUtils';
import { api } from '../api';
import {
  carregarFeriados,
  criarFeriado,
  atualizarFeriado,
  excluirFeriado,
} from '../data/pontoData';

const TIPOS = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'empresa', label: 'Empresa' },
];

const formatBR = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const vazio = {
  nome: '',
  data: '',
  tipo: 'municipal',
  recorrente: false,
  uf: '',
  cidade: '',
  alvo_empresa_id: '',
};

export default function FeriadosSection({ podeEditar = true }) {
  const toast = useToast();
  const [feriados, setFeriados] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ ...vazio });
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const [lista, emp] = await Promise.all([
        carregarFeriados(),
        api.empresas.list().catch(() => []),
      ]);
      setFeriados(lista);
      setEmpresas(Array.isArray(emp) ? emp : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os feriados.');
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
    if (!form.nome.trim() || !form.data) {
      toast('Informe nome e data do feriado.', 'error');
      return;
    }
    if (form.tipo === 'estadual' && !form.uf) {
      toast('Informe a UF do feriado estadual.', 'error');
      return;
    }
    if (form.tipo === 'municipal' && (!form.uf || !form.cidade.trim())) {
      toast('Informe UF e cidade do feriado municipal.', 'error');
      return;
    }
    if (form.tipo === 'empresa' && !form.alvo_empresa_id) {
      toast('Informe a empresa do feriado.', 'error');
      return;
    }

    setSalvando(true);
    try {
      if (editandoId) {
        await atualizarFeriado(editandoId, form);
        toast('Feriado atualizado.', 'success');
      } else {
        await criarFeriado(form);
        toast('Feriado cadastrado.', 'success');
      }
      resetForm();
      await carregar();
    } catch (e) {
      toast('Erro ao salvar feriado: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (f) => {
    setForm({
      nome: f.nome || '',
      data: f.data || '',
      tipo: f.tipo || 'municipal',
      recorrente: Boolean(f.recorrente),
      uf: f.uf || '',
      cidade: f.cidade || '',
      alvo_empresa_id: f.alvo_empresa_id || '',
    });
    setEditandoId(f.id);
  };

  const handleExcluir = async (f) => {
    if (!window.confirm(`Excluir o feriado "${f.nome}"?`)) return;
    try {
      await excluirFeriado(f.id);
      toast('Feriado excluído.', 'success');
      await carregar();
    } catch (e) {
      toast('Erro ao excluir feriado: ' + e.message, 'error');
    }
  };

  const nomeEmpresa = (id) => {
    const emp = empresas.find((e) => String(e.id) === String(id));
    return emp?.razao_social || emp?.nome || '-';
  };

  const escopo = (f) => {
    if (f.tipo === 'nacional') return 'Todos';
    if (f.tipo === 'estadual') return f.uf || '-';
    if (f.tipo === 'municipal') return [f.cidade, f.uf].filter(Boolean).join('/') || '-';
    if (f.tipo === 'empresa') return nomeEmpresa(f.alvo_empresa_id);
    return '-';
  };

  const ordenados = [...feriados].sort((a, b) => String(a.data).localeCompare(String(b.data)));

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} /> Feriados
        </h3>
      </div>

      {erro && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>
          {erro}
        </div>
      )}

      {podeEditar && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            {editandoId ? 'Editar feriado' : 'Novo feriado'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome</label>
              <input className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Natal" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data</label>
              <input type="date" className="form-input" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tipo</label>
              <select
                className="form-input"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value, uf: '', cidade: '', alvo_empresa_id: '' })}
              >
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.6rem' }}>
              <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} />
              Repete todo ano
            </label>
          </div>

          {(form.tipo === 'estadual' || form.tipo === 'municipal') && (
            <div style={{ display: 'grid', gridTemplateColumns: form.tipo === 'municipal' ? '1fr 2fr' : '1fr', gap: '0.5rem', marginTop: '0.5rem', maxWidth: '520px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UF</label>
                <select className="form-input" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>
                  <option value="">Selecione...</option>
                  {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              {form.tipo === 'municipal' && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cidade</label>
                  <input className="form-input" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex.: São Paulo" />
                </div>
              )}
            </div>
          )}

          {form.tipo === 'empresa' && (
            <div style={{ marginTop: '0.5rem', maxWidth: '420px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Empresa</label>
              <select className="form-input" value={form.alvo_empresa_id} onChange={(e) => setForm({ ...form, alvo_empresa_id: e.target.value })}>
                <option value="">Selecione...</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.razao_social || emp.nome || emp.id}</option>
                ))}
              </select>
            </div>
          )}

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

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
            Nacional vale para todos. Estadual exige UF. Municipal exige cidade/UF. Empresa vale só para a empresa escolhida.
            O comportamento “feriado como dia normal” fica no cadastro de <strong>Horários</strong>.
          </p>
        </div>
      )}

      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Âmbito</th>
                <th>Recorrente</th>
                {podeEditar && <th style={{ width: '100px' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={podeEditar ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : ordenados.length === 0 ? (
                <tr><td colSpan={podeEditar ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum feriado cadastrado</td></tr>
              ) : ordenados.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{formatBR(f.data)}</td>
                  <td>{f.nome}</td>
                  <td style={{ textTransform: 'capitalize' }}>{f.tipo}</td>
                  <td>{escopo(f)}</td>
                  <td>{f.recorrente ? 'Sim' : 'Não'}</td>
                  {podeEditar && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-primary" onClick={() => handleEditar(f)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-primary" onClick={() => handleExcluir(f)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir">
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
