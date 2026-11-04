# MultiPonto — Sistema de Gestão de Ponto Eletrônico

## Visão Geral

Sistema completo para gestão de ponto eletrônico, compatível com as **Portarias 1510 (PIS)** e **671 (CPF)** do MTP. Permite cadastro de empresas, funcionários, horários, REPs (Relógios Eletrônicos de Ponto), importação e apuração de batidas, e sincronização bidirecional com equipamentos iDClass/iDFace.

**Arquitetura:** Frontend React + Vite (`ponto-web`) | Backend Node.js + Express (`ponto-cloud`) | Banco: PostgreSQL (Railway) + JSON local (REPs/push) + cache no navegador (opcional).

---

## Estrutura do Projeto

```
Pontos/
├── .env.example               # Template de variáveis de ambiente
├── docker-compose.yml         # Orquestração Docker (ponto-cloud + ponto-web)
├── deploy.sh                  # Deploy automatizado via Docker
├── deploy-vercel-render.sh    # Deploy Vercel (web) + Render (cloud)
│
├── ponto-cloud/               # BACKEND — Serviço de nuvem para REPs
│   ├── server.js              # Servidor Express com todas as rotas
│   ├── package.json           # Dependências: express, cors, uuid
│   ├── data/
│   │   └── database.json      # Banco de dados JSON (REPs, usuários, marcações)
│   └── Dockerfile             # Imagem Node 20 Alpine
│
└── ponto-web/                 # FRONTEND — SPA React + Vite
    ├── index.html             # Entrypoint HTML
    ├── vite.config.js         # Config Vite (proxy /api → :3100)
    ├── nginx.conf             # Config Nginx para Docker
    ├── package.json           # Dependências: react, lucide-react
    ├── Dockerfile             # Multi-stage: build Node + Nginx
    ├── src/
    │   ├── main.jsx           # Bootstrap React
    │   ├── App.jsx            # Componente raiz (auth, layout, rotas)
    │   ├── App.css            # Estilos legados (pouco usados)
    │   ├── index.css          # Design system completo (dark mode, glassmorphism)
    │   ├── LoginScreen.jsx    # Tela de login (via API do PontoCloud)
    │   ├── api.js             # Cliente HTTP (sessão Bearer)
    │   ├── PontoEngine.js     # Compatibilidade: reexporta o motor unificado
    │   ├── engine/            # Motor de cálculo unificado (fonte única)
    │   │   ├── time.js        # Datas, minutos, feriados e janela noturna
    │   │   ├── schedule.js    # Jornada prevista por dia
    │   │   ├── punch.js       # Batidas e emparelhamento
    │   │   ├── tolerance.js   # CLT Art. 58 / simples / sem tolerância
    │   │   ├── night.js       # Adicional noturno e hora reduzida
    │   │   ├── overtime.js    # Faixas de horas extras
    │   │   ├── absence.js     # Faltas e atrasos
    │   │   ├── dsr.js         # DSR
    │   │   ├── bank.js        # Banco de horas
    │   │   ├── calculator.js  # Orquestração dia/período
    │   │   ├── afd.js         # Parser AFD 1510/671
    │   │   └── index.js       # Exportações
    │   ├── ApuracaoTab.jsx    # Aba de apuração de ponto
    │   ├── CadastrosTab.jsx   # Aba de cadastro (orquestrador)
    │   ├── cadastros/
    │   │   ├── CadastrosUtils.js      # Utilitários (formatadores, validadores CPF/CNPJ)
    │   │   ├── EmpresaSection.jsx     # CRUD de empresas
    │   │   ├── HorarioSection.jsx     # CRUD de horários (fixa, escala, noturno, eventual)
    │   │   ├── FuncionarioForm.jsx    # Formulário de funcionário
    │   │   ├── FuncionarioLista.jsx   # Listagem de funcionários
    │   │   ├── AuxiliaresSection.jsx  # CRUD de departamentos, cargos, parâmetros
    │   │   └── EquipamentoSection.jsx # CRUD de REPs + conexão/sincronização
    │   └── components/
    │       └── ConfirmModal.jsx       # Modal de confirmação reutilizável
    │   └── assets/            # Imagens, ícones
    ├── public/                # Arquivos estáticos
    └── dist/                  # Build de produção (gerado)
```

