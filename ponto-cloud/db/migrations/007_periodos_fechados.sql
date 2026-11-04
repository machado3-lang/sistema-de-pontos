-- ============================================================================
-- 007 — Fechamento de período
--
-- Um período fechado trava alterações em marcações, correções e descartes.
-- A reabertura exige admin e fica registrada (quem, quando, motivo).
-- ============================================================================

CREATE TABLE IF NOT EXISTS periodos_fechados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  fechado_em timestamptz NOT NULL DEFAULT now(),
  fechado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  reaberto_em timestamptz,
  reaberto_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_reabertura text,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS ix_periodos_empresa
  ON periodos_fechados (empresa_id, data_inicio, data_fim);

-- Impede dois fechamentos abertos sobrepostos para a mesma empresa.
CREATE UNIQUE INDEX IF NOT EXISTS ux_periodos_abertos
  ON periodos_fechados (empresa_id, data_inicio, data_fim)
  WHERE reaberto_em IS NULL;

INSERT INTO schema_migrations (version) VALUES ('007_periodos_fechados') ON CONFLICT DO NOTHING;
