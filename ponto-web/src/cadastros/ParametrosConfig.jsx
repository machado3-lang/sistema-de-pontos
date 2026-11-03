import { useState } from 'react';
import { Clock, Moon, Sun, AlertTriangle, Calendar, Percent, X, Save } from 'lucide-react';

const CONFIG_PADRAO = {
  noturno: {
    percentual_adicional: 20,
    hora_reduzida_min: 52,
    hora_reduzida_seg: 30,
    inicio: '22:00',
    fim: '05:00',
  },
  horas_extras: {
    dias_uteis: { faixa1_limite: 120, faixa1_pct: 50, faixa2_pct: 100 },
    sabados: { faixa1_limite: 120, faixa1_pct: 50, faixa2_pct: 100 },
    domingos_feriados: { faixa1_limite: 0, faixa1_pct: 100, faixa2_pct: 100 },
  },
  banco_horas: {
    ativo: false,
    limite_positivo: 40,
    limite_negativo: 10,
    prazo_compensacao_dias: 90,
  },
  faltas_atrasos: {
    tolerancia_atraso_minutos: 10,
    desconto_dsr_faltas: true,
    faltas_para_perder_dsr: 5,
    falta_justificada_medico: true,
    carencia_dias_atestado: 15,
  },
  clt_art58: {
    metodo: 'clt_completo',
    tolerancia_entrada_minutos: 10,
    tolerancia_saida_minutos: 10,
    tolerancia_intervalo_minutos: 0,
  },
  dsr: {
    percentual_sobre_he: 100,
    inclui_feriados: true,
    modulo_calc_dsr: 'media_he', // 'media_he' | 'fixo'
  },
};

