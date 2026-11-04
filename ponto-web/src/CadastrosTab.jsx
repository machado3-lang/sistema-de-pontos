import { useState, useEffect } from 'react';
import { ClipboardList, MessageSquare } from 'lucide-react';
import { api } from './api';
import { isValidCPF, isUUID, Users, Building2, Clock, Briefcase, Cpu, Sliders, Calendar } from './cadastros/CadastrosUtils';
import {
  lerCache,
  carregarHorarios,
  carregarDepartamentos,
  carregarCargos,
  carregarParametros,
  carregarHistHorarios,
  salvarHistHorarios,
} from './data/pontoData';
import EmpresaSection from './cadastros/EmpresaSection';
import HorarioSection from './cadastros/HorarioSection';
import FuncionarioForm from './cadastros/FuncionarioForm';
import FuncionarioLista from './cadastros/FuncionarioLista';
import AuxiliaresSection from './cadastros/AuxiliaresSection';
import ParametrosSection from './cadastros/ParametrosSection';
import EquipamentoSection from './cadastros/EquipamentoSection';
import UsuariosSection from './cadastros/UsuariosSection';
import FeriadosSection from './cadastros/FeriadosSection';
import JustificativaTiposSection from './cadastros/JustificativaTiposSection';
import MotivosCorrecaoSection from './cadastros/MotivosCorrecaoSection';

