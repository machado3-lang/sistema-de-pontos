# Continuidade — Estado do Projeto (atualizado em 03/11/2026)

Este documento é o **ponto de retomada**. Ele resume o que foi feito, o que está validado, o que falta e como continuar.

> **Repositório:** `sistema-de-pontos` (separado do `controle-de-acessos` em 03/11/2026).
>
> **Última verificação de código: 03/11/2026.** Build, testes do motor, `node --check`
> do backend e smoke test da API (41 checks) validados no Railway. As seções 14 e 15
> registram as Fases 5 e 6; a seção 16 é o handoff para o próximo dia.

---

## 1. Resumo executivo

O MultiPonto está em produção no **Railway + PostgreSQL**, com autenticação própria,
frontend servido pelo backend e dados de negócio no banco (não mais no navegador).

**Estado em 03/11/2026:**

1. **Fases 1–4 concluídas** — schema PostgreSQL, auth própria, CRUD multiempresa e
   frontend consumindo `/api` (Supabase removido do código).
2. **Fase 5 concluída e validada no Railway** — horários, parâmetros, departamentos,
   cargos, correções, descartes, histórico, equipamentos, marcações e push server
   persistidos no PostgreSQL. Smoke test com **41 checks OK**.
3. **Fase 6 em andamento (parte principal entregue)** — roles
   (`admin`/`gestor`/`consulta`) aplicados no backend, auditoria em todas as
   mutações, gestão de usuários, `helmet`, rate limit global, CORS restrito e
   credenciais de REP criptografadas com AES-256-GCM.
4. **Motor de cálculo unificado** em `ponto-web/src/engine/`, com 34 testes
   (`npm run test:engine`).

**Build atual:** passando (`npm run build`).
**Testes do motor:** passando (`npm run test:engine`).
**Backend:** `node --check` OK em `server.js`, `routes/*.js`, `push-store.js`,
`secret-box.js`, `auditoria.js`.
**Smoke test da API:** 41 checks OK no Railway (03/11/2026).

---

## 2. O que foi concluído

### 2.1 Segurança (P0)

> **Nota:** a tabela abaixo registra a fase P0 feita no Supabase. Em 03/11/2026 a autenticação/RLS foi substituída por **PostgreSQL + auth própria**; o estado atual está na seção 12.

| Item | Onde | Situação |
|---|---|---|
| Remoção de `API_TOKEN` e `admin/admin` fixos | `ponto-cloud/server.js` | ✅ |
| Token obrigatório em produção (falha fechada) | `server.js` | ✅ |
| Login mobile validado no servidor | `POST /api/mobile/login` | ✅ |
| Token mobile HMAC 8h + rate limit | `server.js` | ✅ |
| Senha com hash scrypt (cadastro/migração) | `CadastrosUtils.js`, `auth.js` | ✅ |
| Migração automática de senhas em texto puro | `auth.js` / primeiro login | ✅ |
| Hora oficial do servidor na marcação | `POST /api/mobile/marcar` | ✅ |
| Sessões web opacas (hash em `sessoes`) | `auth.js`, `db/migrations/001_init.sql` | ✅ |
| Isolamento por `empresa_id` no CRUD | `routes/crud.js` | ✅ |
| Debug de CPF/estado removido dos relatórios | `RelatoriosTab.jsx` | ✅ |
| CORS configurável | `CORS_ORIGINS` | ✅ |
| Docker com build args do frontend | `ponto-web/Dockerfile`, `docker-compose.yml` | ✅ |

**Pré-requisito operacional:** configurar `DATABASE_URL` e rodar `npm run migrate` em `ponto-cloud`. Depois criar o admin com `npm run seed:admin`.

### 2.2 Motor de cálculo unificado

Fonte única: `ponto-web/src/engine/`.

| Módulo | Responsabilidade |
|---|---|
| `time.js` | minutos ↔ HH:MM, datas, feriados, janela noturna |
| `constants.js` | parâmetros padrão e merge profundo |
| `schedule.js` | Fixa, Escala Flexível, Escala Mensal, Turno Noturno, Eventual, jornada override |
| `punch.js` | batidas original/manual/pré-assinalada/desconsiderada |
| `tolerance.js` | sem tolerância, simples e CLT Art. 58 |
| `night.js` | adicional noturno e hora reduzida 52:30 |
| `overtime.js` | faixas de HE por tipo de dia |
| `absence.js` | faltas, atrasos e justificativas |
| `dsr.js` | DSR por média de HE |
| `bank.js` | banco de horas com piso/teto |
| `calculator.js` | orquestração dia/período + memória de cálculo |
| `afd.js` | parser AFD 1510/671 |

**Consumidores refatorados:**

- `ApuracaoTab.jsx` → `calcularPeriodo`
- `RelatoriosTab.jsx` → `calcularPeriodo`
- `App.jsx` (Dashboard) → `parseAFDLinhas`
- `PontoEngine.js` → reexporta o motor
- `parametrosUtils.js` → adaptador de compatibilidade

**Regras já suportadas:** dia útil/sábado/domingo/feriado, trabalho em folga a 100%, jornada fixa/cíclica/mensal/noturna/eventual, batida ímpar, manual, pré-assinalada, desconsiderada, turno cruzando meia-noite, tolerância CLT, HE por faixas, noturno, faltas, DSR, banco, interjornada/intrajornada, CPF/PIS dual e deduplicação de AFD.

---

## 3. Estado verificado

### Verificação de 31/10/2026

