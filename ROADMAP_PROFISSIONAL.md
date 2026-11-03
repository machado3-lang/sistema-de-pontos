# Roadmap Profissional — MultiPonto

Análise de lacunas e plano para levar o sistema ao nível de **RHiD (Control iD)**, **Secullum Ponto Web** e **EzPoint Web (RW Tech)**.

Data: 03/11/2026

---

## 1. Onde estamos hoje

**Já funciona em produção (Railway + PostgreSQL):**

- Login próprio (e-mail/senha, sessão Bearer)
- Cadastro de funcionários/empresas via API
- Motor de cálculo unificado (jornada, HE, noturno, faltas, DSR, banco, tolerância CLT)
- Apuração e relatórios consumindo o mesmo motor
- Exportação AFD, ADFT, ACJEF e AEJ (frontend)
- Integração com REPs (proxy FCGI, push, iDFace)
- Mobile de marcação via backend
- Deploy single-service (backend serve o frontend)

**Ainda frágil para nível profissional:**

- Grande parte dos cadastros auxiliares e da apuração vive em `localStorage`
- Sem papéis/permissões efetivos, sem auditoria e sem multiempresa na UI
- REPs ainda em JSON; push em memória; credenciais de equipamento em texto puro
- Arquivos fiscais gerados, mas sem validação/assinatura/hash formal
- Sem integração com folha/eSocial
- Sem portal do funcionário, aprovações, geolocalização/anti-spoofing
- Sem testes de backend, CI/CD, backup automatizado e monitoramento

---

## 2. Comparativo com os três sistemas

| Capacidade | MultiPonto hoje | RHiD | Secullum | EzPoint |
|---|---|---|---|---|
| Motor de cálculo completo | ✅ bom | ✅ | ✅ | ✅ |
| Banco de horas (piso/teto/período) | ⚠️ motor sim, UI não | ✅ | ✅ | ✅ |
| DSR | ⚠️ motor sim, UI não | ✅ | ✅ | ✅ |
| Escalas cíclicas/mensais | ⚠️ motor sim, UI parcial | ✅ | ✅ | ✅ |
| Jornada por exceção | ⚠️ motor sim, UI não | ✅ | ✅ | ✅ |
| Feriados personalizados | ⚠️ motor sim, UI não | ✅ | ✅ | ✅ |
| Tolerância Art. 58 / Art. 71 | ✅ motor | ✅ | ✅ | ✅ |
| Tipos de batida (manual/pré/descartada) | ✅ | ✅ | ✅ | ✅ |
| Fechamento de período/turno | ❌ | ✅ | ✅ | ✅ |
| Fluxo de aprovação | ❌ | ✅ | ✅ | ✅ |
| Portal do funcionário | ❌ | ✅ | ✅ | ✅ |
| App mobile com geolocalização/anti-spoofing | ⚠️ marcação web | ✅ | ✅ | ✅ |
| Multiempresa / multiusuário | ⚠️ backend sim, UI não | ✅ | ✅ | ✅ |
| Papéis e permissões | ⚠️ campo role sem enforcement | ✅ | ✅ | ✅ |
| Auditoria de alterações | ⚠️ tabela criada, sem uso | ✅ | ✅ | ✅ |
| Relatórios customizáveis/exportação | ⚠️ básico | ✅ | ✅ | ✅ |
| Arquivos fiscais 671/1510 | ⚠️ gerados, sem validação formal | ✅ | ✅ | ✅ |
| Integração folha/eSocial | ❌ | ✅ | ✅ | ✅ |
| Integração REP nativa | ✅ | ✅ | ✅ | ✅ |
| Backup/PITR | ❌ | ✅ | ✅ | ✅ |
| Monitoramento/alertas | ❌ | ✅ | ✅ | ✅ |
| Testes automatizados/CI | ⚠️ motor + smoke | ✅ | ✅ | ✅ |

---

## 3. Lacunas por dimensão

### 3.1 Dados e persistência (P0)

**Problema:** ainda há dados de negócio no `localStorage`:

`ponto_func_extras`, `ponto_horarios`, `ponto_parametros_list`, `ponto_departamentos`, `ponto_cargos`, `ponto_correcoes`, `ponto_dias_descartados`, `ponto_marcacoes_descartadas`, `ponto_equipamentos`, `ponto_hist_horarios`, `ponto_motivos_demissao`.

**Risco:** dados por navegador, sem backup, sem multiusuário, sem auditoria.

**Ação:** migrar tudo para PostgreSQL usando os endpoints já criados (`/api/horarios`, `/api/parametros`, `/api/correcoes`, etc.) e remover o `localStorage` como fonte de verdade.

### 3.2 Segurança, papéis e auditoria (P0)