export default function CadastrosTab({ usuario }) {
  const podeEditar = usuario?.role !== 'consulta';
  const [subTab, setSubTab] = useState('lista_func');
  const [empresas, setEmpresas] = useState(() => lerCache('empresas', []));
  const [horarios, setHorarios] = useState(() => lerCache('horarios', []));
  const [funcionarios, setFuncionarios] = useState([]);
  const [departamentos, setDepartamentos] = useState(() => lerCache('departamentos', []));
  const [cargos, setCargos] = useState(() => lerCache('cargos', []));
  const [parametrosSets, setParametrosSets] = useState(() => lerCache('parametros', []));
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [cpfError, setCpfError] = useState('');
  const [histHorarios, setHistHorarios] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState('ativos');
  const [form, setForm] = useState({
    nome: '', cpf: '', pis: '', senha: '', matricula: '', folha: '', foto: '',
    empresa_id: '', data_admissao: '', departamento: '', cargo: '', horario_id: '',
    parametro_id: '', data_inicio: '', ativo: true, data_demissao: '', motivo_demissao: '',
    cidade: '', uf: '', cidade_ibge: ''
  });

  const normalizarFuncionario = (f) => {
    const safe = { ...f };
    delete safe.senha_hash;
    return {
      ...safe,
      departamento: f.departamento_id || '',
      cargo: f.cargo_id || '',
      horario_id: f.horario_id || '',
      parametro_id: f.parametro_id || '',
      foto: f.foto || '',
      ativo: f.ativo !== false,
    };
  };

  const carregarDadosBase = async () => {
    try {
      const [func, emp, hor, dep, car, par] = await Promise.all([
        api.funcionarios.list(),
        api.empresas.list(),
        carregarHorarios(),
        carregarDepartamentos(),
        carregarCargos(),
        carregarParametros(),
      ]);
      if (Array.isArray(func)) setFuncionarios(func.map(normalizarFuncionario));
      if (Array.isArray(emp)) setEmpresas(emp);
      if (Array.isArray(hor)) setHorarios(hor);
      if (Array.isArray(dep)) setDepartamentos(dep);
      if (Array.isArray(car)) setCargos(car);
      if (Array.isArray(par)) setParametrosSets(par);
    } catch (e) {
      console.error('Erro ao carregar cadastros:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDadosBase(); }, []);

  const resetForm = () => {
    setForm({ nome: '', cpf: '', pis: '', senha: '', matricula: '', folha: '', foto: '', empresa_id: '', data_admissao: '', departamento: '', cargo: '', horario_id: '', parametro_id: '', data_inicio: '', ativo: true, data_demissao: '', motivo_demissao: '', cidade: '', uf: '', cidade_ibge: '' });
    setEditandoId(null);
    setHistHorarios([]);
  };

  const montarDadosFuncionario = () => {
    const dados = {
      nome: form.nome,
      cpf: form.cpf.replace(/\D/g, ''),
      pis: form.pis || null,
      matricula: form.matricula || null,
      folha: form.folha || null,
      foto: form.foto || null,
      data_admissao: form.data_admissao || null,
      data_demissao: form.data_demissao || null,
      motivo_demissao: form.motivo_demissao || null,
      data_inicio: form.data_inicio || null,
      ativo: form.ativo !== false,
      cidade: form.cidade || null,
      uf: form.uf || null,
      cidade_ibge: form.cidade_ibge || null,
      departamento_id: isUUID(form.departamento) ? form.departamento : null,
      cargo_id: isUUID(form.cargo) ? form.cargo : null,
      horario_id: isUUID(form.horario_id) ? form.horario_id : null,
      parametro_id: isUUID(form.parametro_id) ? form.parametro_id : null,
    };
    if (isUUID(form.empresa_id)) dados.empresa_id = form.empresa_id;
    if (form.senha) dados.senha = form.senha;
    return dados;
  };

  const handleSalvarFuncionario = async () => {
    if (!form.nome || !form.cpf) { alert("Preencha ao menos Nome e CPF!"); return; }
    const cpfLimpo = form.cpf.replace(/\D/g, '');
    if (!isValidCPF(cpfLimpo)) { setCpfError('CPF inválido. Verifique os dígitos.'); return; }
    setCpfError('');
    const jaExiste = histHorarios.some(h => h.horario_id === form.horario_id && h.data_inicio === form.data_inicio);
    const histAtual = form.horario_id && form.data_inicio && !jaExiste ? [...histHorarios, { horario_id: form.horario_id, data_inicio: form.data_inicio }] : histHorarios;

    try {
      const data = await api.funcionarios.create(montarDadosFuncionario());
      await salvarHistHorarios(data.id, histAtual);
      resetForm();
      carregarDadosBase();
      setSubTab('lista_func');
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  const handleEditarFuncionario = async (func) => {
    setForm({ nome: func.nome || '', cpf: func.cpf || '', pis: func.pis || '', senha: '', matricula: func.matricula || '', folha: func.folha || '', foto: func.foto || '', empresa_id: func.empresa_id || '', data_admissao: func.data_admissao || '', departamento: func.departamento || '', cargo: func.cargo || '', horario_id: func.horario_id || '', parametro_id: func.parametro_id || '', data_inicio: func.data_inicio || '', ativo: func.ativo !== false, data_demissao: func.data_demissao || '', motivo_demissao: func.motivo_demissao || '', cidade: func.cidade || '', uf: func.uf || '', cidade_ibge: func.cidade_ibge || '' });
    setEditandoId(func.id);
    setSubTab('editar_func');
    try {
      setHistHorarios(await carregarHistHorarios(func.id));
    } catch {
      setHistHorarios([]);
    }
  };

  const handleAtualizarFuncionario = async () => {
    if (!form.nome || !form.cpf) { alert("Preencha ao menos Nome e CPF!"); return; }
    const cpfLimpo = form.cpf.replace(/\D/g, '');
    if (!isValidCPF(cpfLimpo)) { setCpfError('CPF inválido. Verifique os dígitos.'); return; }
    setCpfError('');
    const jaExiste = histHorarios.some(h => h.horario_id === form.horario_id && h.data_inicio === form.data_inicio);
    const histAtual = form.horario_id && form.data_inicio && !jaExiste ? [...histHorarios, { horario_id: form.horario_id, data_inicio: form.data_inicio }] : histHorarios;

    try {
      await api.funcionarios.update(editandoId, montarDadosFuncionario());
      await salvarHistHorarios(editandoId, histAtual);
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
        { key: 'feriados', icon: <Calendar size={16} />, label: 'Feriados' },
        { key: 'justificativas', icon: <ClipboardList size={16} />, label: 'Justificativas' },
        { key: 'motivos', icon: <MessageSquare size={16} />, label: 'Motivos' },
        { key: 'equipamentos', icon: <Cpu size={16} />, label: 'Equipamentos' },
        ...(usuario?.role === 'admin'
          ? [{ key: 'usuarios', icon: <Users size={16} />, label: 'Usuários' }]
          : []),
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
      {!podeEditar && (
        <div className="glass-card" style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Perfil de consulta: você pode visualizar os dados, mas não alterar.
        </div>
      )}
      {(subTab === 'lista_func' || subTab === 'novo_func' || subTab === 'editar_func') && (subTab === 'lista_func' ? (
        <FuncionarioLista funcionarios={funcionarios} loading={loading} searchTerm={searchTerm} setSearchTerm={setSearchTerm} departamentos={departamentos} cargos={cargos} empresas={empresas} handleEditarFuncionario={handleEditarFuncionario} setSubTab={setSubTab} filtroAtivo={filtroAtivo} setFiltroAtivo={setFiltroAtivo} handleExcluirFuncionario={handleExcluirFuncionario} podeEditar={podeEditar} />
      ) : (
        <FuncionarioForm form={form} setForm={setForm} empresas={empresas} horarios={horarios} departamentos={departamentos} setDepartamentos={setDepartamentos} cargos={cargos} setCargos={setCargos} parametrosSets={parametrosSets} isEdit={subTab === 'editar_func'} editandoId={editandoId} histHorarios={histHorarios} setHistHorarios={setHistHorarios} handleSalvarFuncionario={handleSalvarFuncionario} handleAtualizarFuncionario={handleAtualizarFuncionario} cpfError={cpfError} setCpfError={setCpfError} onCancel={handleCancel} />
      ))}
      {(subTab === 'empresas' || subTab === 'nova_empresa' || subTab === 'editar_empresa') && <EmpresaSection empresas={empresas} setEmpresas={setEmpresas} subTab={subTab} setSubTab={setSubTab} funcionarios={funcionarios} />}
      {(subTab === 'horarios' || subTab === 'novo_horario' || subTab === 'editar_horario') && <HorarioSection horarios={horarios} setHorarios={setHorarios} subTab={subTab} setSubTab={setSubTab} />}
      {(subTab === 'departamentos' || subTab === 'cargos') && <AuxiliaresSection subTab={subTab} departamentos={departamentos} setDepartamentos={setDepartamentos} cargos={cargos} setCargos={setCargos} parametros={[]} setParametros={() => {}} funcionarios={funcionarios} podeEditar={podeEditar} />}
      {subTab === 'parametros' && <ParametrosSection onVoltar={() => setSubTab('lista_func')} />}
      {subTab === 'feriados' && <FeriadosSection podeEditar={podeEditar} />}
      {subTab === 'justificativas' && <JustificativaTiposSection podeEditar={podeEditar} />}
      {subTab === 'motivos' && <MotivosCorrecaoSection podeEditar={podeEditar} />}
      {(subTab === 'equipamentos' || subTab === 'novo_equip' || subTab === 'editar_equip') && <EquipamentoSection subTab={subTab} setSubTab={setSubTab} empresas={empresas} funcionarios={funcionarios} />}
      {subTab === 'usuarios' && usuario?.role === 'admin' && <UsuariosSection usuarioAtual={usuario} />}
    </div>
  );
}