| Item | Comando / checagem | Resultado |
|---|---|---|
| Build do frontend | `npm run build` | ✅ passa |
| Testes do motor | `npm run test:engine` | ✅ 34/34 |
| Sintaxe do backend | `node --check server.js` | ✅ |
| Lint do RelatoriosTab | `npx eslint src/RelatoriosTab.jsx` | ⚠️ 2 erros + 2 warnings pré-existentes |
| Arquivos-chave | 19 caminhos conferidos | ✅ todos presentes |
| Variáveis do `.env.example` | 11 variáveis | ✅ todas presentes |
| Segurança | push público, CORS condicional, RLS, `senha_hash`, service key | ✅ conforme documentado |
| Git | `git log` / `git status` | ⚠️ 1 commit; alterações não commitadas |
| `.gitignore` raiz | `Test-Path .gitignore` | ⚠️ ausente |
| `node_modules` rastreados | `git ls-files` | ⚠️ 5.783 arquivos |
| Docker | `docker --version` | ⚠️ não encontrado no PATH desta máquina |
| `.env` de produção | `Test-Path .env` | ⚠️ ausente (só existe `ponto-web/.env.local`) |

**Lint:** os 2 erros são de `setState` dentro de `useEffect` em `RelatoriosTab.jsx`; os 2 warnings são de dependência `empFilter`. Ambos são pré-existentes e não bloqueiam o build.

```bash
# Reproduzir a verificação
cd ponto-web && npm run build && npm run test:engine
cd ../ponto-cloud && node --check server.js
cd ../ponto-web && npx eslint src/RelatoriosTab.jsx
```

---

## 4. Como rodar

### Desenvolvimento

```bash
# Backend
cd ponto-cloud
npm install
npm run dev            # porta 3100

# Frontend
cd ponto-web
npm install
npm run dev            # porta 5173 (proxy /api → 3100)
```

Em desenvolvimento, se `API_TOKEN`/`ADMIN_PASSWORD` não forem definidos, o backend gera valores temporários e mostra no log.

### Docker

```bash
# 1. copie e preencha o .env
cp .env.example .env

# 2. rode a migration no PostgreSQL (npm run migrate ou preDeployCommand do Railway)

# 3. suba o ponto (o compose já inclui o PostgreSQL local)
docker compose up -d --build postgres ponto-cloud ponto-web
```

> O `docker-compose.yml` deste repositório é exclusivo do sistema de pontos (PostgreSQL + ponto-cloud + ponto-web). O sistema de acesso vive no repositório `controle-de-acessos`.

### Variáveis obrigatórias em produção

```env
DATABASE_URL=
PGSSL=false
SESSION_TTL_HOURS=8
API_TOKEN=
ADMIN_USER=admin
ADMIN_PASSWORD=
MOBILE_TOKEN_SECRET=
CORS_ORIGINS=
VITE_PONTOCLOUD_URL=      # opcional; vazio usa /api via proxy
```

Gere segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Pendências priorizadas

### P1 — Expor o motor na UI

O motor já suporta, mas a UI ainda não oferece:

- Cadastro de **Escala Mensal**
- **Jornada por exceção** (override por dia)
- **Faixas avançadas de HE** (lista ordenada de políticas)
- Cadastro de **feriados** (municipais/estaduais/ponto facultativo)
- Ajuste manual de banco de horas por dia
- Colunas de banco (cred/deb/ajuste/saldo) já existem no Espelho (ocultas por padrão); falta expor na Apuração e permitir ajustes

### P1 — Consistência do Dashboard

O Dashboard ainda calcula o saldo de preview com base fixa de 8h (`App.jsx`). Apuração e Relatórios já usam a jornada real. Próximo passo: fazer o preview usar `calcularPeriodo`.

### P1 — Backend / multiusuário

- Mover o motor para um pacote compartilhado (frontend + backend).
- Multiempresa/tenant com RLS por `empresa_id`.
- Persistir estado de push (`PUSH_DEVICES`, `PUSH_EVENTS`) em disco/DB.
- Proteger endpoints de push (`/push`, `/event`) por token de dispositivo.

### P2 — Qualidade e operação

- Fluxo de aprovação da apuração (RHiD).
- Geolocalização/anti-spoofing no mobile (EzPoint).
- Compensação explícita de faltas/extras entre dias.
- Testes de integração com PostgreSQL e REP.
- Limpeza do repositório: `.gitignore` na raiz, remover `node_modules` do índice, commits organizados.
- Code splitting do bundle (~650 kB).

---

## 6. Decisões técnicas importantes

1. **Fonte única de cálculo** em `src/engine/`; `parametrosUtils.js` e `PontoEngine.js` são apenas compatibilidade.
2. **Motor no navegador** por enquanto. A próxima evolução é compartilhar o mesmo código com o backend.
3. **CPF é o documento canônico** quando existe; PIS é usado como fallback e para casar marcações.
4. **Trabalho em folga = 100%** (padrão dos sistemas de referência).
5. **Tolerância padrão = CLT Art. 58** (5 min/batida, 10 min/dia).
6. **Senhas do mobile** nunca ficam em texto puro após o primeiro login; a migração é transparente.
7. **RLS** libera dados para qualquer usuário autenticado. A segregação por empresa ainda não existe.

---

## 7. Mapa de arquivos relevantes

```
ponto-cloud/
  server.js                     # API, auth, mobile, push, proxy REP
  db/                            # schema PostgreSQL + migrations
  Dockerfile

ponto-web/
  scripts/test-engine.mjs       # testes do motor
  src/engine/                   # motor unificado
  src/ApuracaoTab.jsx           # consome calcularPeriodo
  src/RelatoriosTab.jsx         # consome calcularPeriodo
  src/App.jsx                   # dashboard + parseAFDLinhas
  src/PontoEngine.js            # compatibilidade
  src/MobileMarcacao.jsx        # mobile via backend
  src/cadastros/parametrosUtils.js  # adaptador
  src/cadastros/CadastrosUtils.js   # hashSenhaMobile
  src/cadastros/EquipamentoSection.jsx
  src/cadastros/FuncionarioForm.jsx
  Dockerfile

.env.example
docker-compose.yml
DOCUMENTACAO.md
CONTINUIDADE.md
```