---

## BACKEND — ponto-cloud

### Tecnologias
- **Node.js 20+** com ES Modules (`"type": "module"`)
- **Express 4.21** — servidor HTTP
- **PostgreSQL (Railway)** via `pg`
- **Autenticação própria**: sessão opaca na tabela `sessoes` + token HMAC no mobile
- **JSON local** (`data/database.json`) apenas para REPs/push (legado)

### Inicialização
```bash
cd ponto-cloud
npm install
npm run migrate      # aplica db/migrations no PostgreSQL
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
npm run dev          # porta 3100
```

### Variáveis de Ambiente
- `PORT` — porta do servidor (padrão: `3100`)
- `DATABASE_URL` — conexão PostgreSQL (Railway)
- `PGSSL` / `PG_POOL_MAX` — SSL e tamanho do pool
- `SESSION_TTL_HOURS` — validade da sessão web (padrão: 8h)
- `API_TOKEN` — token das rotas `/api/reps/*` e `/api/push/*`
- `ADMIN_USER` / `ADMIN_PASSWORD` — login admin legado (`/api/admin/login`)
- `MOBILE_TOKEN_SECRET` — assinatura dos tokens mobile
- `CORS_ORIGINS` — origens permitidas

### Endpoints PostgreSQL (novos)

#### Saúde
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check + status do banco (`ok`, `not_configured`, `error`) |

#### Autenticação web
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | E-mail + senha → token de sessão |
| GET | `/api/auth/me` | Usuário/empresa da sessão |
| POST | `/api/auth/logout` | Revoga a sessão |
| POST | `/api/auth/change-password` | Troca a senha (revoga outras sessões) |

#### CRUD (Bearer de sessão)
`GET/POST/PUT/DELETE` em:

`/api/funcionarios`, `/api/empresas`, `/api/departamentos`, `/api/cargos`,
`/api/horarios`, `/api/parametros`, `/api/equipamentos`, `/api/feriados`,
`/api/correcoes`, `/api/dias-descartados`, `/api/marcacoes-descartadas`,
`/api/banco-horas/ajustes`.

Marcações: `GET /api/marcacoes`, `POST /api/marcacoes`, `POST /api/marcacoes/import`.

Histórico de horários: `GET/PUT /api/funcionarios/:id/hist-horarios`.

#### Usuários (somente `admin`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/usuarios` | Lista usuários da conta |
| POST | `/api/usuarios` | Cria usuário (`admin`, `gestor`, `consulta`) |
| PUT | `/api/usuarios/:id` | Nome, perfil e ativo |
| POST | `/api/usuarios/:id/reset-password` | Nova senha + revoga sessões |
| POST | `/api/usuarios/:id/revoke-sessions` | Encerra sessões |
| DELETE | `/api/usuarios/:id` | Desativa + revoga sessões |

#### Permissões
- `admin`: leitura + escrita + usuários.
- `gestor`: leitura + escrita (sem usuários).
- `consulta`: apenas leitura; `POST/PUT/DELETE` retornam **403**.

Toda mutação grava em `auditoria` (usuário, ação, entidade, id, detalhes).

#### Fechamento de período
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/periodos` | Lista fechamentos (abertos e reabertos) |
| GET | `/api/periodos/status?data=YYYY-MM-DD` | Informa se a data está em período fechado |
| POST | `/api/periodos/fechar` | Fecha `{ data_inicio, data_fim }` (admin/gestor) |
| POST | `/api/periodos/:id/reabrir` | Reabre com `{ motivo }` (somente admin) |

Período fechado bloqueia `POST/PUT/DELETE` em marcações, correções, dias
descartados, marcações descartadas e ajustes de banco (HTTP **409**).

#### Mobile
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/mobile/login` | CPF + senha → token mobile |
| POST | `/api/mobile/marcar` | Marcação com hora do servidor |
| GET | `/api/mobile/marcacoes` | Marcações do dia |

#### Admin legado (API token)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/admin/login` | `ADMIN_USER` + `ADMIN_PASSWORD` → `API_TOKEN` |

