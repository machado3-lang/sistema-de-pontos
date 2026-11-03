-- ============================================================================
-- 006 — Persistência do push server (iDClass/iDFace)
--
-- Antes, devices/events/results/commands viviam em memória (perdidos no
-- restart) e as marcações em data/push_marcacoes.json.
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_devices (
  device_key text PRIMARY KEY,
  serial text,
  ip text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  poll_count integer NOT NULL DEFAULT 0,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_events (
  id bigserial PRIMARY KEY,
  device_key text,
  serial text,
  ip text,
  received_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_push_events_received ON push_events (received_at DESC);

CREATE TABLE IF NOT EXISTS push_results (
  id bigserial PRIMARY KEY,
  device_key text,
  serial text,
  ip text,
  received_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_push_results_received ON push_results (received_at DESC);

CREATE TABLE IF NOT EXISTS push_commands (
  id bigserial PRIMARY KEY,
  cmd_id text NOT NULL,
  device_key text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_push_commands_pending
  ON push_commands (created_at) WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS push_marcacoes (
  id bigserial PRIMARY KEY,
  nsr bigint,
  user_id text,
  cpf text,
  pis text,
  data date,
  hora time,
  serial text,
  ip text,
  origem text NOT NULL DEFAULT 'push',
  importado boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nsr, user_id, data, hora)
);
CREATE INDEX IF NOT EXISTS ix_push_marcacoes_pendentes
  ON push_marcacoes (received_at DESC) WHERE importado = false;

INSERT INTO schema_migrations (version) VALUES ('006_push_persistencia') ON CONFLICT DO NOTHING;