- `routes/crud.js` não verifica `req.usuario.role` — qualquer usuário autenticado pode criar/editar/excluir.
- Tabela `auditoria` existe, mas não é usada.
- Sem tela de usuários/permissões, reset de senha, MFA/SSO, revogação de sessões.
- `CORS_ORIGINS` vazio deixa CORS aberto; falta `helmet`, rate limit global e headers de segurança.
- Credenciais de REP em texto puro (`equipamentos.senha`).
- Endpoints de push públicos.
- LGPD: sem política de retenção, consentimento, anonimização e log de acesso.

**Ação:** middleware de autorização por role, auditoria em todas as mutações, tela de usuários, reset de senha, hardening HTTP, criptografia de credenciais de REP e token de push por dispositivo.

### 3.3 Conformidade fiscal e folha (P0/P1)

- AFD/AFDT/ACJEF/AEJ são gerados, mas precisam ser validados contra o leiaute oficial (Portaria 671/1510).
- Falta hash/assinatura, NSR consistente, fechamento fiscal e retenção legal.
- Sem eSocial (S-1200/S-1210 etc.) nem layouts de folha (Domínio, Alterdata, Fortes, Questor, Sênior).
- Sem trava de período fechado (após fechamento, alterações exigem reabertura auditada).

**Ação:** validador de arquivos fiscais, fechamento de período, exportação para folha/eSocial e trilha de auditoria fiscal.

### 3.4 Apuração e workflow (P1)

- Sem fluxo de aprovação (gestor → RH), sem histórico de quem aprovou.
- Sem tratamento de férias, afastamentos, atestados e licenças.
- Sem “ponto por exceção”, “compensado”, “almoço livre” e “neutro” na UI.
- Sem fechamento por turno/escala e sem reabertura controlada.

**Ação:** workflow de aprovação, ocorrências/afastamentos, fechamento e reabertura com auditoria.

### 3.5 Cadastros e regras (P1)

- Sem UI para escala mensal, jornada por exceção, feriados e faixas avançadas de HE (o motor já suporta).
- Sem configuração de banco de horas (piso/teto/período/ajustes) na UI.
- Sem CCT/sindicato, adicional noturno por convenção, arredondamento e regras por empresa.
- Sem histórico de alteração de horário/salário.

**Ação:** telas de configuração e versionamento de regras.

### 3.6 Relatórios e indicadores (P1)

- Relatórios básicos; falta espelho customizável, cartão ponto, extrato de banco, DSR, faltas, HE, noturno, indicadores e agendamento por e-mail.
- Exportação só PDF via impressão; falta Excel/CSV.
- Dashboard atual é prévia de AFD, não um painel gerencial.

**Ação:** relatórios parametrizáveis, exportação Excel/CSV/PDF, agendamento e dashboard com KPIs.

### 3.7 Mobile e portal do funcionário (P1)

- Marcação mobile existe, mas sem geolocalização, anti-spoofing, selfie, offline e notificações.
- Sem portal para o funcionário ver espelho, saldo, solicitar ajuste/abono/atestado.
- Sem comprovante de marcação.

**Ação:** PWA/app, geolocalização validada, portal do funcionário e notificações.

### 3.8 REPs e integrações (P1)

- REPs ainda em `database.json`; frontend usa `localStorage` + `/api/reps` (JSON).
- Push em memória (perde ao reiniciar).
- Sem autenticação de push por dispositivo.
- Sem monitoramento/alerta de REP offline, firmware, biometria/facial no fluxo de ponto.

**Ação:** mover REPs para PostgreSQL (`/api/equipamentos`), persistir push, token por dispositivo e monitoramento.

### 3.9 Operação/SaaS (P1/P2)

- Sem backup automatizado/PITR testado.
- Sem monitoramento, error tracking, alertas e logs estruturados.
- Sem CI/CD, staging, migrations versionadas com rollback.
- Sem multiempresa real na UI, cobrança/assinatura (se SaaS), SLA e suporte.

**Ação:** backups, observabilidade, CI/CD, staging e multiempresa.

### 3.10 Qualidade de engenharia (P1/P2)

- Só existem testes do motor e um smoke test da API.
- Sem testes unitários de backend, integração, E2E e contrato.
- Lint ainda tem erros pré-existentes.
- Sem tipagem (TypeScript) e sem documentação de API (OpenAPI).

**Ação:** testes, lint limpo, CI, OpenAPI e revisão de código.

---

## 4. Roadmap por fases

### Fase 5 — Consolidação de dados (1–2 semanas) — **P0**

**Status (03/11/2026): validado no Railway — resta apenas persistir o push.**