---

## 8. Riscos conhecidos

- Endpoints de push continuam públicos.
- CORS fica aberto se `CORS_ORIGINS` não for definido.
- RLS não separa empresas (single-tenant).
- Mobile depende do PostgreSQL configurado (`DATABASE_URL`).
- A senha do REP fica em **texto puro** na tabela `equipamentos` (criptografia na Fase 6).
- `docker-compose.yml` tem serviços `face-*` sem diretório.
- Push server (`devices`/`events`/`results`) ainda em memória no `server.js`.

---

## 9. Checklist de retomada (31/10/2026)

### Verificado hoje

- [x] Documentação conferida contra o estado real do repositório.
- [x] Build, testes do motor, lint e sintaxe do backend reproduzidos.
- [x] Arquivos-chave, variáveis do `.env.example` e afirmações de segurança conferidos.

### Pendente

- [x] Decidir a próxima frente: **Railway + PostgreSQL** (plano em `MIGRACAO_RAILWAY.md`).
- [ ] Fase 0: recuperar/exportar dados do Supabase (se o projeto for recuperável).
- [x] Fase 1: schema, runner de migrations e seed criados (`ponto-cloud/db`).
- [x] Fase 1b: criar Postgres no Railway e rodar `npm run migrate`.
- [x] Fase 2: auth própria implementada (`/api/auth/login|me|logout|change-password`).
- [x] Fase 3: CRUD multiempresa implementado (`/api/funcionarios`, `/api/empresas`, ...).
- [x] Fase 3b: rodar `npm run test:api` contra o Postgres real (03/11/2026, 32 checks OK).
- [x] Fase 4: trocar Supabase por `src/api.js` no frontend.
- [x] Fase 4b: login validado no Railway.
- [x] Fase 4c: validar CRUD completo (funcionário, marcação, relatório) no Railway.
- [ ] Fase 5: migrar auxiliares do `localStorage` + REP/push para o PostgreSQL.
  - [x] Horários, parâmetros, departamentos, cargos, correções, descartes, equipamentos e histórico.
  - [x] Marcações importadas via API.
  - [ ] Persistir push (`devices`/`events`/`results`) no PostgreSQL.
  - [x] Validar `npm run migrate` + `npm run test:api` no Railway (32 checks OK).
- [ ] Fase 6: roles, auditoria e hardening.
- [ ] Fase 7: conformidade fiscal e folha.
- [ ] Fase 8: workflow e relatórios.
- [ ] Fase 9: mobile e portal do funcionário.
- [ ] Fase 10: operação/SaaS (backup, CI/CD, monitoramento).
- [x] Configurar variáveis de produção no Railway.
- [x] Commitar/publicar a entrega.

---

## 10. Comandos úteis

```bash
# Testes do motor
cd ponto-web && npm run test:engine

# Build
cd ponto-web && npm run build

# Sintaxe do backend
cd ponto-cloud && node --check server.js

# Gerar segredo
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ver status do repositório (sem node_modules)
git status --short -- . ':!**/node_modules/**'
```

---

## 11. Supabase — situação do projeto (31/10/2026)

| Item | Valor |
|---|---|
| Project ref | `hdmodlarqtbikvsvyolq` |
| Project URL | `https://hdmodlarqtbikvsvyolq.supabase.co` |
| Dashboard direto | `https://supabase.com/dashboard/project/hdmodlarqtbikvsvyolq` |
| Onde está configurado | `ponto-web/.env.local` (frontend) e no build `ponto-web/dist` |
| Status em 31/10/2026 | DNS **NXDOMAIN** (Google 8.8.8.8 e Cloudflare 1.1.1.1) |
| Interpretação | Projeto **pausado** (free tier) **ou** excluído — os dois cenários removem o DNS |

**Ação recomendada:** entrar em `https://supabase.com/dashboard`, localizar o projeto `hdmodlarqtbikvsvyolq` e clicar em **Resume** se estiver pausado. A propagação do DNS pode levar de minutos a algumas horas.

**Conta:** o e-mail da conta Supabase **não está nos arquivos do projeto**. Pistas:
- Git user do repositório: `machado3-lang` (tentar “Continue with GitHub”).
- Verificar gerenciador de senhas do Chrome/Edge para `supabase.com`.
- Buscar “Supabase” / `hdmodlarqtbikvsvyolq` na caixa de e-mail.
- Histórico do navegador: `supabase.com/dashboard/project/hdmodlarqtbikvsvyolq`.
- LocalStorage do app (DevTools): chave `sb-hdmodlarqtbikvsvyolq-auth-token` contém `user.email`.
- Se não encontrar: suporte Supabase com o project ref e a data aproximada de criação (maio/2026).

**Se o projeto tiver sido excluído:** os dados não são recuperáveis. Será necessário criar um novo projeto, rodar o schema/migration, reconfigurar `ponto-web/.env.local` e o `.env` do backend, e recriar o usuário de login. O código do sistema está intacto.

---

## 12. Decisão de infraestrutura: Railway + PostgreSQL (31/10/2026)