#### REPs (Relógios Eletrônicos de Ponto)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/reps` | Lista todos REPs |
| POST | `/api/reps` | Cria novo REP |
| GET | `/api/reps/:id` | Detalhes do REP |
| PUT | `/api/reps/:id` | Atualiza REP |
| DELETE | `/api/reps/:id` | Remove REP + dados vinculados |
| GET | `/api/reps/:id/status` | Status do REP (total marcações, usuários) |

#### Marcações (batidas de ponto)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/reps/:id/markings/sync` | Sincroniza marcações (dedup por NSR+PIS+data+hora) |
| GET | `/api/reps/:id/markings` | Lista marcações (com filtro data_inicio, data_fim, offset, limit) |

#### Usuários (funcionários no REP)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/reps/:id/users/sync` | Sincroniza funcionários (dedup por CPF) |
| GET | `/api/reps/:id/users` | Lista funcionários do REP |

#### Proxy REP (comunicação direta com equipamento iDClass/iDFace)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/reps/proxy/command` | Comando genérico no REP (login automático) |
| POST | `/api/reps/proxy/users/load` | Carrega usuários do REP (por PIS ou CPF) |
| POST | `/api/reps/proxy/users/add` | Adiciona usuários no REP |
| POST | `/api/reps/proxy/users/update` | Atualiza usuários no REP |
| POST | `/api/reps/proxy/users/remove` | Remove usuários do REP |
| POST | `/api/reps/proxy/markings/load` | Carrega marcações do REP (com data) |
| POST | `/api/reps/proxy/markings/load_all` | Carrega TODAS as marcações (paginação automática) |
| GET | `/api/reps/proxy/afd/download` | Baixa arquivo AFD do REP |
| GET | `/api/reps/proxy/info` | Informações do REP (serial, firmware, usuários, tickets) |

### Autenticação
Todas as rotas `/api/reps/*` exigem header:
```
Authorization: Bearer <API_TOKEN>
```
A rota `/api/health` é pública. A rota `/api/auth/login` também é pública.

### Proxy REP — Protocolo
O backend atua como **proxy reverso** para equipamentos REP (iDClass, iDFace). A comunicação usa o protocolo **FCGI** (`.fcgi`) via HTTP ou HTTPS. O proxy tenta primeiro HTTPS e faz fallback para HTTP em caso de erros de TLS.

Comandos implementados: `login`, `get_about`, `get_info`, `get_system_information`, `load_users`, `add_users`, `update_users`, `remove_users`, `get_markings`, `get_afd`.

---

## FRONTEND — ponto-web

### Tecnologias
- **React 19** — biblioteca de UI
- **Vite 8** — bundler e dev server
- **API do PontoCloud** — autenticação e dados (via `src/api.js`)
- **lucide-react** — ícones

### Inicialização
```bash
cd ponto-web
npm install
npm run dev      # Dev server → http://localhost:5173 (proxy /api → :3100)
npm run build    # Build produção → dist/
npm run preview  # Preview do build
npm run lint     # ESLint
```

### Funcionalidades por Aba

#### Dashboard (Importação AFD)
- Upload de arquivo AFD (`.txt`, `.afd`)
- Parse automático (Portaria 671 e 1510)
- Motor de cálculo roda **100% no navegador** (PontoEngine.js)
- Cruzamento com funcionários cadastrados (por CPF/PIS)
- Estatísticas: funcionários ativos, batidas processadas, inconsistências

#### Cadastros
- **Funcionários**: CRUD completo com validação de CPF, PIS, matrícula, empresa, departamento, cargo, horário, parâmetros
- **Empresas**: CRUD com CNPJ/CPF, endereço, responsável
- **Horários**: 4 tipos de jornada:
  - **Fixa** (dias da semana com períodos)
  - **Escala Flexível** (ciclo de N dias)
  - **Turno Noturno** (com adicional noturno e hora reduzida)
  - **Eventual** (jornada avulsa)
  - Compensação semanal, períodos flexíveis/fixos
- **Departamentos, Cargos, Parâmetros**: CRUD simples com contagem de vínculos
- **Equipamentos (REP)**: Cadastro, conexão (IP direto ou iDCloud), teste de conexão, sincronização bidirecional de funcionários, importação de marcações, download de AFD

