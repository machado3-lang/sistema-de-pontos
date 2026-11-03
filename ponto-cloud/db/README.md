# Banco de Dados — PostgreSQL (Railway)

Esta pasta contém o schema inicial e os utilitários de banco.

## Arquivos

| Arquivo | Uso |
|---|---|
| `migrations/001_init.sql` | Schema inicial (empresas, usuários, funcionários, marcações, etc.) |
| `migrate.js` | Runner de migrations com controle em `schema_migrations` |
| `seed-admin.js` | Cria/atualiza a empresa padrão e o usuário admin |

## Rodar localmente

```bash
# 1. Tenha um PostgreSQL acessível
export DATABASE_URL="postgresql://usuario:senha@localhost:5432/pontoweb"

# 2. Aplique o schema
cd ponto-cloud
npm run migrate

# 3. Crie o admin
ADMIN_EMAIL="admin@empresa.com" \
ADMIN_PASSWORD="uma-senha-forte" \
EMPRESA_RAZAO="Minha Empresa" \
EMPRESA_DOC="00000000000000" \
npm run seed:admin
```

## Rodar no Railway

```bash
# Adicione o plugin PostgreSQL ao projeto
railway add --plugin postgresql

# O Railway injeta DATABASE_URL no serviço.
# Aplique as migrations:
railway run npm run migrate

# Crie o admin:
railway run env ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
```

## Observações

- `cpf_cnpj` e `cpf` devem ser armazenados **somente com dígitos**.
- `horarios.config` e `parametros.config` são `jsonb` (mesma estrutura do frontend).
- Todas as tabelas de domínio têm `empresa_id` para isolamento multiempresa.
- `marcacoes.hora` é `time`; `marcacoes.data` é `date`.
- `correcoes.batidas_manuais` é `time[]`.
- A senha do REP (`equipamentos.senha`) está em texto puro no schema inicial; o ideal é criptografar em uma fase futura.
- O runner usa advisory lock para evitar migrations concorrentes.