- **Decisão:** sair do Supabase e usar **Railway + PostgreSQL**.
- **Motivo:** controle total do banco/auth, custo previsível e o Supabase já é Postgres (migração direta). MySQL não traz vantagem e exigiria retrabalho.
- **Plano completo:** [MIGRACAO_RAILWAY.md](MIGRACAO_RAILWAY.md)
- **Implementado no backend (31/10/2026):**
  - `ponto-cloud/db.js` — pool PostgreSQL
  - `ponto-cloud/auth.js` — senhas, sessões e token mobile
  - `ponto-cloud/routes/auth.js` — `login`, `logout`, `me`, `change-password`
  - `ponto-cloud/routes/crud.js` — CRUD multiempresa
  - `ponto-cloud/routes/mobile.js` — mobile em PostgreSQL
  - `ponto-cloud/db/migrations/001_init.sql` — schema
  - `ponto-cloud/db/migrate.js` e `seed-admin.js` — migrations/seed
  - `ponto-cloud/scripts/test-api.mjs` — smoke test (`npm run test:api`)
- **Implementado no frontend (03/11/2026):**
  - `ponto-web/src/api.js` — cliente HTTP com sessão Bearer
  - `LoginScreen`, `App`, `CadastrosTab`, `EmpresaSection`, `EquipamentoSection`, `ApuracaoTab` e `RelatoriosTab` usando a API
  - SDK `@supabase/supabase-js` removido do frontend
  - Build caiu de ~637 kB para ~453 kB
- **Railway (03/11/2026):**
  - `Dockerfile` na raiz builda o frontend e copia o `dist` para `ponto-cloud/public`
  - O backend serve o frontend na mesma URL (sem segundo serviço/CORS)
  - `railway.json` roda `npm run migrate` no `preDeployCommand` e valida `/api/health`
- **Ainda pendente:**
  - Migração dos dados do Supabase (Fase 0)
  - Backup automatizado (Fase 5)
  - Mover horários/parâmetros/correções do localStorage para o PostgreSQL
- **Status:** backend e frontend usam PostgreSQL/API; **não há mais Supabase no código**.
- **Próximo passo:** Fase 5 (persistir auxiliares) + Fase 6 (roles/auditoria).

---

## 13. Roadmap profissional (03/11/2026)

Análise completa de lacunas vs. RHiD, Secullum e EzPoint Web: **[ROADMAP_PROFISSIONAL.md](ROADMAP_PROFISSIONAL.md)**.

**Próximo sprint recomendado (P0):**

1. **Fase 5** — migrar horários, parâmetros, departamentos, cargos, correções, dias descartados, equipamentos e push do `localStorage`/JSON para o PostgreSQL.
2. **Fase 6** — aplicar roles (`admin`, `gestor`, `consulta`), auditoria em todas as mutações, tela de usuários e hardening HTTP.
3. Depois: conformidade fiscal/folha (Fase 7), workflow/relatórios (Fase 8), mobile/portal (Fase 9) e operação/SaaS (Fase 10).

**Critérios de “pronto para produção”** estão na seção 5 do roadmap.

---

## 14. Fase 5 — Consolidação de dados (03/11/2026)

**Objetivo:** PostgreSQL como fonte de verdade; `localStorage` só como cache/token.

### Entregue

| Item | Antes | Agora |
|---|---|---|
| Horários | `ponto_horarios` | `/api/horarios` (`config jsonb`) |
| Parâmetros | `ponto_parametros_list` | `/api/parametros` (`config jsonb`) |
| Departamentos / cargos | `ponto_departamentos` / `ponto_cargos` | `/api/departamentos` e `/api/cargos` |
| Correções | `ponto_correcoes` | `/api/correcoes` |
| Dias descartados | `ponto_dias_descartados` | `/api/dias-descartados` |
| Marcações descartadas | `ponto_marcacoes_descartadas` | `/api/marcacoes-descartadas` |
| Histórico de horários | `ponto_hist_horarios` | tabela `funcionario_hist_horarios` |
| Equipamentos (REPs) | `ponto_equipamentos` | `/api/equipamentos` |
| Extras do funcionário | `ponto_func_extras` | colunas da tabela `funcionarios` |
| Marcações importadas (AFD/REP/push) | `ponto_marcacoes` | `/api/marcacoes/import` |

### Arquitetura da camada de dados

- `ponto-web/src/data/pontoData.js` centraliza leitura/gravação.
- Toda escrita chama a API e atualiza o cache síncrono.
- O cache (`ponto_horarios`, `ponto_parametros_list`, etc.) existe só para:
  - pintar a tela antes da rede responder;
  - alimentar `parametrosUtils.js` / motor, que leem de forma síncrona.
- **Migração automática:** se o banco estiver vazio e houver dados legados no
  navegador, eles são importados uma única vez (marcador
  `ponto_migrado_<recurso>`).

### Migrations novas

- `ponto-cloud/db/migrations/002_hist_horarios.sql`
- `ponto-cloud/db/migrations/003_equipamentos_campos.sql`
- `ponto-cloud/db/migrations/004_empresas_tenant.sql`
- `ponto-cloud/db/migrations/005_empresas_tenant_backfill.sql`
- `ponto-cloud/db/migrations/006_push_persistencia.sql`
- `ponto-cloud/db/migrations/007_periodos_fechados.sql`
- `ponto-cloud/db/migrations/008_feriados_recorrente.sql`
- `ponto-cloud/db/migrations/009_feriados_justificativas.sql`
- `ponto-cloud/db/migrations/010_feriado_aplicacoes.sql`
- `ponto-cloud/db/migrations/011_jornada_excecoes.sql`

### Empresas por conta (correção)

A empresa criada pelo usuário não aparecia porque a listagem filtrava
`id = usuario.empresa_id`. A migration `004` adiciona `empresas.tenant_id`
(a raiz aponta para si mesma; as filhas apontam para a raiz). A listagem agora
usa `tenant_id = usuario.empresa_id`, e funcionários/equipamentos aceitam uma
empresa filha desde que pertença à conta.

### Endpoints novos/ajustados

