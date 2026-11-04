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
    │   │   ├── justification.js # Efeito das justificativas no dia
    │   │   ├── inconsistencies.js # Inconsistências configuráveis
    │   │   ├── dsr.js         # DSR
    │   │   ├── bank.js        # Banco de horas
    │   │   ├── calculator.js  # Orquestração dia/período
    │   │   ├── afd.js         # Parser/validador AFD 1510/671
    │   │   └── index.js       # Exportações
    │   ├── ApuracaoTab.jsx    # Aba de apuração de ponto
    │   ├── CadastrosTab.jsx   # Aba de cadastro (orquestrador)
    │   ├── cadastros/
    │   │   ├── CadastrosUtils.js      # Utilitários (formatadores, validadores CPF/CNPJ)
    │   │   ├── EmpresaSection.jsx     # CRUD de empresas
    │   │   ├── HorarioSection.jsx     # CRUD de horários (fixa, escala, noturno, eventual)
    │   │   ├── FuncionarioForm.jsx    # Formulário de funcionário
    │   │   ├── FuncionarioLista.jsx   # Listagem de funcionários
    │   │   ├── FeriadosSection.jsx    # Feriados com aplicações combináveis
    │   │   ├── JustificativaTiposSection.jsx # Tipos de justificativa
    │   │   ├── MotivosCorrecaoSection.jsx    # Motivos de correção (AEJ)
    │   │   ├── InconsistenciasSection.jsx    # Inconsistências da apuração
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
`/api/banco-horas/ajustes`, `/api/justificativa-tipos`, `/api/justificativas`,
`/api/jornada-excecoes`, `/api/motivos-correcao`, `/api/inconsistencia-tipos`.

Marcações: `GET /api/marcacoes`, `POST /api/marcacoes`, `POST /api/marcacoes/import`.

Histórico de horários: `GET/PUT /api/funcionarios/:id/hist-horarios`.

Jornada por exceção (horário eventual do dia):
`GET/POST /api/jornada-excecoes`, `PUT/DELETE /api/jornada-excecoes/:id`,
`DELETE /api/jornada-excecoes?funcionario_id=...&data=...`.

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

#### Auditoria (admin/gestor)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/auditoria` | Lista a trilha (`entidade`, `acao`, `usuario_id`, `data_inicio`, `data_fim`, `limit`, `offset`) |

#### Feriados, justificativas e inconsistências

**Feriados** (`/api/feriados`):

- `nome`, `data`, `tipo` (`nacional`, `estadual`, `municipal`, `empresa`),
  `recorrente` (repete todo ano);
- `uf`, `cidade`, `cidade_ibge`, `alvo_empresa_id`;
- aplicações combináveis em `feriado_aplicacoes`:
  - dimensões diferentes = **E**;
  - valores da mesma dimensão = **OU**;
  - dimensões: empresa, UF, cidade, funcionário, departamento, horário.
- “Feriado como dia normal” fica no cadastro do **horário**
  (`considerar_feriado_dia_normal`), não no feriado.

**Tipos de justificativa** (`/api/justificativa-tipos`):

- `nome`, `abreviacao`, `tipo` (`dia_inteiro`, `periodo`, `horas`, `ajuste`,
  `banco`, `dsr`);
- flags: `abona_falta`, `abona_horas`, `protege_dsr`, `gera_banco`,
  `exige_cid`, `exige_anexo`, `tolerancia_min`, `ativo`.

**Lançamentos de justificativa** (`/api/justificativas`):

- `funcionario_id`, `tipo_id`, `data`, `inicio`, `fim`, `minutos`, `texto`,
  `cid`, `anexo_url`;
- o motor aplica o efeito conforme o tipo (ver seção “Justificativas”).

**Motivos de correção** (`/api/motivos-correcao`):

- catálogo de descrições para o campo `motivo` do AEJ (tipo 05);
- a Apuração permite selecionar do catálogo ou digitar livremente.

**Inconsistências** (`/api/inconsistencia-tipos`):

- `nome`, `campo` (`atraso`, `falta`, `extra`, `banco`, `batida`, `outro`);
- `valor_min`, `prioridade` (1 = mais grave), `icone`, `cor`, `ativo`;
- a Apuração avalia cada dia e usa a inconsistência de menor prioridade como
  status; o filtro “Somente inconsistências” usa o catálogo.

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
- Upload de arquivo AFD (`.txt`, `.afd`), lido como **ISO 8859-1**
- Parse/validação automática (Portarias 1510 e 671)
- Aceita marcação tipo 3 (REP-C/REP-A) e tipo 7 (REP-P)
- Mostra portaria, versão, período, empregador, contagem por tipo, erros e avisos
- Cruzamento com funcionários por CPF/PIS
- Lista documentos sem funcionário cadastrado (com nome do tipo 5)
- Importação idempotente por hash do conteúdo (`afd:<hash>`) e aviso se a
  gravação no servidor falhar

