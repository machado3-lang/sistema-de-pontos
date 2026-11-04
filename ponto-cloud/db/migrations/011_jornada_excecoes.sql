-- ============================================================================
-- 011 — Jornada por exceção (horário eventual do dia)
--
-- Permite trocar a jornada de um funcionário em uma data específica, sem
-- alterar o horário padrão dele. É o caso do horário tipo "Eventual".
-- ============================================================================

CREATE TABLE IF NOT EXISTS jornada_excecoes (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  horario_id uuid NOT NULL REFERENCES horarios(id) ON DELETE CASCADE,
  motivo text,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, data)
);

CREATE INDEX IF NOT EXISTS ix_jornada_excecoes_func_data
  ON jornada_excecoes (empresa_id, funcionario_id, data);

INSERT INTO schema_migrations (version) VALUES ('011_jornada_excecoes') ON CONFLICT DO NOTHING;
