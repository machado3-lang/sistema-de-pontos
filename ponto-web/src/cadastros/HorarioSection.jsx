import { useState } from 'react';
import { Plus, X, Save, Edit2, Trash2, Clock, Calendar, formatMinutos, calcMinutos, DIAS_SEMANA, TIPOS_JORNADA } from './CadastrosUtils';
import { criarHorario, atualizarHorario, excluirHorario } from '../data/pontoData';

function TableList({ horarios, setSubTab, resetHorForm, handleEditarHorario, handleExcluirHorario, calcCargaSemanal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const filtrados = horarios.filter(h => {
    if (filtroAtivo === 'ativos') { if (h.ativo === false) return false; }
    if (filtroAtivo === 'inativos') { if (h.ativo !== false) return false; }
    if (!searchTerm) return true;
    const termo = searchTerm.toLowerCase();
    return h.nome.toLowerCase().includes(termo) || h.tipo.toLowerCase().includes(termo);
  });
  const badgeStyle = (tipo) => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
    background: tipo === 'Fixa' ? 'rgba(99,102,241,0.15)' :
                tipo === 'Turno Noturno' ? 'rgba(139,92,246,0.15)' :
                tipo === 'Escala Flexível' ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
    color: tipo === 'Fixa' ? '#818cf8' :
           tipo === 'Turno Noturno' ? '#a78bfa' :
           tipo === 'Escala Flexível' ? '#fbbf24' : '#34d399'
  });
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={20} /> Grade de Horários</h3>
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
          <button className="btn-primary" onClick={() => { resetHorForm(); setSubTab('novo_horario'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Novo Horário
          </button>
        </div>
      </div>
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
        <input type="text" className="form-input" placeholder="Pesquisar por nome ou tipo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div className="glass-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Dias</th>
                <th>Carga p/ dia</th>
                <th>Comp.</th>
                <th>Status</th>
                <th style={{ width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum horário encontrado</td></tr>
              ) : (
                filtrados.map(h => {
                  const diasAtivos = h.dias ? DIAS_SEMANA.filter(d => h.dias[d.key]?.ativo).length : 0;
                  const escalaDias = h.tipo === 'Escala Flexível' ? (h.dias_escala || []).filter(d => d.tipo === 'Trabalho').length : 0;
                  const diasLabel = h.tipo === 'Escala Flexível' ? `${escalaDias}T / ${(h.dias_escala || []).length - escalaDias}F` : h.tipo === 'Eventual' ? '1 dia' : `${diasAtivos}/7`;
                  const cargaStr = h.tipo === 'Escala Flexível' ? '---' : h.tipo === 'Eventual' ? (() => { const ev = h.eventual; if (!ev) return '00:00'; if (ev.modo_periodos) return formatMinutos((ev.periodos || []).reduce((acc, p) => acc + (p.entrada && p.saida ? calcMinutos(p.saida) - calcMinutos(p.entrada) : 0), 0)); return formatMinutos(calcMinutos(ev.carga_diaria || '00:00')); })() : formatMinutos(calcCargaSemanal(h.dias || {}, h.compensacao_semanal));
                  const compStr = h.tipo === 'Eventual' ? '---' : h.compensacao_semanal ? 'Sim' : 'Não';
                  return (
                    <tr key={h.id}>
                      <td><strong>{h.nome}</strong></td>
                      <td><span style={badgeStyle(h.tipo)}>{h.tipo}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{diasLabel}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cargaStr}</td>
                      <td style={{ fontSize: '0.85rem', color: h.compensacao_semanal ? 'var(--success)' : 'var(--text-muted)' }}>{compStr}</td>
                      <td>
                        {h.ativo === false ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>Inativo</span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}>Ativo</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn-primary" onClick={() => handleEditarHorario(h)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none' }} title="Editar"><Edit2 size={14} /></button>
                          <button className="btn-primary" onClick={() => handleExcluirHorario(h.id, h.nome)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', boxShadow: 'none' }} title="Excluir"><Trash2 size={14} /></button>
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

function HorarioForm({
  horForm, setHorForm, editandoHorId, setSubTab, resetHorForm,
  handleSalvarHorario, handleAtualizarHorario,
  toggleDia, toggleCompDia, addPeriodo, removePeriodo, updatePeriodo,
  toggleDiaEscalaTipo, updateDiaEscala, addPeriodoEscala, removePeriodoEscala, updatePeriodoEscala, toggleModoPeriodosEscala, toggleCompEscala,
  calcCargaSemanal, DIAS_SEMANA, TIPOS_JORNADA, formatMinutos, calcMinutos
}) {
  const isEdit = editandoHorId !== null;
  const ehNoturno = horForm.tipo === 'Turno Noturno';
  const ehEscala = horForm.tipo === 'Escala Flexível';
  const ehEventual = horForm.tipo === 'Eventual';
  const ehFixa = horForm.tipo === 'Fixa';
  const showCompSemanal = ehFixa;
  const showJornadaDiaria = ehFixa || ehNoturno;
  const showEscalaFlexivel = ehEscala;
  const showEventual = ehEventual;

  const sectionHeader = (icon, text) => (
    <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
      {icon} {text}
    </h4>
  );

  const renderJornadaDiaria = () => {
    const showPerPeriodo = !horForm.compensacao_semanal;
    return (
      <div>
        {sectionHeader(<Calendar size={16} />, '2. Jornada Diária')}
        {ehFixa && horForm.compensacao_semanal && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--warning)' }}>
            Compensação Semanal ativa: períodos ocultos. A carga diária define o total.
          </div>
        )}
        {DIAS_SEMANA.map(d => {
          const dia = horForm.dias[d.key] || { ativo: false, carga_diaria: '00:00', periodos: [{ entrada: '', saida: '' }], comp: false };
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--glass-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '90px', cursor: 'pointer' }}>
                <input type="checkbox" checked={dia.ativo} onChange={() => toggleDia(d.key)} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: dia.ativo ? 600 : 400, color: dia.ativo ? 'var(--text-primary)' : 'var(--text-muted)' }}>{d.label}</span>
              </label>
              {dia.ativo && (
                <>
                  <input type="time" className="form-input" value={dia.carga_diaria} onChange={e => setHorForm(prev => ({ ...prev, dias: { ...prev.dias, [d.key]: { ...prev.dias[d.key], carga_diaria: e.target.value } } }))} style={{ width: '100px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', opacity: showPerPeriodo ? 0.4 : 1 }} readOnly={showPerPeriodo} />
                  {showPerPeriodo && (
                    <>
                      <button onClick={() => toggleCompDia(d.key)} style={{ background: dia.comp ? 'rgba(34,197,94,0.15)' : 'none', border: `1px solid ${dia.comp ? 'var(--success)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-md)', color: dia.comp ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>
                        {dia.comp ? 'Flex.' : 'Fixo'}
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', flex: 1 }}>
                        {dia.periodos.map((p, pIdx) => (
                          <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <input type="time" className="form-input" value={p.entrada} onChange={e => updatePeriodo(d.key, pIdx, 'entrada', e.target.value)} style={{ width: '90px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>às</span>
                            <input type="time" className="form-input" value={p.saida} onChange={e => updatePeriodo(d.key, pIdx, 'saida', e.target.value)} style={{ width: '90px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                            {dia.periodos.length > 1 && (
                              <button onClick={() => removePeriodo(d.key, pIdx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', lineHeight: 1 }} title="Remover período"><X size={13} /></button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addPeriodo(d.key)} style={{ background: 'none', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                          <Plus size={12} /> Período
                        </button>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: dia.comp ? 'var(--success)' : 'var(--text-primary)', minWidth: '60px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatMinutos(dia.periodos.reduce((acc, p) => acc + (p.entrada && p.saida ? calcMinutos(p.saida) - calcMinutos(p.entrada) : 0), 0))}
                      </span>
                    </>
                  )}
                  {!showPerPeriodo && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Carga: {dia.carga_diaria}</span>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Carga Semanal: <strong style={{ color: 'var(--accent-primary)' }}>{formatMinutos(calcCargaSemanal(horForm.dias, horForm.compensacao_semanal))}</strong>
        </div>
      </div>
    );
  };

  const renderEscalaFlexivel = () => {
    return (
      <div>
        {sectionHeader(<Calendar size={16} />, '2. Escala Flexível')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Quantidade de Dias</label>
            <input type="number" className="form-input" value={horForm.qtd_dias_escala} min="1" max="31" onChange={e => {
              const val = parseInt(e.target.value) || 1;
              setHorForm(prev => {
                const atual = prev.dias_escala.length;
                let novos;
                if (val > atual) {
                  novos = [...prev.dias_escala];
                  for (let i = atual; i < val; i++) novos.push({ nome: `Dia ${i + 1}`, tipo: 'Trabalho', carga_diaria: '08:00', periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }], modo_periodos: true });
                } else {
                  novos = prev.dias_escala.slice(0, val);
                }
                return { ...prev, qtd_dias_escala: val, dias_escala: novos };
              });
            }} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data de Início</label>
            <input type="date" className="form-input" value={horForm.data_inicio_escala} onChange={e => setHorForm(prev => ({ ...prev, data_inicio_escala: e.target.value }))} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Defina o ciclo de escala: {horForm.qtd_dias_escala} dia(s)
        </div>
        {horForm.dias_escala.map((dia, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderBottom: idx < horForm.dias_escala.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
            <strong style={{ fontSize: '0.85rem', minWidth: '50px' }}>{dia.nome}</strong>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.8rem', minWidth: '75px' }}>
              <input type="checkbox" checked={dia.tipo === 'Trabalho'} onChange={() => toggleDiaEscalaTipo(idx)} style={{ accentColor: 'var(--accent-primary)' }} />
              <span style={{ color: dia.tipo === 'Trabalho' ? 'var(--success)' : 'var(--text-muted)' }}>{dia.tipo === 'Trabalho' ? 'Trabalho' : 'Folga'}</span>
            </label>
            {dia.tipo === 'Trabalho' ? (
              <>
                <input type="time" className="form-input" value={dia.carga_diaria} onChange={e => updateDiaEscala(idx, 'carga_diaria', e.target.value)} style={{ width: '90px', padding: '0.25rem 0.4rem', fontSize: '0.8rem', opacity: dia.modo_periodos ? 0.4 : 1 }} readOnly={dia.modo_periodos} />
                <button onClick={() => toggleModoPeriodosEscala(idx)} style={{ background: dia.modo_periodos ? 'rgba(99,102,241,0.15)' : 'none', border: `1px solid ${dia.modo_periodos ? 'var(--accent-primary)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-md)', color: dia.modo_periodos ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {dia.modo_periodos ? 'Per.' : 'Carga'}
                </button>
                {dia.modo_periodos && (
                  <>
                    <button onClick={() => toggleCompEscala(idx)} style={{ background: dia.comp ? 'rgba(34,197,94,0.15)' : 'none', border: `1px solid ${dia.comp ? 'var(--success)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-md)', color: dia.comp ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {dia.comp ? 'Flex.' : 'Fixo'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', flex: 1 }}>
                      {dia.periodos.map((p, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input type="time" className="form-input" value={p.entrada} onChange={e => updatePeriodoEscala(idx, pIdx, 'entrada', e.target.value)} style={{ width: '80px', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>às</span>
                          <input type="time" className="form-input" value={p.saida} onChange={e => updatePeriodoEscala(idx, pIdx, 'saida', e.target.value)} style={{ width: '80px', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }} />
                          {dia.periodos.length > 1 && (
                            <button onClick={() => removePeriodoEscala(idx, pIdx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '1px', lineHeight: 1 }} title="Remover"><X size={12} /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addPeriodoEscala(idx)} style={{ background: 'none', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                        <Plus size={11} /> Período
                      </button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        Total: {formatMinutos(dia.periodos.reduce((acc, p) => acc + (p.entrada && p.saida ? calcMinutos(p.saida) - calcMinutos(p.entrada) : 0), 0))}
                      </span>
                    </div>
                  </>
                )}
                {!dia.modo_periodos && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total: {dia.carga_diaria}</span>
                )}
              </>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
        ))}
        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Dias de trabalho: <strong style={{ color: 'var(--success)' }}>{horForm.dias_escala.filter(d => d.tipo === 'Trabalho').length}</strong> | Folgas: <strong style={{ color: 'var(--text-muted)' }}>{horForm.dias_escala.filter(d => d.tipo === 'Folga').length}</strong>
        </div>
      </div>
    );
  };

  const renderEventual = () => {
    const dia = horForm.eventual;
    const totalPeriodos = (dia.periodos || []).reduce((acc, p) => acc + (p.entrada && p.saida ? calcMinutos(p.saida) - calcMinutos(p.entrada) : 0), 0);
    return (
      <div>
        {sectionHeader(<Calendar size={16} />, '2. Jornada do Dia Eventual')}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Defina a jornada padrão para o dia eventual. Este modelo será utilizado quando o horário eventual for atribuído a um colaborador.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
          <strong style={{ fontSize: '0.9rem', minWidth: '100px' }}>Dia Eventual</strong>
          <input type="time" className="form-input" value={dia.carga_diaria} onChange={e => setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, carga_diaria: e.target.value } }))} style={{ width: '100px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', opacity: dia.modo_periodos ? 0.4 : 1 }} readOnly={dia.modo_periodos} />
          <button onClick={() => setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, modo_periodos: !prev.eventual.modo_periodos } }))} style={{ background: dia.modo_periodos ? 'rgba(99,102,241,0.15)' : 'none', border: `1px solid ${dia.modo_periodos ? 'var(--accent-primary)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-md)', color: dia.modo_periodos ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            {dia.modo_periodos ? 'Per.' : 'Carga'}
          </button>
          {dia.modo_periodos && (
            <>
              <button onClick={() => setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, comp: !prev.eventual.comp } }))} style={{ background: dia.comp ? 'rgba(34,197,94,0.15)' : 'none', border: `1px solid ${dia.comp ? 'var(--success)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-md)', color: dia.comp ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                {dia.comp ? 'Flex.' : 'Fixo'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', flex: 1 }}>
                {dia.periodos.map((p, pIdx) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="time" className="form-input" value={p.entrada} onChange={e => { const n = [...dia.periodos]; n[pIdx] = { ...n[pIdx], entrada: e.target.value }; setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, periodos: n } })); }} style={{ width: '80px', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>às</span>
                    <input type="time" className="form-input" value={p.saida} onChange={e => { const n = [...dia.periodos]; n[pIdx] = { ...n[pIdx], saida: e.target.value }; setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, periodos: n } })); }} style={{ width: '80px', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }} />
                    {dia.periodos.length > 1 && (
                      <button onClick={() => { const n = dia.periodos.filter((_, i) => i !== pIdx); setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, periodos: n } })); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '1px', lineHeight: 1 }} title="Remover"><X size={12} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setHorForm(prev => ({ ...prev, eventual: { ...prev.eventual, periodos: [...prev.eventual.periodos, { entrada: '', saida: '' }] } }))} style={{ background: 'none', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                  <Plus size={11} /> Período
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total: {formatMinutos(totalPeriodos)}</span>
              </div>
            </>
          )}
          {!dia.modo_periodos && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total: {dia.carga_diaria}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600 }}>{isEdit ? 'Editar Horário' : 'Novo Horário'}</h3>
        <button className="btn-primary" onClick={() => { resetHorForm(); setSubTab('horarios'); }} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'none' }}>
          <X size={18} /> Cancelar
        </button>
      </div>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          {sectionHeader(<Clock size={16} />, '1. Identificação')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome do Horário *</label>
              <input type="text" className="form-input" value={horForm.nome} onChange={e => setHorForm(prev => ({ ...prev, nome: e.target.value }))} placeholder="Ex: Comercial 44h" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tipo</label>
              <select className="form-input" value={horForm.tipo} onChange={e => setHorForm(prev => ({ ...prev, tipo: e.target.value }))}>
                {TIPOS_JORNADA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '0.25rem' }}>
                <button onClick={() => setHorForm(prev => ({ ...prev, ativo: !prev.ativo }))} style={{
                  width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                  background: horForm.ativo ? 'var(--success)' : 'var(--glass-border)', transition: 'background 0.2s'
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px',
                    left: horForm.ativo ? '24px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
                <span style={{ fontSize: '0.85rem', color: horForm.ativo ? 'var(--success)' : 'var(--text-muted)' }}>{horForm.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            {ehNoturno && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Adicional Noturno (%)</label>
                  <input type="number" className="form-input" value={horForm.adicional_noturno} onChange={e => setHorForm(prev => ({ ...prev, adicional_noturno: e.target.value }))} placeholder="Ex: 20" min="0" max="100" style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hora Reduzida</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '0.25rem' }}>
                    <button onClick={() => setHorForm(prev => ({ ...prev, hora_reduzida: !prev.hora_reduzida }))} style={{
                      width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                      background: horForm.hora_reduzida ? 'var(--accent-primary)' : 'var(--glass-border)', transition: 'background 0.2s'
                    }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px',
                        left: horForm.hora_reduzida ? '24px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: horForm.hora_reduzida ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{horForm.hora_reduzida ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </>
            )}
            {showCompSemanal && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Compensação Semanal</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '0.25rem' }}>
                  <button onClick={() => setHorForm(prev => ({ ...prev, compensacao_semanal: !prev.compensacao_semanal }))} style={{
                    width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                    background: horForm.compensacao_semanal ? 'var(--success)' : 'var(--glass-border)', transition: 'background 0.2s'
                  }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px',
                      left: horForm.compensacao_semanal ? '24px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                  <span style={{ fontSize: '0.85rem', color: horForm.compensacao_semanal ? 'var(--success)' : 'var(--text-muted)' }}>{horForm.compensacao_semanal ? 'Sim' : 'Não'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <hr style={{ borderColor: 'var(--glass-border)', borderTop: 'none' }} />

        {showJornadaDiaria && renderJornadaDiaria()}
        {showEventual && renderEventual()}
        {showEscalaFlexivel && renderEscalaFlexivel()}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button className="btn-primary" onClick={isEdit ? handleAtualizarHorario : handleSalvarHorario} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={18} /> {isEdit ? 'Atualizar Horário' : 'Salvar Horário'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HorarioSection({ horarios, setHorarios, subTab, setSubTab }) {
  const [editandoHorId, setEditandoHorId] = useState(null);
  const eventualPadrao = { carga_diaria: '08:00', periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }], modo_periodos: true, comp: false };

  const [horForm, setHorForm] = useState({
    nome: '', tipo: 'Fixa', ativo: true, compensacao_semanal: false,
    adicional_noturno: '', hora_reduzida: false,
    qtd_dias_escala: 7, data_inicio_escala: '',
    dias_escala: Array.from({ length: 7 }, (_, i) => ({
      nome: `Dia ${i + 1}`,
      tipo: 'Trabalho',
      carga_diaria: '08:00',
      periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }],
      modo_periodos: true,
      comp: false
    })),
    dias: Object.fromEntries(DIAS_SEMANA.map(d => [d.key, { ativo: false, carga_diaria: '00:00', periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }], comp: false }])),
    eventual: { ...eventualPadrao }
  });

  const criarDiasPadrao = () => Object.fromEntries(DIAS_SEMANA.map(d => [d.key, { ativo: false, carga_diaria: '00:00', periodos: [{ entrada: '', saida: '' }], comp: false }]));

  const resetHorForm = () => {
    setHorForm({
      nome: '', tipo: 'Fixa', ativo: true, compensacao_semanal: false,
      adicional_noturno: '', hora_reduzida: false,
      qtd_dias_escala: 7, data_inicio_escala: '',
      dias_escala: Array.from({ length: 7 }, (_, i) => ({
        nome: `Dia ${i + 1}`,
        tipo: 'Trabalho',
        carga_diaria: '08:00',
        periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }],
        modo_periodos: true,
        comp: false
      })),
      dias: criarDiasPadrao(),
      eventual: { ...eventualPadrao }
    });
    setEditandoHorId(null);
  };

  const handleSalvarHorario = async () => {
    if (!horForm.nome) { alert("Preencha o nome do horário!"); return; }
    try {
      const novo = await criarHorario(horForm);
      setHorarios(prev => [...prev, novo]);
      resetHorForm();
      setSubTab('horarios');
    } catch (e) {
      alert('Erro ao salvar horário: ' + e.message);
    }
  };

  const handleEditarHorario = (hor) => {
    setHorForm({
      nome: hor.nome || '',
      tipo: hor.tipo || 'Fixa',
      ativo: hor.ativo !== undefined ? hor.ativo : true,
      compensacao_semanal: hor.compensacao_semanal || false,
      adicional_noturno: hor.adicional_noturno || '',
      hora_reduzida: hor.hora_reduzida || false,
      qtd_dias_escala: hor.qtd_dias_escala || 7,
      data_inicio_escala: hor.data_inicio_escala || '',
      dias_escala: hor.dias_escala ? hor.dias_escala.map(d => ({ ...d, comp: d.comp || false })) : Array.from({ length: 7 }, (_, i) => ({
        nome: `Dia ${i + 1}`, tipo: 'Trabalho', carga_diaria: '08:00',
        periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }],
        modo_periodos: true, comp: false
      })),
      dias: hor.dias ? Object.fromEntries(DIAS_SEMANA.map(d => [d.key, { ...hor.dias[d.key], ativo: hor.dias[d.key]?.ativo || false, carga_diaria: hor.dias[d.key]?.carga_diaria || '00:00', periodos: hor.dias[d.key]?.periodos || [{ entrada: '', saida: '' }], comp: hor.dias[d.key]?.comp || false }])) : criarDiasPadrao(),
      eventual: hor.eventual || { ...eventualPadrao }
    });
    setEditandoHorId(hor.id);
    setSubTab('editar_horario');
  };

  const handleAtualizarHorario = async () => {
    if (!horForm.nome) { alert("Preencha o nome do horário!"); return; }
    try {
      const atualizado = await atualizarHorario(editandoHorId, horForm);
      setHorarios(prev => prev.map(h => h.id === editandoHorId ? atualizado : h));
      resetHorForm();
      setSubTab('horarios');
    } catch (e) {
      alert('Erro ao atualizar horário: ' + e.message);
    }
  };

  const handleExcluirHorario = async (id, nome) => {
    if (!window.confirm(`Excluir horário "${nome}"?`)) return;
    try {
      await excluirHorario(id);
      setHorarios(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      alert('Erro ao excluir horário: ' + e.message);
    }
  };

  const toggleDia = (key) => {
    setHorForm(prev => ({
      ...prev,
      dias: { ...prev.dias, [key]: { ...prev.dias[key], ativo: !prev.dias[key].ativo } }
    }));
  };

  const toggleCompDia = (key) => {
    setHorForm(prev => ({
      ...prev,
      dias: { ...prev.dias, [key]: { ...prev.dias[key], comp: !prev.dias[key].comp } }
    }));
  };

  const addPeriodo = (diaKey) => {
    setHorForm(prev => ({
      ...prev,
      dias: { ...prev.dias, [diaKey]: { ...prev.dias[diaKey], periodos: [...prev.dias[diaKey].periodos, { entrada: '', saida: '' }] } }
    }));
  };

  const removePeriodo = (diaKey, idx) => {
    setHorForm(prev => ({
      ...prev,
      dias: { ...prev.dias, [diaKey]: { ...prev.dias[diaKey], periodos: prev.dias[diaKey].periodos.filter((_, i) => i !== idx) } }
    }));
  };

  const updatePeriodo = (diaKey, idx, campo, valor) => {
    setHorForm(prev => {
      const novos = [...prev.dias[diaKey].periodos];
      novos[idx] = { ...novos[idx], [campo]: valor };
      return {
        ...prev,
        dias: { ...prev.dias, [diaKey]: { ...prev.dias[diaKey], periodos: novos } }
      };
    });
  };

  const calcCargaSemanal = (dias, compensacaoSemanal) => {
    let total = 0;
    for (const d of DIAS_SEMANA) {
      if (dias[d.key]?.ativo) {
        if (compensacaoSemanal) {
          total += calcMinutos(dias[d.key].carga_diaria || '00:00');
        } else {
          const periodos = dias[d.key].periodos || [];
          for (const p of periodos) {
            if (p.entrada && p.saida) {
              total += calcMinutos(p.saida) - calcMinutos(p.entrada);
            }
          }
        }
      }
    }
    return total;
  };

  const toggleDiaEscalaTipo = (idx) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      novos[idx] = { ...novos[idx], tipo: novos[idx].tipo === 'Trabalho' ? 'Folga' : 'Trabalho' };
      return { ...prev, dias_escala: novos };
    });
  };

  const updateDiaEscala = (idx, campo, valor) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      novos[idx] = { ...novos[idx], [campo]: valor };
      return { ...prev, dias_escala: novos };
    });
  };

  const addPeriodoEscala = (idx) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      novos[idx] = { ...novos[idx], periodos: [...novos[idx].periodos, { entrada: '', saida: '' }] };
      return { ...prev, dias_escala: novos };
    });
  };

  const removePeriodoEscala = (idx, pIdx) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      novos[idx] = { ...novos[idx], periodos: novos[idx].periodos.filter((_, i) => i !== pIdx) };
      return { ...prev, dias_escala: novos };
    });
  };

  const updatePeriodoEscala = (idx, pIdx, campo, valor) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      const novosPeriodos = [...novos[idx].periodos];
      novosPeriodos[pIdx] = { ...novosPeriodos[pIdx], [campo]: valor };
      novos[idx] = { ...novos[idx], periodos: novosPeriodos };
      return { ...prev, dias_escala: novos };
    });
  };

  const toggleModoPeriodosEscala = (idx) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      novos[idx] = { ...novos[idx], modo_periodos: !novos[idx].modo_periodos };
      return { ...prev, dias_escala: novos };
    });
  };

  const toggleCompEscala = (idx) => {
    setHorForm(prev => {
      const novos = [...prev.dias_escala];
      novos[idx] = { ...novos[idx], comp: !novos[idx].comp };
      return { ...prev, dias_escala: novos };
    });
  };

  if (subTab === 'horarios') return <TableList horarios={horarios} setSubTab={setSubTab} resetHorForm={resetHorForm} handleEditarHorario={handleEditarHorario} handleExcluirHorario={handleExcluirHorario} calcCargaSemanal={calcCargaSemanal} />;
  if (subTab === 'novo_horario' || subTab === 'editar_horario') return <HorarioForm horForm={horForm} setHorForm={setHorForm} editandoHorId={editandoHorId} setSubTab={setSubTab} resetHorForm={resetHorForm} handleSalvarHorario={handleSalvarHorario} handleAtualizarHorario={handleAtualizarHorario} toggleDia={toggleDia} toggleCompDia={toggleCompDia} addPeriodo={addPeriodo} removePeriodo={removePeriodo} updatePeriodo={updatePeriodo} toggleDiaEscalaTipo={toggleDiaEscalaTipo} updateDiaEscala={updateDiaEscala} addPeriodoEscala={addPeriodoEscala} removePeriodoEscala={removePeriodoEscala} updatePeriodoEscala={updatePeriodoEscala} toggleModoPeriodosEscala={toggleModoPeriodosEscala} toggleCompEscala={toggleCompEscala} calcCargaSemanal={calcCargaSemanal} DIAS_SEMANA={DIAS_SEMANA} TIPOS_JORNADA={TIPOS_JORNADA} formatMinutos={formatMinutos} calcMinutos={calcMinutos} />;
  return null;
}