#### Cadastros
- **Funcionários**: CRUD completo com validação de CPF, PIS, matrícula, empresa, departamento, cargo, horário, parâmetros e cidade IBGE
- **Empresas**: CRUD com CNPJ/CPF, endereço, responsável
- **Horários**: 4 tipos de jornada:
  - **Fixa** (dias da semana com períodos)
  - **Escala Flexível** (ciclo de N dias)
  - **Turno Noturno** (com adicional noturno e hora reduzida)
  - **Eventual** (jornada avulsa, usada na “Jornada do dia”)
  - Compensação semanal, períodos flexíveis/fixos
- **Feriados**: nacional/estadual/municipal/empresa, recorrente, cidade IBGE e aplicações combináveis
- **Justificativas**: tipos com efeito (dia inteiro, período, horas, ajuste, banco, DSR)
- **Motivos**: catálogo para o motivo da correção no AEJ
- **Inconsistências**: limites, prioridade, cor e ativo
- **Departamentos, Cargos, Parâmetros**: CRUD simples com contagem de vínculos
- **Equipamentos (REP)**: Cadastro, conexão (IP direto ou iDCloud), teste de conexão, sincronização bidirecional de funcionários, importação de marcações, download de AFD

#### Apuração de Ponto
- Grade **funcionário × dia** com colunas de batidas, previsto, trabalhado,
  normais, noturno, atraso, extra, DSR, banco, status e justificativa
- Painel de tratamento do dia com linha do tempo das batidas
- Ações: incluir batida manual, motivo da correção, aplicar correção,
  desconsiderar dia, restaurar dia
- **Jornada do dia** lista apenas horários do tipo `Eventual`
- **Justificativas** com campos condicionais (período, minutos, CID, anexo)
- **Inconsistências configuráveis** no status e no filtro
- Fechamento/reabertura de período com trava de escrita
- Filtros por período e colaborador

#### Relatórios
- Espelho de ponto com colunas configuráveis
- Exportação AFD, AFDT, ACJEF e AEJ
- AEJ com motivo no tipo 05 e ausências/banco no tipo 07

### Autenticação
- Login via **API do PontoCloud** (e-mail/senha; sessão Bearer em `sessoes`)
- Sessão persistente com token em `localStorage` e validação em `/api/auth/me`
- Tela de login com design institucional

### Motor de Cálculo (engine/)

A implementação real fica em `ponto-web/src/engine/`; `PontoEngine.js` apenas
reexporta a API antiga. Funções principais:

- `parseAFD(conteudo)` / `parseAFDLinhas(conteudo)`: lê AFD 1510/671 (tipos 3 e 7);
- `validarAFD(conteudo)`: erros, avisos e resumo do arquivo;
- `calcularDia(entrada)`: cálculo de um dia com batidas, tolerância, HE,
  noturno, faltas, DSR, banco e justificativas;
- `calcularPeriodo(entrada)`: período completo de um funcionário;
- `aplicarJustificativas(...)`: efeito dos 6 tipos de justificativa;
- `avaliarInconsistencias(linha, tipos)`: inconsistências configuráveis;
- `formatMinutes(minutos)` (reexportado como `parseMinutosToHHMM`): formata
  minutos para HH:MM.

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

Schema base: `ponto-cloud/db/migrations/001_init.sql`. Migrations aplicadas em
ordem por `npm run migrate`:

| Migration | Conteúdo |
|---|---|
| `001_init.sql` | empresas, usuários, sessões, funcionários, horários, parâmetros, marcações, correções, descartes, banco, feriados, auditoria |
| `002_hist_horarios.sql` | histórico de horários do funcionário |
| `003_equipamentos_campos.sql` | campos extras de equipamentos |
| `004_empresas_tenant.sql` | `tenant_id` nas empresas |
| `005_empresas_tenant_backfill.sql` | backfill do tenant |
| `006_push_persistencia.sql` | devices, events e results do push |
| `007_periodos_fechados.sql` | fechamento/reabertura de período |
| `008_feriados_recorrente.sql` | feriados recorrentes |
| `009_feriados_justificativas.sql` | cidade/UF, justificativa_tipos e justificativas |
| `010_feriado_aplicacoes.sql` | aplicações combináveis de feriado |
| `011_jornada_excecoes.sql` | jornada eventual por dia |
| `012_motivos_correcao.sql` | catálogo de motivos + motivo em marcações descartadas |
| `013_inconsistencias.sql` | tipos de inconsistência configuráveis |