#### Apuração de Ponto
- Lista de exceções (batidas ímpares, hora extra elevada >2h)
- Dia a dia com linha do tempo de batidas
- Saldo, horas trabalhadas vs previstas (base 8h)
- Ações: incluir batida manual, justificativa, aplicar correção, desconsiderar dia
- Filtros por período e colaborador

#### Relatórios (esboço)
- Área reservada para geração de espelho de ponto PDF e exportação AFD/AFDT

### Autenticação
- Login via **API do PontoCloud** (e-mail/senha; sessão Bearer em `sessoes`)
- Sessão persistente com token em `localStorage` e validação em `/api/auth/me`
- Tela de login com design institucional

### Motor de Cálculo (PontoEngine.js)
Funções principais:
- `parseAFD(conteudo)`: lê arquivo AFD, extrai batidas tipo '3', separa por funcionário (CPF ou PIS), retorna dados processados
- `processarCalculos(batidasPorFuncionario)`: agrupa por dia, ordena, calcula pares entrada/saída, detecta batidas ímpares
- `parseMinutosToHHMM(minutos)`: formata minutos para HH:MM (suporta negativo)

### Persistência de dados (Fase 5)

O **PostgreSQL é a fonte de verdade**. O navegador mantém apenas um **cache
síncrono** (chaves `ponto_*`) para pintar a tela antes da rede responder e para
alimentar o motor de cálculo, que lê horários/parâmetros de forma síncrona.

- Horários, parâmetros, departamentos, cargos, equipamentos, correções,
  descartes e histórico de horários: `/api/*` → PostgreSQL.
- Marcações: `/api/marcacoes` (importação via `/api/marcacoes/import`).
- Dados legados no navegador são importados **uma única vez** quando o banco
  está vazio (`src/data/pontoData.js`).
- A única chave obrigatória no navegador é `ponto_token` (sessão).

### Variáveis de Ambiente
- `VITE_PONTOCLOUD_URL` — URL do backend (vazio usa `/api` via proxy)

---

## INFRAESTRUTURA

### Docker Compose
```bash
docker compose up -d    # Sobe ponto-cloud (:3100) + ponto-web (:80)
docker compose down     # Para tudo
docker compose logs -f  # Logs em tempo real
```

Serviços:
- `ponto-cloud`: Node 20, volume persistente `ponto-cloud-data` em `/app/data`
- `ponto-web`: Nginx servindo build React, proxy `/api/` → `ponto-cloud:3100`

### Deploy Manual
```bash
./deploy.sh             # Build + Docker Compose
```

### Deploy Vercel + Render
```bash
./deploy-vercel-render.sh  # Frontend na Vercel, Backend no Render
```
Configuração manual no Render: root dir = `ponto-cloud`, start = `npm start`, health = `/api/health`

---

## BANCO DE DADOS

### PostgreSQL (tabelas principais)
Schema: `ponto-cloud/db/migrations/001_init.sql`.

- `empresas`, `usuarios`, `sessoes`
- `funcionarios`, `departamentos`, `cargos`
- `horarios` (`config jsonb`), `parametros` (`config jsonb`)
- `equipamentos`
- `marcacoes`, `correcoes`, `dias_descartados`, `marcacoes_descartadas`, `banco_horas_ajustes`
- `feriados`, `auditoria`, `schema_migrations`

### JSON local (ponto-cloud/data/database.json — legado REP/push)
Estrutura:
```json
{
  "reps": { "<uuid>": { id, nome, modelo, num_serie, localizacao, ativo, criado_em, ultima_sync, status } },
  "users": { "<rep_id>": [ { cpf, nome, ... } ] },
  "markings": { "<rep_id>": [ { nsr, cpf/pis, data, hora } ] }
}
```

---

## FORMATO AFD

### Registro tipo '3' — Batida

**Portaria 1510 (PIS)** — 34 caracteres:
```
[0-8]   NSR (9 dígitos)
[9]     Tipo = '3'
[10-11] Dia (DD)
[12-13] Mês (MM)
[14-17] Ano (YYYY)
[18-19] Hora (HH)
[20-21] Minuto (MM)
[22-33] PIS (12 dígitos, com zero à esquerda)
```

