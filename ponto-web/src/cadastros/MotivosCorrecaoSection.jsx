import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

const vazio = { descricao: '', ativo: true };

export default function MotivosCorrecaoSection({ podeEditar = true }) {
  const toast = useToast();
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ ...vazio });
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const dados = await api.motivosCorrecao.list();
      setMotivos(Array.isArray(dados) ? dados : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os motivos.');
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
    if (!form.descricao.trim()) {
      toast('Informe a descrição do motivo.', 'error');
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        await api.motivosCorrecao.update(editandoId, form);
        toast('Motivo atualizado.', 'success');
      } else {
        await api.motivosCorrecao.create(form);
        toast('Motivo criado.', 'success');
      }
      resetForm();
      await carregar();
    } catch (e) {
      toast('Erro ao salvar motivo: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (m) => {
    setForm({ descricao: m.descricao || '', ativo: m.ativo !== false });
    setEditandoId(m.id);
  };

  const handleExcluir = async (m) => {
    if (!window.confirm(`Excluir o motivo "${m.descricao}"?`)) return;
    try {
      await api.motivosCorrecao.remove(m.id);
      toast('Motivo excluído.', 'success');
      await carregar();
    } catch (e) {
      toast('Erro ao excluir motivo: ' + e.message, 'error');
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={20} /> Motivos de correção
        </h3>
      </div>

      {erro && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>{erro}</div>}

      <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Estes motivos aparecem no campo <strong>motivo</strong> do AEJ (Portaria 671,
        registro tipo 05) quando uma marcação é incluída ou desconsiderada. Na
        apuração, o operador pode selecionar da lista ou digitar outro motivo.
      </div>

      {podeEditar && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Descrição</label>
              <input
                className="form-input"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex.: Esquecimento de marcação"
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
                <th>Descrição</th>
                <th>Status</th>
                {podeEditar && <th style={{ width: '100px' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={podeEditar ? 3 : 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : motivos.length === 0 ? (
                <tr><td colSpan={podeEditar ? 3 : 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum motivo cadastrado</td></tr>
              ) : motivos.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.descricao}</strong></td>
                  <td style={{ color: m.ativo === false ? 'var(--danger)' : 'var(--success)' }}>{m.ativo === false ? 'Inativo' : 'Ativo'}</td>
                  {podeEditar && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-primary" onClick={() => handleEditar(m)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-primary" onClick={() => handleExcluir(m)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir">
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
