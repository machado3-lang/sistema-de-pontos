# Modelo de feriados, justificativas e inconsistências

Documento de análise e proposta para a próxima fase (apuração estilo RHiD).

Data: 04/11/2026

> **Atualização (implementado):** o escopo do feriado não é mais uma coluna única.
> Ele usa `feriado_aplicacoes` com dimensões combináveis (empresa, UF, cidade
> IBGE, funcionário, departamento, horário): dimensões diferentes são **E**,
> valores da mesma dimensão são **OU**. O `tipo` ficou como classificação.
> A cidade é selecionável via IBGE (`funcionarios.cidade_ibge`).
>
> **Atualização 04/11/2026:** os seis tipos de justificativa (seção 2.3) e os
> lançamentos (2.4) foram implementados, e o motor aplica o efeito de cada tipo
> (seção 3.2). As inconsistências configuráveis (2.5/3.3) também foram
> implementadas na migration `013_inconsistencias.sql` e na tela
> Cadastros → Inconsistências.

---

## 1. Como os sistemas grandes tratam

### 1.1 Feriados

| Sistema | Escopo | Recorrência | Comportamento |
|---|---|---|---|
| **RHiD** | Todos os funcionários ou empresas, departamentos e horários específicos | Sim (repete anualmente) | Feriado padrão; pode ser trabalhado |
| **Secullum Ponto Web** | Por empresa, departamento, funcionário e **local/cidade** | Sim | Feriado, ponto facultativo e dia normal |
| **EzPoint Web** | Por empresa e escala | Sim | Feriado e dia compensado |

**Conclusão:** feriado não é global. Precisa de **âmbito** (quem é afetado) e **comportamento** (como o dia é calculado).

### 1.2 Justificativas

O RHiD cadastra **tipos de justificativa** com comportamentos distintos:

| Tipo | Efeito |
|---|---|
| Justificar o dia inteiro | Abona o dia (folga, atestado, férias) |
| Período específico | Abona apenas o intervalo informado |
| Abonar quantidade de horas | Desconta N horas do débito |
| Ajustar quantidade de horas | Soma ou subtrai horas do saldo |
| Relocar extra/falta do dia | Move o resultado do dia para o banco de horas |
| Abonar apenas DSR | Não abona a ausência, mas protege o DSR |

O Secullum acrescenta opções como:
- calcular faltas somente para dias inteiros;
- não descontar faltas de horas normais;
- abono de horas por período.

**Conclusão:** justificativa é um **cadastro com regras**, não um texto livre. O texto é só a descrição do lançamento.

### 1.3 Inconsistências

O RHiD permite cadastrar tipos de inconsistência com:
- campo que a dispara (atraso, falta, hora extra, banco);
- tolerância em minutos;
- prioridade (1 a 10);
- ícone exibido na apuração.

**Conclusão:** a apuração deve destacar inconsistências configuráveis, não só “batida ímpar”.

---

## 2. Modelo proposto para o MultiPonto

### 2.1 Local de trabalho (resolve cidade A × cidade B)

Criar `locais_trabalho`:

```sql
CREATE TABLE locais_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cidade text,
  uf text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

E em `funcionarios`:

```sql
ALTER TABLE funcionarios ADD COLUMN local_id uuid REFERENCES locais_trabalho(id) ON DELETE SET NULL;
```

> Alternativa mais simples: `funcionarios.cidade`/`uf`. A tabela de locais é melhor
> porque o mesmo funcionário pode mudar de local e o RH já usa “local” em relatórios.

### 2.2 Feriados com âmbito e comportamento

```sql
ALTER TABLE feriados
  ADD COLUMN comportamento text NOT NULL DEFAULT 'feriado'
    CHECK (comportamento IN ('feriado', 'facultativo', 'dia_normal'));

CREATE TABLE feriado_aplicacoes (
  id bigserial PRIMARY KEY,
  feriado_id bigint NOT NULL REFERENCES feriados(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('empresa','departamento','horario','funcionario','local','cidade','uf')),
  valor text NOT NULL
);
```

Regras:
- **Sem aplicações** → vale para todos os funcionários da conta.
- **Com aplicações** → vale só para quem casa com pelo menos uma.
- `comportamento = 'feriado'`: dia é domingo/feriado (HE 100%, DSR etc.).
- `comportamento = 'facultativo'`: dia útil, mas marcado como facultativo (não gera HE automaticamente).
- `comportamento = 'dia_normal'`: o feriado é ignorado no cálculo; conta como dia útil normal (exatamente o caso que você citou: não gerar hora extra).

### 2.3 Tipos de justificativa

```sql
CREATE TABLE justificativa_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  abreviacao text,
  tipo text NOT NULL CHECK (tipo IN ('dia_inteiro','periodo','horas','ajuste','banco','dsr')),
  abona_falta boolean NOT NULL DEFAULT false,
  abona_horas boolean NOT NULL DEFAULT false,
  protege_dsr boolean NOT NULL DEFAULT false,
  gera_banco boolean NOT NULL DEFAULT false,
  exige_cid boolean NOT NULL DEFAULT false,
  exige_anexo boolean NOT NULL DEFAULT false,
  tolerancia_min integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
