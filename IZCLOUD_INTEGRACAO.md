# Integração MultiPonto ↔ IZCLOUD

O backend do MultiPonto roda no **Railway** e não alcança REPs na rede local
(`192.168.x.x`). O **IZCLOUD** faz a ponte: roda na rede do REP e expõe um
**relay HTTP autenticado** que o MultiPonto consome.

```
┌──────────────┐     HTTPS      ┌──────────────┐     HTTP(S)     ┌─────────┐
│  MultiPonto  │ ─────────────► │   IZCLOUD    │ ──────────────► │   REP   │
│  (Railway)   │  POST /relay   │ (rede local) │  IP direto      │ iDClass │
└──────────────┘                └──────────────┘                 └─────────┘
```

O MultiPonto já está preparado: quando `IZCLOUD_URL` está definido, **todas** as
chamadas de proxy (`/api/reps/proxy/*`) passam pelo relay. Sem a variável, ele
conecta direto no IP do REP (modo usado em desenvolvimento/on-premises).

---

## Variáveis de ambiente (MultiPonto)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `IZCLOUD_URL` | Sim, para usar o relay | URL base do IZCLOUD (ex.: `https://izcloud.seudominio.com`) |
| `IZCLOUD_TOKEN` | Recomendada | Token Bearer que o IZCLOUD valida |
| `REP_TIMEOUT_MS` | Não | Timeout padrão das requisições (padrão 15000) |

`/api/health` mostra:

```json
{ "rep_provider": "izcloud", "rep_relay": true }
```

---

## Contrato que o IZCLOUD precisa implementar

### `POST /relay`

Executa uma requisição HTTP/HTTPS contra o REP e devolve a resposta bruta.

**Headers:**

```
Authorization: Bearer <IZCLOUD_TOKEN>
Content-Type: application/json
```

**Corpo:**

```json
{
  "host": "192.168.0.10",
  "port": 443,
  "protocol": "https",
  "path": "/login.fcgi",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"login\":\"admin\",\"password\":\"admin\"}",
  "body_base64": null,
  "timeout_ms": 15000
}
```

| Campo | Tipo | Observação |
|---|---|---|
| `host` | string | IP/host do REP na rede local |
| `port` | number | Porta (443/80 para iDClass, conforme o equipamento) |
| `protocol` | `"http"` \| `"https"` | O MultiPonto tenta HTTPS e cai para HTTP |
| `path` | string | Caminho FCGI, ex.: `/login.fcgi?session=...` |
| `method` | string | Hoje sempre `POST` |
| `headers` | object | Repassar ao REP |
| `body` | string? | Corpo em texto (JSON do FCGI) |
| `body_base64` | string? | Corpo binário (ex.: foto facial) |
| `timeout_ms` | number? | Timeout sugerido |

**Resposta (200):**

```json
{
  "status": 200,
  "headers": { "content-type": "application/json" },
  "body": "{\"session\":\"abc123\"}",
  "body_base64": null
}
```

| Campo | Tipo | Observação |
|---|---|---|
| `status` | number | Status HTTP devolvido pelo REP |
| `headers` | object | Headers devolvidos pelo REP |
| `body` | string? | Corpo em texto |
| `body_base64` | string? | Corpo binário (quando aplicável) |

**Erros:** responder `4xx/5xx` com `{ "error": "..." }`. O MultiPonto propaga a
mensagem para o frontend.

---

## Exemplos de uso

### 1. Login no iDClass

```http
POST /relay
Authorization: Bearer <token>
Content-Type: application/json

{
  "host": "192.168.0.10",
  "port": 443,
  "protocol": "https",
  "path": "/login.fcgi",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"login\":\"admin\",\"password\":\"admin\"}"
}
```

Resposta esperada do REP (dentro de `body`):

```json
{ "session": "..." }
```

### 2. Listar usuários (PIS/1510)

```json
{
  "path": "/load_users.fcgi?session=SESSAO",
  "body": "{\"mode\":\"1510\"}"
}
```

### 3. Baixar AFD

```json
{
  "path": "/get_afd.fcgi?session=SESSAO",
  "body": "{}"
}
```

---

## Segurança recomendada no IZCLOUD

1. **Exigir** `Authorization: Bearer` em todas as chamadas.
2. Aceitar apenas `host` em faixas privadas (RFC1918) ou em uma allowlist de REPs.
3. Limitar `timeout_ms` (ex.: 30 s) e o tamanho do corpo.
4. Não registrar `password`/`senha` nos logs.
5. Rodar atrás de HTTPS.
6. Rate limit por token.

---

## Como testar antes do IZCLOUD ficar pronto

### Opção 1 — modo direto (backend local)

Sem `IZCLOUD_URL`, o MultiPonto conecta direto no IP do REP. Funciona se o
backend estiver na mesma rede (Docker local).

```bash
cd ponto-cloud
npm start
```

### Opção 2 — relay de teste

Um relay mínimo em Node para validar o contrato:

```js
// relay-teste.mjs
import http from 'http';
import https from 'https';

http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/relay') {
    res.writeHead(404).end();
    return;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const p = JSON.parse(raw);

  const mod = p.protocol === 'http' ? http : https;
  const body = p.body_base64
    ? Buffer.from(p.body_base64, 'base64')
    : Buffer.from(p.body || '');

  const r = mod.request({
    hostname: p.host,
    port: p.port,
    path: p.path,
    method: p.method || 'POST',
    headers: { ...(p.headers || {}), 'Content-Length': body.length },
    rejectUnauthorized: false,
  }, (resp) => {
    const chunks = [];
    resp.on('data', (c) => chunks.push(c));
    resp.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: resp.statusCode,
        headers: resp.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
  });
  r.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  r.write(body);
  r.end();
}).listen(4100, () => console.log('relay de teste em :4100'));
```

Depois, no MultiPonto:

```
IZCLOUD_URL=http://localhost:4100
IZCLOUD_TOKEN=teste
```

> O relay de teste não tem autenticação/allowlist — use só localmente.

---

## Checklist para o IZCLOUD

- [ ] `POST /relay` com Bearer token
- [ ] Suporte a `http` e `https`
- [ ] Suporte a `body` e `body_base64`
- [ ] Timeout configurável
- [ ] Allowlist de IPs privados
- [ ] Logs sem credenciais
- [ ] HTTPS no endpoint público
- [ ] Testado com iDClass 1510 (login, load_users, get_afd)
- [ ] Testado com iDFace (users/load, face/upload)
