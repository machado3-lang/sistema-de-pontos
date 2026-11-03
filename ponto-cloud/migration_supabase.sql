-- ============================================================================
-- MultiPonto — Migration de segurança
-- Execute no SQL Editor do Supabase (ou via SUPABASE_DB_URL no backend).
-- É idempotente: pode ser executada mais de uma vez.
-- ============================================================================

-- ── Senha do app mobile ─────────────────────────────────────────────────────
-- `senha` (texto puro) é mantida apenas para a migração transparente no
-- primeiro login. O backend grava o hash scrypt em `senha_hash` e zera `senha`.
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS senha TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;

-- ── Tabela de marcações (app mobile / integrações) ──────────────────────────
CREATE TABLE IF NOT EXISTS marcacoes (
  id BIGSERIAL PRIMARY KEY,
  nsr BIGINT,
  cpf TEXT,
  pis TEXT,
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  importado_em TIMESTAMPTZ DEFAULT NOW(),
  equip_id TEXT DEFAULT 'mobile',
  equip_nome TEXT DEFAULT 'App Mobile',
  funcionario_id UUID,
  origem TEXT DEFAULT 'mobile',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marcacoes_cpf ON marcacoes(cpf);
CREATE INDEX IF NOT EXISTS idx_marcacoes_data ON marcacoes(data);
CREATE INDEX IF NOT EXISTS idx_marcacoes_funcionario ON marcacoes(funcionario_id);

-- ── Remove qualquer política anônima existente nessas tabelas ───────────────
-- A partir daqui, somente usuários autenticados (Supabase Auth) acessam os
-- dados pelo frontend. O app mobile usa o backend com service_role.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('funcionarios', 'empresas', 'marcacoes')
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── RLS: funcionários ───────────────────────────────────────────────────────
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funcionarios_authenticated_all ON funcionarios;
CREATE POLICY funcionarios_authenticated_all ON funcionarios
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── RLS: empresas (somente se a tabela existir) ─────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.empresas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE empresas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS empresas_authenticated_all ON empresas';
    EXECUTE 'CREATE POLICY empresas_authenticated_all ON empresas FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── RLS: marcações ──────────────────────────────────────────────────────────
ALTER TABLE marcacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marcacoes_authenticated_all ON marcacoes;
CREATE POLICY marcacoes_authenticated_all ON marcacoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
