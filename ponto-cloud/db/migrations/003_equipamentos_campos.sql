-- ============================================================================
-- 003 — Campos adicionais de equipamentos usados pelo formulário
-- (antes viviam apenas em localStorage junto com o cadastro)
-- ============================================================================

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS portaria text NOT NULL DEFAULT 'auto';

INSERT INTO schema_migrations (version) VALUES ('003_equipamentos_campos') ON CONFLICT DO NOTHING;
