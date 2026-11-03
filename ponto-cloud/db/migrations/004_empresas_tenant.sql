-- ============================================================================
-- 004 — Empresas por conta (tenant)
--
-- Antes, `empresas` era ao mesmo tempo o tenant e a lista de empresas, e a
-- listagem filtrava `id = usuario.empresa_id`. Com isso, uma empresa criada
-- pelo usuário (outro id) nunca aparecia.
--
-- Agora cada empresa tem `tenant_id` apontando para a empresa raiz da conta.
-- A raiz aponta para si mesma. A listagem usa `tenant_id = usuario.empresa_id`.
-- ============================================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

UPDATE empresas SET tenant_id = id WHERE tenant_id IS NULL;

ALTER TABLE empresas ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_empresas_tenant ON empresas (tenant_id);

INSERT INTO schema_migrations (version) VALUES ('004_empresas_tenant') ON CONFLICT DO NOTHING;
