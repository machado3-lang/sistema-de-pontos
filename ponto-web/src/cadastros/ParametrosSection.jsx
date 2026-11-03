import { useState } from 'react';
import { Sliders, Plus, Edit2, Trash2, Copy, Save, X, Clock } from 'lucide-react';
import ParametrosConfig from './ParametrosConfig';

function carregarLocal(key, padrao) {
  try { return JSON.parse(localStorage.getItem(key)) || padrao; } catch { return padrao; }
}
function salvarLocal(key, valor) {
  try { localStorage.setItem(key, JSON.stringify(valor)); } catch {}
}

function migrarConfigAntiga() {
  const antiga = carregarLocal('ponto_parametros_config', null);
  if (!antiga) return null;
  const list = carregarLocal('ponto_parametros_list', []);
  if (list.length > 0) return list;
  return [{ id: 1, nome: 'Padrão', config: antiga }];
}

function getPadrao() {
  return {
    noturno: { percentual_adicional: 20, hora_reduzida_min: 52, hora_reduzida_seg: 30, inicio: '22:00', fim: '05:00' },
    horas_extras: { dias_uteis: { faixa1_limite: 120, faixa1_pct: 50, faixa2_pct: 100 }, sabados: { faixa1_limite: 120, faixa1_pct: 50, faixa2_pct: 100 }, domingos_feriados: { faixa1_limite: 0, faixa1_pct: 100, faixa2_pct: 100 } },
    banco_horas: { ativo: false, limite_positivo: 40, limite_negativo: 10, prazo_compensacao_dias: 90 },
    faltas_atrasos: { tolerancia_atraso_minutos: 10, desconto_dsr_faltas: true, faltas_para_perder_dsr: 5, falta_justificada_medico: true, carencia_dias_atestado: 15 },
    clt_art58: { metodo: 'clt_completo', tolerancia_entrada_minutos: 10, tolerancia_saida_minutos: 10, tolerancia_intervalo_minutos: 0 },
    dsr: { percentual_sobre_he: 100, inclui_feriados: true, modulo_calc_dsr: 'media_he' },
  };
}

export default function ParametrosSection({ onVoltar }) {
  const [list, setList] = useState(() => {
    const migrado = migrarConfigAntiga();
    if (migrado) {
      salvarLocal('ponto_parametros_list', migrado);
      return migrado;
    }
    const existente = carregarLocal('ponto_parametros_list', []);
    if (existente.length === 0) {
      const padrao = [{ id: 1, nome: 'Padrão', config: getPadrao() }];
      salvarLocal('ponto_parametros_list', padrao);
      return padrao;
    }
    return existente;
  });
  const [editandoId, setEditandoId] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  const nextId = () => (list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1);

  const persist = (novaLista) => {
    setList(novaLista);
    salvarLocal('ponto_parametros_list', novaLista);
  };

  const handleAdd = () => {
    const nome = novoNome.trim() || `Parâmetros ${list.length + 1}`;
    persist([...list, { id: nextId(), nome, config: getPadrao() }]);
    setNovoNome('');
  };

  const handleRename = (id) => {
    const val = renameVal.trim();
    if (!val) { setRenameId(null); return; }
    persist(list.map(i => i.id === id ? { ...i, nome: val } : i));
    setRenameId(null);
  };

  const handleClone = (id) => {
    const item = list.find(i => i.id === id);
    if (!item) return;
    persist([...list, { id: nextId(), nome: `${item.nome} (cópia)`, config: JSON.parse(JSON.stringify(item.config)) }]);
  };

  const handleDelete = (id) => {
    const item = list.find(i => i.id === id);
    if (!item) return;
    if (list.length <= 1) { alert('Mantenha ao menos um conjunto de parâmetros.'); return; }
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    persist(list.filter(i => i.id !== id));
    if (editandoId === id) setEditandoId(null);
  };

  const handleSaveEdit = (id, config) => {
    persist(list.map(i => i.id === id ? { ...i, config } : i));
  };

  if (editandoId) {
    const item = list.find(i => i.id === editandoId);
    if (!item) { setEditandoId(null); return null; }
    return (
      <ParametrosConfig
        initialConfig={item.config}
        nome={item.nome}
        onSave={(config) => handleSaveEdit(editandoId, config)}
        onVoltar={() => setEditandoId(null)}
      />
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={20} /> Conjuntos de Parâmetros
        </h3>
        <button className="btn-primary" onClick={onVoltar} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <X size={16} /> Voltar
        </button>
      </div>

      <div className="glass-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text" className="form-input" placeholder="Novo conjunto de parâmetros..."
            value={novoNome} onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
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
                <th style={{ width: '200px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id}>
                  <td>
                    {renameId === item.id ? (
                      <input type="text" className="form-input" value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(item.id); if (e.key === 'Escape') setRenameId(null); }}
                        style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} autoFocus />
                    ) : (
                      <strong>{item.nome}</strong>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button className="btn-primary" onClick={() => { setEditandoId(item.id); }}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }}
                        title="Editar parâmetros">
                        <Edit2 size={14} /> Configurar
                      </button>
                      <button className="btn-primary" onClick={() => { setRenameId(item.id); setRenameVal(item.nome); }}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }}
                        title="Renomear">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-primary" onClick={() => handleClone(item.id)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }}
                        title="Duplicar">
                        <Copy size={14} />
                      </button>
                      <button className="btn-primary" onClick={() => handleDelete(item.id)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }}
                        title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
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
