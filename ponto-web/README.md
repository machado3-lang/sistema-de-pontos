# Pontos Web - Documentação do Sistema

## Visão Geral

**Pontos Web** (também identificado como "Multicom Ponto") é um sistema web para gestão de ponto eletrônico de funcionários, desenvolvido com foco no tratamento de batidas offline e conformidade com as portarias trabalhistas brasileiras.

### Tecnologias

- **Frontend**: React 19 + Vite
- **Backend/Autenticação**: Supabase
- **Estilização**: CSS customizado com design glassmorphism
- **Ícones**: Lucide React

---

## Funcionalidades

### 1. Autenticação

- Login com e-mail e senha via Supabase Auth
- Sessão persistente com verificação automática
- Logout seguro

### 2. Dashboard Central

- **Importação de AFD**: Upload de arquivos de Registro de Ponto (`.txt`, `.afd`)
- **Estatísticas em tempo real**:
  - Total de funcionários ativos
  - Batidas processadas
  - Inconsistências detectadas (batidas ímpares)
- **Tabela de resultados**: Exibe batidas por colaborador com status diário

### 3. Cadastros Auxiliares

Módulos para cadastro de:

| Módulo | Descrição |
|--------|------------|
| **Funcionários** | Nome, CPF, PIS, matrícula, empresa vinculada, departamento, cargo, horário |
| **Empresas** | CNPJ, razão social (matriz e filiais) |
| **Grade de Horários** | Regras de jornada, tolerâncias, DSR |
| **Equipamentos (REP)** | Relógios de ponto (Secullum, ControliD, etc) |
| **Parâmetros/Feriados** | Banco de horas, limites de hora extra, adicional noturno, calendário de feriados |

### 4. Apuração de Ponto

- Filtros por período e departamento
- Lista de exceções encontradas (batidas ímpares, horas extras elevadas)
- Área de ajuste rápido para:
  - Inclusão de batida manual
  - Justificativa legal (atestado, problema no REP, etc)
  - Cálculo de horas trabalhadas, previstas, extras e atrasos

### 5. Relatórios

- Área destinada para geração de espelho de ponto em PDF
- Exportação de AFDT para contabilidade

---

## Motor de Cálculo (PontoEngine.js)

O sistema possui um motor de cálculo JavaScript que processa o arquivo AFD **100% no navegador** (client-side), sem necessidade de envio ao servidor.

### Funcionalidades do Motor

- **Parsing de arquivos AFD**: Suporta ambas as portarias:
  - **Portaria 1510**: Formato clássico com PIS
  - **Portaria 671**: Formato ISO com CPF
- **Agrupamento por dia**: Organiza batidas por data e funcionário
- **Validação**:
  - Detecta batidas ímpares (número ímpar de registros)
  - Calcula total de minutos trabalhados
- **Formatação**: Converte minutos para formato HH:MM

### Estrutura do Retorno

```javascript
{
  dados: {
    [documento]: {
      [data]: {
        batidas: ["08:00", "12:00", "13:00", "18:00"],
        total_minutos: 480,
        total_formatado: "08:00",
        valido: true
      }
    }
  },
  totalBatidas: 1250,
  totalFuncionarios: 45
}
```

---

## Estrutura de Arquivos

```
ponto-web/
├── src/
│   ├── App.jsx              # Componente principal + Dashboard
│   ├── LoginScreen.jsx     # Tela de autenticação
│   ├── CadastrosTab.jsx    # Módulo de cadastros
│   ├── ApuracaoTab.jsx     # Módulo de apuração
│   ├── PontoEngine.js      # Motor de cálculo
│   ├── supabaseClient.js   # Cliente Supabase
│   ├── main.jsx            # Entry point
│   ├── index.css           # Estilos globais
│   └── App.css             # Estilos do App
├── index.html
├── package.json
├── vite.config.js
└── .env.local              # Variáveis de ambiente
```

---

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.local` com:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

### Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build de produção
npm run build
```

---

## Requisitos Legais

O sistema foi desenvolvido para compliance com:

- **Portaria MTb nº 671/2021** - Novas regras do ponto eletrônico (CPF)
- **Portaria MTb nº 1510/2015** - Regulamentação anterior (PIS)

---

## Status das Funcionalidades

| Funcionalidade | Status |
|----------------|--------|
| Login/Autenticação | ✅ Completo |
| Importação AFD | ✅ Completo |
| Motor de Cálculo | ✅ Completo |
| Cadastro de Funcionários | ✅ Completo |
| Cadastro de Empresas | 🔄 Parcial |
| Cadastro de Horários | 🔄 Parcial |
| Cadastro de Equipamentos | 🔄 Parcial |
| Parâmetros/Feriados | 🔄 Parcial |
| Apuração de Ponto | 🔄 Parcial |
| Relatórios/Espelho PDF | ❌ Pendente |
| Exportação AFDT | ❌ Pendente |

---

## Autor

Desenvolvido por **Multicom MS Ltda.**