-- ============================================================================
-- 008 — Feriados recorrentes
-- ============================================================================

ALTER TABLE feriados ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false;

INSERT INTO schema_migrations (version) VALUES ('008_feriados_recorrente') ON CONFLICT DO NOTHING;
