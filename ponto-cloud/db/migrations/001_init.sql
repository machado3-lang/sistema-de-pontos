-- ============================================================================
-- MultiPonto — Schema inicial PostgreSQL (Railway)
-- Execute em um banco vazio: psql "$DATABASE_URL" -f db/migrations/001_init.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── updated_at automático ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Empresas (tenant) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  tipo_doc text NOT NULL DEFAULT 'CNPJ' CHECK (tipo_doc IN ('CNPJ', 'CPF')),
  cpf_cnpj text NOT NULL UNIQUE, -- armazenar somente dígitos
  endereco text,
  bairro text,
  cep text,
  cidade text,
  estado text,
  telefone text,
  numero_folha text,
  responsavel_nome text,
  responsavel_cpf text,
  responsavel_telefone text,
  responsavel_email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Usuários do sistema ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text NOT NULL,
  senha_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'gestor', 'consulta')),
  ativo boolean NOT NULL DEFAULT true,
  ultimo_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_email ON usuarios (lower(email));

-- ── Sessões (refresh tokens / revogação) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sessoes_usuario ON sessoes (usuario_id);

-- ── Auxiliares ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

-- ── Horários e parâmetros (configuração em JSONB) ───────────────────────────
CREATE TABLE IF NOT EXISTS horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'Fixa',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Funcionários ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text NOT NULL, -- somente dígitos
  pis text,
  matricula text,
  folha text,
  foto text,
  data_admissao date,
  data_demissao date,
  motivo_demissao text,
  departamento_id uuid REFERENCES departamentos(id) ON DELETE SET NULL,
  cargo_id uuid REFERENCES cargos(id) ON DELETE SET NULL,
  horario_id uuid REFERENCES horarios(id) ON DELETE SET NULL,
  parametro_id uuid REFERENCES parametros(id) ON DELETE SET NULL,
  data_inicio date,
  ativo boolean NOT NULL DEFAULT true,
  senha_hash text, -- senha do app mobile
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cpf)
);
CREATE INDEX IF NOT EXISTS ix_funcionarios_empresa ON funcionarios (empresa_id, ativo);
CREATE INDEX IF NOT EXISTS ix_funcionarios_pis ON funcionarios (pis);

-- ── Equipamentos (REPs) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  modelo text,
  num_serie text,
  localizacao text,
  tipo_conexao text,
  ip text,
  porta text,
  usuario text,
  senha text, -- credencial do REP (ideal: criptografar)
  cloud_url text,
  api_key text,
  cloud_rep_id text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Marcações ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marcacoes (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid REFERENCES funcionarios(id) ON DELETE SET NULL,
  nsr bigint,
  cpf text,
  pis text,
  data date NOT NULL,
  hora time NOT NULL,
  equip_id text,
  equip_nome text,
  origem text NOT NULL DEFAULT 'rep',
  importado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_marcacoes_empresa_data ON marcacoes (empresa_id, data);
CREATE INDEX IF NOT EXISTS ix_marcacoes_func_data ON marcacoes (funcionario_id, data);
CREATE UNIQUE INDEX IF NOT EXISTS ux_marcacoes_equip_nsr
  ON marcacoes (empresa_id, equip_id, nsr) WHERE nsr IS NOT NULL;

-- ── Apuração: correções, descartes e banco ──────────────────────────────────
CREATE TABLE IF NOT EXISTS correcoes (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  batidas_manuais time[] NOT NULL DEFAULT '{}'::time[],
  justificativa text,
  aplicada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, data)
);

CREATE TABLE IF NOT EXISTS dias_descartados (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, data)
);

CREATE TABLE IF NOT EXISTS marcacoes_descartadas (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, data, hora)
);

CREATE TABLE IF NOT EXISTS banco_horas_ajustes (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  minutos integer NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Feriados personalizados ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feriados (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome text,
  tipo text NOT NULL DEFAULT 'municipal',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, data)
);

-- ── Auditoria ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id bigserial PRIMARY KEY,
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_auditoria_empresa_data ON auditoria (empresa_id, created_at);

-- ── Controle de migrations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- ── Triggers de updated_at ──────────────────────────────────────────────────
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'empresas', 'usuarios', 'departamentos', 'cargos',
    'horarios', 'parametros', 'funcionarios', 'equipamentos', 'correcoes'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tabela, tabela);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tabela, tabela
    );
  END LOOP;
END $$;

INSERT INTO schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;

-- O primeiro usuário deve ser criado pelo script `npm run seed:admin`
-- usando ADMIN_EMAIL e ADMIN_PASSWORD do ambiente (nunca fixe senha no SQL).