- `GET|PUT /api/funcionarios/:id/hist-horarios`
- `DELETE /api/correcoes?funcionario_id&data`
- `DELETE /api/dias-descartados?funcionario_id&data`
- `DELETE /api/marcacoes-descartadas?funcionario_id&data&hora`
- `DELETE /api/empresas/:id` desabilitado (empresa é o próprio tenant)

### Push persistido (03/11/2026)

- `push-store.js` grava `devices`, `events`, `results`, `commands` e `marcações`
  no PostgreSQL (write-through) e recarrega tudo no boot.
- Retenção automática: eventos/resultados por 30 dias, comandos entregues por 7.
- Sem `DATABASE_URL`, continua usando o JSON local (`data/push_marcacoes.json`).

### Ainda pendente na Fase 5

- Deprecar `/api/reps` (JSON `data/database.json`), mantendo só o proxy FCGI.

### Como validar no Railway

```bash
cd /app
npm run migrate
BASE_URL=http://localhost:3100 \
ADMIN_EMAIL=seu-admin@empresa.com \
ADMIN_PASSWORD='sua-senha' \
npm run test:api
```

O smoke test agora cobre parâmetros, equipamentos, histórico de horários,
correções e descartes (inclusive remoção por chave natural).

---

## 15. Fase 6 — Segurança, papéis e auditoria (03/11/2026)

### Entregue

- **Papéis aplicados no backend** (`ponto-cloud/routes/crud.js`):
  - `admin` e `gestor`: leitura + escrita.
  - `consulta`: apenas leitura (`GET`). Qualquer `POST/PUT/DELETE` retorna 403.
- **Auditoria** (`ponto-cloud/auditoria.js`): toda mutação do CRUD grava em
  `auditoria` (quem, quando, entidade, id e detalhes). Cobre funcionários,
  marcações, correções, descartes, banco, equipamentos, empresas, parâmetros,
  horários, departamentos, cargos e histórico.
- **Gestão de usuários** (`ponto-cloud/routes/usuarios.js`), somente `admin`:
  - `GET /api/usuarios`
  - `POST /api/usuarios`
  - `PUT /api/usuarios/:id` (nome, perfil, ativo)
  - `POST /api/usuarios/:id/reset-password`
  - `POST /api/usuarios/:id/revoke-sessions`
  - `DELETE /api/usuarios/:id` (desativa + revoga sessões)
- **Frontend**:
  - `UsuariosSection.jsx` (aba **Usuários** visível só para `admin`).
  - `App` guarda o usuário logado e repassa `role`.
  - Perfil `consulta` vê banner de somente leitura e não vê a aba Usuários.
- **Hardening**:
  - `helmet` (CSP desligada para não quebrar estilos inline).
  - Rate limit global por IP (2000 req/15 min; health e push isentos).
  - CORS fail-closed em produção quando `CORS_ORIGINS` não está definido.
- **Credenciais de REP criptografadas** (`ponto-cloud/secret-box.js`):
  - AES-256-GCM com chave derivada de `REP_SECRET`.
  - `equipamentos.senha` e `equipamentos.api_key` são gravados como
    `enc:v1:<iv>:<tag>:<cipher>` e descriptografados na leitura.
  - No boot, credenciais antigas em texto puro são criptografadas uma vez.
  - Sem `REP_SECRET`, o servidor avisa e mantém texto puro (compatibilidade).

### Ainda pendente na Fase 6

- Token de push por dispositivo.
- Tela de auditoria (consulta dos logs) — pode entrar na Fase 8.
- Refinar botões de escrita nas telas de Horários/Empresas/Parâmetros/Equipamentos
  para o perfil `consulta` (o backend já bloqueia).
- Deprecar `/api/reps` (JSON `data/database.json`).

---

## 16. Handoff — retomada em 04/11/2026

### O que está no ar (validado em 03/11/2026)

- Deploy no Railway com commit **`b28bcd9`** (ou posterior).
- Login web + mobile funcionando.
- Empresas, horários, parâmetros, departamentos, cargos, equipamentos,
  correções, descartes e histórico no PostgreSQL.
- Push server persistido (`push_devices`, `push_events`, `push_results`,
  `push_commands`, `push_marcacoes`).
- Roles aplicados: `consulta` recebe 403 em qualquer escrita.
- Auditoria gravando em `auditoria`.
- Smoke test: **41 checks OK**.

### Primeiro passo ao retomar

1. Confirmar o deploy mais recente em `/api/health` (campo `commit`).
2. Configurar `REP_SECRET` no Railway (se ainda não configurado):
   ```bash
   node --input-type=module -e "import { randomBytes } from 'crypto'; console.log(randomBytes(32).toString('hex'))"
   ```
   Adicionar em **Variables** e fazer **Redeploy**.
3. Rodar o smoke test:
   ```bash
   cd /app && BASE_URL="http://127.0.0.1:${PORT}" \
   ADMIN_EMAIL=seu-admin@empresa.com ADMIN_PASSWORD='sua-senha' npm run test:api
   ```
4. Conferir a criptografia:
   ```sql
   SELECT nome, left(senha, 12) AS senha_inicio FROM equipamentos;
   -- esperado: enc:v1:...
   ```

### Pendências priorizadas

**Fase 6 (fechar):**
- Token de push por dispositivo (depende do firmware do REP).
- Política de retenção/LGPD.
- Refinar botões de escrita para `consulta` nas telas de Horários/Empresas/
  Parâmetros/Equipamentos (backend já bloqueia).
- Deprecar `/api/reps` (JSON legado).

