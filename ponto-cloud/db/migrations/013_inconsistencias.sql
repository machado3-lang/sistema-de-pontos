-- ============================================================================
-- 013 — Tipos de inconsistência configuráveis
--
-- Permite cadastrar o que a apuração deve destacar (atraso, falta, extra,
-- banco, batida ímpar), com tolerância, prioridade, ícone e cor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inconsistencia_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  campo text NOT NULL CHECK (campo IN ('atraso', 'falta', 'extra', 'banco', 'batida', 'outro')),
  valor_min integer NOT NULL DEFAULT 0,
  prioridade integer NOT NULL DEFAULT 5,
  icone text,
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE INDEX IF NOT EXISTS ix_inconsistencia_tipos_empresa
  ON inconsistencia_tipos (empresa_id, ativo, prioridade);

-- Sementes para as empresas já existentes.
INSERT INTO inconsistencia_tipos (empresa_id, nome, campo, valor_min, prioridade, icone, cor)
SELECT e.id, d.nome, d.campo, d.valor_min, d.prioridade, d.icone, d.cor
  FROM empresas e
 CROSS JOIN (VALUES
   ('Batida ímpar', 'batida', 0, 1, 'alert-circle', '#e62e2e'),
   ('Débito acima de 2h', 'falta', 120, 2, 'trending-down', '#e62e2e'),
   ('Atraso acima de 10 min', 'atraso', 10, 3, 'clock', '#f59e0b'),
   ('Hora extra acima de 2h', 'extra', 120, 4, 'trending-up', '#f59e0b'),
   ('Banco negativo acima de 2h', 'banco', 120, 5, 'wallet', '#f59e0b')
 ) AS d(nome, campo, valor_min, prioridade, icone, cor)
ON CONFLICT (empresa_id, nome) DO NOTHING;

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_inconsistencia_tipos_updated_at ON inconsistencia_tipos';
  EXECUTE 'CREATE TRIGGER trg_inconsistencia_tipos_updated_at BEFORE UPDATE ON inconsistencia_tipos FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
END $$;

INSERT INTO schema_migrations (version) VALUES ('013_inconsistencias') ON CONFLICT DO NOTHING;
