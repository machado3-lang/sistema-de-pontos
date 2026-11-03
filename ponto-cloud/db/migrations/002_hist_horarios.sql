-- ============================================================================
-- 002 — Histórico de horários por funcionário
-- Antes ficava em localStorage (`ponto_hist_horarios`).
-- ============================================================================

CREATE TABLE IF NOT EXISTS funcionario_hist_horarios (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  horario_id uuid REFERENCES horarios(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, horario_id, data_inicio)
);

CREATE INDEX IF NOT EXISTS ix_hist_horarios_func
  ON funcionario_hist_horarios (empresa_id, funcionario_id, data_inicio);

INSERT INTO schema_migrations (version) VALUES ('002_hist_horarios') ON CONFLICT DO NOTHING;