**Portaria 671 (CPF)** — 45+ caracteres:
```
[0-8]   NSR (9 dígitos)
[9]     Tipo = '3'
[10-28] DataHora ISO (YYYY-MM-DDTHH:MM:SS)
[34-44] CPF (11 dígitos)
```

### Detecção automática
Se o caractere `[14]` for `'-'` → formato ISO → Portaria 671 (CPF)
Caso contrário → formato clássico → Portaria 1510 (PIS)

---

## COMUNICAÇÃO COM REP

O proxy do backend segue este fluxo:
1. **Login**: POST para `login.fcgi` com `{ login, password }` → recebe `session`
2. **Comandos**: usa `session` nas chamadas seguintes
3. Fallback automático HTTPS → HTTP se houver erros de TLS

### Modelos suportados (iD Tecnologia)
- iDClass
- iDClass Mult
- iDClass Bio Prox
- iDFace
- iDFace Max

---

## SEGURANÇA E DEPLOY (ATUALIZADO)

As credenciais **não ficam mais fixas no código**. Configure no `.env` (raiz) antes de subir:

| Variável | Onde | Obrigatória em produção | Observação |
|---|---|---|---|
| `DATABASE_URL` | backend | Sim | PostgreSQL (Railway injeta) |
| `PGSSL` / `PG_POOL_MAX` | backend | Opcional | SSL e tamanho do pool |
| `SESSION_TTL_HOURS` | backend | Opcional | Validade da sessão web (padrão 8h) |
| `API_TOKEN` | backend | Sim | Token das rotas `/api/reps/*` e `/api/push/*`; sem ele o backend não inicia em produção |
| `ADMIN_USER` / `ADMIN_PASSWORD` | backend | Recomendado | Login admin legado em `/api/admin/login` |
| `MOBILE_TOKEN_SECRET` | backend | Recomendado | Assina os tokens mobile; se ausente, muda a cada reinício |
| `CORS_ORIGINS` | backend | Sim | Lista de origens permitidas, separadas por vírgula |
| `VITE_PONTOCLOUD_URL` | build do frontend | Opcional | Vazio usa `/api` via proxy |

Gere os segredos com:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Migration obrigatória

Execute `npm run migrate` em `ponto-cloud` (ou deixe o `preDeployCommand` do Railway rodar). O schema está em `ponto-cloud/db/migrations/001_init.sql` e cria empresas, usuários, sessões, funcionários, horários, parâmetros, marcações, correções, banco de horas, feriados e auditoria.

O `ponto-cloud/migration_supabase.sql` é **legado**, apenas para exportar dados antigos do Supabase.

### App mobile

- O login é validado **no backend** (`POST /api/mobile/login`) contra o PostgreSQL.
- A senha é gravada como hash **scrypt**; hashes PBKDF2/scrypt antigos continuam aceitos.
- A marcação (`POST /api/mobile/marcar`) usa a **hora do servidor** (America/Sao_Paulo) e um token HMAC de 8 horas.

### Pontos de atenção

- Sirva o sistema em **HTTPS**. Em HTTP de rede local o fallback PBKDF2 em JS mantém o cadastro funcionando, mas o tráfego (incluindo a senha do login mobile) não é criptografado.
- Os endpoints de **push** (`/push`, `/event`) continuam públicos para receber dados dos equipamentos; proteja-os por rede/firewall ou evolua para um token por dispositivo.
- As políticas RLS atuais liberam dados para qualquer usuário autenticado. Para multiempresa, evolua para políticas por `empresa_id`/claim.

---

## MOTOR DE CÁLCULO UNIFICADO

A partir desta versão existe **uma única implementação de cálculo** em `ponto-web/src/engine/`. Dashboard, Apuração, Relatórios e exportações consomem o mesmo motor.

### Módulos

