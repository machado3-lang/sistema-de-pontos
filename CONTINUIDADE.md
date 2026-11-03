# Continuidade — Estado do Projeto (atualizado em 03/11/2026)

Este documento é o **ponto de retomada**. Ele resume o que foi feito, o que está validado, o que falta e como continuar.

> **Repositório:** `sistema-de-pontos` (separado do `controle-de-acessos` em 03/11/2026).
>
> **Última verificação de código: 31/10/2026.** Build, testes do motor, lint, sintaxe do backend, arquivos-chave e afirmações de segurança foram reconferidos. Nenhum código foi alterado nesta verificação; apenas conferência e atualização deste documento.

---

## 1. Resumo executivo

O sistema MultiPonto saiu de um MVP com credenciais fixas e cálculo duplicado para:

1. **Segurança P0 aplicada** — sem credenciais hardcoded, mobile validado no backend, senhas com hash, RLS no Supabase e debug removido.
2. **Motor de cálculo unificado** — uma única fonte em `ponto-web/src/engine/`, consumida por Dashboard, Apuração, Relatórios e exportações.
3. **Base de testes do motor** — 34 verificações automatizadas com `npm run test:engine`.

**Build atual:** passando (`npm run build`).
**Testes do motor:** passando (`npm run test:engine`).
**Backend:** sintaxe validada (`node --check server.js`).

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
- A senha do próprio REP ainda fica no `localStorage` do cadastro de equipamentos.
- `docker-compose.yml` tem serviços `face-*` sem diretório.
- `node_modules` está versionado no Git e não há `.gitignore` na raiz.

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
- [ ] Fase 1b: criar Postgres no Railway e rodar `npm run migrate`.
- [x] Fase 2: auth própria implementada (`/api/auth/login|me|logout|change-password`).
- [x] Fase 3: CRUD multiempresa implementado (`/api/funcionarios`, `/api/empresas`, ...).
- [ ] Fase 3b: rodar `npm run migrate` + `npm run test:api` contra um Postgres real.
- [x] Fase 4: trocar Supabase por `src/api.js` no frontend.
- [ ] Fase 4b: validar login/CRUD real no Railway.
- [ ] Fase 5: deploy, backup e testes.
- [ ] Configurar `.env` de produção e testar `docker compose up` do ponto. *(depende do `.env`; Docker não encontrado no PATH desta máquina)*
- [x] Limpar repositório (novo repo tem `.gitignore` e não versiona `node_modules`).
- [ ] Commitar a entrega em blocos: segurança, motor, docs, Railway.

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
- **Ainda pendente:**
  - Migração dos dados do Supabase (Fase 0)
  - Teste real no Railway + backup (Fase 5)
  - Mover horários/parâmetros/correções do localStorage para o PostgreSQL
- **Status:** backend e frontend usam PostgreSQL/API; **não há mais Supabase no código**.
- **Próximo passo:** Fase 0/5 (dados/deploy) ou persistir os auxiliares no banco.
