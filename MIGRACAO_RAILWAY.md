# Migração para Railway — PostgreSQL

> **Status 04/11/2026: migração concluída.** O sistema roda no Railway com
> PostgreSQL, autenticação própria e o backend servindo o frontend no mesmo
> serviço. As migrations vão da `001_init` à `013_inconsistencias`. O
> `preDeployCommand` está configurado, mas **não é confiável** — rode
> `npm run migrate` manualmente no console do Railway após cada deploy que
> trouxer migration nova. Este documento permanece como histórico do plano.

## Resposta curta

**Sim, é possível.** E o banco recomendado é **PostgreSQL**, não MySQL.

O sistema já tem um backend Express (`ponto-cloud`) e o driver `pg` instalado. O que precisa mudar é a camada de acesso: hoje o frontend fala direto com o Supabase (Auth + dados). Indo para Railway, o backend passa a ser o dono do banco e da autenticação.

---

## Por que PostgreSQL e não MySQL

| Critério | PostgreSQL | MySQL |
|---|---|---|
| Migração do Supabase | Nativa (Supabase é Postgres) | Exigiria conversão de tipos/SQL |
| Driver já instalado | ✅ `pg` | ❌ precisaria adicionar |
| JSONB para horários/parâmetros | ✅ ideal | JSON limitado |
| Arrays (`batidas_manuais`) | ✅ nativo | ❌ tabela extra |
| `ON CONFLICT`, CTEs, window functions | ✅ completo | Parcial |
| Suporte Railway | ✅ first-class | ✅ existe, mas sem vantagem aqui |

**Decisão:** PostgreSQL no Railway.

---

## O que muda na arquitetura

### Hoje

```
React → Supabase Auth
React → Supabase (funcionarios, empresas, marcacoes)
React → ponto-cloud (REP/mobile/push)
```

### Depois

```
React → ponto-cloud (auth + CRUD + REP + mobile + push)
              │
              ▼
        PostgreSQL (Railway)
```

O frontend deixa de importar `@supabase/supabase-js`. O backend passa a expor:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- CRUD `/api/funcionarios`, `/api/empresas`, `/api/marcacoes`
- CRUD `/api/horarios`, `/api/parametros`, `/api/departamentos`, `/api/cargos`
- `/api/correcoes`, `/api/dias-descartados`, `/api/marcacoes-descartadas`
- `/api/banco-horas/ajustes`
- `/api/mobile/*` (já existe, passa a usar `pg`)
- `/api/reps/*`, `/push`, `/event` (permanecem)

---

## O que já está pronto

- Backend Express com `pg` instalado.
- Motor de cálculo isolado em `ponto-web/src/engine` (não depende do banco).
- Hash de senha (scrypt) no backend.
- Endpoints mobile já centralizados no backend.
- Dockerfiles e `docker-compose.yml`.
- Migration de referência em `ponto-cloud/migration_supabase.sql`.

### Status da implementação (31/10/2026)

| Item | Status |
|---|---|
| Schema PostgreSQL (`db/migrations/001_init.sql`) | ✅ |
| Runner `npm run migrate` | ✅ |
| Seed `npm run seed:admin` | ✅ |
| Conexão `pg` (`db.js`) | ✅ |
| Auth própria (`/api/auth/login`, `/me`, `/logout`, `/change-password`) | ✅ |
| CRUD (`/api/funcionarios`, `/api/empresas`, `/api/horarios`, `/api/parametros`, ...) | ✅ |
| Mobile em PostgreSQL (`/api/mobile/*`) | ✅ |
| Smoke test `npm run test:api` | ✅ (código) |
| Frontend usando a nova API | ✅ Fase 4 |
| Migração dos dados do Supabase | ⏳ Fase 0 |
| Deploy/backup no Railway | ⏳ Fase 5 |
| Teste real contra um Postgres | ⏳ pendente (sem Postgres/Docker nesta máquina) |

## O que precisa ser feito

### Fase 0 — Garantir os dados do Supabase

Antes de desligar o Supabase:

1. Recuperar o projeto `hdmodlarqtbikvsvyolq` (resume) **ou** confirmar exclusão.
2. Se recuperar, exportar:
   - `funcionarios` (CSV/SQL)
   - `empresas` (CSV/SQL)
   - `marcacoes` (CSV/SQL)
   - usuários de auth (e-mails)
3. Guardar os arquivos fora do repositório.

### Fase 1 — Banco no Railway

1. Criar projeto no Railway.
2. Adicionar o plugin **PostgreSQL**.
3. Rodar `ponto-cloud/db/migrations/001_init.sql`.
4. Configurar `DATABASE_URL` no serviço do backend.
5. Criar um script `npm run migrate` para aplicar migrations no deploy.

