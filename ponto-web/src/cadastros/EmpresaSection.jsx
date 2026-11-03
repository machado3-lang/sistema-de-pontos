import { useState, useContext } from 'react';
import { Building } from 'lucide-react';
import {
  formatCPF, formatCNPJ, formatCEP, formatPhone,
  isValidCPF, isValidCNPJ,
  nextId,
  ESTADOS_BR,
  Plus, Building2, X, Save, Search, Edit2, Trash2, Users
} from './CadastrosUtils';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';

export default function EmpresaSection({ empresas, setEmpresas, subTab, setSubTab, funcionarios = [] }) {
  const toast = useToast();
  const [editandoEmpId, setEditandoEmpId] = useState(null);
  const [empForm, setEmpForm] = useState({
    tipo_doc: 'CNPJ', razao_social: '', cpf_cnpj: '', endereco: '', cidade: '', estado: '', cep: '', bairro: '',
    telefone: '', responsavel_nome: '', responsavel_cpf: '', responsavel_email: '', responsavel_telefone: '', numero_folha: ''
  });
  const [docEmpError, setDocEmpError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const resetEmpForm = () => {
    setEmpForm({
      tipo_doc: 'CNPJ', razao_social: '', cpf_cnpj: '', endereco: '', cidade: '', estado: '', cep: '', bairro: '',
      telefone: '', responsavel_nome: '', responsavel_cpf: '', responsavel_email: '', responsavel_telefone: '', numero_folha: ''
    });
    setEditandoEmpId(null);
    setDocEmpError('');
  };

  const handleSalvarEmpresa = async () => {
    if (!empForm.razao_social || !empForm.cpf_cnpj) {
      toast("Preencha ao menos Razão Social e CPF/CNPJ!", "error");
      return;
    }
    const docLimpo = empForm.cpf_cnpj.replace(/\D/g, '');
    const valido = empForm.tipo_doc === 'CPF' ? isValidCPF(docLimpo) : isValidCNPJ(docLimpo);
    if (!valido) {
      setDocEmpError(`${empForm.tipo_doc} inválido. Verifique os dígitos.`);
      return;
    }
    setDocEmpError('');
    const { data, error } = await supabase.from('empresas').insert([{ razao_social: empForm.razao_social, cpf_cnpj: empForm.cpf_cnpj }]).select();
    if (error) {
      toast("Erro ao salvar no banco: " + error.message, "error");
      const nova = { id: nextId(), ...empForm };
      setEmpresas(prev => [...prev, nova]);
    } else if (data && data[0]) {
      setEmpresas(prev => [...prev, { ...empForm, id: data[0].id }]);
    }
    resetEmpForm();
    setSubTab('empresas');
  };

  const handleEditarEmpresa = (emp) => {
    setEmpForm({
      tipo_doc: emp.tipo_doc || 'CNPJ',
      razao_social: emp.razao_social || '',
      cpf_cnpj: emp.cpf_cnpj || '',
      endereco: emp.endereco || '',
      cidade: emp.cidade || '',
      estado: emp.estado || '',
      cep: emp.cep || '',
      bairro: emp.bairro || '',
      telefone: emp.telefone || '',
      responsavel_nome: emp.responsavel_nome || '',
      responsavel_cpf: emp.responsavel_cpf || '',
      responsavel_email: emp.responsavel_email || '',
      responsavel_telefone: emp.responsavel_telefone || '',
      numero_folha: emp.numero_folha || ''
    });
    setEditandoEmpId(emp.id);
    setDocEmpError('');
    setSubTab('editar_empresa');
  };

  const handleAtualizarEmpresa = async () => {
    if (!empForm.razao_social || !empForm.cpf_cnpj) {
      toast("Preencha ao menos Razão Social e CPF/CNPJ!", "error");
      return;
    }
    const docLimpo = empForm.cpf_cnpj.replace(/\D/g, '');
    const valido = empForm.tipo_doc === 'CPF' ? isValidCPF(docLimpo) : isValidCNPJ(docLimpo);
    if (!valido) {
      setDocEmpError(`${empForm.tipo_doc} inválido. Verifique os dígitos.`);
      return;
    }
    setDocEmpError('');
    setEmpresas(prev => prev.map(e => e.id === editandoEmpId ? { ...e, ...empForm } : e));
    if (typeof editandoEmpId === 'string' && editandoEmpId.includes('-')) {
      const { error } = await supabase.from('empresas').update({ razao_social: empForm.razao_social, cpf_cnpj: empForm.cpf_cnpj }).eq('id', editandoEmpId);
      if (error) toast("Erro ao atualizar no banco: " + error.message, "error");
    }
    resetEmpForm();
    setSubTab('empresas');
  };

  const handleExcluirEmpresa = async (id, nome) => {
    const vinculados = funcionarios.filter(f => String(f.empresa_id || '') === String(id));
    if (vinculados.length > 0) {
      if (!window.confirm(`A empresa "${nome}" possui ${vinculados.length} funcionário${vinculados.length > 1 ? 's' : ''} vinculado${vinculados.length > 1 ? 's' : ''}. Excluir a empresa também removerá o vínculo destes funcionários. Deseja continuar?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Excluir empresa "${nome}"?`)) return;
    }
    setEmpresas(prev => prev.filter(e => e.id !== id));
    if (typeof id === 'string' && id.includes('-')) {
      const { error } = await supabase.from('empresas').delete().eq('id', id);
      if (error) toast("Erro ao excluir do banco: " + error.message, "error");
    }
  };

  const empresasFiltradas = empresas.filter(e => {
    if (!searchTerm) return true;
    const termo = searchTerm.toLowerCase();
    return (e.razao_social && e.razao_social.toLowerCase().includes(termo)) ||
           (e.cpf_cnpj && e.cpf_cnpj.includes(termo)) ||
           (e.responsavel_nome && e.responsavel_nome.toLowerCase().includes(termo));
  });

  if (subTab === 'empresas') {
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 600 }}>Empresas</h3>
          <button className="btn-primary" onClick={() => { resetEmpForm(); setSubTab('nova_empresa'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Nova Empresa
          </button>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Pesquisar por razão social, documento ou responsável..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
        <div className="glass-card">
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Razão Social</th>
                  <th>CPF/CNPJ</th>
                  <th>Cidade / UF</th>
                  <th>Responsável</th>
                  <th style={{ width: '100px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresasFiltradas.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma empresa encontrada</td></tr>
                ) : (
                  empresasFiltradas.map(e => (
                    <tr key={e.id}>
                      <td><strong>{e.razao_social}</strong></td>
                      <td>{e.cpf_cnpj}</td>
                      <td>{e.cidade || '-'}{e.estado ? ` / ${e.estado}` : ''}</td>
                      <td>{e.responsavel_nome || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn-primary" onClick={() => handleEditarEmpresa(e)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-primary" onClick={() => handleExcluirEmpresa(e.id, e.razao_social)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
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
  }

  if (subTab === 'nova_empresa' || subTab === 'editar_empresa') {
    const isEdit = editandoEmpId !== null;
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 600 }}>{isEdit ? 'Editar Empresa' : 'Nova Empresa'}</h3>
          <button className="btn-primary" onClick={() => { resetEmpForm(); setSubTab('empresas'); }} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'none' }}>
            <X size={18} /> Cancelar
          </button>
        </div>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18}/> 1. Dados da Empresa
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Razão Social *</label>
                <input type="text" className="form-input" value={empForm.razao_social} onChange={e => setEmpForm({...empForm, razao_social: e.target.value})} placeholder="Ex: Empresa Exemplo Ltda" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tipo de Documento</label>
                <select className="form-input" value={empForm.tipo_doc} onChange={e => {
                  const novoDoc = e.target.value;
                  setEmpForm({...empForm, tipo_doc: novoDoc, cpf_cnpj: ''});
                  setDocEmpError('');
                }}>
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Documento *</label>
                <input type="text" className="form-input" value={empForm.cpf_cnpj} onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  const formatted = empForm.tipo_doc === 'CPF' ? formatCPF(digits) : formatCNPJ(digits);
                  setEmpForm({...empForm, cpf_cnpj: formatted});
                  setDocEmpError('');
                }} placeholder={empForm.tipo_doc === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} style={{ borderColor: docEmpError ? 'var(--danger)' : undefined }} />
                {docEmpError && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px' }}>{docEmpError}</span>}
              </div>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

          <div>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18}/> 2. Endereço
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Endereço</label>
                <input type="text" className="form-input" value={empForm.endereco} onChange={e => setEmpForm({...empForm, endereco: e.target.value})} placeholder="Ex: Rua Exemplo, 123" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bairro</label>
                <input type="text" className="form-input" value={empForm.bairro} onChange={e => setEmpForm({...empForm, bairro: e.target.value})} placeholder="Ex: Centro" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CEP</label>
                <input type="text" className="form-input" value={empForm.cep} onChange={e => setEmpForm({...empForm, cep: formatCEP(e.target.value)})} placeholder="00000-000" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cidade</label>
                <input type="text" className="form-input" value={empForm.cidade} onChange={e => setEmpForm({...empForm, cidade: e.target.value})} placeholder="Ex: São Paulo" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>UF</label>
                <select className="form-input" value={empForm.estado} onChange={e => setEmpForm({...empForm, estado: e.target.value})}>
                  <option value="">Selecione...</option>
                  {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Telefone</label>
                <input type="text" className="form-input" value={empForm.telefone} onChange={e => setEmpForm({...empForm, telefone: formatPhone(e.target.value)})} placeholder="(00) 00000-0000" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nº Folha</label>
                <input type="text" className="form-input" value={empForm.numero_folha} onChange={e => setEmpForm({...empForm, numero_folha: e.target.value})} placeholder="Ex: 001" />
              </div>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

          <div>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18}/> 3. Responsável
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome do Responsável</label>
                <input type="text" className="form-input" value={empForm.responsavel_nome} onChange={e => setEmpForm({...empForm, responsavel_nome: e.target.value})} placeholder="Ex: João da Silva" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CPF do Responsável</label>
                <input type="text" className="form-input" value={empForm.responsavel_cpf} onChange={e => setEmpForm({...empForm, responsavel_cpf: formatCPF(e.target.value)})} placeholder="000.000.000-00" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Celular / WhatsApp</label>
                <input type="text" className="form-input" value={empForm.responsavel_telefone} onChange={e => setEmpForm({...empForm, responsavel_telefone: formatPhone(e.target.value)})} placeholder="(00) 00000-0000" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>E-mail</label>
                <input type="email" className="form-input" value={empForm.responsavel_email} onChange={e => setEmpForm({...empForm, responsavel_email: e.target.value})} placeholder="exemplo@email.com" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={isEdit ? handleAtualizarEmpresa : handleSalvarEmpresa} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> {isEdit ? 'Atualizar Empresa' : 'Salvar Empresa'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
