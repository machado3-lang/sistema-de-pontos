# Motor de Cálculo — Referência Rápida

Fonte única de cálculo do MultiPonto. Tudo em JavaScript puro (sem React), reutilizável no navegador e, futuramente, no backend.

## Fluxo

```
AFD/REP → punch.normalizarMarcacoes → emparelharBatidas
        → schedule.resolverJornadaDoDia
        → tolerance.aplicarTolerancia
        → night.calcularNoturno
        → overtime.calcularExtras
        → absence.calcularFaltas
        → dsr.calcularDSR
        → bank.calcularBanco
        → calculator.calcularDia / calcularPeriodo
```

## Convenções

- Datas: `YYYY-MM-DD` (horário local).
- Horas: `HH:MM`.
- Minutos: inteiros.
- `params` pode ser parcial; `normalizarParams` faz merge com `DEFAULT_PARAMS`.
- `pares`: `[{ entrada: { time, minutes, ... }, saida: { time, minutes, ... } | null, completo }]`.
- `ocorrencias`: `[{ tipo, mensagem }]`.
- `memoria`: passos do cálculo para auditoria.

## API principal

### `calcularDia(input)`

Calcula um único dia.

```js
import { calcularDia } from './engine/index.js';

const linha = calcularDia({
  data: '2026-10-30',
  funcionario: { id, cpf, pis, data_inicio },
  horario,                 // objeto do cadastro de horários
  params,                  // parâmetros (parcial)
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }],
  correcao: { batidas_manuais: [], justificativa: '' },
  descartadas: [],         // horários desconsiderados
  diaDesconsiderado: null, // { motivo }
  feriados: [],            // ['2026-11-02']
  jornadaOverride: null,   // { periodos, carga_diaria, folga }
  preAssinaladas: [],      // horários pré-assinalados
});
```

**Saída (principais campos):**

| Campo | Descrição |
|---|---|
| `data`, `diaSemana`, `tipoDia` | identificação |
| `trabalha`, `motivo` | se o dia é previsto e por quê |
| `batidas`, `batidas_originais`, `batidas_manuais`, `batidas_descartadas` | batidas para a UI |
| `pares`, `valido`, `descartado` | emparelhamento e status |
| `previstoMin`, `carga_esperada` | jornada prevista |
| `trabalhadoMin`, `trabalhadoBrutoMin`, `normaisMin` | horas trabalhadas |
| `extraMin`, `debitoMin`, `faltaMin`, `faltaJustificadaMin`, `atrasoMin` | HE e faltas |
| `extraFaixa1`, `extraFaixa2`, `faixa1Pct`, `faixa2Pct`, `percentualHE` | faixas de HE |
| `extraDiurnoMin`, `extraNoturnoMin` | separação de HE |
| `noturnoMin`, `noturnoRelogioMin`, `adicionalNoturno`, `horasNoturnas` | noturno |
| `toleranciaMin`, `toleranciaAplicada` | tolerância aplicada |
| `intervaloPrevistoMin`, `intervaloRealMin`, `intervaloFaltanteMin` | intervalos |
| `ocorrencias`, `memoria` | auditoria |
| `dsrMin`, `bancoMin` | preenchidos no período |
| `total_minutos`, `total_formatado` | compatibilidade com a UI antiga |

### `calcularPeriodo(input)`

Calcula um intervalo de datas para um funcionário.

```js
import { calcularPeriodo } from './engine/index.js';

const resultado = calcularPeriodo({
  funcionario,
  doc: '12345678901',
  marcacoes: [...],
  horario,
  params,
  dataInicio: '2026-10-01',
  dataFim: '2026-10-31',
  correcoes,              // { 'doc_data': { batidas_manuais, justificativa } }
  diasDescartados,        // { 'doc_data': { motivo } }
  marcacoesDescartadas,   // { 'doc_data': ['12:00'] }
  feriados: [],
  jornadas: {},           // { '2026-10-15': { periodos, carga_diaria } }
  preAssinaladas: {},     // { '2026-10-15': ['12:00'] }
  bancoSaldoInicial: 0,
});
```

**Saída:**

```js
{
  funcionario, doc,
  linhas: [/* calcularDia */],
  totais: {
    totalPrevisto, totalTrabalhado, totalNormais, totalExtra,
    totalFalta, totalFaltaJustificada, totalNoturno, totalNoturnoRelogio,
    totalDSR, totalAtraso, totalTolerancia, totalExtraDiurno,
    totalExtraNoturno, totalIntervaloFaltante,
    saldo, bancoSaldoFinal,
    // compatibilidade:
    totalEsp, totalTrab, totalHE, totalNot
  },
  dsr: { dsrMin, porData, detalhes },
  banco: { ativo, saldoInicial, creditoMin, debitoMin, ajusteMin, saldoFinal, porData }
}
```

### `calcularTodos(input)`

Atalho para vários funcionários:

```js
calcularTodos({
  funcionarios, marcacoes, horarios, parametrosMap,
  correcoes, diasDescartados, marcacoesDescartadas,
  feriados, dataInicio, dataFim,
});
// → [calcularPeriodo(...), ...]
```

### AFD

```js
import { parseAFD, parseAFDLinhas } from './engine/index.js';

parseAFDLinhas(conteudo);
// → { linhas: [{ nsr, documento, data, hora, dataHora, portaria }], total }

parseAFD(conteudo);
// → { dados, linhas, totalBatidas, totalFuncionarios }
```

### Utilitários

```js
import {
  toMinutes, formatMinutes, formatDecimalHours,
  parseDate, formatDate, addDays, eachDate,
  weekdayKey, weekdayName, isHoliday, dayType,
  normalizarParams, paramsPadrao,
} from './engine/index.js';
```

## Parâmetros principais (`DEFAULT_PARAMS`)

- `geral`: fechamento, arredondamento, ponto por exceção, feriado trabalhado.
- `noturno`: adicional, hora reduzida, janela.
- `horas_extras`: faixas por tipo de dia, acúmulo, separação noturna.
- `banco_horas`: piso, teto, controle diário/mensal, multiplicador, faixas.
- `faltas_atrasos`: tolerância, DSR, falta somente dia inteiro.
- `clt_art58`: método, limites por batida/dia, janela de casamento.
- `intervalo`: intrajornada, tolerância, interjornada.
- `dsr`: percentual, feriados, módulo, desconto por faltas.

## Como adicionar uma regra

1. Adicione o parâmetro em `constants.js` (com default).
2. Implemente no módulo responsável (`tolerance.js`, `overtime.js`, etc.).
3. Exponha o resultado em `calculator.js` (`calcularDia`).
4. Adicione um caso em `scripts/test-engine.mjs`.
5. Se a UI precisar, atualize `ApuracaoTab`/`RelatoriosTab`.

## Testes

```bash
cd ponto-web
npm run test:engine
```

Cobrem: dia normal, HE com faixas, tolerância CLT e simples, falta de dia inteiro, feriado, trabalho em folga, noturno, escala cíclica, DSR, banco (piso/teto) e AFD 1510/671.

## Compatibilidade

- `src/PontoEngine.js` reexporta `parseAFD` e `parseMinutosToHHMM`.
- `src/cadastros/parametrosUtils.js` mantém a API antiga (`calcHorasExtras`, `aplicarTolerancia`, etc.) delegando ao motor.
