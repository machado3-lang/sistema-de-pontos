-- ============================================================================
-- 005 — Corrige empresas criadas antes da 004
--
-- A 004 fez `tenant_id = id` em todas as linhas existentes. Isso estava certo
-- para a raiz da conta, mas errado para empresas que o usuário já tinha criado:
-- elas viraram "raiz de si mesmas" e sumiram da listagem (que filtra por
-- `tenant_id = usuario.empresa_id`).
--
-- 1. Trigger: toda empresa nova sem tenant_id vira raiz (tenant_id = id).
--    Isso mantém o `seed:admin` funcionando sem alterações.
-- 2. Backfill: quando a conta tem uma única raiz, as demais empresas com
--    `tenant_id = id` são vinculadas a ela.
-- ============================================================================

CREATE OR REPLACE FUNCTION set_empresa_tenant()
RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_empresas_tenant ON empresas;
CREATE TRIGGER trg_empresas_tenant
BEFORE INSERT ON empresas
FOR EACH ROW EXECUTE FUNCTION set_empresa_tenant();

WITH raizes AS (
  SELECT DISTINCT empresa_id AS id
    FROM usuarios
   WHERE empresa_id IS NOT NULL
),
unica_raiz AS (
  SELECT id FROM raizes LIMIT 1
)
UPDATE empresas e
   SET tenant_id = (SELECT id FROM unica_raiz)
 WHERE e.tenant_id = e.id
   AND e.id <> (SELECT id FROM unica_raiz)
   AND (SELECT count(*) FROM raizes) = 1;

INSERT INTO schema_migrations (version) VALUES ('005_empresas_tenant_backfill') ON CONFLICT DO NOTHING;