**Fase 7 (próxima frente — maior lacuna vs. RHiD/Secullum/EzPoint):**
- Validador de AFD/AFDT/ACJEF/AEJ contra o leiaute oficial.
- Hash/NSR consistente e fechamento fiscal por período.
- Trava de período fechado + reabertura auditada.
- Exportação para folha (Domínio, Alterdata, Fortes, Questor, Sênior) e eSocial.

**Fase 8:** workflow de aprovação, férias/afastamentos, relatórios customizáveis.

### Comandos úteis

```bash
# backend
cd ponto-cloud
node --check server.js
npm run migrate
npm run seed:admin
npm run test:api

# frontend
cd ponto-web
npm run build
npm run test:engine
```

### Observações importantes

- **O `preDeployCommand` do `railway.json` não está sendo executado.** Toda
  migration nova precisa ser rodada manualmente (`npm run migrate` no console).
  Investigar depois ou mover para um passo de boot.
- **Não trocar `REP_SECRET`** depois de configurado: as credenciais antigas
  ficam ilegíveis. Se precisar rotacionar, recadastre a senha/chave dos REPs.
- A `DATABASE_URL` e a senha do admin foram expostas no chat em 03/11/2026;
  recomenda-se rotacionar.
- O painel “Upstream Repo” do Railway é cosmético enquanto o auto deploy
  estiver funcionando.

---

## 17. Fase 7 — Fechamento de período (04/11/2026)

### Entregue

- Migration `007_periodos_fechados.sql`:
  - tabela `periodos_fechados` (empresa, intervalo, quem fechou, resumo,
    reabertura e motivo);
  - índice único de períodos abertos por intervalo.
- Backend `routes/periodos.js`:
  - `GET /api/periodos`
  - `GET /api/periodos/status?data=YYYY-MM-DD`
  - `POST /api/periodos/fechar` (admin/gestor)
  - `POST /api/periodos/:id/reabrir` (somente admin, motivo obrigatório)
  - auditoria de fechamento e reabertura.
- Trava de alterações: `routes/crud.js` bloqueia (HTTP 409) marcações,
  correções, dias descartados, marcações descartadas e ajustes de banco em
  datas de períodos fechados. Importação de marcações valida o intervalo.
- Frontend:
  - `components/FechamentoPeriodo.jsx` na aba **Apuração** (operação de RH).
  - A aba **Relatórios → Fiscais** ficou apenas com AFD/AFDT/ACJEF/AEJ,
    que são arquivos para fiscalização do MTE e emitidos sob solicitação.
  - Fechar período, ver resumo, reabrir (admin) e histórico de reaberturas.

### Como validar

```bash
cd /app
npm run migrate   # aplica 007_periodos_fechados
```

O smoke test cobre:
```
OK: fechar período
OK: status do período
OK: escrita bloqueada em período fechado
OK: reabrir período
```

### Próximos passos da Fase 7

- Validador de AFD/AFDT/ACJEF/AEJ contra o leiaute oficial (Portaria 671/1510).
- Hash/NSR consistente e fechamento fiscal com assinatura.
- Exportação para folha (Domínio, Alterdata, Fortes, Questor, Sênior) e eSocial.
- Tela de auditoria (logs) e política de retenção/LGPD.

---

## 18. Integração com o IZCLOUD (04/11/2026)

**Problema:** o backend no Railway não alcança REPs na rede local (`192.168.x.x`).
O iDClass 1510 só aceita IP direto; o iDFace aceita push, mas a importação de
funcionários exige o caminho inverso.

**Solução escolhida:** o MultiPonto consome o **IZCLOUD** (nuvem própria em
desenvolvimento) como relay HTTP para alcançar o REP.

### Entregue no MultiPonto

- `ponto-cloud/rep-relay.js`:
  - com `IZCLOUD_URL`: envia `POST {IZCLOUD_URL}/relay` com Bearer token;
  - sem `IZCLOUD_URL`: conecta direto no IP do REP (dev/on-premises).
- `server.js`: `proxyREPWithProtocol` e `proxyREPBinary` passam pelo relay.
  Todas as rotas `/api/reps/proxy/*` continuam iguais.
- `/api/health` expõe:
  ```json
  { "rep_provider": "izcloud", "rep_relay": true }
  ```
- Contrato completo em **[IZCLOUD_INTEGRACAO.md](IZCLOUD_INTEGRACAO.md)**.

### Variáveis

```
IZCLOUD_URL=https://izcloud.seudominio.com
IZCLOUD_TOKEN=...
REP_TIMEOUT_MS=15000
```

### Pendente

- O IZCLOUD implementar `POST /relay` conforme o contrato.
- Testar com iDClass 1510 (login, load_users, get_afd).
- Testar com iDFace (users/load, face/upload).
- Enquanto isso, o modo direto continua funcionando para backend local.

---

## 19. Feriados, auditoria e ideias do RHiD (04/11/2026)

### Feriados

- Migration `008_feriados_recorrente.sql`: coluna `recorrente`.
- Frontend `cadastros/FeriadosSection.jsx`:
  - aba **Feriados** em Cadastros;
  - nome, data, tipo (nacional/estadual/municipal/empresa) e "repete todo ano";
  - editar e excluir.
- Integração com o motor:
  - `ApuracaoTab` e `RelatoriosTab` carregam os feriados via API;
  - `feriadosParaEngine()` converte recorrente em `MM-DD` e pontual em `YYYY-MM-DD`;
  - `calcularPeriodo` já considerava feriados; agora recebe a lista real.

### Auditoria

- Backend `routes/auditoria.js`:
  - `GET /api/auditoria?limit=&offset=&entidade=&acao=&usuario_id=&data_inicio=&data_fim`
  - visível para `admin` e `gestor`.
