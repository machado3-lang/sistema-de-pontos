import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, type) => addToast(message, type), [addToast]);

  const colors = {
    info: { bg: 'rgba(99,102,241,0.15)', border: 'var(--accent-primary)', color: 'var(--accent-primary)' },
    success: { bg: 'rgba(34,197,94,0.15)', border: 'var(--success)', color: 'var(--success)' },
    warning: { bg: 'rgba(251,191,36,0.15)', border: 'var(--warning)', color: 'var(--warning)' },
    error: { bg: 'rgba(239,68,68,0.15)', border: 'var(--danger)', color: 'var(--danger)' },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} className="fade-in" style={{
              padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
              background: c.bg, border: `1px solid ${c.border}`,
              color: c.color, fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }} onClick={() => removeToast(t.id)}>
              <span style={{ flex: 1 }}>{t.message}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6, cursor: 'pointer' }}>✕</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
