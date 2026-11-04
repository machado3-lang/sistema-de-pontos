import { useState, useRef } from 'react';
import { Camera, List } from 'lucide-react';
import {
  Plus, X, Save, Clock, Users, Briefcase,
  formatCPF, formatPIS, ESTADOS_BR
} from './CadastrosUtils';
import { salvarHistHorarios, criarDepartamento, criarCargo } from '../data/pontoData';
import { useToast } from '../components/Toast';

export default function FuncionarioForm({
  form, setForm,
  empresas, horarios, departamentos, setDepartamentos, cargos, setCargos, parametrosSets,
  isEdit, editandoId,
  histHorarios, setHistHorarios,
  handleSalvarFuncionario, handleAtualizarFuncionario,
  cpfError, setCpfError,
  onCancel
}) {
  const toast = useToast();
  const [showMotivos, setShowMotivos] = useState(false);
  const [showDeptInput, setShowDeptInput] = useState(false);
  const [showCargoInput, setShowCargoInput] = useState(false);
  const [novoDept, setNovoDept] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast('Formato inválido. Selecione JPG ou PNG.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm({ ...form, foto: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  const motivosDemissao = [
    'Pedido de demissão',
    'Dispensa sem justa causa',
    'Dispensa por justa causa',
    'Fim de contrato',
    'Aposentadoria',
    'Transferência de empresa',
  ];

  const handleCpfChange = (e) => {
    const formatted = formatCPF(e.target.value);
    setForm({ ...form, cpf: formatted });
    setCpfError('');
  };

  const handlePisChange = (e) => {
    setForm({ ...form, pis: formatPIS(e.target.value) });
  };

  const formatDateBR = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleAddDepartamento = async () => {
    const nome = novoDept.trim();
    if (!nome) return;
    try {
      const novo = await criarDepartamento(nome);
      setDepartamentos(prev => [...prev, { id: novo.id, nome: novo.nome }]);
      setForm({ ...form, departamento: novo.id });
      setNovoDept('');
      setShowDeptInput(false);
    } catch (e) {
      toast('Erro ao criar departamento: ' + e.message, 'error');
    }
  };

  const handleAddCargo = async () => {
    const nome = novoCargo.trim();
    if (!nome) return;
    try {
      const novo = await criarCargo(nome);
      setCargos(prev => [...prev, { id: novo.id, nome: novo.nome }]);
      setForm({ ...form, cargo: novo.id });
      setNovoCargo('');
      setShowCargoInput(false);
    } catch (e) {
      toast('Erro ao criar cargo: ' + e.message, 'error');
    }
  };

  const handleRemoveUltimoHist = async () => {
    if (histHorarios.length === 0) return;
    const novoHist = histHorarios.slice(0, -1);
    setHistHorarios(novoHist);
    if (editandoId) {
      try {
        await salvarHistHorarios(editandoId, novoHist);
      } catch (e) {
        toast('Erro ao salvar histórico: ' + e.message, 'error');
      }
    }
  };

  const sectionHeader = (icon, text) => (
    <h4 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon} {text}
    </h4>
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} /> {isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
        </h3>
        <button
          type="button"
          className="btn-primary"
          onClick={onCancel}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none' }}
        >
          <X size={18} /> Cancelar
        </button>
      </div>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div>
            {sectionHeader(<Users size={18} />, '1. Dados Pessoais')}
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignContent: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome Completo *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.nome || ''}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CPF</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.cpf || ''}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    style={{ borderColor: cpfError ? 'var(--danger)' : undefined }}
                  />
                  {cpfError && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px' }}>{cpfError}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PIS</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.pis || ''}
                    onChange={handlePisChange}
                    placeholder="000.00000.00-0"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cidade</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.cidade || ''}
                    onChange={e => setForm({ ...form, cidade: e.target.value })}
                    placeholder="Ex.: São Paulo"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>UF</label>
                  <select
                    className="form-input"
                    value={form.uf || ''}
                    onChange={e => setForm({ ...form, uf: e.target.value })}
                  >
                    <option value="">—</option>
                    {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nova senha (app mobile)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={form.senha || ''}
                    onChange={e => setForm({ ...form, senha: e.target.value })}
                    placeholder="Deixe em branco para manter"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', minWidth: '140px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Foto</label>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden',
                    border: '2px dashed var(--glass-border)', background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }} onClick={() => fileRef.current?.click()}>
                    {form.foto ? (
                      <img src={form.foto} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Camera size={32} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} style={{
                    background: 'transparent', border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)', padding: '0.25rem 0.75rem',
                    cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem'
                  }}>
                    {form.foto ? 'Alterar' : 'Selecionar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

        <div>
          {sectionHeader(<Briefcase size={18} />, '2. Vínculo e Admissão')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Empresa Vinculada *</label>
              <select
                className="form-input"
                value={form.empresa_id || ''}
                onChange={e => setForm({ ...form, empresa_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.razao_social}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data de Admissão *</label>
              <input
                type="date"
                className="form-input"
                value={form.data_admissao || ''}
                onChange={e => setForm({ ...form, data_admissao: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Número de Matrícula</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.matricula || ''}
                  onChange={e => setForm({ ...form, matricula: e.target.value })}
                  placeholder="Ex: 001"
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Número na Folha</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.folha || ''}
                  onChange={e => setForm({ ...form, folha: e.target.value })}
                  placeholder="Ex: 001"
                />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Situação</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, ativo: !form.ativo })}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                background: form.ativo ? 'var(--success)' : 'var(--glass-border)', transition: 'background 0.2s'
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px',
                left: form.ativo ? '24px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </button>
            <span style={{ fontSize: '0.85rem', color: form.ativo ? 'var(--success)' : 'var(--text-muted)' }}>
              {form.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          {!form.ativo && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data de Demissão</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.data_demissao || ''}
                  onChange={e => setForm({ ...form, data_demissao: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Motivo</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={form.motivo_demissao || ''}
                    onChange={e => setForm({ ...form, motivo_demissao: e.target.value })}
                    placeholder="Motivo do desligamento"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowMotivos(!showMotivos)}
                    style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center' }}
                    title="Motivos pré-definidos"
                  >
                    <List size={16} />
                  </button>
                </div>
                {showMotivos && motivosDemissao.length > 0 && (
                  <div style={{ marginTop: '0.25rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', maxHeight: '150px', overflowY: 'auto' }}>
                    {motivosDemissao.map((motivo, idx) => (
                      <div
                        key={idx}
                        style={{ padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', borderBottom: idx < motivosDemissao.length - 1 ? '1px solid var(--glass-border)' : 'none' }}
                        onClick={() => { setForm({ ...form, motivo_demissao: motivo }); setShowMotivos(false); }}
                        onMouseEnter={e => e.target.style.background = 'rgba(99,102,241,0.08)'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        {motivo}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

        <div>
          {sectionHeader(<Clock size={18} />, '3. Alocação e Horário')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Departamento</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {showDeptInput ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      value={novoDept}
                      onChange={e => setNovoDept(e.target.value)}
                      placeholder="Novo departamento"
                      style={{ flex: 1 }}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddDepartamento(); }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleAddDepartamento}
                      style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center' }}
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { setShowDeptInput(false); setNovoDept(''); }}
                      style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <select
                      className="form-input"
                      value={form.departamento || ''}
                      onChange={e => setForm({ ...form, departamento: e.target.value })}
                      style={{ flex: 1 }}
                    >
                      <option value="">Selecione...</option>
                      {departamentos.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowDeptInput(true)}
                      style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center' }}
                      title="Adicionar departamento"
                    >
                      <Plus size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cargo</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {showCargoInput ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      value={novoCargo}
                      onChange={e => setNovoCargo(e.target.value)}
                      placeholder="Novo cargo"
                      style={{ flex: 1 }}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddCargo(); }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleAddCargo}
                      style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center' }}
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { setShowCargoInput(false); setNovoCargo(''); }}
                      style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <select
                      className="form-input"
                      value={form.cargo || ''}
                      onChange={e => setForm({ ...form, cargo: e.target.value })}
                      style={{ flex: 1 }}
                    >
                      <option value="">Selecione...</option>
                      {cargos.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowCargoInput(true)}
                      style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center' }}
                      title="Adicionar cargo"
                    >
                      <Plus size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Grade de Horário</label>
              <select
                className="form-input"
                value={form.horario_id || ''}
                onChange={e => setForm({ ...form, horario_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {horarios.map(h => (
                  <option key={h.id} value={h.id}>{h.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data Início no Horário</label>
              <input
                type="date"
                className="form-input"
                value={form.data_inicio || ''}
                onChange={e => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Parâmetro</label>
              <select
                className="form-input"
                value={form.parametro_id || ''}
                onChange={e => setForm({ ...form, parametro_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {(parametrosSets || []).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
          {isEdit && histHorarios && histHorarios.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <Clock size={16} /> Histórico de Horários
              </h4>
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {histHorarios.map((h, idx) => {
                  const horarioNome = horarios.find(ho => String(ho.id) === String(h.horario_id))?.nome || h.horario_id;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', fontSize: '0.85rem',
                        borderBottom: idx < histHorarios.length - 1 ? '1px solid var(--glass-border)' : 'none'
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>{horarioNome}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{formatDateBR(h.data_inicio)}</span>
                        {idx === histHorarios.length - 1 && (
                          <button
                            type="button"
                            onClick={handleRemoveUltimoHist}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                            title="Remover último horário"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            className="btn-primary"
            onClick={isEdit ? handleAtualizarFuncionario : handleSalvarFuncionario}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={18} /> {isEdit ? 'Atualizar Funcionário' : 'Salvar Funcionário no Banco'}
          </button>
        </div>
      </div>
    </div>
  );
}
