# MultiPonto — Gestão de Ponto Eletrônico

Sistema de ponto eletrônico compatível com as **Portarias 1510 (PIS)** e **671 (CPF)** do MTP, com apuração, banco de horas, DSR, integração com REPs iDClass/iDFace e app mobile.

## Visão geral

- **Frontend:** React 19 + Vite 8 (`ponto-web`)
- **Backend:** Node.js 20 + Express (`ponto-cloud`)
- **Banco:** PostgreSQL (Railway) + JSON local no backend (REPs/push)
- **Autenticação:** própria (sessões no PostgreSQL + token mobile)
- **Motor de cálculo:** JavaScript puro, unificado em `ponto-web/src/engine`
- **Integração REP:** proxy FCGI + push server (iDClass/iDFace)

## Arquitetura

```
Navegador (React)
  ├── api.js (sessão Bearer)
  ├── engine/ (cálculo de ponto)
  └── localStorage (cadastros auxiliares)
        │
        ▼
ponto-cloud (Express)
  ├── /api/auth/* (login, sessão, logout)
  ├── /api/* (CRUD PostgreSQL)
  ├── /api/reps/* (proxy REP)
  ├── /api/mobile/* (login + marcação)
  ├── /push, /event (recebimento dos equipamentos)
  └── data/database.json (legado REP/push)
        │
        ▼
PostgreSQL (Railway)
```

## Estrutura

```
Pontoweb/
├── ponto-cloud/                 # Backend
│   ├── server.js
│   ├── auth.js
│   ├── db.js
│   ├── routes/
│   ├── db/                      # schema PostgreSQL + migrations
│   └── Dockerfile
├── Dockerfile                   # build do backend no Railway
├── railway.json                 # deploy Railway (backend)
├── ponto-web/                   # Frontend
│   ├── src/
│   │   ├── engine/              # Motor de cálculo unificado
│   │   ├── ApuracaoTab.jsx
│   │   ├── RelatoriosTab.jsx
│   │   ├── MobileMarcacao.jsx
│   │   └── cadastros/
│   ├── scripts/test-engine.mjs  # Testes do motor
│   └── Dockerfile
├── DOCUMENTACAO.md              # Documentação funcional/técnica
├── CONTINUIDADE.md              # Estado atual e próximos passos
├── .env.example
└── docker-compose.yml
```

## Como rodar

### Desenvolvimento

```bash
# Backend (PostgreSQL)
cd ponto-cloud
npm install
# configure DATABASE_URL no .env (ou suba o postgres do docker-compose)
npm run migrate
ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=uma-senha-forte npm run seed:admin
npm run dev            # http://localhost:3100

# Frontend (API do PontoCloud)
cd ponto-web
npm install
npm run dev            # http://localhost:5173 (proxy /api → 3100)
```

### Testes do motor

```bash
cd ponto-web
npm run test:engine
```

### Smoke test da API

```bash
cd ponto-cloud
BASE_URL=http://localhost:3100 ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=uma-senha-forte npm run test:api
```

### Build

```bash
cd ponto-web
npm run build
```

### Docker

```bash
cp .env.example .env
# preencha API_TOKEN, ADMIN_PASSWORD, MOBILE_TOKEN_SECRET, CORS_ORIGINS
docker compose up -d --build postgres ponto-cloud ponto-web

# Aplique a migration e crie o admin:
docker compose exec ponto-cloud npm run migrate
docker compose exec ponto-cloud env ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=uma-senha-forte npm run seed:admin
```

> O backend novo usa PostgreSQL. O `migration_supabase.sql` é legado e só serve para exportar dados antigos.

## Segurança

- Sem credenciais fixas no código: `API_TOKEN`, `ADMIN_PASSWORD` e `MOBILE_TOKEN_SECRET` vêm do ambiente.
- Login mobile validado no backend; senha com hash PBKDF2/scrypt.
- RLS habilitado em `funcionarios`, `empresas` e `marcacoes`.
- Marcação mobile usa a hora do servidor (America/Sao_Paulo).
- Detalhes e checklist: [DOCUMENTACAO.md](DOCUMENTACAO.md#segurança-e-deploy-atualizado).

## Motor de cálculo

Uma única implementação em `ponto-web/src/engine/`:

- Jornadas: fixa, cíclica, mensal, noturna, eventual e override por dia.
- Batidas: original, manual, pré-assinalada e desconsiderada.
- Tolerância CLT Art. 58, HE por faixas, noturno, faltas, DSR e banco de horas.
- Parser AFD 1510/671.
- Testes: `npm run test:engine`.

API e regras: [ponto-web/src/engine/README.md](ponto-web/src/engine/README.md).

## Repositórios

- **Sistema de pontos:** https://github.com/machado3-lang/sistema-de-pontos
- **Controle de acessos:** https://github.com/machado3-lang/controle-de-acessos

## Documentação

- [DOCUMENTACAO.md](DOCUMENTACAO.md) — visão funcional, API, banco, formato AFD, segurança e motor.
- [CONTINUIDADE.md](CONTINUIDADE.md) — estado atual, pendências e checklist para retomada.
- [MIGRACAO_RAILWAY.md](MIGRACAO_RAILWAY.md) — plano de migração para Railway + PostgreSQL.
- [ponto-web/src/engine/README.md](ponto-web/src/engine/README.md) — referência do motor.

## Status atual

- ✅ Segurança P0 aplicada
- ✅ Motor de cálculo unificado
- ✅ 34 testes do motor passando
- ✅ Build passando
- 🚧 UI para escala mensal, jornada por exceção e faixas avançadas de HE
- 🚧 Multiempresa/tenant, aprovações e geolocalização
- 🚧 Migração para Railway + PostgreSQL planejada (schema e runner prontos em `ponto-cloud/db`)

Consulte [CONTINUIDADE.md](CONTINUIDADE.md) para o roadmap completo.

---

*Sistema em evolução. Para retomar o desenvolvimento, comece por `CONTINUIDADE.md`.*