### Fase 2 — Autenticação própria

1. Tabela `usuarios` (e-mail + `senha_hash` + role).
2. `POST /api/auth/login` → access token (JWT curto) + refresh token opaco em `sessions`.
3. Middleware `auth` valida o token e injeta `req.usuario`.
4. `POST /api/auth/logout` revoga a sessão.
5. `GET /api/auth/me` devolve usuário/empresa.
6. Rate limit e hash com `scrypt` (já usado no mobile).

### Fase 3 — CRUD no backend

1. `funcionarios`, `empresas`, `departamentos`, `cargos`.
2. `horarios` e `parametros` com `config jsonb` (substitui o localStorage).
3. `marcacoes`, `correcoes`, `dias_descartados`, `marcacoes_descartadas`, `banco_horas_ajustes`.
4. Toda query filtra por `empresa_id` (isolamento multiempresa).

### Fase 4 — Frontend

1. Criar `src/api.js` (fetch com token).
2. Trocar `supabase.auth.*` por `api.login/logout/me`.
3. Trocar `supabase.from(...)` por chamadas REST.
4. Remover `@supabase/supabase-js` do `package.json`.
5. Ajustar `LoginScreen`, `App`, `CadastrosTab`, `ApuracaoTab`, `RelatoriosTab`, `EmpresaSection`, `EquipamentoSection`.

### Fase 5 — Deploy e operação

1. Serviço `ponto-cloud` no Railway (Dockerfile existente).
2. Frontend: servir `dist` pelo próprio Express **ou** serviço estático (Nginx/Vercel).
3. Variáveis de ambiente no Railway.
4. Health check `/api/health`.
5. Backup: `pg_dump` agendado ou backup do Railway.
6. Migrations automáticas no start (com advisory lock para evitar corrida).

---

## Schema proposto

Arquivo: [`ponto-cloud/db/migrations/001_init.sql`](ponto-cloud/db/migrations/001_init.sql)

Tabelas principais:

| Tabela | Uso |
|---|---|
| `empresas` | tenant |
| `usuarios` | login do sistema |
| `sessoes` | refresh tokens/revogação |
| `funcionarios` | cadastro completo (inclui `senha_hash` mobile) |
| `departamentos`, `cargos` | auxiliares |
| `horarios` | `config jsonb` |
| `parametros` | `config jsonb` |
| `equipamentos` | REPs |
| `marcacoes` | batidas |
| `correcoes` | batidas manuais + justificativa |
| `dias_descartados` | faltas justificadas |
| `marcacoes_descartadas` | batidas ignoradas no cálculo |
| `banco_horas_ajustes` | ajustes manuais |
| `feriados` | municipais/estaduais/facultativos |
| `auditoria` | trilha de alterações |

---

## Variáveis de ambiente no Railway

```env
# Banco (Railway injeta automaticamente)
DATABASE_URL=postgresql://...
PGSSL=false
PG_POOL_MAX=10

# Auth / sessão
SESSION_TTL_HOURS=8
API_TOKEN=
ADMIN_USER=admin
ADMIN_PASSWORD=
MOBILE_TOKEN_SECRET=

# Criptografia das credenciais de REP (AES-256-GCM)
REP_SECRET=

# Conexão com REPs (IZCLOUD relay) — vazio usa conexão direta
IZCLOUD_URL=
IZCLOUD_TOKEN=
REP_TIMEOUT_MS=15000

# App
PORT=3100
NODE_ENV=production
CORS_ORIGINS=https://seu-servico.up.railway.app
RATE_LIMIT_GLOBAL=2000
```

> `DATABASE_URL` interna do Railway não exige SSL. Se usar a URL pública, habilite SSL no `pg.Pool`.

---

## Deploy no Railway (resumo)

O repositório `sistema-de-pontos` tem um `Dockerfile` e um `railway.json` na **raiz** para o backend. O Railway deve usar a raiz do repositório (root directory `/`).

1. Conecte o repositório `machado3-lang/sistema-de-pontos`, branch `main`.
2. Mantenha o **Root Directory** vazio (`/`).
3. Adicione o plugin **PostgreSQL** ao projeto.
4. Configure as variáveis do serviço:
   - `API_TOKEN` (obrigatório; sem ele o backend não inicia em produção)
   - `ADMIN_USER` / `ADMIN_PASSWORD`
   - `MOBILE_TOKEN_SECRET`
   - `REP_SECRET` (criptografia das credenciais de REP)
   - `IZCLOUD_URL` / `IZCLOUD_TOKEN` (relay para alcançar REPs na rede local)
   - `CORS_ORIGINS` (ex.: a URL do próprio serviço)
   - `SESSION_TTL_HOURS` (opcional, padrão 8)
   - `DATABASE_URL` é injetada automaticamente pelo plugin