```

Exemplos:

| Nome | tipo | abona_falta | abona_horas | protege_dsr | gera_banco |
|---|---|---|---|---|---|
| Atestado médico | dia_inteiro | ✅ | ✅ | ✅ | ❌ |
| Falta justificada | dia_inteiro | ✅ | ✅ | ✅ | ❌ |
| Atraso justificado | periodo | ❌ | ✅ | ❌ | ❌ |
| Abono de horas | horas | ❌ | ✅ | ❌ | ❌ |
| Compensação | banco | ❌ | ❌ | ❌ | ✅ |
| Abono só DSR | dsr | ❌ | ❌ | ✅ | ❌ |

### 2.4 Lançamentos de justificativa

```sql
CREATE TABLE justificativas (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES justificativa_tipos(id),
  data date NOT NULL,
  inicio time,
  fim time,
  minutos integer,
  texto text,
  cid text,
  anexo_url text,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Regras por tipo:
- `dia_inteiro`: ignora `inicio/fim`; abona o dia.
- `periodo`: exige `inicio` e `fim`.
- `horas`: exige `minutos`.
- `ajuste`: `minutos` positivo ou negativo.
- `banco`: move o extra/falta do dia para o banco.
- `dsr`: só protege o DSR.

### 2.5 Tipos de inconsistência (fase seguinte)

```sql
CREATE TABLE inconsistencia_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  campo text NOT NULL CHECK (campo IN ('atraso','falta','extra','banco','batida','outro')),
  tolerancia_min integer NOT NULL DEFAULT 0,
  prioridade integer NOT NULL DEFAULT 5,
  icone text,
  ativo boolean NOT NULL DEFAULT true
);
```

---

## 3. Como o motor passa a decidir

### 3.1 Feriado

1. Buscar feriados da data (recorrente ou pontual).
2. Filtrar pelos âmbitos que casam com o funcionário:
   - empresa do funcionário;
   - departamento;
   - horário;
   - funcionário;
   - local/cidade/UF.
3. Se houver mais de um, vale o de maior prioridade (a definir: funcionário > local > horário > departamento > empresa).
4. Aplicar `comportamento`:
   - `feriado` → `tipoDia = domingos_feriados`;
   - `facultativo` → `tipoDia = dias_uteis` com flag `facultativo`;
   - `dia_normal` → `tipoDia = dias_uteis` (ignora feriado).

### 3.2 Justificativa

No cálculo do dia, depois de apurar marcações:

- `dia_inteiro` + `abona_falta`: zera falta e débito do dia.
- `periodo`: abona os minutos do intervalo informado do débito.
- `horas` + `abona_horas`: reduz o débito em `minutos`.
- `ajuste`: soma/subtrai `minutos` do saldo.
- `banco` + `gera_banco`: move o extra/falta para o banco.
- `dsr` + `protege_dsr`: marca o dia como protegido no cálculo de DSR.

### 3.3 Inconsistências

Gerar no fim do dia conforme os tipos cadastrados:
- atraso acima da tolerância;
- falta;
- extra acima da tolerância;
- banco acima do limite;
- batida ímpar.

A apuração mostra o ícone/prioridade e permite filtrar “somente inconsistências”.

---

## 4. Fases de implementação

| Fase | Entrega |
|---|---|
| **A** | Locais de trabalho + feriados com âmbito/comportamento + cadastro de tipos de justificativa |
| **B** | Motor aplicando feriado por âmbito e comportamento + justificativas |
| **C** | Apuração em grade (funcionário × dia) com edição inline e justificativa |
| **D** | Inconsistências configuráveis + filtros + relatório |

---

## 5. Decisões pendentes

1. **Local/cidade**: criar `locais_trabalho` (recomendado) ou apenas `funcionarios.cidade`/`uf`?
2. **Prioridade de feriados**: funcionário > local > horário > departamento > empresa é aceitável?
3. **Justificativas**: começamos pelos 6 tipos do RHiD ou por um subconjunto (dia inteiro, período, horas)?
4. **Apuração**: grade completa de uma vez ou primeiro a edição inline no painel atual?

---

## 6. Referências

- Manual RHiD — Feriados: https://www.controlid.com.br/suporte/manual_rhid/cadastros/feriados/
- Manual RHiD — Apuração: https://www.controlid.com.br/suporte/manual_rhid/apuracao/tela/
- Manual RHiD — Justificativas: https://www.controlid.com.br/suporte/manual_rhid/apuracao/justificativa/
- Manual RHiD — Inconsistências: https://www.controlid.com.br/suporte/manual_rhid/apuracao/inconsistencias/
- Secullum Ponto Web — lista de funcionalidades (feriados por empresa/local, abonos)
- EzPoint Web — feriados por empresa/escala
