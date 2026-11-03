import { useState, useEffect } from 'react';
import { api } from './api';
import { isValidCPF, isUUID, carregarLocal, salvarLocal, getHistHorarios, salvarHistHorarios, Users, Building2, Clock, Briefcase, Cpu, Sliders } from './cadastros/CadastrosUtils';
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
  const [parametrosSets] = useState(() => carregarLocal('ponto_parametros_list', []));
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
      const safe = { ...f };
      delete safe.senha_hash;
      const ex = { ...(extras[f.id] || {}) };
      delete ex.senha;
      return {
        ...ex,
        ...safe,
        departamento: ex.departamento || f.departamento_id || '',
        cargo: ex.cargo || f.cargo_id || '',
        horario_id: ex.horario_id || f.horario_id || '',
        parametro_id: ex.parametro_id || f.parametro_id || '',
        foto: f.foto || ex.foto || '',
        ativo: f.ativo !== false,
      };
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const [func, emp] = await Promise.all([
          api.funcionarios.list(),
          api.empresas.list(),
        ]);
        if (Array.isArray(func)) setFuncionarios(mergeFuncExtras(func));
        if (Array.isArray(emp)) setEmpresas(emp);
      } catch (e) {
        console.error('Erro ao carregar cadastros:', e.message);
      } finally {
        setLoading(false);
      }
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
    try {
      const [func, emp] = await Promise.all([
        api.funcionarios.list(),
        api.empresas.list(),
      ]);
      if (Array.isArray(func)) setFuncionarios(mergeFuncExtras(func));
      if (Array.isArray(emp)) setEmpresas(emp);
    } catch (e) {
      console.error('Erro ao recarregar cadastros:', e.message);
    } finally {
      setLoading(false);
    }
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
    const dadosFunc = {
      nome: form.nome,
      cpf: cpfLimpo,
      pis: form.pis || null,
      matricula: form.matricula || null,
      folha: form.folha || null,
      foto: form.foto || null,
      data_admissao: form.data_admissao || null,
      data_demissao: form.data_demissao || null,
      motivo_demissao: form.motivo_demissao || null,
      data_inicio: form.data_inicio || null,
      ativo: form.ativo !== false,
    };
    if (form.senha) dadosFunc.senha = form.senha;
    if (isUUID(empRef)) dadosFunc.empresa_id = empRef;

    try {
      const data = await api.funcionarios.create(dadosFunc);
      salvarHistHorarios(data.id, histAtual);
      salvarExtras(data.id, form);
      resetForm();
      carregarDadosBase();
      setSubTab('lista_func');
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
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
    const dadosFunc = {
      nome: form.nome,
      cpf: cpfLimpo,
      pis: form.pis || null,
      matricula: form.matricula || null,
      folha: form.folha || null,
      foto: form.foto || null,
      data_admissao: form.data_admissao || null,
      data_demissao: form.data_demissao || null,
      motivo_demissao: form.motivo_demissao || null,
      data_inicio: form.data_inicio || null,
      ativo: form.ativo !== false,
    };
    if (form.senha) dadosFunc.senha = form.senha;
    if (isUUID(empRef)) dadosFunc.empresa_id = empRef;

    try {
      await api.funcionarios.update(editandoId, dadosFunc);
      salvarExtras(editandoId, form);
      salvarHistHorarios(editandoId, histAtual);
      resetForm();
      carregarDadosBase();
      setSubTab('lista_func');
    } catch (e) {
      alert('Erro ao atualizar: ' + e.message);
    }
  };

  const handleExcluirFuncionario = async (id) => {
    try {
      await api.funcionarios.remove(id);
      const extras = carregarLocal('ponto_func_extras', {});
      delete extras[id];
      salvarLocal('ponto_func_extras', extras);
      carregarDadosBase();
    } catch (e) {
      alert('Erro ao excluir: ' + e.message);
    }
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