const SECOES = [
  {
    chave: 'noturno', titulo: 'Adicional Noturno (Art. 73 CLT)',
    descricao: 'Configuração do adicional noturno — hora reduzida de 52min30s entre 22h e 5h.',
    icone: <Moon size={18} />,
    campos: [
      { chave: 'percentual_adicional', label: '% Adicional Noturno', tipo: 'percent', min: 0, max: 100, sufixo: '%' },
      { chave: 'hora_reduzida_min', label: 'Hora Reduzida (minutos)', tipo: 'number', min: 30, max: 60, sufixo: 'min' },
      { chave: 'hora_reduzida_seg', label: 'Hora Reduzida (segundos)', tipo: 'number', min: 0, max: 59, sufixo: 'seg' },
      { chave: 'inicio', label: 'Início Período Noturno', tipo: 'time' },
      { chave: 'fim', label: 'Fim Período Noturno', tipo: 'time' },
    ],
  },
  {
    chave: 'horas_extras', titulo: 'Horas Extras',
    descricao: 'Percentuais de acréscimo — duas faixas por tipo de dia. A 2ª faixa aplica-se ao excedente do limite da 1ª.',
    icone: <Clock size={18} />,
    campos: [
      { chave: 'dias_uteis', sub: [
        { chave: 'faixa1_limite', label: 'Limite 1ª faixa (seg-sex)', tipo: 'number', min: 0, max: 480, sufixo: 'min' },
        { chave: 'faixa1_pct', label: '% 1ª faixa (seg-sex)', tipo: 'percent', min: 0, max: 200, sufixo: '%' },
        { chave: 'faixa2_pct', label: '% 2ª faixa (seg-sex)', tipo: 'percent', min: 0, max: 200, sufixo: '%' },
      ]},
      { chave: 'sabados', sub: [
        { chave: 'faixa1_limite', label: 'Limite 1ª faixa (sáb)', tipo: 'number', min: 0, max: 480, sufixo: 'min' },
        { chave: 'faixa1_pct', label: '% 1ª faixa (sáb)', tipo: 'percent', min: 0, max: 200, sufixo: '%' },
        { chave: 'faixa2_pct', label: '% 2ª faixa (sáb)', tipo: 'percent', min: 0, max: 200, sufixo: '%' },
      ]},
      { chave: 'domingos_feriados', sub: [
        { chave: 'faixa1_pct', label: '% Domingos/Feriados', tipo: 'percent', min: 0, max: 200, sufixo: '%' },
      ]},
    ],
  },
  {
    chave: 'banco_horas', titulo: 'Banco de Horas',
    descricao: 'Compensação de jornada — sistema de banco de horas.',
    icone: <Calendar size={18} />,
    campos: [
      { chave: 'ativo', label: 'Banco de Horas Ativo', tipo: 'toggle' },
      { chave: 'limite_positivo', label: 'Limite Máximo Positivo', tipo: 'number', min: 0, max: 200, sufixo: 'h', depende: 'ativo' },
      { chave: 'limite_negativo', label: 'Limite Máximo Negativo', tipo: 'number', min: 0, max: 100, sufixo: 'h', depende: 'ativo' },
      { chave: 'prazo_compensacao_dias', label: 'Prazo para Compensação', tipo: 'number', min: 1, max: 365, sufixo: 'dias', depende: 'ativo' },
    ],
  },
  {
    chave: 'faltas_atrasos', titulo: 'Faltas e Atrasos',
    descricao: 'Regras para desconto de faltas, atrasos e DSR.',
    icone: <AlertTriangle size={18} />,
    campos: [
      { chave: 'tolerancia_atraso_minutos', label: 'Tolerância de Atraso (min/dia)', tipo: 'number', min: 0, max: 60, sufixo: 'min' },
      { chave: 'desconto_dsr_faltas', label: 'Descontar DSR por Faltas', tipo: 'toggle' },
      { chave: 'faltas_para_perder_dsr', label: 'Faltas no mês para perder DSR', tipo: 'number', min: 0, max: 30, sufixo: 'faltas' },
      { chave: 'falta_justificada_medico', label: 'Atestado Médico Justifica Falta', tipo: 'toggle' },
      { chave: 'carencia_dias_atestado', label: 'Carência p/ Atestado (dias)', tipo: 'number', min: 0, max: 365, sufixo: 'dias', depende: 'falta_justificada_medico' },
    ],
  },
  {
    chave: 'clt_art58', titulo: 'Tolerância Art. 58 CLT',
    descricao: 'Método "Completo" segue a Súmula 366/TST: por batida ≤5min acumula, >5min auto; soma diária >10min contabiliza tudo.',
    icone: <Sun size={18} />,
    campos: [
      { chave: 'metodo', label: 'Método de Cálculo', tipo: 'select', opcoes: [['simples', 'Simples (tolerância fixa)'], ['clt_completo', 'Completo (Art. 58 + Súmula 366/TST)']] },
      { chave: 'tolerancia_entrada_minutos', label: 'Tol. Entrada (só método Simples)', tipo: 'number', min: 0, max: 30, sufixo: 'min' },
      { chave: 'tolerancia_saida_minutos', label: 'Tol. Saída (só método Simples)', tipo: 'number', min: 0, max: 30, sufixo: 'min' },
    ],
  },
  {
    chave: 'dsr', titulo: 'DSR — Descanso Semanal Remunerado',
    descricao: 'Cálculo do DSR sobre horas extras conforme Lei 605/49.',
    icone: <Percent size={18} />,
    campos: [
      { chave: 'percentual_sobre_he', label: '% DSR sobre Hora Extra', tipo: 'percent', min: 0, max: 200, sufixo: '%' },
      { chave: 'modulo_calc_dsr', label: 'Base de Cálculo do DSR', tipo: 'select', opcoes: [['media_he', 'Média de Horas Extras'], ['fixo', 'Valor Fixo']] },
      { chave: 'inclui_feriados', label: 'Incluir Feriados no Cálculo do DSR', tipo: 'toggle' },
    ],
  },
];