> Correção importante encontrada pelo smoke test: o CRUD genérico listava sem
> `id`. Corrigido em `de70ffc` (`SELECT id, ...`). Sem isso, edição/exclusão e
> vínculos funcionário→horário quebravam.

1. ✅ Migrar horários, parâmetros, departamentos, cargos, correções, dias descartados, marcações descartadas, equipamentos e histórico para o PostgreSQL.
2. ✅ Remover `localStorage` como fonte de verdade (mantido apenas como cache/token).
3. ✅ Unificar REPs em `/api/equipamentos` (frontend).
4. ✅ Persistir push (`devices`, `events`, `results`) no banco (`006_push_persistencia`).
5. ✅ Criar migrations para as tabelas novas (`002` a `006`).

**Pronto quando:** dois usuários em máquinas diferentes veem os mesmos dados e nada se perde ao limpar o navegador. *(Validado no Railway em 03/11/2026.)*

### Fase 6 — Segurança, papéis e auditoria (1 semana) — **P0**

**Status (03/11/2026): backend e tela de usuários entregues.**

1. ✅ Middleware de autorização por role (`admin`, `gestor`, `consulta`).
2. ✅ Auditoria em todas as mutações (quem, quando, entidade e detalhes).
3. ✅ Tela de usuários, reset de senha e revogação de sessões.
4. ✅ `helmet`, rate limit global e CORS restrito; ✅ criptografia de credenciais de REP (`REP_SECRET`).
5. ⏳ Token de push por dispositivo.
6. ⏳ Política de retenção/LGPD.

**Pronto quando:** um usuário `consulta` não consegue alterar nada, e toda alteração tem trilha auditável. *(Enforcement e auditoria já valem; falta validar no Railway.)*

### Fase 7 — Conformidade fiscal e folha (2–3 semanas) — **P0/P1**

1. Validador de AFD/AFDT/ACJEF/AEJ contra o leiaute oficial.
2. Hash/NSR consistente e fechamento fiscal por período.
3. Trava de período fechado + reabertura auditada.
4. Exportação para folha (Domínio, Alterdata, Fortes, Questor, Sênior) e eSocial.
5. Testes com arquivos reais de REP.

**Pronto quando:** um contador consegue fechar o mês, gerar os arquivos e importar na folha sem ajuste manual.

### Fase 8 — Workflow e relatórios (2–3 semanas) — **P1**

1. Fluxo de aprovação da apuração.
2. Férias, afastamentos, atestados e licenças.
3. Telas de escala mensal, jornada por exceção, feriados e banco de horas.
4. Relatórios customizáveis (Excel/CSV/PDF), agendamento e dashboard com KPIs.
5. Espelho de ponto e cartão ponto.

**Pronto quando:** gestor aprova a apuração e o RH exporta relatórios sem planilha paralela.

### Fase 9 — Mobile e portal do funcionário (2–3 semanas) — **P1**

1. Portal do funcionário (espelho, saldo, solicitações, comprovantes).
2. Geolocalização validada + anti-spoofing.
3. Notificações (marcação faltante, aprovação, fechamento).
4. PWA/offline.

**Pronto quando:** o funcionário registra ponto e consulta o espelho pelo celular com localização confiável.

### Fase 10 — Operação/SaaS (contínuo) — **P1/P2**

1. Backup automatizado e restore testado.
2. Monitoramento, logs estruturados, alertas e error tracking.
3. CI/CD, staging e migrations com rollback.
4. Multiempresa na UI, cobrança/assinatura (se SaaS), SLA e suporte.
5. OpenAPI, manual do usuário e treinamento.

---

## 5. Critérios de “pronto para produção profissional”

- [ ] Nenhum dado de negócio em `localStorage`.
- [ ] Papéis/permissões aplicados no backend e na UI.
- [ ] Auditoria de todas as alterações.
- [ ] Fechamento de período + arquivos fiscais validados.
- [ ] Integração com folha/eSocial.
- [ ] Backup/restore testado.
- [ ] Monitoramento/alertas.
- [ ] Testes de backend + E2E + CI.
- [ ] LGPD (retenção, acesso, anonimização).
- [ ] Portal do funcionário + mobile com geolocalização.
- [ ] Documentação e manual.

---

## 6. Próximo sprint recomendado

**Fase 5 + Fase 6** em paralelo:

1. Migrar os auxiliares do `localStorage` para PostgreSQL.
2. Unificar REPs no banco e persistir push.
3. Aplicar roles + auditoria.

Isso elimina os dois maiores riscos atuais: **perda/duplicidade de dados** e **falta de controle de acesso/auditoria**. Depois disso, a conformidade fiscal e a folha são o caminho natural para o nível RHiD/Secullum/EzPoint.
