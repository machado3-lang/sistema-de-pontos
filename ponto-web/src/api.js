/**
 * Cliente da API do PontoCloud (PostgreSQL).
 * O token de sessão fica em localStorage e é enviado como Bearer.
 */

const API_BASE = (import.meta.env.VITE_PONTOCLOUD_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'ponto_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage indisponível (modo privado): sessão só em memória.
  }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {
    // localStorage indisponível: nada a limpar.
  }
}

function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body, token = getToken(), headers = {} } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function crud(resource) {
  return {
    list: (params = {}) => request(`/api/${resource}${qs(params)}`),
    get: (id) => request(`/api/${resource}/${id}`),
    create: (data) => request(`/api/${resource}`, { method: 'POST', body: data }),
    update: (id, data) => request(`/api/${resource}/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/api/${resource}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  auth: {
    login: (email, senha) => request('/api/auth/login', {
      method: 'POST',
      body: { email, senha },
      token: '',
    }),
    me: () => request('/api/auth/me'),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    changePassword: (senha_atual, senha_nova) => request('/api/auth/change-password', {
      method: 'POST',
      body: { senha_atual, senha_nova },
    }),
  },

  funcionarios: {
    ...crud('funcionarios'),
    histHorarios: {
      list: (id) => request(`/api/funcionarios/${id}/hist-horarios`),
      replace: (id, historico) => request(`/api/funcionarios/${id}/hist-horarios`, {
        method: 'PUT',
        body: { historico },
      }),
    },
  },
  empresas: crud('empresas'),
  departamentos: crud('departamentos'),
  cargos: crud('cargos'),
  horarios: crud('horarios'),
  parametros: crud('parametros'),
  equipamentos: crud('equipamentos'),
  feriados: crud('feriados'),

  usuarios: {
    list: () => request('/api/usuarios'),
    create: (data) => request('/api/usuarios', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/usuarios/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/api/usuarios/${id}`, { method: 'DELETE' }),
    resetPassword: (id, senha) => request(`/api/usuarios/${id}/reset-password`, {
      method: 'POST',
      body: { senha },
    }),
    revokeSessions: (id) => request(`/api/usuarios/${id}/revoke-sessions`, { method: 'POST' }),
  },

  marcacoes: {
    list: (params = {}) => request(`/api/marcacoes${qs(params)}`),
    create: (data) => request('/api/marcacoes', { method: 'POST', body: data }),
    import: (marcacoes) => request('/api/marcacoes/import', {
      method: 'POST',
      body: { marcacoes },
    }),
  },

  correcoes: {
    list: (params = {}) => request(`/api/correcoes${qs(params)}`),
    upsert: (data) => request('/api/correcoes', { method: 'POST', body: data }),
    remove: (id) => request(`/api/correcoes/${id}`, { method: 'DELETE' }),
    removeByKey: (funcionario_id, data) => request(
      `/api/correcoes${qs({ funcionario_id, data })}`,
      { method: 'DELETE' }
    ),
  },

  diasDescartados: {
    list: (params = {}) => request(`/api/dias-descartados${qs(params)}`),
    upsert: (data) => request('/api/dias-descartados', { method: 'POST', body: data }),
    remove: (id) => request(`/api/dias-descartados/${id}`, { method: 'DELETE' }),
    removeByKey: (funcionario_id, data) => request(
      `/api/dias-descartados${qs({ funcionario_id, data })}`,
      { method: 'DELETE' }
    ),
  },

  marcacoesDescartadas: {
    list: (params = {}) => request(`/api/marcacoes-descartadas${qs(params)}`),
    create: (data) => request('/api/marcacoes-descartadas', { method: 'POST', body: data }),
    remove: (id) => request(`/api/marcacoes-descartadas/${id}`, { method: 'DELETE' }),
    removeByKey: (funcionario_id, data, hora) => request(
      `/api/marcacoes-descartadas${qs({ funcionario_id, data, hora })}`,
      { method: 'DELETE' }
    ),
  },

  bancoAjustes: {
    list: (params = {}) => request(`/api/banco-horas/ajustes${qs(params)}`),
    create: (data) => request('/api/banco-horas/ajustes', { method: 'POST', body: data }),
    remove: (id) => request(`/api/banco-horas/ajustes/${id}`, { method: 'DELETE' }),
  },

  periodos: {
    list: () => request('/api/periodos'),
    status: (data) => request(`/api/periodos/status${qs({ data })}`),
    fechar: (data_inicio, data_fim) => request('/api/periodos/fechar', {
      method: 'POST',
      body: { data_inicio, data_fim },
    }),
    reabrir: (id, motivo) => request(`/api/periodos/${id}/reabrir`, {
      method: 'POST',
      body: { motivo },
    }),
  },

  justificativaTipos: crud('justificativa-tipos'),
  justificativas: {
    list: (params = {}) => request(`/api/justificativas${qs(params)}`),
    create: (data) => request('/api/justificativas', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/justificativas/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/api/justificativas/${id}`, { method: 'DELETE' }),
  },

  jornadaExcecoes: {
    list: (params = {}) => request(`/api/jornada-excecoes${qs(params)}`),
    upsert: (data) => request('/api/jornada-excecoes', { method: 'POST', body: data }),
    removeByKey: (funcionario_id, data) => request(
      `/api/jornada-excecoes${qs({ funcionario_id, data })}`,
      { method: 'DELETE' }
    ),
  },

  auditoria: {
    list: (params = {}) => request(`/api/auditoria${qs(params)}`),
  },
};