function Campo({ secao, campo, config, onChange }) {
  const inputStyle = { padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '80px', textAlign: 'center' };

  if (campo.sub) {
    const obj = config[secao]?.[campo.chave] || {};
    const pode = !campo.depende || config[secao]?.[campo.depende];
    if (!pode) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
        {campo.sub.map(sub => (
          <div key={sub.chave} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)', minWidth: sub.tipo === 'time' ? '160px' : '120px' }}>{sub.label}</span>
            <input
              type={sub.tipo === 'percent' ? 'number' : sub.tipo}
              className="form-input"
              value={obj[sub.chave] ?? ''}
              min={sub.min}
              max={sub.max}
              onChange={e => onChange(secao, campo.chave, sub.chave, sub.tipo === 'number' || sub.tipo === 'percent' ? Number(e.target.value) : e.target.value)}
              style={inputStyle}
            />
            {sub.sufixo && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '30px' }}>{sub.sufixo}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (campo.tipo === 'toggle') {
    const valor = config[secao]?.[campo.chave];
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
        <input type="checkbox" checked={!!valor} onChange={e => onChange(secao, campo.chave, null, e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
        {campo.label}
      </label>
    );
  }

  if (campo.tipo === 'select') {
    const valor = config[secao]?.[campo.chave];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-secondary)', minWidth: '120px' }}>{campo.label}</span>
        <select className="form-input" value={valor || ''} onChange={e => onChange(secao, campo.chave, null, e.target.value)} style={inputStyle}>
          {(campo.opcoes || []).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>
    );
  }

  const valor = config[secao]?.[campo.chave];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: campo.tipo === 'time' ? '160px' : '120px' }}>{campo.label}</span>
      <input
        type={campo.tipo === 'percent' ? 'number' : campo.tipo}
        className="form-input"
        value={valor ?? ''}
        min={campo.min}
        max={campo.max}
        onChange={e => onChange(secao, campo.chave, null, campo.tipo === 'number' || campo.tipo === 'percent' ? Number(e.target.value) : e.target.value)}
        style={inputStyle}
      />
      {campo.sufixo && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '30px' }}>{campo.sufixo}</span>}
    </div>
  );
}

export default function ParametrosConfig({ initialConfig, nome, onSave, onVoltar }) {
  const [config, setConfig] = useState(() => initialConfig || CONFIG_PADRAO);
  const [salvo, setSalvo] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState(SECOES[0].chave);

  const handleChange = (secao, chave, subChave, valor) => {
    setConfig(prev => {
      const novaSecao = { ...prev[secao] };
      if (subChave) {
        novaSecao[chave] = { ...novaSecao[chave], [subChave]: valor };
      } else {
        novaSecao[chave] = valor;
      }
      return { ...prev, [secao]: novaSecao };
    });
    setSalvo(false);
  };

  const handleSalvar = () => {
    if (onSave) onSave(config);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  const handleResetar = () => {
    setConfig(CONFIG_PADRAO);
    if (onSave) onSave(CONFIG_PADRAO);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} /> {nome || 'Parâmetros da Folha de Ponto'}
        </h3>
        <button className="btn-primary" onClick={onVoltar} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <X size={16} /> Voltar
        </button>
      </div>

      <div className="glass-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {SECOES.map(s => (
            <button key={s.chave} className="btn-primary" onClick={() => setAbaAtiva(s.chave)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem',
              background: abaAtiva === s.chave ? 'var(--accent-gradient)' : 'transparent',
              color: abaAtiva === s.chave ? 'white' : 'var(--text-secondary)',
              boxShadow: 'none', border: '1px solid var(--glass-border)', fontSize: '0.85rem'
            }}>
              {s.icone} {s.titulo.split('(')[0].trim()}
            </button>
          ))}
        </div>
        {SECOES.map(s => {
          if (s.chave !== abaAtiva) return null;
          const secaoData = config[s.chave] || {};
          const camposVisiveis = s.campos.filter(c => {
            if (!c.depende) return true;
            if (c.sub) return secaoData[c.depende];
            return secaoData[c.depende];
          });
          return (
            <div key={s.chave} className="fade-in" style={{ padding: '1rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                {s.icone}
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{s.titulo}</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{s.descricao}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {camposVisiveis.map(c => (
                  <Campo key={c.chave} secao={s.chave} campo={c} config={config} onChange={handleChange} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleResetar} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Restaurar Padrão
        </button>
        <button className="btn-primary" onClick={handleSalvar} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Save size={16} /> {salvo ? 'Salvo!' : 'Salvar Parâmetros'}
        </button>
      </div>
    </div>
  );
}
