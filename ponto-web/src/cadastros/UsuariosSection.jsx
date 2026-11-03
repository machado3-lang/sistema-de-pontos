import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, KeyRound, ShieldOff, Users, X, Save } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'consulta', label: 'Consulta (somente leitura)' },
];

const rotuloRole = (role) => ROLES.find((r) => r.value === role)?.label || role;

export default function UsuariosSection({ usuarioAtual }) {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'consulta' });
  const [editForm, setEditForm] = useState({ nome: '', role: 'consulta', ativo: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const dados = await api.usuarios.list();
      setUsuarios(Array.isArray(dados) ? dados : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleCriar = async () => {
    if (!form.nome || !form.email || !form.senha) {
      toast('Preencha nome, e-mail e senha.', 'error');
      return;
    }
    if (form.senha.length < 8) {
      toast('A senha deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.usuarios.create(form);
      setForm({ nome: '', email: '', senha: '', role: 'consulta' });
      await carregar();
      toast('Usuário criado.', 'success');
    } catch (e) {
      toast('Erro ao criar usuário: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (u) => {
    setEditandoId(u.id);
    setEditForm({ nome: u.nome || '', role: u.role || 'consulta', ativo: u.ativo !== false });
  };

  const handleSalvarEdicao = async () => {
    if (!editandoId) return;
    setSalvando(true);
    try {
      await api.usuarios.update(editandoId, editForm);
      setEditandoId(null);
      await carregar();
      toast('Usuário atualizado.', 'success');
    } catch (e) {
      toast('Erro ao atualizar usuário: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleResetSenha = async (u) => {
    const senha = window.prompt(`Nova senha para "${u.nome}" (mínimo 8 caracteres):`);
    if (senha === null) return;
    if (senha.length < 8) {
      toast('A senha deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    try {
      await api.usuarios.resetPassword(u.id, senha);
      toast('Senha redefinida. As sessões antigas foram encerradas.', 'success');
    } catch (e) {
      toast('Erro ao redefinir senha: ' + e.message, 'error');
    }
  };

  const handleRevogarSessoes = async (u) => {
    if (!window.confirm(`Encerrar todas as sessões de "${u.nome}"?`)) return;
    try {
      const res = await api.usuarios.revokeSessions(u.id);
      toast(`${res.revogadas || 0} sessão(ões) encerrada(s).`, 'success');
    } catch (e) {
      toast('Erro ao revogar sessões: ' + e.message, 'error');
    }
  };

  const handleDesativar = async (u) => {
    if (!window.confirm(`Desativar o usuário "${u.nome}"?`)) return;
    try {
      await api.usuarios.remove(u.id);
      await carregar();
      toast('Usuário desativado.', 'success');
    } catch (e) {
      toast('Erro ao desativar usuário: ' + e.message, 'error');
    }
  };

  const ehProprio = (u) => String(u.id) === String(usuarioAtual?.id);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} /> Usuários da conta
        </h3>
      </div>

      {erro && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>
          {erro}
        </div>
      )}

      <div className="glass-card" style={{ padding: '1rem' }}>
        <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Novo usuário</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome</label>
            <input className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>E-mail</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Senha</label>
            <input className="form-input" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Perfil</label>
            <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={handleCriar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Criar
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Status</th>
                <th style={{ width: '190px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum usuário</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    {editandoId === u.id ? (
                      <input className="form-input" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                    ) : (
                      <strong>{u.nome}{ehProprio(u) ? ' (você)' : ''}</strong>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {editandoId === u.id ? (
                      <select className="form-input" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : rotuloRole(u.role)}
                  </td>
                  <td style={{ color: u.ativo === false ? 'var(--danger)' : 'var(--success, #22c55e)' }}>
                    {u.ativo === false ? 'Inativo' : 'Ativo'}
                  </td>
                  <td>
                    {editandoId === u.id ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-primary" onClick={handleSalvarEdicao} disabled={salvando} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Salvar"><Save size={14} /></button>
                        <button className="btn-primary" onClick={() => setEditandoId(null)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Cancelar"><X size={14} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button className="btn-primary" onClick={() => handleEditar(u)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar"><Edit2 size={14} /></button>
                        <button className="btn-primary" onClick={() => handleResetSenha(u)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Redefinir senha"><KeyRound size={14} /></button>
                        <button className="btn-primary" onClick={() => handleRevogarSessoes(u)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Encerrar sessões"><ShieldOff size={14} /></button>
                        {!ehProprio(u) && u.ativo !== false && (
                          <button className="btn-primary" onClick={() => handleDesativar(u)} style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Desativar"><Trash2 size={14} /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