5. Faça o deploy. O `railway.json` tem `preDeployCommand: ["npm run migrate"]` e healthcheck `/api/health`, mas o pre-deploy **não está executando de forma confiável**. Rode o migrate manualmente no console do serviço.
6. Crie o admin (uma vez):
   ```bash
   railway run env ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=uma-senha-forte npm run seed:admin
   ```
7. Teste: `https://<servico>.up.railway.app/api/health` deve retornar `db: "ok"`.

### Se o deploy não iniciar

- Confirme branch `main` e **Root Directory** `/`.
- Veja os logs do deploy: erros de `npm ci`, `preDeployCommand` ou `API_TOKEN` aparecem ali.
- Se o `preDeployCommand` falhar, verifique se o plugin PostgreSQL está vinculado (`DATABASE_URL`).
- Após alterar configuração, clique em **Deploy** ou faça um novo push.

### Frontend

O `Dockerfile` da raiz builda o `ponto-web` e copia o `dist` para `ponto-cloud/public`. O backend serve o frontend na mesma URL, então **não é necessário um segundo serviço** nem CORS para o frontend.

Se preferir separar, use um serviço com **Root Directory** `ponto-web` (usa `ponto-web/railway.json`) e defina `VITE_PONTOCLOUD_URL` no build para a URL do backend.

O Railway injeta `PORT`; o servidor já lê `process.env.PORT`.

---

## Migração de dados do Supabase

### Se o projeto for recuperado

1. No Supabase: **Database → Backups** ou `pg_dump`.
2. Exportar tabelas para CSV:
   ```sql
   copy (select * from funcionarios) to stdout with csv header;
   copy (select * from empresas) to stdout with csv header;
   copy (select * from marcacoes) to stdout with csv header;
   ```
3. Importar no Postgres do Railway com `\copy` ou script Node.
4. Validar contagens e CPFs.

### Se o projeto foi excluído

- Os dados do Supabase não voltam.
- O que ainda existe localmente:
  - `ponto-cloud/data/database.json` (REPs e 2 marcações de teste).
  - `localStorage` do navegador (cadastros auxiliares, horários, parâmetros, correções).
- O motor e o código estão intactos; começa-se um banco novo.

---

## Riscos e trade-offs

| Risco | Mitigação |
|---|---|
| Perder Auth pronta do Supabase (reset de senha, e-mail) | Implementar login/senha + reset por e-mail depois |
| Perder RLS | Filtrar `empresa_id` em todas as queries + testes |
| Perder backups automáticos | Configurar `pg_dump` agendado |
| Migração de dados incompleta | Validar contagens/CPFs antes de desligar o Supabase |
| Frontend com muitas chamadas diretas | Centralizar em `src/api.js` e remover o SDK |
| Senha do REP em texto puro | Criptografar no banco (fase futura) |

---

## Estimativa

| Fase | Esforço |
|---|---|
| 0 — Dados do Supabase | 0,5 dia (depende do acesso) |
| 1 — Banco + migration | 0,5 dia |
| 2 — Auth | 1 dia |
| 3 — CRUD backend | 1–2 dias |
| 4 — Frontend | 1–2 dias |
| 5 — Deploy/backup/testes | 1 dia |
| **Total** | **~4–6 dias** |

---

## Checklist

- [x] Recuperar/exportar dados do Supabase (ou iniciar com base nova).
- [x] Criar projeto Railway + PostgreSQL.
- [x] Rodar as migrations (`001` a `013`) com `npm run migrate`.
- [x] Configurar `DATABASE_URL`, `API_TOKEN`, `MOBILE_TOKEN_SECRET`, `REP_SECRET` e `CORS_ORIGINS`.
- [x] Implementar auth própria (sessão opaca + token mobile).
- [x] Migrar CRUD de funcionários/empresas.
- [x] Migrar marcações/mobile.
- [x] Migrar horários/parâmetros/correções para o banco.
- [x] Criar `src/api.js` e remover o SDK Supabase.
- [x] Testar build, motor e fluxo completo.
- [ ] Configurar backup automatizado e monitoramento.
- [ ] Desligar definitivamente o Supabase.

---

## Próximo passo recomendado

1. **Fechamento fiscal** — identificador real do REP no AEJ tipo 02 + assinatura P7S.
2. **Teste com AFD real** — seguir `GUIA_TESTE_AFD.md`.
3. **Operação** — backup/restore testado e observabilidade.
4. **Qualidade** — CI com build + `test:engine` + `test:api`.
