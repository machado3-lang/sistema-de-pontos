-- ============================================================================
-- 012 — Motivos de correção (catálogo) e motivo nas marcações desconsideradas
--
-- A Portaria 671 (AEJ, registro tipo 05) exige o campo `motivo` quando a
-- marcação é desconsiderada (tpMarc = D) ou incluída manualmente (fonteMarc = I).
-- ============================================================================

CREATE TABLE IF NOT EXISTS motivos_correcao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, descricao)
);

ALTER TABLE marcacoes_descartadas ADD COLUMN IF NOT EXISTS motivo text;

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_motivos_correcao_updated_at ON motivos_correcao';
  EXECUTE 'CREATE TRIGGER trg_motivos_correcao_updated_at BEFORE UPDATE ON motivos_correcao FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
END $$;

INSERT INTO schema_migrations (version) VALUES ('012_motivos_correcao') ON CONFLICT DO NOTHING;