- Frontend `components/AuditoriaSection.jsx`:
  - aba **Auditoria** em Relatórios (admin/gestor);
  - filtros por período, entidade e ação;
  - detalhes JSON expandíveis;
  - exportação CSV.

### O que observamos no manual do RHiD

- **Apuração em uma tela**: tabela com todos os funcionários/dias e colunas
  configuráveis (previsto, trabalhado, normais, noturno, faltas, atrasos,
  extras, DSR, banco). Edição inline das marcações com justificativa.
- **Visuais de colunas** salvos por usuário.
- **Inconsistências** e **justificativas** como cadastros próprios.
- **Fechamento** e geração de arquivo para folha.
- **Relatório de auditoria** listando inclusões/alterações/remoções.

### Próximo passo sugerido

Redesenhar a **Apuração** para o modelo de tabela do RHiD:

1. Grade funcionário × dia no período.
2. Colunas configuráveis (reaproveitar `COLUNAS` de `RelatoriosTab`).
3. Edição inline da marcação com motivo (já temos `correcoes`).
4. Destaque de inconsistências e dias fechados.
5. Botão de espelho/CSV por linha.

---

## 20. Feriados por âmbito e justificativas (04/11/2026)

### Modelo implementado

- Migration `009_feriados_justificativas.sql`:
  - `funcionarios.cidade` / `uf`;
  - `feriados.uf`, `cidade`, `alvo_empresa_id`;
  - `justificativa_tipos` e `justificativas`.
- Feriado agora tem **aplicações combináveis** (`feriado_aplicacoes`):
  - empresa, UF, cidade (código IBGE) e funcionário (backend também aceita
    departamento e horário);
  - **dimensões diferentes = E**; **valores da mesma dimensão = OU**;
  - sem aplicações = vale para todos.
- O `tipo` (nacional/estadual/municipal/empresa) é a **classificação**.
- Cidade é um **select do IBGE** (código), tanto no funcionário quanto no feriado.
- O formulário de feriado tem o construtor “Aplicar a” com chips removíveis.
- **Feriado como dia normal fica no Horário** (`considerar_feriado_dia_normal`),
  não no feriado. Quando ligado, o motor não considera feriado para aquele
  funcionário (não gera extra).
- `feriadosParaFuncionario()` filtra os feriados por funcionário + horário.
- Tipos de justificativa com 6 comportamentos:
  - dia inteiro, período, abonar horas, ajustar horas, relocar para banco, só DSR;
  - flags: abona falta, abona horas, protege DSR, gera banco, exige CID, exige anexo.
- Aba **Cadastros → Justificativas** para CRUD dos tipos.
- Endpoints:
  - `GET/POST/PUT/DELETE /api/justificativa-tipos`
  - `GET/POST/PUT/DELETE /api/justificativas`

### Apuração em grade (v1)

- Tabela de dias (funcionário × dia) com colunas: Dia, Funcionário, Batidas,
  Previsto, Trabalhado, Normais, Noturno, Atraso, Extra, DSR, Banco, Status
  e Justificativa.
- Filtro **“Somente inconsistências”**.
- Clique na linha abre o painel de tratamento (batida manual, desconsiderar dia
  e justificativa por tipo).
- As justificativas lançadas aparecem na coluna e no painel, com remoção.

### Jornada eventual no dia (04/11/2026)

- Horários do tipo `Eventual` não aparecem mais no vínculo do funcionário.
- Na Apuração, o painel do dia tem **Jornada do dia**: escolhe qualquer horário
  (inclusive eventual) só para aquela data, via `jornada_excecoes` (migration 011).
- O motor e os relatórios recebem `jornadas` e aplicam o override no cálculo.
- **Motivo da correção** (texto) ficou separado da **justificativa tipada**.
- **Desconsiderar dia** deixa claro que ignora o dia (não é falta).

### Ainda falta

- Aplicar as justificativas no motor (abono/ajuste/banco/DSR).
- Edição inline da batida direto na célula (hoje é no painel).
- Inconsistências configuráveis.
- Relatório de justificativas e ocorrências.

---

## 21. Motivos de correção no AEJ (04/11/2026)

A Portaria 671 exige, no **AEJ (registro tipo 05)**, o campo `motivo` quando a
marcação é desconsiderada (`tpMarc = D`) ou incluída manualmente
(`fonteMarc = I`).

### Entregue

- Migration `012_motivos_correcao.sql`:
  - catálogo `motivos_correcao` (descrição + ativo);
  - coluna `marcacoes_descartadas.motivo`.
- Cadastros → **Motivos**: CRUD dos motivos.
- Na Apuração, **Motivo da correção** é um campo com sugestões (datalist):
  pode selecionar do catálogo ou digitar.
- Ao desconsiderar uma marcação, o motivo passa a ser obrigatório e fica salvo.
- AEJ:
  - inclusões manuais (`I`) levam o motivo da correção;
  - desconsiderações (`D`) geram registro com o motivo.
- **Jornada do dia** agora lista apenas horários `Eventual`.

### Ainda falta

- Refinar a geração do AEJ (layout completo, assinatura P7S).
- Gerar AFD com os mesmos motivos quando aplicável.
- Aplicar justificativas no motor.

---

## 22. AFD — parser e validador (04/11/2026)

Reescrevi `ponto-web/src/engine/afd.js` com o leiaute oficial:

- **Tipo 3** (REP-C / REP-A): 1510 (DDMMYYYY + HHMM + PIS) e 671 (DH 24 + CPF 12).
- **Tipo 7** (REP-P): iDFace, mobile e browser — antes era ignorado.
- **Tipo 1** cabeçalho, **tipo 5** empregados, **tipo 6** eventos e **tipo 9**
  trailer.

`validarAFD(conteudo)` devolve:

