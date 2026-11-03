import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Loader } from './CadastrosUtils';
import ConfirmModal from '../components/ConfirmModal';

export default function FuncionarioLista({
  funcionarios, loading, searchTerm, setSearchTerm,
  departamentos, cargos, empresas,
  handleEditarFuncionario, setSubTab,
  filtroAtivo, setFiltroAtivo,
  handleExcluirFuncionario,
  podeEditar = true
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const handleDeleteClick = (f) => {
    setConfirmDelete(f);
    document.body.style.overflow = 'hidden';
  };
  const FuncionariosFiltrados = funcionarios.filter(f => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      const nome = (f.nome || '').toLowerCase();
      const cpf = (f.cpf || '').replace(/\D/g, '');
      const pis = (f.pis || '').replace(/\D/g, '');
      const mat = (f.matricula || '').toLowerCase();
      if (!nome.includes(t) && !cpf.includes(t) && !pis.includes(t) && !mat.includes(t)) return false;
    }
    if (filtroAtivo === 'ativos') return f.ativo !== false;
    if (filtroAtivo === 'inativos') return f.ativo === false;
    return true;
  });
  const getDepartamentoNome = (id) => {
    if (!id) return '-';
    const dept = departamentos.find(d => String(d.id) === String(id));
    return dept ? dept.nome : '-';
  };

  const getCargoNome = (id) => {
    if (!id) return '-';
    const cargo = cargos.find(c => String(c.id) === String(id));
    return cargo ? cargo.nome : '-';
  };

  const getEmpresaNome = (id) => {
    const emp = empresas.find(e => String(e.id) === String(id));
    return emp ? emp.razao_social : '-';
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600 }}>Funcionários</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', padding: '2px', border: '1px solid var(--glass-border)' }}>
            {['ativos', 'inativos', 'todos'].map(f => (
              <button key={f} className="btn-primary" style={{
                padding: '0.3rem 0.8rem', fontSize: '0.8rem',
                background: filtroAtivo === f ? 'var(--accent-gradient)' : 'transparent',
                color: filtroAtivo === f ? 'white' : 'var(--text-secondary)',
                boxShadow: 'none', border: 'none', borderRadius: 'var(--radius-full)'
              }} onClick={() => setFiltroAtivo(f)}>
                {f === 'ativos' ? 'Ativos' : f === 'inativos' ? 'Inativos' : 'Todos'}
              </button>
            ))}
          </div>
          {podeEditar && (
            <button
              className="btn-primary"
              onClick={() => setSubTab('novo_func')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} /> Novo Funcionário
            </button>
          )}
        </div>
      </div>
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="form-input"
          placeholder="Pesquisar por nome, CPF ou matrícula..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', paddingLeft: '2.5rem' }}
        />
      </div>
      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nome do Colaborador</th>
                <th>CPF/PIS</th>
                <th>Folha</th>
                <th>Status</th>
                <th style={{ width: '120px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                  </td>
                </tr>
              ) : FuncionariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    {filtroAtivo === 'inativos' ? 'Nenhum funcionário inativo encontrado' : 'Nenhum funcionário encontrado'}
                  </td>
                </tr>
              ) : (
                FuncionariosFiltrados.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.matricula || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong>{f.nome}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {getDepartamentoNome(f.departamento)} · {getCargoNome(f.cargo)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {getEmpresaNome(f.empresa_id)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                        <span>{f.cpf || '-'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{f.pis || '-'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{f.folha || '-'}</td>
                    <td>
                      {f.ativo === false ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                          background: 'rgba(239,68,68,0.15)', color: 'var(--danger)'
                        }}>
                          Inativo
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                          background: 'rgba(34,197,94,0.15)', color: 'var(--success)'
                        }}>
                          Ativo
                        </span>
                      )}
                    </td>
                    <td>
                      {podeEditar ? (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn-primary"
                            onClick={() => handleEditarFuncionario(f)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn-primary"
                            onClick={() => handleDeleteClick(f)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', boxShadow: 'none' }}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          open={!!confirmDelete}
          title="Excluir Funcionário"
          message={`Excluir funcionário ${confirmDelete.nome}? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => {
            document.body.style.overflow = '';
            handleExcluirFuncionario(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => {
            document.body.style.overflow = '';
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}
