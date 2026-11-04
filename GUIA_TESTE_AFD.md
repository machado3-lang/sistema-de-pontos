# Guia de teste — importação de AFD real

Passo a passo para validar a importação de um arquivo AFD baixado manualmente
de um REP, enquanto a conexão direta com os equipamentos não está disponível
no Railway.

---

## 1. Antes de importar

### 1.1 Aplicar as migrations

No console do Railway (serviço do backend):

```bash
cd /app && npm run migrate
```

O runner aplica, em ordem, as migrations pendentes. O estado esperado é
`001_init` até `013_inconsistencias`. Se alguma já estiver aplicada, ele apenas
informa `já aplicada`.

> O `preDeployCommand` do `railway.json` não está executando de forma
> confiável. Por isso, rode o migrate manualmente após cada deploy que trouxer
> migration nova.

### 1.2 Conferir o health check

```bash
curl https://<seu-servico>.up.railway.app/api/health
```

Resposta esperada: `db: "ok"` e `rep_encryption: true`.

### 1.3 Cadastrar os funcionários

Em **Cadastros → Funcionários**, preencha:

- **CPF** (usado pelo AFD da Portaria 671);
- **PIS** (usado pelo AFD da Portaria 1510);
- horário, parâmetros e empresa.

O cruzamento do AFD é feito por CPF ou PIS. Se o funcionário só tiver CPF e o
arquivo for 1510 (PIS), ele não será encontrado.

---

## 2. Importar o AFD

1. Abra o **Dashboard**.
2. Arraste o arquivo `.txt`/`.afd` para a área de upload (ou clique e escolha).
3. Aguarde o processamento.

O sistema lê o arquivo como **ISO 8859-1**, conforme a norma, e mostra:

- portaria detectada (1510 ou 671);
- versão do leiaute (quando 671);
- período inicial e final;
- total de marcações e separação por tipo (3 e 7);
- empregador do cabeçalho;
- erros e avisos da validação estrutural;
- documentos sem funcionário cadastrado (com o nome vindo do registro tipo 5).

### 2.1 Se aparecer “Trailer não encontrado”

Verifique se o arquivo realmente termina com o registro tipo 9. Nos leiautes
AFD 1510 e 671, o trailer começa com `999999999`, traz os contadores e termina
com o caractere `9`:

- 1510: 46 caracteres;
- 671: 64 caracteres.

O parser atual reconhece os dois formatos. Se o aviso persistir, confira se o
arquivo não foi truncado ou salvo com quebra de linha extra.

### 2.2 Se aparecerem documentos não cadastrados

A lista mostra o CPF/PIS e o nome do tipo 5. Cadastre o documento no funcionário
correspondente e importe novamente. A reimportação do mesmo arquivo é
idempotente: o `equip_id` é derivado do hash do conteúdo (`afd:<hash>`), então
as marcações não duplicam.

### 2.3 Se aparecer erro de gravação no servidor

O resultado mostra a mensagem retornada pela API e não conta as marcações como
importadas. Causas comuns:

- período fechado (HTTP 409) — reabra o período na Apuração;
- backend sem conexão com o PostgreSQL;
- sessão expirada — faça login novamente.

---

## 3. Conferir na Apuração

1. Abra **Apuração de Ponto**.
2. Selecione o período que cobre o AFD.
3. A grade mostra funcionário × dia com:
   - batidas;
   - previsto, trabalhado, normais, noturno, atraso, extra, DSR e banco;
   - status conforme as inconsistências configuradas;
   - justificativas e correções aplicadas.
4. Clique em um dia para abrir o painel de tratamento.

### 3.1 Testar uma justificativa

1. No painel, escolha um tipo em **Justificativas**.
2. Dependendo do tipo, informe período, minutos, CID e anexo.
3. Clique em **Aplicar**.
4. Confira o efeito no dia:
   - falta abonada;
   - débito reduzido;
   - ajuste de saldo;
   - movimento de banco;
   - DSR protegido.

### 3.2 Testar uma inconsistência

Em **Cadastros → Inconsistências**, ajuste o limite e a prioridade. Volte à
Apuração e confira o status do dia e o filtro **Somente inconsistências**.

---

## 4. Gerar os arquivos fiscais

Em **Relatórios → Fiscais**:

- **AFD**: arquivo fonte (marcações originais).
- **AFDT**: tratado.
- **ACJEF**: controle de jornada.
- **AEJ**: jornada com:
  - tipo 05: inclusões (`fonteMarc = I`) e desconsiderações (`tpMarc = D`)
    levam o **motivo**;
  - tipo 07: DSR, falta não justificada e movimento de banco.

### 4.1 Limitações conhecidas do AEJ

- O registro tipo 02 ainda usa um identificador placeholder de REP.
- A assinatura digital P7S ainda não é gerada.
- O hash/validação formal do AEJ ainda está pendente.

Esses pontos estão no roadmap e não impedem a conferência funcional dos dados.

---

## 5. O que observar no arquivo AFD

### Portaria 1510 (REP-C/REP-A, PIS)

Marcação tipo 3:

```
[0-8]   NSR
[9]     tipo = 3
[10-17] data ddmmaaaa
[18-21] hora hhmm
[22-33] PIS (12 posições)
```

### Portaria 671 (CPF)

Marcação tipo 3 (REP-C/REP-A):

```
[0-8]   NSR
[9]     tipo = 3
[10-33] data/hora AAAA-MM-DDThh:mm:00-0300
[34-45] CPF (12 posições)
[46-49] CRC-16
```

Marcação tipo 7 (REP-P):

```
[0-8]   NSR
[9]     tipo = 7
[10-33] data/hora da marcação
[34-45] CPF
[46-69] data/hora de gravação
[70-71] coletor
[72]    on-line (0) / off-line (1)
[73-136] hash SHA-256
```

O parser aceita os dois tipos e trata o cabeçalho, os empregados (tipo 5), os
eventos (tipo 6) e o trailer (tipo 9).

---

## 6. Checklist rápido

- [ ] `npm run migrate` aplicado até 013
- [ ] `/api/health` com `db: ok`
- [ ] Funcionários com CPF/PIS corretos
- [ ] AFD importado sem erro de gravação
- [ ] Documentos não cadastrados resolvidos
- [ ] Apuração conferida
- [ ] Justificativa testada
- [ ] Inconsistência testada
- [ ] AFD/AFDT/ACJEF/AEJ gerados
- [ ] Motivo presente no AEJ tipo 05
- [ ] Tipo 07 conferido

---

## 7. Se precisar investigar

- `ponto-web/scripts/test-engine.mjs` — testes do parser e do motor.
- `ponto-cloud/scripts/test-api.mjs` — smoke test da API.
- `afd_texto.txt` — leiaute AFD 671.
- `afd_1510_texto.txt` — leiaute AFD 1510.
- `aej_texto.txt` — leiaute AEJ.
- `CONTINUIDADE.md` — seções 21 a 27 com o histórico das últimas entregas.
