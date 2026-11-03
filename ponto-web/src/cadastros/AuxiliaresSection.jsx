import { useState } from 'react';
import { Plus, Edit2, Trash2, Users, Briefcase, Sliders } from './CadastrosUtils';
import {
  criarDepartamento,
  atualizarDepartamento,
  excluirDepartamento,
  criarCargo,
  atualizarCargo,
  excluirCargo,
} from '../data/pontoData';

export default function AuxiliaresSection({
  subTab, departamentos, setDepartamentos, cargos, setCargos,
  parametros, setParametros, funcionarios, podeEditar = true
}) {
  const [novoDepTab, setNovoDepTab] = useState('');
  const [editandoDepId, setEditandoDepId] = useState(null);
  const [editDepVal, setEditDepVal] = useState('');

  const [novoCarTab, setNovoCarTab] = useState('');
  const [editandoCarId, setEditandoCarId] = useState(null);
  const [editCarVal, setEditCarVal] = useState('');

  const [novoParamTab, setNovoParamTab] = useState('');
  const [editandoParamId, setEditandoParamId] = useState(null);
  const [editParamVal, setEditParamVal] = useState('');

  const countFuncPor = (field, id) => funcionarios.filter(f => String(f[field]) === String(id)).length;

  const renderSection = (config) => {
    const {
      data, setData, novoVal, setNovoVal, editandoId, setEditandoId, editVal, setEditVal,
      nameField, icon, countField, recurso,
    } = config;

    const handleAdd = async () => {
      const val = novoVal.trim();
      if (!val) return;
      try {
        const novo = await recurso.criar(val);
        setData(prev => [...prev, novo]);
        setNovoVal('');
      } catch (e) {
        alert('Erro ao adicionar: ' + e.message);
      }
    };

    const handleEdit = (item) => {
      setEditandoId(item.id);
      setEditVal(item[nameField] || '');
    };

    const handleSave = async () => {
      const val = editVal.trim();
      if (!val) return;
      try {
        const atualizado = await recurso.atualizar(editandoId, val);
        setData(prev => prev.map(i => i.id === editandoId ? { ...i, ...atualizado } : i));
        setEditandoId(null);
        setEditVal('');
      } catch (e) {
        alert('Erro ao salvar: ' + e.message);
      }
    };

    const handleCancel = () => {
      setEditandoId(null);
      setEditVal('');
    };

    const handleDelete = async (item) => {
      const nome = item[nameField] || '';
      if (!window.confirm(`Excluir "${nome}"?`)) return;
      try {
        await recurso.excluir(item.id);
        setData(prev => prev.filter(i => i.id !== item.id));
      } catch (e) {
        alert('Erro ao excluir: ' + e.message);
      }
    };

    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>{icon} {subTab.charAt(0).toUpperCase() + subTab.slice(1)}</h3>
        </div>
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder={`Novo ${subTab.slice(0, -1)}...`}
              value={novoVal}
              onChange={e => setNovoVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              style={{ flex: 1 }}
              disabled={!podeEditar}
            />
            <button className="btn-primary" onClick={handleAdd} disabled={!podeEditar} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </div>
        <div className="glass-card">
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  {countField && <th style={{ width: '80px', textAlign: 'center' }}>Vínculos</th>}
                  <th style={{ width: '100px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={countField ? 3 : 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum registro encontrado</td></tr>
                ) : (
                  data.map(item => (
                    <tr key={item.id}>
                      <td>
                        {editandoId === item.id ? (
                          <input
                            type="text"
                            className="form-input"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                            style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                            autoFocus
                          />
                        ) : (
                          <strong>{item[nameField]}</strong>
                        )}
                      </td>
                      {countField && (
                        <td style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {countFuncPor(countField, item.id)}
                        </td>
                      )}
                      <td>
                        {editandoId === item.id ? (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn-primary" onClick={handleSave} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', boxShadow: 'none' }}>Salvar</button>
                            <button className="btn-primary" onClick={handleCancel} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn-primary" onClick={() => handleEdit(item)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar"><Edit2 size={14} /></button>
                            <button className="btn-primary" onClick={() => handleDelete(item)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (subTab === 'departamentos') {
    return renderSection({
      data: departamentos, setData: setDepartamentos,
      novoVal: novoDepTab, setNovoVal: setNovoDepTab,
      editandoId: editandoDepId, setEditandoId: setEditandoDepId,
      editVal: editDepVal, setEditVal: setEditDepVal,
      nameField: 'nome', icon: <Users size={20} />, countField: 'departamento_id',
      recurso: {
        criar: criarDepartamento,
        atualizar: atualizarDepartamento,
        excluir: excluirDepartamento,
      },
    });
  }

  if (subTab === 'cargos') {
    return renderSection({
      data: cargos, setData: setCargos,
      novoVal: novoCarTab, setNovoVal: setNovoCarTab,
      editandoId: editandoCarId, setEditandoId: setEditandoCarId,
      editVal: editCarVal, setEditVal: setEditCarVal,
      nameField: 'nome', icon: <Briefcase size={20} />, countField: 'cargo_id',
      recurso: {
        criar: criarCargo,
        atualizar: atualizarCargo,
        excluir: excluirCargo,
      },
    });
  }

  if (subTab === 'parametros') {
    return renderSection({
      data: parametros, setData: setParametros,
      novoVal: novoParamTab, setNovoVal: setNovoParamTab,
      editandoId: editandoParamId, setEditandoId: setEditandoParamId,
      editVal: editParamVal, setEditVal: setEditParamVal,
      nameField: 'nome', icon: <Sliders size={20} />, countField: null,
      recurso: {
        criar: (nome) => Promise.resolve({ id: nome, nome }),
        atualizar: () => Promise.resolve({}),
        excluir: () => Promise.resolve(),
      },
    });
  }

  return null;
}
