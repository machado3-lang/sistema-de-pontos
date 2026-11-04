-- ============================================================================
-- 009 — Feriados por âmbito, cidade do funcionário e justificativas
--
-- - Funcionário ganha cidade/UF (para feriados municipais/estaduais).
-- - Feriado ganha o vínculo conforme o tipo:
--     nacional  -> sem vínculo
--     estadual  -> uf
--     municipal -> uf + cidade
--     empresa   -> alvo_empresa_id
-- - "Considerar feriado como dia normal" fica no config do horário (jsonb),
--   não no feriado.
-- - Tipos de justificativa e lançamentos.
-- ============================================================================

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS uf text;

ALTER TABLE feriados ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE feriados ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE feriados ADD COLUMN IF NOT EXISTS alvo_empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_feriados_escopo
  ON feriados (empresa_id, tipo, uf, cidade);

CREATE TABLE IF NOT EXISTS justificativa_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  abreviacao text,
  tipo text NOT NULL CHECK (tipo IN ('dia_inteiro', 'periodo', 'horas', 'ajuste', 'banco', 'dsr')),
  abona_falta boolean NOT NULL DEFAULT false,
  abona_horas boolean NOT NULL DEFAULT false,
  protege_dsr boolean NOT NULL DEFAULT false,
  gera_banco boolean NOT NULL DEFAULT false,
  exige_cid boolean NOT NULL DEFAULT false,
  exige_anexo boolean NOT NULL DEFAULT false,
  tolerancia_min integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS justificativas (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES justificativa_tipos(id) ON DELETE RESTRICT,
  data date NOT NULL,
  inicio time,
  fim time,
  minutos integer,
  texto text,
  cid text,
  anexo_url text,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_justificativas_func_data
  ON justificativas (empresa_id, funcionario_id, data);

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['justificativa_tipos', 'justificativas']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tabela, tabela);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tabela, tabela
    );
  END LOOP;
END $$;

INSERT INTO schema_migrations (version) VALUES ('009_feriados_justificativas') ON CONFLICT DO NOTHING;