- `ok`, `erros`, `avisos`;
- resumo: portaria, versão, empregador, período, marcações (tipo 3 e 7),
  funcionários e eventos.

O upload de AFD no Dashboard agora mostra a validação (portaria, versão,
período, quantidade por tipo, erros e avisos) antes de importar.

Testes do motor cobrem:

- AFD 1510 (PIS);
- AFD 671 tipo 3 (CPF);
- AFD 671 tipo 7 (REP-P).

Leiautes de referência no repositório: `afd_leiaute.pdf`, `afd_texto.txt`,
`leiaute-do-arquivo-eletronico-de-jornada-aej.pdf` e `aej_texto.txt`.

---

## 24. AFD — correções de leiaute (04/11/2026)

Ao conferir os leiautes oficiais (AFD 1510 e 671), o trailer estava sendo
ignorado: nos dois casos o tipo "9" fica na última posição do registro
("999999999" + contadores + "9"), e não na 10ª posição.

Corrigido em `ponto-web/src/engine/afd.js`:

- trailer AFD 1510 (46 caracteres) e 671 (64 caracteres), com os contadores
  por tipo;
- cabeçalho 1510 (razão social nas posições 38-187 e datas ddmmaaaa);
- tipo 5 (empregado) 1510 x 671 (PIS/CPF, operação e nome).

`validarAFD` agora reconhece o trailer e não emite mais o aviso falso de
"Trailer não encontrado". Os testes do motor incluem cabeçalho + empregado +
marcação + trailer completos nos dois leiautes.

Referência: `afd_texto.txt` (671) e `afd_1510_texto.txt` (1510).

---

## 25. Inconsistências configuráveis (04/11/2026)

Nova tabela `inconsistencia_tipos` (migration `013_inconsistencias.sql`):

- `nome`, `campo` (`atraso`, `falta`, `extra`, `banco`, `batida`, `outro`);
- `valor_min` (limite em minutos);
- `prioridade` (1 = mais grave);
- `icone`, `cor`, `ativo`.

A migration semeia cinco tipos para as empresas existentes:

- Batida ímpar (prioridade 1);
- Débito acima de 2h (prioridade 2);
- Atraso acima de 10 min (prioridade 3);
- Hora extra acima de 2h (prioridade 4);
- Banco negativo acima de 2h (prioridade 5).

### Onde aparece

- **Cadastros → Inconsistências**: CRUD completo.
- **Apuração**: o motor `engine/inconsistencies.js` avalia cada dia; o status
  do dia passa a ser a inconsistência de menor prioridade que disparou.
  O painel lista todas as inconsistências com cor e valor.
- O filtro **Somente inconsistências** usa os tipos configurados.
- Sem catálogo (migration não aplicada/empresa sem tipos), a apuração mantém o
  comportamento antigo como fallback.

### Testes

- `test:engine`: batida ímpar, atraso, extra, limite e prioridade.
- Smoke test da API: criar, listar, atualizar e excluir tipo de inconsistência.

> A migration 013 precisa ser aplicada com `npm run migrate` no ambiente.

---

## 26. Importação de AFD — robustez (04/11/2026)

Ajustes no upload do Dashboard (`ponto-web/src/App.jsx`):

- leitura do arquivo como **ISO 8859-1**, conforme a norma do AFD, para não
  corromper nomes com acento;
- `equip_id` do AFD passa a ser `afd:<hash do conteúdo>` (FNV-1a). Assim o NSR
  de arquivos diferentes não colide e reimportar o mesmo arquivo é idempotente;
- o resultado da importação lista os **documentos sem funcionário cadastrado**,
  com o nome vindo do registro tipo 5, e orienta o cadastro do CPF/PIS;
- exibe o empregador do cabeçalho do AFD.

### Fluxo recomendado para o teste com AFD real

1. `npm run migrate` (aplica 009–013).
2. Cadastros → Funcionários: preencher **CPF** e **PIS** do empregado.
3. Dashboard → importar o AFD.
4. Conferir portaria, período, marcações, avisos e documentos não encontrados.
5. Apuração → conferir a grade e aplicar correções/justificativas.

---

## 23. Justificativas aplicadas no motor (04/11/2026)

Os lançamentos de justificativa passaram a afetar o cálculo do dia, não são
apenas registro.

### Motor (engine/justification.js + calculator.js)

- dia_inteiro + bona_falta: zera a falta do dia e soma em
  altaJustificadaMin.
- periodo: abona os minutos do intervalo (inicio/im) do débito.
- horas + bona_horas: abona minutos do débito.
- juste: soma/subtrai minutos do saldo (saldoDiaMin).
- anco + gera_banco: reloca o extra/falta do dia para o banco
  (ancoAjusteMin).
- dsr + protege_dsr: o dia deixa de contar como falta no DSR.

Campos novos por linha: bonoMin, altaJustificadaMin, saldoDiaMin,
justeMin, ancoAjusteMin, protegeDSR, justificativas[].

### Apuração

- O formulário mostra os campos conforme o tipo:
  - período -> início/fim;
  - horas/ajuste -> minutos (ajuste aceita negativo);
  - exige_cid -> CID;
  - exige_anexo -> anexo.
- A grade usa debitoMin e 
ormaisMin do motor (refletem abono) e mostra o
  abono na coluna Justif.
- O painel mostra cartões de Abonado, Ajuste de saldo e DSR protegido.

### Relatórios

- O espelho de ponto carrega as justificativas do período, aplica no motor, usa
  saldoDiaMin na coluna Saldo e mostra o tipo em Obs.
- O ACJEF usa o débito já abonado.

### Testes


pm run test:engine cobre os seis comportamentos e a proteção de DSR.
O smoke test da API valida período, minutos, CID e anexo da justificativa.