Tabelas: `empresas`, `usuarios`, `sessoes`, `funcionarios`, `departamentos`,
`cargos`, `horarios`, `parametros`, `equipamentos`, `marcacoes`, `correcoes`,
`dias_descartados`, `marcacoes_descartadas`, `banco_horas_ajustes`, `feriados`,
`feriado_aplicacoes`, `justificativa_tipos`, `justificativas`,
`jornada_excecoes`, `motivos_correcao`, `inconsistencia_tipos`, `periodos_fechados`,
`auditoria`, `schema_migrations`.

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

## FORMATO AFD (Portarias 1510 e 671)

O AFD é o arquivo **fonte** de dados: contém as marcações originais do REP.
Ele não tem campo de motivo de correção — correções e seus motivos pertencem ao
**AEJ**.

### Registro tipo 3 — Marcação de REP-C/REP-A

**Portaria 1510 (PIS)** — 34 caracteres:

```
[0-8]   NSR (9 dígitos)
[9]     Tipo = '3'
[10-17] Data (ddmmaaaa)
[18-21] Hora (hhmm)
[22-33] PIS (12 dígitos, com zero à esquerda)
```

**Portaria 671 (CPF)** — 50 caracteres (com CRC):

```
[0-8]   NSR (9 dígitos)
[9]     Tipo = '3'
[10-33] Data/hora (AAAA-MM-DDThh:mm:00-0300)
[34-45] CPF (12 posições)
[46-49] CRC-16
```

### Registro tipo 7 — Marcação de REP-P

```
[0-8]   NSR
[9]     Tipo = '7'
[10-33] Data/hora da marcação
[34-45] CPF
[46-69] Data/hora de gravação
[70-71] Coletor (01 mobile, 02 browser, 03 desktop, 04 dispositivo, 05 outro)
[72]    On-line (0) / off-line (1)
[73-136] Hash SHA-256
```

### Outros registros

- **Tipo 1** — cabeçalho (empregador, período, versão e dados do REP);
- **Tipo 5** — inclusão/alteração/exclusão de empregado (PIS/CPF e nome);
- **Tipo 6** — eventos sensíveis do REP (671);
- **Tipo 9** — trailer.

### Detecção automática

- tipo 3 com `[14] === '-'` → Portaria 671 (CPF);
- tipo 3 sem `'-'` → Portaria 1510 (PIS);
- tipo 7 → Portaria 671 (REP-P).

### Trailer (tipo 9)

Nos AFDs 1510 e 671 o tipo `9` fica na **última posição** do registro, depois
dos contadores:

- 1510: `999999999` + 4 contadores (2, 3, 4, 5) + `9` = 46 caracteres;
- 671: `999999999` + 6 contadores (2, 3, 4, 5, 6, 7) + `9` = 64 caracteres.

O parser reconhece os dois formatos e valida a quantidade de marcações contra
o trailer.

### Validação (`validarAFD`)

Retorna:

- `ok`, `erros`, `avisos`;
- resumo: portaria, versão, empregador, período, marcações (tipo 3 e 7),
  funcionários cadastrados no REP e eventos.

A importação no Dashboard mostra esse resumo antes de gravar.

---

## FORMATO AEJ (Portaria 671)

O AEJ é o arquivo de jornada, com registros delimitados por `|`:

| Tipo | Conteúdo |
|---|---|
| `01` | cabeçalho (empregador, período, geração, versão `001`) |
| `02` | REPs utilizados |
| `03` | vínculos (CPF + nome) |
| `04` | horário contratual |
| `05` | marcações |
| `06` | matrícula eSocial (quando houver mais de um vínculo) |
| `07` | ausências e banco de horas |
| `08` | identificação do PTRP |
| `99` | trailer com contadores |

No **tipo 05**, o campo `motivo` é obrigatório quando:

- `tpMarc = D` (marcação desconsiderada); ou
- `fonteMarc = I` (marcação incluída manualmente).

O sistema preenche esse motivo a partir do catálogo `motivos_correcao` ou do
texto livre informado na Apuração.

No **tipo 07**:

- tipo 1: DSR;
- tipo 2: falta não justificada (quando o débito cobre a jornada);
- tipo 3: movimento de banco, com `qtMinutos` e `tipoMovBH`
  (`1` inclusão, `2` compensação).

### Pendências do AEJ

- identificador real do REP no registro tipo 02 (hoje placeholder);
- assinatura digital P7S;
- hash/validação formal do arquivo.

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

