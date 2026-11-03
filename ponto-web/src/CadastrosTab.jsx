import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { isValidCPF, isUUID, carregarLocal, salvarLocal, getHistHorarios, salvarHistHorarios, hashSenhaMobile, Users, Building2, Clock, Briefcase, Cpu, Sliders } from './cadastros/CadastrosUtils';
import EmpresaSection from './cadastros/EmpresaSection';
import HorarioSection from './cadastros/HorarioSection';
import FuncionarioForm from './cadastros/FuncionarioForm';
import FuncionarioLista from './cadastros/FuncionarioLista';
import AuxiliaresSection from './cadastros/AuxiliaresSection';
import ParametrosSection from './cadastros/ParametrosSection';
import EquipamentoSection from './cadastros/EquipamentoSection';

export default function CadastrosTab() {
  const [subTab, setSubTab] = useState('lista_func');
  const [empresas, setEmpresas] = useState(() => carregarLocal('ponto_empresas', []));
  const [horarios, setHorarios] = useState(() => carregarLocal('ponto_horarios', []));
  const [funcionarios, setFuncionarios] = useState([]);
  const [departamentos, setDepartamentos] = useState(() => carregarLocal('ponto_departamentos', []));
  const [cargos, setCargos] = useState(() => carregarLocal('ponto_cargos', []));
  const [parametrosSets, setParametrosSets] = useState(() => carregarLocal('ponto_parametros_list', []));
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [cpfError, setCpfError] = useState('');
  const [histHorarios, setHistHorarios] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState('ativos');
  const [form, setForm] = useState({
    nome: '', cpf: '', pis: '', senha: '', matricula: '', folha: '', foto: '',
    empresa_id: '', data_admissao: '', departamento: '', cargo: '', horario_id: '',
    parametro_id: '', data_inicio: '', ativo: true, data_demissao: '', motivo_demissao: ''
  });

  const mergeFuncExtras = (funcs) => {
    const extras = carregarLocal('ponto_func_extras', {});
    let removeuSenha = false;
    for (const id of Object.keys(extras)) {
      if (extras[id] && 'senha' in extras[id]) {
        delete extras[id].senha;
        removeuSenha = true;
      }
    }
    if (removeuSenha) salvarLocal('ponto_func_extras', extras);
    return funcs.map(f => {
      const extrasSemSenha = { ...(extras[f.id] || {}) };
      delete extrasSemSenha.senha;
      return { ...extrasSemSenha, id: f.id, nome: f.nome, cpf: f.cpf, pis: f.pis, foto: extrasSemSenha.foto || '', data_admissao: f.data_admissao, created_at: f.created_at };
    });
  };

  useEffect(() => {
    (async () => {
      const { data: func } = await supabase.from('funcionarios').select('*');
      if (func) setFuncionarios(mergeFuncExtras(func));
      const { data: emp } = await supabase.from('empresas').select('*');
      if (emp) {
        setEmpresas(prev => {
          const locais = prev.filter(e => !isUUID(String(e.id)));
          const supabaseIds = new Set(emp.map(e => e.id));
          return [...emp, ...locais.filter(e => !supabaseIds.has(e.id))];
        });
      }
      setLoading(false);
    })();
  }, []);
  useEffect(() => { salvarLocal('ponto_empresas', empresas); }, [empresas]);
  useEffect(() => { salvarLocal('ponto_horarios', horarios); }, [horarios]);
  useEffect(() => { salvarLocal('ponto_departamentos', departamentos); }, [departamentos]);
  useEffect(() => { salvarLocal('ponto_cargos', cargos); }, [cargos]);
  useEffect(() => { salvarLocal('ponto_parametros_list', parametrosSets); }, [parametrosSets]);

  const salvarExtras = (id, formData) => {
    const extras = carregarLocal('ponto_func_extras', {});
    extras[id] = {
      matricula: formData.matricula || '', folha: formData.folha || '',
      foto: formData.foto || '',
      departamento: formData.departamento || '', cargo: formData.cargo || '',
      horario_id: formData.horario_id || '', data_inicio: formData.data_inicio || '',
      parametro_id: formData.parametro_id || '', ativo: formData.ativo !== false,
      data_demissao: formData.data_demissao || '', motivo_demissao: formData.motivo_demissao || '',
      empresa_id: formData.empresa_id || ''
    };
    salvarLocal('ponto_func_extras', extras);
  };

  const carregarDadosBase = async () => {
    const { data: func } = await supabase.from('funcionarios').select('*');
    if (func) setFuncionarios(mergeFuncExtras(func));
    const { data: emp } = await supabase.from('empresas').select('*');
    if (emp) {
      setEmpresas(prev => {
        const locais = prev.filter(e => !isUUID(String(e.id)));
        const supabaseIds = new Set(emp.map(e => e.id));
        return [...emp, ...locais.filter(e => !supabaseIds.has(e.id))];
      });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ nome: '', cpf: '', pis: '', senha: '', matricula: '', folha: '', foto: '', empresa_id: '', data_admissao: '', departamento: '', cargo: '', horario_id: '', parametro_id: '', data_inicio: '', ativo: true, data_demissao: '', motivo_demissao: '' });
    setEditandoId(null);
    setHistHorarios([]);
  };

  const handleSalvarFuncionario = async () => {
    if (!form.nome || !form.cpf) { alert("Preencha ao menos Nome e CPF!"); return; }
    const cpfLimpo = form.cpf.replace(/\D/g, '');
    if (!isValidCPF(cpfLimpo)) { setCpfError('CPF inválido. Verifique os dígitos.'); return; }
    setCpfError('');
    const jaExiste = histHorarios.some(h => h.horario_id === form.horario_id && h.data_inicio === form.data_inicio);
    const histAtual = form.horario_id && form.data_inicio && !jaExiste ? [...histHorarios, { horario_id: form.horario_id, data_inicio: form.data_inicio }] : histHorarios;
    const empRef = form.empresa_id || '';
    const dadosFunc = { nome: form.nome, cpf: cpfLimpo, pis: form.pis, data_admissao: form.data_admissao || null };
    if (form.senha) dadosFunc.senha_hash = await hashSenhaMobile(form.senha);
    if (isUUID(empRef)) dadosFunc.empresa_id = empRef;
    const { data, error } = await supabase.from('funcionarios').insert([dadosFunc]);
    if (error) { alert("Erro ao salvar: " + error.message); return; }
    if (data && data[0]) {
      salvarHistHorarios(data[0].id, histAtual);
      salvarExtras(data[0].id, form);
    }
    resetForm();
    carregarDadosBase();
    setSubTab('lista_func');
  };

  const handleEditarFuncionario = (func) => {
    setForm({ nome: func.nome || '', cpf: func.cpf || '', pis: func.pis || '', senha: '', matricula: func.matricula || '', folha: func.folha || '', foto: func.foto || '', empresa_id: func.empresa_id || '', data_admissao: func.data_admissao || '', departamento: func.departamento || '', cargo: func.cargo || '', horario_id: func.horario_id || '', parametro_id: func.parametro_id || '', data_inicio: func.data_inicio || '', ativo: func.ativo !== false, data_demissao: func.data_demissao || '', motivo_demissao: func.motivo_demissao || '' });
    setEditandoId(func.id);
    setHistHorarios(getHistHorarios(func.id));
    setSubTab('editar_func');
  };

  const handleAtualizarFuncionario = async () => {
    if (!form.nome || !form.cpf) { alert("Preencha ao menos Nome e CPF!"); return; }
    const cpfLimpo = form.cpf.replace(/\D/g, '');
    if (!isValidCPF(cpfLimpo)) { setCpfError('CPF inválido. Verifique os dígitos.'); return; }
    setCpfError('');
    const jaExiste = histHorarios.some(h => h.horario_id === form.horario_id && h.data_inicio === form.data_inicio);
    const histAtual = form.horario_id && form.data_inicio && !jaExiste ? [...histHorarios, { horario_id: form.horario_id, data_inicio: form.data_inicio }] : histHorarios;
    const empRef = form.empresa_id || '';
    const dadosFunc = { nome: form.nome, cpf: cpfLimpo, pis: form.pis, data_admissao: form.data_admissao || null };
    if (form.senha) dadosFunc.senha_hash = await hashSenhaMobile(form.senha);
    if (isUUID(empRef)) dadosFunc.empresa_id = empRef;
    const { error } = await supabase.from('funcionarios').update(dadosFunc).eq('id', editandoId);
    if (error) { alert("Erro ao atualizar: " + error.message); return; }
    salvarExtras(editandoId, form);
    salvarHistHorarios(editandoId, histAtual);
    resetForm();
    carregarDadosBase();
    setSubTab('lista_func');
  };

  const handleExcluirFuncionario = async (id) => {
    const { error } = await supabase.from('funcionarios').delete().eq('id', id);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    const extras = carregarLocal('ponto_func_extras', {});
    delete extras[id];
    salvarLocal('ponto_func_extras', extras);
    carregarDadosBase();
  };

  const handleCancel = () => {
    resetForm();
    setSubTab('lista_func');
  };

  const renderNav = () => (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
      {[
        { key: 'lista_func', icon: <Users size={16} />, label: 'Funcionários', match: 'func' },
        { key: 'empresas', icon: <Building2 size={16} />, label: 'Empresas' },
        { key: 'horarios', icon: <Clock size={16} />, label: 'Horários' },
        { key: 'departamentos', icon: <Briefcase size={16} />, label: 'Departamentos' },
        { key: 'cargos', icon: <Users size={16} />, label: 'Cargos' },
        { key: 'parametros', icon: <Sliders size={16} />, label: 'Parâmetros' },
        { key: 'equipamentos', icon: <Cpu size={16} />, label: 'Equipamentos' },
      ].map(b => (
        <button key={b.key} className="btn-primary" style={{
          background: b.match ? (subTab.includes(b.match) ? 'var(--accent-gradient)' : 'transparent') : (subTab === b.key ? 'var(--accent-gradient)' : 'transparent'),
          color: (b.match ? subTab.includes(b.match) : subTab === b.key) ? 'white' : 'var(--text-secondary)',
          boxShadow: 'none', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem'
        }} onClick={() => setSubTab(b.key)}>
          {b.icon} {b.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {renderNav()}
      {(subTab === 'lista_func' || subTab === 'novo_func' || subTab === 'editar_func') && (subTab === 'lista_func' ? (
        <FuncionarioLista funcionarios={funcionarios} loading={loading} searchTerm={searchTerm} setSearchTerm={setSearchTerm} departamentos={departamentos} cargos={cargos} empresas={empresas} handleEditarFuncionario={handleEditarFuncionario} setSubTab={setSubTab} filtroAtivo={filtroAtivo} setFiltroAtivo={setFiltroAtivo} handleExcluirFuncionario={handleExcluirFuncionario} />
      ) : (
        <FuncionarioForm form={form} setForm={setForm} empresas={empresas} horarios={horarios} departamentos={departamentos} setDepartamentos={setDepartamentos} cargos={cargos} setCargos={setCargos} parametrosSets={parametrosSets} isEdit={subTab === 'editar_func'} editandoId={editandoId} histHorarios={histHorarios} setHistHorarios={setHistHorarios} handleSalvarFuncionario={handleSalvarFuncionario} handleAtualizarFuncionario={handleAtualizarFuncionario} cpfError={cpfError} setCpfError={setCpfError} onCancel={handleCancel} />
      ))}
      {(subTab === 'empresas' || subTab === 'nova_empresa' || subTab === 'editar_empresa') && <EmpresaSection empresas={empresas} setEmpresas={setEmpresas} subTab={subTab} setSubTab={setSubTab} funcionarios={funcionarios} />}
      {(subTab === 'horarios' || subTab === 'novo_horario' || subTab === 'editar_horario') && <HorarioSection horarios={horarios} setHorarios={setHorarios} subTab={subTab} setSubTab={setSubTab} />}
      {(subTab === 'departamentos' || subTab === 'cargos') && <AuxiliaresSection subTab={subTab} departamentos={departamentos} setDepartamentos={setDepartamentos} cargos={cargos} setCargos={setCargos} parametros={[]} setParametros={() => {}} funcionarios={funcionarios} />}
      {subTab === 'parametros' && <ParametrosSection onVoltar={() => setSubTab('lista_func')} />}
      {(subTab === 'equipamentos' || subTab === 'novo_equip' || subTab === 'editar_equip') && <EquipamentoSection subTab={subTab} setSubTab={setSubTab} empresas={empresas} funcionarios={funcionarios} />}
    </div>
  );
}
