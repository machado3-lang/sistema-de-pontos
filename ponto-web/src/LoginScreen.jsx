import { useState } from 'react';
import { Clock, LogIn, Lock, Building, AlertCircle } from 'lucide-react';
import { api, setToken } from './api';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await api.auth.login(email, password);
      setToken(data.token);
      setLoading(false);
      onLogin(data.usuario);
    } catch (err) {
      setErrorMsg(
        err.status === 401
          ? 'Credenciais inválidas.'
          : (err.message || 'Erro ao entrar. Tente novamente.')
      );
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-primary)' }}>
      
      {/* Lado Esquerdo: Marca / Propaganda */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '4rem',
        background: 'linear-gradient(135deg, rgba(0, 102, 204, 0.1) 0%, rgba(0, 179, 89, 0.1) 100%)',
        borderRight: '1px solid var(--glass-border)',
        overflow: 'hidden'
      }}>
        {/* Blob Animado Decorativo */}
        <div style={{
          position: 'absolute',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(0, 102, 204, 0.15) 0%, transparent 60%)',
          top: '-100px', left: '-100px',
          borderRadius: '50%',
          filter: 'blur(40px)',
          animation: 'pulse 4s infinite alternate'
        }}></div>

        <div style={{ zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <Clock size={42} style={{ color: '#0066cc', marginRight: 10 }} />
          <span style={{ fontSize: '2.8rem', fontWeight: 700 }}>
            <span style={{ color: '#e62e2e' }}>M</span>
            <span style={{ color: '#00b359' }}>ulti</span>
            <span style={{ color: '#e62e2e' }}>P</span>
            <span style={{ background: 'linear-gradient(135deg, #0066cc, #00b359)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>onto</span>
          </span>
          </div>
          
          <h2 style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '1.5rem', color: 'white' }}>
            A Gestão de Ponto<br/>do Futuro.
          </h2>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.6 }}>
            Tratamento de batidas offline ultra-rápido. Portarias 1510 e 671 em um só lugar. Software as a Service.
          </p>
        </div>
      </div>

      {/* Lado Direito: Formulário de Login */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '420px', padding: '3rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Bem-vindo de volta</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Acesse o portal da sua empresa.</p>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <AlertCircle size={18} /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={16} /> E-mail Corporativo
              </label>
              <input 
                type="email" 
                required
                className="form-input" 
                placeholder="rh@suaempresa.com.br" 
                style={{ padding: '0.85rem 1rem', width: '100%', background: 'rgba(255,255,255,0.03)' }}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={16} /> Senha de Acesso
                </label>
                <a href="#" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>Esqueceu a senha?</a>
              </div>
              <input 
                type="password" 
                required
                className="form-input" 
                placeholder="••••••••" 
                style={{ padding: '0.85rem 1rem', width: '100%', background: 'rgba(255,255,255,0.03)' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}
              disabled={loading}
            >
              {loading ? (
                <>Conectando...</>
              ) : (
                <><LogIn size={20} /> Entrar na Plataforma</>
              )}
            </button>
            
          </form>

          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Protegido e certificado por Multicom MS Ltda.
          </div>
        </div>
      </div>
    </div>
  );
}