| Módulo | Responsabilidade |
|---|---|
| `time.js` | minutos ↔ HH:MM, datas, dias da semana, feriados, janela noturna |
| `constants.js` | parâmetros padrão e merge profundo |
| `schedule.js` | jornada prevista: Fixa, Escala Flexível, Escala Mensal, Turno Noturno, Eventual, jornada por exceção |
| `punch.js` | normalização e emparelhamento (original, manual, pré-assinalada, desconsiderada) |
| `tolerance.js` | sem tolerância, simples e CLT Art. 58 (5 min/batida, 10 min/dia) |
| `night.js` | adicional noturno, hora reduzida 52:30 e turnos que cruzam a meia-noite |
| `overtime.js` | faixas de HE por tipo de dia, HE diurna/noturna e percentual médio |
| `absence.js` | faltas, atrasos e justificativas |
| `dsr.js` | DSR por média de HE, com feriados e desconto por faltas |
| `bank.js` | banco de horas: crédito, débito, ajuste, piso/teto e controle diário/mensal |
| `calculator.js` | orquestração por dia e por período + memória de cálculo |
| `afd.js` | parser AFD Portaria 1510 (PIS) e 671 (CPF) |

### Regras suportadas hoje

- Tipos de dia: útil, sábado, domingo, feriado e trabalho em folga (100%).
- Jornadas: fixa, cíclica, mensal, noturna, eventual e override por dia.
- Batidas: original, manual, pré-assinalada e desconsiderada; turnos que cruzam a meia-noite com campo de fechamento.
- Tolerâncias: nenhuma, simples (entrada/saída) e CLT Art. 58.
- HE: faixas por tipo de dia, HE normal/noturna e modo avançado por lista de faixas.
- Noturno: janela 22:00–05:00, hora reduzida e adicional configurável.
- Faltas: dia inteiro, parciais, justificadas e “somente dia inteiro”.
- DSR: média de HE por semana/mês, feriados e desconto por faltas.
- Banco de horas: piso/teto, multiplicador, primeira/última faixa, controle diário/mensal.
- Interjornada (11h) e intrajornada (intervalo previsto).
- Memória de cálculo por dia (`memoria`) para auditoria.

### O que foi aproveitado de cada referência

**RHiD (Control iD)**
- Colunas de banco: crédito/débito, ajuste, total, positivo, negativo e saldo.
- Modo simples e avançado de horas extras.
- Jornada por exceção e atribuições em massa (engine pronto; UI parcial).
- Fluxo de aprovação e auditoria (roadmap).

**Secullum Ponto Web**
- Ponto por exceção, compensado, almoço livre e neutro (base pronta).
- Interjornada/intrajornada e tolerâncias do Art. 58.
- Separação de horas normais/noturnas e faixas de HE.
- Escalas cíclicas/mensais.
- Banco de horas com piso/teto, períodos, multiplicador e controle diário/mensal.
- DSR com feriados e desconto por faltas.

**EzPoint Web (RW Tech)**
- Tipos de batida: original, incluído, desconsiderado e pré-assinalado.
- Campo de fechamento para batidas após a meia-noite.
- Compensação no mesmo dia e em dias diferentes (via banco).
- Crédito de folga e horas decimais (engine suporta; UI parcial).
- Multiempresa (modelo de dados ainda single-tenant).

### Ainda no roadmap

- Fluxo de aprovação de apuração (RHiD).
- Geolocalização/anti-spoofing no mobile (EzPoint).
- UI para escala mensal, jornada por exceção e faixas avançadas de HE.
- Multiempresa/tenant com RLS por `empresa_id`.
- Compensação explícita de faltas/extras entre dias (hoje via banco de horas).

### Testes do motor

```bash
cd ponto-web
npm run test:engine
```

Cobrem: dia normal, HE com faixas, tolerância CLT e simples, falta de dia inteiro, feriado, trabalho em folga, noturno, escala cíclica, DSR, banco (piso/teto) e AFD 1510/671.

---

## Observações Finais

- O frontend consome a API do PontoCloud (PostgreSQL) via `src/api.js`
- O backend usa PostgreSQL para auth/CRUD e JSON local apenas para REPs/push
- Toda a apuração de ponto roda **offline** no navegador
- Para desenvolvimento, use `npm run dev` em ambos os projetos simultaneamente
- Para produção, use Docker Compose ou deploy separado (Vercel + Render)
