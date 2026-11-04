import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  UploadCloud, 
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

import { parseAFD, parseAFDLinhas, parseMinutosToHHMM, validarAFD } from './PontoEngine';
import CadastrosTab from './CadastrosTab';
import ApuracaoTab from './ApuracaoTab';
import RelatoriosTab from './RelatoriosTab';
import LoginScreen from './LoginScreen';
import MobileMarcacao from './MobileMarcacao';
import { api, getToken, clearToken } from './api';
import { ToastProvider } from './components/Toast';

// Identificador estável do arquivo AFD importado. Evita colisão de NSR entre
// arquivos diferentes (o NSR reinicia em cada arquivo do REP).
function identificadorAfd(conteudo) {
  let h = 0x811c9dc5;
  for (let i = 0; i < conteudo.length; i++) {
    h ^= conteudo.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'afd:' + (h >>> 0).toString(16).padStart(8, '0');
}

function DashboardLayout({ onLogout, usuario }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [pontoData, setPontoData] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);

  useEffect(() => {
    api.funcionarios.list()
      .then((data) => { if (Array.isArray(data)) setFuncionarios(data); })
      .catch(() => {});
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setImportResult(null);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const conteudo = e.target.result;

      setTimeout(async () => {
        const resultado = parseAFD(conteudo);
        const validacao = validarAFD(conteudo);
        const afdId = identificadorAfd(conteudo);
        setPontoData(resultado);
        setIsUploading(false);

        const funcMap = {};
        funcionarios.forEach(f => {
          const cpf = (f.cpf || '').replace(/\D/g, '');
          const pis = (f.pis || '').replace(/\D/g, '');
          if (cpf) funcMap[cpf] = { docType: 'cpf', ...f };
          if (pis) funcMap[pis] = { docType: 'pis', ...f };
        });

        const matched = [];
        const unmatched = [];
        const unmatchedDocs = new Set();
        const { linhas } = parseAFDLinhas(conteudo);
        const nomesAfd = resultado.nomes || {};

        for (const l of linhas) {
          const doc = l.documento;
          if (!doc) continue;
          const func = funcMap[doc];
          const enriched = {
            cpf: l.portaria === '671' ? doc : '',
            pis: l.portaria === '1510' ? doc : '',
            data: l.data,
            hora: l.hora,
            importado_em: new Date().toISOString(),
            equip_id: afdId,
            equip_nome: `AFD Manual — ${file.name}`,
            funcionario_id: func?.id || null,
            sem_funcionario: !func,
            nsr: l.nsr,
          };
          if (func) {
            matched.push(enriched);
          } else {
            unmatched.push(enriched);
            unmatchedDocs.add(doc);
          }
        }

        const naoEncontrados = [...unmatchedDocs].map((doc) => ({
          doc,
          nome: nomesAfd[doc] || '',
        }));

        if (matched.length > 0) {
          try {
            await api.marcacoes.import(matched.map(m => ({
              funcionario_id: m.funcionario_id,
              nsr: m.nsr,
              cpf: m.cpf,
              pis: m.pis,
              data: m.data,
              hora: m.hora,
              equip_id: m.equip_id,
              equip_nome: m.equip_nome,
              origem: 'afd',
            })));
          } catch (e) {
            console.warn('Falha ao importar marcações no servidor:', e.message);
          }
        }

        setImportResult({
          total: resultado.totalBatidas,
          importadas: matched.length,
          descartadas: unmatched.length,
          funcNaoCadastrados: unmatchedDocs.size,
          naoEncontrados,
          cabecalho: resultado.cabecalho || null,
          validacao,
        });
      }, 500);
    };
    
    reader.readAsText(file, 'iso-8859-1');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-1px' }}>
            <span style={{ color: '#e62e2e' }}>P</span>
            <span style={{ background: 'linear-gradient(135deg, #0066cc, #00b359)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>onto</span>
          </span>
        </div>

        <nav className="nav-menu">
          <a 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </a>
          <a 
            className={`nav-item ${activeTab === 'cadastros' ? 'active' : ''}`}
            onClick={() => setActiveTab('cadastros')}
          >
            <Users size={20} />
            <span>Cadastros</span>
          </a>
          <a 
            className={`nav-item ${activeTab === 'apuracao' ? 'active' : ''}`}
            onClick={() => setActiveTab('apuracao')}
          >
            <Activity size={20} />
            <span>Apuração de Ponto</span>
          </a>
          <a 
            className={`nav-item ${activeTab === 'relatorios' ? 'active' : ''}`}
            onClick={() => setActiveTab('relatorios')}
          >
            <FileText size={20} />
            <span>Relatórios</span>
          </a>
          <a 
            className={`nav-item ${activeTab === 'configuracoes' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuracoes')}
          >
            <Settings size={20} />
            <span>Configurações</span>
          </a>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        <header className="header fade-in">
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Dashboard Central'}
              {activeTab === 'cadastros' && 'Cadastros Auxiliares'}
              {activeTab === 'apuracao' && 'Apuração Inteligente de Ponto'}
              {activeTab === 'relatorios' && 'Relatórios Fiscais'}
              {activeTab === 'configuracoes' && 'Configurações do Sistema'}
            </h1>
            <p className="page-subtitle">Sistema de tratamento Portaria 671 / 1510</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none' }} onClick={onLogout}>
              Sair
            </button>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} />
              Status: Online
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <div className="stats-grid fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="glass-card stat-card">
                <div className="stat-icon"><Users size={20} /></div>
                <div className="stat-value">{funcionarios.filter(f => f.ativo !== false).length || '0'}</div>
                <div className="stat-label">Funcionários Ativos</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-icon" style={{ color: 'var(--success)' }}><CheckCircle2 size={20} /></div>
                <div className="stat-value">{pontoData ? pontoData.totalBatidas.toLocaleString('pt-BR') : '0'}</div>
                <div className="stat-label">Batidas Processadas</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-icon" style={{ color: 'var(--warning)' }}><AlertCircle size={20} /></div>
                <div className="stat-value">{pontoData ? Object.values(pontoData.dados).flatMap(dias => Object.values(dias)).filter(d => !d.valido).length : '0'}</div>
                <div className="stat-label">Inconsistências (Ímpar)</div>
              </div>
            </div>

            {importResult && (
              <div className="glass-card fade-in" style={{ animationDelay: '0.15s', marginTop: '1rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} color="var(--success)" /> Resultado da Importação
                  </h4>
                  <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total no AFD</div>
                    <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{importResult.total} batidas</div>
                  </div>
                  <div style={{ padding: '0.5rem', background: importResult.importadas > 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: '8px', border: `1px solid ${importResult.importadas > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Importadas</div>
                    <div style={{ fontWeight: 600, color: importResult.importadas > 0 ? 'var(--success)' : 'var(--danger)' }}>{importResult.importadas} batidas</div>
                  </div>
                  <div style={{ padding: '0.5rem', background: importResult.descartadas > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)', borderRadius: '8px', border: `1px solid ${importResult.descartadas > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}` }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Descartadas</div>
                    <div style={{ fontWeight: 600, color: importResult.descartadas > 0 ? 'var(--danger)' : 'var(--success)' }}>{importResult.descartadas} batidas{importResult.funcNaoCadastrados > 0 && ` (${importResult.funcNaoCadastrados} func. não cadastrados)`}</div>
                  </div>
                </div>

                {importResult.validacao && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Portaria {importResult.validacao.resumo.portaria}
                      {importResult.validacao.resumo.versao ? ` · versão ${importResult.validacao.resumo.versao}` : ''}
                      {' · '}{importResult.validacao.resumo.marcacoes} marcações
                      {' '}(tipo 3: {importResult.validacao.resumo.tipo3}, tipo 7: {importResult.validacao.resumo.tipo7})
                      {importResult.validacao.resumo.periodo
                        ? ` · ${importResult.validacao.resumo.periodo.inicio} a ${importResult.validacao.resumo.periodo.fim}`
                        : ''}
                    </div>
                    {importResult.validacao.erros.map((erro, i) => (
                      <div key={`ve${i}`} style={{ color: 'var(--danger)' }}>Erro: {erro}</div>
                    ))}
                    {importResult.validacao.avisos.map((aviso, i) => (
                      <div key={`va${i}`} style={{ color: 'var(--warning, #f59e0b)' }}>Aviso: {aviso}</div>
                    ))}
                  </div>
                )}

                {importResult.cabecalho?.razaoSocial && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Empregador no AFD: <strong>{importResult.cabecalho.razaoSocial}</strong>
                  </div>
                )}

                {importResult.naoEncontrados?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--danger)' }}>
                      Documentos sem funcionário cadastrado ({importResult.naoEncontrados.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {importResult.naoEncontrados.map(({ doc, nome }) => (
                        <span
                          key={doc}
                          style={{
                            fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                          }}
                        >
                          {nome ? `${nome} — ` : ''}{doc}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      Cadastre o CPF/PIS em Cadastros → Funcionários e importe o AFD novamente.
                    </div>
                  </div>
                )}
              </div>
            )}

            {!pontoData ? (
              <div className="glass-card fade-in" style={{ animationDelay: '0.2s', marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Importar Dados (AFD)</h3>
                
                <label className="uploader-area">
                  <input 
                    type="file" 
                    accept=".txt,.afd" 
                    onChange={handleFileUpload} 
                    style={{ display: 'none' }} 
                  />
                  {isUploading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <div className="upload-icon pulse"><Activity size={48} /></div>
                      <div>
                        <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Processando...</h4>
                        <p style={{ color: 'var(--text-secondary)' }}>O motor de cálculo está cruzando as batidas...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon"><UploadCloud size={48} /></div>
                      <div>
                        <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Arraste o arquivo AFD aqui</h4>
                        <p style={{ color: 'var(--text-secondary)' }}>ou clique para selecionar do seu computador.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                         <span className="badge success">Portaria 1510 (PIS)</span>
                         <span className="badge success">Portaria 671 (CPF)</span>
                      </div>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <div className="glass-card fade-in" style={{ animationDelay: '0.2s', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontWeight: 600 }}>Últimas Importações (Motor Inteligente)</h3>
                  <button className="btn-primary" onClick={() => setPontoData(null)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none' }}>Nova Importação</button>
                </div>
                
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Documento (CPF/PIS)</th>
                        <th>Data Analisada</th>
                        <th>Batidas Identificadas</th>
                        <th>Status Diário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(pontoData.dados).slice(0, 50).map(([doc, dias]) => {
                        // Vamos pegar apenas os dias que deram problema para destacar, ou os primeiros dias
                        const diasArray = Object.entries(dias);
                        if (diasArray.length === 0) return null;
                        
                        // Ordena para mostrar o mais recente
                        const diaRecente = diasArray[diasArray.length - 1];
                        const dataStr = diaRecente[0];
                        const info = diaRecente[1];
                        const batidasStr = info.batidas.join(' | ');
                        
                        const saldoMinutos = info.total_minutos - (8 * 60); // Base de 8h
                        let statusBadge;
                        
                        if (!info.valido) {
                          statusBadge = <span className="badge danger">Batida Ímpar</span>;
                        } else if (saldoMinutos > 0) {
                          statusBadge = <span className="badge success">+{parseMinutosToHHMM(saldoMinutos)} (Extra)</span>;
                        } else if (saldoMinutos < 0) {
                          statusBadge = <span className="badge warning">{parseMinutosToHHMM(saldoMinutos)} (Atraso)</span>;
                        } else {
                          statusBadge = <span className="badge success">Exato</span>;
                        }

                        return (
                          <tr key={doc}>
                            <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{doc.substring(0, 1)}</div>
                              Funcionário {doc.substring(0, 4)}...
                            </td>
                            <td>{doc}</td>
                            <td>{dataStr}</td>
                            <td>{batidasStr}</td>
                            <td>{statusBadge}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'cadastros' && (
          <CadastrosTab usuario={usuario} />
        )}

        {activeTab === 'apuracao' && (
          <ApuracaoTab usuario={usuario} />
        )}

        {activeTab === 'relatorios' && (
          <RelatoriosTab usuario={usuario} />
        )}
      </main>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [isInitializing, setIsInitializing] = useState(() => Boolean(getToken()));
  const isMobileRoute = window.location.pathname.startsWith('/mobile');

  useEffect(() => {
    let ativo = true;
    const token = getToken();

    if (!token) {
      return () => { ativo = false; };
    }

    api.auth.me()
      .then((data) => {
        if (!ativo) return;
        setUsuario(data?.usuario || null);
        setIsAuthenticated(true);
      })
      .catch(() => {
        clearToken();
        if (ativo) setIsAuthenticated(false);
      })
      .finally(() => {
        if (ativo) setIsInitializing(false);
      });

    return () => { ativo = false; };
  }, []);

  const handleLogout = async () => {
    try { await api.auth.logout(); } catch {
      // Sessão já expirada/offline: segue com o logout local.
    }
    clearToken();
    setUsuario(null);
    setIsAuthenticated(false);
  };

  if (isMobileRoute) {
    return <MobileMarcacao />;
  }

  if (isInitializing) {
    return <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Carregando plataforma...</p>
    </div>;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={(u) => { setUsuario(u || null); setIsAuthenticated(true); }} />;
  }

  return <ToastProvider><DashboardLayout onLogout={handleLogout} usuario={usuario} /></ToastProvider>;
}

export default App;