Execute `npm run migrate` em `ponto-cloud`. O runner aplica, em ordem, todas as
migrations pendentes de `ponto-cloud/db/migrations` (001 a 013). Não dependa do
`preDeployCommand` do Railway: ele não está executando de forma confiável.

O `ponto-cloud/migration_supabase.sql` é **legado**, apenas para exportar dados
antigos do Supabase.

### App mobile

- O login é validado **no backend** (`POST /api/mobile/login`) contra o PostgreSQL.
- A senha é gravada como hash **scrypt**; hashes PBKDF2/scrypt antigos continuam aceitos.
- A marcação (`POST /api/mobile/marcar`) usa a **hora do servidor** (America/Sao_Paulo) e um token HMAC de 8 horas.

### Pontos de atenção

- Sirva o sistema em **HTTPS**. Em HTTP de rede local o fallback PBKDF2 em JS mantém o cadastro funcionando, mas o tráfego (incluindo a senha do login mobile) não é criptografado.
- Os endpoints de **push** (`/push`, `/event`) continuam públicos para receber dados dos equipamentos; proteja-os por rede/firewall ou evolua para um token por dispositivo.
- O isolamento por empresa é feito no backend (`empresa_id`/tenant) e nas rotas; não há RLS no PostgreSQL. Para defesa em profundidade, avalie RLS por `empresa_id`.

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
| `justification.js` | efeito dos 6 tipos de justificativa no dia |
| `inconsistencies.js` | inconsistências configuráveis (atraso, falta, extra, banco, batida) |
| `dsr.js` | DSR por média de HE, com feriados e desconto por faltas |
| `bank.js` | banco de horas: crédito, débito, ajuste, piso/teto e controle diário/mensal |
| `calculator.js` | orquestração por dia e por período + memória de cálculo |
| `afd.js` | parser/validador AFD Portaria 1510 (PIS) e 671 (CPF), tipos 3 e 7 |

### Regras suportadas hoje

- Tipos de dia: útil, sábado, domingo, feriado e trabalho em folga (100%).
- Jornadas: fixa, cíclica, mensal, noturna, eventual e override por dia.
- Batidas: original, manual, pré-assinalada e desconsiderada; turnos que cruzam a meia-noite com campo de fechamento.
- Tolerâncias: nenhuma, simples (entrada/saída) e CLT Art. 58.
- HE: faixas por tipo de dia, HE normal/noturna e modo avançado por lista de faixas.
- Noturno: janela 22:00–05:00, hora reduzida e adicional configurável.
- Faltas: dia inteiro, parciais, justificadas e “somente dia inteiro”.
- Justificativas: dia inteiro, período, horas, ajuste, banco e DSR, com CID/anexo.
- Feriados: nacional/estadual/municipal/empresa, recorrente, cidade IBGE e
  aplicações combináveis.
- DSR: média de HE por semana/mês, feriados e desconto por faltas; justificativa
  com `protege_dsr` não desconta o DSR.
- Banco de horas: piso/teto, multiplicador, primeira/última faixa, controle
  diário/mensal e relocação por justificativa.
- Inconsistências: limites configuráveis, prioridade e cor.
- Fechamento de período: bloqueio de escrita e reabertura auditada.
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
- UI completa para escala mensal e faixas avançadas de HE.
- Edição inline da batida na grade.
- Relatório de justificativas e ocorrências.
- AEJ: identificador real do REP (tipo 02) e assinatura P7S.
- Integração com folha/eSocial.
- Backup, observabilidade e CI/CD.

### Testes do motor

```bash
cd ponto-web
npm run test:engine
```

Cobrem: dia normal, HE com faixas, tolerância CLT e simples, falta de dia
inteiro, feriado, trabalho em folga, noturno, escala cíclica, DSR, banco
(piso/teto), justificativas (6 tipos), proteção de DSR, inconsistências
configuráveis e AFD 1510/671 (tipo 3, tipo 7, cabeçalho, empregado e trailer).
São 61 checks.

---

## Observações Finais

- O frontend consome a API do PontoCloud (PostgreSQL) via `src/api.js`.
- O PostgreSQL é a fonte de verdade; o navegador guarda apenas cache e o token.
- O cálculo roda no navegador (motor unificado), mas os dados vêm da API.
- Para desenvolvimento, use `npm run dev` em ambos os projetos simultaneamente.
- Em produção, o deploy recomendado é o serviço único do Railway: o Dockerfile
  da raiz builda o frontend e o backend serve o `dist`.
- Migrations novas exigem `npm run migrate` manual no Railway (o
  `preDeployCommand` não está confiável).
- Credenciais expostas em chat de teste devem ser rotacionadas antes de produção.
