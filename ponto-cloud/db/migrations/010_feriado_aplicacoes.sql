-- ============================================================================
-- 010 — Aplicações de feriado (escopo combinável) e cidade IBGE
--
-- O `tipo` do feriado continua sendo a classificação (nacional, estadual,
-- municipal, empresa). O escopo real passa a ser uma lista de aplicações:
--   empresa, uf, cidade, departamento, horario, funcionario
--
-- Semântica: dimensões diferentes são AND; valores da mesma dimensão são OR.
-- Ex.: empresa=X + uf=SP + cidade=3550308 -> só quem é de X, em SP e São Paulo.
--
-- Cidade usa o código IBGE (evita erro de digitação). O nome fica em
-- `funcionarios.cidade` apenas para exibição.
-- ============================================================================

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS cidade_ibge text;

CREATE TABLE IF NOT EXISTS feriado_aplicacoes (
  id bigserial PRIMARY KEY,
  feriado_id bigint NOT NULL REFERENCES feriados(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('empresa', 'uf', 'cidade', 'departamento', 'horario', 'funcionario')),
  valor text NOT NULL,
  rotulo text,
  UNIQUE (feriado_id, tipo, valor)
);

-- Garante a coluna em bancos que já criaram a tabela sem `rotulo`.
ALTER TABLE feriado_aplicacoes ADD COLUMN IF NOT EXISTS rotulo text;

CREATE INDEX IF NOT EXISTS ix_feriado_aplicacoes_feriado
  ON feriado_aplicacoes (feriado_id);
CREATE INDEX IF NOT EXISTS ix_feriado_aplicacoes_tipo_valor
  ON feriado_aplicacoes (tipo, valor);

-- Backfill a partir das colunas antigas.
INSERT INTO feriado_aplicacoes (feriado_id, tipo, valor)
SELECT id, 'uf', uf FROM feriados WHERE uf IS NOT NULL AND uf <> ''
ON CONFLICT DO NOTHING;

INSERT INTO feriado_aplicacoes (feriado_id, tipo, valor)
SELECT id, 'empresa', alvo_empresa_id::text FROM feriados WHERE alvo_empresa_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO feriado_aplicacoes (feriado_id, tipo, valor)
SELECT id, 'cidade', cidade FROM feriados WHERE cidade IS NOT NULL AND cidade <> ''
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('010_feriado_aplicacoes') ON CONFLICT DO NOTHING;
