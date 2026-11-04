import { useState, useEffect } from 'react';
import { Calendar, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ESTADOS_BR } from './CadastrosUtils';
import { api } from '../api';
import { carregarMunicipios } from '../data/ibge';
import {
  carregarFeriados,
  criarFeriado,
  atualizarFeriado,
  excluirFeriado,
} from '../data/pontoData';

const TIPOS = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'empresa', label: 'Empresa' },
];

const DIMENSOES = [
  { value: 'empresa', label: 'Empresa' },
  { value: 'uf', label: 'Estado (UF)' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'funcionario', label: 'Funcionário' },
];

const formatBR = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const vazio = {
  nome: '',
  data: '',
  tipo: 'nacional',
  recorrente: false,
  aplicacoes: [],
};

export default function FeriadosSection({ podeEditar = true }) {
  const toast = useToast();
  const [feriados, setFeriados] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ ...vazio });
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [dim, setDim] = useState('empresa');
  const [valorDim, setValorDim] = useState('');
  const [ufCidade, setUfCidade] = useState('');
  const [municipios, setMunicipios] = useState([]);

  const carregar = async () => {
    try {
      const [lista, emp, funcs] = await Promise.all([
        carregarFeriados(),
        api.empresas.list().catch(() => []),
        api.funcionarios.list().catch(() => []),
      ]);
      setFeriados(lista);
      setEmpresas(Array.isArray(emp) ? emp : []);
      setFuncionarios(Array.isArray(funcs) ? funcs : []);
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os feriados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    let ativo = true;
    if (!ufCidade) {
      setMunicipios([]);
      return () => { ativo = false; };
    }
    carregarMunicipios(ufCidade).then((lista) => {
      if (ativo) setMunicipios(lista);
    });
    return () => { ativo = false; };
  }, [ufCidade]);

  useEffect(() => {
    setValorDim('');
  }, [dim]);

  const resetForm = () => {
    setForm({ ...vazio });
    setEditandoId(null);
    setDim('empresa');
    setValorDim('');
    setUfCidade('');
  };

  const nomeEmpresa = (id) => {
    const emp = empresas.find((e) => String(e.id) === String(id));
    return emp?.razao_social || emp?.nome || String(id).slice(0, 8);
  };

  const nomeFuncionario = (id) => {
    const f = funcionarios.find((x) => String(x.id) === String(id));
    return f?.nome || String(id).slice(0, 8);
  };

  const rotuloAplicacao = (a) => {
    if (a.rotulo) return a.rotulo;
    if (a.tipo === 'empresa') return nomeEmpresa(a.valor);
    if (a.tipo === 'funcionario') return nomeFuncionario(a.valor);
    if (a.tipo === 'uf') return a.valor;
    return String(a.valor);
  };

  const adicionarAplicacao = () => {
    if (!valorDim) {
      toast('Escolha um valor para a aplicação.', 'error');
      return;
    }
    let valor = valorDim;
    let rotulo = '';

    if (dim === 'empresa') rotulo = nomeEmpresa(valorDim);
    if (dim === 'funcionario') rotulo = nomeFuncionario(valorDim);
    if (dim === 'uf') rotulo = valorDim;
    if (dim === 'cidade') {
      const mun = municipios.find((m) => m.codigo === valorDim);
      rotulo = mun?.nome || valorDim;
    }

    const jaExiste = form.aplicacoes.some((a) => a.tipo === dim && a.valor === valor);
    if (jaExiste) {
      toast('Essa aplicação já foi adicionada.', 'error');
      return;
    }

    setForm({
      ...form,
      aplicacoes: [...form.aplicacoes, { tipo: dim, valor, rotulo }],
    });
    setValorDim('');
  };

  const removerAplicacao = (idx) => {
    setForm({ ...form, aplicacoes: form.aplicacoes.filter((_, i) => i !== idx) });
  };

  const handleSalvar = async () => {
    if (!form.nome.trim() || !form.data) {
      toast('Informe nome e data do feriado.', 'error');
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        await atualizarFeriado(editandoId, form);
        toast('Feriado atualizado.', 'success');
      } else {
        await criarFeriado(form);
        toast('Feriado cadastrado.', 'success');
      }
      resetForm();
      await carregar();
    } catch (e) {
      toast('Erro ao salvar feriado: ' + e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (f) => {
    setForm({
      nome: f.nome || '',
      data: f.data || '',
      tipo: f.tipo || 'nacional',
      recorrente: Boolean(f.recorrente),
      aplicacoes: Array.isArray(f.aplicacoes) ? f.aplicacoes : [],
    });
    setEditandoId(f.id);
  };

  const handleExcluir = async (f) => {
    if (!window.confirm(`Excluir o feriado "${f.nome}"?`)) return;
    try {
      await excluirFeriado(f.id);
      toast('Feriado excluído.', 'success');
      await carregar();
    } catch (e) {
      toast('Erro ao excluir feriado: ' + e.message, 'error');
    }
  };

  const ordenados = [...feriados].sort((a, b) => String(a.data).localeCompare(String(b.data)));

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} /> Feriados
        </h3>
      </div>

      {erro && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--danger)' }}>{erro}</div>}

      {podeEditar && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            {editandoId ? 'Editar feriado' : 'Novo feriado'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome</label>
              <input className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Natal" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data</label>
              <input type="date" className="form-input" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tipo</label>
              <select className="form-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.6rem' }}>
              <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} />
              Repete todo ano
            </label>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Aplicar a</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dimensão</label>
                <select className="form-input" value={dim} onChange={(e) => setDim(e.target.value)}>
                  {DIMENSOES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              {dim === 'empresa' && (
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Empresa</label>
                  <select className="form-input" value={valorDim} onChange={(e) => setValorDim(e.target.value)}>
                    <option value="">Selecione...</option>
                    {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.razao_social || emp.nome || emp.id}</option>)}
                  </select>
                </div>
              )}

              {dim === 'uf' && (
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>UF</label>
                  <select className="form-input" value={valorDim} onChange={(e) => setValorDim(e.target.value)}>
                    <option value="">Selecione...</option>
                    {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              )}

              {dim === 'cidade' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>UF</label>
                    <select className="form-input" value={ufCidade} onChange={(e) => { setUfCidade(e.target.value); setValorDim(''); }}>
                      <option value="">Selecione...</option>
                      {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cidade</label>
                    <select className="form-input" value={valorDim} onChange={(e) => setValorDim(e.target.value)} disabled={!ufCidade}>
                      <option value="">{ufCidade ? 'Selecione...' : 'Escolha a UF'}</option>
                      {municipios.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                    </select>
                  </div>
                </>
              )}

              {dim === 'funcionario' && (
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Funcionário</label>
                  <select className="form-input" value={valorDim} onChange={(e) => setValorDim(e.target.value)}>
                    <option value="">Selecione...</option>
                    {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              )}

              <button className="btn-primary" onClick={adicionarAplicacao} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Plus size={16} /> Adicionar
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              {form.aplicacoes.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Sem restrição: vale para todos os funcionários.
                </span>
              ) : form.aplicacoes.map((a, idx) => (
                <span key={`${a.tipo}:${a.valor}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                }}>
                  <strong style={{ color: 'var(--accent-primary)' }}>{a.tipo}</strong>
                  {rotuloAplicacao(a)}
                  <button onClick={() => removerAplicacao(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, lineHeight: 1 }} title="Remover">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Dimensões diferentes são aplicadas em conjunto (E). Vários valores da mesma dimensão são alternativos (OU).
              O comportamento “feriado como dia normal” fica no cadastro de <strong>Horários</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem' }}>
            <button className="btn-primary" onClick={handleSalvar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {editandoId ? <Save size={16} /> : <Plus size={16} />} {editandoId ? 'Salvar' : 'Adicionar feriado'}
            </button>
            {editandoId && (
              <button className="btn-primary" onClick={resetForm} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', padding: '0.5rem 0.7rem' }} title="Cancelar">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Âmbito</th>
                <th>Recorrente</th>
                {podeEditar && <th style={{ width: '100px' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={podeEditar ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando...</td></tr>
              ) : ordenados.length === 0 ? (
                <tr><td colSpan={podeEditar ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum feriado cadastrado</td></tr>
              ) : ordenados.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{formatBR(f.data)}</td>
                  <td>{f.nome}</td>
                  <td style={{ textTransform: 'capitalize' }}>{f.tipo}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {(!f.aplicacoes || f.aplicacoes.length === 0)
                      ? 'Todos'
                      : f.aplicacoes.map((a) => rotuloAplicacao(a)).join(' · ')}
                  </td>
                  <td>{f.recorrente ? 'Sim' : 'Não'}</td>
                  {podeEditar && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-primary" onClick={() => handleEditar(f)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-primary" onClick={() => handleExcluir(f)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
