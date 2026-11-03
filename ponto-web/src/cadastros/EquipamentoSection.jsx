import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, X, Edit2, Trash2, Cpu, Wifi, Server, Globe, CheckCircle, XCircle, RefreshCw, Upload, Download, Building2, Users } from './CadastrosUtils';
import ConfirmModal from '../components/ConfirmModal';
import { api } from '../api';
import {
  carregarEquipamentos,
  criarEquipamento,
  atualizarEquipamento,
  excluirEquipamento,
} from '../data/pontoData';

async function testCloudConnection(url) {
  try {
    const baseUrl = url.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function registerRepOnCloud(url, apiKey, repData) {
  try {
    const baseUrl = url.replace(/\/+$/, '');
    if (!apiKey) return { ok: false, error: 'Informe a chave de API do PontoCloud' };
    const repRes = await fetch(`${baseUrl}/api/reps`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(repData),
      signal: AbortSignal.timeout(5000)
    });
    if (!repRes.ok) return { ok: false, error: 'Falha ao registrar REP no cloud' };
    const data = await repRes.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getRepCloudStatus(url, apiKey, repId) {
  try {
    const baseUrl = url.replace(/\/+$/, '');
    if (!apiKey) return null;
    const statusRes = await fetch(`${baseUrl}/api/reps/${repId}/status`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!statusRes.ok) return null;
    return await statusRes.json();
  } catch {
    return null;
  }
}

function EmpresaBadge({ empresaId, empresas }) {
  const emp = empresas.find(e => String(e.id) === String(empresaId));
  if (!emp) return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>;
  return <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{emp.razao_social || emp.nome || emp.fantasia || 'Empresa'}</span>;
}

function EquipamentoLista({ equipamentos, empresas, setSubTab, resetForm, handleEditar, handleExcluir, cloudStatus, verificando }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const filtrados = equipamentos.filter(e => {
    if (filtroAtivo === 'ativos') { if (e.ativo === false) return false; }
    if (filtroAtivo === 'inativos') { if (e.ativo !== false) return false; }
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return e.nome.toLowerCase().includes(t) || e.modelo.toLowerCase().includes(t) || (e.num_serie || '').toLowerCase().includes(t);
  });

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={20} /> Equipamentos (REP)</h3>
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
          <button className="btn-primary" onClick={() => { resetForm(); setSubTab('novo_equip'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Novo Equipamento
          </button>
        </div>
      </div>
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
        <input type="text" className="form-input" placeholder="Pesquisar por nome, modelo ou serial..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Modelo</th>
                <th>Conexão</th>
                <th>Cloud</th>
                <th>Empresa</th>
                <th>Serial</th>
                <th>Status</th>
                <th style={{ width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum equipamento encontrado</td></tr>
              ) : (
                filtrados.map(e => {
                  const cs = cloudStatus[e.id];
                  return (
                    <tr key={e.id}>
                      <td><strong>{e.nome}</strong></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{e.modelo}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: e.tipo_conexao === 'idcloud' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)', color: e.tipo_conexao === 'idcloud' ? '#818cf8' : '#34d399' }}>
                          {e.tipo_conexao === 'idcloud' ? <Globe size={12} /> : <Wifi size={12} />} {e.tipo_conexao === 'idcloud' ? 'iDCloud' : 'IP Direto'}
                        </span>
                      </td>
                      <td>
                        {verificando[e.id] ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>...</span>
                        ) : cs ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: cs.status === 'online' ? 'var(--success)' : 'var(--warning)' }}>
                            {cs.status === 'online' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {cs.status === 'online' ? `Online (${cs.total_marcacoes} mar.)` : 'Offline'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td><EmpresaBadge empresaId={e.empresa_id} empresas={empresas} /></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{e.num_serie || '-'}</td>
                      <td>
                        {e.ativo === false ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>Inativo</span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}>Ativo</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn-primary" onClick={() => handleEditar(e)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar"><Edit2 size={14} /></button>
                          <button className="btn-primary" onClick={() => handleExcluir(e.id, e.nome)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EquipamentoForm({ form, setForm, editandoId, setSubTab, resetForm, handleSalvar, handleAtualizar, testando, testRes, handleTestarConexao, registrando, handleRegistrarCloud, conectandoREP, repInfo, repErro, handleConectarREP, empresas, funcionarios, handleSyncToREP, handleSyncFromREP, sincronizando, syncResult, handleLoadMarkingsFromREP, importandoMarcacoes, importMarcacoesResult, handleDownloadAFDFromREP, baixandoAFD, afdResult, handleConfigurarPush, configurandoPush, pushConfigResult, pushDevices, pushEvents, pushResults, pushMonitorLoading, pushAutoRefresh, setPushAutoRefresh, refreshPushMonitor, handleAtivarModoPonto, handleDownloadAFDiDFace, handleSendPhotos, enviandoFotos, fotosResult, handleImportarTodasPushMarcacoes, pushMarcacoes, pushMarcacoesLoading }) {
  const isEdit = editandoId !== null;
  const ehCloud = form.tipo_conexao === 'idcloud';
  const ehIFace = form.modelo === 'iDFace' || form.modelo === 'iDFace Max';
  const funcEmpresa = funcionarios.filter(f => String(f.empresa_id || '') === String(form.empresa_id || ''));

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600 }}>{isEdit ? 'Editar Equipamento' : 'Novo Equipamento'}</h3>
        <button className="btn-primary" onClick={() => { resetForm(); setSubTab('equipamentos'); }} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'none' }}>
          <X size={18} /> Cancelar
        </button>
      </div>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <Cpu size={16} /> 1. Identificação do Equipamento
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome do Equipamento *</label>
              <input type="text" className="form-input" value={form.nome} onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))} placeholder="Ex: REP Matriz" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Modelo</label>
              <select className="form-input" value={form.modelo} onChange={e => {
                const novo = e.target.value;
                const ehIFace = novo === 'iDFace' || novo === 'iDFace Max';
                setForm(prev => ({ ...prev, modelo: novo, porta: ehIFace ? '80' : '443' }));
              }}>
                <option value="iDClass">iDClass</option>
                <option value="iDClass Mult">iDClass Mult</option>
                <option value="iDClass Bio Prox">iDClass Bio Prox</option>
                <option value="iDFace">iDFace</option>
                <option value="iDFace Max">iDFace Max</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nº de Série</label>
              <input type="text" className="form-input" value={form.num_serie} onChange={e => setForm(prev => ({ ...prev, num_serie: e.target.value }))} placeholder="Serial do equipamento" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Empresa Vinculada</label>
              <select className="form-input" value={form.empresa_id} onChange={e => setForm(prev => ({ ...prev, empresa_id: e.target.value }))}>
                <option value="">Selecione uma empresa</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.razao_social || emp.nome || emp.fantasia || 'Empresa'}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Localização</label>
              <input type="text" className="form-input" value={form.localizacao} onChange={e => setForm(prev => ({ ...prev, localizacao: e.target.value }))} placeholder="Ex: Sala da administração" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '0.25rem' }}>
                <button onClick={() => setForm(prev => ({ ...prev, ativo: !prev.ativo }))} style={{
                  width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                  background: form.ativo ? 'var(--success)' : 'var(--glass-border)', transition: 'background 0.2s'
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px',
                    left: form.ativo ? '24px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
                <span style={{ fontSize: '0.85rem', color: form.ativo ? 'var(--success)' : 'var(--text-muted)' }}>{form.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

        <div>
          <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <Server size={16} /> 2. Conexão
          </h4>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {['ip_direto', 'idcloud'].map(t => (
              <button key={t} onClick={() => setForm(prev => ({ ...prev, tipo_conexao: t }))} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                background: form.tipo_conexao === t ? 'var(--accent-gradient)' : 'transparent',
                color: form.tipo_conexao === t ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${form.tipo_conexao === t ? 'transparent' : 'var(--glass-border)'}`,
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
              }}>
                {t === 'ip_direto' ? <Wifi size={16} /> : <Globe size={16} />}
                {t === 'ip_direto' ? 'IP Direto' : 'PontoCloud'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>URL do PontoCloud *</label>
              <input type="url" className="form-input" value={form.cloud_url} onChange={e => setForm(prev => ({ ...prev, cloud_url: e.target.value }))} placeholder="http://localhost:3100" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Chave de API</label>
              <input type="text" className="form-input" value={form.api_key} onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))} placeholder="Informe o API_TOKEN do servidor" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <button onClick={handleTestarConexao} disabled={testando || !form.cloud_url} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 1rem',
              background: testRes?.ok ? 'rgba(34,197,94,0.15)' : testRes ? 'rgba(239,68,68,0.15)' : 'var(--glass-border)',
              border: `1px solid ${testRes?.ok ? 'var(--success)' : testRes ? 'var(--danger)' : 'var(--glass-border)'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer', color: testRes?.ok ? 'var(--success)' : testRes ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.8rem'
            }}>
              {testando ? 'Testando...' : <><RefreshCw size={14} /> Testar Conexão com PontoCloud</>}
            </button>
            {testRes && (
              <span style={{ fontSize: '0.8rem', color: testRes.ok ? 'var(--success)' : 'var(--danger)' }}>
                {testRes.ok ? `Conectado (${testRes.data.service} v${testRes.data.version})` : `Falha: ${testRes.error}`}
              </span>
            )}
          </div>

          {ehCloud ? (
            <>
              {testRes?.ok && form.nome && (
                <div style={{ marginBottom: '1rem' }}>
                  <button onClick={handleRegistrarCloud} disabled={registrando} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 1rem',
                    background: 'rgba(99,102,241,0.15)', border: '1px solid var(--accent-primary)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.8rem'
                  }}>
                    {registrando ? 'Registrando...' : <><Plus size={14} /> Registrar Equipamento na Nuvem</>}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Endereço IP *</label>
                  <input type="text" className="form-input" value={form.ip} onChange={e => setForm(prev => ({ ...prev, ip: e.target.value }))} placeholder="192.168.0.100" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Porta</label>
                  <input type="number" className="form-input" value={form.porta} onChange={e => setForm(prev => ({ ...prev, porta: e.target.value }))} placeholder="443" min="1" max="65535" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Usuário</label>
                  <input type="text" className="form-input" value={form.usuario} onChange={e => setForm(prev => ({ ...prev, usuario: e.target.value }))} placeholder="admin" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Senha</label>
                  <input type="password" className="form-input" value={form.senha} onChange={e => setForm(prev => ({ ...prev, senha: e.target.value }))} placeholder="admin" />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleConectarREP} disabled={conectandoREP || !form.ip} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 1rem',
                  background: repInfo ? 'rgba(34,197,94,0.15)' : repErro ? 'rgba(239,68,68,0.15)' : 'var(--glass-border)',
                  border: `1px solid ${repInfo ? 'var(--success)' : repErro ? 'var(--danger)' : 'var(--glass-border)'}`,
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  color: repInfo ? 'var(--success)' : repErro ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.8rem'
                }}>
                  {conectandoREP ? 'Conectando...' : <><RefreshCw size={14} /> {repInfo ? 'Reconectar' : 'Conectar ao REP'}</>}
                </button>
                {conectandoREP && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verificando...</span>}
                {repErro && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Erro: {repErro}</span>}
              </div>

              {repInfo && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} /> {ehIFace ? 'iDFace Conectado' : 'REP Conectado'}
                  </div>
                  {ehIFace ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Serial:</span> <strong>{repInfo.serial || repInfo.system?.serial || '-'}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Firmware:</span> <strong>{repInfo.system?.version || repInfo.system?.versaoFW || '-'}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Sessão:</span> <strong>{(repInfo.session || '').slice(0, 12)}...</strong></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Modo:</span>
                        {repInfo.modo === 'ponto' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}>
                            Ponto (REP P)
                          </span>
                        ) : repInfo.modo === 'acesso' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                            Acesso
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(251,191,36,0.15)', color: 'var(--warning)' }}>
                            Desconhecido
                          </span>
                        )}
                        {repInfo.modo === 'acesso' && (
                          <>
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
                              ⚠️ Modo Acesso ativo
                            </span>
                            <button onClick={() => handleAtivarModoPonto(form)} style={{
                              display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.75rem',
                              background: 'rgba(34,197,94,0.15)', border: '1px solid var(--success)',
                              borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--success)', fontSize: '0.75rem'
                            }}>
                              Ativar Modo Ponto
                            </button>
                          </>
                        )}
                      </div>
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleDownloadAFDiDFace(form)} disabled={baixandoAFD} style={{
                          display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.75rem',
                          background: 'rgba(139,92,246,0.15)', border: '1px solid #8b5cf6',
                          borderRadius: 'var(--radius-md)', cursor: 'pointer', color: '#8b5cf6', fontSize: '0.75rem'
                        }}>
                          <Download size={14} /> {baixandoAFD ? 'Gerando...' : 'Download AFD'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Serial:</span> <strong>{repInfo.about?.nSerie || '-'}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>MAC:</span> <strong>{repInfo.about?.mac || '-'}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Firmware:</span> <strong>{repInfo.about?.versaoFW || '-'}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Usuários:</span> <strong>{repInfo.info?.usuarios || 0}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Tickets:</span> <strong>{repInfo.info?.tickets || 0}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Última NSR:</span> <strong>{repInfo.sistema?.ultimaNSR || '-'}</strong></div>
                    </div>
                  )}
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Portaria:</span>
                    {['auto', '671', '1510'].map(p => (
                      <button key={p} onClick={() => setForm(prev => ({ ...prev, portaria: p }))} style={{
                        padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        background: form.portaria === p ? 'var(--accent-gradient)' : 'transparent',
                        color: form.portaria === p ? '#fff' : 'var(--text-secondary)'
                      }}>
                        {p === 'auto' ? 'Auto' : p === '671' ? '671 (CPF)' : '1510 (PIS)'}
                      </button>
                    ))}
                    {repInfo.portaria && repInfo.portaria !== 'auto' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        (detectado: {repInfo.portaria})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {(isEdit && form.empresa_id) && (
          <>
            <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />
            <div>
              <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <Building2 size={16} /> 3. Sincronização de Funcionários
              </h4>
              <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem' }}>
                <span><Users size={14} /> Sistema: <strong>{funcEmpresa.length}</strong> funcionários</span>
                <span><Cpu size={14} /> {ehIFace ? 'iDFace' : 'REP'}: <strong>{repInfo?.info?.usuarios || repInfo?.system?.user_count || '—'}</strong> usuários</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleSyncToREP(form)} disabled={sincronizando || !repInfo} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
                  background: 'rgba(99,102,241,0.15)', border: '1px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-md)', cursor: repInfo ? 'pointer' : 'not-allowed', color: 'var(--accent-primary)', fontSize: '0.85rem', opacity: repInfo ? 1 : 0.5
                }}>
                  <Upload size={16} /> {sincronizando ? 'Sincronizando...' : `Enviar ${funcEmpresa.length} func. para o ${ehIFace ? 'iDFace' : 'REP'}`}
                </button>
                <button onClick={() => handleSyncFromREP(form)} disabled={sincronizando || !repInfo} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
                  background: 'rgba(34,197,94,0.15)', border: '1px solid var(--success)',
                  borderRadius: 'var(--radius-md)', cursor: repInfo ? 'pointer' : 'not-allowed', color: 'var(--success)', fontSize: '0.85rem', opacity: repInfo ? 1 : 0.5
                }}>
                  <Download size={16} /> {sincronizando ? 'Sincronizando...' : `Receber func. do ${ehIFace ? 'iDFace' : 'REP'}`}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                <button onClick={() => handleLoadMarkingsFromREP(form)} disabled={importandoMarcacoes || !repInfo} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
                  background: 'rgba(251,191,36,0.15)', border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-md)', cursor: repInfo ? 'pointer' : 'not-allowed', color: 'var(--warning)', fontSize: '0.85rem', opacity: repInfo ? 1 : 0.5
                }}>
                  <RefreshCw size={16} /> {importandoMarcacoes ? 'Importando...' : `Importar Marcações do ${ehIFace ? 'iDFace' : 'REP'}`}
                </button>
                {ehIFace && (
                <button onClick={() => handleSendPhotos(form)} disabled={enviandoFotos || !repInfo} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
                  background: repInfo ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.05)',
                  border: `1px solid ${repInfo ? '#f43f5e' : 'var(--glass-border)'}`,
                  borderRadius: 'var(--radius-md)', cursor: repInfo ? 'pointer' : 'not-allowed', color: repInfo ? '#f43f5e' : 'var(--text-muted)', fontSize: '0.85rem', opacity: repInfo ? 1 : 0.5
                }}>
                  <Upload size={16} /> {enviandoFotos ? 'Enviando...' : 'Enviar Fotos'}
                </button>
                )}
                {!ehIFace && (
                <button onClick={() => handleDownloadAFDFromREP(form)} disabled={baixandoAFD || !repInfo} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
                  background: 'rgba(139,92,246,0.15)', border: '1px solid #8b5cf6',
                  borderRadius: 'var(--radius-md)', cursor: repInfo ? 'pointer' : 'not-allowed', color: '#8b5cf6', fontSize: '0.85rem', opacity: repInfo ? 1 : 0.5
                }}>
                  <Download size={16} /> {baixandoAFD ? 'Baixando...' : 'Download AFD'}
                </button>
                )}
              </div>
              {importMarcacoesResult && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: importMarcacoesResult.ok ? 'rgba(251,191,36,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${importMarcacoesResult.ok ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <span style={{ color: importMarcacoesResult.ok ? 'var(--warning)' : 'var(--danger)' }}>{importMarcacoesResult.message}</span>
                </div>
              )}
              {afdResult && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: afdResult.ok ? 'rgba(139,92,246,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${afdResult.ok ? 'rgba(139,92,246,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <span style={{ color: afdResult.ok ? '#8b5cf6' : 'var(--danger)' }}>{afdResult.message}</span>
                </div>
              )}
              {syncResult && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: syncResult.ok ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${syncResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  {syncResult.ok ? (
                    <span style={{ color: 'var(--success)' }}>{syncResult.message}</span>
                  ) : (
                    <span style={{ color: 'var(--danger)' }}>Erro: {syncResult.message}</span>
                  )}
                </div>
              )}
              {fotosResult && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: fotosResult.ok ? 'rgba(244,63,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${fotosResult.ok ? 'rgba(244,63,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <span style={{ color: fotosResult.ok ? '#f43f5e' : 'var(--danger)' }}>{fotosResult.message}</span>
                </div>
              )}
            </div>
          </>
        )}

        <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

        {ehIFace && (
          <>
            <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />
            <div>
              <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <Globe size={16} /> 4. Servidor Push (coleta em tempo real)
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Configure o iDFace para enviar marcações automaticamente para o servidor MultiPonto.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button onClick={() => handleConfigurarPush(form)} disabled={configurandoPush || !repInfo} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
                  background: repInfo ? 'rgba(6,182,212,0.15)' : 'var(--glass-border)',
                  border: `1px solid ${repInfo ? '#06b6d4' : 'var(--glass-border)'}`,
                  borderRadius: 'var(--radius-md)', cursor: repInfo ? 'pointer' : 'not-allowed',
                  color: repInfo ? '#06b6d4' : 'var(--text-muted)', fontSize: '0.85rem', opacity: repInfo ? 1 : 0.5
                }}>
                  <RefreshCw size={16} /> {configurandoPush ? 'Configurando...' : `Configurar Push: ${form.cloud_url || 'http://localhost:3100'}/push`}
                </button>
                {!repInfo && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Conecte ao iDFace primeiro</span>}
              </div>
              {pushConfigResult && (
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: pushConfigResult.ok ? 'rgba(6,182,212,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${pushConfigResult.ok ? 'rgba(6,182,212,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <span style={{ color: pushConfigResult.ok ? '#06b6d4' : 'var(--danger)' }}>{pushConfigResult.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Monitor</h5>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pushAutoRefresh} onChange={e => setPushAutoRefresh(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                  Auto 15s
                </label>
                <button onClick={refreshPushMonitor} disabled={pushMonitorLoading} style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '0.3rem 0.8rem',
                  background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem'
                }}>
                  <RefreshCw size={14} /> Atualizar
                </button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Dispositivos Conectados</h5>
                {Object.keys(pushDevices).length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhum dispositivo conectado ao servidor Push.</p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Serial</th>
                          <th>IP</th>
                          <th>Status</th>
                          <th>Último contato</th>
                          <th>Polls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(pushDevices).map(([key, info]) => (
                          <tr key={key}>
                            <td style={{ fontWeight: 500 }}>{info.serial || key.split('@')[0]}</td>
                            <td style={{ fontSize: '0.85rem' }}>{info.ip}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: info.online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: info.online ? 'var(--success)' : 'var(--danger)' }}>
                                {info.online ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{info.last_seen}</td>
                            <td style={{ fontSize: '0.85rem' }}>{info.poll_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Eventos de Marcação (últimos)</h5>
                {pushEvents.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhum evento recebido.</p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Recebido</th>
                          <th>Dispositivo</th>
                          <th>Usuário</th>
                          <th>Evento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pushEvents.slice(0, 10).map((ev, i) => {
                          const data = ev.data || {};
                          const uid = data.user_id || data.userId || data.id_user || '';
                          const nome = data.name || data.user_name || (uid ? `ID ${uid}` : 'Desconhecido');
                          const evNum = data.event || data.event_type || data.type || '';
                          const isAllowed = String(evNum) === '7';
                          return (
                            <tr key={i}>
                              <td style={{ fontSize: '0.8rem' }}>{ev.received_at}</td>
                              <td style={{ fontSize: '0.85rem' }}>{ev.serial || ev.device_id}</td>
                              <td style={{ fontSize: '0.85rem' }}>{nome}</td>
                              <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: isAllowed ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)', color: isAllowed ? 'var(--success)' : 'var(--warning)' }}>
                                  {isAllowed ? 'Acesso Permitido' : `Evento ${evNum}`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Resultados de Comandos</h5>
                {pushResults.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhum resultado de comando.</p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Recebido</th>
                          <th>Dispositivo</th>
                          <th>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pushResults.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: '0.8rem' }}>{r.received_at}</td>
                            <td style={{ fontSize: '0.85rem' }}>{r.serial || r.device_id}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {JSON.stringify(r.data).slice(0, 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Marcações via Push {pushMarcacoes.length > 0 && <span style={{ color: 'var(--success)' }}>({pushMarcacoes.length} pendentes)</span>}
                </h5>
                {pushMarcacoes.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleImportarTodasPushMarcacoes(form)} disabled={pushMarcacoesLoading} style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 0.8rem',
                      background: 'rgba(34,197,94,0.15)', border: '1px solid var(--success)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--success)', fontSize: '0.8rem'
                    }}>
                      <Download size={14} /> Importar {pushMarcacoes.length} p/ o sistema
                    </button>
                  </div>
                )}
                {pushMarcacoesLoading ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Carregando...</p>
                ) : pushMarcacoes.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhuma marcação pendente via Push.</p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Hora</th>
                          <th>Usuário ID</th>
                          <th>Serial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pushMarcacoes.slice(0, 20).map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: '0.85rem' }}>{m.data}</td>
                            <td style={{ fontSize: '0.85rem' }}>{m.hora?.slice(0, 5)}</td>
                            <td style={{ fontSize: '0.85rem' }}>{m.user_id}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.serial}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />
        <div>
          <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            5. Observações
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea className="form-input" value={form.observacoes} onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))} placeholder="Informações adicionais sobre o equipamento..." style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button className="btn-primary" onClick={isEdit ? handleAtualizar : handleSalvar} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={18} /> {isEdit ? 'Atualizar Equipamento' : 'Salvar Equipamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EquipamentoSection({ subTab, setSubTab, empresas = [], funcionarios = [] }) {
  const [equipamentos, setEquipamentos] = useState([]);
  const [carregandoEquip, setCarregandoEquip] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [cloudStatus, setCloudStatus] = useState({});
  const [verificando, setVerificando] = useState({});
  const [testando, setTestando] = useState(false);
  const [testRes, setTestRes] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [cloudRepId, setCloudRepId] = useState(null);
  const [conectandoREP, setConectandoREP] = useState(false);
  const [repInfo, setRepInfo] = useState(null);
  const [repErro, setRepErro] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [importandoMarcacoes, setImportandoMarcacoes] = useState(false);
  const [importMarcacoesResult, setImportMarcacoesResult] = useState(null);
  const [baixandoAFD, setBaixandoAFD] = useState(false);
  const [afdResult, setAfdResult] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
  const [pushDevices, setPushDevices] = useState({});
  const [pushEvents, setPushEvents] = useState([]);
  const [pushResults, setPushResults] = useState([]);
  const [pushMonitorLoading, setPushMonitorLoading] = useState(false);
  const [pushAutoRefresh, setPushAutoRefresh] = useState(false);
  const [configurandoPush, setConfigurandoPush] = useState(false);
  const [pushConfigResult, setPushConfigResult] = useState(null);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [fotosResult, setFotosResult] = useState(null);
  const [pushMarcacoes, setPushMarcacoes] = useState([]);
  const [pushMarcacoesLoading, setPushMarcacoesLoading] = useState(false);

  const waitForConfirm = (title, message, confirmLabel, cancelLabel) => new Promise((resolve) => {
    document.body.style.overflow = 'hidden';
    setConfirmModal({
      open: true, title, message, confirmLabel, cancelLabel,
      onConfirm: () => { document.body.style.overflow = ''; setConfirmModal(prev => ({ ...prev, open: false })); resolve(true); },
      onCancel: () => { document.body.style.overflow = ''; setConfirmModal(prev => ({ ...prev, open: false })); resolve(false); }
    });
  });

  useEffect(() => {
    let ativo = true;
    carregarEquipamentos()
      .then((lista) => { if (ativo) setEquipamentos(lista); })
      .catch(() => {
        // Sem conexão: a lista fica vazia até a próxima carga.
      })
      .finally(() => { if (ativo) setCarregandoEquip(false); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const repsCloud = equipamentos.filter(e => e.tipo_conexao === 'idcloud' && e.cloud_url);
    if (repsCloud.length === 0) return;
    const vf = {};
    repsCloud.forEach(e => { vf[e.id] = true; });
    setVerificando(vf);
    Promise.all(repsCloud.map(async e => {
      const status = await getRepCloudStatus(e.cloud_url, e.api_key, e.cloud_rep_id);
      return { id: e.id, status };
    })).then(results => {
      const novoSt = {};
      results.forEach(r => { novoSt[r.id] = r.status; });
      setCloudStatus(novoSt);
      setVerificando({});
    });
  }, [equipamentos]);

  const equipPadrao = {
    nome: '', modelo: 'iDClass', num_serie: '', localizacao: '', ativo: true,
    tipo_conexao: 'idcloud', cloud_url: '', api_key: '',
    ip: '', porta: '443', usuario: 'admin', senha: 'admin',
    observacoes: '', cloud_rep_id: '', empresa_id: '', portaria: 'auto'
  };

  const [form, setForm] = useState({ ...equipPadrao });

  const isIFace = () => form.modelo === 'iDFace' || form.modelo === 'iDFace Max';

  const resetForm = () => {
    setForm({ ...equipPadrao });
    setTestRes(null);
    setCloudRepId(null);
    setRepInfo(null);
    setRepErro(null);
    setSyncResult(null);
    setImportMarcacoesResult(null);
    setAfdResult(null);
  };

  const handleTestarConexao = async () => {
    if (!form.cloud_url) return;
    setTestando(true);
    setTestRes(null);
    const res = await testCloudConnection(form.cloud_url);
    setTestRes(res);
    setTestando(false);
  };

  const handleRegistrarCloud = async () => {
    if (!form.cloud_url || !form.nome) return;
    setRegistrando(true);
    const res = await registerRepOnCloud(form.cloud_url, form.api_key, {
      nome: form.nome, modelo: form.modelo, num_serie: form.num_serie, localizacao: form.localizacao
    });
    if (res.ok) {
      setCloudRepId(res.data.id);
      setForm(prev => ({ ...prev, cloud_rep_id: res.data.id }));
      alert(`REP registrado na nuvem com ID: ${res.data.id}`);
    } else {
      alert(`Erro ao registrar: ${res.error}`);
    }
    setRegistrando(false);
  };

  function detectPortariaFromAFD(afdText) {
    const linhas = afdText.split('\n');
    for (const linha of linhas) {
      if (linha.length > 9 && linha[9] === '3') {
        return (linha.length > 14 && linha[14] === '-') ? '671' : '1510';
      }
    }
    return null;
  }

  async function autoDetectPortaria(ip, porta, usuario, senha) {
    try {
      const cloudUrl = form.cloud_url || 'http://localhost:3100';
      const token = form.api_key || '';
      const hoje = new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams({ ip, porta, usuario, senha, data_inicio: hoje, data_fim: hoje });
      const res = await fetch(`${cloudUrl}/api/reps/proxy/afd/download?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        return detectPortariaFromAFD(text) || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  const handleConectarREP = async () => {
    if (!form.ip) return;
    setConectandoREP(true);
    setRepInfo(null);
    setRepErro(null);
    setFotosResult(null);
    const cloudUrl = form.cloud_url || 'http://localhost:3100';
    const token = form.api_key || '';
    try {
      let data;
      if (isIFace()) {
        const res = await fetch(`${cloudUrl}/api/reps/proxy/iface/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ ip: form.ip, porta: form.porta || '80', usuario: form.usuario || 'admin', senha: form.senha || 'admin' })
        });
        if (!res.ok) {
          const err = await res.json();
          return setRepErro(err.detalhe || err.error || 'Falha na conexão com iDFace');
        }
        data = await res.json();
        data._tipo = 'iface';
      } else {
        const params = new URLSearchParams({ ip: form.ip, porta: form.porta || '443', usuario: form.usuario || 'admin', senha: form.senha || 'admin' });
        const res = await fetch(`${cloudUrl}/api/reps/proxy/info?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const err = await res.json();
          return setRepErro(err.detalhe || err.error || 'Falha na conexão');
        }
        data = await res.json();
        data._tipo = 'idclass';
      }

      const serialREP = data.serial || data.about?.nSerie;
      if (serialREP) {
        if (form.num_serie && form.num_serie !== serialREP) {
          if (window.confirm(
            `Nº de série do equipamento (${serialREP}) diverge do cadastro (${form.num_serie}).\n\n` +
            `OK → Atualizar cadastro com o serial do equipamento\n` +
            `Cancelar → Manter o serial atual`
          )) {
            setForm(prev => ({ ...prev, num_serie: serialREP }));
          }
        } else if (!form.num_serie) {
          setForm(prev => ({ ...prev, num_serie: serialREP }));
        }
      }
      if (isIFace()) {
        if (data.modo_acesso) {
          const continuar = window.confirm(
            `⚠️ ATENÇÃO: O equipamento iDFace está em MODO ACESSO.\n\n` +
            `Para funcionar como REP P (coletor de ponto), ele precisa estar em MODO PONTO.\n\n` +
            `Deseja continuar mesmo assim? Você poderá apenas visualizar informações, mas as marcações podem não ser compatíveis.`
          );
          if (!continuar) {
            setConectandoREP(false);
            return;
          }
        }
        setForm(prev => ({ ...prev, modo: data.modo }));
      }

      if (form.portaria === 'auto' && !isIFace()) {
        const portariaDetectada = await autoDetectPortaria(form.ip, form.porta, form.usuario, form.senha);
        if (portariaDetectada) {
          data.portaria = portariaDetectada;
          setForm(prev => ({ ...prev, portaria: portariaDetectada }));
        }
      }
      setRepInfo(data);
    } catch (e) {
      setRepErro(e.message);
    }
    setConectandoREP(false);
  };

  const handleSyncToREP = async (equip) => {
    if (!equip.empresa_id || !repInfo) return;
    setSincronizando(true);
    setSyncResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    const funcs = funcionarios.filter(f => String(f.empresa_id || '') === String(equip.empresa_id));
    const ehIFace = equip.modelo === 'iDFace' || equip.modelo === 'iDFace Max';

    if (ehIFace) {
      try {
        const values = funcs.map(f => ({
          id: parseInt(f.matricula?.replace(/\D/g, '') || '0') || 0,
          name: f.nome || '',
          registration: f.matricula || '',
          cpf: f.cpf ? f.cpf.replace(/\D/g, '') : '',
          pis: f.pis ? f.pis.replace(/\D/g, '') : '',
        })).filter(u => u.id > 0);

        if (values.length === 0) {
          setSyncResult({ ok: false, message: 'Nenhum funcionário com matrícula válida para enviar ao iDFace' });
          setSincronizando(false);
          return;
        }

        // Criar usuários no iDFace (create_objects faz upsert)
        const res = await fetch(`${cloudUrl}/api/reps/proxy/iface/users/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta || '80',
            usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
            session: repInfo.sessao || repInfo.session,
            values,
          })
        });
        const data = await res.json();
        if (res.ok) {
          setSyncResult({ ok: true, message: `${values.length} funcionários enviados ao iDFace` });
        } else {
          setSyncResult({ ok: false, message: data.error || 'Falha ao sincronizar com iDFace' });
        }
      } catch (e) {
        setSyncResult({ ok: false, message: e.message });
      }
      setSincronizando(false);
      return;
    }

    const portaria = equip.portaria === '1510' ? '1510' : '671';
    const idField = portaria === '1510' ? 'pis' : 'cpf';
    const users = funcs.map(f => ({
      [idField]: parseInt((f[idField] || '').replace(/\D/g, '') || '0'),
      name: f.nome || '',
      registration: parseInt(f.matricula?.replace(/\D/g, '') || '0') || 0,
      password: '1234',
      code: parseInt(f.matricula?.slice(-6) || '0') || 0
    })).filter(u => u[idField] > 0);

    if (users.length === 0) {
      const campo = portaria === '1510' ? 'PIS' : 'CPF';
      setSyncResult({ ok: false, message: `Nenhum funcionário com ${campo} válido para enviar` });
      setSincronizando(false);
      return;
    }

    try {
      // 1. Carregar usuários existentes no REP pelos PIS/CPF
      const ids = users.map(u => u[idField]);
      const loadRes = await fetch(`${cloudUrl}/api/reps/proxy/users/load`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ip: equip.ip, porta: equip.porta, usuario: equip.usuario, senha: equip.senha,
          session: repInfo.sessao, ids, mode: portaria
        })
      });
      const loadData = await loadRes.json();
      const existingUsers = (loadData.users || []).filter(u => u[idField]);
      const existingMap = {};
      existingUsers.forEach(u => { existingMap[u[idField]] = u; });

      // 2. Separar novos, atualizar e iguais
      const toAdd = [];
      const toUpdate = [];
      const unchanged = [];
      for (const u of users) {
        const existing = existingMap[u[idField]];
        if (!existing) {
          toAdd.push(u);
        } else {
          const diff = [];
          if (existing.name !== u.name) diff.push('nome');
          if ((existing.registration || 0) !== u.registration) diff.push('matrícula');
          if (diff.length === 0) {
            unchanged.push(u);
          } else {
            toUpdate.push({ ...u, _diff: diff.join(', ') });
          }
        }
      }

      // 3. Confirmação se houver atualizações
      if (toUpdate.length > 0) {
        const confirmed = await waitForConfirm(
          'Atualizar Funcionários no REP',
          `${toAdd.length} novo(s), ${toUpdate.length} para atualizar (${toUpdate.map(u => u._diff).join('; ')}).\nDeseja atualizar os existentes?`,
          'Atualizar', 'Cancelar'
        );
        if (!confirmed) {
          setSyncResult({ ok: true, message: `${unchanged.length} funcionários já estavam iguais. Nada foi alterado.` });
          setSincronizando(false);
          return;
        }
      }

      // 4. Adicionar novos
      let added = 0;
      if (toAdd.length > 0) {
        const addRes = await fetch(`${cloudUrl}/api/reps/proxy/users/add`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta, usuario: equip.usuario, senha: equip.senha,
            session: repInfo.sessao, users: toAdd, mode: portaria
          })
        });
        const addData = await addRes.json();
        if (addRes.ok && !addData.error) added = toAdd.length;
      }

      // 5. Atualizar existentes com diferenças
      let updated = 0;
      if (toUpdate.length > 0) {
        const updRes = await fetch(`${cloudUrl}/api/reps/proxy/users/update`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta, usuario: equip.usuario, senha: equip.senha,
            session: repInfo.sessao, users: toUpdate, mode: portaria
          })
        });
        const updData = await updRes.json();
        if (updRes.ok && !updData.error) updated = toUpdate.length;
      }

      const parts = [];
      if (added > 0) parts.push(`${added} adicionado(s)`);
      if (updated > 0) parts.push(`${updated} atualizado(s)`);
      if (unchanged.length > 0) parts.push(`${unchanged.length} inalterado(s)`);
      setSyncResult({ ok: true, message: parts.join(', ') || 'Nenhuma alteração necessária' });
    } catch (e) {
      setSyncResult({ ok: false, message: e.message });
    }
    setSincronizando(false);
  };

  const handleSyncFromREP = async (equip) => {
    if (!equip.empresa_id || !repInfo) return;
    setSincronizando(true);
    setSyncResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    const ehIFace = equip.modelo === 'iDFace' || equip.modelo === 'iDFace Max';

    try {
      let data;
      if (ehIFace) {
        const res = await fetch(`${cloudUrl}/api/reps/proxy/iface/users/load`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta || '80',
            usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
            session: repInfo.sessao || repInfo.session,
          })
        });
        data = await res.json();
        if (res.ok && data.users) {
          data.users = data.users;
        } else {
          setSyncResult({ ok: false, message: data.error || 'Nenhum usuário encontrado no iDFace' });
          setSincronizando(false);
          return;
        }
      } else {
        const portaria = equip.portaria === '1510' ? '1510' : '671';
        const res = await fetch(`${cloudUrl}/api/reps/proxy/users/load`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta, usuario: equip.usuario, senha: equip.senha,
            session: repInfo.sessao, mode: portaria
          })
        });
        data = await res.json();
      }

      if (ehIFace) {
        const novosFuncs = [];
        let jaExistem = 0;
        for (const u of (data.users || [])) {
          const doc = String(u.id || u.registration || '');
          if (doc) {
            const matricula = doc.replace(/\D/g, '');
            const existe = funcionarios.find(f => f.matricula?.replace(/\D/g, '') === matricula);
            if (existe) {
              jaExistem++;
            } else {
              novosFuncs.push({
                nome: u.name || 'Importado iDFace',
                matricula,
                cpf: String(u.cpf || u.CPF || u.documento || u.document || '').replace(/\D/g, ''),
                pis: String(u.pis || u.PIS || '').replace(/\D/g, ''),
                empresa_id: equip.empresa_id
              });
            }
          }
        }
        if (novosFuncs.length > 0) {
          const importar = await waitForConfirm(
            'Importar Funcionários do iDFace',
            `${novosFuncs.length} novo(s) funcionário(s) encontrado(s) no iDFace${jaExistem > 0 ? ` (${jaExistem} já existente(s))` : ''}. Deseja importá-los?`,
            'Importar', 'Cancelar'
          );
          if (importar) {
            let criados = 0;
            let semDoc = 0;
            for (const f of novosFuncs) {
              const doc = String(f.cpf || f.pis || '').replace(/\D/g, '');
              if (doc.length !== 11) { semDoc++; continue; }
              try {
                await api.funcionarios.create({
                  nome: f.nome,
                  cpf: doc,
                  pis: f.pis || null,
                  matricula: f.matricula || null,
                  ativo: true,
                });
                criados++;
              } catch (e) {
                console.warn('Falha ao importar funcionário do iDFace:', f.nome, e.message);
              }
            }
            setSyncResult({
              ok: criados > 0,
              message: `${criados} funcionário(s) importado(s) do iDFace.${semDoc ? ` ${semDoc} sem CPF/PIS válido não importado(s).` : ''}`,
            });
            if (criados > 0) setTimeout(() => window.location.reload(), 2000);
          } else {
            setSyncResult({ ok: true, message: 'Importação cancelada.' });
          }
        } else {
          setSyncResult({ ok: true, message: jaExistem > 0 ? 'Nenhum novo funcionário (já existem no sistema).' : 'Nenhum funcionário encontrado no iDFace.' });
        }
      } else if (data.users) {
        const portaria = equip.portaria === '1510' ? '1510' : '671';
        const idField = portaria === '1510' ? 'pis' : 'cpf';
        const novosFuncs = [];
        let jaExistem = 0;
        for (const u of data.users) {
          const doc = String(u[idField] || u.cpf || u.pis || '').padStart(11, '0');
          if (doc) {
            const existe = funcionarios.find(f => f.cpf?.replace(/\D/g, '') === doc || f.pis?.replace(/\D/g, '') === doc);
            if (existe) {
              jaExistem++;
            } else {
              novosFuncs.push({
                id: `rep_${equip.id}_${doc}_${Date.now()}`,
                nome: u.name || 'Importado REP', cpf: doc,
                empresa_id: equip.empresa_id
              });
            }
          }
        }
        if (novosFuncs.length > 0) {
          const importar = await waitForConfirm(
            'Importar Funcionários do REP',
            `${novosFuncs.length} novo(s) funcionário(s) encontrado(s) no REP${jaExistem > 0 ? ` (${jaExistem} já existente(s))` : ''}. Deseja importá-los?`,
            'Importar', 'Cancelar'
          );
          if (importar) {
            for (const f of novosFuncs) {
              try {
                await api.funcionarios.create({
                  nome: f.nome,
                  cpf: f.cpf,
                  empresa_id: equip.empresa_id,
                  ativo: true,
                });
              } catch (e) {
                console.warn('Falha ao importar funcionário:', f.nome, e.message);
              }
            }
            setSyncResult({ ok: true, message: `${novosFuncs.length} funcionários importados do REP para a empresa!` });
            setTimeout(() => window.location.reload(), 2000);
          } else {
            setSyncResult({ ok: true, message: 'Importação cancelada.' });
          }
        } else {
          setSyncResult({ ok: true, message: jaExistem > 0 ? 'Nenhum novo funcionário para importar (já existem no sistema).' : 'Nenhum funcionário encontrado no REP.' });
        }
      } else {
        setSyncResult({ ok: false, message: data.error || 'Nenhum usuário encontrado no equipamento' });
      }
    } catch (e) {
      setSyncResult({ ok: false, message: e.message });
    }
    setSincronizando(false);
  };

  const handleLoadMarkingsFromREP = async (equip) => {
    if (!equip.ip || !repInfo) return;
    setImportandoMarcacoes(true);
    setImportMarcacoesResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    const ehIFace = equip.modelo === 'iDFace' || equip.modelo === 'iDFace Max';

    let funcs = funcionarios;
    if (funcs.length === 0) {
      try {
        const dbFuncs = await api.funcionarios.list();
        if (Array.isArray(dbFuncs)) funcs = dbFuncs;
      } catch {
        // Sem conexão: segue com a lista já carregada em memória.
      }
    }

    try {
      let matched = [];
      let unmatched = [];

      if (ehIFace) {
        // Carregar access_logs do iDFace via load_objects
        const res = await fetch(`${cloudUrl}/api/reps/proxy/iface/logs`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta || '80',
            usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
            session: repInfo.sessao || repInfo.session,
            limit: 5000
          })
        });
        if (!res.ok) {
          setImportMarcacoesResult({ ok: false, message: 'Falha ao carregar logs do iDFace' });
          setImportandoMarcacoes(false);
          return;
        }
        const data = await res.json();
        const logs = Object.values(data).find(v => Array.isArray(v)) || [];

        const funcMap = {};
        funcs.forEach(f => {
          const mat = (f.matricula || '').replace(/\D/g, '');
          if (mat) funcMap[mat] = f;
        });

        for (const log of logs) {
          const userId = String(log.user_id || log.userId || log.id_user || '');
          const dataHora = log.data_hora || log.datetime || log.date_time || log.time || '';
          const [dateStr, timeStr] = dataHora.replace('T', ' ').split(' ');
          const matricula = userId.replace(/\D/g, '');
          if (!matricula || !dateStr) continue;
          const func = funcMap[matricula];
          const enriched = {
            data: dateStr, hora: timeStr || '00:00',
            cpf: '', pis: '',
            matricula,
            importado_em: new Date().toISOString(),
            equip_id: equip.id,
            equip_nome: equip.nome,
            funcionario_id: func?.id || null,
            sem_funcionario: !func,
            nsr: log.id || log.nsr || 0,
            origem: 'iface'
          };
          if (func) matched.push(enriched);
          else unmatched.push(enriched);
        }
      } else {
        const portaria = equip.portaria === '1510' ? '1510' : '671';
        const idField = portaria === '1510' ? 'pis' : 'cpf';

        const params = new URLSearchParams({
          ip: equip.ip, porta: equip.porta || '443',
          usuario: equip.usuario || 'admin', senha: equip.senha || 'admin'
        });
        const res = await fetch(`${cloudUrl}/api/reps/proxy/afd/download?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Falha ao baixar AFD' }));
          setImportMarcacoesResult({ ok: false, message: err.error || err.detalhe || 'Erro ao baixar AFD do REP' });
          setImportandoMarcacoes(false);
          return;
        }
        const afdText = await res.text();
        const linhas = afdText.split('\n');

        const funcMap = {};
        funcs.forEach(f => {
          const cpf = (f.cpf || '').replace(/\D/g, '');
          const pis = (f.pis || '').replace(/\D/g, '');
          if (cpf) funcMap[cpf] = { docType: 'cpf', ...f };
          if (pis) funcMap[pis] = { docType: 'pis', ...f };
        });

        for (const linha of linhas) {
          const l = linha.trim();
          if (l.length <= 9 || l[9] !== '3') continue;
          const is671 = l.length > 14 && l[14] === '-';
          let doc, dateStr, timeStr;
          if (is671) {
            const d = l.substring(10, 29);
            dateStr = d.slice(0, 10);
            timeStr = d.slice(11, 19);
            doc = l.substring(34, 45).replace(/\D/g, '');
          } else {
            const d = l.substring(10, 12);
            const m = l.substring(12, 14);
            const y = l.substring(14, 18);
            const hh = l.substring(18, 20);
            const mm = l.substring(20, 22);
            dateStr = `${y}-${m}-${d}`;
            timeStr = `${hh}:${mm}`;
            doc = l.substring(22, 34).replace(/\D/g, '');
          }
          if (!doc) continue;
          const func = funcMap[doc];
          const enriched = {
            cpf: is671 ? doc : '',
            pis: !is671 ? doc : '',
            data: dateStr, hora: timeStr,
            importado_em: new Date().toISOString(),
            equip_id: equip.id,
            equip_nome: equip.nome,
            funcionario_id: func?.id || null,
            sem_funcionario: !func,
            nsr: l.substring(0, 9)
          };
          if (func) matched.push(enriched);
          else unmatched.push(enriched);
        }
      }

      if (matched.length > 0) {
        try {
          await api.marcacoes.import(matched.map(m => ({
            funcionario_id: m.funcionario_id,
            nsr: m.nsr,
            cpf: m.cpf,
            pis: m.pis,
            data: m.data,
            hora: m.hora,
            equip_id: m.equip_id,
            equip_nome: m.equip_nome,
            origem: 'afd',
          })));
        } catch (e) {
          console.warn('Falha ao importar marcações no servidor:', e.message);
        }
      }

      if (equip.cloud_rep_id && equip.tipo_conexao === 'idcloud' && matched.length > 0) {
        await fetch(`${cloudUrl}/api/reps/${equip.cloud_rep_id}/markings/sync`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ markings: matched })
        }).catch(() => {});
      }

      const totalFuncsSistema = new Set(funcs.map(f => f.id)).size;
      const origem = ehIFace ? 'iDFace' : 'AFD';
      setImportMarcacoesResult({
        ok: true,
        message: `Total: ${matched.length + unmatched.length} marcações (via ${origem}) | ${matched.length} importadas | ${unmatched.length} descartadas — ${totalFuncsSistema} funcionários no sistema`
      });
    } catch (e) {
      setImportMarcacoesResult({ ok: false, message: e.message });
    }
    setImportandoMarcacoes(false);
  };

  const handleDownloadAFDFromREP = async (equip) => {
    if (!equip.ip || !repInfo) return;
    setBaixandoAFD(true);
    setAfdResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';

    try {
      const params = new URLSearchParams({
        ip: equip.ip, porta: equip.porta || '443',
        usuario: equip.usuario || 'admin', senha: equip.senha || 'admin'
      });
      const res = await fetch(`${cloudUrl}/api/reps/proxy/afd/download?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AFD_${equip.nome}_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setAfdResult({ ok: true, message: 'AFD baixado com sucesso!' });
      } else {
        const err = await res.json().catch(() => ({ error: 'Falha ao baixar AFD' }));
        setAfdResult({ ok: false, message: err.error || err.detalhe || 'Falha ao baixar AFD' });
      }
    } catch (e) {
      setAfdResult({ ok: false, message: e.message });
    }
    setBaixandoAFD(false);
  };

  const handleConfigurarPush = async (equip) => {
    if (!equip.ip || !repInfo) return;
    setConfigurandoPush(true);
    setPushConfigResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    const pushUrl = `${cloudUrl}/push`;

    try {
      const sess = repInfo.sessao || repInfo.session;
      const serial = repInfo.serial || '';

      const body = {
        ip: equip.ip, porta: equip.porta || '80',
        usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
        session: sess,
        dados: {
          push_server: {
            push_remote_address: pushUrl,
            push_request_timeout: '30000',
            push_request_period: '5',
          },
        },
      };
      if (serial) body.dados.push_server.push_attributes = `serial=${serial}`;

      const res = await fetch(`${cloudUrl}/api/reps/proxy/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...body,
          comando: `set_configuration?session=${encodeURIComponent(sess)}`,
        })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setPushConfigResult({ ok: true, message: `Push configurado com sucesso! URL: ${pushUrl}` });
      } else {
        setPushConfigResult({ ok: false, message: data.error || data.detalhe || 'Falha ao configurar push' });
      }
    } catch (e) {
      setPushConfigResult({ ok: false, message: e.message });
    }
    setConfigurandoPush(false);
  };

  const handleAtivarModoPonto = async (equip) => {
    if (!equip.ip || !repInfo) return;
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    const sess = repInfo.sessao || repInfo.session;
    try {
      const res = await fetch(`${cloudUrl}/api/reps/proxy/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ip: equip.ip, porta: equip.porta || '80',
          usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
          session: sess,
          comando: `set_configuration?session=${encodeURIComponent(sess)}`,
          dados: { general: { attendance_mode: '1' }, identifier: { log_type: '0' } },
        })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        alert('Modo Ponto ativado com sucesso! Reconecte ao equipamento.');
        handleConectarREP();
      } else {
        alert('Erro ao ativar Modo Ponto: ' + (data.error || data.detalhe || 'Falha'));
      }
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  const handleDownloadAFDiDFace = async (equip) => {
    if (!equip.ip || !repInfo) return;
    setBaixandoAFD(true);
    setAfdResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    try {
      const sess = repInfo.sessao || repInfo.session;
      const res = await fetch(`${cloudUrl}/api/reps/proxy/iface/afd/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ip: equip.ip, porta: equip.porta || '80',
          usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
          session: sess,
        })
      });
      const data = await res.json();
      if (res.ok && data.afd) {
        const blob = new Blob([data.afd], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AFD_${equip.nome}_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setAfdResult({ ok: true, message: `AFD gerado com sucesso! ${data.total} marcações, formato ${data.portaria}` });
      } else {
        setAfdResult({ ok: false, message: data.error || data.mensagem || 'Falha ao gerar AFD do iDFace' });
      }
    } catch (e) {
      setAfdResult({ ok: false, message: e.message });
    }
    setBaixandoAFD(false);
  };

  const handleSendPhotos = async (equip) => {
    if (!equip.ip || !repInfo || !equip.empresa_id) return;
    setEnviandoFotos(true);
    setFotosResult(null);
    const cloudUrl = equip.cloud_url || 'http://localhost:3100';
    const token = equip.api_key || '';
    const funcs = funcionarios.filter(f => String(f.empresa_id || '') === String(equip.empresa_id));
    const sess = repInfo.sessao || repInfo.session;
    let enviadas = 0;
    let semFoto = 0;
    let erros = 0;

    for (const f of funcs) {
      const foto = f.foto || '';
      const matricula = (f.matricula || '').replace(/\D/g, '');
      if (!foto || !matricula) {
        if (!foto) semFoto++;
        continue;
      }
      try {
        const res = await fetch(`${cloudUrl}/api/reps/proxy/iface/face/upload`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ip: equip.ip, porta: equip.porta || '80',
            usuario: equip.usuario || 'admin', senha: equip.senha || 'admin',
            session: sess,
            user_id: matricula,
            foto,
          })
        });
        if (res.ok) enviadas++;
        else erros++;
      } catch {
        erros++;
      }
    }
    setFotosResult({
      ok: erros === 0,
      message: `${enviadas} foto(s) enviada(s)${semFoto > 0 ? `, ${semFoto} sem foto` : ''}${erros > 0 ? `, ${erros} erro(s)` : ''}`
    });
    setEnviandoFotos(false);
  };

  const refreshPushMonitor = useCallback(async () => {
    const ehIFace = form.modelo === 'iDFace' || form.modelo === 'iDFace Max';
    if (!ehIFace || !form.cloud_url) return;
    const token = form.api_key || '';
    setPushMonitorLoading(true);
    setPushMarcacoesLoading(true);
    try {
      const [devData, evData, resData, marcData] = await Promise.all([
        fetch(`${form.cloud_url}/api/push/devices?max_age_hours=24`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ devices: {} })),
        fetch(`${form.cloud_url}/api/push/events?limit=20`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`${form.cloud_url}/api/push/results?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`${form.cloud_url}/api/push/marcacoes?limit=200&nao_importados=true`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ marcacoes: [] })),
      ]);
      setPushDevices(devData.devices || {});
      setPushEvents(evData.events || []);
      setPushResults(resData.results || []);
      setPushMarcacoes(marcData.marcacoes || []);
    } catch {}
    setPushMonitorLoading(false);
    setPushMarcacoesLoading(false);
  }, [form.modelo, form.cloud_url, form.api_key]);

  const handleImportarTodasPushMarcacoes = async (equip) => {
    if (!equip.cloud_url) return;
    const token = equip.api_key || '';
    setPushMarcacoesLoading(true);
    try {
      const res = await fetch(`${equip.cloud_url}/api/push/marcacoes/importar/todos`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const novas = pushMarcacoes.map(m => ({
          nsr: m.nsr, cpf: m.cpf, pis: m.pis,
          data: m.data, hora: m.hora,
          equip_id: equip.id,
          equip_nome: equip.nome,
          origem: 'push',
        }));
        try {
          await api.marcacoes.import(novas);
        } catch (e) {
          console.warn('Falha ao importar marcações push:', e.message);
        }
        refreshPushMonitor();
      }
    } catch (e) {
      console.error('Erro ao importar push markings:', e);
    }
    setPushMarcacoesLoading(false);
  };

  useEffect(() => {
    if (!pushAutoRefresh) return;
    const interval = setInterval(refreshPushMonitor, 15000);
    return () => clearInterval(interval);
  }, [pushAutoRefresh, refreshPushMonitor]);

  const handleSalvar = async () => {
    if (!form.nome) { alert("Preencha o nome do equipamento!"); return; }
    if (form.tipo_conexao === 'idcloud' && !form.cloud_url) { alert("Preencha a URL do PontoCloud!"); return; }
    if (form.tipo_conexao === 'ip_direto' && !form.ip) { alert("Preencha o endereço IP!"); return; }
    try {
      const novo = await criarEquipamento({ ...form, cloud_rep_id: form.cloud_rep_id || '' });
      setEquipamentos(prev => [...prev, { ...novo, ativo: novo.ativo !== false }]);
      resetForm();
      setSubTab('equipamentos');
    } catch (e) {
      alert('Erro ao salvar equipamento: ' + e.message);
    }
  };

  const handleAtualizar = async () => {
    if (!form.nome) { alert("Preencha o nome do equipamento!"); return; }
    if (form.tipo_conexao === 'idcloud' && !form.cloud_url) { alert("Preencha a URL do PontoCloud!"); return; }
    if (form.tipo_conexao === 'ip_direto' && !form.ip) { alert("Preencha o endereço IP!"); return; }
    try {
      const atualizado = await atualizarEquipamento(editandoId, form);
      setEquipamentos(prev => prev.map(e => e.id === editandoId ? { ...atualizado, ativo: atualizado.ativo !== false } : e));
      resetForm();
      setSubTab('equipamentos');
    } catch (e) {
      alert('Erro ao atualizar equipamento: ' + e.message);
    }
  };

  const handleEditar = (equip) => {
    setForm({
      nome: equip.nome || '',
      modelo: equip.modelo || 'iDClass',
      num_serie: equip.num_serie || '',
      localizacao: equip.localizacao || '',
      ativo: equip.ativo !== false,
      tipo_conexao: equip.tipo_conexao || 'idcloud',
      cloud_url: equip.cloud_url || '',
      api_key: equip.api_key || '',
      ip: equip.ip || '',
      porta: equip.porta || '443',
      usuario: equip.usuario || 'admin',
      senha: equip.senha || 'admin',
      observacoes: equip.observacoes || '',
      cloud_rep_id: equip.cloud_rep_id || '',
      empresa_id: equip.empresa_id || '',
      portaria: equip.portaria || 'auto'
    });
    setTestRes(null);
    setCloudRepId(equip.cloud_rep_id || null);
    setRepInfo(null);
    setRepErro(null);
    setSyncResult(null);
    setEditandoId(equip.id);
    setSubTab('editar_equip');
  };

  const handleExcluir = async (id, nome) => {
    if (!window.confirm(`Excluir equipamento "${nome}"?`)) return;
    try {
      await excluirEquipamento(id);
      setEquipamentos(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert('Erro ao excluir equipamento: ' + e.message);
    }
  };

  if (subTab === 'equipamentos') return (
    <>
      {carregandoEquip ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando equipamentos...
        </div>
      ) : (
        <EquipamentoLista equipamentos={equipamentos} empresas={empresas} setSubTab={setSubTab} resetForm={resetForm} handleEditar={handleEditar} handleExcluir={handleExcluir} cloudStatus={cloudStatus} verificando={verificando} />
      )}
      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} confirmLabel={confirmModal.confirmLabel} cancelLabel={confirmModal.cancelLabel} />
    </>
  );
  if (subTab === 'novo_equip' || subTab === 'editar_equip') return (
    <>
      <EquipamentoForm form={form} setForm={setForm} editandoId={editandoId} setSubTab={setSubTab} resetForm={resetForm} handleSalvar={handleSalvar} handleAtualizar={handleAtualizar} testando={testando} testRes={testRes} handleTestarConexao={handleTestarConexao} registrando={registrando} handleRegistrarCloud={handleRegistrarCloud} conectandoREP={conectandoREP} repInfo={repInfo} repErro={repErro} handleConectarREP={handleConectarREP} empresas={empresas} funcionarios={funcionarios} handleSyncToREP={handleSyncToREP} handleSyncFromREP={handleSyncFromREP} sincronizando={sincronizando} syncResult={syncResult} handleLoadMarkingsFromREP={handleLoadMarkingsFromREP} importandoMarcacoes={importandoMarcacoes} importMarcacoesResult={importMarcacoesResult} handleDownloadAFDFromREP={handleDownloadAFDFromREP} baixandoAFD={baixandoAFD} afdResult={afdResult} handleConfigurarPush={handleConfigurarPush} configurandoPush={configurandoPush} pushConfigResult={pushConfigResult} pushDevices={pushDevices} pushEvents={pushEvents} pushResults={pushResults} pushMonitorLoading={pushMonitorLoading} pushAutoRefresh={pushAutoRefresh} setPushAutoRefresh={setPushAutoRefresh} refreshPushMonitor={refreshPushMonitor} handleAtivarModoPonto={handleAtivarModoPonto} handleDownloadAFDiDFace={handleDownloadAFDiDFace} handleSendPhotos={handleSendPhotos} enviandoFotos={enviandoFotos} fotosResult={fotosResult} handleImportarTodasPushMarcacoes={handleImportarTodasPushMarcacoes} pushMarcacoes={pushMarcacoes} pushMarcacoesLoading={pushMarcacoesLoading} />
      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} confirmLabel={confirmModal.confirmLabel} cancelLabel={confirmModal.cancelLabel} />
    </>
  );
  return null;
}
