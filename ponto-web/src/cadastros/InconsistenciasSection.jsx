import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

const CAMPOS = [
  { value: 'atraso', label: 'Atraso / débito parcial' },
  { value: 'falta', label: 'Falta' },
  { value: 'extra', label: 'Hora extra' },
  { value: 'banco', label: 'Banco de horas' },
  { value: 'batida', label: 'Batida ímpar' },
  { value: 'outro', label: 'Outro' },
];

const vazio = {
  nome: '',
  campo: 'atraso',
  valor_min: 10,
  prioridade: 5,
  icone: 'clock',
  cor: '#f59e0b',
  ativo: true,
};

export default function InconsistenciasSection({ podeEditar = true }) {
  const toast = useToast();
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ ...vazio });
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const dados = await api.inconsistenciaTipos.list();
      setTipos(Array.isArray(dados) ? dados : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os tipos de inconsistência.');
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
      toast('Informe o nome da inconsistência.', 'error');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        ...form,
        nome: form.nome.trim(),
        valor_min: Number(form.valor_min) || 0,
        prioridade: Math.min(10, Math.max(1, Number(form.prioridade) || 5)),
      };
      if (editandoId) {
        await api.inconsistenciaTipos.update(editandoId, payload);
        toast('Inconsistência atualizada.', 'success');
      } else {
        await api.inconsistenciaTipos.create(payload);
        toast('Inconsistência criada.', 'success');
      }
      resetForm();
      await carregar();
    } catch (e) {
      toast('Erro ao salvar inconsistência: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (t) => {
    setForm({
      nome: t.nome || '',
      campo: t.campo || 'atraso',
      valor_min: t.valor_min ?? 0,
      prioridade: t.prioridade ?? 5,
      icone: t.icone || '',
      cor: t.cor || '#f59e0b',
      ativo: t.ativo !== false,
    });
    setEditandoId(t.id);
  };

  const handleExcluir = async (t) => {
    if (!window.confirm(`Excluir a inconsistência "${t.nome}"?`)) return;
    try {
      await api.inconsistenciaTipos.remove(t.id);
      toast('Inconsistência excluída.', 'success');
      await carregar();
    } catch (e) {
      toast('Erro ao excluir inconsistência: ' + e.message, 'error');
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} /> Inconsistências da apuração
        </h3>
      </div>

      {erro && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>{erro}</div>}

      <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        O motor destaca o dia quando o valor do campo passa do limite. A
        prioridade menor aparece primeiro (1 = mais grave). Para <strong>batida
        ímpar</strong> o limite é ignorado.
      </div>

      {podeEditar && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome</label>
              <input
                className="form-input"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Atraso acima de 10 min"
              />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Campo</label>
              <select
                className="form-input"
                value={form.campo}
                onChange={(e) => setForm({ ...form, campo: e.target.value })}
              >
                {CAMPOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ width: '110px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Limite (min)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                value={form.valor_min}
                onChange={(e) => setForm({ ...form, valor_min: e.target.value })}
              />
            </div>
            <div style={{ width: '100px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prioridade</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="10"
                value={form.prioridade}
                onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
              />
            </div>
            <div style={{ width: '80px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cor</label>
              <input
                type="color"
                className="form-input"
                style={{ padding: '0.2rem', height: '38px' }}
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.6rem' }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativo
            </label>
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
                <th>Campo</th>
                <th>Limite</th>
                <th>Prioridade</th>
                <th>Cor</th>
                <th>Status</th>
                {podeEditar && <th style={{ width: '100px' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={podeEditar ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : tipos.length === 0 ? (
                <tr><td colSpan={podeEditar ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma inconsistência cadastrada</td></tr>
              ) : tipos.map((t) => {
                const campo = CAMPOS.find((c) => c.value === t.campo);
                return (
                  <tr key={t.id}>
                    <td><strong>{t.nome}</strong></td>
                    <td>{campo?.label || t.campo}</td>
                    <td>{t.campo === 'batida' ? '—' : `${t.valor_min ?? 0} min`}</td>
                    <td>{t.prioridade ?? 5}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: t.cor || '#999', display: 'inline-block' }} />
                        {t.cor || '—'}
                      </span>
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
