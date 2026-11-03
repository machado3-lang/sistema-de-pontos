import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, Smartphone, ArrowLeft } from 'lucide-react';
import { formatCPF } from './cadastros/CadastrosUtils';

const API_BASE = (import.meta.env.VITE_PONTOCLOUD_URL || '').replace(/\/+$/, '');

export default function MobileMarcacao({ onBack }) {
  const [step, setStep] = useState('login');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [funcionario, setFuncionario] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingStatus, setMarkingStatus] = useState('');
  const [todayMarkings, setTodayMarkings] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async () => {
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) { setError('CPF inválido'); return; }
    if (!senha) { setError('Digite a senha'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/mobile/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfClean, senha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao entrar');
        setLoading(false);
        return;
      }
      setFuncionario(data.funcionario);
      setToken(data.token);
      setStep('marking');
      await loadTodayMarkings(data.token);
    } catch (e) {
      setError('Erro ao conectar: ' + e.message);
    }
    setLoading(false);
  };

  const loadTodayMarkings = async (tk) => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/marcacoes?limit=50`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!res.ok) { setTodayMarkings([]); return; }
      const data = await res.json();
      setTodayMarkings(data.marcacoes || []);
    } catch {
      setTodayMarkings([]);
    }
  };

  const handleMarcar = async () => {
    if (!token) {
      setError('Sessão expirada. Faça login novamente.');
      setStep('login');
      return;
    }
    setMarkingStatus('enviando');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/mobile/marcar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao registrar ponto');
        setMarkingStatus('');
        return;
      }
      await loadTodayMarkings(token);
      setMarkingStatus('ok');
      setTimeout(() => setMarkingStatus(''), 3000);
    } catch (e) {
      setError('Erro ao registrar: ' + e.message);
      setMarkingStatus('');
    }
  };

  const timeStr = currentTime.toLocaleTimeString('pt-BR');
  const dateStr = currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (step === 'login') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: '360px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Smartphone size={48} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Ponto Mobile</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Registre seu ponto pelo celular</p>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CPF</label>
              <input type="text" className="form-input" style={{ padding: '0.75rem', fontSize: '1rem' }}
                value={cpf} onChange={e => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00" maxLength={14}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Senha</label>
              <input type="password" className="form-input" style={{ padding: '0.75rem', fontSize: '1rem' }}
                value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="******"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', background: 'rgba(230,46,46,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}
              style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 600, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => { setStep('login'); setSenha(''); setError(''); setToken(''); setFuncionario(null); setTodayMarkings([]); }}
            style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{funcionario.nome}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatCPF(funcionario.cpf)}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Clock size={40} style={{ color: 'var(--accent-primary)' }} />
          <div style={{ fontSize: '3rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '2px' }}>{timeStr}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{dateStr}</div>

          <button onClick={handleMarcar} disabled={markingStatus === 'enviando'}
            style={{
              marginTop: '1rem', width: '100%', padding: '1.25rem', fontSize: '1.25rem', fontWeight: 700,
              border: 'none', borderRadius: 'var(--radius-lg)', cursor: markingStatus === 'enviando' ? 'wait' : 'pointer',
              background: markingStatus === 'ok' ? 'var(--success)' : 'var(--accent-gradient)',
              color: '#fff', boxShadow: '0 4px 20px rgba(0,102,204,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.2s', opacity: markingStatus === 'enviando' ? 0.7 : 1
            }}>
            {markingStatus === 'ok'
              ? <><CheckCircle2 size={24} /> Ponto Registrado!</>
              : markingStatus === 'enviando'
                ? <>Registrando...</>
                : <>BATER PONTO</>}
          </button>

          {error && (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', background: 'rgba(230,46,46,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'left' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {todayMarkings.length > 0 && (
            <div style={{ width: '100%', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Registros de hoje:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {todayMarkings.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.75rem', background: 'rgba(0,102,204,0.08)',
                    borderRadius: 'var(--radius-md)', fontSize: '0.85rem'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Marcação {i + 1}</span>
                    <span style={{ fontWeight: 600 }}>{m.hora?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
